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
}

const DEFAULT_WHATSAPP_ALERT_SETTINGS: WhatsAppAlertSettings = {
  cancellationAlertPhones: "",
  cancellationAlertEnabled: true,
  unacceptedAlertPhones: "",
  unacceptedAlertEnabled: true,
  unacceptedDelayMinutes: 5,
  dailyReportPhones: "",
  dailyReportEnabled: true,
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
👛 خصومات المحفظة الجامعية: *${walletDiscountsSum.toFixed(1)} ج.م*

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
✨ *نظام UniFood لإدارة مطاعم الحرم الجامعي.*`;

  return {
    branchName: branch.name,
    message,
    totalOrders,
    completedOrders: completedOrders.length,
    totalRevenue,
  };
}

/**
 * إرسال التقرير المالي للشيفت عبر الواتساب للأرقام المحددة في لوحة التحكم
 */
export async function sendBranchShiftWhatsAppReport(branchId: string, customPhone?: string): Promise<{ success: boolean; sentCount: number; message?: string }> {
  try {
    const report = await generateBranchShiftReport(branchId);
    if (!report) {
      return { success: false, sentCount: 0, message: "الفرع غير موجود" };
    }

    const settings = await getWhatsAppAlertSettings();
    const phoneSources = customPhone ? [customPhone] : (settings.dailyReportPhones || "").split(/[\n,;]+/);
    const phones = phoneSources
      .map((p) => p.trim())
      .filter((p) => p.length >= 10);

    if (phones.length === 0) {
      return { success: false, sentCount: 0, message: "لم يتم تحديد أرقام هواتف لإرسال التقرير إليها" };
    }

    const { whatsappService } = await import("./whatsapp.service.js");
    let sentCount = 0;
    for (const phone of phones) {
      try {
        await whatsappService.sendOrderStatusNotification(phone, report.message);
        sentCount++;
      } catch (err) {
        console.warn(`[Shift Report] Failed to send to ${phone}:`, err);
      }
    }

    return { success: sentCount > 0, sentCount, message: `تم إرسال التقرير المالي إلى ${sentCount} رقم بنجاح` };
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


