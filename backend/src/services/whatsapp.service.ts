import path from 'path';
import fs from 'fs';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket,
  isJidBroadcast
} from '@whiskeysockets/baileys';
import pino from 'pino';
// @ts-ignore
import QRCode from 'qrcode';
import prisma from '../prisma.js';

export interface WhatsAppAccountSession {
  account: any;
  sock: WASocket | null;
  isConnected: boolean;
  botPhoneNumber: string | null;
  currentQrDataUrl: string | null;
  currentRawQr: string | null;
  isInitializing: boolean;
  isSyncingFiles: boolean;
  sessionDir: string;
  sessionSyncTimer: NodeJS.Timeout | null;
}

export interface SendMessageOptions {
  branchId?: string;
  type?: 'OTP' | 'ADMIN_ALERT' | 'ORDER';
  accountId?: string;
}

class WhatsAppService {
  private sessions: Map<string, WhatsAppAccountSession> = new Map();
  private baseSessionDir: string = process.env.WHATSAPP_SESSION_PATH || (
    fs.existsSync('/var/data') ? '/var/data/auth_info_baileys' : path.resolve(process.cwd(), 'auth_info_baileys')
  );
  private isBooting: boolean = false;

  constructor() {
    this.ensureDir(this.baseSessionDir);
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error('[WhatsApp] Error creating dir:', err);
      }
    }
  }

  // التأكد من وجود حساب افتراضي ونقل أي ملفات جلسة قديمة لضمان عدم انقطاع الخدمة السابقة
  public async ensureDefaultAccount() {
    try {
      const count = await prisma.whatsAppAccount.count();
      if (count === 0) {
        console.log('[WhatsApp] Creating initial default WhatsApp account...');
        const defaultAcc = await prisma.whatsAppAccount.create({
          data: {
            id: 'default',
            name: 'الحساب الرئيسي للواتساب',
            isDefault: true,
            isActive: true,
            sendOtp: true,
            sendAdminAlerts: true,
            sendCustomerOrders: true,
          }
        });

        // ترحيل أي ملفات جلسة سابقة كانت مخزنة في SystemSetting
        try {
          const oldFiles = await prisma.systemSetting.findMany({
            where: { key: { startsWith: 'baileys_file_' } }
          });
          if (oldFiles.length > 0) {
            console.log(`[WhatsApp] Migrating ${oldFiles.length} legacy session files to default account...`);
            for (const rec of oldFiles) {
              const filename = rec.key.replace('baileys_file_', '');
              await prisma.whatsAppSessionFile.upsert({
                where: { accountId_filename: { accountId: 'default', filename } },
                update: { content: rec.value },
                create: { accountId: 'default', filename, content: rec.value }
              }).catch(() => {});
            }
          }
        } catch (_migErr) {}

        return defaultAcc;
      }
    } catch (err) {
      console.warn('[WhatsApp] ensureDefaultAccount warning:', err);
    }
    return null;
  }

  // استرجاع ملفات الجلسة لحساب محدد من PostgreSQL مع استبعاد المفاتيح القديمة
  private async restoreAccountSessionFromDb(accountId: string, sessionDir: string) {
    try {
      this.ensureDir(sessionDir);
      const credsPath = path.join(sessionDir, 'creds.json');
      if (!fs.existsSync(credsPath)) {
        // 1. استرجاع creds.json أولاً
        const credsRec = await prisma.whatsAppSessionFile.findUnique({
          where: { accountId_filename: { accountId, filename: 'creds.json' } }
        });
        if (credsRec?.content) {
          fs.writeFileSync(credsPath, credsRec.content, 'utf-8');
        }

        // 2. استرجاع باقي المفاتيح مع تصفية أحدث 40 مفتاح فقط
        const records = await prisma.whatsAppSessionFile.findMany({
          where: { 
            accountId,
            NOT: { filename: 'creds.json' }
          },
          select: { id: true, filename: true, content: true }
        });

        if (records.length > 0) {
          const preKeys = records
            .filter(r => r.filename.startsWith('pre-key-'))
            .map(r => {
              const m = r.filename.match(/pre-key-(\d+)\.json/);
              return { ...r, num: m ? parseInt(m[1], 10) : 0 };
            })
            .sort((a, b) => b.num - a.num);

          const nonPreKeys = records.filter(r => !r.filename.startsWith('pre-key-'));
          const keepPreKeys = preKeys.slice(0, 40);
          const obsoleteIds = preKeys.slice(40).map(k => k.id);

          const toWrite = [...nonPreKeys, ...keepPreKeys];
          for (const rec of toWrite) {
            const filename = path.basename(rec.filename);
            fs.writeFileSync(path.join(sessionDir, filename), rec.content, 'utf-8');
          }
          console.log(`[WhatsApp:${accountId}] Restored ${toWrite.length} session files from DB.`);

          if (obsoleteIds.length > 0) {
            prisma.whatsAppSessionFile.deleteMany({
              where: { id: { in: obsoleteIds } }
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn(`[WhatsApp:${accountId}] Error restoring session files from DB:`, err);
    }
  }

  // تنظيف الـ pre-keys الزائدة لحساب محدد
  private async pruneAccountPreKeys(accountId: string, sessionDir: string) {
    try {
      if (!fs.existsSync(sessionDir)) return;
      const files = fs.readdirSync(sessionDir);
      const preKeyFiles = files
        .filter(f => f.startsWith('pre-key-') && f.endsWith('.json'))
        .map(f => {
          const m = f.match(/pre-key-(\d+)\.json/);
          return { file: f, num: m ? parseInt(m[1], 10) : 0 };
        })
        .sort((a, b) => b.num - a.num);

      if (preKeyFiles.length > 40) {
        const toDelete = preKeyFiles.slice(40);
        for (const item of toDelete) {
          try {
            fs.unlinkSync(path.join(sessionDir, item.file));
          } catch (_e) {}
        }
        const fileNames = toDelete.map(d => d.file);
        await prisma.whatsAppSessionFile.deleteMany({
          where: { accountId, filename: { in: fileNames } }
        }).catch(() => {});
      }
    } catch (_err) {}
  }

  // مزامنة ملفات جلسة حساب محدد دورياً مع قاعدة البيانات
  private async syncAccountSessionFiles(session: WhatsAppAccountSession) {
    if (session.isSyncingFiles || !session.isConnected) return;
    session.isSyncingFiles = true;
    try {
      const { account, sessionDir } = session;
      if (!fs.existsSync(sessionDir)) return;
      await this.pruneAccountPreKeys(account.id, sessionDir);

      const files = fs.readdirSync(sessionDir);
      const nonPreKeys = files.filter(f => f.endsWith('.json') && !f.startsWith('pre-key-'));
      const preKeys = files
        .filter(f => f.startsWith('pre-key-') && f.endsWith('.json'))
        .map(f => {
          const m = f.match(/pre-key-(\d+)\.json/);
          return { file: f, num: m ? parseInt(m[1], 10) : 0 };
        })
        .sort((a, b) => b.num - a.num)
        .slice(0, 30)
        .map(p => p.file);

      const toSync = [...nonPreKeys, ...preKeys];
      for (const file of toSync) {
        const filePath = path.join(sessionDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          await prisma.whatsAppSessionFile.upsert({
            where: { accountId_filename: { accountId: account.id, filename: file } },
            update: { content },
            create: { accountId: account.id, filename: file, content }
          }).catch(() => {});
        }
      }
    } catch (_err) {
    } finally {
      session.isSyncingFiles = false;
    }
  }

  // تهيئة جلسة واتساب لحساب معين
  public async initAccount(account: any) {
    const accountId = account.id;
    let session = this.sessions.get(accountId);

    const sessionDir = path.join(this.baseSessionDir, accountId);
    this.ensureDir(sessionDir);

    if (!session) {
      session = {
        account,
        sock: null,
        isConnected: false,
        botPhoneNumber: account.phoneNumber || null,
        currentQrDataUrl: null,
        currentRawQr: null,
        isInitializing: false,
        isSyncingFiles: false,
        sessionDir,
        sessionSyncTimer: null
      };
      this.sessions.set(accountId, session);
    } else {
      session.account = account;
      session.sessionDir = sessionDir;
    }

    if (session.isInitializing) return;
    session.isInitializing = true;

    try {
      await this.restoreAccountSessionFromDb(accountId, sessionDir);
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: [`UniFood - ${account.name || 'Bot'}`, 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false, // توفير الرام بعدم تنزيل المحادثات القديمة
        shouldIgnoreJid: (jid) => isJidBroadcast(jid) || jid.endsWith('@newsletter'),
        getMessage: async () => undefined,
      });

      session.sock = socket;

      // عند تحديث الاعتماد، نحفظ فقط creds.json الخاص بهذا الحساب
      socket.ev.on('creds.update', async () => {
        await saveCreds();
        try {
          const credsPath = path.join(sessionDir, 'creds.json');
          if (fs.existsSync(credsPath)) {
            const content = fs.readFileSync(credsPath, 'utf-8');
            await prisma.whatsAppSessionFile.upsert({
              where: { accountId_filename: { accountId, filename: 'creds.json' } },
              update: { content },
              create: { accountId, filename: 'creds.json', content }
            }).catch(() => {});
          }
        } catch (_syncErr) {}
      });

      // مؤقت مزامنة دورية خفيف كل 4 دقائق
      if (session.sessionSyncTimer) {
        clearInterval(session.sessionSyncTimer);
      }
      session.sessionSyncTimer = setInterval(() => {
        if (session) this.syncAccountSessionFiles(session).catch(() => {});
      }, 4 * 60 * 1000);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          session.currentRawQr = qr;
          try {
            session.currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
            console.log(`[WhatsApp:${accountId}] QR generated for account: ${account.name}`);
          } catch (qrErr) {
            console.error(`[WhatsApp:${accountId}] QR generation error:`, qrErr);
          }
        }

        if (connection === 'open') {
          session.isConnected = true;
          session.currentQrDataUrl = null;
          session.currentRawQr = null;
          session.isInitializing = false;

          const rawId = socket.user?.id || '';
          const phone = rawId.split(':')[0] || rawId.split('@')[0] || 'متصل';
          session.botPhoneNumber = phone;
          console.log(`[WhatsApp:${accountId}] Connected! Phone: ${phone} (${account.name})`);

          // حفظ رقم الهاتف في قاعدة البيانات
          prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: { phoneNumber: phone }
          }).catch(() => {});

          setTimeout(() => {
            if (session) this.syncAccountSessionFiles(session).catch(() => {});
          }, 30000);
        } else if (connection === 'close') {
          session.isConnected = false;
          session.isInitializing = false;

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp:${accountId}] Closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => {
              this.initAccount(account);
            }, 5000);
          } else {
            console.log(`[WhatsApp:${accountId}] Logged out. Resetting session files...`);
            this.cleanupAccountSession(accountId);
            setTimeout(() => {
              this.initAccount(account);
            }, 3000);
          }
        }
      });
    } catch (err) {
      session.isInitializing = false;
      console.error(`[WhatsApp:${accountId}] Init error:`, err);
    }
  }

  // تنظيف جلسة حساب معين محلياً وقاعدة البيانات
  private cleanupAccountSession(accountId: string) {
    const session = this.sessions.get(accountId);
    if (session?.sessionSyncTimer) {
      clearInterval(session.sessionSyncTimer);
      session.sessionSyncTimer = null;
    }
    const sessionDir = path.join(this.baseSessionDir, accountId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        this.ensureDir(sessionDir);
      } catch (_e) {}
    }
    prisma.whatsAppSessionFile.deleteMany({
      where: { accountId }
    }).catch(() => {});

    prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { phoneNumber: null }
    }).catch(() => {});

    if (session) {
      session.isConnected = false;
      session.currentQrDataUrl = null;
      session.currentRawQr = null;
      session.botPhoneNumber = null;
    }
  }

  // بدء تشغيل جميع الحسابات المفعلة
  public async initWhatsApp() {
    return this.initAll();
  }

  public async initAll() {
    if (this.isBooting) return;
    this.isBooting = true;
    try {
      await this.ensureDefaultAccount();
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { isActive: true },
        include: { branch: { select: { id: true, name: true } } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
      });

      console.log(`[WhatsApp] Booting ${accounts.length} WhatsApp account session(s)...`);
      for (const acc of accounts) {
        await this.initAccount(acc);
      }
    } catch (err) {
      console.error('[WhatsApp] Booting error:', err);
    } finally {
      this.isBooting = false;
    }
  }

  // جلب قائمة الحسابات وحالتها اللحظية
  public async getAllAccountsStatus() {
    const accounts = await prisma.whatsAppAccount.findMany({
      include: { branch: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });

    return accounts.map(acc => {
      const session = this.sessions.get(acc.id);
      return {
        id: acc.id,
        name: acc.name,
        phoneNumber: session?.botPhoneNumber || acc.phoneNumber || null,
        isConnected: Boolean(session?.isConnected),
        isInitializing: Boolean(session?.isInitializing),
        qrCode: session?.currentQrDataUrl || null,
        isActive: acc.isActive,
        isDefault: acc.isDefault,
        sendOtp: acc.sendOtp,
        sendAdminAlerts: acc.sendAdminAlerts,
        sendCustomerOrders: acc.sendCustomerOrders,
        branchId: acc.branchId,
        branch: acc.branch,
        createdAt: acc.createdAt,
      };
    });
  }

  // إنشاء حساب واتساب جديد وتهيئته لتوليد كود الـ QR
  public async createAccount(data: {
    name: string;
    sendOtp?: boolean;
    sendAdminAlerts?: boolean;
    sendCustomerOrders?: boolean;
    branchId?: string | null;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      // إزالة الافتراضي عن باقي الحسابات
      await prisma.whatsAppAccount.updateMany({
        data: { isDefault: false }
      }).catch(() => {});
    }

    const newAcc = await prisma.whatsAppAccount.create({
      data: {
        name: data.name.trim(),
        sendOtp: Boolean(data.sendOtp),
        sendAdminAlerts: Boolean(data.sendAdminAlerts),
        sendCustomerOrders: Boolean(data.sendCustomerOrders),
        branchId: data.branchId || null,
        isDefault: Boolean(data.isDefault),
        isActive: true,
      },
      include: { branch: { select: { id: true, name: true } } }
    });

    await this.initAccount(newAcc);
    return newAcc;
  }

  // تعديل إعدادات وأدوار حساب واتساب
  public async updateAccount(id: string, data: {
    name?: string;
    sendOtp?: boolean;
    sendAdminAlerts?: boolean;
    sendCustomerOrders?: boolean;
    branchId?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    if (data.isDefault) {
      await prisma.whatsAppAccount.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false }
      }).catch(() => {});
    }

    const updated = await prisma.whatsAppAccount.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.sendOtp !== undefined ? { sendOtp: Boolean(data.sendOtp) } : {}),
        ...(data.sendAdminAlerts !== undefined ? { sendAdminAlerts: Boolean(data.sendAdminAlerts) } : {}),
        ...(data.sendCustomerOrders !== undefined ? { sendCustomerOrders: Boolean(data.sendCustomerOrders) } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId || null } : {}),
        ...(data.isDefault !== undefined ? { isDefault: Boolean(data.isDefault) } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
      include: { branch: { select: { id: true, name: true } } }
    });

    const session = this.sessions.get(id);
    if (session) {
      session.account = updated;
      if (!updated.isActive && session.sock) {
        try { await session.sock.logout(); } catch (_e) {}
        this.cleanupAccountSession(id);
      } else if (updated.isActive && !session.isConnected && !session.isInitializing) {
        this.initAccount(updated);
      }
    } else if (updated.isActive) {
      this.initAccount(updated);
    }

    return updated;
  }

  // فصل جلسة حساب لإعادة مسح الـ QR
  public async disconnect(accountId?: string): Promise<boolean> {
    const targetId = accountId || 'default';
    const session = this.sessions.get(targetId);
    if (session?.sock) {
      try {
        await session.sock.logout();
      } catch (_e) {}
    }
    this.cleanupAccountSession(targetId);
    const account = await prisma.whatsAppAccount.findUnique({ where: { id: targetId } });
    if (account && account.isActive) {
      setTimeout(() => {
        this.initAccount(account);
      }, 2000);
    }
    return true;
  }

  // إعادة توليد رمز QR لحساب معين
  public async refreshQr(accountId: string) {
    const session = this.sessions.get(accountId);
    if (session?.sock) {
      try { await session.sock.end(undefined); } catch (_e) {}
    }
    const account = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
    if (account) {
      await this.initAccount(account);
    }
    return true;
  }

  // حذف حساب نهائياً
  public async deleteAccount(accountId: string) {
    const session = this.sessions.get(accountId);
    if (session?.sock) {
      try { await session.sock.logout(); } catch (_e) {}
    }
    this.cleanupAccountSession(accountId);
    this.sessions.delete(accountId);

    await prisma.whatsAppAccount.delete({
      where: { id: accountId }
    });
    return true;
  }

  // الحالة العامة للتوافق مع الواجهات القديمة
  public getStatus() {
    let connectedSession: WhatsAppAccountSession | null = null;
    let qrSession: WhatsAppAccountSession | null = null;

    for (const session of this.sessions.values()) {
      if (session.isConnected && !connectedSession) {
        connectedSession = session;
      }
      if (session.currentQrDataUrl && !qrSession) {
        qrSession = session;
      }
    }

    return {
      isConnected: Boolean(connectedSession),
      botPhoneNumber: connectedSession?.botPhoneNumber || null,
      qrCode: qrSession?.currentQrDataUrl || null,
      totalAccounts: this.sessions.size,
    };
  }

  public getIsConnected(options?: SendMessageOptions): boolean {
    const session = this.selectSessionForMessage(options);
    return Boolean(session && session.isConnected);
  }

  // الموجه الذكي لاختيار حساب الواتساب المناسب بناءً على الدور أو المطعم المخصص
  public selectSessionForMessage(options?: SendMessageOptions): WhatsAppAccountSession | null {
    if (!options) {
      // Return default or any connected
      for (const session of this.sessions.values()) {
        if (session.isConnected && session.account.isDefault) return session;
      }
      for (const session of this.sessions.values()) {
        if (session.isConnected) return session;
      }
      return null;
    }

    // 1. إذا تم تحديد accountId بعينه
    if (options.accountId) {
      const s = this.sessions.get(options.accountId);
      if (s && s.isConnected) return s;
    }

    // 2. إذا كانت الرسالة متعلقة بمطعم محدد (branchId)، نبحث أولاً عن حساب مخصص لهذا المطعم
    if (options.branchId) {
      for (const session of this.sessions.values()) {
        if (session.isConnected && session.account.branchId === options.branchId) {
          return session;
        }
      }
    }

    // 3. مطابقة نوع الرسالة (OTP)
    if (options.type === 'OTP') {
      for (const session of this.sessions.values()) {
        if (session.isConnected && session.account.sendOtp) {
          return session;
        }
      }
    }

    // 4. مطابقة تنبيهات الإدارة وتقارير الشيفت (ADMIN_ALERT)
    if (options.type === 'ADMIN_ALERT') {
      for (const session of this.sessions.values()) {
        if (session.isConnected && session.account.sendAdminAlerts) {
          return session;
        }
      }
    }

    // 5. مطابقة إشعارات طلبات العملاء (ORDER)
    if (options.type === 'ORDER') {
      for (const session of this.sessions.values()) {
        if (session.isConnected && session.account.sendCustomerOrders) {
          return session;
        }
      }
    }

    // 6. الاحتياطي: الحساب الافتراضي
    for (const session of this.sessions.values()) {
      if (session.isConnected && session.account.isDefault) {
        return session;
      }
    }

    // 7. الاحتياطي النهائي: أي حساب متصل ونشط
    for (const session of this.sessions.values()) {
      if (session.isConnected) {
        return session;
      }
    }

    return null;
  }

  public formatEgyptianJid(phone: string): string {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    let clean = phone || '';
    for (let i = 0; i < 10; i++) {
      clean = clean.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
    }
    clean = clean.replace(/\D/g, '');
    if (clean.startsWith('01') && clean.length === 11) {
      clean = '2' + clean;
    } else if (clean.startsWith('1') && clean.length === 10) {
      clean = '20' + clean;
    } else if (clean.startsWith('00')) {
      clean = clean.substring(2);
    }
    return `${clean}@s.whatsapp.net`;
  }

  public async sendOtp(phone: string, otp: string): Promise<{ success: boolean; simulated?: boolean }> {
    const text = 
`🎓 *UniFood - رمز تأكيد الحساب* 🔐

كود استعادة كلمة المرور الخاص بك هو:
👉 *${otp}* 👈

⏱️ هذا الكود صالح للاستخدام لمدة 5 دقائق.
⚠️ يرجى عدم مشاركة الكود مع أي شخص للحفاظ على أمان حسابك.`;

    const session = this.selectSessionForMessage({ type: 'OTP' });

    if (session && session.isConnected && session.sock) {
      try {
        const jid = this.formatEgyptianJid(phone);
        await session.sock.sendMessage(jid, { text });
        console.log(`[WhatsApp:${session.account.name}] Sent OTP to ${jid} successfully.`);
        return { success: true, simulated: false };
      } catch (err) {
        console.error(`[WhatsApp] Failed to send OTP to ${phone}:`, err);
        return { success: true, simulated: true };
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[WhatsApp - Dev Mode] Simulated OTP for ${phone} is: [${otp}]`);
    } else {
      console.warn(`[WhatsApp - Not Paired] Simulated OTP triggered for ${phone.slice(0, 4)}***`);
    }
    return { success: true, simulated: true };
  }

  public async sendVerificationOtp(
    phone: string, 
    code: string, 
    magicLink: string, 
    studentName: string = 'عزيزي الطالب'
  ): Promise<{ success: boolean; simulated?: boolean }> {
    const text = 
`🎓 *UniFood - تفعيل حسابك الجامعي* 🚀

أهلاً بك يا *${studentName}*!
كود تفعيل رقم هاتفك هو:
👉 *${code}* 👈

✨ *أو للتفعيل السريع بضغطة واحدة دون كتابة الكود:*
اضغط على الرابط التالي:
🔗 ${magicLink}

⏱️ الكود والرابط صالحان لمدة 15 دقيقة.
بالهنا والشفا، ونتمنى لك تجربة ممتعة مع UniFood! 🍔`;

    const session = this.selectSessionForMessage({ type: 'OTP' });

    if (session && session.isConnected && session.sock) {
      try {
        const jid = this.formatEgyptianJid(phone);
        await session.sock.sendMessage(jid, { text });
        console.log(`[WhatsApp:${session.account.name}] Sent verification OTP to ${jid} successfully.`);
        return { success: true, simulated: false };
      } catch (err) {
        console.error(`[WhatsApp] Failed to send verification to ${phone}:`, err);
        return { success: true, simulated: true };
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[WhatsApp - Dev Mode] Verification OTP for ${phone} is: [${code}]`);
    } else {
      console.warn(`[WhatsApp - Not Paired] Verification OTP triggered for ${phone.slice(0, 4)}***`);
    }
    return { success: true, simulated: true };
  }

  public async sendOrderStatusNotification(
    phone: string, 
    message: string, 
    options?: SendMessageOptions
  ): Promise<boolean> {
    const session = this.selectSessionForMessage(options);
    if (!session || !session.isConnected || !session.sock) return false;

    try {
      const jid = this.formatEgyptianJid(phone);
      await session.sock.sendMessage(jid, { text: message });
      console.log(`[WhatsApp:${session.account.name}] Sent status notification to ${jid}.`);
      return true;
    } catch (err) {
      console.error(`[WhatsApp] Failed to send notification to ${phone}:`, err);
      return false;
    }
  }
}

export const whatsappService = new WhatsAppService();
