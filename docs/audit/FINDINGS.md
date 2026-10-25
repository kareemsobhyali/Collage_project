# UniFood Comprehensive Audit Findings Register

## 1. Findings Summary Matrix

| ID | Title | Category | Severity | Status | Verified Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FIND-01** | Flash Deal Order Checkout Schema Field Crash | Data Integrity / Bug | **CRITICAL** | **FIXED** | `backend/src/routes/customer.routes.ts:1326` |
| **FIND-02** | React Hooks Rule Violation (Hook after Return) | Frontend / React | **HIGH** | **FIXED** | `customer-app/src/components/SplashScreen.tsx:161` |
| **FIND-03** | Temporal Dead Zone Access to State Setter | Frontend / Runtime | **HIGH** | **FIXED** | `customer-app/src/components/CartCheckoutModal.tsx:191` |
| **FIND-04** | Hardcoded Insecure Fallback `JWT_SECRET` | Security / Auth | **HIGH** | **FIXED** | `backend/src/middleware/auth.ts:5` |
| **FIND-05** | Unhandled Promise Rejection in SuperAdmin Guard | Reliability / Async | **MEDIUM** | **FIXED** | `backend/src/middleware/auth.ts:88` |
| **FIND-06** | Monolithic Single-File Admin Implementation | Code Quality | **MEDIUM** | **DOCUMENTED** | `customer-app/src/components/AdminPage.tsx` |
| **FIND-07** | Wildcard CORS Configuration on Production API | Security / Network | **MEDIUM** | **DOCUMENTED** | `backend/src/server.ts:46` |
| **FIND-08** | Floating-Point Arithmetic for Monetary Balances | Financial Reliability | **LOW** | **DOCUMENTED** | `schema.prisma` & `customer.routes.ts` |
| **FIND-09** | Disabled Content Security Policy (CSP) | Security / Headers | **MEDIUM** | **DOCUMENTED** | `backend/src/server.ts:41` |
| **FIND-10** | Static 30-Day JWT Expiration Without Rotation | Security / Sessions | **LOW** | **DOCUMENTED** | `backend/src/middleware/auth.ts:35` |

---

## 2. Detailed Vulnerability & Defect Records

### FIND-01: Flash Deal Order Checkout Schema Field Crash
- **Severity:** CRITICAL
- **Component:** Backend Order Placement API (`/api/customer/orders`)
- **Location:** [customer.routes.ts](file:///d:/My_Projects/Collage_project/backend/src/routes/customer.routes.ts#L1321-L1332)
- **Description:** When a student placed an order including a flash deal item with a `maxPerUser` limit, the server performed an aggregation query filtering by `order: { customerId: userId }`. In Prisma `schema.prisma`, the `Order` relation to `User` is keyed by `userId`, not `customerId`.
- **Impact:** Any checkout containing a flash deal with user limits triggered an unhandled Prisma schema error `Unknown field 'customerId' on Order`, causing immediate HTTP 500 failure and blocking checkout for promotional items.
- **Remediation:** Changed `customerId: userId` to `userId: userId`. Verified build with TypeScript compiler.

### FIND-02: React Hooks Rule Violation (Hook after Return)
- **Severity:** HIGH
- **Component:** Customer App Initial Splash Screen
- **Location:** [SplashScreen.tsx](file:///d:/My_Projects/Collage_project/customer-app/src/components/SplashScreen.tsx#L158-L165)
- **Description:** The `useMemo` hook computing `realBranches` was declared after the early return condition `if (!visible) return null`. In React 19, changing the conditional state alters the total hook execution count between renders.
- **Impact:** Triggers runtime hook count mismatch crashes in React or hydration failures when transitioning from splash visibility to main app.
- **Remediation:** Hoisted the `useMemo` call above the `if (!visible) return null;` guard.

### FIND-03: Temporal Dead Zone Access to State Setter
- **Severity:** HIGH
- **Component:** Customer Checkout Modal
- **Location:** [CartCheckoutModal.tsx](file:///d:/My_Projects/Collage_project/customer-app/src/components/CartCheckoutModal.tsx#L191)
- **Description:** `acquireGpsLocation` attempted to invoke `setError(...)` inside its callback at line 191, whereas `const [error, setError] = useState(...)` was declared at line 394.
- **Impact:** Triggered JavaScript ReferenceError in runtime contexts when `acquireGpsLocation` executed before state initialization, and failed Oxlint static analysis.
- **Remediation:** Moved `[loading, setLoading]` and `[error, setError]` state hook declarations up to line 176 preceding all callbacks. Verified clean lint pass.

### FIND-04: Hardcoded Insecure Fallback `JWT_SECRET`
- **Severity:** HIGH
- **Component:** Authentication Middleware
- **Location:** [auth.ts](file:///d:/My_Projects/Collage_project/backend/src/middleware/auth.ts#L5-L10)
- **Description:** `JWT_SECRET` defaulted to `"super-secret-key-campus-delivery-2026"` when the environment variable was missing, with only a console log warning.
- **Impact:** If deployed to production without `JWT_SECRET`, an attacker knowing the default public repository string could forge valid tokens for any `userId` or escalate privileges to `SUPERADMIN`.
- **Remediation:** Replaced default fallback with a strict production assertion: throws a fatal startup exception if `NODE_ENV === "production"` and `process.env.JWT_SECRET` is unset.

### FIND-05: Unhandled Promise Rejection in SuperAdmin Guard
- **Severity:** MEDIUM
- **Component:** Authorization Middleware
- **Location:** [auth.ts](file:///d:/My_Projects/Collage_project/backend/src/middleware/auth.ts#L81-L89)
- **Description:** `requireSuperAdmin` called asynchronous `authenticateUser(req, res, () => { ... })` without catching potential rejected promises from downstream database lookups.
- **Impact:** Uncaught database connectivity drops could trigger unhandled promise rejection process termination in Node.js.
- **Remediation:** Chained `.catch(next)` to route errors directly into the Express error pipeline.

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
- **Analysis:** Prices and wallet balances utilize IEEE 754 floating-point numbers. While defensive `Math.round` operations are used in cart calculation, precision drift can occur over millions of small transactions.
- **Recommendation:** Migrate to integer piasters/cents in future major schema revision.
