import { Server as SocketIOServer, Socket } from "socket.io";
import prisma from "../prisma.js";
import { verifyTokenAndResolvePrincipal } from "../middleware/auth.js";
import { isAllowedCorsOrigin } from "../utils/safeFetch.js";

/**
 * هوية المتصل الموثقة بعد التحقق من التوكن وحالة الحساب في قاعدة البيانات
 * ملاحظة: branchId يُضبط فقط لحسابات الفروع (وليس للطيارين) لمنع انضمام الطيار لغرفة طلبات الفرع
 */
interface SocketAuthUser {
  kind: "USER" | "BRANCH" | "DRIVER";
  role?: "CUSTOMER" | "SUPERADMIN";
  userId?: string;
  branchId?: string;
  driverId?: string;
  driverBranchId?: string;
}

let io: SocketIOServer | null = null;

// تتبع حالة التطبيق (شغال ومفتوح في الواجهة أم في الخلفية / مقفول)
interface AppSessionState {
  socketIds: Set<string>;
  state: "foreground" | "background";
  lastSeen: number;
}
const appSessions = new Map<string, AppSessionState>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function broadcastPresenceChange(role: "BRANCH" | "STUDENT" | "DRIVER", id: string, isOnline: boolean): void {
  if (!io) return;
  if (role === "BRANCH") {
    console.log(`[Presence] Branch ${id} is now ${isOnline ? "ONLINE 🟢" : "OFFLINE 🔴"}`);
    prisma.branch.findUnique({
      where: { id },
      select: { slug: true }
    }).then((b) => {
      const payload = { branchId: id, slug: b?.slug || undefined, isOnline };
      io?.emit("branch_presence_changed", payload);
      io?.emit("branch_status_updated", payload);
    }).catch(() => {
      const payload = { branchId: id, isOnline };
      io?.emit("branch_presence_changed", payload);
      io?.emit("branch_status_updated", payload);
    });
  } else if (role === "DRIVER") {
    console.log(`[Presence] Driver ${id} is now ${isOnline ? "ONLINE 🟢" : "OFFLINE 🔴"}`);
    io.emit("driver_presence_changed", { driverId: id, isOnline });
  }
}

export function setAppSessionState(role: "BRANCH" | "STUDENT" | "DRIVER", id: string, socketId: string, state: "foreground" | "background"): void {
  const normRole = (role || "").toUpperCase().trim() as "BRANCH" | "STUDENT" | "DRIVER";
  const normId = String(id || "").trim();
  if (!normRole || !normId) return;
  const key = `${normRole}_${normId}`;

  // إلغاء أي مؤقت انقطاع معلق (في حال كانت إعادة اتصال سريعة)
  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key)!);
    disconnectTimers.delete(key);
  }

  const wasOnline = normRole === "BRANCH" ? isBranchOnline(normId) : normRole === "DRIVER" ? isDriverOnline(normId) : false;

  let session = appSessions.get(key);
  if (!session) {
    session = { socketIds: new Set(), state, lastSeen: Date.now() };
    appSessions.set(key, session);
  }
  session.socketIds.add(socketId);
  session.state = state;
  session.lastSeen = Date.now();

  const isNowOnline = normRole === "BRANCH" ? isBranchOnline(normId) : normRole === "DRIVER" ? isDriverOnline(normId) : false;
  if (!wasOnline && isNowOnline) {
    broadcastPresenceChange(normRole, normId, true);
  }
}

export function removeAppSessionSocket(socketId: string): void {
  for (const [key, session] of appSessions.entries()) {
    if (session.socketIds.has(socketId)) {
      session.socketIds.delete(socketId);
      const parts = key.split("_");
      const normRole = parts[0] as "BRANCH" | "STUDENT" | "DRIVER";
      const normId = parts.slice(1).join("_");

      if (session.socketIds.size === 0) {
        // مهلة أمان قصيرة (2 ثانية) لتفادي وميض الحالة عند إعادة تحميل الصفحة السريعة
        if (disconnectTimers.has(key)) {
          clearTimeout(disconnectTimers.get(key)!);
        }
        const timer = setTimeout(() => {
          disconnectTimers.delete(key);
          const current = appSessions.get(key);
          if (!current || current.socketIds.size === 0) {
            appSessions.delete(key);
            broadcastPresenceChange(normRole, normId, false);
          }
        }, 2000);
        disconnectTimers.set(key, timer);
      }
    }
  }
}

export function isBranchOnline(branchId: string): boolean {
  const normId = String(branchId || "").trim();
  if (!normId) return false;
  const key = `BRANCH_${normId}`;
  const session = appSessions.get(key);
  if (!session || session.socketIds.size === 0) return false;

  if (io) {
    let hasConnected = false;
    for (const sid of Array.from(session.socketIds)) {
      const sock = io.sockets.sockets.get(sid);
      if (sock && sock.connected) {
        hasConnected = true;
      } else {
        session.socketIds.delete(sid);
      }
    }
    if (!hasConnected) {
      appSessions.delete(key);
      return false;
    }
    return true;
  }
  return false;
}

export function isDriverOnline(driverId: string): boolean {
  const normId = String(driverId || "").trim();
  if (!normId) return false;
  const key = `DRIVER_${normId}`;
  const session = appSessions.get(key);
  if (!session || session.socketIds.size === 0) return false;

  if (io) {
    let hasConnected = false;
    for (const sid of Array.from(session.socketIds)) {
      const sock = io.sockets.sockets.get(sid);
      if (sock && sock.connected) {
        hasConnected = true;
      } else {
        session.socketIds.delete(sid);
      }
    }
    if (!hasConnected) {
      appSessions.delete(key);
      return false;
    }
    return true;
  }
  return false;
}

export function isAppRunningInForeground(role: "BRANCH" | "STUDENT" | "DRIVER", id: string): boolean {
  const normRole = (role || "").toUpperCase().trim() as "BRANCH" | "STUDENT" | "DRIVER";
  const normId = String(id || "").trim();
  if (!normRole || !normId) return false;

  if (normRole === "BRANCH") return isBranchOnline(normId);
  if (normRole === "DRIVER") return isDriverOnline(normId);

  // للعميل / الطالب
  const key = `${normRole}_${normId}`;
  const session = appSessions.get(key);
  return Boolean(session && session.socketIds.size > 0 && session.state === "foreground");
}

function sanitizeOrderForDriverSocket(order: any): any {
  if (!order || typeof order !== "object") return order;
  const { pickupPin, ...safeOrder } = order;
  return safeOrder;
}

export function initSocket(server: any): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedCorsOrigin(origin));
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
    pingInterval: 4000,
    pingTimeout: 5000,
  });

  // فحص هوية المتصل والتحقق من صلاحية الحساب في قاعدة البيانات قبل منحه أي غرفة خاصة
  io.use(async (socket: Socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (rawToken) {
      try {
        const token = String(rawToken).replace(/^Bearer\s+/i, "").trim();
        const result = await verifyTokenAndResolvePrincipal(token);
        if (result.principal) {
          let authUser: SocketAuthUser | null = null;
          if (result.principal.kind === "USER") {
            authUser = {
              kind: "USER",
              role: result.principal.user.role,
              userId: result.principal.user.userId,
            };
          } else if (result.principal.kind === "BRANCH") {
            authUser = {
              kind: "BRANCH",
              branchId: result.principal.branch.branchId,
            };
          } else if (result.principal.kind === "DRIVER") {
            authUser = {
              kind: "DRIVER",
              driverId: result.principal.driver.driverId,
              driverBranchId: result.principal.driver.branchId,
            };
          }
          (socket as any).user = authUser;
        }
      } catch (_e) {}
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    const authUser: SocketAuthUser | null = (socket as any).user || null;

    // تحديد هوية الجلسة الموثقة للمتصل فقط (منع انتحال حالة اتصال مطعم أو طيار آخر)
    const resolveOwnPresence = (): { role: "BRANCH" | "STUDENT" | "DRIVER"; id: string } | null => {
      if (!authUser) return null;
      if (authUser.kind === "BRANCH" && authUser.branchId) return { role: "BRANCH", id: authUser.branchId };
      if (authUser.kind === "DRIVER" && authUser.driverId) return { role: "DRIVER", id: authUser.driverId };
      if (authUser.kind === "USER" && authUser.userId) return { role: "STUDENT", id: authUser.userId };
      return null;
    };

    const handlePresenceUpdate = (data: { state?: "foreground" | "background" }) => {
      const own = resolveOwnPresence();
      if (!own) return;
      const state = data?.state === "background" ? "background" : "foreground";
      setAppSessionState(own.role, own.id, socket.id, state);
    };

    // استقبال تحديث حالة فتح/تصغير التطبيق من صاحب الجلسة الموثقة فقط
    socket.on("app_state", (data: { role?: string; id?: string; state?: "foreground" | "background" }) => {
      handlePresenceUpdate(data || {});
    });

    // نبضات الحفاظ على الاتصال والتواجد الحي دورياً (للجلسة الموثقة فقط)
    socket.on("heartbeat", (data: { role?: string; id?: string; state?: "foreground" | "background" }) => {
      handlePresenceUpdate(data || {});
    });

    // استعلام فوري عن حالة اتصال الفرع
    socket.on("check_branch_presence", (branchId: string, callback?: (isOnline: boolean) => void) => {
      if (typeof callback === "function" && branchId) {
        callback(isBranchOnline(branchId));
      }
    });

    // استعلام فوري عن حالة اتصال الطيار
    socket.on("check_driver_presence", (driverId: string, callback?: (isOnline: boolean) => void) => {
      if (typeof callback === "function" && driverId) {
        callback(isDriverOnline(driverId));
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
        const currentUid = authUser.userId;
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
    if (authUser && authUser.kind === "USER" && authUser.userId) {
      const uid = authUser.userId;
      socket.join(`user_${uid}`);
      setAppSessionState("STUDENT", uid, socket.id, "foreground");
    }

    socket.on("join_user", (userId: string) => {
      if (!userId) return;
      const currentUid = authUser?.userId;
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
      if (data.orderId && typeof data.orderId === "string") {
        // بث الموقع لغرفة الطلب وفرعه فقط إذا كان الطلب مسنداً فعلياً لهذا الطيار (منع حقن مواقع وهمية في طلبات أخرى)
        prisma.order.findUnique({
          where: { id: data.orderId },
          select: { branchId: true, driverId: true }
        }).then((ord) => {
          if (!ord || ord.driverId !== verifiedDriverId) return;
          io?.to(`order_${data.orderId}`).emit("driver_location_updated", payload);
          if (ord.branchId && ord.branchId !== authUser.driverBranchId) {
            io?.to(`branch_${ord.branchId}`).emit("driver_location_updated", payload);
          }
        }).catch(() => {});
      }
      if (authUser.driverBranchId) {
        io?.to(`branch_${authUser.driverBranchId}`).emit("driver_location_updated", payload);
      }
      io?.to("admin_dashboard").emit("driver_location_updated", payload);
    });

    // التحقق من أن المتصل طرف أصيل في الطلب (العميل صاحبه، الفرع المنفذ، الطيار المسند، أو الإدارة)
    const getAuthorizedOrder = async (orderId: string) => {
      if (!authUser || !orderId || typeof orderId !== "string") return null;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
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
      if (!order) return null;
      const isAdmin = authUser.kind === "USER" && authUser.role === "SUPERADMIN";
      const isOwnerCustomer = authUser.kind === "USER" && Boolean(authUser.userId) && order.userId === authUser.userId;
      const isOwnerBranch = authUser.kind === "BRANCH" && Boolean(authUser.branchId) && order.branchId === authUser.branchId;
      const isAssignedDriver = authUser.kind === "DRIVER" && Boolean(authUser.driverId) && order.driverId === authUser.driverId;
      if (!isAdmin && !isOwnerCustomer && !isOwnerBranch && !isAssignedDriver) return null;
      return { order, isAdmin, isOwnerCustomer, isOwnerBranch, isAssignedDriver };
    };

    // جلب آخر موقع مسجل للطيار عند فتح شاشة التتبع (فقط لأطراف طلب نشط مسند لهذا الطيار أو للإدارة)
    socket.on("get_driver_location", async (driverId: string, callback?: (loc: any) => void) => {
      try {
        if (!authUser || !driverId || typeof driverId !== "string" || !latestDriverLocations.has(driverId)) return;

        let allowed = false;
        if (authUser.kind === "USER" && authUser.role === "SUPERADMIN") {
          allowed = true;
        } else if (authUser.kind === "DRIVER" && authUser.driverId === driverId) {
          allowed = true;
        } else {
          const activeFilter: any = {
            driverId,
            status: { in: ["ACCEPTED", "PREPARING", "READY"] },
          };
          if (authUser.kind === "USER" && authUser.userId) {
            activeFilter.userId = authUser.userId;
          } else if (authUser.kind === "BRANCH" && authUser.branchId) {
            activeFilter.branchId = authUser.branchId;
          } else {
            return;
          }
          const linkedOrder = await prisma.order.findFirst({ where: activeFilter, select: { id: true } });
          allowed = Boolean(linkedOrder);
        }

        if (!allowed) return;
        const loc = latestDriverLocations.get(driverId);
        if (typeof callback === "function") callback(loc);
        socket.emit("driver_location_updated", loc);
      } catch (_e) {}
    });

    // جلب سجل الرسائل السريعة بين الطالب والطيار للطلب (لأطراف الطلب فقط)
    socket.on("get_order_quick_messages", async (orderId: string, callback?: (msgs: QuickOrderMessage[]) => void) => {
      try {
        const access = await getAuthorizedOrder(orderId);
        if (!access) {
          if (typeof callback === "function") callback([]);
          return;
        }
        const list = orderQuickMessages.get(orderId) || [];
        if (typeof callback === "function") callback(list);
        socket.emit("order_quick_messages_history", { orderId, messages: list });
      } catch (_e) {}
    });

    // إرسال رسالة سريعة لحظية بين الطالب والطيار (الهوية تُحدد من التوكن الموثق فقط وليس من بيانات العميل)
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

          const access = await getAuthorizedOrder(data.orderId);
          if (!access || (!access.isAssignedDriver && !access.isOwnerCustomer && !access.isAdmin)) {
            if (typeof callback === "function") callback({ success: false, error: "غير مصرح بإرسال رسالة لهذا الطلب" });
            return;
          }

          const { order } = access;
          let role: "CUSTOMER" | "DRIVER";
          if (access.isAssignedDriver) {
            role = "DRIVER";
          } else if (access.isOwnerCustomer) {
            role = "CUSTOMER";
          } else {
            // الإدارة فقط يمكنها اختيار صفة المرسل لأغراض الدعم
            role = data.senderRole === "DRIVER" ? "DRIVER" : "CUSTOMER";
          }

          const senderName =
            role === "DRIVER"
              ? (order.driver?.name || "كابتن التوصيل").replace(/\s*\(طيار عام\)\s*/g, "").trim()
              : (order.customerName || "العميل");

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

/**
 * إزالة الملاحظات الإدارية الداخلية وبيانات الحظر من نسخة الطلب المرسلة للعميل
 */
export function sanitizeOrderForCustomer(order: any): any {
  if (!order || typeof order !== "object") return order;
  if (!order.user || typeof order.user !== "object") return order;
  const { restaurantNotes, isBlocked, password, ...safeUser } = order.user;
  return { ...order, user: safeUser };
}

/**
 * إزالة رموز التحكم السرية من السلة الجماعية قبل إرسالها للمشاركين
 */
export function sanitizeGroupCartForPublic(cart: any): any {
  if (!cart || typeof cart !== "object") return cart;
  const { hostToken, ...safeCart } = cart;
  if (Array.isArray(safeCart.items)) {
    safeCart.items = safeCart.items.map((it: any) => {
      if (!it || typeof it !== "object") return it;
      const { deleteKey, ...safeItem } = it;
      return safeItem;
    });
  }
  return safeCart;
}

export function notifyOrderStatusChanged(orderId: string, branchId: string, order: any, driverId?: string): void {
  if (io) {
    // نسخة الفرع الكاملة (تتضمن ملاحظات المطعم على العميل)
    if (branchId) {
      io.to(`branch_${branchId}`).emit("order_status_updated", order);
    }

    // نسخة العميل بدون الملاحظات الإدارية الداخلية (مع استثناء اتصالات الفرع لتجنب التكرار)
    let customerTarget = io.to(`order_${orderId}`);
    if (order?.userId) {
      customerTarget = customerTarget.to(`user_${order.userId}`);
    }
    if (branchId) {
      customerTarget = customerTarget.except(`branch_${branchId}`);
    }
    customerTarget.emit("order_status_updated", sanitizeOrderForCustomer(order));

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
    io.to(`group_cart_${shareCode}`).emit("group_cart_updated", sanitizeGroupCartForPublic(cartData));
  }
}

export function notifyBranchStatusChanged(branchId: string, statusData: any): void {
  if (io) {
    const payload = {
      branchId,
      isOnline: isBranchOnline(branchId),
      ...statusData,
    };
    // بث عام لجميع العملاء وتطبيق الديسكتوب
    io.emit("branch_status_updated", payload);
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

export function notifySupportTicketCreated(ticket: any): void {
  if (io) {
    // بث موجّه فقط لصاحب الشكوى والمطعم المعني ولوحة الإدارة (بدون أي بث عام)
    let target = io.to("admin_dashboard");
    if (ticket.userId) target = target.to(`user_${ticket.userId}`);
    if (ticket.branchId) target = target.to(`branch_${ticket.branchId}`);
    target.emit("support_ticket_created", ticket);
  }
}

export function notifySupportTicketUpdated(ticket: any): void {
  if (io) {
    // بث التحديث اللحظي لحالة الشكوى للأطراف المعنية فقط
    let target = io.to("admin_dashboard");
    if (ticket.userId) target = target.to(`user_${ticket.userId}`);
    if (ticket.branchId) target = target.to(`branch_${ticket.branchId}`);
    target.emit("support_ticket_updated", ticket);
  }
}

export function notifySupportTicketDeleted(ticketId: string, branchId?: string, userId?: string): void {
  if (io) {
    let target = io.to("admin_dashboard");
    if (userId) target = target.to(`user_${userId}`);
    if (branchId) target = target.to(`branch_${branchId}`);
    target.emit("support_ticket_deleted", { id: ticketId });
  }
}


