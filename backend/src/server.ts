import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import helmet from "helmet";

dotenv.config();
const backendEnvPath = path.resolve(process.cwd(), "backend", ".env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

import { initSocket } from "./sockets/socketManager.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import branchRoutes from "./routes/branch.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import { authLimiter, orderLimiter, generalApiLimiter, uploadLimiter } from "./middleware/rateLimiter.js";
import prisma from "./prisma.js";
import { getNotificationSoundSettings } from "./services/settings.service.js";
import { seedMockDatabase } from "./services/mockData.service.js";


const app = express();
// تفعيل trust proxy ليعمل express-rate-limit بدقة خلف خوادم الاستضافة السحابية (Render / Railway / Cloudflare)
app.set("trust proxy", 1);
const server = http.createServer(app);

// تهيئة Socket.io للتنبيهات اللحظية والأصوات
initSocket(server);

// أمان الـ HTTP Headers وحماية المتصفحات مع إتاحة خدمة ملفات SPA بسلاسة
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// Middleware الأساسية
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// حماية عامة من هجمات الإغراق (Rate Limiting)
app.use("/api", generalApiLimiter);

// حماية مسارات تسجيل الدخول والتحقق واسترجاع كلمة المرور من محاولات التخمين (Brute Force / OTP Abuse)
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/verify-reset-otp", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/verify-phone", authLimiter);
app.use("/api/auth/resend-verification-otp", authLimiter);
app.use("/api/admin/login", authLimiter);
app.use("/api/branch/login", authLimiter);
app.use("/api/driver/login", authLimiter);

// حماية مسار إنشاء الطلبات من السبام
app.use("/api/customer/orders", orderLimiter);

// حماية مسار رفع الملفات
app.use("/api/upload", uploadLimiter);

// دالة مساعدة لتحديد مسارات الملفات والمجلدات بدقة على السيرفر
function resolvePath(...cands: string[]): string {
  for (const cand of cands) {
    const p = path.resolve(process.cwd(), cand);
    if (fs.existsSync(p)) return p;
    if (typeof __dirname !== "undefined") {
      const pDir = path.resolve(__dirname, cand);
      if (fs.existsSync(pDir)) return pDir;
      const pDirUp = path.resolve(__dirname, "..", cand);
      if (fs.existsSync(pDirUp)) return pDirUp;
      const pDirUp2 = path.resolve(__dirname, "../..", cand);
      if (fs.existsSync(pDirUp2)) return pDirUp2;
    }
  }
  return path.resolve(process.cwd(), cands[0]);
}

// خدمة الصور المرفوعة للمنيو والفروع مع استرجاع تلقائي من قاعدة البيانات عند إعادة تشغيل السيرفر
const uploadsPath = resolvePath("uploads", "backend/uploads", "../uploads");

app.get("/uploads/:filename", async (req, res, next) => {
  const rawFilename = req.params.filename;
  const filename = path.basename(rawFilename);
  if (!filename || filename === "." || filename === "..") {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const localFilePath = path.join(uploadsPath, filename);

  // 1. إذا كانت الصورة موجودة على القرص الصلب، نرسلها مباشرة بسرعة فائقة
  if (fs.existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  // 2. إذا فُقدت الصورة من القرص الصلب (بسبب إعادة تشغيل سيرفر الاستضافة)، نسترجعها فوراً من قاعدة البيانات PostgreSQL
  try {
    const dbFile = await prisma.uploadedFile.findUnique({
      where: { filename },
    });
    if (dbFile && dbFile.data) {
      // إعادة حفظها في الكاش المحلي لزيادة السرعة في الطلبات القادمة
      try {
        if (!fs.existsSync(uploadsPath)) {
          fs.mkdirSync(uploadsPath, { recursive: true });
        }
        fs.writeFileSync(localFilePath, Buffer.from(dbFile.data));
      } catch (_cacheErr) {}

      res.setHeader("Content-Type", dbFile.mimeType || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(Buffer.from(dbFile.data));
    }
  } catch (err) {
    console.error("[Uploads Fallback] Error retrieving file from DB:", err);
  }

  return res.status(404).json({ error: "Image not found" });
});

app.use("/uploads", express.static(uploadsPath));


// مسارات واجهات البرمجة API
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/branch", branchRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/upload", uploadRoutes);

// فحص صحة الخادم وقاعدة البيانات
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "PostgreSQL",
      message: "UniFood API is running securely with PostgreSQL 🚀",
      timestamp: new Date(),
    });
  } catch (_err) {
    res.status(503).json({
      status: "degraded",
      database: "PostgreSQL",
      message: "Database connectivity check failed",
      timestamp: new Date(),
    });
  }
});

// نقطة نهاية عامة لجلب إعدادات صوت التنبيهات لجميع التطبيقات (POS، الطيار، الإدارة)
app.get("/api/public/sound-settings", async (_req, res) => {
  try {
    const settings = await getNotificationSoundSettings();
    res.json({ success: true, ...settings });
  } catch (_e) {
    res.json({ success: true, enabled: true, soundUrl: "", volume: 1.0 });
  }
});

// مسارات شاشة فروع المطاعم والـ POS (desktop-app)
const desktopDistPath = resolvePath("../desktop-app/dist", "desktop-app/dist");
if (fs.existsSync(desktopDistPath)) {
  // خدمة الملفات الثابتة لشاشة الفرع والـ POS (تتضمن التوجيه التلقائي لـ /branch/ وخدمة index.html)
  app.use("/branch", express.static(desktopDistPath));
  app.use("/pos", express.static(desktopDistPath));

  // توجيه أي مسار داخلي ضمن /branch/{*splat} أو /pos/{*splat} لصفحة index.html
  app.get(["/branch/{*splat}", "/pos/{*splat}"], (_req, res) => {
    res.sendFile(path.join(desktopDistPath, "index.html"));
  });
}

// مسارات تطبيق الطلاب والإدارة والدليفري (customer-app)
const customerDistPath = resolvePath("../customer-app/dist", "customer-app/dist");
if (fs.existsSync(customerDistPath)) {
  // خدمة الملفات الثابتة للموقع الرئيسي
  app.use(express.static(customerDistPath));

  // توجيه كل المسارات الأخرى مثل:
  // / (تطبيق الطلاب)
  // /admin (لوحة تحكم الإدارة)
  // /delivery أو /driver أو /elviery (شاشة الطيارين)
  // إلى index.html الخاص بـ customer-app (Single Page App Fallback)
  app.get("{*splat}", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/branch") ||
      req.path.startsWith("/pos") ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }
    res.sendFile(path.join(customerDistPath, "index.html"));
  });
}

// Middleware مركزي لمعالجة الأخطاء وحماية الخادم من التوقف
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled Application Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "حدث خطأ غير متوقع في الخادم",
  });
});

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`===============================================`);
  console.log(` UniFood Production Unified Server on port ${PORT}`);
  console.log(` Database: PostgreSQL`);
  console.log(` 1. Student Portal:      http://localhost:${PORT}/`);
  console.log(` 2. Admin Dashboard:     http://localhost:${PORT}/admin`);
  console.log(` 3. Delivery Portal:     http://localhost:${PORT}/delivery`);
  console.log(` 4. Restaurant POS:      http://localhost:${PORT}/branch/`);
  console.log(` 5. API Health Check:    http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);

  // تشغيل خدمة الواتساب الذاتية لإرسال أكواد الـ OTP والإشعارات
  import("./services/whatsapp.service.js")
    .then(({ whatsappService }) => {
      whatsappService.initWhatsApp().catch((err) => {
        console.error("[WhatsApp] Startup error:", err);
      });
    })
    .catch((err) => {
      console.warn("[WhatsApp] Could not load whatsappService:", err);
    });

  // فحص دوري كل 45 ثانية للطلبات المعلقة التي تجاوزت 5 دقائق دون قبول لإرسال إنذار عبر الواتساب
  import("./services/settings.service.js")
    .then(({ checkAndSendUnacceptedOrdersWhatsAppAlerts, checkAndSendShiftClosingReports, checkAndSendDriverUnacceptedOrdersAlerts }) => {
      setInterval(() => {
        checkAndSendUnacceptedOrdersWhatsAppAlerts().catch((err) => {
          console.error("[Scheduler] Unaccepted orders check error:", err);
        });
        checkAndSendDriverUnacceptedOrdersAlerts().catch((err) => {
          console.error("[Scheduler] Driver unaccepted orders check error:", err);
        });
      }, 45 * 1000);

      // فحص دوري كل دقيقة لمواعيد إغلاق الفروع لإرسال التقرير المالي اليومي لإغلاق الشيفت عبر الواتساب
      checkAndSendShiftClosingReports().catch(() => {});
      setInterval(() => {
        checkAndSendShiftClosingReports().catch((err) => {
          console.error("[Scheduler] Shift closing reports check error:", err);
        });
      }, 60 * 1000);
    })
    .catch((err) => {
      console.warn("[Scheduler] Could not start alert schedulers:", err);
    });

  // مزامنة الصور المحلية الموجودة على القرص وحفظها في قاعدة البيانات PostgreSQL لضمان عدم فقدانها عند إعادة تشغيل السيرفر
  setTimeout(async () => {
    try {
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        for (const file of files) {
          const filePath = path.join(uploadsPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.size <= 5 * 1024 * 1024) {
            const ext = path.extname(file).toLowerCase().replace(".", "");
            if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
              const existing = await prisma.uploadedFile.findUnique({
                where: { filename: file },
                select: { id: true },
              });
              if (!existing) {
                const buffer = fs.readFileSync(filePath);
                const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
                await prisma.uploadedFile.create({
                  data: {
                    filename: file,
                    mimeType,
                    data: buffer,
                    size: buffer.length,
                  },
                });
                console.log(`[Backup] Synced image ${file} to PostgreSQL database.`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[Backup] Image auto-sync to DB encountered:", err);
    }
  }, 5000);

  // فحص ما إذا كانت قاعدة البيانات جديدة/فارغة وحقن البيانات التجريبية تلقائياً (فقط في بيئة التطوير أو عند تفعيل ENABLE_AUTO_SEED)
  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_AUTO_SEED === "true") {
    setTimeout(async () => {
      try {
        const branchesCount = await prisma.branch.count();
        if (branchesCount === 0) {
          console.log("[AutoSeed] قاعدة البيانات فارغة (0 مطاعم)، جاري حقن البيانات التجريبية تلقائياً...");
          await seedMockDatabase();
          console.log("[AutoSeed] اكتمل حقن البيانات التجريبية بنجاح على السيرفر!");
        }
      } catch (seedErr) {
        console.warn("[AutoSeed] Auto seeding skipped or encountered:", seedErr);
      }
    }, 2000);
  }
});

export default app;
