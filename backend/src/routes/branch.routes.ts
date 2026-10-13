import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateToken, authenticateBranch, AuthRequest } from "../middleware/auth.js";
import { notifyOrderStatusChanged, notifyBranchStatusChanged, notifyDriverAssigned } from "../sockets/socketManager.js";

const router = Router();

// 1. تسجيل دخول تطبيق الديسكتوب الخاص بالفرع
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    const branchUser = await prisma.branchUser.findUnique({
      where: { username: username.trim() },
      include: { branch: true },
    });

    if (!branchUser) {
      res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
      return;
    }

    if (!branchUser.branch.isActive) {
      res.status(403).json({ error: "هذا الفرع موقوف حالياً من قِبل إدارة المنظومة" });
      return;
    }

    const isMatch = await bcrypt.compare(password, branchUser.password);
    if (!isMatch) {
      res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
      return;
    }

    const token = generateToken({
      branchUserId: branchUser.id,
      branchId: branchUser.branchId,
      username: branchUser.username,
    });

    res.json({
      success: true,
      token,
      branch: branchUser.branch,
    });
  } catch (error) {
    console.error("Branch login error:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل دخول الفرع" });
  }
});

// المسارات التالية خاصة بالفرع فقط
router.use(authenticateBranch);

// 2. الملف الشخصي للفرع وإعداداته
router.get("/profile", async (req: AuthRequest, res: Response) => {
  try {
    let branch = await prisma.branch.findUnique({
      where: { id: req.branch!.branchId },
      include: { paymentConfig: true, deliveryZones: true },
    });
    if (!branch) {
      res.status(404).json({ error: "الفرع غير موجود" });
      return;
    }

    // إذا انتهت مدة الإغلاق المؤقت، نعيد الفتح تلقائياً
    if (branch.operationalStatus === "BUSY" && branch.closedUntil && new Date() >= branch.closedUntil) {
      branch = await prisma.branch.update({
        where: { id: branch.id },
        data: {
          operationalStatus: "OPEN",
          closedUntil: null,
          closingReason: null,
        },
        include: { paymentConfig: true, deliveryZones: true },
      });
      notifyBranchStatusChanged(branch.id, {
        operationalStatus: "OPEN",
        closedUntil: null,
        closingReason: null,
      });
    }

    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع بيانات الفرع" });
  }
});

// 2.5 تحديث حالة عمل الفرع (مفتوح / مغلق مؤقتاً / مغلق)
router.put("/operational-status", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { status, durationMinutes, reason } = req.body;

    if (!status || !["OPEN", "BUSY", "CLOSED"].includes(status)) {
      res.status(400).json({ error: "حالة العمل غير صحيحة، يجب أن تكون OPEN أو BUSY أو CLOSED" });
      return;
    }

    let closedUntil: Date | null = null;
    let closingReason: string | null = reason || null;

    if (status === "BUSY") {
      const mins = durationMinutes && Number(durationMinutes) > 0 ? Number(durationMinutes) : 30;
      closedUntil = new Date(Date.now() + mins * 60 * 1000);
      closingReason = reason || `ضغط طلبات - فترة راحة وتجهيز لمدة ${mins} دقيقة`;
    } else if (status === "CLOSED") {
      closingReason = reason || "المطعم مغلق حالياً";
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        operationalStatus: status,
        closedUntil,
        closingReason,
      },
      include: { paymentConfig: true, deliveryZones: true },
    });

    // إشعار كافة العملاء والديسكتوب عبر Socket.io لحظياً
    notifyBranchStatusChanged(branchId, {
      operationalStatus: status,
      closedUntil,
      closingReason,
    });

    res.json({
      success: true,
      branch: updated,
    });
  } catch (error) {
    console.error("Update operational status error:", error);
    res.status(500).json({ error: "فشل تحديث حالة عمل الفرع" });
  }
});

// 2.6 تعديل بيانات الفرع التشغيلية (الاسم، الهاتف، الموقع، رسوم التوصيل، التوصيل والاستلام)
router.put("/details", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { name, phone, address, deliveryFee, allowDelivery, allowPickup, logoUrl, deliveryType } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "اسم المطعم مطلوب" });
      return;
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        name: name.trim(),
        phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
        address: address !== undefined ? (address ? address.trim() : null) : undefined,
        logoUrl: logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : undefined,
        deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : undefined,
        deliveryType: deliveryType !== undefined ? String(deliveryType) : undefined,
        allowDelivery: allowDelivery !== undefined ? Boolean(allowDelivery) : undefined,
        allowPickup: allowPickup !== undefined ? Boolean(allowPickup) : undefined,
      },
      include: { paymentConfig: true, deliveryZones: true },
    });

    res.json({ success: true, branch: updated });
  } catch (error) {
    console.error("Update branch details error:", error);
    res.status(500).json({ error: "فشل تحديث بيانات الفرع" });
  }
});

// 2.65 جلب مناطق التوصيل المخصصة للفرع
router.get("/delivery-zones", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const zones = await prisma.branchDeliveryZone.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع مناطق التوصيل" });
  }
});

// 2.66 إضافة منطقة توصيل جديدة للفرع
router.post("/delivery-zones", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { name, fee } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "اسم المنطقة أو الكلية مطلوب" });
      return;
    }

    const zone = await prisma.branchDeliveryZone.create({
      data: {
        branchId,
        name: name.trim(),
        fee: parseFloat(fee) || 10.0,
      },
    });

    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ error: "فشل إضافة منطقة التوصيل" });
  }
});

// 2.67 حذف منطقة توصيل
router.delete("/delivery-zones/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;
    await prisma.branchDeliveryZone.deleteMany({
      where: { id, branchId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف منطقة التوصيل" });
  }
});

// 2.7 تعديل طرق الدفع الخاصة بالفرع
router.put("/payment-methods", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const {
      cashEnabled,
      vodafoneCashEnabled,
      vodafoneCashNumber,
      instapayEnabled,
      instapayHandle,
      cardEnabled,
    } = req.body;

    const updatedConfig = await prisma.branchPaymentConfig.upsert({
      where: { branchId },
      update: {
        cashEnabled: cashEnabled !== undefined ? Boolean(cashEnabled) : undefined,
        vodafoneCashEnabled: vodafoneCashEnabled !== undefined ? Boolean(vodafoneCashEnabled) : undefined,
        vodafoneCashNumber: vodafoneCashNumber !== undefined ? (vodafoneCashNumber ? vodafoneCashNumber.trim() : null) : undefined,
        instapayEnabled: instapayEnabled !== undefined ? Boolean(instapayEnabled) : undefined,
        instapayHandle: instapayHandle !== undefined ? (instapayHandle ? instapayHandle.trim() : null) : undefined,
        cardEnabled: cardEnabled !== undefined ? Boolean(cardEnabled) : undefined,
      },
      create: {
        branchId,
        cashEnabled: cashEnabled !== undefined ? Boolean(cashEnabled) : true,
        vodafoneCashEnabled: vodafoneCashEnabled !== undefined ? Boolean(vodafoneCashEnabled) : false,
        vodafoneCashNumber: vodafoneCashNumber ? vodafoneCashNumber.trim() : null,
        instapayEnabled: instapayEnabled !== undefined ? Boolean(instapayEnabled) : false,
        instapayHandle: instapayHandle ? instapayHandle.trim() : null,
        cardEnabled: cardEnabled !== undefined ? Boolean(cardEnabled) : false,
      },
    });

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { paymentConfig: true },
    });

    res.json({ success: true, paymentConfig: updatedConfig, branch });
  } catch (error) {
    console.error("Update branch payment methods error:", error);
    res.status(500).json({ error: "فشل تحديث طرق الدفع الخاصة بالفرع" });
  }
});

// 3. جلب المنيو الكامل للفرع (الأقسام، الأصناف، الإضافات)
router.get("/menu", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const now = new Date();

    // إعادة تفعيل الأصناف والإضافات التي انتهت مدة نفادها المؤقت تلقائياً
    await prisma.menuItem.updateMany({
      where: {
        branchId,
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
        group: { branchId },
        isAvailable: false,
        unavailableUntil: { not: null, lte: now },
      },
      data: {
        isAvailable: true,
        unavailableUntil: null,
      },
    });

    const categories = await prisma.menuCategory.findMany({
      where: { branchId },
      include: {
        items: {
          include: {
            sizes: true,
            modifierGroupLinks: {
              include: {
                group: {
                  include: { options: true },
                },
              },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    const modifierGroups = await prisma.modifierGroup.findMany({
      where: { branchId },
      include: { options: true },
    });

    res.json({ categories, modifierGroups });
  } catch (error) {
    console.error("Get branch menu error:", error);
    res.status(500).json({ error: "فشل استرجاع المنيو" });
  }
});

// 4. إنشاء قسم منيو جديد
router.post("/categories", async (req: AuthRequest, res: Response) => {
  try {
    const { name, displayOrder } = req.body;
    if (!name) {
      res.status(400).json({ error: "اسم القسم مطلوب" });
      return;
    }

    const category = await prisma.menuCategory.create({
      data: {
        branchId: req.branch!.branchId,
        name: name.trim(),
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : 0,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: "فشل إنشاء قسم المنيو" });
  }
});

// 5. تعديل قسم منيو
router.put("/categories/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, displayOrder } = req.body;
    const branchId = req.branch!.branchId;

    const existing = await prisma.menuCategory.findFirst({
      where: { id, branchId },
    });
    if (!existing) {
      res.status(404).json({ error: "قسم المنيو غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const updated = await prisma.menuCategory.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "فشل تعديل قسم المنيو" });
  }
});

// 6. حذف قسم منيو
router.delete("/categories/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;

    const deleted = await prisma.menuCategory.deleteMany({
      where: { id, branchId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "القسم غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف القسم" });
  }
});

// 7. إضافة صنف جديد مع الأحجام وربط مجموعات الإضافات
router.post("/items", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const {
      categoryId,
      name,
      description,
      basePrice,
      imageUrl,
      comboItems,
      sizes, // [{ name: "كبير", price: 50 }]
      modifierGroupIds, // ["group-uuid-1", "group-uuid-2"]
    } = req.body;

    if (!categoryId || !name || basePrice === undefined) {
      res.status(400).json({ error: "البيانات الأساسية للصنف غير مكتملة" });
      return;
    }

    const serializedCombos =
      comboItems !== undefined
        ? typeof comboItems === "string"
          ? comboItems
          : JSON.stringify(comboItems)
        : null;

    const item = await prisma.menuItem.create({
      data: {
        branchId,
        categoryId,
        name: name.trim(),
        description: description ? description.trim() : null,
        basePrice: parseFloat(basePrice),
        imageUrl: imageUrl || null,
        comboItems: serializedCombos,
        isAvailable: true,
        sizes: sizes && Array.isArray(sizes) && sizes.length > 0 ? {
          create: sizes.map((s: any) => ({
            name: s.name.trim(),
            price: parseFloat(s.price),
          })),
        } : undefined,
        modifierGroupLinks: modifierGroupIds && Array.isArray(modifierGroupIds) ? {
          create: modifierGroupIds.map((groupId: string) => ({
            groupId,
          })),
        } : undefined,
      },
      include: {
        sizes: true,
        modifierGroupLinks: {
          include: {
            group: {
              include: { options: true },
            },
          },
        },
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ error: "فشل إضافة الصنف" });
  }
});

// 8. تعديل صنف
router.put("/items/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;
    const { categoryId, name, description, basePrice, imageUrl, isAvailable, comboItems, sizes } = req.body;

    const existing = await prisma.menuItem.findFirst({
      where: { id, branchId },
    });
    if (!existing) {
      res.status(404).json({ error: "الصنف غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const serializedCombos =
      comboItems !== undefined
        ? comboItems === null
          ? null
          : typeof comboItems === "string"
          ? comboItems
          : JSON.stringify(comboItems)
        : undefined;

    if (sizes && Array.isArray(sizes)) {
      await prisma.itemSize.deleteMany({ where: { itemId: id } });
      if (sizes.length > 0) {
        await prisma.itemSize.createMany({
          data: sizes.map((s: any) => ({
            itemId: id,
            name: s.name.trim(),
            price: parseFloat(s.price),
          })),
        });
      }
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        categoryId: categoryId || undefined,
        name: name ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        basePrice: basePrice !== undefined ? parseFloat(basePrice) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        comboItems: serializedCombos,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
      },
      include: {
        sizes: true,
        modifierGroupLinks: {
          include: {
            group: { include: { options: true } },
          },
        },
      },
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "فشل تعديل الصنف" });
  }
});

// 9. تغيير حالة توفر الصنف (زر سريع: متوفر / غير متوفر / نفد لفترة)
router.put("/items/:id/availability", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;
    const { isAvailable, durationMinutes } = req.body;

    const existing = await prisma.menuItem.findFirst({
      where: { id, branchId },
    });
    if (!existing) {
      res.status(404).json({ error: "الصنف غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const avail = Boolean(isAvailable);
    const unavailableUntil = !avail && durationMinutes && Number(durationMinutes) > 0
      ? new Date(Date.now() + Number(durationMinutes) * 60 * 1000)
      : null;

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        isAvailable: avail,
        unavailableUntil,
      },
    });

    res.json({ success: true, item: updated });
  } catch (error) {
    res.status(500).json({ error: "فشل تعديل حالة توفر الصنف" });
  }
});

// 10. حذف صنف
router.delete("/items/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;

    const deleted = await prisma.menuItem.deleteMany({
      where: { id, branchId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "الصنف غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف الصنف" });
  }
});

// 11. إضافة مجموعة إضافات (Modifier Group)
router.post("/modifier-groups", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { title, isRequired, minSelection, maxSelection, options } = req.body;

    if (!title) {
      res.status(400).json({ error: "عنوان مجموعة الإضافات مطلوب (مثل: صوصات إضافية)" });
      return;
    }

    const group = await prisma.modifierGroup.create({
      data: {
        branchId,
        title: title.trim(),
        isRequired: Boolean(isRequired),
        minSelection: minSelection !== undefined ? parseInt(minSelection) : 0,
        maxSelection: maxSelection !== undefined ? parseInt(maxSelection) : 1,
        options: options && Array.isArray(options) ? {
          create: options.map((opt: any) => ({
            name: opt.name.trim(),
            price: opt.price !== undefined ? parseFloat(opt.price) : 0,
            isAvailable: true,
          })),
        } : undefined,
      },
      include: { options: true },
    });

    res.status(201).json(group);
  } catch (error) {
    console.error("Create modifier group error:", error);
    res.status(500).json({ error: "فشل إنشاء مجموعة الإضافات" });
  }
});

// 12. إضافة خيار جديد داخل مجموعة إضافات
router.post("/modifier-groups/:groupId/options", async (req: AuthRequest, res: Response) => {
  try {
    const groupId = req.params.groupId as string;
    const { name, price } = req.body;

    if (!name) {
      res.status(400).json({ error: "اسم الإضافة مطلوب" });
      return;
    }

    const option = await prisma.modifierOption.create({
      data: {
        groupId,
        name: name.trim(),
        price: price !== undefined ? parseFloat(price) : 0,
        isAvailable: true,
      },
    });

    res.status(201).json(option);
  } catch (error) {
    res.status(500).json({ error: "فشل إضافة خيار الإضافة" });
  }
});

// 13. تعديل أو تغيير توفر خيار إضافة
router.put("/modifier-options/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, price, isAvailable } = req.body;

    const option = await prisma.modifierOption.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
      },
    });

    res.json(option);
  } catch (error) {
    res.status(500).json({ error: "فشل تعديل خيار الإضافة" });
  }
});

// 14. حذف مجموعة إضافات
router.delete("/modifier-groups/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;
    const deleted = await prisma.modifierGroup.deleteMany({
      where: { id, branchId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "مجموعة الإضافات غير موجودة أو لا تتبع هذا الفرع" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف مجموعة الإضافات" });
  }
});

// 15. ربط/فك ربط مجموعات الإضافات بصنف معين
router.post("/items/:id/link-modifiers", async (req: AuthRequest, res: Response) => {
  try {
    const itemId = req.params.id as string;
    const { modifierGroupIds } = req.body; // مصفوفة من الـ groupIds

    if (!Array.isArray(modifierGroupIds)) {
      res.status(400).json({ error: "يجب تمرير مصفوفة modifierGroupIds" });
      return;
    }

    // إزالة الروابط القديمة
    await prisma.itemModifierGroupLink.deleteMany({
      where: { itemId },
    });

    // إنشاء الروابط الجديدة
    if (modifierGroupIds.length > 0) {
      await prisma.itemModifierGroupLink.createMany({
        data: modifierGroupIds.map((groupId: string) => ({
          itemId,
          groupId,
        })),
      });
    }

    const updatedItem = await prisma.menuItem.findUnique({
      where: { id: itemId },
      include: {
        sizes: true,
        modifierGroupLinks: {
          include: {
            group: { include: { options: true } },
          },
        },
      },
    });

    res.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error("Link modifiers error:", error);
    res.status(500).json({ error: "فشل ربط الإضافات بالصنف" });
  }
});

// 16. جلب طلبات الفرع (شامل عدد طلبات العميل وملاحظات المطعم وحالة الحظر)
router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { status } = req.query;

    const orders = await prisma.order.findMany({
      where: {
        branchId,
        status: status ? String(status) : undefined,
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
        driver: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (error) {
    console.error("Get branch orders error:", error);
    res.status(500).json({ error: "فشل استرجاع طلبات الفرع" });
  }
});

// 16.5 تحديث ملاحظة العميل أو إيقاف/تفعيل حسابه من شاشة المطعم
router.put("/customers/:userId/crm", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { restaurantNotes, isBlocked } = req.body;

    const updateData: any = {};
    if (restaurantNotes !== undefined) {
      updateData.restaurantNotes = restaurantNotes ? String(restaurantNotes).trim() : null;
    }
    if (isBlocked !== undefined) {
      updateData.isBlocked = Boolean(isBlocked);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Update customer CRM error:", error);
    res.status(500).json({ error: "فشل تحديث بيانات وملاحظات العميل" });
  }
});

// 17. تحديث حالة الطلب من الديسكتوب (قبول، تحضير، جاهز، مكتمل، رفض)
router.put("/orders/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, estimatedMinutes } = req.body; // "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED"
    const branchId = req.branch!.branchId;

    const validStatuses = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "حالة الطلب غير صالحة" });
      return;
    }

    const existingOrder = await prisma.order.findFirst({
      where: { id, branchId },
    });
    if (!existingOrder) {
      res.status(404).json({ error: "الطلب غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const updateData: any = { status };
    const now = new Date();

    if (estimatedMinutes !== undefined && Number(estimatedMinutes) > 0) {
      updateData.estimatedMinutes = Number(estimatedMinutes);
    }

    if (status === "ACCEPTED" || status === "PREPARING") {
      if (!existingOrder.acceptedAt) {
        updateData.acceptedAt = now;
      }
      if (!existingOrder.preparingAt) {
        updateData.preparingAt = now;
      }
    } else if (status === "READY") {
      if (!existingOrder.readyAt) {
        updateData.readyAt = now;
      }
    } else if (status === "COMPLETED") {
      if (!existingOrder.completedAt) {
        updateData.completedAt = now;
      }
    } else if (status === "REJECTED") {
      if (!existingOrder.cancelledAt) {
        updateData.cancelledAt = now;
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
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
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    // إذا تم رفض/إلغاء الطلب للمرة الأولى، نسترد رصيد المحفظة الجامعية للطالب ونسحب النقاط المضافة
    if (status === "REJECTED" && existingOrder.status !== "REJECTED") {
      const targetUser = await prisma.user.findUnique({ where: { id: existingOrder.userId } });
      if (targetUser) {
        const refundedWallet = (targetUser.walletBalance || 0) + (existingOrder.walletDiscount || 0);
        const revertedPoints = Math.max(0, (targetUser.loyaltyPoints || 0) - (existingOrder.pointsEarned || 0));
        await prisma.user.update({
          where: { id: existingOrder.userId },
          data: {
            walletBalance: refundedWallet,
            loyaltyPoints: revertedPoints,
          },
        }).catch(() => {});
      }

      if (existingOrder.promoCode) {
        const promo = await prisma.promoCode.findUnique({ where: { code: existingOrder.promoCode } });
        if (promo && promo.usedCount > 0) {
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { decrement: 1 } },
          }).catch(() => {});
        }
      }
    }

    // إشعار لحظي عبر Socket.io للعميل والديسكتوب والطيار
    notifyOrderStatusChanged(id, branchId, updatedOrder, updatedOrder.driverId || undefined);

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "فشل تحديث حالة الطلب" });
  }
});

// 18. جلب قائمة كباتن التوصيل (الطيارين) التابعين للفرع
router.get("/drivers", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const drivers = await prisma.deliveryDriver.findMany({
      where: { branchId },
      select: {
        id: true,
        name: true,
        phone: true,
        username: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع قائمة الطيارين" });
  }
});

// 19. إضافة كابتن توصيل (طيار) جديد للفرع
router.post("/drivers", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { name, phone, username, password } = req.body;

    if (!name || !phone || !username || !password) {
      res.status(400).json({ error: "جميع بيانات الطيار مطلوبة (الاسم، الهاتف، اسم المستخدم، كلمة المرور)" });
      return;
    }

    const existing = await prisma.deliveryDriver.findUnique({
      where: { username: username.trim() },
    });
    if (existing) {
      res.status(400).json({ error: "اسم المستخدم الخاص بالطيار مسجل بالفعل، يرجى اختيار اسم آخر" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const driver = await prisma.deliveryDriver.create({
      data: {
        branchId,
        name: name.trim(),
        phone: phone.trim(),
        username: username.trim(),
        password: hashedPassword,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        username: driver.username,
        isActive: driver.isActive,
      },
    });
  } catch (error) {
    console.error("Create driver error:", error);
    res.status(500).json({ error: "فشل إضافة كابتن التوصيل" });
  }
});

// 20. تعديل بيانات أو تفعيل/إيقاف طيار
router.put("/drivers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const id = req.params.id as string;
    const { name, phone, password, isActive } = req.body;

    const driver = await prisma.deliveryDriver.findFirst({
      where: { id, branchId },
    });
    if (!driver) {
      res.status(404).json({ error: "كابتن التوصيل غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.deliveryDriver.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        username: true,
        isActive: true,
      },
    });

    res.json({ success: true, driver: updated });
  } catch (error) {
    res.status(500).json({ error: "فشل تعديل بيانات الطيار" });
  }
});

// 21. حذف طيار
router.delete("/drivers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const id = req.params.id as string;

    await prisma.deliveryDriver.deleteMany({
      where: { id, branchId },
    });

    res.json({ success: true, message: "تم حذف الطيار بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف الطيار" });
  }
});

// 22. إسناد الطلب لطيار محدد (Assign Driver to Order)
router.put("/orders/:id/assign-driver", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const id = req.params.id as string;
    const { driverId } = req.body;

    const order = await prisma.order.findFirst({
      where: { id, branchId },
    });
    if (!order) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    let assignedDriver: any = null;
    if (driverId) {
      assignedDriver = await prisma.deliveryDriver.findFirst({
        where: { id: driverId, branchId, isActive: true },
      });
      if (!assignedDriver) {
        res.status(400).json({ error: "الطيار المحدد غير متاح أو لا يتبع هذا الفرع" });
        return;
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        driverId: driverId || null,
        driverAssignedAt: driverId ? new Date() : null,
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
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    // إشعار الطيار المعين عبر Socket.io بصوت تنبيه فوري
    if (driverId) {
      notifyDriverAssigned(driverId, updated);
    }
    // إشعار العميل والديسكتوب
    notifyOrderStatusChanged(id, branchId, updated, driverId);

    res.json({ success: true, order: updated });
  } catch (error) {
    console.error("Assign driver error:", error);
    res.status(500).json({ error: "فشل إسناد الطلب للطيار" });
  }
});

// 23. تعديل وقت التنبيه المسبق للطلبات المحجوزة (Lead Time)
router.put("/settings/schedule-lead", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { scheduledLeadMins } = req.body;

    const mins = Math.max(5, parseInt(scheduledLeadMins) || 20);
    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: { scheduledLeadMins: mins },
    });

    res.json({ success: true, scheduledLeadMins: updated.scheduledLeadMins });
  } catch (error) {
    res.status(500).json({ error: "فشل تحديث وقت الإشعار المسبق" });
  }
});

// 24. تعديل مواعيد العمل الرسمية للفرع
router.put("/settings/working-hours", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { openingTime, closingTime, workingDays } = req.body;

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: {
        openingTime: openingTime ? String(openingTime).trim() : "08:00",
        closingTime: closingTime ? String(closingTime).trim() : "22:00",
        workingDays: workingDays ? String(workingDays).trim() : "SUN,MON,TUE,WED,THU,FRI,SAT",
      },
    });

    res.json({
      success: true,
      openingTime: updated.openingTime,
      closingTime: updated.closingTime,
      workingDays: updated.workingDays,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل تحديث مواعيد العمل" });
  }
});

// 25. إيقاف / تشغيل سريع لتوفر الأصناف أو الإضافات (مع دعم النفاد المؤقت لفترة محددة)
router.put("/quick-toggle-stock", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const { type, id, isAvailable, durationMinutes } = req.body;
    const normalizedType = String(type || "").toUpperCase();
    const avail = Boolean(isAvailable);
    const unavailableUntil = !avail && durationMinutes && Number(durationMinutes) > 0
      ? new Date(Date.now() + Number(durationMinutes) * 60 * 1000)
      : null;

    if (normalizedType === "ITEM") {
      const item = await prisma.menuItem.findFirst({
        where: { id, branchId },
      });
      if (!item) {
        res.status(404).json({ error: "الصنف غير موجود" });
        return;
      }
      const updated = await prisma.menuItem.update({
        where: { id },
        data: {
          isAvailable: avail,
          unavailableUntil,
        },
      });
      res.json({ success: true, item: updated });
    } else if (normalizedType === "MODIFIER") {
      const option = await prisma.modifierOption.findFirst({
        where: { id, group: { branchId } },
      });
      if (!option) {
        res.status(404).json({ error: "الإضافة غير موجودة" });
        return;
      }
      const updated = await prisma.modifierOption.update({
        where: { id },
        data: {
          isAvailable: avail,
          unavailableUntil,
        },
      });
      res.json({ success: true, modifierOption: updated });
    } else {
      res.status(400).json({ error: "نوع الصنف غير محدد" });
    }
  } catch (error) {
    console.error("Quick toggle stock error:", error);
    res.status(500).json({ error: "فشل تعديل حالة التوفر" });
  }
});

export default router;
