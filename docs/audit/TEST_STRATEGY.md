# UniFood Test Strategy & Quality Assurance Architecture

## 1. Quality Engineering Overview
A production commercial food delivery system requires deterministic validation across financial calculations, inventory concurrency, real-time socket events, and thermal printing interfaces.

### Current Verification Baseline
- **Static Type Checking:** TypeScript 5.6/6.0 across all packages (`tsc` and `tsc -b`).
- **Static Analysis & Linting:** Oxlint analyzing React 19 rules of hooks, purity, and AST safety.
- **Production Bundler Verification:** Vite 8.3 / Rolldown verifying asset integrity and chunk generation.

---

## 2. Critical User Journey Test Matrix

| ID | User Journey | Key Assertions | Execution Mode |
| :--- | :--- | :--- | :--- |
| **UJ-01** | Student Phone Registration & OTP | Validates 11-digit regex, stores hashed password, dispatches WhatsApp OTP, enforces 15-min token expiration. | Automated Integration |
| **UJ-02** | Geolocation Zone Enforcement | Verifies customer GPS against branch delivery zones using Haversine formula; blocks checkout if outside zone. | Automated Unit |
| **UJ-03** | Menu Modifiers & Price Snapshotting | Ensures item sizes and selected modifier add-ons are re-queried from DB and snapshotted into `OrderItem`. | Automated Integration |
| **UJ-04** | Flash Deal Limit Enforcement | Verifies `maxPerUser` restriction; blocks user from ordering beyond quota across active deals (`FIND-01`). | Automated Unit |
| **UJ-05** | Double-Spend Wallet Protection | Runs 2 concurrent checkout requests against student wallet with insufficient balance; exactly 1 must succeed. | Concurrency / Stress |
| **UJ-06** | Real-time POS Order Dispatch | Submits order; verifies Socket.io emits `new_order` event to branch room; triggers sound alert. | Socket E2E |
| **UJ-07** | Driver 4-Digit Pickup PIN Handshake | Verifies order can only transition to `COMPLETED` when driver submits correct matching `pickupPin`. | Integration |

---

## 3. Recommended Automated Testing Framework Architecture

To maintain zero regressions as new branches and features are deployed, the following test infrastructure is recommended:

```
Collage_project/
├── backend/
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── priceCalculator.test.ts
│   │   │   ├── haversineDistance.test.ts
│   │   │   └── promoCodeValidation.test.ts
│   │   ├── integration/
│   │   │   ├── auth.integration.test.ts
│   │   │   ├── checkoutTransaction.test.ts
│   │   │   └── branchIsolation.test.ts
│   │   └── vitest.config.ts
├── customer-app/
│   ├── e2e/
│   │   ├── cartCheckout.spec.ts
│   │   └── locationPicker.spec.ts
│   └── playwright.config.ts
```

### Proposed Vitest Checkout Integration Test Example
```typescript
describe("Order Placement API", () => {
  it("rejects order if student exceeds flash deal maxPerUser quota", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        branchId: testBranch.id,
        orderType: "DELIVERY",
        paymentMethod: "CASH",
        items: [{ menuItemId: flashDealItem.id, quantity: 5 }] // Limit is 2
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("الحد الأقصى المسموح به");
  });
});
```

---

## 4. Verification & Regression Checklist

Before every release or production deployment:
1. `cmd.exe /c "npm --prefix backend run build"` (Must exit with code 0).
2. `cmd.exe /c "npm --prefix customer-app run build"` (Must exit with code 0).
3. `cmd.exe /c "npm --prefix desktop-app run build"` (Must exit with code 0).
4. `cmd.exe /c "npm --prefix customer-app run lint"` (Must report 0 errors).
5. Verify schema migrations: `npx prisma migrate status`.
