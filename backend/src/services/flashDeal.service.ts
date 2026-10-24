import prisma from "../prisma.js";
import { notifyFlashDealsUpdated, notifyBranchMenuChanged } from "../sockets/socketManager.js";

/**
 * التحقق مما إذا كان عرض الفلاش نشطاً في اللحظة الراهنة
 * مع دعم التكرار اليومي أو الأيام المحددة وساعات العمل اليومية.
 */
export function isFlashDealCurrentlyActive(deal: any, now: Date = new Date()): boolean {
  if (!deal || !deal.isActive) return false;

  // إذا كان العرض مجدولاً ومتكرراً (Recurring)
  if (deal.isRecurring) {
    try {
      const cairoDay = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo",
        weekday: "short",
      })
        .format(now)
        .toUpperCase(); // SUN, MON, TUE, WED, THU, FRI, SAT

      const cairoTime = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Cairo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now); // "14:30"

      if (deal.recurringDays && deal.recurringDays !== "ALL") {
        const allowedDays = deal.recurringDays.split(",").map((s: string) => s.trim().toUpperCase());
        if (!allowedDays.includes(cairoDay)) {
          return false;
        }
      }

      if (deal.dailyStartTime && cairoTime < deal.dailyStartTime) {
        return false;
      }

      if (deal.dailyEndTime && cairoTime > deal.dailyEndTime) {
        return false;
      }

      // إذا كان هناك تاريخ انتهاء عام للعرض
      if (deal.expiresAt && new Date(deal.expiresAt).getTime() < now.getTime()) {
        return false;
      }

      return true;
    } catch (_e) {
      return false;
    }
  }

  // العرض العادي غير المتكرر
  const startsAtTime = deal.startsAt ? new Date(deal.startsAt).getTime() : 0;
  const expiresAtTime = deal.expiresAt ? new Date(deal.expiresAt).getTime() : Infinity;
  const nowTime = now.getTime();

  return nowTime >= startsAtTime && nowTime <= expiresAtTime;
}

/**
 * التحقق من توفر مخزون للعرض وحساب الكمية المتبقية
 */
export function getDealStockInfo(deal: any): { isStockAvailable: boolean; remainingQuantity: number; isUnlimited: boolean } {
  if (!deal) {
    return { isStockAvailable: false, remainingQuantity: 0, isUnlimited: false };
  }

  const isUnlimited = Boolean(deal.isUnlimited || deal.maxQuantity == null || deal.maxQuantity <= 0);
  if (isUnlimited) {
    return { isStockAvailable: true, remainingQuantity: 9999, isUnlimited: true };
  }

  const remaining = Math.max(0, (deal.maxQuantity || 0) - (deal.soldQuantity || 0));
  return {
    isStockAvailable: remaining > 0,
    remainingQuantity: remaining,
    isUnlimited: false,
  };
}

/**
 * العثور على عرض فلاش نشط حالياً لصنف معين
 */
export async function findActiveFlashDealForItem(menuItemId: string, now: Date = new Date(), db: any = prisma) {
  const deals = await db.flashDeal.findMany({
    where: {
      menuItemId,
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  for (const deal of deals) {
    if (isFlashDealCurrentlyActive(deal, now)) {
      return deal;
    }
  }
  return null;
}

/**
 * تسجيل استهلاك عروض الفلاش فور إنشاء الطلب من الطالب.
 * يتم زيادة soldQuantity بعدد الأصناف المطلوبة حتى لو كان الطلب ما زال قيد الانتظار (PENDING).
 */
export async function recordFlashDealsConsumption(
  items: Array<{ menuItemId?: string | null; quantity: number }>,
  promoCode?: string | null,
  branchId?: string | null,
  tx?: any
): Promise<void> {
  const db = tx || prisma;
  const now = new Date();
  let anyUpdated = false;

  try {
    for (const item of items) {
      if (!item.menuItemId) continue;
      const quantity = Math.max(1, Number(item.quantity) || 1);

      const deal = await findActiveFlashDealForItem(item.menuItemId, now, db);

      if (deal) {
        await db.flashDeal.update({
          where: { id: deal.id },
          data: {
            soldQuantity: { increment: quantity },
          },
        });
        anyUpdated = true;
      }
    }

    if (promoCode && String(promoCode).trim()) {
      const cleanCode = String(promoCode).trim().toUpperCase();
      const promoDeals = await db.flashDeal.findMany({
        where: {
          promoCode: cleanCode,
          isActive: true,
        },
      });

      const promoDeal = promoDeals.find((d: any) => isFlashDealCurrentlyActive(d, now));

      if (promoDeal) {
        await db.flashDeal.update({
          where: { id: promoDeal.id },
          data: {
            soldQuantity: { increment: 1 },
          },
        });
        anyUpdated = true;
      }
    }

    if (anyUpdated) {
      notifyFlashDealsUpdated();
      if (branchId) {
        notifyBranchMenuChanged(branchId);
      }
    }
  } catch (error) {
    console.error("Failed to record flash deal consumption:", error);
  }
}

/**
 * إعادة استرجاع كمية عروض الفلاش تلقائياً في حال إلغاء أو رفض الطلب في أي مرحلة.
 */
export async function restoreFlashDealsForOrder(orderId: string, tx?: any): Promise<void> {
  const db = tx || prisma;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) return;
    let anyRestored = false;

    // استرجاع كميات الأصناف المرتبطة بعروض فلاش
    for (const item of order.items) {
      if (!item.menuItemId) continue;
      const quantity = Math.max(1, Number(item.quantity) || 1);

      const deal = await db.flashDeal.findFirst({
        where: {
          menuItemId: item.menuItemId,
        },
      });

      if (deal && deal.soldQuantity > 0) {
        const newSold = Math.max(0, deal.soldQuantity - quantity);
        await db.flashDeal.update({
          where: { id: deal.id },
          data: {
            soldQuantity: newSold,
          },
        });
        anyRestored = true;
      }
    }

    // استرجاع كود الخصم المرتبط بعرض فلاش إن وجد
    if (order.promoCode && String(order.promoCode).trim()) {
      const cleanCode = String(order.promoCode).trim().toUpperCase();
      const promoDeal = await db.flashDeal.findFirst({
        where: {
          promoCode: cleanCode,
        },
      });

      if (promoDeal && promoDeal.soldQuantity > 0) {
        const newSold = Math.max(0, promoDeal.soldQuantity - 1);
        await db.flashDeal.update({
          where: { id: promoDeal.id },
          data: {
            soldQuantity: newSold,
          },
        });
        anyRestored = true;
      }
    }

    if (anyRestored) {
      notifyFlashDealsUpdated();
      if (order.branchId) {
        notifyBranchMenuChanged(order.branchId);
      }
    }
  } catch (error) {
    console.error(`Failed to restore flash deals for order ${orderId}:`, error);
  }
}
