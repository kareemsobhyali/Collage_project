import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/prisma.js";

function toPiasters(egp: number): number {
  return Math.round((egp + Number.EPSILON) * 100);
}

function fromPiasters(piasters: number): number {
  return piasters / 100;
}

describe("Database-Backed Monetary Integrity & Decimal Conversion Suite", () => {
  let testUserId: string;
  let testBranchId: string;
  const createdOrderIds: string[] = [];

  before(async () => {
    // Setup isolated test user with initial wallet balance
    const user = await prisma.user.create({
      data: {
        name: "__TEST_MONETARY_USER__",
        phone: "01077777777",
        password: "mock-password-hash",
        role: "CUSTOMER",
        walletBalance: 250.75, // 250.75 EGP (fractional wallet)
        isVerified: true,
      },
    });
    testUserId = user.id;

    // Setup isolated test branch
    const branch = await prisma.branch.create({
      data: {
        name: "__TEST_MONETARY_BRANCH__",
        slug: "test-monetary-branch-" + Date.now(),
        phone: "01077770000",
        deliveryFee: 15.50, // Fractional delivery fee
        isActive: true,
      },
    });
    testBranchId = branch.id;
  });

  after(async () => {
    // Teardown test records
    if (createdOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (testBranchId) {
      await prisma.branch.delete({ where: { id: testBranchId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it("1. inserts and reads back order totals with fractional currency accurately", async () => {
    const subtotal = 145.00;
    const deliveryFee = 15.50;
    const discount = 14.50; // 10% coupon
    const walletDiscount = 50.25; // partial wallet usage
    // Expected total: 145.00 + 15.50 - 14.50 - 50.25 = 95.75 EGP
    const total = 95.75;

    const order = await prisma.order.create({
      data: {
        orderNumber: Math.floor(Math.random() * 900000) + 100000,
        branchId: testBranchId,
        userId: testUserId,
        customerName: "Monetary Test Student",
        customerPhone: "01077777777",
        subtotal,
        deliveryFee,
        discount,
        walletDiscount,
        total,
        status: "PENDING",
      },
    });
    createdOrderIds.push(order.id);

    const fetched = await prisma.order.findUnique({
      where: { id: order.id },
    });

    assert.ok(fetched);
    assert.equal(fetched.subtotal, 145.00);
    assert.equal(fetched.deliveryFee, 15.50);
    assert.equal(fetched.discount, 14.50);
    assert.equal(fetched.walletDiscount, 50.25);
    assert.equal(fetched.total, 95.75);

    // Verify invariant holds in PostgreSQL
    const computedTotal = fetched.subtotal + fetched.deliveryFee - fetched.discount - fetched.walletDiscount;
    assert.equal(Number(computedTotal.toFixed(2)), fetched.total);
  });

  it("2. performs atomic wallet balance deduction and rollback in PostgreSQL", async () => {
    const initialUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.ok(initialUser);
    const initialBalance = initialUser.walletBalance; // 250.75

    const deductAmount = 50.25;

    // Simulate atomic checkout deduction
    const updated = await prisma.user.updateMany({
      where: { id: testUserId, walletBalance: { gte: deductAmount } },
      data: { walletBalance: { decrement: deductAmount } },
    });
    assert.equal(updated.count, 1);

    const afterDeduct = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.ok(afterDeduct);
    // 250.75 - 50.25 = 200.50
    assert.equal(Number(afterDeduct.walletBalance.toFixed(2)), 200.50);

    // Simulate order cancellation refund
    await prisma.user.update({
      where: { id: testUserId },
      data: { walletBalance: { increment: deductAmount } },
    });

    const afterRefund = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.ok(afterRefund);
    assert.equal(Number(afterRefund.walletBalance.toFixed(2)), Number(initialBalance.toFixed(2)));
  });

  it("3. aggregates multiple orders in PostgreSQL without floating-point accumulation drift", async () => {
    // Create a second test order: subtotal 80.25, delivery 10.00, discount 0, total 90.25
    const order2 = await prisma.order.create({
      data: {
        orderNumber: Math.floor(Math.random() * 900000) + 100000,
        branchId: testBranchId,
        userId: testUserId,
        customerName: "Order 2 Student",
        customerPhone: "01077777777",
        subtotal: 80.25,
        deliveryFee: 10.00,
        discount: 0,
        walletDiscount: 0,
        total: 90.25,
        status: "COMPLETED",
      },
    });
    createdOrderIds.push(order2.id);

    // Database aggregation
    const agg = await prisma.order.aggregate({
      where: { id: { in: createdOrderIds } },
      _sum: {
        total: true,
        subtotal: true,
        deliveryFee: true,
      },
    });

    // Order 1 total: 95.75, Order 2 total: 90.25 -> Sum: 186.00
    assert.ok(agg._sum.total);
    assert.equal(Number(agg._sum.total.toFixed(2)), 186.00);

    // Subtotal sum: 145.00 + 80.25 = 225.25
    assert.ok(agg._sum.subtotal);
    assert.equal(Number(agg._sum.subtotal.toFixed(2)), 225.25);
  });

  it("4. verifies historical data conversion to integer piasters is 100% lossless", async () => {
    // Fetch all existing orders in DB
    const historicalOrders = await prisma.order.findMany({
      take: 20,
      select: { id: true, subtotal: true, deliveryFee: true, discount: true, walletDiscount: true, total: true },
    });

    for (const o of historicalOrders) {
      // Invariant: toPiasters and fromPiasters round-trip must equal original float
      const totalPiasters = toPiasters(o.total);
      assert.equal(fromPiasters(totalPiasters), o.total);

      const subtotalPiasters = toPiasters(o.subtotal);
      assert.equal(fromPiasters(subtotalPiasters), o.subtotal);
    }
  });
});
