import path from 'path';
import fs from 'fs';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  WASocket 
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

  // استرجاع ملفات الجلسة من قاعدة البيانات PostgreSQL عند إعادة تشغيل السيرفرات السحابية المؤقتة
  private async restoreSessionFromDb() {
    try {
      this.ensureSessionDir();
      const credsPath = path.join(this.sessionDir, 'creds.json');
      if (!fs.existsSync(credsPath)) {
        const records = await prisma.systemSetting.findMany({
          where: { key: { startsWith: 'baileys_file_' } }
        });
        if (records.length > 0) {
          for (const rec of records) {
            const rawFilename = rec.key.replace('baileys_file_', '');
            const filename = path.basename(rawFilename);
            fs.writeFileSync(path.join(this.sessionDir, filename), rec.value, 'utf-8');
          }
          console.log(`[WhatsApp] Successfully restored ${records.length} session auth files from PostgreSQL database.`);
        }
      }
    } catch (err) {
      console.warn('[WhatsApp] Could not restore session from DB:', err);
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
      });

      this.sock = socket;

      socket.ev.on('creds.update', async () => {
        await saveCreds();
        // مزامنة ملفات الجلسة تلقائياً في قاعدة البيانات PostgreSQL لحفظها من الفقدان
        try {
          if (fs.existsSync(this.sessionDir)) {
            const files = fs.readdirSync(this.sessionDir);
            for (const file of files) {
              if (file.endsWith('.json')) {
                const content = fs.readFileSync(path.join(this.sessionDir, file), 'utf-8');
                await prisma.systemSetting.upsert({
                  where: { key: `baileys_file_${file}` },
                  update: { value: content },
                  create: { key: `baileys_file_${file}`, value: content },
                }).catch(() => {});
              }
            }
          }
        } catch (_syncErr) {}
      });

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
