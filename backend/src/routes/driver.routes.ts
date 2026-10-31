import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateToken, authenticateDriver, AuthRequest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { notifyOrderStatusChanged, notifyDriverRejectedOrder, notifyDriverReturnedOrder } from "../sockets/socketManager.js";
import { awardLoyaltyPointsIfCompleted } from "../services/settings.service.js";
import { getDriverBranchConfig, markOrderAcceptedByDriver, isOrderAcceptedByDriver, clearOrderAcceptedByDriver } from "../services/driver.service.js";
import { handleDriverRejectionWithFallback } from "../services/dispatch.service.js";

const router = Router();

// نظام تتبع محاولات إدخال رموز الـ PIN لحماية الطلبات من هجمات التخمين والقوة الغاشمة (Brute-Force & PIN Spraying Defense)
const pinAttemptMap = new Map<string, { count: number; lockedUntil: number }>();

function checkPinLock(orderKey: string): { locked: boolean; retryAfterSeconds: number } {
  const entry = pinAttemptMap.get(orderKey);
  if (!entry) return { locked: false, retryAfterSeconds: 0 };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

function recordPinFailure(orderKey: string, maxAttempts = 5): { locked: boolean; remaining: number } {
  const now = Date.now();
  const entry = pinAttemptMap.get(orderKey) || { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    return { locked: true, remaining: 0 };
  }
  entry.count += 1;
  if (entry.count >= maxAttempts) {
    entry.lockedUntil = now + 15 * 60 * 1000;
    pinAttemptMap.set(orderKey, entry);
    return { locked: true, remaining: 0 };
  }
  pinAttemptMap.set(orderKey, entry);
  return { locked: false, remaining: maxAttempts - entry.count };
}

function clearPinAttempts(orderKey: string) {
  pinAttemptMap.delete(orderKey);
}

function sanitizeOrderForDriver(order: any): any {
  if (!order || typeof order !== "object") return order;
  const { pickupPin, ...safeOrder } = order;
  return safeOrder;
}

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

    const config = await getDriverBranchConfig(driver.id, driver.branchId);
    let servedBranchNames: string[] = [];
    if (config.isAllBranches) {
      servedBranchNames = ["جميع المطاعم والفروع (طيار عام)"];
    } else {
      const branches = await prisma.branch.findMany({
        where: { id: { in: config.branchIds } },
        select: { name: true },
      });
      servedBranchNames = branches.map(b => b.name);
    }

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
        isAllBranches: config.isAllBranches,
        servedBranchNames,
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

    const config = await getDriverBranchConfig(driver.id, driver.branchId);
    let servedBranchNames: string[] = [];
    if (config.isAllBranches) {
      servedBranchNames = ["جميع المطاعم والفروع (طيار عام)"];
    } else {
      const branches = await prisma.branch.findMany({
        where: { id: { in: config.branchIds } },
        select: { name: true },
      });
      servedBranchNames = branches.map(b => b.name);
    }

    const { password: _pwd, ...safeDriver } = driver;
    res.json({
      ...safeDriver,
      isAllBranches: config.isAllBranches,
      servedBranchNames,
    });
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

    const enrichedOrders = await Promise.all(
      orders.map(async (o) => {
        const isAccepted = Boolean(o.driverPickedUpAt) || (await isOrderAcceptedByDriver(o.id));
        return sanitizeOrderForDriver({
          ...o,
          isDriverAccepted: isAccepted,
        });
      })
    );

    res.json(enrichedOrders);
  } catch (error) {
    console.error("Get driver orders error:", error);
    res.status(500).json({ error: "فشل جلب طلبات الطيار" });
  }
});

// 3.1. قبول الطلب من قِبل الطيار (Driver Accept Order)
router.put("/orders/:id/accept", async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const driverId = req.driver!.driverId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        items: true,
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!order || order.driverId !== driverId) {
      res.status(404).json({ error: "الطلب غير مسند لك" });
      return;
    }

    if (order.status === "REJECTED" || order.status === "COMPLETED") {
      res.status(400).json({ error: "لا يمكن قبول طلب ملغى أو مكتمل" });
      return;
    }

    await markOrderAcceptedByDriver(orderId, driverId);

    const updated = {
      ...order,
      isDriverAccepted: true,
    };

    // إشعار الفرع فوراً بأن الطيار قبل الطلب وفي طريقه للاستلام
    notifyOrderStatusChanged(order.id, order.branchId, updated, driverId);

    res.json({
      success: true,
      message: "تم قبول الطلب بنجاح! توجه للفرع لاستلام الوجبة 🛵",
      order: sanitizeOrderForDriver(updated),
    });
  } catch (error) {
    console.error("Driver accept order error:", error);
    res.status(500).json({ error: "فشل قبول الطلب" });
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

    const driverInfo = await prisma.deliveryDriver.findUnique({
      where: { id: driverId },
      select: { name: true, phone: true },
    });
    const driverName = driverInfo?.name || "الطيار";

    // تنفيذ الاعتذار والبحث التلقائي الذكي عن الكابتن التالي في الترتيب
    const fallbackResult = await handleDriverRejectionWithFallback(orderId, driverId);
    const updated = fallbackResult?.updatedOrder || (await prisma.order.findUnique({ where: { id: orderId } }));

    res.json({
      success: true,
      message: fallbackResult?.nextDriver 
        ? `تم الاعتذار عن الطلب وتمريره تلقائياً إلى الكابتن (${fallbackResult.nextDriver.name})` 
        : "تم الاعتذار عن استلام الطلب بنجاح وإعادته للفرع",
      order: sanitizeOrderForDriver(updated),
      reassignedTo: fallbackResult?.nextDriver?.name || null,
    });
  } catch (error) {
    console.error("Driver reject order error:", error);
    res.status(500).json({ error: "فشل الاعتذار عن الطلب" });
  }
});

// 4.1. إرجاع الطلب للفرع بعد استلامه باستخدام رمز أمان الفرع (Branch Return PIN)
router.post("/orders/:id/return-to-branch", authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const driverId = req.driver!.driverId;
    const { pin, reason } = req.body;

    if (!pin) {
      res.status(400).json({ error: "رمز الاستلام (PIN) مطلوب لإتمام الإرجاع" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { branch: true },
    });

    if (!order || order.driverId !== driverId) {
      res.status(404).json({ error: "الطلب غير مسند لك" });
      return;
    }

    // التحقق من رمز الـ PIN المأخوذ من شاشة المطعم
    const key = `branch_return_pin_${orderId}`;
    const record = await prisma.systemSetting.findUnique({ where: { key } });
    let expectedPin = "";
    if (record && record.value) {
      try {
        expectedPin = JSON.parse(record.value).pin;
      } catch (_e) {}
    }

    const returnLockKey = `return_pin_${orderId}`;
    const returnLockState = checkPinLock(returnLockKey);
    if (returnLockState.locked) {
      res.status(429).json({
        error: `تم تجاوز الحد الأقصى لمحاولات إدخال كود الإرجاع (5 محاولات). يرجى الانتظار ${Math.ceil(returnLockState.retryAfterSeconds / 60)} دقيقة`,
      });
      return;
    }

    if (!expectedPin || expectedPin !== String(pin).trim()) {
      const failure = recordPinFailure(returnLockKey);
      if (failure.locked) {
        res.status(429).json({
          error: "تم حظر إدخال رمز إرجاع الطلب مؤقتاً لمدة 15 دقيقة بعد استنفاد محاولات الإدخال الخاطئة",
        });
        return;
      }
      res.status(400).json({
        error: `رمز الاستلام (PIN) غير صحيح! متبقي ${failure.remaining} محاولات. يرجى أخذ الرمز المعروض على شاشة المطعم`,
      });
      return;
    }

    clearPinAttempts(returnLockKey);

    const driverInfo = await prisma.deliveryDriver.findUnique({
      where: { id: driverId },
      select: { name: true, phone: true },
    });
    const driverName = driverInfo?.name || "الطيار";

    await clearOrderAcceptedByDriver(orderId);
    await prisma.systemSetting.deleteMany({ where: { key } });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: null,
        driverAssignedAt: null,
        driverPickedUpAt: null,
        status: "READY", // يعود بالمطبخ جاهزاً للإسناد لكابتن بديل
        notes: `${order.notes ? order.notes + " | " : ""}تم إرجاع الطلب للفرع من الكابتن (${driverName})${reason ? ` - سبب الإرجاع: ${reason}` : ""}`,
      },
      include: {
        branch: true,
        items: true,
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    // إشعار الفرع فوراً بالصوت والتحديث
    notifyOrderStatusChanged(order.id, order.branchId, updated);
    notifyDriverReturnedOrder(order.branchId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      driverName,
      order: updated,
      reason: reason || "تم تأكيد إرجاع الوجبة للفرع برمز PIN",
    });

    res.json({
      success: true,
      message: "تم تسليم الوجبة للفرع بنجاح وإلغاء مسؤوليته عنك",
      order: sanitizeOrderForDriver(updated),
    });
  } catch (error) {
    console.error("Driver return order error:", error);
    res.status(500).json({ error: "فشل إرجاع الطلب للفرع" });
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

    if (order.status === "REJECTED" || order.status === "COMPLETED") {
      res.status(400).json({ error: "لا يمكن استلام طلب ملغى أو مكتمل" });
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
      order: sanitizeOrderForDriver(updated),
    });
  } catch (error) {
    console.error("Driver pickup order error:", error);
    res.status(500).json({ error: "فشل تأكيد الاستلام من الفرع" });
  }
});

// 6. تأكيد تسليم الوجبة للعميل باستخدام رمز الأمان (PIN Verification)
router.put("/orders/:id/deliver", authLimiter, async (req: AuthRequest, res: Response) => {
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

    if (order.status === "REJECTED") {
      res.status(400).json({ error: "هذا الطلب ملغى أو مرفوض ولا يمكن تسليمه" });
      return;
    }

    if (order.status === "COMPLETED") {
      res.status(400).json({ error: "هذا الطلب مكتمل بالفعل" });
      return;
    }

    const deliverLockKey = `deliver_pin_${orderId}`;
    const deliverLockState = checkPinLock(deliverLockKey);
    if (deliverLockState.locked) {
      res.status(429).json({
        error: `تم تجاوز الحد الأقصى لمحاولات إدخال كود الاستلام (5 محاولات). يرجى الانتظار ${Math.ceil(deliverLockState.retryAfterSeconds / 60)} دقيقة`,
      });
      return;
    }

    // التحقق من كود الـ PIN (إذا كان مسجلاً بالطلب)
    if (order.pickupPin && order.pickupPin !== String(pin).trim()) {
      const failure = recordPinFailure(deliverLockKey);
      if (failure.locked) {
        res.status(429).json({
          error: "تم حظر إدخال رمز الأمان مؤقتاً لمدة 15 دقيقة بعد استنفاد محاولات الإدخال الخاطئة",
        });
        return;
      }
      res.status(400).json({
        error: `رمز الأمان (PIN) غير صحيح! متبقي ${failure.remaining} محاولات. يرجى التأكد من الرقم الظاهر بشاشة هاتف العميل`,
      });
      return;
    }

    clearPinAttempts(deliverLockKey);

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
      order: sanitizeOrderForDriver(updated),
    });
  } catch (error) {
    console.error("Driver deliver order error:", error);
    res.status(500).json({ error: "فشل تأكيد تسليم الطلب" });
  }
});

export default router;
