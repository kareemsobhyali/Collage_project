import { Server as SocketIOServer, Socket } from "socket.io";

let io: SocketIOServer | null = null;

export function initSocket(server: any): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket: Socket) => {
    // الفرع يسجل دخوله في غرفته لاستقبال طلباته المباشرة
    socket.on("join_branch", (branchId: string) => {
      if (branchId) {
        socket.join(`branch_${branchId}`);
      }
    });

    // العميل يتابع حالة طلبه المباشرة
    socket.on("join_order", (orderId: string) => {
      if (orderId) {
        socket.join(`order_${orderId}`);
      }
    });

    // كابتن التوصيل (الطيار) يسجل دخوله في غرفته لاستقبال الطلبات المسندة إليه
    socket.on("join_driver", (driverId: string) => {
      if (driverId) {
        socket.join(`driver_${driverId}`);
      }
    });

    // الطلاب في السلة الجماعية التشاركية
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

