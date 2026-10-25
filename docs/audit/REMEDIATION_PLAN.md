# UniFood Remediation & Technical Debt Roadmap

## 1. Roadmap Overview

```
[Phase 1: Immediate Fixes]   --->   [Phase 2: Near-Term Hardening]   --->   [Phase 3: Scale & Evolution]
- Schema Field Crash (Fixed)        - Admin Code Splitting                  - Decimal Currency Migration
- React Hooks Error (Fixed)         - Strict CORS Allowlist                 - Isolated WhatsApp Microservice
- TDZ Lint Error (Fixed)            - Automated Vitest Suite                - Redis Caching & Socket Bus
- Strict JWT Secret (Fixed)         - PWA Push Notification VAPID           - Multi-Region DB Replicas
```

---

## 2. Phase 1: Immediate Remediations (Completed & Verified)

| Finding | Remediation Action | File(s) | Verification Result |
| :--- | :--- | :--- | :--- |
| **FIND-01** | Corrected Prisma relation query from `customerId` to `userId` | `customer.routes.ts` | `tsc` passes; aggregate query succeeds |
| **FIND-02** | Hoisted `useMemo` above conditional early return | `SplashScreen.tsx` | Oxlint hook order check passed |
| **FIND-03** | Moved `loading` and `error` state hooks above GPS callback | `CartCheckoutModal.tsx` | Oxlint 0 errors; clean bundle |
| **FIND-04** | Enforced mandatory `JWT_SECRET` in production mode | `auth.ts` | Startup assertion verified |
| **FIND-05** | Added `.catch(next)` to `requireSuperAdmin` | `auth.ts` | Express error pipeline safe |

---

## 3. Phase 2: Near-Term Enhancements (Sprint 1 - 2)

### Task 2.1: Admin Component Modularization (`FIND-06`)
- **Objective:** Split `AdminPage.tsx` (~11,940 lines) into individual tab components under `src/components/admin/tabs/`:
  - `BranchesTab.tsx`, `OrdersTab.tsx`, `DriversTab.tsx`, `FinanceTab.tsx`, `WhatsAppTab.tsx`.
- **Effort:** 3 Engineering Days.
- **Risk:** Low (primarily code reorganization).

### Task 2.2: Strict CORS Whitelist (`FIND-07`)
- **Objective:** Replace open `cors()` with origin filter:
  ```typescript
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173"];
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  ```
- **Effort:** 0.5 Engineering Days.
- **Risk:** Low.

### Task 2.3: Vitest Integration Testing Suite
- **Objective:** Implement 20+ automated integration tests covering checkout transactions, wallet deductions, and promo validation.
- **Effort:** 4 Engineering Days.
- **Risk:** Zero (test harness).

---

## 4. Phase 3: Long-Term Architectural Evolution (Quarter 2)

### Task 3.1: High-Precision Currency Migration (`FIND-08`)
- **Objective:** Migrate `Float` database columns to `Int` (representing Egyptian piasters/cents) or Prisma `Decimal(10, 2)` to eliminate floating-point precision drift.
- **Effort:** 5 Engineering Days (requires database migration script).
- **Risk:** Medium (requires careful data backfill).

### Task 3.2: Decoupled WhatsApp Microservice
- **Objective:** Extract `baileys` into an independent worker service communicating via Redis Pub/Sub. Prevents WhatsApp socket events from sharing memory space with user-facing HTTP endpoints.
- **Effort:** 6 Engineering Days.
- **Risk:** Medium.
