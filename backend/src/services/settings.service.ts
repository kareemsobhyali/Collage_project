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
  dailyReportPhones: string;
  dailyReportEnabled: boolean;
  driverUnacceptedAlertEnabled: boolean;
  driverUnacceptedDelayMinutes: number;
}

const DEFAULT_WHATSAPP_ALERT_SETTINGS: WhatsAppAlertSettings = {
  cancellationAlertPhones: "",
  cancellationAlertEnabled: true,
  unacceptedAlertPhones: "",
  unacceptedAlertEnabled: true,
  unacceptedDelayMinutes: 5,
  dailyReportPhones: "",
  dailyReportEnabled: true,
  driverUnacceptedAlertEnabled: true,
  driverUnacceptedDelayMinutes: 3,
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
    dailyReportPhones: String(settings.dailyReportPhones ?? current.dailyReportPhones).trim(),
    dailyReportEnabled: typeof settings.dailyReportEnabled === "boolean" ? settings.dailyReportEnabled : current.dailyReportEnabled,
    driverUnacceptedAlertEnabled: typeof settings.driverUnacceptedAlertEnabled === "boolean" ? settings.driverUnacceptedAlertEnabled : current.driverUnacceptedAlertEnabled ?? true,
    driverUnacceptedDelayMinutes: Math.max(1, Number(settings.driverUnacceptedDelayMinutes ?? current.driverUnacceptedDelayMinutes ?? 3)),
  };

  await prisma.systemSetting.upsert({
    where: { key: "whatsapp_alert_settings" },
    update: { value: JSON.stringify(updated) },
    create: { key: "whatsapp_alert_settings", value: JSON.stringify(updated) },
  });

  return updated;
}


/**
 * تحليل وتوحيد أرقام الهواتف المدخلة وتدقيقها
 * يدعم الأرقام الإنجليزية والعربية/الفارسية، والفواصل العربية (،) والإنجليزية
 */
export function normalizeAndParsePhoneNumbers(input?: string | null): string[] {
  if (!input) return [];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let normalized = input;
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
  }
  return normalized
    .split(/[\n,;،\s]+/)
    .map((p) => p.replace(/\D/g, '').trim())
    .filter((p) => p.length >= 10);
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

    const phones = normalizeAndParsePhoneNumbers(settings.cancellationAlertPhones);
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
      whatsappService.sendOrderStatusNotification(phone, message, { branchId: order.branchId, type: 'ADMIN_ALERT' }).catch((err) => {
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

    const phones = normalizeAndParsePhoneNumbers(settings.unacceptedAlertPhones);
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
        whatsappService.sendOrderStatusNotification(phone, message, { branchId: order.branchId, type: 'ADMIN_ALERT' }).catch((err) => {
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

/**
 * فحص دوري للطلبات المسندة للطيارين ولم يتم قبولها أو استلامها خلال المهلة المحددة
 * وإرسال رسالة واتساب للطيار لتنبيهه فوراً بمطعم وعنوان الطلب
 */
export async function checkAndSendDriverUnacceptedOrdersAlerts(): Promise<void> {
  try {
    const settings = await getWhatsAppAlertSettings();
    if (!settings.driverUnacceptedAlertEnabled) {
      return;
    }

    const delayMinutes = settings.driverUnacceptedDelayMinutes || 3;
    const cutoffTime = new Date(Date.now() - delayMinutes * 60 * 1000);

    // البحث عن الطلبات المسندة لكابتن توصيل منذ أكثر من مهلة الانتظار ولم يتم تسليمها أو استلامها
    const pendingDriverOrders = await prisma.order.findMany({
      where: {
        driverId: { not: null },
        driverAssignedAt: { lte: cutoffTime },
        driverPickedUpAt: null,
        status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY"] },
      },
      include: {
        branch: { select: { id: true, name: true, phone: true, address: true } },
        driver: { select: { id: true, name: true, phone: true, username: true } },
      },
      take: 20,
    });

    if (pendingDriverOrders.length === 0) return;

    const { isOrderAcceptedByDriver, isDriverWhatsAppAlertSent, markDriverWhatsAppAlertSent } = await import("./driver.service.js");
    const { whatsappService } = await import("./whatsapp.service.js");

    for (const order of pendingDriverOrders) {
      if (!order.driver || !order.driver.phone) continue;

      // هل قام الطيار بقبول الطلب بالفعل؟
      const isAccepted = await isOrderAcceptedByDriver(order.id);
      if (isAccepted) continue;

      // هل أرسلنا له تنبيهاً بالواتساب مسبقاً لهذا الطلب لمنع التكرار؟
      const isSent = await isDriverWhatsAppAlertSent(order.id);
      if (isSent) continue;

      const waitMinutes = Math.max(1, Math.floor((Date.now() - new Date(order.driverAssignedAt!).getTime()) / (60 * 1000)));
      const cleanAddr = order.addressText
        ? order.addressText.replace(/\[GPS:[0-9.-]+,[0-9.-]+\]/g, '').replace(/\|\|\s*GPS:.*$/i, '').replace(/GPS:\s*[0-9.-]+[,\s]+[0-9.-]+/i, '').trim()
        : '';
      const addressDisplay = [order.deliveryZoneName, cleanAddr].filter(Boolean).join(" - ") || "عنوان التوصيل";
      const paymentDisplay = order.paymentMethod === "CASH" ? "💵 تحصيل كاش" : "💳 مدفوع إلكترونياً (أونلاين)";

      const message =
`🛵 *تنبيه أوردر توصيل جديد بانتظارك - UniFood* ⏳

يا كابتن *${order.driver.name}*، يوجد أوردر بانتظار قبولك ومراجعته!

🏪 *المطعم:* ${order.branch.name}
📍 *عنوان التوصيل:* ${addressDisplay}
🔢 *رقم الطلب:* #${order.orderNumber}
👤 *العميل:* ${order.customerName}
📞 *هاتف العميل:* ${order.customerPhone}
💰 *المطلوب تحصيله:* ${order.total} ج.م (${paymentDisplay})

⏱️ *مرت ${waitMinutes} دقائق* منذ إسناد الأوردر لك.
يرجى فتح تطبيق كابتن التوصيل وقبول الطلب للتوجه للمطعم فوراً! 🚀`;

      whatsappService.sendOrderStatusNotification(order.driver.phone, message, { branchId: order.branchId, type: 'ADMIN_ALERT' }).catch((err) => {
        console.warn(`[WhatsApp Alert] Failed to send driver unaccepted alert to ${order.driver!.phone}:`, err);
      });

      await markDriverWhatsAppAlertSent(order.id);
    }
  } catch (err) {
    console.error("[WhatsApp Alert] Driver unaccepted orders check error:", err);
  }
}

/**
 * الحصول على تاريخ اليوم وتوقيته بتوقيت القاهرة
 */
export function getCairoNow(): { dateStr: string; timeStr: string; startOfDay: Date } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(now); // "YYYY-MM-DD"
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now); // "HH:mm"

  // حساب بداية اليوم (00:00:00) بتوقيت القاهرة بدقة متوافقة ديناميكياً مع التوقيتين الشتوي (UTC+2) والصيفي (UTC+3)
  const [y, m, d] = dateStr.split("-").map(Number);
  const noonApprox = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const cairoHourAtNoon = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(noonApprox),
    10
  );
  const cairoOffsetHours = (cairoHourAtNoon - 12 + 24) % 24;
  const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - cairoOffsetHours * 60 * 60 * 1000);

  return { dateStr, timeStr, startOfDay };
}

/**
 * توليد نص التقرير المالي لإغلاق الشيفت لأي فرع
 */
export async function generateBranchShiftReport(branchId: string): Promise<{
  branchName: string;
  message: string;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
} | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
  });
  if (!branch) return null;

  const { dateStr, timeStr, startOfDay } = getCairoNow();

  // جلب كافة طلبات الفرع لشيفت اليوم
  const orders = await prisma.order.findMany({
    where: {
      branchId,
      createdAt: { gte: startOfDay },
    },
    include: {
      items: true,
    },
  });

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");
  const rejectedOrders = orders.filter((o) => o.status === "REJECTED");
  const inProgressOrders = orders.filter((o) =>
    ["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(o.status)
  );

  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const deliveryFeesSum = completedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const foodNetSum = totalRevenue - deliveryFeesSum;
  const walletDiscountsSum = completedOrders.reduce((sum, o) => sum + (o.walletDiscount || 0), 0);

  // إحصائيات طرق الدفع للطلبات المكتملة
  let cashTotal = 0, cashCount = 0;
  let vodafoneTotal = 0, vodafoneCount = 0;
  let instapayTotal = 0, instapayCount = 0;
  let cardTotal = 0, cardCount = 0;

  for (const o of completedOrders) {
    if (o.paymentMethod === "CASH") {
      cashTotal += o.total;
      cashCount++;
    } else if (o.paymentMethod === "VODAFONE_CASH") {
      vodafoneTotal += o.total;
      vodafoneCount++;
    } else if (o.paymentMethod === "INSTAPAY") {
      instapayTotal += o.total;
      instapayCount++;
    } else if (o.paymentMethod === "CARD") {
      cardTotal += o.total;
      cardCount++;
    }
  }

  // حساب أعلى الأصناف مبيعاً
  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const o of completedOrders) {
    for (const item of o.items) {
      if (!itemCounts[item.itemName]) {
        itemCounts[item.itemName] = { name: item.itemName, qty: 0, revenue: 0 };
      }
      itemCounts[item.itemName].qty += item.quantity;
      itemCounts[item.itemName].revenue += item.totalPrice;
    }
  }

  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  const topItemsText =
    topItems.length > 0
      ? topItems
          .map((item, idx) => `  ${idx + 1}. *${item.name}*: ${item.qty} وجبة (${item.revenue} ج.م)`)
          .join("\n")
      : "  لا توجد أصناف مكتملة اليوم بعد.";

  const message =
`📊 *التقرير المالي لإغلاق الشيفت - UniFood* 🧾
🏪 *المطعم:* ${branch.name}
📅 *تاريخ اليوم:* ${dateStr}
⏰ *وقت الإغلاق:* ${timeStr}

━━━━━━━━━━━━━━━━━━━━━
📈 *ملخص المبيعات والإيرادات:*
💰 إجمالي المبيعات المحققة: *${totalRevenue.toFixed(1)} ج.م*
🍲 صافي مبيعات الوجبات: *${foodNetSum.toFixed(1)} ج.م*
🛵 إجمالي رسوم التوصيل: *${deliveryFeesSum.toFixed(1)} ج.م*
👛 خصومات المحفظة: *${walletDiscountsSum.toFixed(1)} ج.م*

📦 إجمالي الطلبات المسجلة: *${totalOrders} طلب*
✅ طلبات ناجحة ومكتملة: *${completedOrders.length} طلب*
❌ طلبات ملغاة أو مرفوضة: *${rejectedOrders.length} طلب*
⏳ طلبات جارية/معلقة: *${inProgressOrders.length} طلب*

━━━━━━━━━━━━━━━━━━━━━
💳 *تفصيل طرق التحصيل:*
💵 كاش (نقداً): *${cashTotal.toFixed(1)} ج.م* (${cashCount} طلب)
📱 فودافون كاش: *${vodafoneTotal.toFixed(1)} ج.م* (${vodafoneCount} طلب)
🏦 إنستاباي: *${instapayTotal.toFixed(1)} ج.م* (${instapayCount} طلب)
💳 فيزا / بطاقات: *${cardTotal.toFixed(1)} ج.م* (${cardCount} طلب)

━━━━━━━━━━━━━━━━━━━━━
🍽️ *أعلى الأصناف طلباً في هذا الشيفت:*
${topItemsText}

━━━━━━━━━━━━━━━━━━━━━
✨ *نظام UniFood لإدارة وتوصيل طلبات المطاعم.*`;

  return {
    branchName: branch.name,
    message,
    totalOrders,
    completedOrders: completedOrders.length,
    totalRevenue,
  };
}

/**
 * توليد نص التقرير المالي المجمع والشامل لكافة فروع الجامعة اليوم
 */
export async function generateAllBranchesShiftReport(): Promise<{
  branchName: string;
  message: string;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
}> {
  const { dateStr, timeStr, startOfDay } = getCairoNow();

  const [branches, allOrders] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: startOfDay },
      },
      include: {
        items: true,
        branch: { select: { id: true, name: true } },
      },
    }),
  ]);

  const totalOrders = allOrders.length;
  const completedOrders = allOrders.filter((o) => o.status === "COMPLETED");
  const rejectedOrders = allOrders.filter((o) => o.status === "REJECTED");
  const inProgressOrders = allOrders.filter((o) =>
    ["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(o.status)
  );

  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const deliveryFeesSum = completedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const foodNetSum = totalRevenue - deliveryFeesSum;
  const walletDiscountsSum = completedOrders.reduce((sum, o) => sum + (o.walletDiscount || 0), 0);

  // إحصائيات طرق الدفع للطلبات المكتملة
  let cashTotal = 0, cashCount = 0;
  let vodafoneTotal = 0, vodafoneCount = 0;
  let instapayTotal = 0, instapayCount = 0;
  let cardTotal = 0, cardCount = 0;

  for (const o of completedOrders) {
    if (o.paymentMethod === "CASH") {
      cashTotal += o.total;
      cashCount++;
    } else if (o.paymentMethod === "VODAFONE_CASH") {
      vodafoneTotal += o.total;
      vodafoneCount++;
    } else if (o.paymentMethod === "INSTAPAY") {
      instapayTotal += o.total;
      instapayCount++;
    } else if (o.paymentMethod === "CARD") {
      cardTotal += o.total;
      cardCount++;
    }
  }

  // توزيع المبيعات حسب الفروع
  const branchSales: Record<string, { name: string; revenue: number; completedCount: number; totalCount: number }> = {};
  for (const b of branches) {
    branchSales[b.id] = { name: b.name, revenue: 0, completedCount: 0, totalCount: 0 };
  }
  for (const o of allOrders) {
    if (!branchSales[o.branchId]) {
      branchSales[o.branchId] = { name: o.branch?.name || "فرع", revenue: 0, completedCount: 0, totalCount: 0 };
    }
    branchSales[o.branchId].totalCount++;
    if (o.status === "COMPLETED") {
      branchSales[o.branchId].revenue += o.total;
      branchSales[o.branchId].completedCount++;
    }
  }

  const branchSummaryLines = Object.values(branchSales)
    .sort((a, b) => b.revenue - a.revenue)
    .map((bs, idx) => `  ${idx + 1}. *${bs.name}*: ${bs.revenue.toFixed(1)} ج.م (${bs.completedCount} مكتمل / ${bs.totalCount} كلي)`)
    .join("\n");

  // أفضل 5 أصناف مبيعاً عبر كافة الفروع
  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const o of completedOrders) {
    for (const item of o.items) {
      if (!itemCounts[item.itemName]) {
        itemCounts[item.itemName] = { name: item.itemName, qty: 0, revenue: 0 };
      }
      itemCounts[item.itemName].qty += item.quantity;
      itemCounts[item.itemName].revenue += item.totalPrice;
    }
  }

  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const topItemsText =
    topItems.length > 0
      ? topItems
          .map((item, idx) => `  ${idx + 1}. *${item.name}*: ${item.qty} وجبة (${item.revenue.toFixed(0)} ج.م)`)
          .join("\n")
      : "  لا توجد أصناف مكتملة اليوم بعد.";

  const message =
`📊 *التقرير المالي المجمع لمنصة UniFood* 🏛️
📅 *تاريخ اليوم:* ${dateStr}
⏰ *توقيت التقرير:* ${timeStr}
🏪 *إجمالي الفروع النشطة:* ${branches.length} مطعم

━━━━━━━━━━━━━━━━━━━━━
📈 *إجمالي مبيعات وإيرادات المنصة:*
💰 إجمالي المبيعات المحققة: *${totalRevenue.toFixed(1)} ج.م*
🍲 صافي مبيعات الوجبات: *${foodNetSum.toFixed(1)} ج.م*
🛵 إجمالي رسوم التوصيل: *${deliveryFeesSum.toFixed(1)} ج.م*
👛 خصومات المحفظة والولاء: *${walletDiscountsSum.toFixed(1)} ج.م*

📦 إجمالي الطلبات بالمنظومة: *${totalOrders} طلب*
✅ طلبات ناجحة ومكتملة: *${completedOrders.length} طلب*
❌ طلبات ملغاة أو مرفوضة: *${rejectedOrders.length} طلب*
⏳ طلبات جارية/معلقة: *${inProgressOrders.length} طلب*

━━━━━━━━━━━━━━━━━━━━━
🏪 *تفصيل أداء ومبيعات الفروع اليوم:*
${branchSummaryLines || "  لا توجد فروع مسجلة."}

━━━━━━━━━━━━━━━━━━━━━
💳 *طرق التحصيل المالي المجمعة:*
💵 كاش (نقداً): *${cashTotal.toFixed(1)} ج.م* (${cashCount} طلب)
📱 فودافون كاش: *${vodafoneTotal.toFixed(1)} ج.م* (${vodafoneCount} طلب)
🏦 إنستاباي: *${instapayTotal.toFixed(1)} ج.م* (${instapayCount} طلب)
💳 فيزا / بطاقات: *${cardTotal.toFixed(1)} ج.م* (${cardCount} طلب)

━━━━━━━━━━━━━━━━━━━━━
🍽️ *أكثر الوجبات طلباً على مستوى الفروع:*
${topItemsText}

━━━━━━━━━━━━━━━━━━━━━
✨ *نظام UniFood لإدارة وتوصيل طلبات المطاعم.*`;

  return {
    branchName: "كافة الفروع",
    message,
    totalOrders,
    completedOrders: completedOrders.length,
    totalRevenue,
  };
}

/**
 * إرسال التقرير المالي المجمع لكافة الفروع عبر الواتساب للأرقام المحددة
 */
export async function sendAllBranchesShiftReport(customPhone?: string): Promise<{ success: boolean; sentCount: number; message?: string }> {
  try {
    const { whatsappService } = await import("./whatsapp.service.js");
    if (!whatsappService.getIsConnected({ type: 'ADMIN_ALERT' })) {
      return {
        success: false,
        sentCount: 0,
        message: "⚠️ لا يوجد حساب واتساب متصل حالياً لإرسال تنبيهات الإدارة! يرجى فتح تبويب (ربط الواتساب) ومسح رمز QR لربط رقمك أولاً لتفعيل إرسال التقارير.",
      };
    }

    const settings = await getWhatsAppAlertSettings();
    const phones = normalizeAndParsePhoneNumbers(customPhone || settings.dailyReportPhones);

    if (phones.length === 0) {
      return {
        success: false,
        sentCount: 0,
        message: "⚠️ لم يتم تحديد أي رقم هاتف صالح لاستقبال التقرير! يرجى إدخال رقم الهاتف في إعدادات التقارير (مثال: 01012345678).",
      };
    }

    const report = await generateAllBranchesShiftReport();

    let sentCount = 0;
    for (const phone of phones) {
      try {
        const sent = await whatsappService.sendOrderStatusNotification(phone, report.message, { type: 'ADMIN_ALERT' });
        if (sent) sentCount++;
      } catch (err) {
        console.warn(`[Shift Report] Failed to send to ${phone}:`, err);
      }
    }

    if (sentCount === 0) {
      return {
        success: false,
        sentCount: 0,
        message: "تعذر إرسال التقرير للأرقام المحددة. يرجى التأكد من أن الرقم مسجل على واتساب ومتاح لاستقبال الرسائل.",
      };
    }

    return {
      success: true,
      sentCount,
      message: `تم إرسال التقرير المالي المجمع إلى ${sentCount} رقم عبر الواتساب بنجاح ✅`,
    };
  } catch (err: any) {
    console.error("[Shift Report] Error sending all-branches shift report:", err);
    return { success: false, sentCount: 0, message: err?.message || "فشل إرسال التقرير المالي" };
  }
}

/**
 * إرسال التقرير المالي للشيفت عبر الواتساب للأرقام المحددة في لوحة التحكم
 */
export async function sendBranchShiftWhatsAppReport(branchId: string, customPhone?: string): Promise<{ success: boolean; sentCount: number; message?: string }> {
  try {
    if (branchId === "ALL") {
      return await sendAllBranchesShiftReport(customPhone);
    }

    const { whatsappService } = await import("./whatsapp.service.js");
    if (!whatsappService.getIsConnected({ branchId, type: 'ADMIN_ALERT' })) {
      return {
        success: false,
        sentCount: 0,
        message: "⚠️ لا يوجد حساب واتساب متصل حالياً للفرع أو للإدارة! يرجى فتح تبويب (ربط الواتساب) ومسح رمز QR لربط رقمك أولاً لتفعيل إرسال التقارير.",
      };
    }

    const report = await generateBranchShiftReport(branchId);
    if (!report) {
      return { success: false, sentCount: 0, message: "الفرع غير موجود" };
    }

    const settings = await getWhatsAppAlertSettings();
    const phones = normalizeAndParsePhoneNumbers(customPhone || settings.dailyReportPhones);

    if (phones.length === 0) {
      return {
        success: false,
        sentCount: 0,
        message: "⚠️ لم يتم تحديد أي رقم هاتف صالح لاستقبال التقرير! يرجى إدخال رقم الهاتف في إعدادات التقارير (مثال: 01012345678).",
      };
    }

    let sentCount = 0;
    for (const phone of phones) {
      try {
        const sent = await whatsappService.sendOrderStatusNotification(phone, report.message, { branchId, type: 'ADMIN_ALERT' });
        if (sent) sentCount++;
      } catch (err) {
        console.warn(`[Shift Report] Failed to send to ${phone}:`, err);
      }
    }

    if (sentCount === 0) {
      return {
        success: false,
        sentCount: 0,
        message: "تعذر إرسال التقرير للأرقام المحددة. يرجى التأكد من أن الرقم مسجل على واتساب ومتاح لاستقبال الرسائل.",
      };
    }

    return {
      success: true,
      sentCount,
      message: `تم إرسال التقرير المالي لفرع (${report.branchName}) إلى ${sentCount} رقم بنجاح ✅`,
    };
  } catch (err: any) {
    console.error("[Shift Report] Error sending shift report:", err);
    return { success: false, sentCount: 0, message: err?.message || "فشل إرسال التقرير" };
  }
}

/**
 * فحص دوري لمواعيد إغلاق الفروع وإرسال التقارير المالية للشيفت تلقائياً
 */
export async function checkAndSendShiftClosingReports(): Promise<void> {
  try {
    const settings = await getWhatsAppAlertSettings();
    if (!settings.dailyReportEnabled || !settings.dailyReportPhones) {
      return;
    }

    const { dateStr, timeStr } = getCairoNow();

    // جلب جميع الفروع النشطة التي لها موعد إغلاق محدد
    const activeBranches = await prisma.branch.findMany({
      where: {
        isActive: true,
        closingTime: { not: null },
      },
      select: {
        id: true,
        name: true,
        closingTime: true,
      },
    });

    for (const branch of activeBranches) {
      if (!branch.closingTime) continue;

      // مقارنة موعد إغلاق الفرع مع الوقت الحالي بالقاهرة (مع هامش أمان 60 دقيقة لمنع تفويت التقرير بسبب انحراف الـ Event loop)
      const cleanBranchClosing = branch.closingTime.trim();
      const [curH, curM] = timeStr.split(":").map(Number);
      const [closeH, closeM] = cleanBranchClosing.split(":").map(Number);
      const curMins = curH * 60 + curM;
      const closeMins = closeH * 60 + closeM;
      const diffMins = curMins - closeMins;

      // يتم إرسال التقرير في دقيقة الإغلاق أو خلال 60 دقيقة تالية لضمان عدم تفويته إذا كان السيرفر يعيد التشغيل
      if (diffMins >= 0 && diffMins <= 60) {
        // التحقق من عدم إرسال التقرير لهذا الفرع اليوم مسبقاً
        const sentKey = `shift_report_sent_${branch.id}_${dateStr}`;
        const alreadySent = await prisma.systemSetting.findUnique({
          where: { key: sentKey },
        });

        if (!alreadySent) {
          console.log(`[Shift Report] Triggering automated shift closing report for ${branch.name} at ${timeStr} (closing: ${cleanBranchClosing})...`);
          await sendBranchShiftWhatsAppReport(branch.id);

          // تسجيل أنه تم الإرسال اليوم
          await prisma.systemSetting.upsert({
            where: { key: sentKey },
            update: { value: "true" },
            create: { key: sentKey, value: "true" },
          });
        }
      }
    }
  } catch (err) {
    console.error("[Shift Report] Periodic check error:", err);
  }
}

// -------------------------------------------------------------
// إعدادات الصوت المخصص للتنبيهات والإشعارات (Notification Sound Settings)
// -------------------------------------------------------------
export interface NotificationSoundSettings {
  enabled: boolean;
  soundUrl: string;     // رابط الملف المرفوع مثل /uploads/1728987.mp3 أو فارغ للنغمة الافتراضية
  soundName: string;    // اسم ملف الصوت الأصلي لسهولة التعرف عليه
  volume: number;       // مستوى الصوت من 0.1 إلى 1.0
  updatedAt?: string;
}

export const DEFAULT_SOUND_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  soundUrl: "",
  soundName: "النغمة الافتراضية للنظام (Synthetic Chime)",
  volume: 1.0,
};

export async function getNotificationSoundSettings(): Promise<NotificationSoundSettings> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: "notification_sound_settings" },
    });
    if (record && record.value) {
      return { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(record.value) };
    }
  } catch (_e) {}
  return DEFAULT_SOUND_SETTINGS;
}

export async function updateNotificationSoundSettings(settings: Partial<NotificationSoundSettings>): Promise<NotificationSoundSettings> {
  const current = await getNotificationSoundSettings();
  const updated: NotificationSoundSettings = {
    ...current,
    ...settings,
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : current.enabled,
    soundUrl: settings.soundUrl !== undefined ? String(settings.soundUrl) : current.soundUrl,
    soundName: settings.soundName !== undefined ? String(settings.soundName) : current.soundName,
    volume: typeof settings.volume === "number" ? Math.min(1, Math.max(0.1, settings.volume)) : current.volume,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: "notification_sound_settings" },
    update: { value: JSON.stringify(updated) },
    create: { key: "notification_sound_settings", value: JSON.stringify(updated) },
  });

  return updated;
}

export interface RestaurantLocationSettings {
  name: string;
  address: string;
  lat: number;
  lng: number;
  isCustom: boolean;
  updatedAt?: string;
}

export const DEFAULT_RESTAURANT_LOCATION: RestaurantLocationSettings = {
  name: "الفرع الرئيسي للمنصة",
  address: "الشارع التجاري الرئيسي",
  lat: 30.0262,
  lng: 31.2088,
  isCustom: false,
};

export async function getRestaurantLocationSettings(): Promise<RestaurantLocationSettings> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: "restaurant_location_settings" },
    });
    if (record && record.value) {
      return { ...DEFAULT_RESTAURANT_LOCATION, ...JSON.parse(record.value) };
    }
  } catch (_e) {}
  return DEFAULT_RESTAURANT_LOCATION;
}

export async function updateRestaurantLocationSettings(settings: Partial<RestaurantLocationSettings>): Promise<RestaurantLocationSettings> {
  const current = await getRestaurantLocationSettings();
  const updated: RestaurantLocationSettings = {
    ...current,
    ...settings,
    name: settings.name ? String(settings.name).trim() : current.name,
    address: settings.address ? String(settings.address).trim() : current.address,
    lat: typeof settings.lat === "number" ? settings.lat : Number(settings.lat ?? current.lat),
    lng: typeof settings.lng === "number" ? settings.lng : Number(settings.lng ?? current.lng),
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: "restaurant_location_settings" },
    update: { value: JSON.stringify(updated) },
    create: { key: "restaurant_location_settings", value: JSON.stringify(updated) },
  });

  return updated;
}



