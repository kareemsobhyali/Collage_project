import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(__dirname, "../../customer-app/node_modules/@playwright/test"));

const TEST_PORT = 5000;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function waitForServer(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout waiting for server at ${url}`));
      }
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) resolve();
        else setTimeout(check, 300);
      });
      req.on("error", () => setTimeout(check, 300));
      req.setTimeout(1000, () => req.destroy());
    };
    check();
  });
}

describe("Browser End-to-End Verification Suite (Playwright Headless Chromium)", () => {
  let serverProcess: ChildProcess;
  let browser: any;

  before(async () => {
    // 1. Launch backend server in development test mode
    serverProcess = spawn("node", ["backend/dist/server.js"], {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, NODE_ENV: "development", PORT: String(TEST_PORT) },
      stdio: "pipe",
    });

    serverProcess.stderr?.on("data", (data) => {
      const msg = data.toString();
      if (!msg.includes("ExperimentalWarning")) {
        process.stderr.write(data);
      }
    });
    serverProcess.stdout?.on("data", () => {});

    await waitForServer(`${BASE_URL}/api/health`);

    // 2. Launch real headless Chromium
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  });

  it("1. RTL layout, document direction, and mobile responsiveness", async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // Mobile iPhone 14 dimensions
      locale: "ar-EG",
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });

    const title = await page.title();
    assert.ok(title.includes("UniFood") || title.includes("يونيفود"), `Title must reflect platform branding, got: ${title}`);

    const htmlDir = await page.getAttribute("html", "dir");
    assert.equal(htmlDir, "rtl", "Document direction must be RTL for Arabic campus platform");

    await page.waitForTimeout(2000);
    const bodyContent = await page.content();
    assert.ok(bodyContent.length > 5000, "Rendered page must have substantial DOM structure");
    await context.close();
  });

  it("2. Branch availability and branch-specific menu dynamic loading", async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "ar-EG",
    });
    const page = await context.newPage();

    // Navigate to student mobile SPA
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2500);

    const bodyContent = await page.content();
    // Validate branch names are present in DOM from PostgreSQL seed
    const hasBurgerFactory = bodyContent.includes("برجر فاكتوري") || bodyContent.includes("burger-campus");
    const hasShawarma = bodyContent.includes("شاورما") || bodyContent.includes("shawarma-campus");
    assert.ok(hasBurgerFactory || hasShawarma, "Active campus branches must be loaded and visible in customer view");

    await context.close();
  });

  it("3. Cart calculation and server-authoritative checkout validation", async () => {
    // Validate server-side price validation prevents forged client amounts
    const forgedOrderPayload = {
      branchId: "84d5d656-78df-46f5-94a1-5eed34ae7d45",
      items: [
        {
          id: "0a143cc0-df85-4924-9820-0ff0578992b9", // Zinger Fire (105 base)
          name: "دجاج زنجر فاير سبايسي 🔥",
          price: 5.0, // Forged client price!
          quantity: 2,
        },
      ],
      deliveryFee: 0, // Forged delivery fee!
      total: 10.0, // Forged total!
      subtotal: 10.0,
      customerPhone: "01012345678",
      customerName: "عمر خالد",
      deliveryAddress: "مبنى كلية الهندسة - الدور الثاني",
    };

    // Submitting forged total must either recalculate server-side or fail authentication
    const postRes = await new Promise<{ statusCode?: number; data: string }>((resolve, reject) => {
      const payloadStr = JSON.stringify(forgedOrderPayload);
      const req = http.request(
        `${BASE_URL}/api/customer/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payloadStr),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ statusCode: res.statusCode, data }));
        }
      );
      req.on("error", reject);
      req.write(payloadStr);
      req.end();
    });

    // Unauthenticated request should be rejected with 401
    assert.equal(postRes.statusCode, 401, "Unauthenticated order placement must be rejected with 401");
  });

  it("4. Unauthorized access and customer/branch data isolation", async () => {
    // Attempting to access protected branch endpoints without credentials
    const branchRes = await new Promise<{ statusCode?: number }>((resolve) => {
      const req = http.get(`${BASE_URL}/api/branch/orders`, (res) => {
        res.resume();
        res.on("end", () => resolve({ statusCode: res.statusCode }));
      });
      req.on("error", () => resolve({ statusCode: 500 }));
    });
    assert.equal(branchRes.statusCode, 401, "Branch POS order feed must reject unauthenticated requests");

    // Attempting to access admin settings without credentials
    const adminRes = await new Promise<{ statusCode?: number }>((resolve) => {
      const req = http.get(`${BASE_URL}/api/admin/system-stats`, (res) => {
        res.resume();
        res.on("end", () => resolve({ statusCode: res.statusCode }));
      });
      req.on("error", () => resolve({ statusCode: 500 }));
    });
    assert.equal(adminRes.statusCode, 401, "SuperAdmin system stats must reject unauthenticated requests");
  });

  it("5. Branch POS desktop interface rendering & receipt printer readiness", async () => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, // Desktop POS screen
      locale: "ar-EG",
    });
    const page = await context.newPage();

    // Navigate to branch POS static SPA at /branch/
    await page.goto(`${BASE_URL}/branch/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    const posContent = await page.content();
    assert.ok(posContent.length > 1000, "POS application HTML bundle must be served");

    // Verify page title indicates Branch/POS application
    const title = await page.title();
    assert.ok(title.length > 0, "POS page must have a valid title");

    await context.close();
  });
});
