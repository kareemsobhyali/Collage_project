import prisma from "../prisma.js";

export interface LoyaltySettings {
  enabled: boolean;
  pointsPerPound: number;       // كم نقطة تمنح لكل جنيه من سعر الوجبات (مثال 0.1 تعني نقطة لكل 10 جنيه)
  pointsRedemptionRate: number; // قيمة النقطة الواحدة بالجنيه عند الاستبدال (مثال 0.05 تعني كل 100 نقطة = 5 جنيه)
  minPointsToRedeem: number;    // الحد الأدنى من النقاط للبدء في الاستبدال بالمحفظة (مثال 50 نقطة)
  welcomePoints: number;        // نقاط المكافأة الترحيبية عند تسجيل حساب جديد (0 لمنع استغلال الحسابات الوهمية)
}

const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: true,
  pointsPerPound: 0.1,        // نقطة واحدة لكل 10 ج.م
  pointsRedemptionRate: 0.05, // كل 100 نقطة تعادل 5 ج.م (كل 1 نقطة = 0.05 ج.م)
  minPointsToRedeem: 50,      // الحد الأدنى للاستبدال 50 نقطة
  welcomePoints: 0,           // 0 لمنع إنشاء حسابات وهمية للاستفادة المجانية
};

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: "loyalty_settings" },
    });
    if (record && record.value) {
      return { ...DEFAULT_LOYALTY_SETTINGS, ...JSON.parse(record.value) };
    }
  } catch (_e) {}
  return DEFAULT_LOYALTY_SETTINGS;
}

export async function updateLoyaltySettings(settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
  const current = await getLoyaltySettings();
  const updated: LoyaltySettings = {
    ...current,
    ...settings,
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : current.enabled,
    pointsPerPound: Math.max(0, Number(settings.pointsPerPound ?? current.pointsPerPound)),
    pointsRedemptionRate: Math.max(0, Number(settings.pointsRedemptionRate ?? current.pointsRedemptionRate)),
    minPointsToRedeem: Math.max(0, Number(settings.minPointsToRedeem ?? current.minPointsToRedeem)),
    welcomePoints: Math.max(0, Number(settings.welcomePoints ?? current.welcomePoints)),
  };

  await prisma.systemSetting.upsert({
    where: { key: "loyalty_settings" },
    update: { value: JSON.stringify(updated) },
    create: { key: "loyalty_settings", value: JSON.stringify(updated) },
  });

  return updated;
}

/**
 * إيداع نقاط الولاء في محفظة العميل عند اكتمال الطلب والتسليم الفعلي فقط
 */
export async function awardLoyaltyPointsIfCompleted(orderId: string): Promise<number> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "COMPLETED" || (order as any).pointsAwarded || !order.pointsEarned || order.pointsEarned <= 0) {
      return 0;
    }

    const settings = await getLoyaltySettings();
    if (!settings.enabled) {
      return 0;
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { pointsAwarded: true },
      }),
      prisma.user.update({
        where: { id: order.userId },
        data: { loyaltyPoints: { increment: order.pointsEarned } },
      }),
    ]);

    return order.pointsEarned;
  } catch (err) {
    console.error("awardLoyaltyPointsIfCompleted error:", err);
    return 0;
  }
}

// ----------------------------------------------------
// إعدادات وتنبيهات الواتساب التلقائية للإدارة (WhatsApp Alerts)
// ----------------------------------------------------

export interface WhatsAppAlertSettings {
  cancellationAlertPhones: string;
  cancellationAlertEnabled: boolean;
  unacceptedAlertPhones: string;
  unacceptedAlertEnabled: boolean;
  unacceptedDelayMinutes: number;
}

const DEFAULT_WHATSAPP_ALERT_SETTINGS: WhatsAppAlertSettings = {
  cancellationAlertPhones: "",
  cancellationAlertEnabled: true,
  unacceptedAlertPhones: "",
  unacceptedAlertEnabled: true,
  unacceptedDelayMinutes: 5,
};

export async function getWhatsAppAlertSettings(): Promise<WhatsAppAlertSettings> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: "whatsapp_alert_settings" },
    });
    if (record && record.value) {
      return { ...DEFAULT_WHATSAPP_ALERT_SETTINGS, ...JSON.parse(record.value) };
    }
  } catch (_e) {}
  return DEFAULT_WHATSAPP_ALERT_SETTINGS;
}

export async function updateWhatsAppAlertSettings(settings: Partial<WhatsAppAlertSettings>): Promise<WhatsAppAlertSettings> {
  const current = await getWhatsAppAlertSettings();
  const updated: WhatsAppAlertSettings = {
    ...current,
    ...settings,
    cancellationAlertPhones: String(settings.cancellationAlertPhones ?? current.cancellationAlertPhones).trim(),
    cancellationAlertEnabled: typeof settings.cancellationAlertEnabled === "boolean" ? settings.cancellationAlertEnabled : current.cancellationAlertEnabled,
    unacceptedAlertPhones: String(settings.unacceptedAlertPhones ?? current.unacceptedAlertPhones).trim(),
    unacceptedAlertEnabled: typeof settings.unacceptedAlertEnabled === "boolean" ? settings.unacceptedAlertEnabled : current.unacceptedAlertEnabled,
    unacceptedDelayMinutes: Math.max(1, Number(settings.unacceptedDelayMinutes ?? current.unacceptedDelayMinutes)),
  };

  await prisma.systemSetting.upsert({
    where: { key: "whatsapp_alert_settings" },
    update: { value: JSON.stringify(updated) },
    create: { key: "whatsapp_alert_settings", value: JSON.stringify(updated) },
  });

  return updated;
}

/**
 * إرسال إشعار فوري عبر الواتساب للمشرفين عند قيام المطعم بإلغاء/رفض أي طلب
 */
export async function sendOrderCancellationWhatsAppAlert(orderId: string, reason?: string): Promise<void> {
  try {
    const settings = await getWhatsAppAlertSettings();
    if (!settings.cancellationAlertEnabled || !settings.cancellationAlertPhones) {
      return;
    }

    const phones = settings.cancellationAlertPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 10);

    if (phones.length === 0) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { branch: true },
    });
    if (!order) return;

    const formattedTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const message = 
`🚨 *إشعار إلغاء طلب من المطعم - UniFood* ⚠️

قام مطعم: *${order.branch.name}*
بإلغاء الطلب رقم: *#${order.orderNumber}*
💰 القيمة الإجمالية: *${order.total} ج.م*
👤 اسم العميل: *${order.customerName}*
📞 هاتف العميل: *${order.customerPhone}*
${reason ? `📝 سبب الإلغاء: ${reason}\n` : ""}\
⏱️ توقيت الإلغاء: ${formattedTime}

يرجى التواصل مع الفرع أو العميل لمتابعة سبب الإلغاء.`;

    const { whatsappService } = await import("./whatsapp.service.js");
    for (const phone of phones) {
      whatsappService.sendOrderStatusNotification(phone, message).catch((err) => {
        console.warn(`[WhatsApp Alert] Failed to send cancellation alert to ${phone}:`, err);
      });
    }
  } catch (err) {
    console.error("[WhatsApp Alert] Cancellation alert error:", err);
  }
}

/**
 * فحص دوري للطلبات المعلقة (PENDING) التي تجاوزت 5 دقائق دون قبول وإرسال إنذار واتساب
 */
export async function checkAndSendUnacceptedOrdersWhatsAppAlerts(): Promise<void> {
  try {
    const settings = await getWhatsAppAlertSettings();
    if (!settings.unacceptedAlertEnabled || !settings.unacceptedAlertPhones) {
      return;
    }

    const phones = settings.unacceptedAlertPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 10);

    if (phones.length === 0) return;

    const delayMinutes = settings.unacceptedDelayMinutes || 5;
    const cutoffTime = new Date(Date.now() - delayMinutes * 60 * 1000);

    const unacceptedOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        unacceptedAlertSent: false,
        createdAt: { lte: cutoffTime },
      },
      include: { branch: true },
    });

    if (unacceptedOrders.length === 0) return;

    const { whatsappService } = await import("./whatsapp.service.js");

    for (const order of unacceptedOrders) {
      const waitMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (60 * 1000));
      const message = 
`⚠️ *إنذار: طلب معلق لم يقبله المطعم! - UniFood* ⏳

يوجد طلب جديد لم يقم المطعم بقبوله منذ *${waitMinutes} دقائق*!
🏪 المطعم: *${order.branch.name}*
🔢 رقم الطلب: *#${order.orderNumber}*
💰 القيمة الإجمالية: *${order.total} ج.م*
👤 العميل: *${order.customerName}*
📞 هاتف العميل: *${order.customerPhone}*
⏱️ توقيت إنشاء الطلب: ${new Date(order.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}

يرجى التواصل مع إدارة الفرع فوراً لقبول الطلب وبدء التجهيز!`;

      for (const phone of phones) {
        whatsappService.sendOrderStatusNotification(phone, message).catch((err) => {
          console.warn(`[WhatsApp Alert] Failed to send unaccepted order alert to ${phone}:`, err);
        });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { unacceptedAlertSent: true },
      });
    }
  } catch (err) {
    console.error("[WhatsApp Alert] Unaccepted orders check error:", err);
  }
}

