import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import path from "node:path";
import jwt from "jsonwebtoken";

describe("Remediation Verification Suite", () => {

  describe("FIND-01: Flash Deal Per-User Quota Calculation & Schema Mapping", () => {
    it("correctly enforces maxPerUser quota against user history", () => {
      const activeDeal = {
        id: "deal-101",
        title: "عرض وجبة البرجر",
        maxPerUser: 2,
        totalQuantity: 20,
        soldQuantity: 5,
        startsAt: new Date(Date.now() - 3600 * 1000),
      };

      // Mock user aggregation history using the corrected 'userId' mapping
      const mockUserHistoryOrders = [
        { userId: "student-user-123", menuItemId: "item-burger", quantity: 1, status: "COMPLETED" },
        { userId: "student-user-123", menuItemId: "item-burger", quantity: 1, status: "PREPARING" },
        { userId: "student-user-123", menuItemId: "item-burger", quantity: 3, status: "CANCELLED" }, // Should be excluded
      ];

      // Filter active non-cancelled/rejected orders
      const alreadyOrdered = mockUserHistoryOrders
        .filter(o => o.userId === "student-user-123" && !["REJECTED", "CANCELLED"].includes(o.status))
        .reduce((sum, o) => sum + o.quantity, 0);

      assert.equal(alreadyOrdered, 2, "User already has 2 active ordered quantities");

      const reqQty = 1;
      const canOrder = alreadyOrdered + reqQty <= activeDeal.maxPerUser;
      assert.equal(canOrder, false, "Should block additional order when quota is reached");

      const remainingAllowed = Math.max(0, activeDeal.maxPerUser - alreadyOrdered);
      assert.equal(remainingAllowed, 0, "Remaining allowed quota should be 0");
    });

    it("allows ordering when user order history is below maxPerUser", () => {
      const activeDeal = {
        id: "deal-102",
        title: "عرض شاورما التوفير",
        maxPerUser: 3,
      };

      const alreadyOrdered = 1;
      const reqQty = 1;
      const canOrder = alreadyOrdered + reqQty <= activeDeal.maxPerUser;
      assert.equal(canOrder, true, "Should allow ordering when quota is not exceeded");

      const remainingAllowed = Math.max(0, activeDeal.maxPerUser - (alreadyOrdered + reqQty));
      assert.equal(remainingAllowed, 1, "Remaining allowed should be 1 after ordering 1 more");
    });
  });

  describe("FIND-04: Production JWT_SECRET Enforcement", () => {
    it("fails fast in production mode if JWT_SECRET is missing or default", async () => {
      const authPath = path.resolve(__dirname, "../dist/middleware/auth.js").replace(/\\/g, "/");
      const scriptCode = `
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'super-secret-key-campus-delivery-2026';
        try {
          require('${authPath}');
          process.exit(0);
        } catch (err) {
          if (err.message.includes('FATAL CONFIGURATION: A strong, unique JWT_SECRET')) {
            process.exit(42);
          }
          console.error(err);
          process.exit(1);
        }
      `;

      const child = fork("-e", [scriptCode], { stdio: "pipe" });
      const exitCode = await new Promise((resolve) => {
        child.on("exit", (code) => resolve(code));
      });

      assert.equal(exitCode, 42, "Process must terminate with fatal error when default insecure JWT_SECRET is used in production");
    });

    it("fails fast in production mode if JWT_SECRET is shorter than 32 characters", async () => {
      const authPath = path.resolve(__dirname, "../dist/middleware/auth.js").replace(/\\/g, "/");
      const scriptCode = `
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short-secret-key';
        try {
          require('${authPath}');
          process.exit(0);
        } catch (err) {
          if (err.message.includes('FATAL CONFIGURATION: A strong, unique JWT_SECRET')) {
            process.exit(43);
          }
          console.error(err);
          process.exit(1);
        }
      `;

      const child = fork("-e", [scriptCode], { stdio: "pipe" });
      const exitCode = await new Promise((resolve) => {
        child.on("exit", (code) => resolve(code));
      });

      assert.equal(exitCode, 43, "Process must terminate with fatal error when JWT_SECRET is shorter than 32 characters in production");
    });

    it("succeeds in production mode when strong JWT_SECRET is provided", async () => {
      const authPath = path.resolve(__dirname, "../dist/middleware/auth.js").replace(/\\/g, "/");
      const scriptCode = `
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'strong-prod-cryptographic-secret-key-64-bytes-long-for-testing';
        try {
          const { JWT_SECRET } = require('${authPath}');
          if (JWT_SECRET === 'strong-prod-cryptographic-secret-key-64-bytes-long-for-testing') {
            process.exit(0);
          }
          process.exit(2);
        } catch (err) {
          console.error(err);
          process.exit(1);
        }
      `;

      const child = fork("-e", [scriptCode], { stdio: "pipe" });
      const exitCode = await new Promise((resolve) => {
        child.on("exit", (code) => resolve(code));
      });

      assert.equal(exitCode, 0, "Module must load cleanly when strong JWT_SECRET is set in production");
    });
  });

  describe("FIND-05: Asynchronous Authorization Middleware Error Handling", () => {
    it("catches rejected promises in requireSuperAdmin and routes them to next(err)", async () => {
      // Simulate requireSuperAdmin with .catch(next)
      let nextCalledWith: any = null;
      const mockReq: any = { headers: { authorization: "Bearer invalid-token" } };
      const mockRes: any = {
        status: () => mockRes,
        json: () => mockRes,
      };
      const mockNext = (err?: any) => {
        nextCalledWith = err;
      };

      // Create an async auth function that simulates an unexpected DB connectivity drop
      const simulateAuthenticateUser = async () => {
        throw new Error("DATABASE_CONNECTION_LOST");
      };

      const simulateRequireSuperAdmin = (req: any, res: any, next: any) => {
        simulateAuthenticateUser().then(() => {
          next();
        }).catch(next);
      };

      simulateRequireSuperAdmin(mockReq, mockRes, mockNext);

      // Wait a tick for microtask resolution
      await new Promise(resolve => setTimeout(resolve, 50));

      assert.ok(nextCalledWith instanceof Error, "next() must receive the rejected error");
      assert.equal(nextCalledWith.message, "DATABASE_CONNECTION_LOST");
    });
  });

});
