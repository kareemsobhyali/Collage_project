import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma.js";
import { authenticateUser, AuthRequest, JWT_SECRET } from "../middleware/auth.js";
import { notifyBranchNewOrder, notifyOrderStatusChanged, notifyGroupCartUpdated } from "../sockets/socketManager.js";
import { getLoyaltySettings, awardLoyaltyPointsIfCompleted, getRestaurantLocationSettings } from "../services/settings.service.js";
import { isOrderAcceptedByDriver } from "../services/driver.service.js";

const router = Router();

// جلب موقع المطعم الرئيسي والخرائط للعملاء والطيارين
router.get("/public/restaurant-location", async (_req: Request, res: Response) => {
  try {
    const settings = await getRestaurantLocationSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع موقع المطعم" });
  }
});

// 0. استعراض البانرات الإعلانية الترويجية
router.get("/banners", async (_req: Request, res: Response) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع البانرات الإعلانية" });
  }
});

// 0.5 التحقق من صلاحية كود الخصم للطلاب (شامل عدد مرات الاستخدام وشرط المرة الواحدة)
router.post("/promo-codes/validate", async (req: Request, res: Response) => {
  try {
    const { code, subtotal, branchId } = req.body;
    if (!code || !code.trim()) {
      res.status(400).json({ error: "يرجى إدخال كود الخصم" });
      return;
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!promo || !promo.isActive) {
      res.status(404).json({ error: "كود الخصم غير صالح أو غير مفعل" });
      return;
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      res.status(400).json({ error: "انتهت صلاحية كود الخصم هذا" });
      return;
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      res.status(400).json({ error: "عذراً، تم استنفاد الحد الأقصى لعدد مرات استخدام هذا الكوبون" });
      return;
    }

    // التحقق من نطاق الفروع المسموح بها لهذا الكوبون (فروع معينة أو الكل)
    if (promo.applicableBranchIds) {
      try {
        const allowedBranches: string[] = JSON.parse(promo.applicableBranchIds);
        if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
          if (!branchId || !allowedBranches.includes(String(branchId).trim())) {
            res.status(400).json({ error: "كود الخصم هذا مخصص لمطاعم وفروع محددة فقط ولا ينطبق على هذا المطعم" });
            return;
          }
        }
      } catch (_e) {
        const allowedBranches = promo.applicableBranchIds.split(',').map(s => s.trim()).filter(Boolean);
        if (allowedBranches.length > 0 && (!branchId || !allowedBranches.includes(String(branchId).trim()))) {
          res.status(400).json({ error: "كود الخصم هذا مخصص لمطاعم وفروع محددة فقط ولا ينطبق على هذا المطعم" });
          return;
        }
      }
    }

    // التحقق من شرط الاستخدام لمرة واحدة لكل طالب إذا كان مسجلاً للدخول
    if (promo.oncePerUser && req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded?.userId) {
          const previousUses = await prisma.order.count({
            where: {
              userId: decoded.userId,
              promoCode: promo.code,
              status: { not: "REJECTED" },
            },
          });
          if (previousUses > 0) {
            res.status(400).json({ error: "لقد قمت باستخدام كود الخصم هذا مسبقاً (متاح لمرة واحدة لكل طالب)" });
            return;
          }
        }
      } catch (_e) {
        // ignore invalid token during pre-login validation
      }
    }

    const sub = parseFloat(subtotal) || 0;
    if (sub < promo.minOrder) {
      res.status(400).json({ error: `الحد الأدنى لتطبيق هذا الكود هو ${promo.minOrder} ج.م` });
      return;
    }

    let discount = 0;
    if (promo.discountType === "PERCENT" || promo.discountType === "PERCENTAGE") {
      discount = Math.round((sub * promo.value) / 100);
    } else {
      discount = Math.min(sub, promo.value);
    }

    res.json({
      success: true,
      valid: true,
      code: promo.code,
      discount,
      discountType: promo.discountType,
      value: promo.value,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل التحقق من كود الخصم" });
  }
});

// دالة مساعدة للتحقق من وقوع التوقيت وأيام العمل (بتوقيت مصر) داخل مواعيد العمل الرسمية للفرع
function isBranchWithinWorkingHours(
  openingTime?: string | null,
  closingTime?: string | null,
  targetDate?: Date,
  workingDays?: string | null
): boolean {
  const base = targetDate || new Date();
  const cairoDate = new Date(base.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));

  // التحقق من أيام العمل إذا كانت محددة explicitly
  if (workingDays && workingDays.trim()) {
    const wd = workingDays.trim();
    const dayIndex = cairoDate.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    if ((wd.includes("السبت - الخميس") || wd.includes("ماعدا الجمعة") || wd.includes("عدا الجمعة")) && dayIndex === 5) {
      return false;
    }
    const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const arabicAlt = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعة", "السبت"];
    if (!wd.includes("-") && !wd.includes("يوميا") && !wd.includes("يومياً") && !wd.includes("كل") && !wd.includes("طوال")) {
      const hasAnyDayName = arabicDays.some((d, idx) => wd.includes(d) || wd.includes(arabicAlt[idx]));
      if (hasAnyDayName && !wd.includes(arabicDays[dayIndex]) && !wd.includes(arabicAlt[dayIndex])) {
        return false;
      }
    }
  }

  if (!openingTime || !closingTime) return true;
  const openParts = openingTime.split(":").map(Number);
  const closeParts = closingTime.split(":").map(Number);
  if (openParts.length < 2 || closeParts.length < 2 || isNaN(openParts[0]) || isNaN(closeParts[0])) {
    return true;
  }
  const openMins = openParts[0] * 60 + (openParts[1] || 0);
  const closeMins = closeParts[0] * 60 + (closeParts[1] || 0);
  if (openMins === closeMins) return true;

  const currentMins = cairoDate.getHours() * 60 + cairoDate.getMinutes();

  if (closeMins > openMins) {
    return currentMins >= openMins && currentMins <= closeMins;
  } else {
    // في حال امتداد الدوام لما بعد منتصف الليل (مثال: 10:00 صباحاً حتى 02:00 فجراً)
    return currentMins >= openMins || currentMins <= closeMins;
  }
}

// 1. استعراض الفروع النشطة للطلاب
router.get("/branches", async (_req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: {
        paymentConfig: true,
        deliveryZones: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    const formattedBranches = branches.map(b => {
      let currentStatus = b.operationalStatus;
      let currentClosedUntil = b.closedUntil;
      let currentReason = b.closingReason;

      if (currentStatus === "BUSY" && currentClosedUntil && now >= new Date(currentClosedUntil)) {
        currentStatus = "OPEN";
        currentClosedUntil = null;
        currentReason = null;
      }

      const isWithinWorkingHours = isBranchWithinWorkingHours(b.openingTime, b.closingTime, now, b.workingDays);

      return {
        ...b,
        operationalStatus: currentStatus,
        closedUntil: currentClosedUntil,
        closingReason: currentReason,
        isWithinWorkingHours,
      };
    });

    res.json(formattedBranches);
  } catch (error) {
    console.error("Get customer branches error:", error);
    res.status(500).json({ error: "فشل استرجاع قائمة المطاعم المتاحة" });
  }
});

// 2. تصفح منيو الفرع وطرق الدفع ومناطق التوصيل المتاحة له
router.get("/branches/:id/menu", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const now = new Date();

    const branch = await prisma.branch.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ],
        isActive: true,
      },
      include: {
        paymentConfig: true,
        deliveryZones: true,
      },
    });

    if (!branch) {
      res.status(404).json({ error: "الفرع غير متاح أو غير موجود" });
      return;
    }

    const actualBranchId = branch.id;

    // إعادة تفعيل الأصناف والإضافات التي انتهت مدة نفادها المؤقت تلقائياً
    await prisma.menuItem.updateMany({
      where: {
        branchId: actualBranchId,
        isAvailable: false,
        unavailableUntil: { not: null, lte: now },
      },
      data: {
        isAvailable: true,
        unavailableUntil: null,
      },
    });

    await prisma.modifierOption.updateMany({
      where: {
        group: { branchId: actualBranchId },
        isAvailable: false,
        unavailableUntil: { not: null, lte: now },
      },
      data: {
        isAvailable: true,
        unavailableUntil: null,
      },
    });

    const categories = await prisma.menuCategory.findMany({
      where: { branchId: actualBranchId },
      include: {
        items: {
          where: { isAvailable: true },
          include: {
            sizes: true,
            modifierGroupLinks: {
              include: {
                group: {
                  include: {
                    options: {
                      where: { isAvailable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    let currentStatus = branch.operationalStatus;
    let currentClosedUntil = branch.closedUntil;
    let currentReason = branch.closingReason;

    if (currentStatus === "BUSY" && currentClosedUntil && now >= new Date(currentClosedUntil)) {
      currentStatus = "OPEN";
      currentClosedUntil = null;
      currentReason = null;
    }

    const isWithinWorkingHours = isBranchWithinWorkingHours(branch.openingTime, branch.closingTime, now, branch.workingDays);

    res.json({
      branch: {
        ...branch,
        operationalStatus: currentStatus,
        closedUntil: currentClosedUntil,
        closingReason: currentReason,
        isWithinWorkingHours,
      },
      categories,
    });
  } catch (error) {
    console.error("Get branch menu for customer error:", error);
    res.status(500).json({ error: "فشل تحميل منيو الفرع" });
  }
});

// ==========================================
// مسارات السلة الجماعية التشاركية (سلة الشلة)
// ==========================================

// إنشاء سلة جماعية جديدة ومشاركتها بكود أو رابط
router.post("/group-cart/create", async (req: Request, res: Response) => {
  try {
    const { branchId, hostName } = req.body;
    if (!branchId || !hostName) {
      res.status(400).json({ error: "يرجى تحديد الفرع واسم صاحب السلة" });
      return;
    }

    // توليد كود مشاركة عشوائي آمن وفريد من 6 أحرف
    let shareCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = crypto.randomBytes(4).toString("hex").substring(0, 6).toUpperCase();
      const exists = await prisma.groupCart.findUnique({ where: { shareCode: candidate } });
      if (!exists) {
        shareCode = candidate;
        break;
      }
    }
    if (!shareCode) {
      shareCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    }

    const cart = await prisma.groupCart.create({
      data: {
        branchId,
        hostName: String(hostName).trim(),
        shareCode,
      },
      include: {
        items: true,
      },
    });

    res.status(201).json(cart);
  } catch (error) {
    console.error("Create group cart error:", error);
    res.status(500).json({ error: "فشل إنشاء سلة الشلة" });
  }
});

// استعراض محتويات السلة الجماعية بالكود
router.get("/group-cart/:code", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة أو انتهت صلاحيتها" });
      return;
    }

    const branch = await prisma.branch.findUnique({
      where: { id: cart.branchId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        allowDelivery: true,
        allowPickup: true,
        deliveryFee: true,
        operationalStatus: true,
        openingTime: true,
        closingTime: true,
        workingDays: true,
      },
    });

    res.json({ ...cart, branch });
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع بيانات سلة الشلة" });
  }
});

// إضافة صنف لسلة الشلة باسم الطالب (مع التحقق من السعر الحقيقي من قاعدة البيانات)
router.post("/group-cart/:code/items", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const { studentName, menuItemId, itemName, sizeName, unitPrice, quantity, notes, selectedModifiers } = req.body;

    if (!studentName || !menuItemId || !itemName) {
      res.status(400).json({ error: "بيانات الصنف غير مكتملة" });
      return;
    }

    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة" });
      return;
    }

    const dbItem = await prisma.menuItem.findUnique({
      where: { id: String(menuItemId) },
      include: { sizes: true },
    });

    if (!dbItem || dbItem.branchId !== cart.branchId || !dbItem.isAvailable) {
      res.status(400).json({ error: "الصنف المطلوب غير متاح في هذا المطعم" });
      return;
    }

    let realBasePrice = dbItem.basePrice;
    if (dbItem.sizes && dbItem.sizes.length > 0) {
      const matchedSize = sizeName ? dbItem.sizes.find(s => s.name === sizeName) : dbItem.sizes[0];
      if (!matchedSize) {
        res.status(400).json({ error: "حجم الصنف المختار غير صالح" });
        return;
      }
      realBasePrice = matchedSize.price;
    }

    let modifiersExtra = 0;
    let comboExtra = 0;
    let parsedMods: any[] = [];
    if (selectedModifiers) {
      try {
        parsedMods = Array.isArray(selectedModifiers) ? selectedModifiers : JSON.parse(String(selectedModifiers));
      } catch {
        parsedMods = [];
      }
    }

    for (const mod of parsedMods) {
      if (mod.groupId === "combo" && dbItem.comboItems) {
        try {
          const combos = typeof dbItem.comboItems === "string" ? JSON.parse(dbItem.comboItems) : dbItem.comboItems;
          if (Array.isArray(combos)) {
            const foundCombo = combos.find((c: any) => c.id === mod.optionId || c.title === mod.optionName || mod.optionName?.startsWith(c.title));
            if (foundCombo) {
              const cQty = Math.max(1, Number(mod.quantity) || 1);
              comboExtra += Math.max(0, Number(foundCombo.price) || 0) * cQty;
            }
          }
        } catch {}
      } else if (mod.optionId) {
        const dbOpt = await prisma.modifierOption.findUnique({
          where: { id: String(mod.optionId) },
          include: { group: { select: { branchId: true } } },
        });
        if (dbOpt && dbOpt.isAvailable && dbOpt.group.branchId === cart.branchId) {
          modifiersExtra += Math.max(0, dbOpt.price);
        }
      }
    }

    const qty = Math.max(1, Math.min(100, parseInt(quantity) || 1));
    const verifiedUnitPrice = realBasePrice + modifiersExtra;
    const totalPrice = verifiedUnitPrice * qty + comboExtra;

    await prisma.groupCartItem.create({
      data: {
        groupCartId: cart.id,
        studentName: String(studentName).trim(),
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        sizeName: sizeName || null,
        unitPrice: verifiedUnitPrice,
        quantity: qty,
        totalPrice,
        notes: notes ? String(notes).trim() : null,
        selectedModifiers: parsedMods.length > 0 ? JSON.stringify(parsedMods) : null,
      },
    });

    const updatedCart = await prisma.groupCart.findUnique({
      where: { id: cart.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    notifyGroupCartUpdated(code, updatedCart);
    res.status(201).json(updatedCart);
  } catch (error) {
    console.error("Add group cart item error:", error);
    res.status(500).json({ error: "فشل إضافة الصنف لسلة الشلة" });
  }
});

// حذف صنف من سلة الشلة (يسمح فقط لصاحب الصنف أو منشئ السلة)
router.delete("/group-cart/:code/items/:itemId", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const itemId = req.params.itemId as string;
    const studentName = (req.query.studentName as string)?.trim();

    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة" });
      return;
    }

    const item = await prisma.groupCartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.groupCartId !== cart.id) {
      res.status(404).json({ error: "الصنف غير موجود بالسلة" });
      return;
    }

    // التحقق الإلزامي من الصلاحية: صاحب الصنف فقط أو منشئ السلة هو المخول بالحذف
    if (!studentName || (studentName !== item.studentName && studentName !== cart.hostName)) {
      res.status(403).json({ error: "لا يمكنك حذف أصناف طالب آخر! يمكنك فقط حذف أو تعديل أصنافك الخاصة." });
      return;
    }

    await prisma.groupCartItem.delete({
      where: { id: itemId },
    });

    const updatedCart = await prisma.groupCart.findUnique({
      where: { id: cart.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    notifyGroupCartUpdated(code, updatedCart);
    res.json(updatedCart);
  } catch (error) {
    console.error("Delete group cart item error:", error);
    res.status(500).json({ error: "فشل حذف الصنف من سلة الشلة" });
  }
});

// المسارات التالية تتطلب تسجيل دخول العميل
router.use(authenticateUser);

// 3. إنشاء طلب جديد (Checkout)
router.post("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      branchId,
      orderType, // "DELIVERY" أو "PICKUP"
      paymentMethod, // "CASH", "VODAFONE_CASH", "INSTAPAY", "CARD"
      addressText,
      deliveryZoneName,
      deliveryFee: customDeliveryFee,
      paymentProofUrl,
      paymentSenderPhone,
      promoCode,
      discount: discountInput,
      customerPhone,
      customerName,
      notes,
      items, // قائمة الأصناف المختارة
      isScheduled,
      scheduledFor,
      groupCartDetails,
      useWallet,
    } = req.body;

    if (!branchId || !orderType || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
      return;
    }

    if (orderType === "DELIVERY" && (!addressText || !addressText.trim())) {
      res.status(400).json({ error: "يرجى كتابة عنوان التوصيل داخل الجامعة (المبنى / الدور / القاعة)" });
      return;
    }

    // جلب بيانات الفرع للتحقق من نشاطه وإعدادات الدفع
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { paymentConfig: true, deliveryZones: true },
    });

    if (!branch || !branch.isActive) {
      res.status(400).json({ error: "المطعم غير متاح لاستقبال الطلبات حالياً" });
      return;
    }

    // التحقق من حالة استقبال الطلبات (مغلق مؤقتاً أو مغلق تماماً أو خارج مواعيد العمل الرسمية)
    const currentTime = new Date();
    if (branch.operationalStatus === "CLOSED") {
      res.status(400).json({ error: "عذراً، هذا المطعم مغلق حالياً ولا يستقبل أي طلبات فورية أو حجز مسبق." });
      return;
    }

    if (branch.operationalStatus === "BUSY" && branch.closedUntil && currentTime < new Date(branch.closedUntil)) {
      const remainingMinutes = Math.ceil((new Date(branch.closedUntil).getTime() - currentTime.getTime()) / (60 * 1000));
      res.status(400).json({ 
        error: `المطعم في فترة استراحة/تجهيز مؤقتة (${remainingMinutes} دقيقة تقريباً). لا يمكن استقبال الطلبات أو الحجز المسبق حالياً حتى عودة الفرع للعمل.` 
      });
      return;
    }

    if (!isBranchWithinWorkingHours(branch.openingTime, branch.closingTime, currentTime, branch.workingDays)) {
      res.status(400).json({
        error: `عذراً، المطعم مغلق حالياً لانتهاء مواعيد العمل الرسمية (${branch.openingTime || "08:00"} - ${branch.closingTime || "22:00"}). غير متاح عمل طلبات أو حجز مسبق طالما الفرع مغلق.`,
      });
      return;
    }

    // إذا كان الطلب محجوزاً مسبقاً، يجب أن يكون موعد الحجز صالحاً وفي المستقبل وضمن ساعات عمل المطعم الرسمية
    if (isScheduled) {
      if (!scheduledFor) {
        res.status(400).json({ error: "يرجى تحديد موعد الاستلام أو التوصيل للطلب المجدول" });
        return;
      }
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < currentTime.getTime() - 60 * 1000) {
        res.status(400).json({ error: "موعد الحجز المسبق غير صالح أو في وقت سابق، يرجى اختيار موعد مستقبلي" });
        return;
      }
      if (!isBranchWithinWorkingHours(branch.openingTime, branch.closingTime, scheduledDate, branch.workingDays)) {
        res.status(400).json({
          error: `موعد الحجز المسبق المختار (${scheduledDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}) يقع خارج ساعات عمل المطعم (${branch.openingTime || "08:00"} - ${branch.closingTime || "22:00"}). يرجى اختيار موعد ضمن فترة العمل.`,
        });
        return;
      }
    }

    // التحقق من تفعيل خيار الطلب (توصيل أو استلام)
    if (orderType === "DELIVERY" && !branch.allowDelivery) {
      res.status(400).json({ error: "هذا الفرع لا يوفر خدمة التوصيل حالياً، يمكنك اختيار الاستلام من الفرع" });
      return;
    }

    if (orderType === "PICKUP" && !branch.allowPickup) {
      res.status(400).json({ error: "هذا الفرع لا يوفر خيار الاستلام المباشر" });
      return;
    }

    // التحقق من أن طريقة الدفع مفعلة لهذا الفرع تحديداً
    const paymentConfig = branch.paymentConfig;
    if (paymentConfig) {
      if (paymentMethod === "CASH" && !paymentConfig.cashEnabled) {
        res.status(400).json({ error: "الدفع كاش غير متاح لهذا الفرع" });
        return;
      }
      if (paymentMethod === "VODAFONE_CASH" && !paymentConfig.vodafoneCashEnabled) {
        res.status(400).json({ error: "الدفع بمحفظة فودافون كاش غير متاح لهذا الفرع" });
        return;
      }
      if (paymentMethod === "INSTAPAY" && !paymentConfig.instapayEnabled) {
        res.status(400).json({ error: "الدفع عبر إنستاباي غير متاح لهذا الفرع" });
        return;
      }
      if (paymentMethod === "CARD" && !paymentConfig.cardEnabled) {
        res.status(400).json({ error: "الدفع بالبطاقة الإلكترونية غير متاح لهذا الفرع" });
        return;
      }
    }

    // حساب الأسعار والمجموع من قاعدة البيانات لمنع التلاعب بالأسعار من المتصفح
    let subtotal = 0;
    const orderItemsData: any[] = [];

    for (const itemInput of items) {
      const dbItem = await prisma.menuItem.findUnique({
        where: { id: itemInput.menuItemId },
        include: { sizes: true },
      });

      if (!dbItem || dbItem.branchId !== branchId) {
        res.status(400).json({ error: `الصنف المطلوب غير موجود في هذا المطعم` });
        return;
      }

      if (!dbItem.isAvailable) {
        if (dbItem.unavailableUntil && currentTime >= new Date(dbItem.unavailableUntil)) {
          await prisma.menuItem.update({
            where: { id: dbItem.id },
            data: { isAvailable: true, unavailableUntil: null },
          });
        } else {
          res.status(400).json({ error: `عذراً، الصنف "${dbItem.name}" نفد للتو وغير متاح حالياً` });
          return;
        }
      }

      let unitPrice = dbItem.basePrice;
      let resolvedSizeName: string | null = itemInput.sizeName || null;
      if (dbItem.sizes && dbItem.sizes.length > 0) {
        if (itemInput.sizeName) {
          const matchedSize = dbItem.sizes.find(s => s.name === itemInput.sizeName);
          if (!matchedSize) {
            res.status(400).json({ error: `الحجم المختار للصنف "${dbItem.name}" غير صالح` });
            return;
          }
          unitPrice = matchedSize.price;
        } else {
          unitPrice = dbItem.sizes[0].price;
          resolvedSizeName = dbItem.sizes[0].name;
        }
      }

      // جلب والتحقق الفعلي من أسعار الإضافات المختارة من قاعدة البيانات لمنع أي تلاعب بالسعر من العميل
      let modifiersExtra = 0;
      let comboExtra = 0;
      const verifiedModifiers: any[] = [];
      if (itemInput.selectedModifiers && Array.isArray(itemInput.selectedModifiers)) {
        for (const mod of itemInput.selectedModifiers) {
          let realModPrice = 0;
          let isComboMod = false;
          let optionName = String(mod.optionName || mod.name || "").trim();
          if (mod.groupId === 'combo' && dbItem.comboItems) {
            try {
              const combos = typeof dbItem.comboItems === 'string' ? JSON.parse(dbItem.comboItems) : dbItem.comboItems;
              if (Array.isArray(combos)) {
                const foundCombo = combos.find((c: any) => c.id === mod.optionId || c.title === mod.optionName || mod.optionName?.startsWith(c.title));
                if (foundCombo) {
                  const qty = Math.max(1, Number(mod.quantity) || 1);
                  realModPrice = Math.max(0, Number(foundCombo.price) || 0) * qty;
                  optionName = foundCombo.title + (qty > 1 ? ` (×${qty})` : "");
                  isComboMod = true;
                }
              }
            } catch (_e) {}
          } else if (mod.optionId) {
            const dbOption = await prisma.modifierOption.findUnique({
              where: { id: mod.optionId },
              include: { group: { select: { branchId: true } } },
            });
            if (dbOption && dbOption.isAvailable && dbOption.group.branchId === branchId) {
              realModPrice = Math.max(0, dbOption.price);
              optionName = dbOption.name;
            } else {
              continue;
            }
          } else if (optionName) {
            const dbOption = await prisma.modifierOption.findFirst({
              where: {
                name: optionName,
                group: { branchId },
                isAvailable: true,
              },
            });
            if (dbOption) {
              realModPrice = Math.max(0, dbOption.price);
            }
          }
          if (isComboMod) {
            comboExtra += realModPrice;
          } else {
            modifiersExtra += realModPrice;
          }
          verifiedModifiers.push({
            optionId: mod.optionId,
            optionName: optionName || "إضافة",
            price: realModPrice,
          });
        }
      }

      const totalItemUnit = unitPrice + modifiersExtra;
      const quantity = Math.max(1, Math.min(100, parseInt(itemInput.quantity) || 1));
      const itemTotalPrice = (totalItemUnit * quantity) + comboExtra;

      subtotal += itemTotalPrice;

      orderItemsData.push({
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        sizeName: resolvedSizeName,
        unitPrice: totalItemUnit,
        quantity,
        totalPrice: itemTotalPrice,
        notes: itemInput.notes ? String(itemInput.notes).trim() : null,
        selectedModifiers: verifiedModifiers.length > 0 ? JSON.stringify(verifiedModifiers) : null,
      });
    }

    // حساب رسوم التوصيل من إعدادات الفرع الفعلية
    let calculatedDeliveryFee = 0;
    if (orderType === "DELIVERY") {
      if (branch.deliveryType === "ZONES" && branch.deliveryZones.length > 0) {
        const matchedZone = deliveryZoneName
          ? branch.deliveryZones.find(z => z.name === deliveryZoneName)
          : null;
        if (matchedZone) {
          calculatedDeliveryFee = matchedZone.fee;
        } else {
          // في حال لم يطابق اسم المنطقة، استخدام أول منطقة معتمدة أو رسوم الفرع الأساسية
          calculatedDeliveryFee = Math.max(branch.deliveryFee, branch.deliveryZones[0].fee);
        }
      } else {
        calculatedDeliveryFee = Math.max(0, branch.deliveryFee);
      }
    }

    // التحقق الفعلي من كود الخصم على السيرفر (شامل حدود الاستخدام)
    let discount = 0;
    let verifiedPromoCode: string | null = null;
    let verifiedPromoId: string | null = null;

    if (promoCode && String(promoCode).trim()) {
      const cleanCode = String(promoCode).trim().toUpperCase();
      const promo = await prisma.promoCode.findUnique({
        where: { code: cleanCode },
      });

      const isUnderLimit = !promo?.maxUses || promo.usedCount < promo.maxUses;
      let allowedForUser = true;
      if (promo?.oncePerUser) {
        const previousUses = await prisma.order.count({
          where: { userId, promoCode: promo.code, status: { not: "REJECTED" } },
        });
        if (previousUses > 0) allowedForUser = false;
      }

      let allowedForBranch = true;
      if (promo?.applicableBranchIds) {
        try {
          const allowedBranches: string[] = JSON.parse(promo.applicableBranchIds);
          if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
            allowedForBranch = allowedBranches.includes(branchId);
          }
        } catch {
          const allowedBranches = promo.applicableBranchIds.split(',').map(s => s.trim()).filter(Boolean);
          if (allowedBranches.length > 0) {
            allowedForBranch = allowedBranches.includes(branchId);
          }
        }
      }

      if (
        promo &&
        promo.isActive &&
        (!promo.expiresAt || new Date() <= promo.expiresAt) &&
        subtotal >= promo.minOrder &&
        isUnderLimit &&
        allowedForUser &&
        allowedForBranch
      ) {
        verifiedPromoCode = promo.code;
        verifiedPromoId = promo.id;
        if (promo.discountType === "PERCENT" || promo.discountType === "PERCENTAGE") {
          discount = Math.round((subtotal * promo.value) / 100);
        } else {
          discount = Math.min(subtotal, promo.value);
        }
      }
    }

    const preWalletTotal = Math.max(0, subtotal + calculatedDeliveryFee - discount);

    // التحقق من حالة حساب الطالب وعدم حظره
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser || currentUser.isBlocked) {
      res.status(403).json({
        error: "عذراً، تم إيقاف هذا الحساب من إرسال طلبات جديدة. يرجى التواصل مع الإدارة.",
      });
      return;
    }

    const finalPhone = customerPhone ? String(customerPhone).trim().replace(/\s+/g, "") : req.user!.phone;
    if (!/^01[0125][0-9]{8}$/.test(finalPhone) && currentUser.role !== "SUPERADMIN") {
      res.status(400).json({
        error: "يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015",
      });
      return;
    }

    // خصم رصيد المحفظة الجامعية إذا اختار الطالب الدفع/الخصم من المحفظة
    let walletDiscount = 0;
    if (useWallet && currentUser && currentUser.walletBalance > 0 && preWalletTotal > 0) {
      walletDiscount = Math.min(preWalletTotal, currentUser.walletBalance);
    }

    const total = Math.max(0, preWalletTotal - walletDiscount);

    // حساب نقاط الولاء المحسوبة لهذا الطلب حسب إعدادات المنظومة (لا تُودع في المحفظة إلا بعد اكتمال الطلب والتسليم)
    const loyaltySettings = await getLoyaltySettings();
    const pointsEarned = loyaltySettings.enabled 
      ? Math.max(0, Math.floor(subtotal * loyaltySettings.pointsPerPound)) 
      : 0;

    // توليد رمز أمان استلام عشوائي (4 أرقام) للتحقق عند التسليم مع الطيار
    const pickupPin = crypto.randomInt(1000, 10000).toString();

    // إنشاء الطلب وخصم المحفظة في عملية متسلسلة ذرية واحدة لحماية الرصيد ومنع تكرار الطلبات
    const { order, updatedUser } = await prisma.$transaction(async (tx) => {
      // منع تكرار الطلبات الناتج عن الضغط المزدوج السريع (Idempotency guard خلال 5 ثوانٍ)
      const duplicateOrder = await tx.order.findFirst({
        where: {
          userId,
          branchId,
          subtotal,
          status: "PENDING",
          createdAt: { gte: new Date(Date.now() - 5000) },
        },
        select: { id: true },
      });
      if (duplicateOrder) {
        throw new Error("DUPLICATE_ORDER_SUBMISSION");
      }

      // التحقق الذري من كود الخصم وشرط المرة الواحدة داخل المعاملة
      if (verifiedPromoId && verifiedPromoCode) {
        const freshPromo = await tx.promoCode.findUnique({
          where: { id: verifiedPromoId },
        });
        if (!freshPromo || !freshPromo.isActive) {
          throw new Error("PROMO_INVALID");
        }
        if (freshPromo.maxUses && freshPromo.usedCount >= freshPromo.maxUses) {
          throw new Error("PROMO_EXHAUSTED");
        }
        if (freshPromo.oncePerUser) {
          const usedByUser = await tx.order.count({
            where: { userId, promoCode: verifiedPromoCode, status: { not: "REJECTED" } },
          });
          if (usedByUser > 0) {
            throw new Error("PROMO_ALREADY_USED_BY_USER");
          }
        }
        await tx.promoCode.update({
          where: { id: verifiedPromoId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // توليد رقم طلب تصاعدي وفريد داخل المعاملة
      const lastOrder = await tx.order.findFirst({
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const orderNumber = lastOrder && lastOrder.orderNumber >= 1000 ? lastOrder.orderNumber + 1 : 1001;

      // التحقق الذري من الرصيد داخل المعاملة لمنع استنزاف المحفظة بالتزامن
      let userAfterWallet = null;
      if (walletDiscount > 0) {
        const walletClaim = await tx.user.updateMany({
          where: { id: userId, walletBalance: { gte: walletDiscount } },
          data: { walletBalance: { decrement: walletDiscount } },
        });
        if (walletClaim.count === 0) {
          throw new Error("INSUFFICIENT_WALLET_BALANCE");
        }
      }

      userAfterWallet = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          loyaltyPoints: true,
          walletBalance: true,
        },
      });

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          branchId,
          userId,
          orderType,
          paymentMethod,
          addressText: orderType === "DELIVERY" ? addressText?.trim() : "استلام من الفرع",
          deliveryZoneName: deliveryZoneName ? String(deliveryZoneName).trim() : null,
          paymentProofUrl: paymentProofUrl ? String(paymentProofUrl).trim() : null,
          paymentSenderPhone: paymentSenderPhone ? String(paymentSenderPhone).trim() : null,
          promoCode: verifiedPromoCode,
          discount,
          walletDiscount,
          pointsEarned,
          pointsAwarded: false,
          customerPhone: finalPhone,
          customerName: customerName ? customerName.trim() : "طالب",
          notes: notes ? notes.trim() : null,
          status: "PENDING",
          subtotal,
          deliveryFee: calculatedDeliveryFee,
          total,
          isScheduled: !!isScheduled,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          pickupPin,
          groupCartDetails: groupCartDetails ? (typeof groupCartDetails === "object" ? JSON.stringify(groupCartDetails) : String(groupCartDetails)) : null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              isBlocked: true,
              restaurantNotes: true,
              _count: {
                select: { orders: true },
              },
            },
          },
          branch: {
            select: { name: true, phone: true, address: true, logoUrl: true },
          },
          driver: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      return { order: createdOrder, updatedUser: userAfterWallet };
    });

    // إشعار فوري لتطبيق الديسكتوب الخاص بالفرع لتشغيل التنبيه الصوتي فوراً
    notifyBranchNewOrder(branchId, order);

    res.status(201).json({
      success: true,
      order,
      user: updatedUser,
    });
  } catch (error: any) {
    if (error?.message === "DUPLICATE_ORDER_SUBMISSION") {
      res.status(409).json({ error: "تم استلام طلبك بالفعل، يرجى الانتظار لحظات" });
      return;
    }
    if (error?.message === "INSUFFICIENT_WALLET_BALANCE") {
      res.status(400).json({ error: "رصيد المحفظة الحالي غير كافٍ لإتمام عملية الخصم" });
      return;
    }
    if (error?.message === "PROMO_EXHAUSTED" || error?.message === "PROMO_INVALID") {
      res.status(400).json({ error: "عذراً، كود الخصم غير متاح أو وصل للحد الأقصى للاستخدام" });
      return;
    }
    if (error?.message === "PROMO_ALREADY_USED_BY_USER") {
      res.status(400).json({ error: "لقد قمت باستخدام كود الخصم هذا مسبقاً" });
      return;
    }
    console.error("Create order error:", error);
    res.status(500).json({ error: "فشل تسجيل الطلب" });
  }
});

// 4. تتبع حالة الطلب بالرقم التعريفي (محمي لملكية صاحب الطلب فقط)
router.get("/orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true, paymentConfig: true },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!order || (order.userId !== req.user!.userId && req.user!.role !== "SUPERADMIN")) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const isDriverAccepted = Boolean(order.driverPickedUpAt) || (order.driverId ? await isOrderAcceptedByDriver(order.id) : false);

    res.json({
      ...order,
      isDriverAccepted,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع بيانات الطلب" });
  }
});

// 5. سجل طلبات العميل
router.get("/my-orders", async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      include: {
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(
      orders.map(async (o) => ({
        ...o,
        isDriverAccepted: Boolean(o.driverPickedUpAt) || (o.driverId ? await isOrderAcceptedByDriver(o.id) : false),
      }))
    );

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع سجل الطلبات" });
  }
});

// 6. إلغاء الطلب من جهة الطالب (فقط إذا كان ما زال جديداً PENDING) مع استرداد رصيد المحفظة تلقائياً دون خصم نقاط الولاء السابقة
router.put("/orders/:id/cancel", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!order || order.userId !== userId) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (order.status !== "PENDING") {
      res.status(400).json({ error: "عذراً، لا يمكن إلغاء الطلب بعد أن بدأ المطعم في تحضيره" });
      return;
    }

    const { updated, updatedUser } = await prisma.$transaction(async (tx) => {
      // تحديث ذري مشروط بكون الحالة PENDING لمنع تكرار استرداد المحفظة при الطلبات المتزامنة
      const claim = await tx.order.updateMany({
        where: { id, userId, status: "PENDING" },
        data: {
          status: "REJECTED",
          cancelledAt: new Date(),
          notes: `${order.notes ? order.notes + " | " : ""}تم إلغاء الطلب من قِبل الطالب`,
        },
      });
      if (claim.count === 0) {
        throw new Error("ORDER_NOT_PENDING");
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, branch: true },
      });

      let refundedUser = null;
      const currentUser = await tx.user.findUnique({ where: { id: userId } });
      if (currentUser) {
        const refundedWallet = Number(((currentUser.walletBalance || 0) + (order.walletDiscount || 0)).toFixed(2));
        // لا يتم خصم النقاط إلا إذا كانت قد أُودعت بالفعل (pointsAwarded === true)
        const revertedPoints = order.pointsAwarded
          ? Math.max(0, (currentUser.loyaltyPoints || 0) - (order.pointsEarned || 0))
          : (currentUser.loyaltyPoints || 0);

        refundedUser = await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: refundedWallet,
            loyaltyPoints: revertedPoints,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            loyaltyPoints: true,
            walletBalance: true,
          },
        });
      }

      if (order.promoCode) {
        const promo = await tx.promoCode.findUnique({ where: { code: order.promoCode } });
        if (promo && promo.usedCount > 0) {
          await tx.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { decrement: 1 } },
          }).catch(() => {});
        }
      }

      return { updated: updatedOrder, updatedUser: refundedUser };
    });

    notifyOrderStatusChanged(id, order.branchId, updated);

    res.json({ success: true, order: updated, user: updatedUser });
  } catch (error: any) {
    if (error?.message === "ORDER_NOT_PENDING") {
      res.status(400).json({ error: "لا يمكن إلغاء هذا الطلب حالياً" });
      return;
    }
    console.error("Cancel order error:", error);
    res.status(500).json({ error: "فشل إلغاء الطلب" });
  }
});

// 7. تقييم الطلب بعد اكتماله
router.post("/orders/:id/rate", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { rating, review } = req.body;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order || order.userId !== userId) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (order.status !== "COMPLETED") {
      res.status(400).json({ error: "يمكن تقييم الطلب بعد استلامه واكتماله فقط" });
      return;
    }

    const numRating = Math.max(1, Math.min(5, parseInt(rating) || 5));

    const updated = await prisma.order.update({
      where: { id },
      data: {
        rating: numRating,
        review: review ? String(review).trim() : null,
      },
      include: { items: true, branch: true },
    });

    res.json({ success: true, order: updated });
  } catch (error) {
    console.error("Rate order error:", error);
    res.status(500).json({ error: "فشل حفظ التقييم" });
  }
});

// 7. جلب عناوين العميل المحفوظة
router.get("/addresses", async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await prisma.userAddress.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(addresses);
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({ error: "فشل جلب العناوين" });
  }
});

// 8. إضافة عنوان جديد
router.post("/addresses", async (req: AuthRequest, res: Response) => {
  try {
    const { title, details, isDefault } = req.body;
    if (!title || !details) {
      res.status(400).json({ error: "يرجى إدخال اسم وتفاصيل العنوان" });
      return;
    }

    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.userAddress.create({
      data: {
        userId: req.user!.userId,
        title: title.trim(),
        details: details.trim(),
        isDefault: !!isDefault,
      },
    });

    res.status(201).json(address);
  } catch (error) {
    console.error("Create address error:", error);
    res.status(500).json({ error: "فشل حفظ العنوان" });
  }
});

// 9. حذف عنوان
router.delete("/addresses/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.userAddress.deleteMany({
      where: { id, userId: req.user!.userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ error: "فشل حذف العنوان" });
  }
});

// 10. تعديل بيانات البروفايل (الاسم)
router.put("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "الرجاء إدخال الاسم" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name: name.trim() },
      select: { id: true, name: true, phone: true, role: true, loyaltyPoints: true, walletBalance: true },
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "فشل تحديث البيانات الشخصية" });
  }
});

// 11. جلب بيانات المحفظة الجامعية ونقاط الولاء وسجل المكافآت
router.get("/wallet", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        walletBalance: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const rewardHistory = await prisma.order.findMany({
      where: {
        userId,
        OR: [{ pointsEarned: { gt: 0 } }, { walletDiscount: { gt: 0 } }],
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        pointsEarned: true,
        walletDiscount: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const loyaltySettings = await getLoyaltySettings();

    res.json({
      loyaltyPoints: user.loyaltyPoints,
      walletBalance: user.walletBalance,
      history: rewardHistory,
      settings: loyaltySettings,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل جلب بيانات المحفظة ونقاط الولاء" });
  }
});

// 12. تحويل نقاط الولاء إلى رصيد نقدي في المحفظة الجامعية حسب نسبة الاستبدال المحددة من الإدارة
router.post("/wallet/convert-points", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const loyaltySettings = await getLoyaltySettings();
    if (!loyaltySettings.enabled) {
      res.status(400).json({ error: "نظام استبدال نقاط الولاء غير مفعّل حالياً من قِبل إدارة المنظومة" });
      return;
    }

    if (user.loyaltyPoints < loyaltySettings.minPointsToRedeem) {
      res.status(400).json({ 
        error: `الحد الأدنى لاستبدال النقاط هو ${loyaltySettings.minPointsToRedeem} نقطة (رصيدك الحالي: ${user.loyaltyPoints} نقطة)` 
      });
      return;
    }

    const requestedPoints = req.body.points ? parseInt(req.body.points) : user.loyaltyPoints;
    const pointsToConvert = Math.min(user.loyaltyPoints, Math.max(0, requestedPoints || 0));

    if (pointsToConvert < loyaltySettings.minPointsToRedeem) {
      res.status(400).json({ 
        error: `يجب استبدال ${loyaltySettings.minPointsToRedeem} نقطة كحد أدنى في العملية الواحدة` 
      });
      return;
    }

    // حساب المبلغ المضاف بدقة بالجنيه حسب نسبة الاستبدال المحددة في لوحة الإدارة
    const cashAdded = Math.round(pointsToConvert * loyaltySettings.pointsRedemptionRate * 100) / 100;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({ where: { id: userId } });
      if (!freshUser) {
        throw new Error("المستخدم غير موجود");
      }
      if (freshUser.loyaltyPoints < pointsToConvert) {
        throw new Error("رصيد نقاط الولاء غير كافٍ لإتمام عملية الاستبدال");
      }
      return await tx.user.update({
        where: { id: userId },
        data: {
          loyaltyPoints: { decrement: pointsToConvert },
          walletBalance: { increment: cashAdded },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          loyaltyPoints: true,
          walletBalance: true,
        },
      });
    });

    res.json({
      success: true,
      message: `تم تحويل ${pointsToConvert} نقطة ولاء بنجاح إلى ${cashAdded} ج.م في محفظتك الجامعية! 🎉`,
      convertedPoints: pointsToConvert,
      cashAdded,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Convert points error:", error);
    res.status(500).json({ error: "فشل تحويل نقاط الولاء إلى المحفظة" });
  }
});

export default router;
