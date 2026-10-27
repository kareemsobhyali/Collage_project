# UniFood Security Audit — Authorization Matrix & Tenant Isolation

**Document Version:** 1.0.0  
**Scope:** Server-Side Authorization Enforcement Across All User Roles and Resource Boundaries

---

## 1. Role Definitions & Context Injection

| Role Identifier | Authentication Method | Context Injected into `req` | Target Audience |
| :--- | :--- | :--- | :--- |
| **`UNAUTHENTICATED`** | No Bearer Token Provided | `req.user = undefined` | Anonymous visitors, prospective students |
| **`CUSTOMER`** | JWT signed with `JWT_SECRET` | `req.user = { userId, role: "CUSTOMER", phone }` | University students & food ordering customers |
| **`DRIVER`** | JWT signed with `JWT_SECRET` | `req.driver = { driverId, branchId, name, username }` | Campus delivery couriers / captains |
| **`BRANCH`** | JWT signed with `JWT_SECRET` | `req.branch = { branchUserId, branchId, username }` | Restaurant cashiers, kitchen staff, POS operators |
| **`SUPERADMIN`** | JWT signed with `JWT_SECRET` | `req.user = { userId, role: "SUPERADMIN", phone }` | Platform operators, operations managers |

---

## 2. Comprehensive Route Authorization Matrix

### Legend
- ✅ **ALLOWED & AUTHORIZED:** Intended access with verified server-side ownership or role check.
- 🛑 **DENIED (401/403):** Access blocked by middleware (`authenticateUser`, `authenticateBranch`, `authenticateDriver`, `requireSuperAdmin`).
- ⚠️ **VULNERABLE / GAP:** Endpoint permits unintended access or exhibits Broken Object Level Authorization (BOLA/IDOR).
- ⚪ **NOT APPLICABLE:** Irrelevant workflow for this role.

---

### Group A: Public & System Routes

| Endpoint | Method | UNAUTH | CUSTOMER | DRIVER | BRANCH | SUPERADMIN | Authorization & Ownership Mechanism |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/health` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | Public database health check |
| `/api/public/sound-settings` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | Public sound settings |
| `/api/public/server-config` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | Public domain resolution config |
| `/uploads/:filename` | `GET` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **GAP (SEC-008):** Unauthenticated access to payment proofs |

---

### Group B: Authentication & Account Lifecycle (`/api/auth/*`)

| Endpoint | Method | UNAUTH | CUSTOMER | DRIVER | BRANCH | SUPERADMIN | Authorization & Ownership Mechanism |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/auth/register` | `POST` | ✅ | 🛑 | 🛑 | 🛑 | 🛑 | Public customer account creation |
| `/api/auth/login` | `POST` | ✅ | ✅ | ✅ | ✅ | ✅ | Unified credential authentication |
| `/api/auth/me` | `GET` | 🛑 | ✅ | 🛑 | 🛑 | ✅ | `authenticateUser`; returns `req.user.userId` record |
| `/api/auth/forgot-password` | `POST` | ✅ | ✅ | 🛑 | 🛑 | 🛑 | Phone OTP trigger (Rate-limited: 1/min per phone) |
| `/api/auth/verify-reset-otp` | `POST` | ✅ | ✅ | 🛑 | 🛑 | 🛑 | OTP verification (5-minute expiry) |
| `/api/auth/reset-password` | `POST` | ✅ | ✅ | 🛑 | 🛑 | 🛑 | Password update consuming one-time OTP |
| `/api/auth/verify-phone-link` | `GET/POST`| ⚠️ | ⚠️ | 🛑 | 🛑 | 🛑 | **GAP (SEC-003):** Host header link poisoning |
| `/api/auth/resend-verification-otp`| `POST` | ⚠️ | ⚠️ | 🛑 | 🛑 | 🛑 | **GAP (SEC-003):** Host header link poisoning |

---

### Group C: Customer Ordering & Account Management (`/api/customer/*`)

| Endpoint | Method | UNAUTH | CUSTOMER | DRIVER | BRANCH | SUPERADMIN | Authorization & Ownership Mechanism |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/customer/branches` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | Public menu browsing |
| `/api/customer/branches/:id/menu` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ | Public menu browsing |
| `/api/customer/promo-codes/validate`| `POST`| ✅ | ✅ | 🛑 | 🛑 | ✅ | Evaluates promo validity against subtotal |
| `/api/customer/group-cart/create` | `POST` | ✅ | ✅ | 🛑 | 🛑 | ✅ | Generates 6-character hex share code |
| `/api/customer/group-cart/:code` | `GET` | ✅ | ✅ | 🛑 | 🛑 | ✅ | Retrieves shared items by share code |
| `/api/customer/group-cart/:code/items` | `POST` | ✅ | ✅ | 🛑 | 🛑 | ✅ | Appends item with verified server price |
| `/api/customer/group-cart/:code/items/:itemId` | `DELETE` | ⚠️ | ⚠️ | 🛑 | 🛑 | ⚠️ | **GAP (SEC-004):** Spoofable `studentName` query param |
| `/api/customer/group-cart/:code/close` | `POST` | ⚠️ | ⚠️ | 🛑 | 🛑 | ⚠️ | **GAP (SEC-004):** Zero authorization check |
| `/api/customer/orders` | `POST` | 🛑 | ✅ | 🛑 | 🛑 | ✅ | `authenticateUser`; server-authoritative checkout |
| `/api/customer/orders/:id` | `GET` | 🛑 | ✅ | 🛑 | 🛑 | ✅ | Verified: `order.userId === req.user.userId` or Admin |
| `/api/customer/my-orders` | `GET` | 🛑 | ✅ | 🛑 | 🛑 | ✅ | Scoped strictly to `where: { userId: req.user.userId }` |
| `/api/customer/orders/:id/cancel` | `PUT` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Scoped: `where: { id, userId, status: "PENDING" }` |
| `/api/customer/orders/:id/rate` | `POST` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Scoped: `order.userId === req.user.userId` |
| `/api/customer/addresses` | `GET` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Scoped: `where: { userId: req.user.userId }` |
| `/api/customer/addresses` | `POST` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Bound to `req.user.userId` |
| `/api/customer/addresses/:id` | `DELETE` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Scoped: `deleteMany({ where: { id, userId } })` |
| `/api/customer/wallet` | `GET` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Scoped: `where: { id: req.user.userId }` |
| `/api/customer/wallet/convert-points`| `POST` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Atomic point-to-cash deduction for `req.user.userId` |
| `/api/customer/account` | `DELETE` | 🛑 | ✅ | 🛑 | 🛑 | 🛑 | Deletes/anonymizes user data for `req.user.userId` |

---

### Group D: Restaurant Branch POS Operations (`/api/branch/*`)

| Endpoint | Method | UNAUTH | CUSTOMER | DRIVER | BRANCH | SUPERADMIN | Authorization & Ownership Mechanism |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/branch/profile` | `GET` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | `authenticateBranch`; returns `req.branch.branchId` |
| `/api/branch/details` | `PUT` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: updates `req.branch.branchId` only |
| `/api/branch/operational-status` | `PUT` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: updates `req.branch.branchId` only |
| `/api/branch/menu` | `GET` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `where: { branchId: req.branch.branchId }` |
| `/api/branch/categories` | `POST` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Bound: `branchId: req.branch.branchId` |
| `/api/branch/categories/:id` | `PUT/DEL`| 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `findFirst({ where: { id, branchId } })` |
| `/api/branch/items` | `POST` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Bound: `branchId: req.branch.branchId` |
| `/api/branch/items/:id` | `PUT/DEL`| 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `findFirst({ where: { id, branchId } })` |
| `/api/branch/items/:id/availability`| `PUT` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `findFirst({ where: { id, branchId } })` |
| `/api/branch/orders` | `GET` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `where: { branchId: req.branch.branchId }` |
| `/api/branch/orders/:id/status` | `PUT` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `findFirst({ where: { id, branchId } })` |
| `/api/branch/orders/:id/assign-driver`| `PUT` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: verifies order and driver belong to branch |
| `/api/branch/customers/:userId/crm` | `PUT` | 🛑 | 🛑 | 🛑 | ⚠️ | 🛑 | **GAP (SEC-005):** Cross-tenant global customer ban |
| `/api/branch/drivers` | `GET/POST`| 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `where: { branchId: req.branch.branchId }` |
| `/api/branch/drivers/:id` | `PUT/DEL`| 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: `findFirst({ where: { id, branchId } })` |
| `/api/branch/support-tickets` | `GET` | 🛑 | 🛑 | 🛑 | ✅ | 🛑 | Scoped: filters tickets matching branch orders |

---

### Group E: Delivery Driver Portal (`/api/driver/*`)

| Endpoint | Method | UNAUTH | CUSTOMER | DRIVER | BRANCH | SUPERADMIN | Authorization & Ownership Mechanism |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/driver/me` | `GET` | 🛑 | 🛑 | ✅ | 🛑 | 🛑 | `authenticateDriver`; returns `req.driver.driverId` |
| `/api/driver/orders` | `GET` | 🛑 | 🛑 | ✅ | 🛑 | 🛑 | Scoped: `where: { driverId }`; strips `pickupPin` |
| `/api/driver/orders/:id/accept` | `PUT` | 🛑 | 🛑 | ✅ | 🛑 | 🛑 | Scoped: `findUnique({ where: { id } })`, checks `driverId` |
| `/api/driver/orders/:id/reject` | `PUT` | 🛑 | 🛑 | ✅ | 🛑 | 🛑 | Scoped: checks `order.driverId === req.driver.driverId` |
| `/api/driver/orders/:id/pickup` | `PUT` | 🛑 | 🛑 | ✅ | 🛑 | 🛑 | Scoped: checks `order.driverId === req.driver.driverId` |
| `/api/driver/orders/:id/deliver` | `PUT` | 🛑 | 🛑 | ✅ | 🛑 | 🛑 | **Verified:** checks `driverId` AND matches `pickupPin` |
| `/api/driver/orders/:id/return-to-branch`| `POST`| 🛑 | 🛑 | ✅ | 🛑 | 🛑 | Scoped: checks `order.driverId === req.driver.driverId` |

---

### Group F: SuperAdmin Control Plane (`/api/admin/*`)

| Endpoint | Method | UNAUTH | CUSTOMER | DRIVER | BRANCH | SUPERADMIN | Authorization & Ownership Mechanism |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/admin/*` (All routes) | ALL | 🛑 | 🛑 | 🛑 | 🛑 | ✅ | Protected by `router.use(requireSuperAdmin)` |
| `/api/admin/branches` | ALL | 🛑 | 🛑 | 🛑 | 🛑 | ✅ | Global branch management |
| `/api/admin/stats` | `GET` | 🛑 | 🛑 | 🛑 | 🛑 | ✅ | Platform-wide analytics |
| `/api/admin/orders` | `GET` | 🛑 | 🛑 | 🛑 | 🛑 | ✅ | Full orders audit trail |
| `/api/admin/finance/*` | ALL | 🛑 | 🛑 | 🛑 | 🛑 | ✅ | Financial reports & Excel export |
| `/api/admin/whatsapp/*` | ALL | 🛑 | 🛑 | 🛑 | 🛑 | ✅ | WhatsApp bot multi-device sessions |
| `/api/admin/system/factory-reset`| `POST`| 🛑 | 🛑 | 🛑 | 🛑 | ✅ | Destructive database reset |

---

## 3. IDOR / BOLA Analysis & Tenant Isolation Assessment

### 3.1. Customer Isolation (High Integrity)
- **Orders:** `GET /api/customer/orders/:id` verifies `order.userId === req.user.userId`.
- **Addresses:** `DELETE /api/customer/addresses/:id` uses scoped query `where: { id, userId: req.user.userId }`, preventing Customer A from deleting Customer B's saved address.
- **Wallet & Points:** Conversion operations explicitly fetch the user record using `req.user.userId` from verified JWT claims.

### 3.2. Branch POS Isolation (Solid with One Exception)
- **Menu Management:** All category, item, and modifier group updates enforce `where: { id, branchId: req.branch.branchId }`. Branch A cannot modify Branch B's menu items.
- **Orders:** Branch order queries enforce `where: { branchId: req.branch.branchId }`.
- **Exception (SEC-005):** `PUT /api/branch/customers/:userId/crm` allows a branch cashier to modify global `User.isBlocked`, banning the customer across all other restaurant branches.

### 3.3. Driver Isolation (High Integrity)
- Drivers can only view and update orders where `order.driverId === req.driver.driverId`.
- The customer's 4-digit `pickupPin` is stripped from driver queries and dispatches (`sanitizeOrderForDriver`), ensuring the driver cannot know the PIN without the customer presenting it upon delivery.
