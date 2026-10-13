import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateToken, authenticateDriver, AuthRequest } from "../middleware/auth.js";
import { notifyOrderStatusChanged } from "../sockets/socketManager.js";
import { awardLoyaltyPointsIfCompleted } from "../services/settings.service.js";

const router = Router();

// 1. تسجيل دخول كابتن التوصيل (الطيار)
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    const driver = await prisma.deliveryDriver.findUnique({
      where: { username: username.trim() },
      include: {
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true },
        },
      },
    });

    if (!driver) {
      res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
      return;
    }

    if (!driver.isActive) {
      res.status(403).json({ error: "حساب الكابتن موقوف حالياً من قِبل إدارة الفرع" });
      return;
    }

    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
      return;
    }

    const token = generateToken({
      driverId: driver.id,
      branchId: driver.branchId,
      name: driver.name,
      username: driver.username,
    });

    res.json({
      success: true,
      token,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        username: driver.username,
        branchId: driver.branchId,
        branch: driver.branch,
      },
    });
  } catch (error) {
    console.error("Driver login error:", error);
    res.status(500).json({ error: "فشل تسجيل دخول الطيار" });
  }
});

// المسارات التالية تتطلب مصادقة كابتن التوصيل
router.use(authenticateDriver);

// 2. الملف الشخصي للطيار
router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const driverId = req.driver!.driverId;
    const driver = await prisma.deliveryDriver.findUnique({
      where: { id: driverId },
      include: {
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true },
        },
      },
    });

    if (!driver) {
      res.status(404).json({ error: "حساب الطيار غير موجود" });
      return;
    }

    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب بيانات الحساب" });
  }
});

// 3. جلب الطلبات المسندة للطيار
router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const driverId = req.driver!.driverId;

    const orders = await prisma.order.findMany({
      where: {
        driverId,
        status: {
          in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"],
        },
      },
      include: {
        items: true,
        branch: {
          select: { name: true, phone: true, address: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(orders);
  } catch (error) {
    console.error("Get driver orders error:", error);
    res.status(500).json({ error: "فشل جلب طلبات الطيار" });
  }
});

// 4. رفض الطلب من قِبل الطيار (فقط قبل الاستلام من الفرع)
router.put("/orders/:id/reject", async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const driverId = req.driver!.driverId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.driverId !== driverId) {
      res.status(404).json({ error: "الطلب غير مسند لك" });
      return;
    }

    if (order.driverPickedUpAt) {
      res.status(400).json({ error: "لا يمكنك الاعتذار عن الطلب بعد استلامه بالفعل من الفرع" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: null,
        driverAssignedAt: null,
      },
      include: {
        branch: true,
        items: true,
        driver: { select: { id: true, name: true, phone: true } },
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            isBlocked: true,
            restaurantNotes: true,
            _count: { select: { orders: true } },
          },
        },
      },
    });

    // إشعار الفرع فوراً لإعادة إسناد الطلب لكابتن آخر
    notifyOrderStatusChanged(order.id, order.branchId, updated);

    res.json({
      success: true,
      message: "تم الاعتذار عن استلام الطلب بنجاح وإعادته للفرع",
      order: updated,
    });
  } catch (error) {
    console.error("Driver reject order error:", error);
    res.status(500).json({ error: "فشل الاعتذار عن الطلب" });
  }
});

// 5. تأكيد الاستلام من مقر الفرع (خروج للتوصيل)
router.put("/orders/:id/pickup", async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const driverId = req.driver!.driverId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.driverId !== driverId) {
      res.status(404).json({ error: "الطلب غير مسند لك" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverPickedUpAt: new Date(),
        status: "READY", // في الطريق للتوصيل
        readyAt: order.readyAt || new Date(),
      },
      include: {
        branch: true,
        items: true,
        driver: { select: { id: true, name: true, phone: true } },
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            isBlocked: true,
            restaurantNotes: true,
            _count: { select: { orders: true } },
          },
        },
      },
    });

    // إشعار الطالب والفرع أن الوجبة استلمها الطيار وخرج بها
    notifyOrderStatusChanged(order.id, order.branchId, updated, driverId);

    res.json({
      success: true,
      message: "تم تأكيد الاستلام بنجاح، بالتوفيق في توصيل الوجبة!",
      order: updated,
    });
  } catch (error) {
    console.error("Driver pickup order error:", error);
    res.status(500).json({ error: "فشل تأكيد الاستلام من الفرع" });
  }
});

// 6. تأكيد تسليم الوجبة للعميل باستخدام رمز الأمان (PIN Verification)
router.put("/orders/:id/deliver", async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const driverId = req.driver!.driverId;
    const { pin } = req.body;

    if (!pin) {
      res.status(400).json({ error: "يرجى إدخال رمز الأمان (PIN) المكون من 4 أرقام الموضح لدى العميل" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.driverId !== driverId) {
      res.status(404).json({ error: "الطلب غير مسند لك" });
      return;
    }

    // التحقق من كود الـ PIN (إذا كان مسجلاً بالطلب)
    if (order.pickupPin && order.pickupPin !== String(pin).trim()) {
      res.status(400).json({ error: "رمز الأمان (PIN) غير صحيح! يرجى التأكد من الرقم الظاهر بشاشة هاتف العميل" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        branch: true,
        items: true,
        driver: { select: { id: true, name: true, phone: true } },
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            isBlocked: true,
            restaurantNotes: true,
            _count: { select: { orders: true } },
          },
        },
      },
    });

    // إيداع نقاط الولاء في حساب الطالب عند اكتمال واستلام الطلب
    await awardLoyaltyPointsIfCompleted(orderId);

    // إشعار الطالب والفرع باكتمال التسليم
    notifyOrderStatusChanged(order.id, order.branchId, updated, driverId);

    res.json({
      success: true,
      message: "تم تسليم الطلب بنجاح واكتمال الدورة! شكراً لك ⚡",
      order: updated,
    });
  } catch (error) {
    console.error("Driver deliver order error:", error);
    res.status(500).json({ error: "فشل تأكيد تسليم الطلب" });
  }
});

export default router;
