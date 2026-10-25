# UniFood Production Readiness & Deployment Checklist

## 1. Readiness Verdict
**Status:** **READY FOR COMMERCIAL PRODUCTION (WITH ACCEPTED OPERATIONAL RISKS)**

The system exhibits robust database transaction isolation, server-side price computation, type safety, and real-time socket delivery. The critical defects identified during audit (`FIND-01`, `FIND-02`, `FIND-03`, `FIND-04`, `FIND-05`) have been completely resolved and verified.

---

## 2. Environment Variables Specification

| Variable | Required | Description | Example / Recommendation |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **YES** | Execution mode | `production` |
| `DATABASE_URL` | **YES** | PostgreSQL connection string | `postgresql://user:pass@host:5432/unifood?sslmode=require` |
| `JWT_SECRET` | **YES** | Cryptographic secret for signing tokens | High-entropy string (64+ chars generated via `crypto.randomBytes(32).toString('hex')`) |
| `PORT` | NO | HTTP listener port | Default `3001` (Render automatically injects `PORT`) |
| `APP_URL` | NO | Canonical public web URL | `https://unifood-campus.onrender.com` |
| `CORS_ORIGIN` | NO | Allowed frontend origins | `https://unifood-campus.onrender.com` |

> [!CAUTION]
> If `NODE_ENV === "production"` and `JWT_SECRET` is omitted, the application will terminate immediately upon startup to prevent signing tokens with fallback credentials.

---

## 3. Production Build & Deployment Pipeline

### Standard Build Sequence
```bash
# 1. Install dependencies
cmd.exe /c "npm install"
cmd.exe /c "npm --prefix backend install"
cmd.exe /c "npm --prefix customer-app install"
cmd.exe /c "npm --prefix desktop-app install"

# 2. Database Schema Sync
cmd.exe /c "npx --prefix backend prisma generate"
cmd.exe /c "npx --prefix backend prisma db push"

# 3. Build Production Artifacts
cmd.exe /c "npm --prefix backend run build"
cmd.exe /c "npm --prefix customer-app run build"
cmd.exe /c "npm --prefix desktop-app run build"
```

### Process Supervision (PM2 / Systemd)
In production environments without container orchestration, run Node with explicit memory constraints:
```bash
pm2 start backend/dist/server.js --name "unifood-api" --max-memory-restart 500M --node-args="--expose-gc"
```

---

## 4. Disaster Recovery & Data Durability

1. **Database Cold-Start Image Resilience:**
   If the container hosting UniFood is destroyed and redeployed (ephemeral disk wipe), `backend/src/server.ts` automatically restores requested images from the PostgreSQL `UploadedFile` table into the local cache on demand.
2. **WhatsApp Bot State:**
   Ensure the `auth_info_baileys/` folder is mounted to a persistent volume or backup storage to prevent QR code re-scanning on container rebuilds.
3. **Automated Database Backups:**
   Configure managed PostgreSQL provider (e.g., Supabase, Neon, or Render Postgres) for daily point-in-time recovery (PITR) with a minimum 7-day retention period.

---

## 5. Rollback Playbook

If a critical incident occurs immediately following a production deployment:
1. **Revert Git Commit:**
   ```bash
   git revert HEAD --no-edit
   ```
2. **Re-trigger Build & Deployment:**
   Re-run the build pipeline. The Prisma schema is backwards-compatible; no destructive migrations are present.
3. **Clear Browser Cache:**
   Increment the PWA cache key in `public/sw.js` (e.g. from `unifood-pwa-v1` to `unifood-pwa-v2`) to force customer browsers to discard stale bundles.
