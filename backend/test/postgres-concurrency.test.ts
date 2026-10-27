import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/prisma.js";
import { recordFlashDealsConsumption } from "../src/services/flashDeal.service.js";

describe("Real PostgreSQL Database Concurrency & Flash Deal Contention", () => {
  let testUserId: string | null = null;
  let testBranchId: string | null = null;
  let testCategoryId: string | null = null;
  let testItemId: string | null = null;
  let testDealId: string | null = null;

  before(async () => {
    // 0. Find or create a test user
    let user = await prisma.user.findFirst({
      where: { phone: "01099999999" },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "__TEST_CONCURRENCY_USER__",
          phone: "01099999999",
          password: "mock-password-hash",
          role: "CUSTOMER",
          isVerified: true,
        },
      });
    }
    testUserId = user.id;

    // 1. Find or create an isolated branch for testing
    let branch = await prisma.branch.findFirst({
      where: { name: "__TEST_CONCURRENCY_BRANCH__" },
    });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: "__TEST_CONCURRENCY_BRANCH__",
          slug: "test-concurrency-branch",
          phone: "01000000000",
          isActive: true,
        },
      });
    }
    testBranchId = branch.id;

    // 2. Create test category and menu item
    const category = await prisma.menuCategory.create({
      data: {
        branchId: testBranchId,
        name: "Test Cat Concurrency",
      },
    });
    testCategoryId = category.id;

    const item = await prisma.menuItem.create({
      data: {
        branchId: testBranchId,
        categoryId: testCategoryId,
        name: "Test Concurrency Item",
        basePrice: 50.0,
        isAvailable: true,
      },
    });
    testItemId = item.id;

    // 3. Create a test flash deal with strictly 2 total maxQuantity and 1 already sold
    // Thus exactly 1 remaining quantity is available!
    const deal = await prisma.flashDeal.create({
      data: {
        title: "Test Concurrency Flash Deal",
        branchId: testBranchId,
        menuItemId: testItemId,
        discountPrice: 25.0,
        maxQuantity: 2,
        soldQuantity: 1, // Only 1 item remains!
        isUnlimited: false,
        isActive: true,
        startsAt: new Date(Date.now() - 3600 * 1000),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
    testDealId = deal.id;
  });

  after(async () => {
    // Clean up created test entities in reverse order
    try {
      if (testDealId) {
        await prisma.flashDeal.deleteMany({ where: { id: testDealId } });
      }
      if (testItemId) {
        await prisma.menuItem.deleteMany({ where: { id: testItemId } });
      }
      if (testCategoryId) {
        await prisma.menuCategory.deleteMany({ where: { id: testCategoryId } });
      }
      if (testBranchId) {
        await prisma.branch.deleteMany({ where: { id: testBranchId } });
      }
      if (testUserId) {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    } catch (_err) {
      // Ignore cleanup error
    }
  });

  it("prevents overselling under real concurrent claims on PostgreSQL", async () => {
    assert.ok(testItemId, "testItemId must exist");
    assert.ok(testDealId, "testDealId must exist");

    // Two customers simultaneously attempt to claim 1 item each
    // Because remaining is 1, exactly ONE must succeed, and the other must reject with FLASH_DEAL_EXHAUSTED
    const claim1 = prisma.$transaction(async (tx) => {
      await recordFlashDealsConsumption([{ menuItemId: testItemId, quantity: 1 }], null, testBranchId, tx);
      return "CLAIM_1_SUCCESS";
    });

    const claim2 = prisma.$transaction(async (tx) => {
      await recordFlashDealsConsumption([{ menuItemId: testItemId, quantity: 1 }], null, testBranchId, tx);
      return "CLAIM_2_SUCCESS";
    });

    const results = await Promise.allSettled([claim1, claim2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one transaction must succeed under concurrency");
    assert.equal(rejected.length, 1, "Exactly one transaction must fail with inventory exhaustion");

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejectionReason?.message === "FLASH_DEAL_EXHAUSTED" ||
      rejectionReason?.message?.includes("FLASH_DEAL_EXHAUSTED"),
      `Expected error FLASH_DEAL_EXHAUSTED, got: ${rejectionReason?.message}`
    );

    // Verify database state: soldQuantity must be exactly 2 (capped at maxQuantity), NEVER 3!
    const finalDeal = await prisma.flashDeal.findUnique({
      where: { id: testDealId! },
    });

    assert.equal(finalDeal?.soldQuantity, 2, "soldQuantity must equal 2 in PostgreSQL; overselling was prevented");
  });

  it("verifies that failed claims roll back their complete transaction", async () => {
    assert.ok(testItemId);
    assert.ok(testDealId);

    // Verify current sold is 2 (deal fully exhausted)
    const exhaustedDeal = await prisma.flashDeal.findUnique({ where: { id: testDealId! } });
    assert.equal(exhaustedDeal?.soldQuantity, 2);

    // Attempt an order creation inside a transaction that should fail during flash deal consumption
    let orderCreatedBeforeRollback = false;
    let createdOrderId: string | null = null;

    try {
      await prisma.$transaction(async (tx) => {
        // Step A: Create dummy order record inside tx
        const dummyOrder = await tx.order.create({
          data: {
            orderNumber: 999999,
            branchId: testBranchId!,
            userId: testUserId!,
            subtotal: 50.0,
            deliveryFee: 0,
            total: 50.0,
            customerPhone: "01000000000",
            customerName: "Rollback Test Student",
            status: "PENDING",
          },
        });
        createdOrderId = dummyOrder.id;
        orderCreatedBeforeRollback = true;

        // Step B: Consume flash deal which will fail because soldQuantity == maxQuantity
        await recordFlashDealsConsumption([{ menuItemId: testItemId, quantity: 1 }], null, testBranchId, tx);
      });
      assert.fail("Transaction should have thrown FLASH_DEAL_EXHAUSTED");
    } catch (err: any) {
      assert.equal(err?.message, "FLASH_DEAL_EXHAUSTED");
    }

    assert.ok(orderCreatedBeforeRollback, "Order was created in tx memory before error");

    // Verify rollback: the order MUST NOT exist in the database!
    if (createdOrderId) {
      const persistedOrder = await prisma.order.findUnique({
        where: { id: createdOrderId },
      });
      assert.equal(persistedOrder, null, "Order must be rolled back and not persisted in database");
    }
  });

});
