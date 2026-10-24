import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";
import { JWT_SECRET } from "../middleware/auth.js";

let io: SocketIOServer | null = null;

// تتبع حالة التطبيق (شغال ومفتوح في الواجهة أم في الخلفية / مقفول)
interface AppSessionState {
  socketIds: Set<string>;
  state: "foreground" | "background";
  lastSeen: number;
}
const appSessions = new Map<string, AppSessionState>();

export function setAppSessionState(role: "BRANCH" | "STUDENT" | "DRIVER", id: string, socketId: string, state: "foreground" | "background"): void {
  const normRole = (role || "").toUpperCase().trim() as "BRANCH" | "STUDENT" | "DRIVER";
  const normId = String(id || "").trim();
  if (!normRole || !normId) return;
  const key = `${normRole}_${normId}`;
  let session = appSessions.get(key);
  if (!session) {
    session = { socketIds: new Set(), state, lastSeen: Date.now() };
    appSessions.set(key, session);
  }
  session.socketIds.add(socketId);
  session.state = state;
  session.lastSeen = Date.now();
}

export function removeAppSessionSocket(socketId: string): void {
  for (const [key, session] of appSessions.entries()) {
    if (session.socketIds.has(socketId)) {
      session.socketIds.delete(socketId);
      if (session.socketIds.size === 0) {
        appSessions.delete(key);
      }
    }
  }
}

export function isAppRunningInForeground(role: "BRANCH" | "STUDENT" | "DRIVER", id: string): boolean {
  const normRole = (role || "").toUpperCase().trim() as "BRANCH" | "STUDENT" | "DRIVER";
  const normId = String(id || "").trim();
  if (!normRole || !normId) return false;

  // 1. فحص غرف Socket.io النشطة: طالما أن هناك اتصال سوكيت حي في الغرفة، فالتطبيق مفتوح وشغال حالياً
  if (io) {
    let roomName = "";
    if (normRole === "BRANCH") roomName = `branch_${normId}`;
    else if (normRole === "STUDENT") roomName = `user_${normId}`;
    else if (normRole === "DRIVER") roomName = `driver_${normId}`;

    if (roomName) {
      const room = io.sockets.adapter.rooms.get(roomName);
      if (room && room.size > 0) {
        return true;
      }
    }
  }

  // 2. فحص جلسة التطبيق المسجلة
  const key = `${normRole}_${normId}`;
  const session = appSessions.get(key);
  if (session && session.socketIds.size > 0 && session.state === "foreground") {
    return true;
  }

  return false;
}

function sanitizeOrderForDriverSocket(order: any): any {
  if (!order || typeof order !== "object") return order;
  const { pickupPin, ...safeOrder } = order;
  return safeOrder;
}

export function initSocket(server: any): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  // فحص هوية المتصل وتحديد صلاحياته في الغرف الخاصة
  io.use((socket: Socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (rawToken) {
      try {
        const token = String(rawToken).replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        (socket as any).user = decoded;
      } catch (_e) {}
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    const authUser = (socket as any).user;

    // استقبال تحديث حالة فتح/تصغير التطبيق من العميل لحظياً
    socket.on("app_state", (data: { role?: "BRANCH" | "STUDENT" | "DRIVER"; id?: string; state?: "foreground" | "background" }) => {
      if (data && data.role && data.id) {
        setAppSessionState(data.role, data.id, socket.id, data.state || "foreground");
      }
    });

    if (authUser && authUser.role === "SUPERADMIN") {
      socket.join("admin_dashboard");
    }

    // الفرع: انضمام فوري لغرفة الفرع إذا كان التوكن يحمل branchId
    if (authUser && authUser.branchId) {
      socket.join(`branch_${authUser.branchId}`);
      setAppSessionState("BRANCH", authUser.branchId, socket.id, "foreground");
    }

    // الفرع يسجل دخوله في غرفته لاستقبال طلباته المباشرة (محمي بصلاحية الفرع أو الأدمن)
    socket.on("join_branch", (branchId: string) => {
      if (!branchId) return;
      if (authUser && (authUser.role === "SUPERADMIN" || authUser.branchId === branchId)) {
        socket.join(`branch_${branchId}`);
        setAppSessionState("BRANCH", branchId, socket.id, "foreground");
      } else {
        console.warn(`[Socket Security] Unauthorized attempt to join branch_${branchId}`);
      }
    });

    // العميل يتابع حالة طلبه المباشرة (مع التحقق من ملكية الطلب أو صلاحية الفرع/الطيار/الإدارة)
    socket.on("join_order", async (orderId: string) => {
      if (!orderId || typeof orderId !== "string") return;
      if (!authUser) {
        console.warn(`[Socket Security] Unauthenticated attempt to join order_${orderId}`);
        return;
      }
      try {
        if (authUser.role === "SUPERADMIN") {
          socket.join(`order_${orderId}`);
          return;
        }
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { userId: true, branchId: true, driverId: true },
        });
        if (!order) return;
        const currentUid = authUser.userId || authUser.id;
        if (
          (currentUid && order.userId === currentUid) ||
          (authUser.branchId && order.branchId === authUser.branchId) ||
          (authUser.driverId && order.driverId === authUser.driverId)
        ) {
          socket.join(`order_${orderId}`);
        } else {
          console.warn(`[Socket Security] Unauthorized attempt to join order_${orderId}`);
        }
      } catch (_e) {}
    });

    // كابتن التوصيل (الطيار) يسجل دخوله في غرفته لاستقبال الطلبات المسندة إليه
    if (authUser && authUser.driverId) {
      socket.join(`driver_${authUser.driverId}`);
      setAppSessionState("DRIVER", authUser.driverId, socket.id, "foreground");
    }

    socket.on("join_driver", (driverId: string) => {
      if (!driverId) return;
      if (authUser && (authUser.role === "SUPERADMIN" || authUser.driverId === driverId)) {
        socket.join(`driver_${driverId}`);
        setAppSessionState("DRIVER", driverId, socket.id, "foreground");
      } else {
        console.warn(`[Socket Security] Unauthorized attempt to join driver_${driverId}`);
      }
    });

    // انضمام المستخدم (طالب / عميل) لغرفته الخاصة لاستقبال تحديثات المحفظة والاشتراكات والحظر
    if (authUser && (authUser.userId || authUser.id)) {
      const uid = authUser.userId || authUser.id;
      socket.join(`user_${uid}`);
      setAppSessionState("STUDENT", uid, socket.id, "foreground");
    }

    socket.on("join_user", (userId: string) => {
      if (!userId) return;
      const currentUid = authUser?.userId || authUser?.id;
      if (authUser && (authUser.role === "SUPERADMIN" || currentUid === userId)) {
        socket.join(`user_${userId}`);
        setAppSessionState("STUDENT", userId, socket.id, "foreground");
      } else {
        console.warn(`[Socket Security] Unauthorized attempt to join user_${userId}`);
      }
    });

    // الطلاب في السلة الجماعية التشاركية (متاح عبر كود المشاركة)
    socket.on("join_group_cart", (shareCode: string) => {
      if (shareCode && typeof shareCode === "string") {
        socket.join(`group_cart_${shareCode.trim().toUpperCase()}`);
      }
    });

    // استقبال تحديث موقع الطيار اللحظي وبثه للطالب والفرع (محمي بصلاحية الطيار أو الإدارة)
    socket.on("driver_location_update", (data: { driverId: string; lat: number; lng: number; orderId?: string }) => {
      if (!authUser || (!authUser.driverId && authUser.role !== "SUPERADMIN")) {
        console.warn("[Socket Security] Unauthorized driver_location_update attempt rejected");
        return;
      }
      if (!data || typeof data.lat !== "number" || typeof data.lng !== "number" || isNaN(data.lat) || isNaN(data.lng)) return;
      if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) return;

      const verifiedDriverId = authUser.driverId || data.driverId;
      if (!verifiedDriverId) return;

      const payload = {
        driverId: verifiedDriverId,
        lat: data.lat,
        lng: data.lng,
        orderId: data.orderId,
        timestamp: Date.now(),
      };

      latestDriverLocations.set(verifiedDriverId, payload);
      if (data.orderId) {
        io?.to(`order_${data.orderId}`).emit("driver_location_updated", payload);
      }
      if (authUser.branchId) {
        io?.to(`branch_${authUser.branchId}`).emit("driver_location_updated", payload);
      }
      io?.to("admin_dashboard").emit("driver_location_updated", payload);
    });

    // جلب آخر موقع مسجل للطيار عند فتح شاشة التتبع
    socket.on("get_driver_location", (driverId: string, callback?: (loc: any) => void) => {
      if (driverId && latestDriverLocations.has(driverId)) {
        const loc = latestDriverLocations.get(driverId);
        if (typeof callback === "function") callback(loc);
        socket.emit("driver_location_updated", loc);
      }
    });

    // جلب سجل الرسائل السريعة بين الطالب والطيار للطلب
    socket.on("get_order_quick_messages", (orderId: string, callback?: (msgs: QuickOrderMessage[]) => void) => {
      if (!orderId || typeof orderId !== "string") return;
      const list = orderQuickMessages.get(orderId) || [];
      if (typeof callback === "function") callback(list);
      socket.emit("order_quick_messages_history", { orderId, messages: list });
    });

    // إرسال رسالة سريعة لحظية بين الطالب والطيار
    socket.on(
      "send_order_quick_message",
      async (
        data: { orderId: string; text: string; senderRole?: "CUSTOMER" | "DRIVER"; senderName?: string },
        callback?: (res: { success: boolean; message?: QuickOrderMessage; error?: string }) => void
      ) => {
        try {
          if (!data || !data.orderId || !data.text || typeof data.text !== "string") {
            if (typeof callback === "function") callback({ success: false, error: "بيانات الرسالة غير مكتملة" });
            return;
          }
          const cleanText = data.text.trim().slice(0, 160);
          if (!cleanText) return;

          const order = await prisma.order.findUnique({
            where: { id: data.orderId },
            select: {
              id: true,
              orderNumber: true,
              userId: true,
              branchId: true,
              driverId: true,
              customerName: true,
              driver: { select: { name: true } },
            },
          });
          if (!order) {
            if (typeof callback === "function") callback({ success: false, error: "الطلب غير موجود" });
            return;
          }

          const currentUid = authUser?.userId || authUser?.id;
          const isDriverSender = Boolean(authUser?.driverId && order.driverId === authUser.driverId) || data.senderRole === "DRIVER";
          const isCustomerSender = Boolean(currentUid && order.userId === currentUid) || data.senderRole === "CUSTOMER";
          if (!authUser || (!isDriverSender && !isCustomerSender && authUser.role !== "SUPERADMIN")) {
            if (typeof callback === "function") callback({ success: false, error: "غير مصرح بإرسال رسالة لهذا الطلب" });
            return;
          }

          const role: "CUSTOMER" | "DRIVER" = authUser.driverId ? "DRIVER" : (data.senderRole === "DRIVER" ? "DRIVER" : "CUSTOMER");
          const senderName =
            role === "DRIVER"
              ? (order.driver?.name || data.senderName || "كابتن التوصيل").replace(/\s*\(طيار عام\)\s*/g, "").trim()
              : (order.customerName || data.senderName || "الطالب");

          const msg = recordAndBroadcastOrderQuickMessage({
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId: order.userId,
            driverId: order.driverId,
            branchId: order.branchId,
            senderRole: role,
            senderName,
            text: cleanText,
          });

          if (typeof callback === "function") callback({ success: true, message: msg });
        } catch (err) {
          if (typeof callback === "function") callback({ success: false, error: "فشل إرسال الرسالة السريعة" });
        }
      }
    );

    socket.on("disconnect", () => {
      removeAppSessionSocket(socket.id);
    });
  });

  return io;
}

export interface QuickOrderMessage {
  id: string;
  orderId: string;
  orderNumber?: number;
  senderRole: "CUSTOMER" | "DRIVER";
  senderName: string;
  text: string;
  createdAt: string;
}

export const orderQuickMessages = new Map<string, QuickOrderMessage[]>();

export function recordAndBroadcastOrderQuickMessage(params: {
  orderId: string;
  orderNumber?: number;
  userId?: string | null;
  driverId?: string | null;
  branchId?: string | null;
  senderRole: "CUSTOMER" | "DRIVER";
  senderName: string;
  text: string;
}): QuickOrderMessage {
  const msg: QuickOrderMessage = {
    id: `qm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    senderRole: params.senderRole,
    senderName: params.senderName,
    text: params.text.trim().slice(0, 160),
    createdAt: new Date().toISOString(),
  };

  const existing = orderQuickMessages.get(params.orderId) || [];
  const nextList = [...existing.slice(-39), msg];
  orderQuickMessages.set(params.orderId, nextList);

  if (io) {
    let target = io.to(`order_${params.orderId}`);
    if (params.userId) {
      target = target.to(`user_${params.userId}`);
    }
    if (params.driverId) {
      target = target.to(`driver_${params.driverId}`);
    }
    if (params.branchId) {
      target = target.to(`branch_${params.branchId}`);
    }
    target.emit("order_quick_message", msg);
  }

  return msg;
}

export const latestDriverLocations = new Map<string, { driverId: string; lat: number; lng: number; orderId?: string; timestamp: number }>();


export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
}

export function notifyBranchNewOrder(branchId: string, order: any): void {
  if (io) {
    // إرسال إشعار فوري للديسكتوب لتشغيل الصوت وعرض الطلب
    io.to(`branch_${branchId}`).emit("new_order", order);
  }
}

export function notifyOrderStatusChanged(orderId: string, branchId: string, order: any, driverId?: string): void {
  if (io) {
    // إرسال التحديث لغرف الطلب والمستخدم والفرع في إرسال موحد لتجنب تكرار استلام الحدث لنفس الاتصال
    let target = io.to(`order_${orderId}`);
    if (order?.userId) {
      target = target.to(`user_${order.userId}`);
    }
    if (branchId) {
      target = target.to(`branch_${branchId}`);
    }
    target.emit("order_status_updated", order);

    if (driverId || order?.driverId) {
      io.to(`driver_${driverId || order.driverId}`).emit("order_status_updated", sanitizeOrderForDriverSocket(order));
    }
  }
}

export function notifyDriverAssigned(driverId: string, order: any): void {
  if (io) {
    // إشعار فوري للطيار مع صوت تنبيه عالي (مع إخفاء رمز الاستلام السري للعميل)
    io.to(`driver_${driverId}`).emit("new_order_assigned", sanitizeOrderForDriverSocket(order));
  }
}

export function notifyDriverRejectedOrder(branchId: string, payload: { orderId: string; orderNumber: number; driverName: string; reassignedTo?: string | null; order: any }): void {
  if (io) {
    // إشعار فوري للفرع مع تنبيه صوتي عاجل عند اعتذار/رفض الطيار لاستلام الطلب
    io.to(`branch_${branchId}`).emit("driver_rejected_order", payload);
  }
}

export function notifyDriverReturnedOrder(branchId: string, payload: { orderId: string; orderNumber: number; driverName?: string; order: any; reason?: string }): void {
  if (io) {
    // إشعار فوري للفرع مع تنبيه صوتي عاجل عند إرجاع الطيار للطلب إلى الفرع
    io.to(`branch_${branchId}`).emit("driver_returned_order", payload);
  }
}

export function notifyDriverUnassigned(driverId: string, orderId: string): void {
  if (io) {
    // إشعار الطيار بإلغاء إسناد الطلب وإزالته فوراً من قائمته
    io.to(`driver_${driverId}`).emit("order_unassigned", { orderId });
  }
}

export function notifyGroupCartUpdated(shareCode: string, cartData: any): void {
  if (io) {
    io.to(`group_cart_${shareCode}`).emit("group_cart_updated", cartData);
  }
}

export function notifyBranchStatusChanged(branchId: string, statusData: any): void {
  if (io) {
    // بث عام لجميع العملاء وتطبيق الديسكتوب
    io.emit("branch_status_updated", { branchId, ...statusData });
  }
}

export function notifyBranchesListChanged(): void {
  if (io) {
    // إشعار فوري للعملاء بإعادة استعلام قائمة الفروع (إضافة/حذف/تغيير حالة)
    io.emit("branches_list_changed");
  }
}

export function notifyBranchMenuChanged(branchId: string): void {
  if (io) {
    // إشعار العملاء بتحديث محتوى منيو الفرع (إضافة/تعديل/حذف صنف أو قسم أو إضافة)
    io.emit("branch_menu_updated", { branchId });
    io.to(`branch_${branchId}`).emit("branch_menu_updated", { branchId });
  }
}

export function notifyMenuItemAvailabilityChanged(branchId: string, itemData: any): void {
  if (io) {
    // تغيير فوري لحالة توفر الصنف أو الإضافة (متوفر / غير متوفر / نفد لفترة)
    io.emit("menu_item_availability_changed", { branchId, ...itemData });
    io.to(`branch_${branchId}`).emit("menu_item_availability_changed", { branchId, ...itemData });
  }
}

export function notifyBannersUpdated(): void {
  if (io) {
    // إشعار فوري بتحديث البانرات الإعلانية في الصفحة الرئيسية للطلاب
    io.emit("banners_updated");
  }
}

export function notifyPromosUpdated(): void {
  if (io) {
    // إشعار فوري بتحديث كوبونات الخصم
    io.emit("promos_updated");
  }
}

export function notifyFlashDealsUpdated(): void {
  if (io) {
    // إشعار فوري بتحديث عروض الفلاش الموقوتة
    io.emit("flash_deals_updated");
  }
}

export function notifyUserUpdated(userId: string, userData: any): void {
  if (io) {
    // إشعار خاص فقط بغرفة الطالب المعني ولوحة الإدارة (منع تسريب بيانات المحفظة لباقي المتصلين)
    io.to(`user_${userId}`).emit("user_profile_updated", { userId, ...userData });
    io.to("admin_dashboard").emit("user_profile_updated", { userId, ...userData });
  }
}

export function notifySoundSettingsChanged(soundSettings: any): void {
  if (io) {
    // بث فوري لجميع نقاط البيع وبوابات الطيارين بتحديث صوت التنبيه
    io.emit("notification_sound_updated", soundSettings);
  }
}

export function notifyRestaurantLocationChanged(locationSettings: any): void {
  if (io) {
    // بث فوري لجميع شاشات التتبع والخرائط والعملاء بتحديث موقع المطعم الجغرافي
    io.emit("restaurant_location_updated", locationSettings);
  }
}


