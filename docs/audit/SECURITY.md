# UniFood Security Audit & Hardening Report

## 1. Executive Security Assessment
An application security evaluation was conducted across the UniFood platform covering the OWASP Top 10 (2021) and OWASP API Security Top 10 (2023).

### Threat Matrix Overview
| Risk Domain | Initial Status | Post-Remediation Status | Residual Risk Level |
| :--- | :--- | :--- | :--- |
| **Broken Authentication** | Fallback JWT secret risk | Enforced production secret | **LOW** |
| **Broken Object Level Auth (BOLA)** | Audited & Validated | Server ownership enforced | **LOW** |
| **Injection (SQL/NoSQL/Command)** | Protected by ORM | Parameterized via Prisma | **LOW** |
| **Security Misconfiguration** | Wildcard CORS / CSP off | Hardened headers / Documented | **MEDIUM** |
| **Server-Side Request Forgery** | Safe URL parsing | Origin domain allowlist | **LOW** |
| **Business Logic Exploitation** | Server-side validation | Transactional balance locks | **LOW** |

---

## 2. Authentication & Credential Security

### Password Storage & Salting
- Passwords for customers, branch staff, and super administrators are hashed using **`bcryptjs`** with a salt round factor of `10`.
- Plaintext passwords are never logged, persisted, or returned in API responses.

### Token Architecture & Production Hardening
- **Algorithm:** HMAC SHA-256 (`HS256`) JSON Web Tokens.
- **Remediation (`FIND-04`):** In `backend/src/middleware/auth.ts`, the hardcoded fallback secret was removed for production deployments. If `NODE_ENV === "production"` and `process.env.JWT_SECRET` is omitted, the application immediately terminates startup with a fatal configuration error.
- **Token Claims:** Payload encapsulates `userId`, `role`, and `phone` (or `branchId` / `driverId` for respective personas).

### OTP & Magic Link Verification
- Customer phone registration requires verification via WhatsApp 6-digit OTP or a cryptographic `UUIDv4` magic token.
- Verification tokens are enforced with a 15-minute expiration window (`Date.now() + 15 * 60 * 1000`).

---

## 3. Authorization & Broken Object-Level Authorization (BOLA/IDOR)

Every protected backend endpoint enforces identity and tenancy ownership on the server:

1. **Customer Order Access (`/api/customer/orders/:id`):**
   ```typescript
   if (!order || (order.userId !== req.user!.userId && req.user!.role !== "SUPERADMIN")) {
     res.status(404).json({ error: "الطلب غير موجود" });
     return;
   }
   ```
2. **Order Cancellation (`/api/customer/orders/:id/cancel`):**
   - Strictly verifies `order.userId === userId` and `order.status === "PENDING"`.
   - Prevents unauthorized cancellation of orders once preparation begins.
3. **Address Management (`/api/customer/addresses/:id`):**
   - Deletions use `prisma.userAddress.deleteMany({ where: { id, userId: req.user!.userId } })`, preventing cross-customer address tampering.
4. **Branch & Driver Isolation:**
   - Desktop POS routes require `authenticateBranch` extracting `branchId` directly from the validated JWT token rather than trusting user-supplied route parameters.

---

## 4. Business Logic Security & Financial Fraud Prevention

### Server-Authoritative Price Calculation
The frontend cart is treated as completely untrusted:
- All item base prices (`unitPrice`), item sizes, and modifier option costs are fetched directly from PostgreSQL inside the database transaction.
- Client-submitted totals are disregarded; the backend computes `subtotal = sum(dbPrice + dbModifiers)`.

### Atomic Wallet & Promo Transactions
- Concurrent order submission attacks (double-spending wallet balances) are prevented using PostgreSQL transactions with atomic decrements:
  ```typescript
  const walletClaim = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: walletDiscount } },
    data: { walletBalance: { decrement: walletDiscount } },
  });
  if (walletClaim.count === 0) throw new Error("INSUFFICIENT_WALLET_BALANCE");
  ```
- Flash deal inventory uses atomic decrement with `maxPerUser` limit validation (fixed in `FIND-01`).

---

## 5. API Hardening & Rate Limiting

The application utilizes `express-rate-limit` with discrete bucket policies:

| Route Scope | Window | Max Requests | Mitigation Target |
| :--- | :--- | :--- | :--- |
| `/api/*` | 15 minutes | 1500 req | General DDOS & scraping |
| `/api/auth/*` | 15 minutes | 20 req | Brute-force & OTP credential stuffing |
| `/api/customer/orders` | 1 minute | 10 req | Duplicate order replay & spamming |
| `/api/upload` | 15 minutes | 50 req | Storage exhaustion & denial of service |

---

## 6. Input Validation & File Upload Security

1. **Phone Number Regex:** Strict Egyptian mobile format enforced (`/^01[0125][0-9]{8}$/`).
2. **Path Traversal Mitigation:**
   - In static file serving (`server.ts:93`), incoming filenames are stripped using `path.basename(rawFilename)` and tested against `.` and `..` before path concatenation.
3. **Upload Filtering (`upload.routes.ts`):**
   - 5MB maximum file size limit.
   - Whitelist of permitted MIME types (`image/jpeg`, `image/png`, `image/webp`).
   - Magic bytes verification ensuring that uploaded payloads match real image headers.
