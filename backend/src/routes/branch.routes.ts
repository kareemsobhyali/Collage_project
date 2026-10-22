import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { exec } from "child_process";
import prisma from "../prisma.js";
import { generateToken, authenticateBranch, AuthRequest } from "../middleware/auth.js";
import { 
  notifyOrderStatusChanged, 
  notifyBranchStatusChanged, 
  notifyDriverAssigned,
  notifyBranchMenuChanged,
  notifyMenuItemAvailabilityChanged,
  notifyDriverUnassigned,
  latestDriverLocations
} from "../sockets/socketManager.js";
import { awardLoyaltyPointsIfCompleted, sendOrderCancellationWhatsAppAlert, getRestaurantLocationSettings } from "../services/settings.service.js";
import { getDriverBranchConfig, canDriverServeBranch, setDriverBranchConfig, deleteDriverBranchConfig, isOrderAcceptedByDriver, clearOrderAcceptedByDriver } from "../services/driver.service.js";
import { restoreFlashDealsForOrder } from "../services/flashDeal.service.js";


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

// استعلام طابعات الويندوز المتصلة بالجهاز
router.get("/system-printers", async (_req: AuthRequest, res: Response) => {
  if (process.platform !== "win32") {
    return res.json({ success: true, platform: process.platform, printers: [] });
  }

  exec('powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json"', { timeout: 4000 }, (err, stdout) => {
    if (err || !stdout || !stdout.trim()) {
      return res.json({ success: true, platform: "win32", printers: [] });
    }
    try {
      let parsed = JSON.parse(stdout);
      if (!Array.isArray(parsed)) parsed = [parsed];
      const printers = parsed.map((p: any) => ({
        name: p.Name,
        isDefault: Boolean(p.Default),
        portName: p.PortName,
      }));
      return res.json({ success: true, platform: "win32", printers });
    } catch (_e) {
      return res.json({ success: true, platform: "win32", printers: [] });
    }
  });
});

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

    notifyBranchStatusChanged(branchId, updated);

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

    notifyBranchStatusChanged(branchId, { paymentConfig: updatedConfig });

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

    notifyBranchMenuChanged(req.branch!.branchId);

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

    notifyBranchMenuChanged(branchId);

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

    const existingCat = await prisma.menuCategory.findFirst({
      where: { id, branchId },
      include: { items: { select: { id: true } } },
    });
    if (!existingCat) {
      res.status(404).json({ error: "القسم غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const itemIds = existingCat.items.map((it) => it.id);
    if (itemIds.length > 0) {
      await prisma.orderItem.updateMany({
        where: { menuItemId: { in: itemIds } },
        data: { menuItemId: null },
      });
    }

    await prisma.menuCategory.delete({
      where: { id },
    });

    notifyBranchMenuChanged(branchId);

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

    // التحقق من ملكية القسم للفرع
    const validCat = await prisma.menuCategory.findFirst({
      where: { id: String(categoryId), branchId },
    });
    if (!validCat) {
      res.status(403).json({ error: "القسم المحدد غير صالح أو لا يتبع هذا الفرع" });
      return;
    }

    // التحقق من ملكية مجموعات الإضافات للفرع
    let validModifierGroupIds: string[] = [];
    if (modifierGroupIds && Array.isArray(modifierGroupIds) && modifierGroupIds.length > 0) {
      const ownedGroups = await prisma.modifierGroup.findMany({
        where: { id: { in: modifierGroupIds.map(String) }, branchId },
        select: { id: true },
      });
      validModifierGroupIds = ownedGroups.map((g) => g.id);
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
        modifierGroupLinks: validModifierGroupIds.length > 0 ? {
          create: validModifierGroupIds.map((groupId: string) => ({
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

    notifyBranchMenuChanged(branchId);

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

    if (categoryId) {
      const validCat = await prisma.menuCategory.findFirst({
        where: { id: String(categoryId), branchId },
      });
      if (!validCat) {
        res.status(403).json({ error: "القسم المحدد غير صالح أو لا يتبع هذا الفرع" });
        return;
      }
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

    notifyBranchMenuChanged(branchId);

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

    notifyMenuItemAvailabilityChanged(branchId, {
      type: "ITEM",
      id,
      isAvailable: avail,
      unavailableUntil,
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

    const existing = await prisma.menuItem.findFirst({
      where: { id, branchId },
    });
    if (!existing) {
      res.status(404).json({ error: "الصنف غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    await prisma.orderItem.updateMany({
      where: { menuItemId: id },
      data: { menuItemId: null },
    });

    await prisma.menuItem.delete({
      where: { id },
    });

    notifyBranchMenuChanged(branchId);

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

    notifyBranchMenuChanged(branchId);

    res.status(201).json(group);
  } catch (error) {
    console.error("Create modifier group error:", error);
    res.status(500).json({ error: "فشل إنشاء مجموعة الإضافات" });
  }
});

// 11.1 تعديل مجموعة إضافات (الاسم والشروط)
router.put("/modifier-groups/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;
    const { title, isRequired, minSelection, maxSelection } = req.body;

    const existingGroup = await prisma.modifierGroup.findFirst({
      where: { id, branchId },
    });
    if (!existingGroup) {
      res.status(404).json({ error: "مجموعة الإضافات غير موجودة أو لا تتبع هذا الفرع" });
      return;
    }

    const updated = await prisma.modifierGroup.update({
      where: { id },
      data: {
        title: title ? title.trim() : undefined,
        isRequired: isRequired !== undefined ? Boolean(isRequired) : undefined,
        minSelection: minSelection !== undefined ? parseInt(minSelection, 10) : undefined,
        maxSelection: maxSelection !== undefined ? parseInt(maxSelection, 10) : undefined,
      },
      include: { options: true },
    });

    notifyBranchMenuChanged(branchId);

    res.json(updated);
  } catch (error) {
    console.error("Update modifier group error:", error);
    res.status(500).json({ error: "فشل تعديل مجموعة الإضافات" });
  }
});

// 12. إضافة خيار جديد داخل مجموعة إضافات
router.post("/modifier-groups/:groupId/options", async (req: AuthRequest, res: Response) => {
  try {
    const groupId = req.params.groupId as string;
    const branchId = req.branch!.branchId;
    const { name, price } = req.body;

    if (!name) {
      res.status(400).json({ error: "اسم الإضافة مطلوب" });
      return;
    }

    const group = await prisma.modifierGroup.findFirst({
      where: { id: groupId, branchId },
    });
    if (!group) {
      res.status(404).json({ error: "مجموعة الإضافات غير موجودة أو لا تتبع هذا الفرع" });
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

    notifyBranchMenuChanged(branchId);

    res.status(201).json(option);
  } catch (error) {
    res.status(500).json({ error: "فشل إضافة خيار الإضافة" });
  }
});

// 13. تعديل أو تغيير توفر خيار إضافة
router.put("/modifier-options/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;
    const { name, price, isAvailable } = req.body;

    const existingOption = await prisma.modifierOption.findUnique({
      where: { id },
      include: { group: { select: { branchId: true } } },
    });
    if (!existingOption || existingOption.group.branchId !== branchId) {
      res.status(404).json({ error: "خيار الإضافة غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    const option = await prisma.modifierOption.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
      },
    });

    notifyBranchMenuChanged(branchId);

    res.json(option);
  } catch (error) {
    res.status(500).json({ error: "فشل تعديل خيار الإضافة" });
  }
});

// 13.1 حذف خيار إضافة
router.delete("/modifier-options/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const branchId = req.branch!.branchId;

    const existingOption = await prisma.modifierOption.findUnique({
      where: { id },
      include: { group: { select: { branchId: true } } },
    });
    if (!existingOption || existingOption.group.branchId !== branchId) {
      res.status(404).json({ error: "خيار الإضافة غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    await prisma.modifierOption.delete({
      where: { id },
    });

    notifyBranchMenuChanged(branchId);

    res.json({ success: true, message: "تم حذف خيار الإضافة بنجاح" });
  } catch (error) {
    console.error("Delete modifier option error:", error);
    res.status(500).json({ error: "فشل حذف خيار الإضافة" });
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

    notifyBranchMenuChanged(branchId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف مجموعة الإضافات" });
  }
});

// 15. ربط/فك ربط مجموعات الإضافات بصنف معين
router.post("/items/:id/link-modifiers", async (req: AuthRequest, res: Response) => {
  try {
    const itemId = req.params.id as string;
    const branchId = req.branch!.branchId;
    const { modifierGroupIds } = req.body; // مصفوفة من الـ groupIds

    if (!Array.isArray(modifierGroupIds)) {
      res.status(400).json({ error: "يجب تمرير مصفوفة modifierGroupIds" });
      return;
    }

    const existingItem = await prisma.menuItem.findFirst({
      where: { id: itemId, branchId },
    });
    if (!existingItem) {
      res.status(404).json({ error: "الصنف غير موجود أو لا يتبع هذا الفرع" });
      return;
    }

    let validGroupIds: string[] = [];
    if (modifierGroupIds.length > 0) {
      const ownedGroups = await prisma.modifierGroup.findMany({
        where: { id: { in: modifierGroupIds.map(String) }, branchId },
        select: { id: true },
      });
      validGroupIds = ownedGroups.map((g) => g.id);
    }

    // إزالة الروابط القديمة
    await prisma.itemModifierGroupLink.deleteMany({
      where: { itemId },
    });

    // إنشاء الروابط الجديدة
    if (validGroupIds.length > 0) {
      await prisma.itemModifierGroupLink.createMany({
        data: validGroupIds.map((groupId: string) => ({
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

    notifyBranchMenuChanged(branchId);

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

    const enrichedOrders = await Promise.all(
      orders.map(async (o) => ({
        ...o,
        isDriverAccepted: Boolean(o.driverPickedUpAt) || (o.driverId ? await isOrderAcceptedByDriver(o.id) : false),
      }))
    );

    res.json(enrichedOrders);
  } catch (error) {
    console.error("Get branch orders error:", error);
    res.status(500).json({ error: "فشل استرجاع طلبات الفرع" });
  }
});

// 16.5 تحديث ملاحظة العميل أو إيقاف/تفعيل حسابه من شاشة المطعم
router.put("/customers/:userId/crm", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const branchId = req.branch!.branchId;
    const { restaurantNotes, isBlocked } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: "حساب العميل غير موجود" });
      return;
    }

    if (targetUser.role === "SUPERADMIN") {
      res.status(403).json({ error: "غير مصرح بتعديل أو حظر حساب الإدارة العليا" });
      return;
    }

    // التحقق من أن العميل لديه طلبات سابقة لدى هذا الفرع
    const branchOrderCount = await prisma.order.count({
      where: { userId, branchId },
    });
    if (branchOrderCount === 0) {
      res.status(403).json({ error: "لا يمكن تعديل بيانات عميل لم يقم بالطلب من هذا الفرع" });
      return;
    }

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
    const { status, estimatedMinutes, reason } = req.body; // "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED"
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

    // منع تغيير حالة الطلب بعد وصوله لحالة نهائية (مكتمل أو مرفوض/ملغى) لمنع تكرار استرداد المحفظة أو النقاط
    if (existingOrder.status === "REJECTED" && status !== "REJECTED") {
      res.status(400).json({ error: "لا يمكن إعادة فتح أو تغيير حالة طلب تم إلغاؤه واسترداد قيمته مسبقاً" });
      return;
    }
    if (existingOrder.status === "COMPLETED" && status !== "COMPLETED") {
      res.status(400).json({ error: "لا يمكن تغيير حالة طلب مكتمل بالفعل" });
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
      const rawReason = (reason || req.body.reason || req.body.notes || "").trim();
      if (rawReason) {
        updateData.notes = existingOrder.notes
          ? `${existingOrder.notes} | سبب الإلغاء: ${rawReason}`
          : `سبب الإلغاء: ${rawReason}`;
      }
    }

    let updatedOrder: any;
    if (status === "REJECTED" && existingOrder.status !== "REJECTED") {
      updatedOrder = await prisma.$transaction(async (tx) => {
        // تحديث ذري مشروط بعدم كون الطلب ملغى مسبقاً لمنع التكرار المتزامن (Race Condition)
        const claim = await tx.order.updateMany({
          where: { id, branchId, status: { not: "REJECTED" } },
          data: updateData,
        });
        if (claim.count === 0) {
          throw new Error("ORDER_ALREADY_REJECTED");
        }

        // استرجاع كميات عروض الفلاش فوراً عند رفض أو إلغاء الطلب من المطعم
        await restoreFlashDealsForOrder(id, tx);

        const orderRes = await tx.order.findUniqueOrThrow({
          where: { id },
          include: {
            items: true,
            branch: {
              select: { id: true, name: true, phone: true, address: true, logoUrl: true },
            },
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

        if (existingOrder.walletDiscount > 0 || (existingOrder.pointsAwarded && existingOrder.pointsEarned > 0)) {
          const targetUser = await tx.user.findUnique({ where: { id: existingOrder.userId } });
          if (targetUser) {
            const refundedWallet = Number(((targetUser.walletBalance || 0) + (existingOrder.walletDiscount || 0)).toFixed(2));
            const updateUserData: any = { walletBalance: refundedWallet };
            if (existingOrder.pointsAwarded && existingOrder.pointsEarned > 0) {
              updateUserData.loyaltyPoints = Math.max(0, (targetUser.loyaltyPoints || 0) - existingOrder.pointsEarned);
            }
            await tx.user.update({
              where: { id: existingOrder.userId },
              data: updateUserData,
            });
          }
        }

        if (existingOrder.promoCode) {
          const promo = await tx.promoCode.findUnique({ where: { code: existingOrder.promoCode } });
          if (promo && promo.usedCount > 0) {
            await tx.promoCode.update({
              where: { id: promo.id },
              data: { usedCount: { decrement: 1 } },
            }).catch(() => {});
          }
        }

        return orderRes;
      });

      // إرسال تنبيه واتساب فوري لمشرفي المنظومة بأن المطعم كنسل هذا الطلب
      sendOrderCancellationWhatsAppAlert(id, (req.body.reason || req.body.notes || "").trim()).catch(() => {});
    } else {
      updatedOrder = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          branch: {
            select: { id: true, name: true, phone: true, address: true, logoUrl: true },
          },
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

      // إيداع نقاط الولاء في محفظة الطالب فقط عند اكتمال الطلب والتسليم الفعلي
      if (status === "COMPLETED") {
        await awardLoyaltyPointsIfCompleted(id);
      }
    }

    updatedOrder = {
      ...updatedOrder,
      isDriverAccepted: Boolean(updatedOrder.driverPickedUpAt) || (updatedOrder.driverId ? await isOrderAcceptedByDriver(id) : false),
    };

    // إشعار لحظي عبر Socket.io للعميل والديسكتوب والطيار
    notifyOrderStatusChanged(id, branchId, updatedOrder, updatedOrder.driverId || undefined);

    res.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    if (error?.message === "ORDER_ALREADY_REJECTED") {
      res.status(400).json({ error: "تم إلغاء هذا الطلب بالفعل" });
      return;
    }
    console.error("Update order status error:", error);
    res.status(500).json({ error: "فشل تحديث حالة الطلب" });
  }
});

function parseBranchCoordsFromAddress(address?: string | null, fallback?: { lat: number; lng: number }): { lat: number; lng: number } {
  if (address) {
    const match = address.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }
  return fallback || { lat: 30.0277, lng: 31.2105 };
}

function calcHaversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

async function findBestSmartDriverForBranch(branchId: string) {
  const [allDrivers, branch, defaultLoc, activeDriverOrders] = await Promise.all([
    prisma.deliveryDriver.findMany({
      where: { isActive: true },
      select: {
        id: true,
        branchId: true,
        name: true,
        phone: true,
        username: true,
        isActive: true,
      },
    }),
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, address: true },
    }),
    getRestaurantLocationSettings().catch(() => ({ lat: 30.0277, lng: 31.2105 })),
    prisma.order.groupBy({
      by: ["driverId"],
      where: {
        driverId: { not: null },
        status: { in: ["ACCEPTED", "PREPARING", "READY"] },
      },
      _count: { _all: true },
    }),
  ]);

  const activeCountMap = new Map<string, number>();
  for (const row of activeDriverOrders) {
    if (row.driverId) activeCountMap.set(row.driverId, row._count._all);
  }

  const branchCoords = parseBranchCoordsFromAddress(branch?.address, defaultLoc);
  const nowMs = Date.now();

  const candidates: Array<{
    driver: any;
    activeOrdersCount: number;
    distanceKm: number | null;
    hasLiveGps: boolean;
    score: number;
  }> = [];

  for (const d of allDrivers) {
    const allowed = await canDriverServeBranch(d.id, d.branchId, branchId);
    if (!allowed) continue;

    const activeOrdersCount = activeCountMap.get(d.id) || 0;
    const liveLoc = latestDriverLocations.get(d.id);
    const hasRecentGps = Boolean(liveLoc && nowMs - liveLoc.timestamp < 30 * 60 * 1000);
    const distanceKm = hasRecentGps && liveLoc
      ? Number(calcHaversineKm(branchCoords, { lat: liveLoc.lat, lng: liveLoc.lng }).toFixed(2))
      : null;

    // معادلة الترتيب الذكي:
    // 1. الأولوية القصوى للطيار المتفرغ (أقل عدد طلبات جارية)
    // 2. الأقرب مسافة بالـ GPS للمطعم
    // 3. أولوية خفيفة لطيار الفرع المباشر عند التساوي
    const branchAffinityPenalty = d.branchId === branchId ? 0 : 0.25;
    const distancePenalty = distanceKm !== null ? distanceKm : 3.5;
    const score = activeOrdersCount * 100 + distancePenalty + branchAffinityPenalty;

    candidates.push({
      driver: d,
      activeOrdersCount,
      distanceKm,
      hasLiveGps: hasRecentGps,
      score,
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || null;
}

// 18. جلب قائمة كباتن التوصيل (الطيارين) المتاحين للفرع (طياري الفرع + الطيارين العامين لكل المطاعم)
router.get("/drivers", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;

    const [allDrivers, branch, defaultLoc, activeDriverOrders] = await Promise.all([
      prisma.deliveryDriver.findMany({
        where: { isActive: true },
        select: {
          id: true,
          branchId: true,
          name: true,
          phone: true,
          username: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, address: true },
      }),
      getRestaurantLocationSettings().catch(() => ({ lat: 30.0277, lng: 31.2105 })),
      prisma.order.groupBy({
        by: ["driverId"],
        where: {
          driverId: { not: null },
          status: { in: ["ACCEPTED", "PREPARING", "READY"] },
        },
        _count: { _all: true },
      }),
    ]);

    const activeCountMap = new Map<string, number>();
    for (const row of activeDriverOrders) {
      if (row.driverId) activeCountMap.set(row.driverId, row._count._all);
    }

    const branchCoords = parseBranchCoordsFromAddress(branch?.address, defaultLoc);
    const nowMs = Date.now();

    const eligibleDrivers = [];
    for (const d of allDrivers) {
      const allowed = await canDriverServeBranch(d.id, d.branchId, branchId);
      if (allowed) {
        const config = await getDriverBranchConfig(d.id, d.branchId);
        const liveLoc = latestDriverLocations.get(d.id);
        const hasRecentGps = Boolean(liveLoc && nowMs - liveLoc.timestamp < 30 * 60 * 1000);
        const distanceKm = hasRecentGps && liveLoc
          ? Number(calcHaversineKm(branchCoords, { lat: liveLoc.lat, lng: liveLoc.lng }).toFixed(2))
          : null;

        eligibleDrivers.push({
          id: d.id,
          name: d.name,
          phone: d.phone,
          username: d.username,
          isActive: d.isActive,
          createdAt: d.createdAt,
          isAllBranches: config.isAllBranches,
          isGeneralDriver: config.isAllBranches || d.branchId !== branchId,
          activeOrdersCount: activeCountMap.get(d.id) || 0,
          distanceKm,
          hasLiveGps: hasRecentGps,
          _count: d._count,
        });
      }
    }

    res.json(eligibleDrivers);
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

    // تسجيل أن هذا الطيار مخصص لهذا الفرع
    await setDriverBranchConfig(driver.id, { isAllBranches: false, branchIds: [branchId] });

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

    const driver = await prisma.deliveryDriver.findFirst({
      where: { id, branchId },
    });
    if (!driver) {
      res.status(404).json({ error: "كابتن التوصيل غير موجود أو لا يتبع هذا الفرع (الطيار العام تتم إدارته عبر لوحة الجامعة)" });
      return;
    }

    // فك ارتباط الطلبات السابقة بالطيار لتجنب خطأ القيود الخارجية (Foreign Key)
    await prisma.order.updateMany({
      where: { driverId: id },
      data: { driverId: null },
    });

    await deleteDriverBranchConfig(id);

    await prisma.deliveryDriver.delete({
      where: { id },
    });

    res.json({ success: true, message: "تم حذف الطيار بنجاح" });
  } catch (error) {
    console.error("Delete driver error:", error);
    res.status(500).json({ error: "فشل حذف الطيار" });
  }
});

// 22. إسناد الطلب لطيار محدد أو إسناد تلقائي ذكي (Assign Driver / Smart Auto-Dispatch)
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

    if (driverId && order.status === "PENDING") {
      res.status(400).json({ error: "لا يمكن إسناد كابتن توصيل للطلب قبل قبول الطلب وتأكيده أولاً" });
      return;
    }

    let finalDriverId: string | null = driverId || null;
    let smartDispatchMeta: any = null;

    if (driverId === "AUTO") {
      const bestCandidate = await findBestSmartDriverForBranch(branchId);
      if (!bestCandidate) {
        res.status(400).json({ error: "لا يوجد كباتن توصيل نشطون متاحون حالياً لهذا الفرع" });
        return;
      }
      finalDriverId = bestCandidate.driver.id;
      smartDispatchMeta = {
        id: bestCandidate.driver.id,
        name: bestCandidate.driver.name,
        phone: bestCandidate.driver.phone,
        activeOrdersCount: bestCandidate.activeOrdersCount,
        distanceKm: bestCandidate.distanceKm,
        hasLiveGps: bestCandidate.hasLiveGps,
      };
    } else if (finalDriverId) {
      const assignedDriver = await prisma.deliveryDriver.findUnique({
        where: { id: finalDriverId },
      });
      if (!assignedDriver || !assignedDriver.isActive) {
        res.status(400).json({ error: "الطيار المحدد غير متاح حالياً" });
        return;
      }
      const allowed = await canDriverServeBranch(assignedDriver.id, assignedDriver.branchId, branchId);
      if (!allowed) {
        res.status(400).json({ error: "الطيار المحدد غير مصرح له بتوصيل طلبات هذا المطعم" });
        return;
      }
    }

    const oldDriverId = order.driverId;

    // مسح أي قبول سابق لهذا الطلب لضمان ظهور شاشة القبول/الرفض وصوت الرنين من البداية للطيار
    await clearOrderAcceptedByDriver(id);

    const rawUpdated = await prisma.order.update({
      where: { id },
      data: {
        driverId: finalDriverId,
        driverAssignedAt: finalDriverId ? new Date() : null,
        driverPickedUpAt: finalDriverId ? order.driverPickedUpAt : null,
      },
      include: {
        items: true,
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true },
        },
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

    const updated = {
      ...rawUpdated,
      isDriverAccepted: Boolean(rawUpdated.driverPickedUpAt) || (finalDriverId ? await isOrderAcceptedByDriver(id, finalDriverId) : false),
    };

    // إذا تم تغيير أو سحب الطلب من طيار قديم، نبلغه لإزالته من قائمته فوراً
    if (oldDriverId && oldDriverId !== finalDriverId) {
      notifyDriverUnassigned(oldDriverId, id);
    }

    // إشعار الطيار المعين عبر Socket.io بصوت تنبيه فوري
    if (finalDriverId) {
      notifyDriverAssigned(finalDriverId, updated);
    }
    // إشعار العميل والديسكتوب
    notifyOrderStatusChanged(id, branchId, updated, finalDriverId || undefined);

    res.json({
      success: true,
      order: updated,
      autoAssignedDriver: smartDispatchMeta,
    });
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

    notifyBranchStatusChanged(branchId, {
      openingTime: updated.openingTime,
      closingTime: updated.closingTime,
      workingDays: updated.workingDays,
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

      notifyMenuItemAvailabilityChanged(branchId, {
        type: "ITEM",
        id,
        isAvailable: avail,
        unavailableUntil,
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

      notifyMenuItemAvailabilityChanged(branchId, {
        type: "MODIFIER",
        id,
        isAvailable: avail,
        unavailableUntil,
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

// 25. جلب أو توليد رمز استلام الطلب من الطيار (Branch Return PIN)
router.get("/orders/:id/return-pin", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const id = req.params.id as string;
    const order = await prisma.order.findFirst({
      where: { id, branchId },
      include: { driver: { select: { name: true, phone: true } } },
    });
    if (!order) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const key = `branch_return_pin_${id}`;
    let record = await prisma.systemSetting.findUnique({ where: { key } });
    let pin = "";
    if (record && record.value) {
      try {
        const parsed = JSON.parse(record.value);
        pin = parsed.pin;
      } catch (_e) {}
    }
    if (!pin) {
      pin = String(Math.floor(1000 + Math.random() * 9000));
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: JSON.stringify({ pin, createdAt: new Date().toISOString() }) },
        create: { key, value: JSON.stringify({ pin, createdAt: new Date().toISOString() }) },
      });
    }

    res.json({
      success: true,
      pin,
      orderNumber: order.orderNumber,
      driverName: order.driver?.name || "الطيار",
    });
  } catch (error) {
    console.error("Get branch return pin error:", error);
    res.status(500).json({ error: "فشل توليد رمز استلام الطلب" });
  }
});

// 26. تأكيد استلام الوجبة المرتجعة من الطيار فورياً من جهة الكاشير (Confirm Return From Driver)
router.post("/orders/:id/confirm-return-from-driver", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;
    const id = req.params.id as string;
    const order = await prisma.order.findFirst({
      where: { id, branchId },
      include: { driver: { select: { name: true } } },
    });
    if (!order) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const oldDriverId = order.driverId;
    const driverName = order.driver?.name || "الطيار";

    await clearOrderAcceptedByDriver(id);
    await prisma.systemSetting.deleteMany({ where: { key: `branch_return_pin_${id}` } });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        driverId: null,
        driverAssignedAt: null,
        driverPickedUpAt: null,
        status: "READY", // يعود بالمطبخ جاهزاً لإعادة إسناده لكابتن آخر
        notes: `${order.notes ? order.notes + " | " : ""}تم استلام الوجبة بالفرع من الكابتن (${driverName})`,
      },
      include: {
        items: true,
        branch: { select: { id: true, name: true, phone: true, address: true, logoUrl: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    // إشعار الطيار بإلغاء الطلب من عليه وإشعار العميل والديسكتوب
    if (oldDriverId) {
      notifyDriverUnassigned(oldDriverId, id);
    }
    notifyOrderStatusChanged(id, branchId, updated);

    res.json({
      success: true,
      message: "تم استلام الوجبة من الطيار بنجاح وإلغاء مسؤوليته عنها",
      order: updated,
    });
  } catch (error) {
    console.error("Confirm return from driver error:", error);
    res.status(500).json({ error: "فشل استلام الطلب من الطيار" });
  }
});

// 30. استعلام شكاوى وبلاغات العملاء الخاصة بهذا الفرع
router.get("/support-tickets", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branch!.branchId;

    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "support_ticket_" } },
      orderBy: { createdAt: "desc" },
    });

    const allTickets = settings
      .map((s) => {
        try {
          return JSON.parse(s.value);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Retrieve branch orders to associate legacy or untagged tickets
    const branchOrders = await prisma.order.findMany({
      where: { branchId },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        items: { select: { itemName: true, quantity: true, totalPrice: true } },
      },
    });

    const branchOrderNumbers = new Map<string, any>();
    const branchOrderIds = new Map<string, any>();
    for (const ord of branchOrders) {
      branchOrderNumbers.set(String(ord.orderNumber), ord);
      branchOrderIds.set(ord.id, ord);
    }

    const branchTickets = allTickets
      .filter((ticket: any) => {
        if (ticket.branchId && ticket.branchId === branchId) {
          return true;
        }
        if (ticket.orderNumber) {
          const cleanNum = String(ticket.orderNumber).replace('#', '').trim();
          return branchOrderNumbers.has(cleanNum) || branchOrderIds.has(cleanNum);
        }
        return false;
      })
      .map((ticket: any) => {
        if (ticket.orderNumber) {
          const cleanNum = String(ticket.orderNumber).replace('#', '').trim();
          const ord = branchOrderNumbers.get(cleanNum) || branchOrderIds.get(cleanNum);
          if (ord) {
            return {
              ...ticket,
              branchId,
              orderTotal: ord.total,
              orderStatus: ord.status,
              orderCreatedAt: ord.createdAt,
              orderItemsSummary: ord.items?.map((it: any) => `${it.quantity}x ${it.itemName}`).join(', ') || undefined,
            };
          }
        }
        return ticket;
      });

    res.json({ success: true, tickets: branchTickets });
  } catch (error) {
    console.error("Branch get support-tickets error:", error);
    res.status(500).json({ error: "فشل جلب بلاغات الدعم الخاصة بالفرع" });
  }
});

// 31. تحديث حالة أو إضافة رد المطعم على الشكوى
router.put("/support-tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branch!.branchId;
    const { status, branchNotes } = req.body;

    const setting = await prisma.systemSetting.findUnique({
      where: { key: `support_ticket_${id}` },
    });

    if (!setting) {
      res.status(404).json({ error: "تذكرة الدعم غير موجودة" });
      return;
    }

    const ticket = JSON.parse(setting.value);

    // Verify ownership
    let belongsToBranch = ticket.branchId === branchId;
    if (!belongsToBranch && ticket.orderNumber) {
      const cleanNum = String(ticket.orderNumber).replace('#', '').trim();
      const order = await prisma.order.findFirst({
        where: {
          branchId,
          OR: [
            { orderNumber: parseInt(cleanNum, 10) || -1 },
            { id: cleanNum }
          ]
        }
      });
      if (order) belongsToBranch = true;
    }

    if (!belongsToBranch) {
      res.status(403).json({ error: "غير مصرح لك بتعديل هذه التذكرة لأنها لا تخص هذا الفرع" });
      return;
    }

    if (status) ticket.status = status;
    if (branchNotes !== undefined) ticket.branchNotes = branchNotes;
    ticket.branchId = branchId;
    ticket.updatedAt = new Date().toISOString();

    await prisma.systemSetting.update({
      where: { key: `support_ticket_${id}` },
      data: { value: JSON.stringify(ticket) },
    });

    res.json({ success: true, ticket });
  } catch (error) {
    console.error("Branch update support-ticket error:", error);
    res.status(500).json({ error: "فشل تحديث تذكرة الدعم" });
  }
});

export default router;
