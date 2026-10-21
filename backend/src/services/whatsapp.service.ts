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

class WhatsAppService {
  private sock: WASocket | null = null;
  private isConnected: boolean = false;
  private botPhoneNumber: string | null = null;
  private currentQrDataUrl: string | null = null;
  private currentRawQr: string | null = null;
  private isInitializing: boolean = false;
  private isSyncingFiles: boolean = false;
  private sessionSyncTimer: NodeJS.Timeout | null = null;
  private sessionDir: string = process.env.WHATSAPP_SESSION_PATH || (
    fs.existsSync('/var/data') ? '/var/data/auth_info_baileys' : path.resolve(process.cwd(), 'auth_info_baileys')
  );

  constructor() {
    this.ensureSessionDir();
  }

  private ensureSessionDir() {
    if (!fs.existsSync(this.sessionDir)) {
      try {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      } catch (err) {
        console.error('[WhatsApp] Error creating session dir:', err);
      }
    }
  }

  // استرجاع ملفات الجلسة الأساسية فقط من PostgreSQL مع تجنب تحميل آلاف المفاتيح القديمة لتوفير الرام
  private async restoreSessionFromDb() {
    try {
      this.ensureSessionDir();
      const credsPath = path.join(this.sessionDir, 'creds.json');
      if (!fs.existsSync(credsPath)) {
        // 1. استرجاع creds.json أولاً
        const credsRec = await prisma.systemSetting.findUnique({
          where: { key: 'baileys_file_creds.json' }
        });
        if (credsRec?.value) {
          fs.writeFileSync(credsPath, credsRec.value, 'utf-8');
        }

        // 2. استرجاع باقي الملفات مع استبعاد الـ pre-keys التالفة والقديمة
        const records = await prisma.systemSetting.findMany({
          where: { 
            key: { startsWith: 'baileys_file_' },
            NOT: { key: 'baileys_file_creds.json' }
          },
          select: { key: true, value: true }
        });

        if (records.length > 0) {
          const preKeys = records
            .filter(r => r.key.startsWith('baileys_file_pre-key-'))
            .map(r => {
              const m = r.key.match(/pre-key-(\d+)\.json/);
              return { ...r, num: m ? parseInt(m[1], 10) : 0 };
            })
            .sort((a, b) => b.num - a.num);

          const nonPreKeys = records.filter(r => !r.key.startsWith('baileys_file_pre-key-'));
          const keepPreKeys = preKeys.slice(0, 40); // الاحتفاظ بأحدث 40 مفتاح مؤقت فقط
          const obsoleteKeys = preKeys.slice(40).map(k => k.key);

          const toWrite = [...nonPreKeys, ...keepPreKeys];
          for (const rec of toWrite) {
            const rawFilename = rec.key.replace('baileys_file_', '');
            const filename = path.basename(rawFilename);
            fs.writeFileSync(path.join(this.sessionDir, filename), rec.value, 'utf-8');
          }
          console.log(`[WhatsApp] Successfully restored ${toWrite.length} vital session auth files from PostgreSQL (optimized for 512MB RAM).`);

          // تنظيف المفاتيح المنتهية من PostgreSQL لتخفيف استهلاك قاعدة البيانات والذاكرة
          if (obsoleteKeys.length > 0) {
            prisma.systemSetting.deleteMany({
              where: { key: { in: obsoleteKeys } }
            }).then(del => {
              console.log(`[WhatsApp] Cleaned up ${del.count} obsolete pre-keys from PostgreSQL.`);
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[WhatsApp] Could not restore session from DB:', err);
    }
  }

  // تنظيف الـ pre-keys القديمة دورياً من القرص وقاعدة البيانات لمنع تراكم آلاف الملفات
  private async pruneObsoletePreKeys() {
    try {
      if (!fs.existsSync(this.sessionDir)) return;
      const allFiles = fs.readdirSync(this.sessionDir);
      const preKeyFiles = allFiles
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
            fs.unlinkSync(path.join(this.sessionDir, item.file));
          } catch (_e) {}
        }
        const dbKeys = toDelete.map(d => `baileys_file_${d.file}`);
        await prisma.systemSetting.deleteMany({
          where: { key: { in: dbKeys } }
        }).catch(() => {});
      }
    } catch (_err) {}
  }

  // مزامنة خفيفة ومجدولة لملفات الجلسة الحيوية فقط بدون إجهاد الذاكرة
  private async syncSessionFilesToDb() {
    if (this.isSyncingFiles || !this.isConnected) return;
    this.isSyncingFiles = true;
    try {
      if (!fs.existsSync(this.sessionDir)) return;
      await this.pruneObsoletePreKeys();

      const files = fs.readdirSync(this.sessionDir);
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
        const filePath = path.join(this.sessionDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          await prisma.systemSetting.upsert({
            where: { key: `baileys_file_${file}` },
            update: { value: content },
            create: { key: `baileys_file_${file}`, value: content },
          }).catch(() => {});
        }
      }
    } catch (_err) {
    } finally {
      this.isSyncingFiles = false;
    }
  }

  public async initWhatsApp() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      await this.restoreSessionFromDb();
      this.ensureSessionDir();
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      const socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['UniFood Campus', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false, // يمنع سحب أرشيف المحادثات الضخم إلى الرام
        shouldIgnoreJid: (jid) => isJidBroadcast(jid) || jid.endsWith('@newsletter'),
        getMessage: async () => undefined, // يمنع الاحتفاظ بنصوص الرسائل في ذاكرة الخادم
      });

      this.sock = socket;

      // عند تحديث بيانات الاعتماد، نحفظ فقط creds.json (تجنباً لقراءة آلاف الملفات وإغراق الرام)
      socket.ev.on('creds.update', async () => {
        await saveCreds();
        try {
          const credsPath = path.join(this.sessionDir, 'creds.json');
          if (fs.existsSync(credsPath)) {
            const content = fs.readFileSync(credsPath, 'utf-8');
            await prisma.systemSetting.upsert({
              where: { key: 'baileys_file_creds.json' },
              update: { value: content },
              create: { key: 'baileys_file_creds.json', value: content },
            }).catch(() => {});
          }
        } catch (_syncErr) {}
      });

      // إيقاف أي مؤقت مزامنة سابق وتشغيل مؤقت خفيف كل 4 دقائق
      if (this.sessionSyncTimer) {
        clearInterval(this.sessionSyncTimer);
        this.sessionSyncTimer = null;
      }
      this.sessionSyncTimer = setInterval(() => {
        this.syncSessionFilesToDb().catch(() => {});
      }, 4 * 60 * 1000);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentRawQr = qr;
          try {
            this.currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
            console.log('[WhatsApp] New QR code generated. Ready to scan from Admin Panel.');
          } catch (qrErr) {
            console.error('[WhatsApp] Failed to generate QR data URL:', qrErr);
          }
        }

        if (connection === 'open') {
          this.isConnected = true;
          this.currentQrDataUrl = null;
          this.currentRawQr = null;
          this.isInitializing = false;

          const rawId = socket.user?.id || '';
          this.botPhoneNumber = rawId.split(':')[0] || rawId.split('@')[0] || 'متصل';
          console.log(`[WhatsApp] Connected successfully! Active Phone: ${this.botPhoneNumber}`);
          
          // مزامنة أولية خفيفة بعد الاتصال بنصف دقيقة
          setTimeout(() => {
            this.syncSessionFilesToDb().catch(() => {});
          }, 30000);
        } else if (connection === 'close') {
          this.isConnected = false;
          this.isInitializing = false;

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp] Connection closed. Reason code: ${statusCode}. Should reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            console.log('[WhatsApp] Reconnecting in 5 seconds...');
            setTimeout(() => {
              this.initWhatsApp();
            }, 5000);
          } else {
            console.log('[WhatsApp] Logged out by user. Cleaning session files...');
            this.cleanupSession();
            setTimeout(() => {
              this.initWhatsApp();
            }, 3000);
          }
        }
      });
    } catch (err) {
      this.isInitializing = false;
      console.error('[WhatsApp] Error during initialization:', err);
    }
  }

  private cleanupSession() {
    try {
      if (this.sessionSyncTimer) {
        clearInterval(this.sessionSyncTimer);
        this.sessionSyncTimer = null;
      }
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        this.ensureSessionDir();
      }
      prisma.systemSetting.deleteMany({
        where: { key: { startsWith: 'baileys_file_' } }
      }).catch(() => {});
    } catch (e) {
      console.error('[WhatsApp] Cleanup error:', e);
    }
    this.currentQrDataUrl = null;
    this.currentRawQr = null;
    this.botPhoneNumber = null;
    this.isConnected = false;
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      botPhoneNumber: this.botPhoneNumber,
      qrCode: this.currentQrDataUrl,
    };
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public async disconnect(): Promise<boolean> {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (_e) {}
    this.cleanupSession();
    setTimeout(() => {
      this.initWhatsApp();
    }, 2000);
    return true;
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

    if (this.isConnected && this.sock) {
      try {
        const jid = this.formatEgyptianJid(phone);
        await this.sock.sendMessage(jid, { text });
        console.log(`[WhatsApp] Sent OTP to ${jid} successfully.`);
        return { success: true, simulated: false };
      } catch (err) {
        console.error(`[WhatsApp] Failed to send message to ${phone}:`, err);
        return { success: true, simulated: true };
      }
    }

    // In development or if bot is not paired yet, log to console
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

    if (this.isConnected && this.sock) {
      try {
        const jid = this.formatEgyptianJid(phone);
        await this.sock.sendMessage(jid, { text });
        console.log(`[WhatsApp] Sent verification OTP & magic link to ${jid} successfully.`);
        return { success: true, simulated: false };
      } catch (err) {
        console.error(`[WhatsApp] Failed to send verification message to ${phone}:`, err);
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


  public async sendOrderStatusNotification(phone: string, message: string): Promise<boolean> {
    if (!this.isConnected || !this.sock) return false;
    try {
      const jid = this.formatEgyptianJid(phone);
      await this.sock.sendMessage(jid, { text: message });
      return true;
    } catch (err) {
      console.error(`[WhatsApp] Failed to send notification to ${phone}:`, err);
      return false;
    }
  }
}

export const whatsappService = new WhatsAppService();
