import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-campus-delivery-2026";

let io: SocketIOServer | null = null;

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

    // الفرع يسجل دخوله في غرفته لاستقبال طلباته المباشرة (محمي بصلاحية الفرع أو الأدمن)
    socket.on("join_branch", (branchId: string) => {
      if (!branchId) return;
      if (authUser && (authUser.role === "SUPERADMIN" || authUser.branchId === branchId)) {
        socket.join(`branch_${branchId}`);
      } else {
        console.warn(`[Socket Security] Unauthorized attempt to join branch_${branchId}`);
      }
    });

    // العميل يتابع حالة طلبه المباشرة
    socket.on("join_order", (orderId: string) => {
      if (orderId) {
        socket.join(`order_${orderId}`);
      }
    });

    // كابتن التوصيل (الطيار) يسجل دخوله في غرفته لاستقبال الطلبات المسندة إليه
    if (authUser && authUser.driverId) {
      socket.join(`driver_${authUser.driverId}`);
    }

    socket.on("join_driver", (driverId: string) => {
      if (!driverId) return;
      socket.join(`driver_${driverId}`);
    });

    // انضمام المستخدم (طالب / عميل) لغرفته الخاصة لاستقبال تحديثات المحفظة والاشتراكات والحظر
    if (authUser && (authUser.userId || authUser.id)) {
      const uid = authUser.userId || authUser.id;
      socket.join(`user_${uid}`);
    }

    socket.on("join_user", (userId: string) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    // الطلاب في السلة الجماعية التشاركية (متاح عبر كود المشاركة)
    socket.on("join_group_cart", (shareCode: string) => {
      if (shareCode) {
        socket.join(`group_cart_${shareCode}`);
      }
    });

    socket.on("disconnect", () => {
      // Disconnected
    });
  });

  return io;
}


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
    // تحديث العميل والديسكتوب
    io.to(`order_${orderId}`).emit("order_status_updated", order);
    io.to(`branch_${branchId}`).emit("order_status_updated", order);
    if (driverId || order?.driverId) {
      io.to(`driver_${driverId || order.driverId}`).emit("order_status_updated", order);
    }
  }
}

export function notifyDriverAssigned(driverId: string, order: any): void {
  if (io) {
    // إشعار فوري للطيار مع صوت تنبيه عالي
    io.to(`driver_${driverId}`).emit("new_order_assigned", order);
  }
}

export function notifyDriverRejectedOrder(branchId: string, payload: { orderId: string; orderNumber: number; driverName: string; order: any }): void {
  if (io) {
    // إشعار فوري للفرع مع تنبيه صوتي عاجل عند اعتذار/رفض الطيار لاستلام الطلب
    io.to(`branch_${branchId}`).emit("driver_rejected_order", payload);
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

export function notifyUserUpdated(userId: string, userData: any): void {
  if (io) {
    // إشعار فوري للطالب بتحديث رصيد المحفظة أو نقاط الولاء أو حظر الحساب
    io.to(`user_${userId}`).emit("user_profile_updated", { userId, ...userData });
    io.emit("user_profile_updated", { userId, ...userData });
  }
}

export function notifySoundSettingsChanged(soundSettings: any): void {
  if (io) {
    // بث فوري لجميع نقاط البيع وبوابات الطيارين بتحديث صوت التنبيه
    io.emit("notification_sound_updated", soundSettings);
  }
}


