import { test, describe } from "node:test";
import assert from "node:assert/strict";

/**
 * Monetary Arithmetic Helper Utilities
 * Represents canonical conversion between Egyptian Pounds (EGP) and Piasters (Minor Currency Units)
 */
export function toPiasters(egp: number): number {
  return Math.round((egp + Number.EPSILON) * 100);
}

export function fromPiasters(piasters: number): number {
  return piasters / 100;
}

export function roundToCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function computeOrderTotals(params: {
  items: Array<{ unitPrice: number; quantity: number }>;
  deliveryFee: number;
  promo?: { discountType: "PERCENT" | "FIXED"; value: number; minOrder?: number };
  walletBalance: number;
  useWallet: boolean;
}) {
  // 1. Subtotal calculated from line items
  const subtotalPiasters = params.items.reduce((acc, item) => {
    const itemUnitPricePiasters = toPiasters(item.unitPrice);
    return acc + itemUnitPricePiasters * item.quantity;
  }, 0);

  const deliveryFeePiasters = toPiasters(Math.max(0, params.deliveryFee));

  // 2. Promo discount
  let discountPiasters = 0;
  if (params.promo) {
    const minOrderPiasters = toPiasters(params.promo.minOrder || 0);
    if (subtotalPiasters >= minOrderPiasters) {
      if (params.promo.discountType === "PERCENT") {
        discountPiasters = Math.round((subtotalPiasters * params.promo.value) / 100);
      } else {
        discountPiasters = Math.min(subtotalPiasters, toPiasters(params.promo.value));
      }
    }
  }

  // Pre-wallet balance due
  const preWalletDuePiasters = Math.max(0, subtotalPiasters + deliveryFeePiasters - discountPiasters);

  // 3. Wallet deduction
  let walletDiscountPiasters = 0;
  if (params.useWallet && params.walletBalance > 0) {
    const userWalletPiasters = toPiasters(params.walletBalance);
    walletDiscountPiasters = Math.min(preWalletDuePiasters, userWalletPiasters);
  }

  // 4. Final out-of-pocket cash / electronic total
  const finalTotalPiasters = Math.max(0, preWalletDuePiasters - walletDiscountPiasters);

  return {
    subtotal: fromPiasters(subtotalPiasters),
    deliveryFee: fromPiasters(deliveryFeePiasters),
    discount: fromPiasters(discountPiasters),
    walletDiscount: fromPiasters(walletDiscountPiasters),
    total: fromPiasters(finalTotalPiasters),
    subtotalPiasters,
    deliveryFeePiasters,
    discountPiasters,
    walletDiscountPiasters,
    totalPiasters: finalTotalPiasters,
  };
}

describe("Monetary Precision & Financial Calculation Suite", () => {
  describe("1. IEEE 754 Floating-Point Mitigation (Piaster Conversions)", () => {
    test("converts fractional amounts to integer piasters without float drift", () => {
      // Classic 0.1 + 0.2 = 0.30000000000000004 in raw IEEE 754
      const raw = 0.1 + 0.2;
      assert.notEqual(raw, 0.3); // Raw JS fails

      const piasters = toPiasters(raw);
      assert.equal(piasters, 30); // 30 piasters exact
      assert.equal(fromPiasters(piasters), 0.3);
    });

    test("handles standard Egyptian currency denominations cleanly", () => {
      assert.equal(toPiasters(140.50), 14050);
      assert.equal(toPiasters(99.25), 9925);
      assert.equal(toPiasters(45.75), 4575);
      assert.equal(toPiasters(0.00), 0);
    });
  });

  describe("2. Order Totals Invariant Verification", () => {
    test("preserves invariant: subtotal + deliveryFee - discount - walletDiscount === total", () => {
      const order = computeOrderTotals({
        items: [
          { unitPrice: 105.00, quantity: 1 }, // 105.00
          { unitPrice: 25.50, quantity: 2 },  // 51.00 -> subtotal = 156.00
        ],
        deliveryFee: 15.00,
        promo: { discountType: "PERCENT", value: 10, minOrder: 100 }, // 10% of 156 = 15.60
        walletBalance: 50.00,
        useWallet: true,
      });

      // Subtotal: 156.00
      assert.equal(order.subtotal, 156.00);
      // Delivery: 15.00
      assert.equal(order.deliveryFee, 15.00);
      // Discount: 15.60
      assert.equal(order.discount, 15.60);
      // PreWalletDue: 156 + 15 - 15.60 = 155.40
      // WalletDiscount: min(155.40, 50.00) = 50.00
      assert.equal(order.walletDiscount, 50.00);
      // Final Total: 155.40 - 50.00 = 105.40
      assert.equal(order.total, 105.40);

      // Verify exact mathematical invariant in minor units
      assert.equal(
        order.subtotalPiasters + order.deliveryFeePiasters - order.discountPiasters - order.walletDiscountPiasters,
        order.totalPiasters
      );
    });

    test("caps fixed discount to subtotal to prevent negative due amount", () => {
      const order = computeOrderTotals({
        items: [{ unitPrice: 30.00, quantity: 1 }],
        deliveryFee: 10.00,
        promo: { discountType: "FIXED", value: 100.00 }, // Discount exceeds subtotal
        walletBalance: 0,
        useWallet: false,
      });

      assert.equal(order.subtotal, 30.00);
      // Discount capped at subtotal: 30.00
      assert.equal(order.discount, 30.00);
      // Customer pays only delivery fee: 10.00
      assert.equal(order.total, 10.00);
    });

    test("handles full wallet coverage (total = 0)", () => {
      const order = computeOrderTotals({
        items: [{ unitPrice: 50.00, quantity: 1 }],
        deliveryFee: 10.00,
        walletBalance: 100.00,
        useWallet: true,
      });

      assert.equal(order.subtotal, 50.00);
      assert.equal(order.deliveryFee, 10.00);
      assert.equal(order.walletDiscount, 60.00);
      assert.equal(order.total, 0.00);
    });
  });

  describe("3. Wallet Deductions & Refund Consistency", () => {
    test("refunds exact wallet discount on order cancellation without loss", () => {
      const initialWallet = 250.75;
      const walletDeducted = 140.50;

      const remainingWallet = roundToCurrency(initialWallet - walletDeducted);
      assert.equal(remainingWallet, 110.25);

      // Refund calculation as done in customer.routes.ts line 1872
      const refundedWallet = Number((remainingWallet + walletDeducted).toFixed(2));
      assert.equal(refundedWallet, initialWallet);
    });
  });

  describe("4. Financial Reporting & Batch Aggregations", () => {
    test("aggregates 1,000 orders without IEEE 754 accumulation error", () => {
      // Simulate 1,000 orders each with 140.50 total
      const count = 1000;
      const orderValue = 140.50;

      let sumPiasters = 0;
      let rawFloatSum = 0;

      for (let i = 0; i < count; i++) {
        sumPiasters += toPiasters(orderValue);
        rawFloatSum += orderValue;
      }

      const exactTotal = fromPiasters(sumPiasters);
      assert.equal(exactTotal, 140500.00);
      assert.equal(Math.round(rawFloatSum * 100) / 100, exactTotal);
    });

    test("reconciles gross sales = food net + delivery fees - discounts", () => {
      const orders = [
        { subtotal: 100, deliveryFee: 10, discount: 10, walletDiscount: 0, total: 100 },
        { subtotal: 200, deliveryFee: 15, discount: 0, walletDiscount: 50, total: 165 },
        { subtotal: 50, deliveryFee: 5, discount: 5, walletDiscount: 10, total: 40 },
      ];

      const totalFoodNet = orders.reduce((acc, o) => acc + toPiasters(o.subtotal), 0);
      const totalDeliveryFees = orders.reduce((acc, o) => acc + toPiasters(o.deliveryFee), 0);
      const totalDiscounts = orders.reduce((acc, o) => acc + toPiasters(o.discount + o.walletDiscount), 0);
      const totalCustomerPaid = orders.reduce((acc, o) => acc + toPiasters(o.total), 0);

      // Financial identity: Paid = Food + Delivery - Discounts
      assert.equal(totalCustomerPaid, totalFoodNet + totalDeliveryFees - totalDiscounts);
    });
  });

  describe("5. Large Values & Boundary Limits", () => {
    test("handles large campus catering order without integer overflow", () => {
      const order = computeOrderTotals({
        items: [{ unitPrice: 2500.00, quantity: 40 }], // 100,000.00 EGP
        deliveryFee: 150.00,
        promo: { discountType: "PERCENT", value: 15 }, // 15% discount = 15,000.00 EGP
        walletBalance: 5000.00,
        useWallet: true,
      });

      assert.equal(order.subtotal, 100000.00);
      assert.equal(order.discount, 15000.00);
      assert.equal(order.deliveryFee, 150.00);
      // PreWalletDue = 100,000 + 150 - 15,000 = 85,150.00
      assert.equal(order.walletDiscount, 5000.00);
      assert.equal(order.total, 80150.00);
      assert.equal(order.totalPiasters, 8015000);
    });
  });
});
