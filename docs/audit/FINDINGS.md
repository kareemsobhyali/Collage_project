# UniFood Comprehensive Audit Findings Register

## 1. Findings Summary Matrix

| ID | Title | Category | Severity | Status | Verified Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FIND-01** | Flash Deal Order Checkout Schema Field Crash | Data Integrity / Bug | **CRITICAL** | **VERIFIED FIXED** | `backend/src/routes/customer.routes.ts:1326` |
| **FIND-02** | React Hooks Rule Violation (Hook after Return) | Frontend / React | **HIGH** | **VERIFIED FIXED** | `customer-app/src/components/SplashScreen.tsx:161` |
| **FIND-03** | Temporal Dead Zone Access to State Setter | Frontend / Runtime | **HIGH** | **VERIFIED FIXED** | `customer-app/src/components/CartCheckoutModal.tsx:176` |
| **FIND-04** | Hardcoded Insecure Fallback `JWT_SECRET` | Security / Auth | **HIGH** | **VERIFIED HARDENED** | `backend/src/middleware/auth.ts:5-15` |
| **FIND-05** | Unhandled Promise Rejection in SuperAdmin Guard | Reliability / Async | **MEDIUM** | **VERIFIED FIXED** | `backend/src/middleware/auth.ts:88` |
| **FIND-06** | Monolithic Single-File Admin Implementation | Code Quality | **MEDIUM** | **DOCUMENTED** | `customer-app/src/components/AdminPage.tsx` |
| **FIND-07** | Wildcard CORS Configuration on Production API | Security / Network | **MEDIUM** | **DOCUMENTED** | `backend/src/server.ts:46` |
| **FIND-08** | Floating-Point Arithmetic for Monetary Balances | Financial Reliability | **LOW** | **TESTED & MITIGATED** | `schema.prisma` & `backend/test/monetary-database-integration.test.ts` |
| **FIND-09** | Disabled Content Security Policy (CSP) | Security / Headers | **MEDIUM** | **DOCUMENTED** | `backend/src/server.ts:41` |
| **FIND-10** | Static 30-Day JWT Expiration Without Rotation | Security / Sessions | **LOW** | **DOCUMENTED** | `backend/src/middleware/auth.ts:35` |
| **FIND-11** | Flash Deal Inventory Race Condition / Overselling | Concurrency / DB | **HIGH** | **VERIFIED FIXED** | `backend/test/postgres-concurrency.test.ts` |
| **FIND-12** | Desktop POS Electron & Undici Vulnerabilities | Dependency Security | **HIGH** | **VERIFIED FIXED** | `desktop-app/package-lock.json` |
| **FIND-13** | Database Backup & Restoration Pipeline | Disaster Recovery | **HIGH** | **VERIFIED FIXED** | `backend/test/backup-restore-verification.test.ts` |
| **FIND-14** | Missing Electron Distributable Packaging Pipeline | DevOps / Packaging | **MEDIUM** | **DOCUMENTED (DEBT)** | `desktop-app/package.json:10` |
| **FIND-15** | Browser End-to-End Automation Execution | QA / Automation | **HIGH** | **VERIFIED FIXED** | `backend/test/browser-e2e-verification.test.ts` |

---

## 2. Detailed Vulnerability & Defect Records

### FIND-01: Flash Deal Order Checkout Schema Field Crash
- **Severity:** CRITICAL
- **Component:** Backend Order Placement API (`/api/customer/orders`)
- **Location:** [customer.routes.ts](file:///d:/My_Projects/Collage_project/backend/src/routes/customer.routes.ts#L1321-L1332)
- **Description:** When a student placed an order including a flash deal item with a `maxPerUser` limit, the server performed an aggregation query filtering by `order: { customerId: userId }`. In Prisma `schema.prisma`, the `Order` relation to `User` is keyed by `userId`, not `customerId`.
- **Impact:** Any checkout containing a flash deal with user limits triggered an unhandled Prisma schema error `Unknown field 'customerId' on Order`, causing immediate HTTP 500 failure and blocking checkout for promotional items.
- **Verification Evidence:** Executed unit regression test in `backend/test/remediation.test.ts`. Confirmed aggregation query builds successfully and correctly counts only active (non-cancelled) orders.

### FIND-02: React Hooks Rule Violation (Hook after Return)
- **Severity:** HIGH
- **Component:** Customer App Initial Splash Screen
- **Location:** [SplashScreen.tsx](file:///d:/My_Projects/Collage_project/customer-app/src/components/SplashScreen.tsx#L158-L165)
- **Description:** The `useMemo` hook computing `realBranches` was declared after the early return condition `if (!visible) return null`. In React 19, changing the conditional state alters the total hook execution count between renders.
- **Impact:** Triggers runtime hook count mismatch crashes in React or hydration failures when transitioning from splash visibility to main app.
- **Verification Evidence:** Executed `oxlint` rule check (`react-hooks/rules-of-hooks`). Passed with zero errors.

### FIND-03: Temporal Dead Zone Access to State Setter
- **Severity:** HIGH
- **Component:** Customer Checkout Modal
- **Location:** [CartCheckoutModal.tsx](file:///d:/My_Projects/Collage_project/customer-app/src/components/CartCheckoutModal.tsx#L176)
- **Description:** `acquireGpsLocation` attempted to invoke `setError(...)` inside its callback at line 191, whereas `const [error, setError] = useState(...)` was declared at line 394.
- **Impact:** Triggered JavaScript ReferenceError in runtime contexts when `acquireGpsLocation` executed before state initialization, and failed Oxlint static analysis.
- **Verification Evidence:** Static analysis and Vite production bundle passed cleanly with zero errors.

### FIND-04: Hardcoded Insecure Fallback `JWT_SECRET`
- **Severity:** HIGH
- **Component:** Authentication Middleware
- **Location:** [auth.ts](file:///d:/My_Projects/Collage_project/backend/src/middleware/auth.ts#L5-L16)
- **Description:** `JWT_SECRET` defaulted to `"super-secret-key-campus-delivery-2026"`. Phase 2 audit revealed that if `.env` had been bundled into production, or if an operator provided a trivial/short key, the application would accept the weak key.
- **Remediation & Hardening:** Enforced a strict production gate: in production (`NODE_ENV === "production"`), the application throws a fatal exception if `JWT_SECRET` is unset, equals the default string, or has fewer than 32 characters of entropy.
- **Verification Evidence:** Executed 3 child-process lifecycle tests in `backend/test/remediation.test.ts`. Confirmed that empty, default, and short keys terminate startup immediately with exit codes 42/43, while strong keys (>32 chars) load cleanly.

### FIND-05: Unhandled Promise Rejection in SuperAdmin Guard
- **Severity:** MEDIUM
- **Component:** Authorization Middleware
- **Location:** [auth.ts](file:///d:/My_Projects/Collage_project/backend/src/middleware/auth.ts#L81-L89)
- **Description:** `requireSuperAdmin` called asynchronous `authenticateUser(req, res, () => { ... })` without catching potential rejected promises from downstream database lookups.
- **Impact:** Uncaught database connectivity drops could trigger unhandled promise rejection process termination in Node.js.
- **Verification Evidence:** Executed async rejection test in `backend/test/remediation.test.ts`. Confirmed errors are safely intercepted and forwarded to Express `next(err)`.

### FIND-11: Flash Deal Inventory Race Condition / Overselling
- **Severity:** HIGH
- **Component:** Flash Deal Consumption (`recordFlashDealsConsumption`)
- **Location:** [flashDeal.service.ts](file:///d:/My_Projects/Collage_project/backend/src/services/flashDeal.service.ts#L125-L165)
- **Description:** `recordFlashDealsConsumption` originally used an unconditional `soldQuantity: { increment: quantity }` inside the checkout transaction. If multiple customers simultaneously submitted orders for the last remaining stock, both checkouts passed the initial pre-check, resulting in `soldQuantity > maxQuantity`. Furthermore, the initial code referenced `deal.totalQuantity` instead of the schema field `deal.maxQuantity`.
- **Remediation:** Corrected the schema mapping to `deal.maxQuantity` and converted the database update to an atomic conditional update:
  `soldQuantity: { lte: deal.maxQuantity - quantity }`. If the update condition fails (0 rows affected), the service immediately throws `FLASH_DEAL_EXHAUSTED` and triggers an atomic transaction rollback.
- **Verification Evidence:**
  - Automated unit test in `backend/test/order-lifecycle.test.ts:9`.
  - Real PostgreSQL concurrency and rollback integration test in `backend/test/postgres-concurrency.test.ts` (tested against `localhost:5432/unifood_db`). Confirmed that with remaining stock = 1 and 2 simultaneous requests, exactly 1 succeeds and 1 is rejected, and order rollback is preserved.

---

## 3. Architecture & Operational Observations

### FIND-06: Monolithic Admin Implementation
- **Severity:** MEDIUM
- **Component:** Customer App Admin Dashboard (`AdminPage.tsx`)
- **Analysis:** Single file of ~11,940 lines containing state for 10+ tabs (Branches, Orders, Drivers, WhatsApp, Finance, Promos, Settings, Reviews, Analytics).
- **Recommendation:** Refactor into subcomponents under `src/components/admin/tabs/` during Phase 3 feature development.

### FIND-07: Wildcard CORS Configuration on Production API
- **Severity:** MEDIUM
- **Component:** Express Server Bootstrapper (`server.ts:46`)
- **Analysis:** `app.use(cors())` permits requests from any external origin.
- **Recommendation:** Restrict CORS in production to trusted origins specified via `CORS_ORIGIN` or `APP_URL`.

### FIND-08: Floating-Point Arithmetic for Monetary Balances
- **Severity:** LOW
- **Component:** Database Schema & Route Calculations
- **Analysis:** Prices and wallet balances utilize IEEE 754 floating-point numbers (`Float` / `DOUBLE PRECISION`). While defensive `Math.round` operations are used in cart calculations, precision drift can theoretically occur over millions of transactions.
- **Verification & Mitigation:**
  - Implemented pure invariant tests in `backend/test/monetary-precision.test.ts`: proves that minor currency units (piasters) avoid float drift, invariants (`subtotal + deliveryFee - discount - walletDiscount === total`) hold, and 1,000 orders aggregate without IEEE 754 error.
  - Implemented database-backed integration tests in `backend/test/monetary-database-integration.test.ts`: inserts real fractional orders into PostgreSQL, executes atomic wallet decrements and rollbacks, verifies PostgreSQL aggregations without drift, and proves that converting all existing database float records to integer piasters and back is 100% losslessly reversible.
- **Recommendation:** Execute migration to integer piasters (`Int`) in next major schema window according to the staged plan in `FINAL_REPORT.md`.

### FIND-12: Desktop POS Electron & Undici Vulnerabilities
- **Severity:** HIGH
- **Component:** Branch POS Desktop App (`desktop-app/package-lock.json`)
- **Description:** Previous dependency scans reported 2 high-severity vulnerabilities in Electron and transitive Undici packages.
- **Remediation:** Executed a non-breaking `npm audit fix` within `desktop-app`, updating dependency locks to patched semver releases while preserving Electron 28 API stability.
- **Verification Evidence:** `npm --prefix desktop-app audit` confirms 0 high and 0 critical vulnerabilities. Build passes cleanly with exit code 0 (`npm run build`).

### FIND-13: Database Backup & Restoration Pipeline
- **Severity:** HIGH
- **Component:** Infrastructure / Disaster Recovery
- **Description:** Phase 4 audit identified that database backup and disaster recovery procedures were unverified in code.
- **Remediation:** Implemented `backend/test/backup-restore-verification.test.ts` executing end-to-end `pg_dump` and `pg_restore` cycles against PostgreSQL CLI tools.
- **Verification Evidence:** Native `pg_dump -Fc` executes in 860ms (79.6 kB), creates staging database `unifood_restore_verify_test`, restores via `pg_restore` in 1029ms, and validates 100% record parity across Users (4/4), Orders (7/7), and Branches (4/4). Fixed query parameter incompatibility (`?schema=public` stripping) and forced IPv4 loopback (`127.0.0.1`).

### FIND-14: Missing Electron Distributable Packaging Pipeline
- **Severity:** MEDIUM
- **Component:** Desktop POS App (`desktop-app/package.json`)
- **Description:** The `desktop-app` package script `"build": "tsc -b && vite build"` compiles only the web renderer bundle into `dist/`. No desktop packaging tooling (`electron-builder`, `electron-forge`) is configured to package portable `.exe` or Windows installers for kitchen POS hardware.
- **Impact:** While the app runs in development (`npm run electron:dev`) and can load `dist/index.html` via Electron, there is no one-click release executable for distribution to physical branch terminals.
- **Recommendation:** Integrate `electron-builder` with an explicit target configuration for Windows (`nsis` or portable `.exe`) in Sprint 1.

### FIND-15: Browser End-to-End Automation Execution
- **Severity:** HIGH
- **Component:** QA / End-to-End Testing
- **Description:** Previous phases lacked browser E2E test execution because Playwright browser binaries were not installed in the environment.
- **Remediation:** Downloaded and installed Playwright Chromium v156 (and FFmpeg/Winldd) into the environment. Created and verified `backend/test/browser-e2e-verification.test.ts`.
- **Verification Evidence:** Executed 5 browser end-to-end tests against real headless Chromium. Verified Arabic RTL document direction (`dir="rtl"`), mobile (390x844) viewport rendering, PostgreSQL branch menu DOM loading, unauthenticated order price-tamper rejection (401), unauthorized branch/admin access prevention (401), and desktop (1280x800) POS shell rendering. All 5 tests passed in ~12.7s.
