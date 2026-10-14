import prisma from "../prisma.js";

export interface DriverBranchConfig {
  isAllBranches: boolean;
  branchIds: string[];
}

/**
 * جلب إعدادات المطاعم والفروع المعتمدة لكابتن التوصيل (هل هو عام لجميع المطاعم أم مطاعم محددة)
 */
export async function getDriverBranchConfig(driverId: string, fallbackBranchId?: string): Promise<DriverBranchConfig> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: `driver_branches_${driverId}` },
    });
    if (record && record.value) {
      const parsed = JSON.parse(record.value);
      return {
        isAllBranches: Boolean(parsed.isAllBranches),
        branchIds: Array.isArray(parsed.branchIds) ? parsed.branchIds : (fallbackBranchId ? [fallbackBranchId] : []),
      };
    }
  } catch (_e) {}

  return {
    isAllBranches: false,
    branchIds: fallbackBranchId ? [fallbackBranchId] : [],
  };
}

/**
 * حفظ وتحديث نطاق المطاعم المعينة للطيار
 */
export async function setDriverBranchConfig(
  driverId: string,
  config: { isAllBranches: boolean; branchIds: string[] }
): Promise<DriverBranchConfig> {
  const isAll = Boolean(config.isAllBranches);
  const branchIds = isAll ? [] : (Array.isArray(config.branchIds) ? config.branchIds : []);
  const payload = { isAllBranches: isAll, branchIds };

  await prisma.systemSetting.upsert({
    where: { key: `driver_branches_${driverId}` },
    update: { value: JSON.stringify(payload) },
    create: { key: `driver_branches_${driverId}`, value: JSON.stringify(payload) },
  });

  return payload;
}

/**
 * حذف إعدادات فروع الطيار عند حذفه من المنظومة
 */
export async function deleteDriverBranchConfig(driverId: string): Promise<void> {
  try {
    await prisma.systemSetting.deleteMany({
      where: { key: `driver_branches_${driverId}` },
    });
  } catch (_e) {}
}

/**
 * التحقق من صلاحية الطيار لاستلام طلبات فرع محدد (إما طيار الفرع المباشر أو عام أو محدد له هذا الفرع)
 */
export async function canDriverServeBranch(
  driverId: string,
  primaryBranchId: string,
  targetBranchId: string
): Promise<boolean> {
  if (primaryBranchId === targetBranchId) return true;
  const config = await getDriverBranchConfig(driverId, primaryBranchId);
  if (config.isAllBranches) return true;
  return config.branchIds.includes(targetBranchId);
}

/**
 * تسجيل قبول الطلب من قِبل الطيار
 */
export async function markOrderAcceptedByDriver(orderId: string, driverId: string): Promise<void> {
  const payload = { acceptedAt: new Date().toISOString(), driverId };
  await prisma.systemSetting.upsert({
    where: { key: `driver_accepted_order_${orderId}` },
    update: { value: JSON.stringify(payload) },
    create: { key: `driver_accepted_order_${orderId}`, value: JSON.stringify(payload) },
  });
}

/**
 * فحص هل تم قبول الطلب من قِبل الطيار
 */
export async function isOrderAcceptedByDriver(orderId: string): Promise<boolean> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: `driver_accepted_order_${orderId}` },
    });
    return Boolean(record && record.value);
  } catch (_e) {
    return false;
  }
}

/**
 * فحص هل تم إرسال تنبيه واتساب للطيار بخصوص هذا الطلب مسبقاً
 */
export async function isDriverWhatsAppAlertSent(orderId: string): Promise<boolean> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: `driver_alert_sent_${orderId}` },
    });
    return Boolean(record && record.value);
  } catch (_e) {
    return false;
  }
}

/**
 * تسجيل أنه تم إرسال تنبيه واتساب للطيار لهذا الطلب لمنع التكرار
 */
export async function markDriverWhatsAppAlertSent(orderId: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: `driver_alert_sent_${orderId}` },
    update: { value: new Date().toISOString() },
    create: { key: `driver_alert_sent_${orderId}`, value: new Date().toISOString() },
  });
}
