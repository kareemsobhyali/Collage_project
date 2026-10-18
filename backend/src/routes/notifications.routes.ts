import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";
import { JWT_SECRET } from "../middleware/auth.js";
import { orderQuickMessages } from "../sockets/socketManager.js";
import { isOrderAcceptedByDriver } from "../services/driver.service.js";

const router = express.Router();

export interface NativeNotificationItem {
  id: string;
  tag: string;
  channel: "ORDERS" | "URGENT_ALARM" | "CHAT" | "PROMO";
  title: string;
  body: string;
  subText?: string;
  color?: string;
  soundType: "ALARM" | "CHIME" | "DEFAULT";
  actionUrl: string;
  timestamp: number;
}

/**
 * GET /api/notifications/poll
 * نقطة نهاية خفيفة وسريعة جداً لمحرك إشعارات الأندرويد في الخلفية
 * يعمل حتى لو التطبيق مقفول تماماً على هاتف الطالب أو الكابتن أو المطعم
 */
router.get("/poll", async (req: Request, res: Response) => {
  try {
    let role = (req.query.role as string)?.toUpperCase() || "";
    let userId = (req.query.userId as string) || "";
    const sinceParam = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    const sinceDate = new Date(sinceParam > 0 ? sinceParam : Date.now() - 3600 * 1000); // آخر ساعة افتراضياً

    // فحص التوكن إذا تم إرساله للتحقق من هوية المستخدم بدقة
    const authHeader = req.headers.authorization || (req.query.token as string);
    if (authHeader) {
      try {
        const rawToken = authHeader.replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(rawToken, JWT_SECRET) as any;
        if (decoded) {
          if (decoded.role === "DRIVER" || decoded.driverId) {
            role = "DRIVER";
            userId = decoded.driverId || decoded.userId || decoded.id;
          } else if (decoded.role === "BRANCH" || decoded.branchId) {
            role = "BRANCH";
            userId = decoded.branchId || decoded.userId || decoded.id;
          } else if (decoded.role === "SUPERADMIN") {
            role = "ADMIN";
            userId = decoded.userId || decoded.id;
          } else {
            role = "STUDENT";
            userId = decoded.userId || decoded.id;
          }
        }
      } catch (_e) {
        // إذا كان التوكن منتهي أو غير صالح، نعتمد على المعاملات كاحتياط
      }
    }

    const notifications: NativeNotificationItem[] = [];

    // 1. إشعارات الكابتن (DRIVER)
    if (role === "DRIVER" && userId) {
      const activeOrders = await prisma.order.findMany({
        where: {
          driverId: userId,
          status: { in: ["ACCEPTED", "PREPARING", "READY"] },
        },
        include: {
          branch: { select: { name: true, address: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      for (const order of activeOrders) {
        const orderUpdatedMs = new Date(order.updatedAt).getTime();

        // أ) طلب مسند جديد لم يقبله الكابتن بعد -> إنذار رنين طارئ ومستمر
        const isAccepted = Boolean(order.driverPickedUpAt) || (await isOrderAcceptedByDriver(order.id));
        if (!isAccepted) {
          notifications.push({
            id: `driver_new_${order.orderNumber}_${orderUpdatedMs}`,
            tag: `order_${order.orderNumber}`,
            channel: "ORDERS",
            title: `🛵 طلب توصيل جديد مسند لك #${order.orderNumber}!`,
            body: `استلام من مطعم (${order.branch?.name || "المطعم"}) • العميل: ${order.customerName || "طالب"}`,
            subText: "UniFood Driver ⚡",
            color: "#4F46E5",
            soundType: "ALARM",
            actionUrl: "/delivery",
            timestamp: orderUpdatedMs,
          });
        }
        // ب) الطلب جاهز في المطبخ ولم يستلمه الكابتن بعد
        else if (order.status === "READY" && !order.driverPickedUpAt) {
          notifications.push({
            id: `driver_ready_${order.orderNumber}_${orderUpdatedMs}`,
            tag: `order_${order.orderNumber}`,
            channel: "ORDERS",
            title: `👨‍🍳 الوجبة جاهزة للاستلام #${order.orderNumber}`,
            body: `المطبخ جهز الطلب بالكامل، توجه لفرع (${order.branch?.name}) لاستلامه والبدء بالتوصيل`,
            subText: "جاهز للتسليم",
            color: "#10B981",
            soundType: "CHIME",
            actionUrl: "/delivery",
            timestamp: orderUpdatedMs,
          });
        }

        // ج) فحص الرسائل السريعة الواردة من الطالب لهذا الطلب
        const msgs = orderQuickMessages.get(order.id) || [];
        for (const msg of msgs) {
          const msgTime = new Date(msg.createdAt).getTime();
          if (msg.senderRole === "CUSTOMER" && (sinceParam === 0 || msgTime > sinceParam - 10000)) {
            notifications.push({
              id: `chat_${msg.id}`,
              tag: `chat_${order.orderNumber}`,
              channel: "CHAT",
              title: `💬 رسالة من الطالب (${msg.senderName}) • طلب #${order.orderNumber}`,
              body: msg.text,
              subText: "محادثة مباشرة",
              color: "#3B82F6",
              soundType: "CHIME",
              actionUrl: "/delivery",
              timestamp: msgTime,
            });
          }
        }
      }
    }

    // 2. إشعارات الطالب (STUDENT)
    else if (role === "STUDENT" && userId) {
      const recentWindow = new Date(Math.max(sinceParam > 0 ? sinceParam - 15000 : 0, Date.now() - 30 * 60 * 1000));

      const studentOrders = await prisma.order.findMany({
        where: {
          userId,
          OR: [
            { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
            { updatedAt: { gte: recentWindow } },
          ],
        },
        include: {
          branch: { select: { name: true, phone: true } },
          driver: { select: { name: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      });

      for (const order of studentOrders) {
        const orderUpdatedMs = new Date(order.updatedAt).getTime();
        const branchName = order.branch?.name || "المطعم";
        const driverName = order.driver?.name?.replace(/\s*\(طيار عام\)\s*/g, "") || "الكابتن";

        let title = "";
        let body = "";
        let color = "#4F46E5";

        switch (order.status) {
          case "ACCEPTED":
            title = `✅ تم قبول طلبك #${order.orderNumber}`;
            body = `استلم مطعم (${branchName}) طلبك وجاري البدء في تجهيزه!`;
            color = "#10B981";
            break;
          case "PREPARING":
            title = `👨‍🍳 طلبك #${order.orderNumber} قيد التحضير`;
            body = `الشيف يجهز وجبتك الآن في (${branchName})!`;
            color = "#F59E0B";
            break;
          case "READY":
            if (order.orderType === "DELIVERY") {
              title = `🛵 كابتن التوصيل في الطريق إليك! #${order.orderNumber}`;
              body = `${driverName} استلم وجبتك وفي الطريق إليك الآن. رمز استلامك السري PIN: (${order.pickupPin || "----"})`;
              color = "#3B82F6";
            } else {
              title = `🎉 طلبك #${order.orderNumber} جاهز للاستلام!`;
              body = `توجه لفرع (${branchName}) لاستلام وجبتك، رمز الاستلام: (${order.pickupPin || "----"})`;
              color = "#10B981";
            }
            break;
          case "COMPLETED":
            title = `🥳 بالهنا والشفا! اكتمل طلبك #${order.orderNumber}`;
            body = `تم تسليم الطلب بنجاح وإضافة نقاط الولاء لمحفظتك الجامعية!`;
            color = "#10B981";
            break;
          case "REJECTED":
            const isSelfCancelled = Boolean(
              order.notes?.includes("من قِبل الطالب") ||
              order.notes?.includes("من قِبل العميل") ||
              order.notes?.includes("بواسطة الطالب") ||
              order.notes?.includes("بواسطة العميل")
            );
            if (isSelfCancelled) {
              title = `تم إلغاء الطلب #${order.orderNumber}`;
              body = `تم إلغاء طلبك بنجاح بناءً على رغبتك قبل بدء التجهيز.`;
              color = "#64748B";
            } else {
              title = `⚠️ تم الاعتذار عن الطلب #${order.orderNumber}`;
              body = `نعتذر، تعذر تنفيذ الطلب من (${branchName}).`;
              color = "#EF4444";
            }
            break;
        }

        if (title) {
          notifications.push({
            id: `student_order_${order.orderNumber}_${order.status}`,
            tag: `order_${order.orderNumber}`,
            channel: "ORDERS",
            title,
            body,
            subText: `طلب #${order.orderNumber} • ${branchName}`,
            color,
            soundType: "CHIME",
            actionUrl: `/?openOrder=${order.id}`,
            timestamp: orderUpdatedMs,
          });
        }

        // فحص رسائل الكابتن السريعة للطالب
        const msgs = orderQuickMessages.get(order.id) || [];
        for (const msg of msgs) {
          const msgTime = new Date(msg.createdAt).getTime();
          if (msg.senderRole === "DRIVER" && (sinceParam === 0 || msgTime > sinceParam - 10000)) {
            notifications.push({
              id: `chat_${msg.id}`,
              tag: `chat_${order.orderNumber}`,
              channel: "CHAT",
              title: `💬 رسالة من الكابتن (${msg.senderName}) • طلب #${order.orderNumber}`,
              body: msg.text,
              subText: "محادثة الأوردر",
              color: "#3B82F6",
              soundType: "CHIME",
              actionUrl: `/?openOrder=${order.id}`,
              timestamp: msgTime,
            });
          }
        }
      }
    }

    // 3. إشعارات شاشة المطعم (BRANCH)
    else if (role === "BRANCH" && userId) {
      const pendingOrders = await prisma.order.findMany({
        where: {
          branchId: userId,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      for (const order of pendingOrders) {
        const orderCreatedMs = new Date(order.createdAt).getTime();
        notifications.push({
          id: `branch_pending_${order.orderNumber}`,
          tag: `order_${order.orderNumber}`,
          channel: "ORDERS",
          title: `🔔 طلب جديد وارد للمطعم #${order.orderNumber}!`,
          body: `العميل: ${order.customerName || "طالب"} • الإجمالي: ${order.total} ج.م • اضغط للقبول`,
          subText: "طلب جديد بانتظار الموافقة",
          color: "#F59E0B",
          soundType: "ALARM",
          actionUrl: "/branch",
          timestamp: orderCreatedMs,
        });
      }
    }

    return res.json({
      success: true,
      notifications,
      serverTime: Date.now(),
    });
  } catch (error: any) {
    console.error("Notifications poll error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
