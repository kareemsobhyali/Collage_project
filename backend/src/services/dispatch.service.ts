import prisma from "../prisma.js";
import { getRestaurantLocationSettings } from "./settings.service.js";
import { latestDriverLocations, notifyDriverAssigned, notifyOrderStatusChanged, notifyDriverRejectedOrder, notifyDriverUnassigned } from "../sockets/socketManager.js";
import { clearOrderAcceptedByDriver } from "./driver.service.js";

// سجل تتبع الكباتن الذين رفضوا طلباً معيناً لضمان عدم إعادة إسناده لنفس الكابتن تلقائياً
const orderRejectionHistory = new Map<string, string[]>();

export function parseBranchCoords(branch?: any, fallback?: { lat: number; lng: number }): { lat: number; lng: number } {
  if (branch?.latitude && branch?.longitude) {
    return { lat: Number(branch.latitude), lng: Number(branch.longitude) };
  }
  if (branch?.address) {
    const match = branch.address.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }
  return fallback || { lat: 30.0277, lng: 31.2105 };
}

export function calcHaversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
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

/**
 * فحص صلاحية الكابتن لخدمة الفرع
 */
export async function canDriverServeBranch(driverId: string, driverBranchId: string, targetBranchId: string): Promise<boolean> {
  if (driverBranchId === targetBranchId) return true;
  // يمكن للطيار خدمة أي مطعم داخل الحرم إذا كان متاحاً
  return true;
}

/**
 * إيجاد أفضل كابتن توصيل متاح لفرع معين وفق المعايير:
 * 1. الكباتن المتفرغون تماماً (0 طلبات جارية) وتفضيل الأقرب جغرافياً للمطعم.
 * 2. إذا كان الجميع معهم طلبات، تفضيل من معه أقل عدد طلبات، ثم الأقرب مسافة.
 * 3. استبعاد الكباتن الموجودين في قائمة excludeDriverIds (مثل الذين رفضوا هذا الطلب).
 */
export async function findBestSmartDriverForBranch(
  branchId: string,
  excludeDriverIds: string[] = []
) {
  const [allDrivers, branch, defaultLoc, activeDriverOrders] = await Promise.all([
    prisma.deliveryDriver.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeDriverIds },
      },
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
      select: { id: true, address: true, latitude: true, longitude: true },
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

  if (allDrivers.length === 0) return null;

  const activeCountMap = new Map<string, number>();
  for (const row of activeDriverOrders) {
    if (row.driverId) activeCountMap.set(row.driverId, row._count._all);
  }

  const branchCoords = parseBranchCoords(branch, defaultLoc);
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

    // حساب النقاط (Score):
    // كل طلب إضافي يضيف 1000 نقطة ليظل المتفرغ (0 طلبات) في القمة دائماً
    // المسافة بالكيلومتر تضيف نقاطاً أقل (الأقرب = أقل نقاط)
    // أولوية خفيفة لطاقم الفرع المباشر عند التساوي
    const branchAffinityPenalty = d.branchId === branchId ? 0 : 0.5;
    const distancePenalty = distanceKm !== null ? distanceKm : 3.0;
    const score = activeOrdersCount * 1000 + distancePenalty + branchAffinityPenalty;

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

/**
 * معالجة اعتذار/رفض الطيار للطلب والبحث التلقائي عن الكابتن التالي في الترتيب
 */
export async function handleDriverRejectionWithFallback(orderId: string, rejectingDriverId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  if (!order) return null;

  // تسجيل الرفض في سجل الطلب
  const history = orderRejectionHistory.get(orderId) || [];
  if (!history.includes(rejectingDriverId)) {
    history.push(rejectingDriverId);
  }
  orderRejectionHistory.set(orderId, history);

  // إخلاء أي قبول سابق للطلب
  await clearOrderAcceptedByDriver(orderId);

  // إشعار الطيار المعتذر بإزالة الطلب
  notifyDriverUnassigned(rejectingDriverId, orderId);

  // البحث الذكي عن الكابتن التالي الأكثر ملاءمة (مع استبعاد من رفضوا هذا الطلب)
  const nextCandidate = await findBestSmartDriverForBranch(order.branchId, history);

  if (nextCandidate) {
    // إسناد الطلب فوراً للكابتن التالي في القائمة
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: nextCandidate.driver.id,
        driverAssignedAt: new Date(),
        driverPickedUpAt: null,
      },
      include: {
        branch: { select: { id: true, name: true, phone: true, address: true, logoUrl: true } },
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

    // إشعار الطيار الجديد فورياً
    notifyDriverAssigned(nextCandidate.driver.id, updated);

    // إشعار الفرع بأن الطلب أُعيد توجيهه تلقائياً لكابتن آخر بعد اعتذار الأول
    notifyOrderStatusChanged(orderId, order.branchId, updated, nextCandidate.driver.id);
    notifyDriverRejectedOrder(order.branchId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      driverName: order.driver?.name || "الطيار",
      reassignedTo: nextCandidate.driver.name,
      order: updated,
    });

    return { updatedOrder: updated, nextDriver: nextCandidate.driver };
  } else {
    // لا يوجد كباتن متاحون آخرون
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: null,
        driverAssignedAt: null,
        driverPickedUpAt: null,
      },
      include: {
        branch: true,
        items: true,
        driver: true,
        user: true,
      },
    });

    notifyOrderStatusChanged(orderId, order.branchId, updated);
    notifyDriverRejectedOrder(order.branchId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      driverName: order.driver?.name || "الطيار",
      reassignedTo: null,
      order: updated,
    });

    return { updatedOrder: updated, nextDriver: null };
  }
}
