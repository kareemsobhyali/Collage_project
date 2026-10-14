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
  sendBranchShiftWhatsAppReport
} from "../services/settings.service.js";



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

    // في حال كانت قاعدة البيانات جديدة تماماً على الاستضافة ولا يوجد أي سوبر أدمن، يتم إنشاء الحساب الافتراضي تلقائياً
    const superAdminCount = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (superAdminCount === 0) {
      const defaultHashedPassword = await bcrypt.hash("123456", 10);
      await prisma.user.create({
        data: {
          name: "المدير العام للنظام",
          phone: "admin",
          password: defaultHashedPassword,
          role: "SUPERADMIN",
        },
      });
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

    res.json({ success: true, branch: updated });
  } catch (error) {
    console.error("Update branch status error:", error);
    res.status(500).json({ error: "فشل تحديث حالة الفرع" });
  }
});

// تعديل بيانات الفرع بالكامل (الاسم، العنوان، الهاتف، رسوم التوصيل، خيارات الاستلام)
router.put("/branches/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, phone, address, deliveryFee, allowDelivery, allowPickup, logoUrl, slug } = req.body;

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
        allowDelivery: allowDelivery !== undefined ? Boolean(allowDelivery) : undefined,
        allowPickup: allowPickup !== undefined ? Boolean(allowPickup) : undefined,
      },
    });

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
    } = req.body;

    const updatedConfig = await prisma.branchPaymentConfig.upsert({
      where: { branchId: id },
      update: {
        cashEnabled: cashEnabled !== undefined ? Boolean(cashEnabled) : undefined,
        vodafoneCashEnabled: vodafoneCashEnabled !== undefined ? Boolean(vodafoneCashEnabled) : undefined,
        vodafoneCashNumber: vodafoneCashNumber !== undefined ? vodafoneCashNumber : undefined,
        instapayEnabled: instapayEnabled !== undefined ? Boolean(instapayEnabled) : undefined,
        instapayHandle: instapayHandle !== undefined ? instapayHandle : undefined,
        cardEnabled: cardEnabled !== undefined ? Boolean(cardEnabled) : undefined,
      },
      create: {
        branchId: id,
        cashEnabled: cashEnabled !== undefined ? Boolean(cashEnabled) : true,
        vodafoneCashEnabled: vodafoneCashEnabled !== undefined ? Boolean(vodafoneCashEnabled) : false,
        vodafoneCashNumber: vodafoneCashNumber || null,
        instapayEnabled: instapayEnabled !== undefined ? Boolean(instapayEnabled) : false,
        instapayHandle: instapayHandle || null,
        cardEnabled: cardEnabled !== undefined ? Boolean(cardEnabled) : false,
      },
    });

    res.json({ success: true, paymentConfig: updatedConfig });
  } catch (error) {
    console.error("Update payment methods error:", error);
    res.status(500).json({ error: "فشل تحديث طرق الدفع للفرع" });
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

// تعديل أو إلغاء حالة طلب بواسطة السوبر أدمن
router.put("/orders/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: "حالة الطلب مطلوبة" });
      return;
    }

    const existingOrder = await prisma.order.findUnique({ where: { id } });
    if (!existingOrder) {
      res.status(404).json({ error: "الطلب غير موجود" });
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
    }

    let updated;
    if (status === "REJECTED" && existingOrder.status !== "REJECTED") {
      updated = await prisma.$transaction(async (tx) => {
        const orderRes = await tx.order.update({
          where: { id },
          data: updateData,
          include: { branch: true },
        });

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

        return orderRes;
      });

      // إشعار واتساب للمشرفين بإلغاء الطلب
      sendOrderCancellationWhatsAppAlert(id, "إلغاء بواسطة إدارة المنظومة").catch(() => {});
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

    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: "فشل تحديث بيانات ومحفظة الطالب" });
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

// 2. إضافة بانر إعلاني جديد
router.post("/banners", async (req: AuthRequest, res: Response) => {
  try {
    const { title, subtitle, imageUrl, badgeText, linkUrl, displayOrder, isActive } = req.body;
    if (!title) {
      res.status(400).json({ error: "عنوان البانر مطلوب" });
      return;
    }

    const banner = await prisma.banner.create({
      data: {
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        imageUrl: imageUrl ? imageUrl.trim() : "",
        badgeText: badgeText ? badgeText.trim() : null,
        linkUrl: linkUrl ? linkUrl.trim() : null,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) || 0 : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

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

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        title: title ? title.trim() : undefined,
        subtitle: subtitle !== undefined ? (subtitle ? subtitle.trim() : null) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl.trim() : undefined,
        badgeText: badgeText !== undefined ? (badgeText ? badgeText.trim() : null) : undefined,
        linkUrl: linkUrl !== undefined ? (linkUrl ? linkUrl.trim() : null) : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) || 0 : undefined,
      },
    });

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
    const { code, discountType, value, minOrder, maxUses, oncePerUser, expiresAt, isActive } = req.body;
    if (!code || value === undefined) {
      res.status(400).json({ error: "كود الخصم وقيمة الخصم مطلوبان" });
      return;
    }

    const parsedMaxUses = maxUses !== undefined && maxUses !== null && String(maxUses).trim() !== ""
      ? Math.max(1, parseInt(maxUses))
      : null;

    const created = await prisma.promoCode.create({
      data: {
        code: code.trim().toUpperCase(),
        discountType: (discountType === "PERCENT" || discountType === "PERCENTAGE") ? "PERCENT" : "FIXED",
        value: parseFloat(value) || 10,
        minOrder: parseFloat(minOrder) || 0,
        maxUses: parsedMaxUses,
        oncePerUser: Boolean(oncePerUser),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.status(201).json({ success: true, promoCode: created });
  } catch (error) {
    console.error("Create promo code error:", error);
    res.status(500).json({ error: "فشل إنشاء كوبون الخصم (قد يكون الكود مسجل بالفعل)" });
  }
});

// 3. تعديل كوبون خصم (الكود، القيمة، الحد الأقصى للاستخدام، التفعيل، إلخ)
router.put("/promo-codes/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { code, discountType, value, minOrder, maxUses, oncePerUser, expiresAt, isActive } = req.body;

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

    const updated = await prisma.promoCode.update({
      where: { id },
      data: updateData,
    });

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
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل حذف الكوبون" });
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

// 6. فصل جلسة الواتساب لإعادة الربط برقم آخر
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

    res.json({ success: true, message: `تم تعيين كلمة المرور الجديدة للطالب (${user.name}) بنجاح` });
  } catch (error) {
    console.error("Admin reset user password error:", error);
    res.status(500).json({ error: "فشل تعيين كلمة المرور للطالب" });
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
    } = req.body;

    const updated = await updateWhatsAppAlertSettings({
      cancellationAlertPhones,
      cancellationAlertEnabled,
      unacceptedAlertPhones,
      unacceptedAlertEnabled,
      unacceptedDelayMinutes,
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

// 13. إرسال التقرير المالي للشيفت الآن لأي فرع أو لجميع الفروع عبر الواتساب
router.post("/reports/send-shift-report/:branchId", async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.params.branchId as string;
    const { customPhone } = req.body;

    if (branchId === "ALL") {
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      let totalSent = 0;
      for (const b of branches) {
        const result = await sendBranchShiftWhatsAppReport(b.id, customPhone);
        if (result.success) totalSent += result.sentCount;
      }

      res.json({
        success: true,
        message: `تم إرسال التقارير المالية لجميع الفروع النشطة بنجاح (${branches.length} فرع)`,
      });
      return;
    }

    const result = await sendBranchShiftWhatsAppReport(branchId, customPhone);
    if (!result.success) {
      res.status(400).json({ error: result.message || "فشل إرسال التقرير" });
      return;
    }

    res.json({ success: true, message: result.message });
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

export default router;


