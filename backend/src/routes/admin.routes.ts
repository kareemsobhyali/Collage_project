import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateToken, requireSuperAdmin, AuthRequest } from "../middleware/auth.js";
import { 
  getLoyaltySettings, 
  updateLoyaltySettings, 
  awardLoyaltyPointsIfCompleted,
  getWhatsAppAlertSettings,
  updateWhatsAppAlertSettings,
  sendOrderCancellationWhatsAppAlert,
  sendBranchShiftWhatsAppReport,
  getNotificationSoundSettings,
  updateNotificationSoundSettings,
  DEFAULT_SOUND_SETTINGS,
  getRestaurantLocationSettings,
  updateRestaurantLocationSettings,
  getContactChannelsSettings,
  updateContactChannelsSettings
} from "../services/settings.service.js";
import { 
  notifyBranchStatusChanged,
  notifyBranchesListChanged,
  notifyBranchMenuChanged,
  notifyBannersUpdated,
  notifyPromosUpdated,
  notifyFlashDealsUpdated,
  notifyUserUpdated,
  notifySoundSettingsChanged,
  notifyRestaurantLocationChanged,
  notifySupportTicketUpdated,
  notifySupportTicketDeleted
} from "../sockets/socketManager.js";
import { 
  getDriverBranchConfig, 
  setDriverBranchConfig, 
  deleteDriverBranchConfig 
} from "../services/driver.service.js";
import { seedMockDatabase } from "../services/mockData.service.js";
import { restoreFlashDealsForOrder } from "../services/flashDeal.service.js";
import { importBulkMenu } from "../services/menuImport.service.js";



const router = Router();

// تسجيل دخول السوبر أدمن
router.post("/login", async (req: Request, res: Response) => {
  try {
    const identifier = (req.body.phone || req.body.username || "").trim();
    const { password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: "الرجاء إدخال اسم المستخدم وكلمة المرور" });
      return;
    }

    // في حال كانت قاعدة البيانات جديدة تماماً ولا يوجد أي سوبر أدمن، يتم إنشاء الحساب الافتراضي (مع دعم متغير البيئة INITIAL_ADMIN_PASSWORD)
    const superAdminCount = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (superAdminCount === 0) {
      const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "123456");
      if (initialAdminPassword) {
        const defaultHashedPassword = await bcrypt.hash(initialAdminPassword, 10);
        await prisma.user.create({
          data: {
            name: "المدير العام للنظام",
            phone: process.env.INITIAL_ADMIN_USERNAME || "admin",
            password: defaultHashedPassword,
            role: "SUPERADMIN",
          },
        });
      }
    }

    const admin = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: identifier },
          { phone: identifier.toLowerCase() },
        ],
        role: "SUPERADMIN",
      },
    });

    if (!admin) {
      res.status(401).json({ error: "بيانات دخول الأدمن غير صحيحة" });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      res.status(401).json({ error: "بيانات دخول الأدمن غير صحيحة" });
      return;
    }

    const token = generateToken({
      userId: admin.id,
      phone: admin.phone,
      role: admin.role,
    });

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

// جميع المسارات التالية تتطلب صلاحية السوبر أدمن
router.use(requireSuperAdmin);

// استرجاع كافة الفروع مع إعدادات الدفع وبيانات تسجيل الدخول
router.get("/branches", async (_req: AuthRequest, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      include: {
        paymentConfig: true,
        deliveryZones: true,
        users: {
          select: { id: true, username: true, createdAt: true },
        },
        _count: {
          select: { orders: true, items: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(branches);
  } catch (error) {
    console.error("Get branches error:", error);
    res.status(500).json({ error: "فشل استرجاع بيانات الفروع" });
  }
});

// إنشاء فرع جديد
router.post("/branches", async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      phone,
      logoUrl,
      address,
      deliveryFee,
      deliveryRadiusKm,
      latitude,
      longitude,
      deliveryType,
      deliveryZones,
      allowDelivery,
      allowPickup,
      slug,
      username,
      password,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: "اسم الفرع مطلوب" });
      return;
    }

    let formattedSlug: string | null = null;
    if (slug && typeof slug === 'string' && slug.trim()) {
      formattedSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
      const existingSlug = await prisma.branch.findFirst({
        where: { slug: formattedSlug },
      });
      if (existingSlug) {
        res.status(400).json({ error: "معرف الرابط المباشر (Slug) مستخدم بالفعل لفرع آخر، يرجى اختيار اسم آخر" });
        return;
      }
    }

    // إذا تم تمرير اسم مستخدم، نتحقق من عدم تكراره
    if (username) {
      const existingUser = await prisma.branchUser.findUnique({
        where: { username: username.trim() },
      });
      if (existingUser) {
        res.status(400).json({ error: "اسم المستخدم الخاص بالفرع مسجل بالفعل، اختر اسماً آخر" });
        return;
      }
    }

    const branch = await prisma.branch.create({
      data: {
        name: name.trim(),
        slug: formattedSlug,
        phone: phone ? phone.trim() : null,
        logoUrl: logoUrl || null,
        address: address ? address.trim() : null,
        deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : 10.0,
        deliveryRadiusKm: deliveryRadiusKm !== undefined && deliveryRadiusKm !== "" ? parseFloat(deliveryRadiusKm) : 10.0,
        latitude: latitude !== undefined && latitude !== "" ? parseFloat(latitude) : null,
        longitude: longitude !== undefined && longitude !== "" ? parseFloat(longitude) : null,
        deliveryType: deliveryType !== undefined ? String(deliveryType) : 'FIXED',
        deliveryZones: Array.isArray(deliveryZones) && deliveryZones.length > 0 ? {
          create: deliveryZones.map((z: any) => ({
            name: typeof z === 'string' ? z.trim() : (z.name || '').trim(),
            fee: typeof z === 'object' && z.fee !== undefined ? parseFloat(z.fee) || 0 : (deliveryFee ? parseFloat(deliveryFee) : 10),
          })).filter((z: any) => Boolean(z.name)),
        } : undefined,
        allowDelivery: allowDelivery !== undefined ? Boolean(allowDelivery) : true,
        allowPickup: allowPickup !== undefined ? Boolean(allowPickup) : true,
        isActive: true,
        // إعدادات الدفع الافتراضية للفرع
        paymentConfig: {
          create: {
            cashEnabled: true,
            vodafoneCashEnabled: false,
            instapayEnabled: false,
            cardEnabled: false,
          },
        },
      },
      include: {
        paymentConfig: true,
      },
    });

    // إنشاء مستخدم للفرع إذا تم تزويد بيانات الدخول
    let createdUser = null;
    if (username && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      createdUser = await prisma.branchUser.create({
        data: {
          username: username.trim(),
          password: hashedPassword,
          branchId: branch.id,
        },
        select: { id: true, username: true, createdAt: true },
      });
    }

    res.status(201).json({
      success: true,
      branch: {
        ...branch,
        users: createdUser ? [createdUser] : [],
      },
    });

    notifyBranchesListChanged();
  } catch (error) {
    console.error("Create branch error:", error);
    res.status(500).json({ error: "فشل إنشاء الفرع" });
  }
});

// تفعيل أو إيقاف الفرع
router.put("/branches/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    if (isActive === undefined) {
      res.status(400).json({ error: "حالة التفعيل مطلوبة (isActive)" });
      return;
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });

    notifyBranchStatusChanged(id, { isActive: updated.isActive });
    notifyBranchesListChanged();

    res.json({ success: true, branch: updated });
  } catch (error) {
    console.error("Update branch status error:", error);
    res.status(500).json({ error: "فشل تحديث حالة الفرع" });
  }
});

// تعديل بيانات الفرع بالكامل (الاسم، العنوان، الهاتف، رسوم التوصيل، خيارات الاستلام، مواعيد العمل)
router.put("/branches/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { 
      name, 
      phone, 
      address, 
      deliveryFee, 
      deliveryRadiusKm,
      latitude,
      longitude,
      deliveryType,
      deliveryZones,
      allowDelivery, 
      allowPickup, 
      logoUrl, 
      slug,
      openingTime,
      closingTime,
      workingDays,
      operationalStatus,
      closedUntil,
      closingReason
    } = req.body;

    let formattedSlug: string | null | undefined = undefined;
    if (slug !== undefined) {
      if (slug && typeof slug === 'string' && slug.trim()) {
        formattedSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
        const existingSlug = await prisma.branch.findFirst({
          where: { slug: formattedSlug, id: { not: id } },
        });
        if (existingSlug) {
          res.status(400).json({ error: "معرف الرابط المباشر (Slug) مستخدم بالفعل لفرع آخر، اختر اسماً آخر" });
          return;
        }
      } else {
        formattedSlug = null;
      }
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        slug: formattedSlug !== undefined ? formattedSlug : undefined,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
        address: address !== undefined ? (address ? address.trim() : null) : undefined,
        logoUrl: logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : undefined,
        deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : undefined,
        deliveryRadiusKm: deliveryRadiusKm !== undefined && deliveryRadiusKm !== "" ? parseFloat(deliveryRadiusKm) : undefined,
        latitude: latitude !== undefined && latitude !== "" ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined && longitude !== "" ? parseFloat(longitude) : undefined,
        deliveryType: deliveryType !== undefined ? String(deliveryType) : undefined,
        allowDelivery: allowDelivery !== undefined ? Boolean(allowDelivery) : undefined,
        allowPickup: allowPickup !== undefined ? Boolean(allowPickup) : undefined,
        openingTime: openingTime !== undefined ? (openingTime ? String(openingTime).trim() : null) : undefined,
        closingTime: closingTime !== undefined ? (closingTime ? String(closingTime).trim() : null) : undefined,
        workingDays: workingDays !== undefined ? (workingDays ? String(workingDays).trim() : null) : undefined,
        operationalStatus: operationalStatus !== undefined ? String(operationalStatus).trim() : undefined,
        closedUntil: closedUntil !== undefined ? (closedUntil ? new Date(closedUntil) : null) : undefined,
        closingReason: closingReason !== undefined ? (closingReason ? String(closingReason).trim() : null) : undefined,
      },
      include: {
        deliveryZones: true,
      },
    });

    if (deliveryZones && Array.isArray(deliveryZones)) {
      await prisma.branchDeliveryZone.deleteMany({ where: { branchId: id } });
      if (deliveryZones.length > 0) {
        await prisma.branchDeliveryZone.createMany({
          data: deliveryZones.map((z: any) => ({
            branchId: id,
            name: typeof z === 'string' ? z.trim() : (z.name || '').trim(),
            fee: typeof z === 'object' && z.fee !== undefined ? parseFloat(z.fee) || 0 : (deliveryFee ? parseFloat(deliveryFee) : 10),
          })).filter(z => Boolean(z.name)),
        });
      }
    }

    notifyBranchStatusChanged(id, updated);
    notifyBranchesListChanged();

    res.json({ success: true, branch: updated });
  } catch (error) {
    console.error("Update branch details error:", error);
    res.status(500).json({ error: "فشل تحديث بيانات الفرع" });
  }
});

// حذف الفرع
router.delete("/branches/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    // فحص إذا كان هناك طلبات نشطة حالياً
    const activeOrders = await prisma.order.count({
      where: {
        branchId: id,
        status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY"] },
      },
    });

    if (activeOrders > 0) {
      res.status(400).json({ 
        error: "لا يمكن حذف الفرع لوجود طلبات قيد التحضير حالياً. يرجى إيقاف الفرع أولاً أو إنهاء الطلبات." 
      });
      return;
    }

    // تنظيف الطلبات السابقة المرتبطة بالفرع وحذف الفرع في معاملة ذرية واحدة
    await prisma.$transaction([
      prisma.orderItem.deleteMany({
        where: { order: { branchId: id } },
      }),
      prisma.order.deleteMany({
        where: { branchId: id },
      }),
      prisma.branch.delete({
        where: { id },
      }),
    ]);

    notifyBranchStatusChanged(id, { isDeleted: true, isActive: false });
    notifyBranchesListChanged();

    res.json({ success: true, message: "تم حذف الفرع بنجاح" });
  } catch (error) {
    console.error("Delete branch error:", error);
    res.status(500).json({ error: "فشل حذف الفرع" });
  }
});

// إنشاء أو تحديث يوزر الديسكتوب الخاص بالفرع
router.post("/branches/:id/credentials", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    const cleanUsername = username.trim();
    const existing = await prisma.branchUser.findFirst({
      where: {
        username: cleanUsername,
        NOT: { branchId: id },
      },
    });

    if (existing) {
      res.status(400).json({ error: "اسم المستخدم مستخدم لفرع آخر، يرجى اختيار اسم مختلف" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // البحث عن يوزر موجود للفرع أو إنشاء جديد
    const branchUser = await prisma.branchUser.findFirst({
      where: { branchId: id },
    });

    let result;
    if (branchUser) {
      result = await prisma.branchUser.update({
        where: { id: branchUser.id },
        data: {
          username: cleanUsername,
          password: hashedPassword,
        },
        select: { id: true, username: true, branchId: true },
      });
    } else {
      result = await prisma.branchUser.create({
        data: {
          username: cleanUsername,
          password: hashedPassword,
          branchId: id,
        },
        select: { id: true, username: true, branchId: true },
      });
    }

    res.json({ success: true, user: result });
  } catch (error) {
    console.error("Set credentials error:", error);
    res.status(500).json({ error: "فشل حفظ بيانات دخول الفرع" });
  }
});

// استيراد منيو كامل مجمع لفرع محدد من لوحة الإدارة مع تنزيل وحفظ الصور تلقائياً على السيرفر
router.post("/branches/:id/menu/import-bulk", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.id as string;
    const { items, replaceExisting } = req.body;

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      res.status(404).json({ error: "المطعم غير موجود" });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "لا توجد أصناف صالحة للاستيراد في الملف" });
      return;
    }

    const result = await importBulkMenu(branchId, items, {
      replaceExisting: Boolean(replaceExisting),
    });

    res.json(result);
  } catch (error: any) {
    console.error("Admin bulk menu import error:", error);
    res.status(500).json({ error: error?.message || "فشل استيراد المنيو" });
  }
});

// جلب منيو فرع كامل (بما في ذلك الأصناف المتوقفة مؤقتاً) لغرض الترتيب والإدارة من لوحة التحكم
router.get("/branches/:id/menu", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.id as string;
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      res.status(404).json({ error: "المطعم غير موجود" });
      return;
    }

    const categories = await prisma.menuCategory.findMany({
      where: { branchId },
      include: {
        items: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          include: { sizes: true },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });

    res.json({ branch, categories });
  } catch (error) {
    console.error("Admin get branch menu error:", error);
    res.status(500).json({ error: "فشل جلب منيو المطعم" });
  }
});

// إعادة ترتيب عرض الأقسام والأصناف لفرع محدد من لوحة الإدارة
router.put("/branches/:id/menu/reorder", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.id as string;
    const { categoryIds, itemsByCategory } = req.body as {
      categoryIds?: string[];
      itemsByCategory?: Record<string, string[]>;
    };

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      res.status(404).json({ error: "المطعم غير موجود" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        for (let idx = 0; idx < categoryIds.length; idx++) {
          await tx.menuCategory.updateMany({
            where: { id: String(categoryIds[idx]), branchId },
            data: { displayOrder: idx },
          });
        }
      }

      if (itemsByCategory && typeof itemsByCategory === "object") {
        const validCategories = await tx.menuCategory.findMany({
          where: { branchId },
          select: { id: true },
        });
        const validCatSet = new Set(validCategories.map((c) => c.id));

        for (const [catId, itemIds] of Object.entries(itemsByCategory)) {
          if (!Array.isArray(itemIds)) continue;
          const isValidTargetCat = validCatSet.has(catId);
          for (let idx = 0; idx < itemIds.length; idx++) {
            await tx.menuItem.updateMany({
              where: { id: String(itemIds[idx]), branchId },
              data: {
                displayOrder: idx,
                ...(isValidTargetCat ? { categoryId: catId } : {}),
              },
            });
          }
        }
      }
    });

    notifyBranchMenuChanged(branchId);

    res.json({ success: true });
  } catch (error) {
    console.error("Admin reorder branch menu error:", error);
    res.status(500).json({ error: "فشل حفظ ترتيب المنيو" });
  }
});

// ضبط وتخصيص طرق الدفع المتاحة لكل فرع
router.put("/branches/:id/payment-methods", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      cashEnabled,
      vodafoneCashEnabled,
      vodafoneCashNumber,
      instapayEnabled,
      instapayHandle,
      cardEnabled,
      requirePaymentProof,
    } = req.body;

    // التأكد التلقائي من وجود عمود requirePaymentProof في قاعدة البيانات لتفادي أي خطأ
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "requirePaymentProof" BOOLEAN NOT NULL DEFAULT true;`
    ).catch(() => {});

    const updatedConfig = await prisma.branchPaymentConfig.upsert({
      where: { branchId: id },
      update: {
        cashEnabled: true, // الدفع كاش إجباري دائم في كل المطاعم
        vodafoneCashEnabled: vodafoneCashEnabled !== undefined ? Boolean(vodafoneCashEnabled) : undefined,
        vodafoneCashNumber: vodafoneCashNumber !== undefined ? vodafoneCashNumber : undefined,
        instapayEnabled: instapayEnabled !== undefined ? Boolean(instapayEnabled) : undefined,
        instapayHandle: instapayHandle !== undefined ? instapayHandle : undefined,
        cardEnabled: cardEnabled !== undefined ? Boolean(cardEnabled) : undefined,
        requirePaymentProof: (requirePaymentProof !== undefined ? Boolean(requirePaymentProof) : undefined) as any,
      },
      create: {
        branchId: id,
        cashEnabled: true, // إجباري دائم
        vodafoneCashEnabled: vodafoneCashEnabled !== undefined ? Boolean(vodafoneCashEnabled) : false,
        vodafoneCashNumber: vodafoneCashNumber || null,
        instapayEnabled: instapayEnabled !== undefined ? Boolean(instapayEnabled) : false,
        instapayHandle: instapayHandle || null,
        cardEnabled: cardEnabled !== undefined ? Boolean(cardEnabled) : false,
        requirePaymentProof: (requirePaymentProof !== undefined ? Boolean(requirePaymentProof) : true) as any,
      },
    });

    notifyBranchStatusChanged(id, { paymentConfig: updatedConfig });

    res.json({ success: true, paymentConfig: updatedConfig });
  } catch (error) {
    console.error("Update payment methods error:", error);
    res.status(500).json({ error: "فشل تحديث طرق الدفع للفرع" });
  }
});

// استرجاع قائمة العملاء المحظورين لفرع معين
router.get("/branches/:id/blocked-customers", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.id as string;
    const blockedRecords = await prisma.branchBlockedCustomer.findMany({
      where: { branchId, isBlocked: true },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const userIds = blockedRecords.map((b) => b.userId);
    const orderCounts = await prisma.order.groupBy({
      by: ["userId"],
      where: { branchId, userId: { in: userIds } },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const oc of orderCounts) {
      countMap.set(oc.userId, oc._count.id);
    }

    res.json({
      success: true,
      blockedCustomers: blockedRecords.map((rec) => ({
        id: rec.id,
        userId: rec.userId,
        name: rec.user.name,
        phone: rec.user.phone,
        notes: rec.notes,
        blockedAt: rec.updatedAt,
        orderCount: countMap.get(rec.userId) || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع العملاء المحظورين للفرع" });
  }
});

// فك حظر عميل لفرع معين من لوحة الإدارة
router.post("/branches/:id/customers/:userId/unblock", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.id as string;
    const userId = req.params.userId as string;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true },
    });

    await prisma.branchBlockedCustomer.upsert({
      where: { branchId_userId: { branchId, userId } },
      update: { isBlocked: false },
      create: { branchId, userId, isBlocked: false },
    });

    res.json({
      success: true,
      message: `تم إلغاء حظر العميل "${targetUser?.name || ''}" بنجاح`,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل إلغاء الحظر عن العميل" });
  }
});

// إحصائيات عامة وتحليلات مفصلة
router.get("/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const totalBranches = await prisma.branch.count();
    const activeBranches = await prisma.branch.count({ where: { isActive: true } });
    const totalOrders = await prisma.order.count();
    const completedOrders = await prisma.order.count({ where: { status: "COMPLETED" } });
    const pendingOrders = await prisma.order.count({ where: { status: "PENDING" } });
    const totalStudents = await prisma.user.count({ where: { role: "CUSTOMER" } });

    const totalSales = await prisma.order.aggregate({
      where: { status: "COMPLETED" },
      _sum: { total: true },
    });

    // تفاصيل طرق الدفع للطلبات الناجحة
    const paymentMethods = await prisma.order.groupBy({
      by: ["paymentMethod"],
      _count: { id: true },
      _sum: { total: true },
      where: { status: "COMPLETED" },
    });

    // أعلى الفروع نشاطاً
    const branchPerformance = await prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { orders: true } },
      },
      take: 6,
    });

    // متوسط وقت التجهيز ومتوسط وقت إجمالي التوصيل للطلبات المكتملة
    const completedTimings = await prisma.order.findMany({
      where: { status: "COMPLETED" },
      select: {
        createdAt: true,
        acceptedAt: true,
        preparingAt: true,
        readyAt: true,
        completedAt: true,
      },
      take: 200,
    });

    let totalWaitMins = 0;
    let waitCount = 0;
    let totalPrepMins = 0;
    let prepCount = 0;
    let totalDeliveryMins = 0;
    let deliveryCount = 0;
    let totalOrderMins = 0;
    let orderCountTiming = 0;

    for (const o of completedTimings) {
      if (o.completedAt && o.createdAt) {
        totalOrderMins += (o.completedAt.getTime() - o.createdAt.getTime()) / (60 * 1000);
        orderCountTiming++;
      }
      if (o.acceptedAt && o.createdAt) {
        totalWaitMins += (o.acceptedAt.getTime() - o.createdAt.getTime()) / (60 * 1000);
        waitCount++;
      }
      if (o.readyAt && (o.preparingAt || o.acceptedAt)) {
        const prepStart = (o.preparingAt || o.acceptedAt)!.getTime();
        totalPrepMins += (o.readyAt.getTime() - prepStart) / (60 * 1000);
        prepCount++;
      }
      if (o.completedAt && o.readyAt) {
        totalDeliveryMins += (o.completedAt.getTime() - o.readyAt.getTime()) / (60 * 1000);
        deliveryCount++;
      }
    }

    const avgAcceptanceMins = waitCount > 0 ? Math.round((totalWaitMins / waitCount) * 10) / 10 : 0;
    const avgPrepMins = prepCount > 0 ? Math.round((totalPrepMins / prepCount) * 10) / 10 : 0;
    const avgDeliveryMins = deliveryCount > 0 ? Math.round((totalDeliveryMins / deliveryCount) * 10) / 10 : 0;
    const avgTotalMins = orderCountTiming > 0 ? Math.round((totalOrderMins / orderCountTiming) * 10) / 10 : 0;

    res.json({
      totalBranches,
      activeBranches,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalStudents,
      totalSales: totalSales._sum.total || 0,
      paymentMethods,
      branchPerformance,
      timingStats: {
        avgAcceptanceMins,
        avgPrepMins,
        avgDeliveryMins,
        avgTotalMins,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "فشل جلب الإحصائيات" });
  }
});

// جلب كافة طلبات الحرم الجامعي لحظياً للأدمن مع الفلترة
router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, status, limit } = req.query;
    const whereClause: any = {};
    if (branchId && branchId !== "ALL") whereClause.branchId = String(branchId);
    if (status && status !== "ALL") whereClause.status = String(status);

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        branch: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(String(limit)) : 100,
    });

    res.json(orders);
  } catch (error) {
    console.error("Get admin orders error:", error);
    res.status(500).json({ error: "فشل استرجاع قائمة الطلبات" });
  }
});

// استرجاع تقييمات وآراء العملاء مع تفاصيل الطلب والوجبات والمطعم وبيانات العميل
router.get("/reviews", async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, rating, hasText, limit } = req.query;
    const whereClause: any = {
      rating: { not: null },
    };

    if (branchId && branchId !== "ALL") {
      whereClause.branchId = String(branchId);
    }

    if (rating && rating !== "ALL") {
      whereClause.rating = parseInt(String(rating));
    }

    if (hasText === "true") {
      whereClause.review = { not: null };
    }

    const reviews = await prisma.order.findMany({
      where: whereClause,
      include: {
        branch: { select: { id: true, name: true, phone: true, logoUrl: true } },
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            walletBalance: true,
            loyaltyPoints: true,
            isBlocked: true,
            restaurantNotes: true,
            createdAt: true,
          },
        },
        items: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit ? parseInt(String(limit)) : 150,
    });

    // إحصائيات سريعة للتقييمات
    const allRated = await prisma.order.findMany({
      where: { rating: { not: null } },
      select: { rating: true, review: true, branchId: true },
    });

    const totalReviews = allRated.length;
    const withTextCount = allRated.filter((r) => r.review && r.review.trim().length > 0).length;
    const avgRating =
      totalReviews > 0
        ? allRated.reduce((acc, curr) => acc + (curr.rating || 0), 0) / totalReviews
        : 0;

    const distribution = {
      5: allRated.filter((r) => r.rating === 5).length,
      4: allRated.filter((r) => r.rating === 4).length,
      3: allRated.filter((r) => r.rating === 3).length,
      2: allRated.filter((r) => r.rating === 2).length,
      1: allRated.filter((r) => r.rating === 1).length,
    };

    res.json({
      reviews,
      stats: {
        totalReviews,
        withTextCount,
        averageRating: Number(avgRating.toFixed(1)),
        distribution,
      },
    });
  } catch (error) {
    console.error("Get admin reviews error:", error);
    res.status(500).json({ error: "فشل استرجاع التقييمات" });
  }
});

// حذف تقييم مسيء أو غير لائق بواسطة السوبر أدمن
router.delete("/reviews/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.order.update({
      where: { id },
      data: {
        rating: null,
        review: null,
      },
    });
    res.json({ success: true, message: "تم حذف التقييم بنجاح" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ error: "فشل حذف التقييم" });
  }
});

// تعديل أو إلغاء حالة طلب بواسطة السوبر أدمن
router.put("/orders/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, reason } = req.body;

    const validStatuses = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: "حالة الطلب غير صالحة" });
      return;
    }

    const existingOrder = await prisma.order.findUnique({ where: { id } });
    if (!existingOrder) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (existingOrder.status === "REJECTED" && status !== "REJECTED") {
      res.status(400).json({ error: "لا يمكن إعادة فتح طلب ملغي أو مرفوض حفاظاً على سلامة الأرصدة والحسابات المالية" });
      return;
    }

    if (existingOrder.status === "COMPLETED" && status !== "COMPLETED" && status !== "REJECTED") {
      res.status(400).json({ error: "الطلب مكتمل بالفعل ولا يمكن إرجاعه لحالة سابقة" });
      return;
    }

    const now = new Date();
    const updateData: any = { status };
    if (status === "ACCEPTED" || status === "PREPARING") {
      updateData.acceptedAt = now;
      updateData.preparingAt = now;
    } else if (status === "READY") {
      updateData.readyAt = now;
    } else if (status === "COMPLETED") {
      updateData.completedAt = now;
    } else if (status === "REJECTED") {
      updateData.cancelledAt = now;
      const rawReason = (reason || req.body.notes || "").trim();
      if (rawReason) {
        updateData.notes = existingOrder.notes
          ? `${existingOrder.notes} | سبب الإلغاء: ${rawReason}`
          : `سبب الإلغاء: ${rawReason}`;
      }
    }

    let updated;
    if (status === "REJECTED" && existingOrder.status !== "REJECTED") {
      updated = await prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          where: { id, status: { not: "REJECTED" } },
          data: updateData,
        });

        const orderRes = await tx.order.findUnique({
          where: { id },
          include: { branch: true },
        });

        if (claim.count === 1) {
          // استرجاع كميات عروض الفلاش فوراً عند رفض أو إلغاء الطلب من الإدارة
          await restoreFlashDealsForOrder(id, tx);
          if (existingOrder.walletDiscount > 0 || (existingOrder.pointsAwarded && existingOrder.pointsEarned > 0)) {
            const targetUser = await tx.user.findUnique({ where: { id: existingOrder.userId } });
            if (targetUser) {
              const refundedWallet = (targetUser.walletBalance || 0) + (existingOrder.walletDiscount || 0);
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
        }

        return orderRes!;
      });

      // إشعار واتساب للمشرفين بإلغاء الطلب
      sendOrderCancellationWhatsAppAlert(id, (reason || "إلغاء بواسطة إدارة المنظومة").trim()).catch(() => {});
    } else {
      updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: { branch: true },
      });

      // إيداع نقاط الولاء في محفظة الطالب فقط عند اكتمال الطلب والتسليم الفعلي
      if (status === "COMPLETED") {
        await awardLoyaltyPointsIfCompleted(id);
      }
    }

    // إشعار الفرع والعميل عبر WebSockets لحظياً
    const { getIO } = await import("../sockets/socketManager.js");
    const io = getIO();
    if (io) {
      io.to(`order_${id}`).emit("order_updated", updated);
      io.to(`branch_${updated.branchId}`).emit("order_status_changed", updated);
    }

    res.json({ success: true, order: updated });
  } catch (error) {
    console.error("Update admin order status error:", error);
    res.status(500).json({ error: "فشل تحديث حالة الطلب" });
  }
});

// جلب قائمة الطلاب والمستخدمين المسجلين بالجامعة مع رصيد المحفظة ونقاط الولاء وحالة الحساب والملاحظات
router.get("/users", async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        phone: true,
        isVerified: true,
        loyaltyPoints: true,
        walletBalance: true,
        isBlocked: true,
        restaurantNotes: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "فشل استرجاع قائمة المستخدمين" });
  }
});

// تفعيل أو إلغاء تفعيل حساب طالب يدوياً من لوحة الإدارة (Toggle Phone Verification)
router.put("/users/:id/toggle-verify", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isVerified: !user.isVerified },
      select: {
        id: true,
        name: true,
        phone: true,
        isVerified: true,
        loyaltyPoints: true,
        walletBalance: true,
        isBlocked: true,
      },
    });

    notifyUserUpdated(id, updated);

    res.json({
      success: true,
      message: updated.isVerified ? "تم تفعيل وتأكيد حساب العميل بنجاح" : "تم إلغاء تفعيل حساب العميل",
      user: updated,
    });
  } catch (error) {
    console.error("Toggle user verify error:", error);
    res.status(500).json({ error: "فشل تعديل حالة تفعيل العميل" });
  }
});

// شحن أو تعديل رصيد المحفظة أو نقاط الولاء أو ملاحظات/حظر طالب من لوحة الإدارة
router.put("/users/:id/wallet", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { walletBalance, loyaltyPoints, isBlocked, restaurantNotes } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        walletBalance: walletBalance !== undefined ? Math.max(0, parseFloat(walletBalance) || 0) : undefined,
        loyaltyPoints: loyaltyPoints !== undefined ? Math.max(0, parseInt(loyaltyPoints) || 0) : undefined,
        isBlocked: isBlocked !== undefined ? Boolean(isBlocked) : undefined,
        restaurantNotes: restaurantNotes !== undefined ? (restaurantNotes ? String(restaurantNotes).trim() : null) : undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        walletBalance: true,
        isBlocked: true,
        restaurantNotes: true,
      },
    });

    notifyUserUpdated(id, updated);

    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: "فشل تحديث بيانات ومحفظة العميل" });
  }
});

// ==========================================
// إدارة البانرات الإعلانية الترويجية (Banners)
// ==========================================

// 1. جلب كافة البانرات
router.get("/banners", async (_req: AuthRequest, res: Response) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع البانرات" });
  }
});

// دالة مساعدة للتحقق من أمان روابط البانرات ومنع javascript: / data:
function sanitizeBannerLinkUrl(url: any): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// 2. إضافة بانر إعلاني جديد
router.post("/banners", async (req: AuthRequest, res: Response) => {
  try {
    const { title, subtitle, imageUrl, badgeText, linkUrl, displayOrder, isActive } = req.body;
    if (!title) {
      res.status(400).json({ error: "عنوان البانر مطلوب" });
      return;
    }

    if (linkUrl && typeof linkUrl === "string" && linkUrl.trim() && !sanitizeBannerLinkUrl(linkUrl)) {
      res.status(400).json({ error: "رابط البانر غير صالح، يجب أن يبدأ بـ https:// أو http:// أو مسار داخلي /" });
      return;
    }

    const banner = await prisma.banner.create({
      data: {
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        imageUrl: imageUrl ? imageUrl.trim() : "",
        badgeText: badgeText ? badgeText.trim() : null,
        linkUrl: sanitizeBannerLinkUrl(linkUrl),
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) || 0 : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    notifyBannersUpdated();

    res.status(201).json({ success: true, banner });
  } catch (error) {
    console.error("Create banner error:", error);
    res.status(500).json({ error: "فشل إنشاء البانر الإعلاني" });
  }
});

// 3. تعديل بيانات أو حالة البانر بالكامل
router.put("/banners/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isActive, title, subtitle, imageUrl, badgeText, linkUrl, displayOrder } = req.body;

    if (linkUrl !== undefined && linkUrl && typeof linkUrl === "string" && linkUrl.trim() && !sanitizeBannerLinkUrl(linkUrl)) {
      res.status(400).json({ error: "رابط البانر غير صالح، يجب أن يبدأ بـ https:// أو http:// أو مسار داخلي /" });
      return;
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        title: title ? title.trim() : undefined,
        subtitle: subtitle !== undefined ? (subtitle ? subtitle.trim() : null) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl.trim() : undefined,
        badgeText: badgeText !== undefined ? (badgeText ? badgeText.trim() : null) : undefined,
        linkUrl: linkUrl !== undefined ? sanitizeBannerLinkUrl(linkUrl) : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) || 0 : undefined,
      },
    });

    notifyBannersUpdated();

    res.json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ error: "فشل تحديث البانر" });
  }
});

// 4. حذف بانر
router.delete("/banners/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.banner.delete({ where: { id } });

    notifyBannersUpdated();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف البانر" });
  }
});

// ==========================================
// إدارة كوبونات الخصم (Promo Codes)
// ==========================================

// 1. جلب كافة الكوبونات
router.get("/promo-codes", async (_req: AuthRequest, res: Response) => {
  try {
    const codes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع الكوبونات" });
  }
});

// 2. إنشاء كوبون خصم جديد
router.post("/promo-codes", async (req: AuthRequest, res: Response) => {
  try {
    const { code, discountType, value, minOrder, maxUses, oncePerUser, expiresAt, isActive, applicableBranchIds } = req.body;
    if (!code || value === undefined) {
      res.status(400).json({ error: "كود الخصم وقيمة الخصم مطلوبان" });
      return;
    }

    const parsedMaxUses = maxUses !== undefined && maxUses !== null && String(maxUses).trim() !== ""
      ? Math.max(1, parseInt(maxUses))
      : null;

    let formattedBranchIds: string | null = null;
    if (applicableBranchIds && Array.isArray(applicableBranchIds) && applicableBranchIds.length > 0) {
      formattedBranchIds = JSON.stringify(applicableBranchIds);
    } else if (typeof applicableBranchIds === 'string' && applicableBranchIds.trim() && applicableBranchIds !== 'ALL') {
      try {
        const parsed = JSON.parse(applicableBranchIds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          formattedBranchIds = JSON.stringify(parsed);
        }
      } catch {
        const arr = applicableBranchIds.split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length > 0) formattedBranchIds = JSON.stringify(arr);
      }
    }

    const created = await prisma.promoCode.create({
      data: {
        code: code.trim().toUpperCase(),
        discountType: (discountType === "PERCENT" || discountType === "PERCENTAGE") ? "PERCENT" : "FIXED",
        value: parseFloat(value) || 10,
        minOrder: parseFloat(minOrder) || 0,
        maxUses: parsedMaxUses,
        oncePerUser: Boolean(oncePerUser),
        applicableBranchIds: formattedBranchIds,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    notifyPromosUpdated();

    res.status(201).json({ success: true, promoCode: created });
  } catch (error) {
    console.error("Create promo code error:", error);
    res.status(500).json({ error: "فشل إنشاء كوبون الخصم (قد يكون الكود مسجل بالفعل)" });
  }
});

// 3. تعديل كوبون خصم (الكود، القيمة، الحد الأقصى للاستخدام، الفروع المحددة، التفعيل، إلخ)
router.put("/promo-codes/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { code, discountType, value, minOrder, maxUses, oncePerUser, expiresAt, isActive, applicableBranchIds } = req.body;

    const updateData: any = {};
    if (code !== undefined && String(code).trim()) {
      updateData.code = String(code).trim().toUpperCase();
    }
    if (discountType !== undefined) {
      updateData.discountType = (discountType === "PERCENT" || discountType === "PERCENTAGE") ? "PERCENT" : "FIXED";
    }
    if (value !== undefined) {
      updateData.value = Math.max(0, parseFloat(value) || 0);
    }
    if (minOrder !== undefined) {
      updateData.minOrder = Math.max(0, parseFloat(minOrder) || 0);
    }
    if (maxUses !== undefined) {
      updateData.maxUses = maxUses !== null && String(maxUses).trim() !== "" && Number(maxUses) > 0
        ? parseInt(maxUses)
        : null;
    }
    if (oncePerUser !== undefined) {
      updateData.oncePerUser = Boolean(oncePerUser);
    }
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }
    if (applicableBranchIds !== undefined) {
      if (applicableBranchIds && Array.isArray(applicableBranchIds) && applicableBranchIds.length > 0) {
        updateData.applicableBranchIds = JSON.stringify(applicableBranchIds);
      } else if (typeof applicableBranchIds === 'string' && applicableBranchIds.trim() && applicableBranchIds !== 'ALL') {
        try {
          const parsed = JSON.parse(applicableBranchIds);
          updateData.applicableBranchIds = Array.isArray(parsed) && parsed.length > 0 ? JSON.stringify(parsed) : null;
        } catch {
          const arr = applicableBranchIds.split(',').map(s => s.trim()).filter(Boolean);
          updateData.applicableBranchIds = arr.length > 0 ? JSON.stringify(arr) : null;
        }
      } else {
        updateData.applicableBranchIds = null;
      }
    }

    const updated = await prisma.promoCode.update({
      where: { id },
      data: updateData,
    });

    notifyPromosUpdated();

    res.json({ success: true, promoCode: updated });
  } catch (error) {
    console.error("Update promo code error:", error);
    res.status(500).json({ error: "فشل تحديث بيانات الكوبون" });
  }
});

// 4. حذف كوبون خصم
router.delete("/promo-codes/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.promoCode.delete({ where: { id } });

    notifyPromosUpdated();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف الكوبون" });
  }
});

// ==========================================
// إدارة عروض الفلاش والبريك الموقوتة (Flash Deals)
// ==========================================

// 1. جلب كافة عروض الفلاش الموقوتة
router.get("/flash-deals", async (_req: AuthRequest, res: Response) => {
  try {
    const deals = await prisma.flashDeal.findMany({
      include: {
        branch: {
          select: { id: true, name: true, slug: true, logoUrl: true }
        }
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }]
    });
    res.json(deals);
  } catch (error) {
    console.error("Get admin flash deals error:", error);
    res.status(500).json({ error: "فشل استرجاع عروض الفلاش" });
  }
});

// 2. إنشاء عرض فلاش موقوت جديد
router.post("/flash-deals", async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      subtitle,
      dealType,
      branchId,
      menuItemId,
      originalPrice,
      discountPrice,
      discountPercent,
      promoCode,
      badgeText,
      imageUrl,
      maxQuantity,
      isUnlimited,
      maxPerUser,
      isRecurring,
      recurringDays,
      dailyStartTime,
      dailyEndTime,
      expiresAt,
      isActive,
      displayOrder
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: "عنوان العرض مطلوب" });
      return;
    }

    const resolvedExpiresAt = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + 365 * 24 * 3600 * 1000);

    const origPrice = originalPrice !== undefined && originalPrice !== "" && !isNaN(Number(originalPrice)) ? Number(originalPrice) : null;
    const discPrice = discountPrice !== undefined && discountPrice !== "" && !isNaN(Number(discountPrice)) ? Number(discountPrice) : null;
    let discPercent = discountPercent !== undefined && discountPercent !== "" && !isNaN(Number(discountPercent)) ? parseInt(discountPercent) : null;
    if (!discPercent && origPrice && discPrice && origPrice > discPrice) {
      discPercent = Math.round(((origPrice - discPrice) / origPrice) * 100);
    }

    const deal = await prisma.flashDeal.create({
      data: {
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        dealType: dealType || "COMBO",
        branchId: branchId && String(branchId).trim() ? String(branchId).trim() : null,
        menuItemId: menuItemId && String(menuItemId).trim() ? String(menuItemId).trim() : null,
        originalPrice: origPrice,
        discountPrice: discPrice,
        discountPercent: discPercent,
        promoCode: promoCode ? promoCode.trim().toUpperCase() : null,
        badgeText: badgeText ? badgeText.trim() : "عرض البريك 🔥",
        imageUrl: imageUrl ? imageUrl.trim() : null,
        maxQuantity: isUnlimited ? null : (maxQuantity !== undefined && maxQuantity !== "" && !isNaN(Number(maxQuantity)) ? Math.max(1, parseInt(maxQuantity)) : null),
        isUnlimited: Boolean(isUnlimited),
        maxPerUser: maxPerUser !== undefined && maxPerUser !== "" && !isNaN(Number(maxPerUser)) ? Math.max(1, parseInt(maxPerUser)) : null,
        isRecurring: Boolean(isRecurring),
        recurringDays: recurringDays ? String(recurringDays).trim() : null,
        dailyStartTime: dailyStartTime ? String(dailyStartTime).trim() : null,
        dailyEndTime: dailyEndTime ? String(dailyEndTime).trim() : null,
        expiresAt: resolvedExpiresAt,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) || 0 : 0
      },
      include: {
        branch: { select: { id: true, name: true, slug: true, logoUrl: true } }
      }
    });

    notifyFlashDealsUpdated();
    if (deal.branchId) {
      notifyBranchMenuChanged(deal.branchId);
    }

    res.status(201).json({ success: true, deal });
  } catch (error) {
    console.error("Create flash deal error:", error);
    res.status(500).json({ error: "فشل إنشاء عرض الفلاش" });
  }
});

// 3. تعديل عرض فلاش موقوت
router.put("/flash-deals/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      title,
      subtitle,
      dealType,
      branchId,
      menuItemId,
      originalPrice,
      discountPrice,
      discountPercent,
      promoCode,
      badgeText,
      imageUrl,
      maxQuantity,
      isUnlimited,
      maxPerUser,
      isRecurring,
      recurringDays,
      dailyStartTime,
      dailyEndTime,
      expiresAt,
      isActive,
      displayOrder
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: "عنوان العرض مطلوب" });
      return;
    }

    const origPrice = originalPrice !== undefined && originalPrice !== "" && !isNaN(Number(originalPrice)) ? Number(originalPrice) : null;
    const discPrice = discountPrice !== undefined && discountPrice !== "" && !isNaN(Number(discountPrice)) ? Number(discountPrice) : null;
    let discPercent = discountPercent !== undefined && discountPercent !== "" && !isNaN(Number(discountPercent)) ? parseInt(discountPercent) : null;
    if (!discPercent && origPrice && discPrice && origPrice > discPrice) {
      discPercent = Math.round(((origPrice - discPrice) / origPrice) * 100);
    }

    const updated = await prisma.flashDeal.update({
      where: { id },
      data: {
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        dealType: dealType || "COMBO",
        branchId: branchId && String(branchId).trim() ? String(branchId).trim() : null,
        menuItemId: menuItemId && String(menuItemId).trim() ? String(menuItemId).trim() : null,
        originalPrice: origPrice,
        discountPrice: discPrice,
        discountPercent: discPercent,
        promoCode: promoCode ? promoCode.trim().toUpperCase() : null,
        badgeText: badgeText ? badgeText.trim() : "عرض البريك 🔥",
        imageUrl: imageUrl ? imageUrl.trim() : null,
        maxQuantity: isUnlimited ? null : (maxQuantity !== undefined && maxQuantity !== "" && !isNaN(Number(maxQuantity)) ? Math.max(1, parseInt(maxQuantity)) : null),
        isUnlimited: isUnlimited !== undefined ? Boolean(isUnlimited) : undefined,
        maxPerUser: maxPerUser !== undefined ? (maxPerUser !== "" && !isNaN(Number(maxPerUser)) ? Math.max(1, parseInt(maxPerUser)) : null) : undefined,
        isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : undefined,
        recurringDays: recurringDays !== undefined ? (recurringDays ? String(recurringDays).trim() : null) : undefined,
        dailyStartTime: dailyStartTime !== undefined ? (dailyStartTime ? String(dailyStartTime).trim() : null) : undefined,
        dailyEndTime: dailyEndTime !== undefined ? (dailyEndTime ? String(dailyEndTime).trim() : null) : undefined,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(displayOrder !== undefined ? { displayOrder: parseInt(displayOrder) || 0 } : {})
      },
      include: {
        branch: { select: { id: true, name: true, slug: true, logoUrl: true } }
      }
    });

    notifyFlashDealsUpdated();
    if (updated.branchId) {
      notifyBranchMenuChanged(updated.branchId);
    }

    res.json({ success: true, deal: updated });
  } catch (error) {
    console.error("Update flash deal error:", error);
    res.status(500).json({ error: "فشل تحديث عرض الفلاش" });
  }
});

// 4. حذف عرض فلاش موقوت
router.delete("/flash-deals/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.flashDeal.findUnique({ where: { id } });
    await prisma.flashDeal.delete({ where: { id } });

    notifyFlashDealsUpdated();
    if (existing?.branchId) {
      notifyBranchMenuChanged(existing.branchId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete flash deal error:", error);
    res.status(500).json({ error: "فشل حذف عرض الفلاش" });
  }
});

// 5. تبديل حالة التفعيل
router.patch("/flash-deals/:id/toggle", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const deal = await prisma.flashDeal.findUnique({ where: { id } });
    if (!deal) {
      res.status(404).json({ error: "عرض الفلاش غير موجود" });
      return;
    }

    const updated = await prisma.flashDeal.update({
      where: { id },
      data: { isActive: !deal.isActive }
    });

    notifyFlashDealsUpdated();
    if (updated.branchId) {
      notifyBranchMenuChanged(updated.branchId);
    }

    res.json({ success: true, isActive: updated.isActive });
  } catch (error) {
    console.error("Toggle flash deal error:", error);
    res.status(500).json({ error: "فشل تغيير حالة عرض الفلاش" });
  }
});

// 5. حالة بوت الواتساب التلقائي (QR Code و حالة الاتصال)
router.get("/whatsapp/status", async (_req: AuthRequest, res: Response) => {
  try {
    const { whatsappService } = await import("../services/whatsapp.service.js");
    res.json(whatsappService.getStatus());
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع حالة الواتساب" });
  }
});

// 5.1 استرجاع كافة حسابات الواتساب المرتبطة وحالتها وتخصيصاتها
router.get("/whatsapp/accounts", async (_req: AuthRequest, res: Response) => {
  try {
    const { whatsappService } = await import("../services/whatsapp.service.js");
    const accounts = await whatsappService.getAllAccountsStatus();
    res.json(accounts);
  } catch (error) {
    console.error("Get whatsapp accounts error:", error);
    res.status(500).json({ error: "فشل جلب قائمة حسابات الواتساب" });
  }
});

// 5.2 إضافة حساب واتساب جديد لتوليد رمز QR خاص به
router.post("/whatsapp/accounts", async (req: AuthRequest, res: Response) => {
  try {
    const { name, sendOtp, sendAdminAlerts, sendCustomerOrders, branchId, isDefault } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: "يرجى كتابة اسم تعريفي لحساب الواتساب" });
      return;
    }
    const { whatsappService } = await import("../services/whatsapp.service.js");
    const newAcc = await whatsappService.createAccount({
      name,
      sendOtp,
      sendAdminAlerts,
      sendCustomerOrders,
      branchId,
      isDefault
    });
    res.json({ success: true, account: newAcc });
  } catch (error: any) {
    console.error("Create whatsapp account error:", error);
    res.status(500).json({ error: error?.message || "فشل إضافة حساب الواتساب" });
  }
});

// 5.3 تعديل إعدادات وأدوار حساب واتساب
router.put("/whatsapp/accounts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { whatsappService } = await import("../services/whatsapp.service.js");
    const updated = await whatsappService.updateAccount(id, req.body);
    res.json({ success: true, account: updated });
  } catch (error: any) {
    console.error("Update whatsapp account error:", error);
    res.status(500).json({ error: error?.message || "فشل تعديل حساب الواتساب" });
  }
});

// 5.4 فصل جلسة حساب معين لإعادة مسح الـ QR
router.post("/whatsapp/accounts/:id/disconnect", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { whatsappService } = await import("../services/whatsapp.service.js");
    await whatsappService.disconnect(id);
    res.json({ success: true, message: "تم فصل الجلسة، جاري تجهيز رمز QR جديد" });
  } catch (error: any) {
    console.error("Disconnect whatsapp account error:", error);
    res.status(500).json({ error: error?.message || "فشل فصل جلسة الواتساب" });
  }
});

// 5.5 إعادة توليد رمز QR لحساب معين
router.post("/whatsapp/accounts/:id/refresh-qr", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { whatsappService } = await import("../services/whatsapp.service.js");
    await whatsappService.refreshQr(id);
    res.json({ success: true, message: "تم تحديث رمز الـ QR بنجاح" });
  } catch (error: any) {
    console.error("Refresh whatsapp account QR error:", error);
    res.status(500).json({ error: error?.message || "فشل تحديث رمز QR" });
  }
});

// 5.6 حذف حساب واتساب نهائياً
router.delete("/whatsapp/accounts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { whatsappService } = await import("../services/whatsapp.service.js");
    await whatsappService.deleteAccount(id);
    res.json({ success: true, message: "تم حذف حساب الواتساب بنجاح" });
  } catch (error: any) {
    console.error("Delete whatsapp account error:", error);
    res.status(500).json({ error: error?.message || "فشل حذف حساب الواتساب" });
  }
});

// 6. فصل جلسة الواتساب الافتراضية لإعادة الربط برقم آخر
router.post("/whatsapp/disconnect", async (_req: AuthRequest, res: Response) => {
  try {
    const { whatsappService } = await import("../services/whatsapp.service.js");
    await whatsappService.disconnect();
    res.json({ success: true, message: "تم فصل الجلسة، جاري تجهيز رمز QR جديد" });
  } catch (error) {
    res.status(500).json({ error: "فشل فصل جلسة الواتساب" });
  }
});

// 7. إعادة تعيين كلمة مرور طالب مباشرة من لوحة الأدمن
router.put("/users/:id/reset-password", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: "كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام" });
      return;
    }

    const bcrypt = (await import("bcryptjs")).default;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: `تم تعيين كلمة المرور الجديدة للعميل (${user.name}) بنجاح` });
  } catch (error) {
    console.error("Admin reset user password error:", error);
    res.status(500).json({ error: "فشل تعيين كلمة المرور للعميل" });
  }
});

// 8. تغيير كلمة مرور السوبر أدمن
router.put("/change-password", async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "يرجى إدخال كلمة المرور الحالية وكلمة المرور الجديدة" });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام" });
      return;
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== "SUPERADMIN") {
      res.status(403).json({ error: "غير مصرح لك بتغيير كلمة مرور الإدارة" });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: "تم تغيير كلمة مرور لوحة الإدارة بنجاح 🔒" });
  } catch (error) {
    console.error("Change admin password error:", error);
    res.status(500).json({ error: "فشل تغيير كلمة المرور" });
  }
});

// 9. استرجاع إعدادات نظام نقاط الولاء والمكافآت
router.get("/settings/loyalty", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getLoyaltySettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب إعدادات نقاط الولاء" });
  }
});

// 10. تحديث وتفعيل/تعطيل نظام نقاط الولاء والمكافآت
router.put("/settings/loyalty", async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, pointsPerPound, pointsRedemptionRate, minPointsToRedeem, welcomePoints } = req.body;
    const updated = await updateLoyaltySettings({
      enabled,
      pointsPerPound,
      pointsRedemptionRate,
      minPointsToRedeem,
      welcomePoints,
    });
    res.json({
      success: true,
      message: "تم حفظ وتحديث إعدادات نقاط الولاء بنجاح ✅",
      settings: updated,
    });
  } catch (error) {
    console.error("Update loyalty settings error:", error);
    res.status(500).json({ error: "فشل تحديث إعدادات نقاط الولاء" });
  }
});

// 10.1 استرجاع إعدادات قنوات التواصل (قسم انضم كشريك)
router.get("/settings/contact-channels", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getContactChannelsSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب إعدادات قنوات التواصل" });
  }
});

// 10.2 تحديث إعدادات قنوات التواصل (قسم انضم كشريك)
router.put("/settings/contact-channels", async (req: AuthRequest, res: Response) => {
  try {
    const updated = await updateContactChannelsSettings(req.body);
    res.json({
      success: true,
      message: "تم حفظ وتحديث إعدادات قنوات التواصل بنجاح ✅",
      settings: updated,
    });
  } catch (error) {
    console.error("Update contact channels error:", error);
    res.status(500).json({ error: "فشل تحديث إعدادات قنوات التواصل" });
  }
});

// 11. استرجاع إعدادات تنبيهات وإشعارات الواتساب
router.get("/settings/whatsapp-alerts", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getWhatsAppAlertSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب إعدادات تنبيهات الواتساب" });
  }
});

// 12. تحديث إعدادات تنبيهات وإشعارات الواتساب
router.put("/settings/whatsapp-alerts", async (req: AuthRequest, res: Response) => {
  try {
    const {
      cancellationAlertPhones,
      cancellationAlertEnabled,
      unacceptedAlertPhones,
      unacceptedAlertEnabled,
      unacceptedDelayMinutes,
      dailyReportPhones,
      dailyReportEnabled,
      driverUnacceptedAlertEnabled,
      driverUnacceptedDelayMinutes,
    } = req.body;

    const updated = await updateWhatsAppAlertSettings({
      cancellationAlertPhones,
      cancellationAlertEnabled,
      unacceptedAlertPhones,
      unacceptedAlertEnabled,
      unacceptedDelayMinutes,
      dailyReportPhones,
      dailyReportEnabled,
      driverUnacceptedAlertEnabled,
      driverUnacceptedDelayMinutes,
    });

    res.json({
      success: true,
      message: "تم حفظ وتحديث إعدادات تنبيهات الواتساب بنجاح ✅",
      settings: updated,
    });
  } catch (error) {
    console.error("Update whatsapp alert settings error:", error);
    res.status(500).json({ error: "فشل حفظ إعدادات تنبيهات الواتساب" });
  }
});

// 12.2. جلب إعدادات صوت التنبيهات والإشعارات المخصصة
router.get("/settings/sound", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getNotificationSoundSettings();
    res.json(settings);
  } catch (error) {
    console.error("Get sound settings error:", error);
    res.status(500).json({ error: "فشل جلب إعدادات صوت الإشعارات" });
  }
});

// 12.3. تحديث وحفظ إعدادات صوت الإشعارات (رفع وتخصيص الصوت ومستواه)
router.put("/settings/sound", async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, soundUrl, soundName, volume } = req.body;
    const updated = await updateNotificationSoundSettings({
      enabled,
      soundUrl,
      soundName,
      volume,
    });

    // بث لحظي لجميع تطبيقات المطاعم وبوابات الطيارين لتحديث الصوت مباشرة
    notifySoundSettingsChanged(updated);

    res.json({
      success: true,
      message: "تم حفظ وتحديث نغمة الإشعارات بنجاح ✅",
      settings: updated,
    });
  } catch (error) {
    console.error("Update sound settings error:", error);
    res.status(500).json({ error: "فشل حفظ إعدادات صوت الإشعارات" });
  }
});

// 12.4. استعادة نغمة النظام الافتراضية
router.post("/settings/sound/reset", async (_req: AuthRequest, res: Response) => {
  try {
    const reset = await updateNotificationSoundSettings(DEFAULT_SOUND_SETTINGS);
    notifySoundSettingsChanged(reset);

    res.json({
      success: true,
      message: "تمت استعادة نغمة الإشعارات الافتراضية بنجاح ✅",
      settings: reset,
    });
  } catch (error) {
    console.error("Reset sound settings error:", error);
    res.status(500).json({ error: "فشل استعادة نغمة الإشعارات الافتراضية" });
  }
});

// 12.5. استرجاع إعدادات موقع المطعم الرئيسي والخرائط
router.get("/settings/restaurant-location", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getRestaurantLocationSettings();
    res.json(settings);
  } catch (error) {
    console.error("Get restaurant location error:", error);
    res.status(500).json({ error: "فشل استرجاع إعدادات موقع المطعم" });
  }
});

// 12.6. تحديث وحفظ إعدادات موقع المطعم الرئيسي والخرائط
router.put("/settings/restaurant-location", async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      res.status(400).json({ error: "إحداثيات خط العرض والطول مطلوبة" });
      return;
    }
    const updated = await updateRestaurantLocationSettings({
      name,
      address,
      lat: Number(lat),
      lng: Number(lng),
    });

    notifyRestaurantLocationChanged(updated);

    res.json({
      success: true,
      message: "تم حفظ وتحديث موقع المطعم الجغرافي بنجاح ✅",
      settings: updated,
    });
  } catch (error) {
    console.error("Update restaurant location error:", error);
    res.status(500).json({ error: "فشل حفظ إعدادات موقع المطعم" });
  }
});

// 13. إرسال التقرير المالي للشيفت الآن لأي فرع أو لجميع الفروع عبر الواتساب
router.post("/reports/send-shift-report/:branchId", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.branchId as string;
    const { customPhone } = req.body;

    const result = await sendBranchShiftWhatsAppReport(branchId, customPhone);
    if (!result.success) {
      res.status(400).json({ error: result.message || "فشل إرسال التقرير المالي" });
      return;
    }

    res.json({ success: true, message: result.message, sentCount: result.sentCount });
  } catch (error: any) {
    console.error("Send shift report error:", error);
    res.status(500).json({ error: error?.message || "فشل إرسال التقرير المالي" });
  }
});

// 14. إعادة ضبط المصنع وتصفير بيانات المنظومة بالكامل (حالة الصفر)
router.post("/system/factory-reset", async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.userId;
    const { adminPassword } = req.body;

    if (!adminPassword) {
      res.status(400).json({ error: "يرجى إدخال كلمة مرور الإدارة لتأكيد عملية التصفير" });
      return;
    }

    // التحقق الصارم من هوية السوبر أدمن قبل اتخاذ هذا الإجراء الحساس
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== "SUPERADMIN") {
      res.status(403).json({ error: "غير مصرح لك بإجراء عملية إعادة ضبط المصنع" });
      return;
    }

    const isMatch = await bcrypt.compare(adminPassword, admin.password);
    if (!isMatch) {
      res.status(401).json({ error: "كلمة المرور غير صحيحة، تم إلغاء عملية التصفير للحماية" });
      return;
    }

    // إحصاء ما سيتم حذفه للتقرير
    const [ordersCount, customersCount, groupCartsCount] = await Promise.all([
      prisma.order.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.groupCart.count(),
    ]);

    // تنفيذ الحذف الشامل لبيانات التشغيل والاختبار مع الحفاظ التام على هيكل المطاعم والمنيو والسوبر أدمن
    await prisma.$transaction([
      // 1. حذف عناصر الطلبات والطلبات بالكامل
      prisma.orderItem.deleteMany({}),
      prisma.order.deleteMany({}),

      // 2. حذف السلات الجماعية وعناصرها
      prisma.groupCartItem.deleteMany({}),
      prisma.groupCart.deleteMany({}),

      // 3. حذف توكنات التحقق واسترجاع كلمات المرور
      prisma.passwordResetToken.deleteMany({}),
      prisma.phoneVerificationToken.deleteMany({}),

      // 4. حذف عناوين وحسابات العملاء والطلاب المسجلين
      prisma.userAddress.deleteMany({}),
      prisma.user.deleteMany({ where: { role: "CUSTOMER" } }),

      // 5. تصفير عداد استخدام كوبونات الخصم
      prisma.promoCode.updateMany({
        data: { usedCount: 0 },
      }),
    ]);

    res.json({
      success: true,
      message: "تم تصفير المشروع وإعادته إلى حالة الصفر بنجاح ✅",
      details: {
        deletedOrders: ordersCount,
        deletedCustomers: customersCount,
        deletedGroupCarts: groupCartsCount,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    console.error("Factory reset error:", error);
    res.status(500).json({ error: "فشل تنفيذ عملية إعادة ضبط المصنع: " + (error?.message || "") });
  }
});

// =========================================================================
// 15. إدارة كباتن التوصيل (الطيارين) من لوحة تحكم الإدارة (Admin Driver Management)
// =========================================================================

// 15.1 جلب جميع كباتن التوصيل مع نطاق المطاعم المعتمدة لكل منهم
router.get("/drivers", async (_req: AuthRequest, res: Response) => {
  try {
    const drivers = await prisma.deliveryDriver.findMany({
      include: {
        branch: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, logoUrl: true },
    });
    const branchMap = new Map(branches.map(b => [b.id, b]));

    const enrichedDrivers = await Promise.all(
      drivers.map(async (d) => {
        const config = await getDriverBranchConfig(d.id, d.branchId);
        const servedBranches = config.isAllBranches
          ? branches
          : config.branchIds.map(bId => branchMap.get(bId) || { id: bId, name: "فرع محذوف", logoUrl: null });

        return {
          id: d.id,
          name: d.name,
          phone: d.phone,
          username: d.username,
          isActive: d.isActive,
          createdAt: d.createdAt,
          primaryBranch: d.branch,
          isAllBranches: config.isAllBranches,
          branchIds: config.isAllBranches ? branches.map(b => b.id) : config.branchIds,
          servedBranches,
          _count: d._count,
        };
      })
    );

    res.json(enrichedDrivers);
  } catch (error) {
    console.error("Admin get drivers error:", error);
    res.status(500).json({ error: "فشل استرجاع قائمة كباتن التوصيل" });
  }
});

// 15.2 إضافة كابتن توصيل جديد (عام لجميع المطاعم أو مطاعم محددة)
router.post("/drivers", async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, username, password, isAllBranches, branchIds, primaryBranchId } = req.body;

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

    // تحديد الفرع الأساسي للربط في قاعدة البيانات
    let finalBranchId = primaryBranchId;
    if (!finalBranchId) {
      if (Array.isArray(branchIds) && branchIds.length > 0) {
        finalBranchId = branchIds[0];
      } else {
        const firstBranch = await prisma.branch.findFirst({ select: { id: true } });
        finalBranchId = firstBranch?.id;
      }
    }

    if (!finalBranchId) {
      res.status(400).json({ error: "يجب وجود فرع واحد على الأقل مسجل في المنظومة لربط الطيار به" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const driver = await prisma.deliveryDriver.create({
      data: {
        branchId: finalBranchId,
        name: name.trim(),
        phone: phone.trim(),
        username: username.trim(),
        password: hashedPassword,
        isActive: true,
      },
      include: {
        branch: { select: { id: true, name: true, logoUrl: true } },
      },
    });

    const isAll = Boolean(isAllBranches);
    const selectedBranchIds = isAll ? [] : (Array.isArray(branchIds) ? branchIds : [finalBranchId]);

    const config = await setDriverBranchConfig(driver.id, {
      isAllBranches: isAll,
      branchIds: selectedBranchIds,
    });

    res.status(201).json({
      success: true,
      message: "تمت إضافة كابتن التوصيل بنجاح ✅",
      driver: {
        ...driver,
        isAllBranches: config.isAllBranches,
        branchIds: config.branchIds,
      },
    });
  } catch (error) {
    console.error("Admin create driver error:", error);
    res.status(500).json({ error: "فشل إضافة كابتن التوصيل" });
  }
});

// 15.3 تعديل بيانات ونطاق عمل كابتن التوصيل
router.put("/drivers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, phone, username, password, isActive, isAllBranches, branchIds } = req.body;

    const driver = await prisma.deliveryDriver.findUnique({ where: { id } });
    if (!driver) {
      res.status(404).json({ error: "كابتن التوصيل غير موجود" });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (username && username.trim() !== driver.username) {
      const existing = await prisma.deliveryDriver.findUnique({ where: { username: username.trim() } });
      if (existing) {
        res.status(400).json({ error: "اسم المستخدم الجديد مسجل مسبقاً لطيار آخر" });
        return;
      }
      updateData.username = username.trim();
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.deliveryDriver.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { orders: true } },
      },
    });

    let config = await getDriverBranchConfig(id, updated.branchId);
    if (isAllBranches !== undefined || branchIds !== undefined) {
      config = await setDriverBranchConfig(id, {
        isAllBranches: isAllBranches !== undefined ? Boolean(isAllBranches) : config.isAllBranches,
        branchIds: Array.isArray(branchIds) ? branchIds : config.branchIds,
      });
    }

    res.json({
      success: true,
      message: "تم تعديل بيانات كابتن التوصيل بنجاح ✅",
      driver: {
        ...updated,
        isAllBranches: config.isAllBranches,
        branchIds: config.branchIds,
      },
    });
  } catch (error) {
    console.error("Admin update driver error:", error);
    res.status(500).json({ error: "فشل تعديل بيانات كابتن التوصيل" });
  }
});

// 15.4 تفعيل / إيقاف حساب كابتن توصيل سريعاً
router.patch("/drivers/:id/toggle-active", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const driver = await prisma.deliveryDriver.findUnique({ where: { id } });
    if (!driver) {
      res.status(404).json({ error: "كابتن التوصيل غير موجود" });
      return;
    }

    const updated = await prisma.deliveryDriver.update({
      where: { id },
      data: { isActive: !driver.isActive },
    });

    res.json({ success: true, isActive: updated.isActive });
  } catch (error) {
    res.status(500).json({ error: "فشل تغيير حالة الطيار" });
  }
});

// 15.5 حذف كابتن توصيل
router.delete("/drivers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.deliveryDriver.delete({ where: { id } });
    await deleteDriverBranchConfig(id);

    res.json({ success: true, message: "تم حذف كابتن التوصيل بنجاح ✅" });
  } catch (error) {
    console.error("Admin delete driver error:", error);
    res.status(500).json({ error: "فشل حذف كابتن التوصيل" });
  }
});

// 16. قسم الحسابات والمالية الشامل (Financial & Shifts Accounting)
router.get("/finance/report", async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, startDate, endDate, shiftMode, shiftDate } = req.query;

    let start: Date;
    let end: Date;

    if (shiftMode === "SHIFT" && shiftDate) {
      let openH = 8, openM = 0;
      let closeH = 23, closeM = 59;
      if (branchId && branchId !== "ALL") {
        const b = await prisma.branch.findUnique({ where: { id: branchId as string } });
        if (b) {
          if (b.openingTime) {
            const [h, m] = b.openingTime.split(":").map(Number);
            if (!isNaN(h)) openH = h;
            if (!isNaN(m)) openM = m;
          }
          if (b.closingTime) {
            const [h, m] = b.closingTime.split(":").map(Number);
            if (!isNaN(h)) closeH = h;
            if (!isNaN(m)) closeM = m;
          }
        }
      }
      start = new Date(`${shiftDate}T${String(openH).padStart(2, "0")}:${String(openM).padStart(2, "0")}:00`);
      if (closeH < openH) {
        const nextDay = new Date(start);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split("T")[0];
        end = new Date(`${nextDayStr}T${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}:59`);
      } else {
        end = new Date(`${shiftDate}T${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}:59`);
      }
    } else {
      if (startDate) {
        const sStr = String(startDate);
        start = sStr.includes("T") ? new Date(sStr) : new Date(`${sStr}T00:00:00`);
      } else {
        start = new Date(new Date().setHours(0, 0, 0, 0));
      }
      if (endDate) {
        const eStr = String(endDate);
        end = eStr.includes("T") ? new Date(eStr) : new Date(`${eStr}T23:59:59.999`);
      } else {
        end = new Date(new Date().setHours(23, 59, 59, 999));
      }
    }

    const whereClause: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (branchId && branchId !== "ALL") {
      whereClause.branchId = branchId as string;
    }

    const [orders, allBranches, allDrivers] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          branch: { select: { id: true, name: true, openingTime: true, closingTime: true, phone: true } },
          driver: { select: { id: true, name: true, phone: true, username: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.branch.findMany({
        select: { id: true, name: true, openingTime: true, closingTime: true, phone: true, isActive: true },
      }),
      prisma.deliveryDriver.findMany({
        select: { id: true, name: true, phone: true, username: true, isActive: true },
      }),
    ]);

    const completedOrders = orders.filter(o => o.status === "COMPLETED");
    const rejectedOrders = orders.filter(o => o.status === "REJECTED");
    const inProgressOrders = orders.filter(o => ["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(o.status));

    const totalGrossSales = completedOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const totalFoodNet = completedOrders.reduce((acc, o) => acc + (o.subtotal || 0), 0);
    const totalDeliveryFees = completedOrders.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
    const totalDiscounts = completedOrders.reduce((acc, o) => acc + (o.discount || 0) + (o.walletDiscount || 0), 0);
    const rejectedLostSales = rejectedOrders.reduce((acc, o) => acc + (o.total || 0), 0);

    // تفصيل طرق الدفع للطلبات المكتملة
    const paymentBreakdown = {
      CASH: {
        total: completedOrders.filter(o => o.paymentMethod === "CASH").reduce((acc, o) => acc + (o.total || 0), 0),
        count: completedOrders.filter(o => o.paymentMethod === "CASH").length,
        deliveryFees: completedOrders.filter(o => o.paymentMethod === "CASH").reduce((acc, o) => acc + (o.deliveryFee || 0), 0),
      },
      VODAFONE_CASH: {
        total: completedOrders.filter(o => o.paymentMethod === "VODAFONE_CASH").reduce((acc, o) => acc + (o.total || 0), 0),
        count: completedOrders.filter(o => o.paymentMethod === "VODAFONE_CASH").length,
        deliveryFees: completedOrders.filter(o => o.paymentMethod === "VODAFONE_CASH").reduce((acc, o) => acc + (o.deliveryFee || 0), 0),
      },
      INSTAPAY: {
        total: completedOrders.filter(o => o.paymentMethod === "INSTAPAY").reduce((acc, o) => acc + (o.total || 0), 0),
        count: completedOrders.filter(o => o.paymentMethod === "INSTAPAY").length,
        deliveryFees: completedOrders.filter(o => o.paymentMethod === "INSTAPAY").reduce((acc, o) => acc + (o.deliveryFee || 0), 0),
      },
      CARD: {
        total: completedOrders.filter(o => o.paymentMethod === "CARD").reduce((acc, o) => acc + (o.total || 0), 0),
        count: completedOrders.filter(o => o.paymentMethod === "CARD").length,
        deliveryFees: completedOrders.filter(o => o.paymentMethod === "CARD").reduce((acc, o) => acc + (o.deliveryFee || 0), 0),
      },
    };

    // تفصيل أداء ومبيعات كل فرع
    const branchBreakdown = allBranches.map(b => {
      const bOrders = orders.filter(o => o.branchId === b.id);
      const bCompleted = bOrders.filter(o => o.status === "COMPLETED");
      const bRejected = bOrders.filter(o => o.status === "REJECTED");
      const grossSales = bCompleted.reduce((acc, o) => acc + (o.total || 0), 0);
      const foodNet = bCompleted.reduce((acc, o) => acc + (o.subtotal || 0), 0);
      const deliveryFees = bCompleted.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
      const cashSales = bCompleted.filter(o => o.paymentMethod === "CASH").reduce((acc, o) => acc + (o.total || 0), 0);
      const electronicSales = bCompleted.filter(o => o.paymentMethod !== "CASH").reduce((acc, o) => acc + (o.total || 0), 0);

      return {
        branchId: b.id,
        branchName: b.name,
        openingTime: b.openingTime,
        closingTime: b.closingTime,
        phone: b.phone,
        totalOrders: bOrders.length,
        completedCount: bCompleted.length,
        rejectedCount: bRejected.length,
        grossSales,
        foodNet,
        deliveryFees,
        cashSales,
        electronicSales,
      };
    }).sort((a, b) => b.grossSales - a.grossSales);

    // تفصيل حسابات كباتن التوصيل (الطيارين)
    const driversBreakdown = allDrivers.map(d => {
      const dOrders = orders.filter(o => o.driverId === d.id);
      const dCompleted = dOrders.filter(o => o.status === "COMPLETED");
      const totalOrdersValue = dCompleted.reduce((acc, o) => acc + (o.total || 0), 0);
      // الكاش الذي حصله الطيار في يده من العملاء
      const cashCollectedInHand = dCompleted.filter(o => o.paymentMethod === "CASH").reduce((acc, o) => acc + (o.total || 0), 0);
      // المبالغ المحصلة أونلاين/محافظ
      const electronicOrdersValue = dCompleted.filter(o => o.paymentMethod !== "CASH").reduce((acc, o) => acc + (o.total || 0), 0);
      // إجمالي خدمة التوصيل المستحقة للطيار (أجرة الطيار)
      const totalDeliveryFeesEarned = dCompleted.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
      // صافي الحساب (الكاش المحصل ناقص عمولة التوصيل للطيار = ما يجب على الطيار تسليمه للإدارة/المطعم)
      const netCashToDeliver = cashCollectedInHand - totalDeliveryFeesEarned;

      return {
        driverId: d.id,
        driverName: d.name,
        driverPhone: d.phone,
        driverUsername: d.username,
        isActive: d.isActive,
        totalAssignedOrders: dOrders.length,
        deliveredOrdersCount: dCompleted.length,
        totalOrdersValue,
        cashCollectedInHand,
        electronicOrdersValue,
        totalDeliveryFeesEarned,
        netCashToDeliver,
        orders: dOrders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          branchName: o.branch?.name || "مطعم غير محدد",
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          addressText: o.addressText,
          deliveryZoneName: o.deliveryZoneName,
          paymentMethod: o.paymentMethod,
          total: o.total,
          deliveryFee: o.deliveryFee,
          status: o.status,
          createdAt: o.createdAt,
          completedAt: o.completedAt,
        })),
      };
    }).sort((a, b) => b.deliveredOrdersCount - a.deliveredOrdersCount);

    // أفضل الأصناف مبيعاً في الفترة
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
    const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 10);

    res.json({
      success: true,
      timeframe: {
        start: start.toISOString(),
        end: end.toISOString(),
        shiftMode: shiftMode || "CUSTOM",
        shiftDate: shiftDate || null,
        branchId: branchId || "ALL",
      },
      summary: {
        totalOrdersCount: orders.length,
        completedOrdersCount: completedOrders.length,
        rejectedOrdersCount: rejectedOrders.length,
        inProgressOrdersCount: inProgressOrders.length,
        totalGrossSales,
        totalFoodNet,
        totalDeliveryFees,
        totalDiscounts,
        rejectedLostSales,
      },
      paymentBreakdown,
      branchBreakdown,
      driversBreakdown,
      topItems,
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        branchId: o.branchId,
        branchName: o.branch?.name || "مطعم غير محدد",
        driverId: o.driverId,
        driverName: o.driver?.name || null,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        addressText: o.addressText,
        deliveryZoneName: o.deliveryZoneName,
        paymentMethod: o.paymentMethod,
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        discount: o.discount + o.walletDiscount,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        completedAt: o.completedAt,
        itemsCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
      })),
    });
  } catch (error) {
    console.error("Admin finance report error:", error);
    res.status(500).json({ error: "فشل توليد التقرير المالي وحسابات الشيفتات" });
  }
});

// تصدير التقارير المالية والشيفتات مباشرة كملف إكسل عبر السيرفر للموبايل والديسكتوب
router.get("/finance/export-excel", async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, startDate, endDate, shiftMode, shiftDate, type = "shifts" } = req.query;

    let start: Date;
    let end: Date;

    if (shiftMode === "SHIFT" && shiftDate) {
      let openH = 8, openM = 0;
      let closeH = 23, closeM = 59;
      if (branchId && branchId !== "ALL") {
        const b = await prisma.branch.findUnique({ where: { id: branchId as string } });
        if (b) {
          if (b.openingTime) {
            const [h, m] = b.openingTime.split(":").map(Number);
            if (!isNaN(h)) openH = h;
            if (!isNaN(m)) openM = m;
          }
          if (b.closingTime) {
            const [h, m] = b.closingTime.split(":").map(Number);
            if (!isNaN(h)) closeH = h;
            if (!isNaN(m)) closeM = m;
          }
        }
      }
      start = new Date(`${shiftDate}T${String(openH).padStart(2, "0")}:${String(openM).padStart(2, "0")}:00`);
      if (closeH < openH) {
        const nextDay = new Date(start);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split("T")[0];
        end = new Date(`${nextDayStr}T${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}:59`);
      } else {
        end = new Date(`${shiftDate}T${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}:59`);
      }
    } else {
      if (startDate) {
        const sStr = String(startDate);
        start = sStr.includes("T") ? new Date(sStr) : new Date(`${sStr}T00:00:00`);
      } else {
        start = new Date(new Date().setHours(0, 0, 0, 0));
      }
      if (endDate) {
        const eStr = String(endDate);
        end = eStr.includes("T") ? new Date(eStr) : new Date(`${eStr}T23:59:59.999`);
      } else {
        end = new Date(new Date().setHours(23, 59, 59, 999));
      }
    }

    const whereClause: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (branchId && branchId !== "ALL") {
      whereClause.branchId = branchId as string;
    }

    const [orders, allBranches, allDrivers] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          branch: { select: { id: true, name: true, openingTime: true, closingTime: true, phone: true } },
          driver: { select: { id: true, name: true, phone: true, username: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.branch.findMany({
        select: { id: true, name: true, openingTime: true, closingTime: true, phone: true, isActive: true },
      }),
      prisma.deliveryDriver.findMany({
        select: { id: true, name: true, phone: true, username: true, isActive: true },
      }),
    ]);

    const completedOrders = orders.filter(o => o.status === "COMPLETED");
    const dateTag = new Date().toISOString().split("T")[0];
    let rows: (string | number)[][] = [];
    let filename = `تقرير_${dateTag}`;

    if (type === "shifts") {
      filename = `تقرير_شيفتات_ومبيعات_الفروع_${dateTag}`;
      rows = [
        ["تقرير مبيعات وشيفتات فروع UniFood"],
        ["الفترة من", start.toLocaleString("ar-EG"), "إلى", end.toLocaleString("ar-EG")],
        ["نظام الفلترة", shiftMode === "SHIFT" ? "شيفت يومي للفرع" : "فترة مخصصة بالوقت"],
        [],
        [
          "اسم المطعم / الفرع",
          "وقت الفتح",
          "وقت الإغلاق",
          "إجمالي المبيعات (ج.م)",
          "صافي مبيعات الوجبات (ج.م)",
          "رسوم التوصيل (ج.م)",
          "المحصل كاش (ج.م)",
          "المحصل إلكتروني / محافظ (ج.م)",
          "الطلبات المكتملة",
          "الطلبات الملغاة",
          "إجمالي الطلبات",
        ],
      ];

      allBranches.forEach(b => {
        const bOrders = orders.filter(o => o.branchId === b.id);
        const bCompleted = bOrders.filter(o => o.status === "COMPLETED");
        const bRejected = bOrders.filter(o => o.status === "REJECTED");
        const gross = bCompleted.reduce((acc, o) => acc + (o.total || 0), 0);
        const food = bCompleted.reduce((acc, o) => acc + (o.subtotal || 0), 0);
        const deliv = bCompleted.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
        const cash = bCompleted.filter(o => o.paymentMethod === "CASH").reduce((acc, o) => acc + (o.total || 0), 0);
        const elec = bCompleted.filter(o => o.paymentMethod !== "CASH").reduce((acc, o) => acc + (o.total || 0), 0);

        rows.push([
          b.name,
          b.openingTime || "08:00",
          b.closingTime || "22:00",
          gross.toFixed(2),
          food.toFixed(2),
          deliv.toFixed(2),
          cash.toFixed(2),
          elec.toFixed(2),
          bCompleted.length,
          bRejected.length,
          bOrders.length,
        ]);
      });
    } else if (type === "drivers") {
      filename = `كشف_حساب_الطيارين_والتوصيل_${dateTag}`;
      rows = [
        ["كشف حسابات وتصفية كباتن التوصيل (الطيارين) - UniFood"],
        ["الفترة من", start.toLocaleString("ar-EG"), "إلى", end.toLocaleString("ar-EG")],
        [],
        [
          "اسم كابتن التوصيل",
          "رقم الهاتف",
          "اسم المستخدم",
          "عدد الطلبات المسلمة بنجاح",
          "إجمالي مبالغ الطلبات (ج.م)",
          "الكاش المحصل في يد الطيار (ج.م)",
          "مبالغ الدفع الإلكتروني (ج.م)",
          "إجمالي رسوم التوصيل المستحقة للطيار (أجرة التوصيل)",
          "صافي الحساب (الكاش المطلوب تسليمه للإدارة)",
        ],
      ];

      allDrivers.forEach(d => {
        const dOrders = orders.filter(o => o.driverId === d.id);
        const dCompleted = dOrders.filter(o => o.status === "COMPLETED");
        const totalVal = dCompleted.reduce((acc, o) => acc + (o.total || 0), 0);
        const cashInHand = dCompleted.filter(o => o.paymentMethod === "CASH").reduce((acc, o) => acc + (o.total || 0), 0);
        const elecVal = dCompleted.filter(o => o.paymentMethod !== "CASH").reduce((acc, o) => acc + (o.total || 0), 0);
        const fees = dCompleted.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
        const net = cashInHand - fees;

        rows.push([
          d.name,
          d.phone,
          d.username,
          dCompleted.length,
          totalVal.toFixed(2),
          cashInHand.toFixed(2),
          elecVal.toFixed(2),
          fees.toFixed(2),
          net.toFixed(2),
        ]);
      });
    } else if (type === "orders") {
      filename = `سجل_طلبات_الفترة_${dateTag}`;
      const pmMap: Record<string, string> = {
        CASH: "كاش",
        VODAFONE_CASH: "فودافون كاش",
        INSTAPAY: "إنستاباي",
        CARD: "فيزا",
      };
      const stMap: Record<string, string> = {
        COMPLETED: "مكتمل",
        REJECTED: "ملغي",
        PENDING: "جديد",
        ACCEPTED: "مقبول",
        PREPARING: "قيد التجهيز",
        READY: "جاهز",
      };

      rows = [
        ["سجل كافة طلبات الفترة - UniFood"],
        ["الفترة من", start.toLocaleString("ar-EG"), "إلى", end.toLocaleString("ar-EG")],
        [],
        [
          "رقم الطلب",
          "المطعم / الفرع",
          "اسم العميل",
          "رقم الهاتف",
          "مكان ومبنى التسليم",
          "طريقة الدفع",
          "قيمة الوجبات (ج.م)",
          "رسوم التوصيل (ج.م)",
          "الخصم (ج.م)",
          "الإجمالي الكلي (ج.م)",
          "حالة الطلب",
          "كابتن التوصيل",
          "وقت إنشاء الطلب",
          "وقت التسليم",
        ],
      ];

      orders.forEach(o => {
        rows.push([
          `#${o.orderNumber}`,
          o.branch?.name || "",
          o.customerName,
          o.customerPhone,
          o.addressText || o.deliveryZoneName || "",
          pmMap[o.paymentMethod] || o.paymentMethod,
          (o.subtotal || 0).toFixed(2),
          (o.deliveryFee || 0).toFixed(2),
          ((o.discount || 0) + (o.walletDiscount || 0)).toFixed(2),
          (o.total || 0).toFixed(2),
          stMap[o.status] || o.status,
          o.driver?.name || "غير مسند",
          new Date(o.createdAt).toLocaleString("ar-EG"),
          o.completedAt ? new Date(o.completedAt).toLocaleString("ar-EG") : "-",
        ]);
      });
    }

    const sanitizeCsvCell = (val: string | number | null | undefined): string => {
      const str = String(val ?? "");
      if (!str || str === "-" || /^-?\d+(\.\d+)?$/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const csvContent = rows
      .map(r => r.map(c => sanitizeCsvCell(c)).join(","))
      .join("\r\n");

    const safeAsciiName = `${type}_${dateTag}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}.csv`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send("\uFEFF" + csvContent);
  } catch (error) {
    console.error("Admin finance export-excel error:", error);
    res.status(500).json({ error: "فشل تصدير ملف الإكسل" });
  }
});

// حقن البيانات التجريبية الشاملة بضغطة زر من لوحة الأدمن
router.post("/seed-mock-data", async (_req: AuthRequest, res: Response) => {
  try {
    const result = await seedMockDatabase();
    notifyBranchesListChanged();
    notifyBannersUpdated();
    notifyPromosUpdated();
    res.json(result);
  } catch (error: any) {
    console.error("Admin seed-mock-data error:", error);
    res.status(500).json({ error: error?.message || "فشل حقن البيانات التجريبية" });
  }
});

// حقن وتحديث منيو مطعم ديفادو بالكامل في قاعدة البيانات بضغطة زر
router.post("/seed-divado", async (_req: AuthRequest, res: Response) => {
  try {
    const { seedDivadoBranchAndMenu } = await import("../services/divadoSeed.service.js");
    const result = await seedDivadoBranchAndMenu();
    notifyBranchesListChanged();
    res.json(result);
  } catch (error: any) {
    console.error("Admin seed-divado error:", error);
    res.status(500).json({ error: error?.message || "فشل حقن وتحديث منيو ديفادو في قاعدة البيانات" });
  }
});

// جلب جميع بلاغات وتذاكر الدعم الفني الواردة من الطلاب
router.get("/support-tickets", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "support_ticket_" } },
      orderBy: { createdAt: "desc" },
    });

    const tickets = settings
      .map((s) => {
        try {
          return JSON.parse(s.value);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    res.json({ success: true, tickets });
  } catch (error) {
    console.error("Admin get support-tickets error:", error);
    res.status(500).json({ error: "فشل جلب تذاكر الدعم الفني" });
  }
});

// تحديث حالة تذكرة دعم فني أو تسجيل ملاحظات إدارية
router.put("/support-tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const setting = await prisma.systemSetting.findUnique({
      where: { key: `support_ticket_${id}` },
    });

    if (!setting) {
      res.status(404).json({ error: "تذكرة الدعم غير موجودة" });
      return;
    }

    const ticket = JSON.parse(setting.value);
    if (status) ticket.status = status;
    if (adminNotes !== undefined) ticket.adminNotes = adminNotes;
    ticket.updatedAt = new Date().toISOString();

    await prisma.systemSetting.update({
      where: { key: `support_ticket_${id}` },
      data: { value: JSON.stringify(ticket) },
    });

    // إشعار فوري لجميع الأطراف بتحديث الشكوى
    notifySupportTicketUpdated(ticket);

    res.json({ success: true, ticket });
  } catch (error) {
    console.error("Admin update support-ticket error:", error);
    res.status(500).json({ error: "فشل تحديث تذكرة الدعم" });
  }
});

// حذف تذكرة دعم فني
router.delete("/support-tickets/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.systemSetting.deleteMany({
      where: { key: `support_ticket_${id}` },
    });

    notifySupportTicketDeleted(String(id));

    res.json({ success: true, message: "تم حذف التذكرة بنجاح" });
  } catch (error) {
    console.error("Admin delete support-ticket error:", error);
    res.status(500).json({ error: "فشل حذف التذكرة" });
  }
});

// جلب إعدادات الدعم الفني ورقم الواتساب
router.get("/support-settings", async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "support_whatsapp_phone" },
    });
    res.json({
      success: true,
      whatsappPhone: setting?.value?.trim() || "01016629986",
    });
  } catch (error) {
    console.error("Admin get support-settings error:", error);
    res.status(500).json({ error: "فشل استرجاع إعدادات الدعم" });
  }
});

// تحديث رقم واتساب استقبال البلاغات والدعم الفني
router.put("/support-settings", async (req: AuthRequest, res: Response) => {
  try {
    const { whatsappPhone } = req.body;
    if (!whatsappPhone || !String(whatsappPhone).trim()) {
      res.status(400).json({ error: "يرجى إدخال رقم هاتف الواتساب" });
      return;
    }

    const clean = String(whatsappPhone).trim();
    await prisma.systemSetting.upsert({
      where: { key: "support_whatsapp_phone" },
      update: { value: clean },
      create: { key: "support_whatsapp_phone", value: clean },
    });

    res.json({
      success: true,
      message: "تم تحديث رقم واتساب الدعم الفني بنجاح",
      whatsappPhone: clean,
    });
  } catch (error) {
    console.error("Admin update support-settings error:", error);
    res.status(500).json({ error: "فشل حفظ رقم الواتساب" });
  }
});

export default router;


