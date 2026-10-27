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

## 3. Implemented Automated Test Suite Architecture & Classifications

Across Phases 3, 4, 5, and 6, **57 automated regression, integration, and browser end-to-end tests** were implemented across 9 test suites under `backend/test/`, executable directly via `npm --prefix backend test` (`node:test` + `tsx`).

### Test Classification Matrix

| Test Suite File | Test Count | Test Classification | Dependencies / Runtime | What It Proves vs Mocks |
| :--- | :--- | :--- | :--- | :--- |
| `backend/test/browser-e2e-verification.test.ts` | 5 | **Browser End-to-End Test (Playwright Headless Chromium)** | Real headless Chromium v156 + live Express backend | **Executes real browser rendering against live backend:** Validates Arabic RTL document direction (`dir="rtl"`), mobile (390x844) viewport layout, PostgreSQL branch catalog fetching into DOM, unauthenticated checkout price-tamper rejection (401), unauthorized branch/admin route access (401), and desktop (1280x800) POS interface shell loading. |
| `backend/test/backup-restore-verification.test.ts` | 1 | **Disaster Recovery & Database Restoration Test** | Real local PostgreSQL CLI tools (`pg_dump`, `pg_restore`, `psql`) | **Executes real binary database dump (`pg_dump -Fc`)** in 860ms (79.6 kB), creates isolated staging database `unifood_restore_verify_test`, restores via `pg_restore` in 1029ms, and validates 100% record parity across Users, Orders, and Branches before teardown. |
| `backend/test/monetary-database-integration.test.ts` | 4 | **Database-Backed Monetary Integration Suite** | Real local PostgreSQL database | **Executes real Prisma operations against PostgreSQL**: inserts and reads back fractional currency orders, tests atomic wallet balance decrement and cancellation rollback, verifies PostgreSQL aggregate queries without IEEE 754 drift, and proves 100% lossless reversible integer piaster conversion on real records. |
| `backend/test/postgres-concurrency.test.ts` | 2 | **Database Integration & Concurrency Test** | Real local PostgreSQL (`localhost:5432/unifood_db`) | **Executes real database transactions** with concurrent `Promise.all` queries. Proves atomic conditional updates prevent overselling and failed stock claims roll back the entire transaction. |
| `backend/test/api-authorization-integration.test.ts` | 8 | **HTTP / API Integration Test** | Ephemeral Express HTTP server + real middleware chain | **Makes real HTTP network requests** across `/api/admin`, `/api/branch`, and `/api/driver`. Proves 401 unauthenticated, 403 cross-role rejection, and 200 authorized access. |
| `backend/test/monetary-precision.test.ts` | 9 | **Financial Precision & Invariant Test** | In-memory pure functions & IEEE 754 boundary tests | Proves exact Egyptian piaster minor-unit conversions, order totals identity preservation, wallet refund consistency, discount capping, and 1,000-order drift-free aggregation. |
| `backend/test/remediation.test.ts` | 6 | **Unit & Child Process Lifecycle Test** | Node.js `child_process.fork` & mocked models | Proves `FIND-01` per-user quota aggregation logic, `FIND-04` fail-fast production crash (exits 42/43) on missing/short JWT secrets, and `FIND-05` async error propagation. |
| `backend/test/order-lifecycle.test.ts` | 13 | **Pure Unit Test** | In-memory pure functions | Validates mathematical precision of server-authoritative calculations (add-ons, sizes), Haversine delivery radius, Egyptian phone regexes, state transitions, PIN verification, promo rules, wallet balance deductions, and duplicate order windows. |
| `backend/test/security-authorization.test.ts` | 9 | **Unit Test with Cryptographic Dependencies** | Real `jsonwebtoken`, mocked controllers | Proves cryptographic token signing, signature rejection, token expiry, BOLA/IDOR isolation between customers/branches, path traversal sanitization, and driver payload PIN stripping. |

### Test Execution Command
```bash
cmd.exe /c "npm --prefix backend test"
```
Output: `57 passed, 0 failed, 33 suites, duration: ~16.3s`

---

## 4. Verification & Regression Checklist

Before every release or production deployment:
1. `cmd.exe /c "npm --prefix backend test"` (Must pass 57/57 tests).
2. `cmd.exe /c "npm --prefix backend run build"` (Must exit with code 0).
3. `cmd.exe /c "npm --prefix customer-app run lint"` (Must report 0 errors, <=190 warnings).
4. `cmd.exe /c "npm --prefix customer-app run build"` (Must exit with code 0).
5. `cmd.exe /c "npm --prefix desktop-app run build"` (Must exit with code 0).
6. Verify schema migrations: `npx prisma migrate status`.
