import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";
import { 
  authenticateUser, 
  requireSuperAdmin, 
  authenticateBranch, 
  authenticateDriver,
  JWT_SECRET 
} from "../src/middleware/auth.js";

describe("API Authorization & Role Guard HTTP Integration Tests", () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());

    // 1. SuperAdmin protected route
    app.get("/api/admin/protected-branches", requireSuperAdmin, (_req, res) => {
      res.json({ success: true, scope: "SUPERADMIN" });
    });

    // 2. Branch POS protected route
    app.get("/api/branch/orders", authenticateBranch, (req: any, res) => {
      res.json({ success: true, branchId: req.branch?.branchId });
    });

    // 3. Driver protected route
    app.get("/api/driver/assigned-orders", authenticateDriver, (req: any, res) => {
      res.json({ success: true, driverId: req.driver?.driverId });
    });

    // 4. Customer protected route
    app.get("/api/customer/my-wallet", authenticateUser, (req: any, res) => {
      res.json({ success: true, userId: req.user?.userId });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as any;
    baseUrl = `http://localhost:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("1. SuperAdmin Route Protection (/api/admin/protected-branches)", () => {
    it("rejects request without Authorization header with HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/api/admin/protected-branches`);
      assert.equal(res.status, 401);
      const data = await res.json() as any;
      assert.ok(data.error.includes("غير مصرح"));
    });

    it("rejects request with a CUSTOMER token with HTTP 403", async () => {
      const customerToken = jwt.sign(
        { userId: "student-1", role: "CUSTOMER", phone: "01011112222" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await fetch(`${baseUrl}/api/admin/protected-branches`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      assert.equal(res.status, 403);
      const data = await res.json() as any;
      assert.ok(data.error.includes("صلاحيات غير كافية"));
    });

    it("allows request with a valid SUPERADMIN token with HTTP 200", async () => {
      const adminToken = jwt.sign(
        { userId: "admin-root", role: "SUPERADMIN", phone: "01000000000" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await fetch(`${baseUrl}/api/admin/protected-branches`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json() as any;
      assert.equal(data.scope, "SUPERADMIN");
    });
  });

  describe("2. Branch POS Route Protection (/api/branch/orders)", () => {
    it("rejects request without token with HTTP 401", async () => {
      const res = await fetch(`${baseUrl}/api/branch/orders`);
      assert.equal(res.status, 401);
    });

    it("rejects request with a customer token (missing branch claims) with HTTP 403", async () => {
      const customerToken = jwt.sign(
        { userId: "student-1", role: "CUSTOMER" },
        JWT_SECRET
      );

      const res = await fetch(`${baseUrl}/api/branch/orders`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      assert.equal(res.status, 403);
    });

    it("allows branch staff with valid branchId claims with HTTP 200", async () => {
      const branchToken = jwt.sign(
        { branchUserId: "user-b1", branchId: "branch-shawarma-campus", username: "staff1" },
        JWT_SECRET
      );

      const res = await fetch(`${baseUrl}/api/branch/orders`, {
        headers: { Authorization: `Bearer ${branchToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json() as any;
      assert.equal(data.branchId, "branch-shawarma-campus");
    });
  });

  describe("3. Driver Route Protection (/api/driver/assigned-orders)", () => {
    it("rejects request with forged token signature with HTTP 401", async () => {
      const forgedToken = jwt.sign(
        { driverId: "d-1", branchId: "b-1" },
        "attacker-untrusted-secret"
      );

      const res = await fetch(`${baseUrl}/api/driver/assigned-orders`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });

      assert.equal(res.status, 401);
    });

    it("allows driver with valid driver token with HTTP 200", async () => {
      const driverToken = jwt.sign(
        { driverId: "driver-capt-7", branchId: "branch-shawarma-campus", name: "كابتن محمود" },
        JWT_SECRET
      );

      const res = await fetch(`${baseUrl}/api/driver/assigned-orders`, {
        headers: { Authorization: `Bearer ${driverToken}` },
      });

      assert.equal(res.status, 200);
      const data = await res.json() as any;
      assert.equal(data.driverId, "driver-capt-7");
    });
  });

});
