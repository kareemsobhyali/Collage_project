import prisma from "../prisma.js";
import { getIO } from "../sockets/socketManager.js";
import crypto from "crypto";

export interface SmsDeviceHeartbeat {
  batteryLevel?: number;
  isCharging?: boolean;
  simOperator?: string;
  phoneNumber?: string;
  appVersion?: string;
}

export type VerificationChannelMode = "USER_CHOICE" | "WHATSAPP_ONLY" | "SMS_ONLY" | "WHATSAPP_FALLBACK_SMS";

class SmsGatewayService {
  private activeDeviceSocketId: string | null = null;
  private defaultDeviceKey = "UNIFOOD-SMS-GATEWAY-2026";

  /**
   * استرجاع أو إنشاء جهاز SMS Gateway الافتراضي
   */
  async getOrCreateDefaultDevice() {
    try {
      let device = await prisma.smsGatewayDevice.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });

      if (!device) {
        device = await prisma.smsGatewayDevice.create({
          data: {
            deviceName: "هاتف الإدارة الأساسي (Android SMS Gateway)",
            deviceKey: this.defaultDeviceKey,
            isOnline: false,
            batteryLevel: 100,
            isCharging: false,
          },
        });
      }

      return device;
    } catch (err: any) {
      console.warn("[SmsGateway] Could not access SmsGatewayDevice table from DB, using fallback mock:", err?.message);
      return {
        id: "default-gateway-device",
        deviceName: "هاتف الإدارة الأساسي (Android SMS Gateway)",
        deviceKey: this.defaultDeviceKey,
        phoneNumber: null,
        simOperator: null,
        batteryLevel: 100,
        isCharging: false,
        isOnline: false,
        lastSeenAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * التحقق من مفتاح الجهاز عند محاولة الاتصال أو إرسال النبضات
   */
  async verifyDevice(deviceKey: string) {
    if (!deviceKey) return null;
    const cleanKey = deviceKey.trim();
    try {
      return await prisma.smsGatewayDevice.findUnique({
        where: { deviceKey: cleanKey },
      });
    } catch (err: any) {
      if (cleanKey === this.defaultDeviceKey) {
        return await this.getOrCreateDefaultDevice();
      }
      return null;
    }
  }

  /**
   * تحديث نبض وحالة الجهاز (Heartbeat / Battery / SIM)
   */
  async updateHeartbeat(deviceKey: string, data: SmsDeviceHeartbeat) {
    const device = await this.verifyDevice(deviceKey);
    if (!device) return null;

    try {
      const updated = await prisma.smsGatewayDevice.update({
        where: { id: device.id },
        data: {
          isOnline: true,
          lastSeenAt: new Date(),
          batteryLevel: data.batteryLevel !== undefined ? Math.round(data.batteryLevel) : device.batteryLevel,
          isCharging: data.isCharging !== undefined ? Boolean(data.isCharging) : device.isCharging,
          simOperator: data.simOperator || device.simOperator,
          phoneNumber: data.phoneNumber || device.phoneNumber,
        },
      });

      // إشعار لوحة الأدمن بتحديث حالة جهاز الرسائل لحظياً
      try {
        const io = getIO();
        if (io) {
          io.to("admin_room").emit("sms_gateway:device_updated", updated);
        }
      } catch (_e) {}

      return updated;
    } catch (err: any) {
      console.warn("[SmsGateway] updateHeartbeat warning:", err?.message);
      return device;
    }
  }

  /**
   * تسجيل اتصال السوكت الخاص بتطبيق الأندرويد
   */
  registerDeviceSocket(socketId: string) {
    this.activeDeviceSocketId = socketId;
  }

  unregisterDeviceSocket(socketId: string) {
    if (this.activeDeviceSocketId === socketId) {
      this.activeDeviceSocketId = null;
    }
  }

  /**
   * إضافة رسالة SMS إلى طابور الإرسال وإرسالها فوراً إن كان الجهاز متصلاً
   */
  async queueSms(phone: string, message: string, type: "OTP" | "ALERT" | "CUSTOM" | "MARKETING" = "OTP") {
    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    const device = await this.getOrCreateDefaultDevice();

    let logId: string = crypto.randomUUID();
    let dispatchedImmediately = false;

    try {
      const log = await prisma.smsMessageLog.create({
        data: {
          phone: cleanPhone,
          message: message.trim(),
          type,
          status: "PENDING",
          deviceId: device.id,
        },
      });
      logId = log.id;
    } catch (dbErr: any) {
      console.warn("[SmsGateway] Could not persist smsMessageLog to DB:", dbErr?.message);
    }

    // محاولة الإرسال الفوري المباشر عبر السوكت إذا كان تطبيق الأندرويد متصلاً
    try {
      const io = getIO();
      if (io) {
        // إرسال لغرفة أجهزة الـ SMS أو سوكت الجهاز المحدد
        io.to("sms_gateway_device_room").emit("sms:send", {
          id: logId,
          phone: cleanPhone,
          message: message.trim(),
          type,
          createdAt: new Date(),
        });
        dispatchedImmediately = true;
      }
    } catch (err) {
      console.warn("[SmsGateway] Could not dispatch immediate socket event:", err);
    }

    return {
      success: true,
      logId,
      dispatchedImmediately,
    };
  }

  /**
   * جلب الرسائل المعلقة لتطبيق الأندرويد (Polling Fallback)
   */
  async getPendingMessages(limit = 10) {
    return prisma.smsMessageLog.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: Math.min(limit, 50),
    });
  }

  /**
   * تقرير حالة إرسال الرسالة من تطبيق الأندرويد
   */
  async reportStatus(logId: string, status: "SENT" | "FAILED", errorReason?: string) {
    const existing = await prisma.smsMessageLog.findUnique({ where: { id: logId } });
    if (!existing) return null;

    const updated = await prisma.smsMessageLog.update({
      where: { id: logId },
      data: {
        status,
        sentAt: status === "SENT" ? new Date() : null,
        errorReason: errorReason || null,
      },
    });

    // إشعار لوحة الأدمن لحظياً
    try {
      const io = getIO();
      if (io) {
        io.to("admin_room").emit("sms_gateway:log_updated", updated);
      }
    } catch (_e) {}

    return updated;
  }

  /**
   * إحصائيات جهاز الـ SMS Gateway وسجل الرسائل للوحة التحكم
   */
  async getGatewayOverview() {
    const device = await this.getOrCreateDefaultDevice();
    const now = new Date();
    const isActuallyOnline = Boolean(
      device.lastSeenAt && (now.getTime() - new Date(device.lastSeenAt).getTime()) < 45000 // متصل خلال آخر 45 ثانية
    );

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todaySentCount, todayFailedCount, pendingCount, recentLogs] = await Promise.all([
      prisma.smsMessageLog.count({
        where: { status: "SENT", createdAt: { gte: startOfToday } },
      }),
      prisma.smsMessageLog.count({
        where: { status: "FAILED", createdAt: { gte: startOfToday } },
      }),
      prisma.smsMessageLog.count({
        where: { status: "PENDING" },
      }),
      prisma.smsMessageLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const channelMode = await this.getVerificationChannelMode();

    return {
      device: {
        ...device,
        isOnline: isActuallyOnline,
      },
      stats: {
        todaySentCount,
        todayFailedCount,
        pendingCount,
      },
      channelMode,
      recentLogs,
    };
  }

  /**
   * استرجاع وضع قنوات التفعيل المفضل
   */
  async getVerificationChannelMode(): Promise<VerificationChannelMode> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: "verification_channel_mode" },
      });
      if (setting && setting.value) {
        return setting.value as VerificationChannelMode;
      }
    } catch (_e) {}
    return "USER_CHOICE"; // الافتراضي: إتاحة الخيار للعميل (واتساب أو SMS)
  }

  /**
   * حفظ وضع قنوات التفعيل المفضل
   */
  async setVerificationChannelMode(mode: VerificationChannelMode) {
    return prisma.systemSetting.upsert({
      where: { key: "verification_channel_mode" },
      update: { value: mode },
      create: { key: "verification_channel_mode", value: mode },
    });
  }

  /**
   * تجديد مفتاح الجهاز السري
   */
  async regenerateDeviceKey(deviceId: string) {
    const newKey = "UNIFOOD-SMS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    return prisma.smsGatewayDevice.update({
      where: { id: deviceId },
      data: { deviceKey: newKey },
    });
  }

  /**
   * إرسال رسالة تفعيل OTP عبر الـ SMS
   * يتم إرسال الكود الصريح بدون روابط خارجية لضمان قبول الرسالة فوراً من شركات المحمول وتفادي فلاتر الحظر الأمني Anti-Phishing
   */
  async sendOtpSms(phone: string, otpCode: string, _magicLink?: string, userName?: string) {
    const displayName = userName ? `أهلاً ${userName}، ` : "";
    const message = `${displayName}كود تفعيل حسابك في UniFood هو: ${otpCode}\n(صالح لمدة 15 دقيقة)`;
    return this.queueSms(phone, message, "OTP");
  }

  /**
   * إرسال رسالة استعادة كلمة المرور عبر الـ SMS
   */
  async sendPasswordResetSms(phone: string, otpCode: string) {
    const message = `كود استعادة كلمة المرور لحسابك في UniFood هو: ${otpCode}\nصلاحية الكود 5 دقائق، لا تشاركه مع أحد.`;
    return this.queueSms(phone, message, "OTP");
  }

  /**
   * إرسال حملة رسائل تسويقية جماعية من ملف إكسل أو قائمة أرقام
   */
  async sendBulkMarketingSms(numbers: string[], message: string, title?: string) {
    const validNumbers = Array.from(new Set(
      numbers
        .map(n => String(n).trim().replace(/[^0-9]/g, ""))
        .map(n => {
          if (n.startsWith("201") && n.length === 12) return "0" + n.substring(2);
          if (n.startsWith("00201") && n.length === 14) return "0" + n.substring(4);
          return n;
        })
        .filter(n => /^01[0125][0-9]{8}$/.test(n))
    ));

    if (validNumbers.length === 0) {
      throw new Error("لم يتم العثور على أي أرقام هواتف مصرية صالحة (010, 011, 012, 015)");
    }

    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) {
      throw new Error("نص الرسالة التسويقية مطلوب");
    }

    const device = await this.getOrCreateDefaultDevice();

    const createdLogs = await prisma.$transaction(
      validNumbers.map(phone =>
        prisma.smsMessageLog.create({
          data: {
            phone,
            message: cleanMessage,
            type: "MARKETING",
            status: "PENDING",
            deviceId: device.id,
          },
        })
      )
    );

    try {
      const io = getIO();
      if (io) {
        io.to("sms_gateway_device_room").emit("sms:campaign_queued", {
          count: createdLogs.length,
          title: title || "حملة تسويقية جديدة",
        });
        io.to("admin_room").emit("sms_gateway:campaign_started", {
          count: createdLogs.length,
        });
      }
    } catch (_e) {}

    return {
      success: true,
      totalQueued: createdLogs.length,
      sampleNumbers: validNumbers.slice(0, 5),
    };
  }

  /**
   * إلغاء الرسائل التسويقية المعلقة في الطابور
   */
  async cancelPendingMarketingMessages() {
    const res = await prisma.smsMessageLog.updateMany({
      where: {
        status: "PENDING",
        type: "MARKETING",
      },
      data: {
        status: "FAILED",
        errorReason: "تم إلغاء الإرسال من لوحة الإدارة",
      },
    });

    try {
      const io = getIO();
      if (io) {
        io.to("admin_room").emit("sms_gateway:campaign_cancelled", {
          cancelledCount: res.count,
        });
      }
    } catch (_e) {}

    return { cancelledCount: res.count };
  }
}

export const smsGatewayService = new SmsGatewayService();
