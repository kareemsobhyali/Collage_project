import prisma from "../prisma.js";
import { notifyFlashDealsUpdated, notifyBranchMenuChanged } from "../sockets/socketManager.js";

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

      const deal = await db.flashDeal.findFirst({
        where: {
          menuItemId: item.menuItemId,
          isActive: true,
          expiresAt: { gt: now },
          startsAt: { lte: now },
        },
      });

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
      const promoDeal = await db.flashDeal.findFirst({
        where: {
          promoCode: cleanCode,
          isActive: true,
          expiresAt: { gt: now },
        },
      });

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
