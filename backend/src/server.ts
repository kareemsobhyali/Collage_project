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
  dotenv.config({ path: backendEnvPath, override: true });
}

import { initSocket, isBranchOnline } from "./sockets/socketManager.js";
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
import { getBranchPngIcon } from "./services/branchIcon.service.js";


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

// تم إيقاف ليميت الطلبات لتمكين العملاء من الطلب بحرية
// app.use("/api/customer/orders", orderLimiter);

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

  const defaultLogoPath = resolvePath(
    "customer-app/public/logo.png",
    "public/logo.png",
    "../customer-app/public/logo.png"
  );
  if (fs.existsSync(defaultLogoPath)) {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(defaultLogoPath);
  }

  return res.status(404).json({ error: "Image not found" });
});

app.use("/uploads", express.static(uploadsPath));

// خدمة أيقونات المطاعم بصيغة PNG نقية ومربعة لتوليد WebAPK وتثبيت PWA بدون أي تشويه وبشعار المطعم الحقيقي
app.get(["/api/branch-icon/:slug.png", "/api/branch-icon/:slug", "/branch-icon.png"], async (req, res) => {
  try {
    let rawSlug = req.params.slug;
    if (Array.isArray(rawSlug)) rawSlug = rawSlug[0];
    let slug = String(rawSlug || req.query.branch || req.query.r || req.query.slug || "default").trim();
    slug = decodeURIComponent(slug).replace(/\.png$/i, "");

    let size = 512;
    if (slug.endsWith("-192")) {
      size = 192;
      slug = slug.replace(/-192$/, "");
    } else if (slug.endsWith("-512")) {
      size = 512;
      slug = slug.replace(/-512$/, "");
    } else if (req.query.size === "192") {
      size = 192;
    }

    const isMaskable = req.query.maskable === "1" || req.query.maskable === "true" || slug.endsWith("-maskable");
    if (slug.endsWith("-maskable")) {
      slug = slug.replace(/-maskable$/, "");
    }

    const iconBuffer = await getBranchPngIcon(slug, size, isMaskable);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.send(iconBuffer);
  } catch (err) {
    console.error("Branch icon error:", err);
    return res.redirect("/logo.png");
  }
});

// خدمة ملف manifest.json الديناميكي لدعم تثبيت تطبيق مخصص للفرع أو المنصة العامة
app.get("/manifest.json", async (req, res) => {
  let branchParam = (req.query.branch || req.query.r || req.query.slug) as string | undefined;

  // إذا لم يتم تمرير باراميتر صريح، نفحص مرجع الطلب (Referer) لمعرفة ما إذا كان الطلب قادماً من صفحة مطعم مخصص
  if (!branchParam && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      const refPath = decodeURIComponent(refererUrl.pathname).replace(/^\/+|\/+$/g, '');
      const segments = refPath.split('/').filter(Boolean);
      if (segments.length >= 2 && ['apk', 'download', 'install'].includes(segments[segments.length - 1].toLowerCase())) {
        branchParam = segments[0] === 'r' ? segments[1] : segments[0];
      } else {
        branchParam = refererUrl.searchParams.get('branch') || refererUrl.searchParams.get('r') || refererUrl.searchParams.get('slug') || undefined;
      }
    } catch (_err) {}
  }

  if (branchParam) {
    try {
      const cleanParam = decodeURIComponent(branchParam).trim();
      const branch = await prisma.branch.findFirst({
        where: {
          OR: [
            { slug: { equals: cleanParam, mode: "insensitive" } },
            { id: cleanParam },
            { slug: { contains: cleanParam, mode: "insensitive" } },
            { name: { contains: cleanParam, mode: "insensitive" } },
          ],
        },
      });

      if (branch) {
        const branchKey = branch.slug || branch.id;
        const branchIcons = [
          {
            src: `/api/branch-icon/${encodeURIComponent(branchKey)}-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `/api/branch-icon/${encodeURIComponent(branchKey)}-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `/api/branch-icon/${encodeURIComponent(branchKey)}-192.png?maskable=1`,
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: `/api/branch-icon/${encodeURIComponent(branchKey)}-512.png?maskable=1`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ];

        const branchManifest = {
          name: `${branch.name} | UniFood`,
          short_name: branch.name,
          description: `اطلب وجبتك المفضلة من ${branch.name} مباشرة وسريعاً بدون انتظار`,
          start_url: `/r/${encodeURIComponent(branchKey)}`,
          scope: "/",
          id: `/r/${encodeURIComponent(branchKey)}`,
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
          prefer_related_applications: false,
          handle_links: "preferred",
          launch_handler: {
            client_mode: ["navigate-existing", "auto"],
          },
          background_color: "#ffffff",
          theme_color: "#4f46e5",
          orientation: "portrait",
          dir: "rtl",
          lang: "ar",
          icons: branchIcons,
        };

        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        return res.json(branchManifest);
      }
    } catch (_e) {}
  }

  const staticManifestPath = resolvePath(
    "customer-app/public/manifest.json",
    "public/manifest.json",
    "../customer-app/public/manifest.json"
  );
  if (fs.existsSync(staticManifestPath)) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    return res.sendFile(staticManifestPath);
  }

  return res.json({
    name: "UniFood | يونيفود - مطاعم الحرم الجامعي",
    short_name: "UniFood",
    description: "منصة طلب وتوصيل الوجبات السريعة وخدمة الطلب الجماعي",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    prefer_related_applications: false,
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    dir: "rtl",
    lang: "ar",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  });
});


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

// نقطة نهاية عامة لقراءة إعدادات النطاق المركزي (Server Domain Config)
app.get("/api/public/server-config", (_req, res) => {
  try {
    const configPath = resolvePath("server-config.json", "../server-config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return res.json({ success: true, ...parsed });
    }
  } catch (_e) {}
  res.json({
    success: true,
    webUrl: "https://unifood.store",
    apiUrl: "https://unifood.store/api",
    githubConfigUrl: "https://raw.githubusercontent.com/kareemsobhyali/Collage_project/main/server-config.json",
  });
});

// مسارات شاشة فروع المطاعم والـ POS (desktop-app) مع دعم التثبيت كتطبيق ويندوز وموبايل مستقل (PWA)
const desktopDistPath = resolvePath("../desktop-app/dist", "desktop-app/dist");
if (fs.existsSync(desktopDistPath)) {
  const desktopStaticOptions = {
    setHeaders: (res: express.Response, filePath: string) => {
      if (filePath.endsWith("manifest.json")) {
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
      } else if (filePath.endsWith("sw.js") || filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  };

  // خدمة الملفات الثابتة لشاشة الفرع والـ POS (تتضمن التوجيه التلقائي لـ /branch/ وخدمة index.html)
  app.use("/branch", express.static(desktopDistPath, desktopStaticOptions));
  app.use("/pos", express.static(desktopDistPath, desktopStaticOptions));

  // توجيه أي مسار داخلي ضمن /branch/{*splat} أو /pos/{*splat} لصفحة index.html
  app.get(["/branch/{*splat}", "/pos/{*splat}"], (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(desktopDistPath, "index.html"));
  });
}

// مسارات تطبيق الطلاب والإدارة والدليفري (customer-app)
const customerDistPath = resolvePath("../customer-app/dist", "customer-app/dist");
if (fs.existsSync(customerDistPath)) {
  // خدمة الملفات الثابتة فقط بدون اعتراض طلبات الصفحة الرئيسية HTML
  app.use(express.static(customerDistPath, { index: false }));

  // توجيه كل المسارات الأخرى مثل:
  // / (تطبيق العملاء أو المطعم المباشر)
  // /admin (لوحة تحكم الإدارة)
  // /delivery أو /driver أو /elviery (شاشة الطيارين)
  // إلى index.html الخاص بـ customer-app مع معالجة ذكية لهوية المطعم والمانيفست
  app.get("{*splat}", async (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/branch") ||
      req.path.startsWith("/pos") ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }

    const indexPath = path.join(customerDistPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      return res.status(404).send("Application not built yet");
    }

    // استخراج معرّف المطعم إن وجد (من الباراميترات أو المسار المباشر)
    const cleanPath = decodeURIComponent(req.path).replace(/^\/+|\/+$/g, '');
    const segments = cleanPath.split('/').filter(Boolean);
    let targetBranchSlug: string | null = null;

    const isApkRequest = (segments.length >= 2 && ['apk', 'download', 'install'].includes(segments[segments.length - 1].toLowerCase())) ||
      (segments.length === 1 && ['apk', 'download', 'install'].includes(segments[0].toLowerCase())) ||
      Boolean(req.query.apk || req.query.download || req.query.install);

    if (req.query.branch || req.query.r || req.query.b || req.query.slug) {
      targetBranchSlug = String(req.query.branch || req.query.r || req.query.b || req.query.slug).trim();
    } else if (segments.length >= 2 && ['apk', 'download', 'install'].includes(segments[segments.length - 1].toLowerCase())) {
      targetBranchSlug = segments[0] === 'r' ? segments[1] : segments[0];
    } else if (segments.length >= 2 && ['apk', 'download', 'install'].includes(segments[0].toLowerCase())) {
      targetBranchSlug = segments[1];
    } else if (segments.length === 2 && (segments[0] === 'r' || segments[0] === 'branch' || segments[0] === 'b')) {
      targetBranchSlug = segments[1];
    } else if (segments.length === 1 && !['admin', 'driver', 'delivery', 'elviery', 'pos', 'api', 'socket.io', 'uploads', 'manifest.json', 'favicon.ico', 'sw.js', 'robots.txt'].includes(segments[0].toLowerCase())) {
      targetBranchSlug = segments[0];
    }

    // إذا كان الزائر على هاتف آيفون (iOS) وطلب رابط تثبيت الـ APK، يتم تحويله مباشرة لصفحة المطعم أو الموقع فوراً
    const userAgent = String(req.headers['user-agent'] || '');
    const isIos = /iphone|ipad|ipod/i.test(userAgent);
    if (isIos && isApkRequest) {
      if (targetBranchSlug && !['admin', 'driver', 'delivery', 'api'].includes(targetBranchSlug.toLowerCase())) {
        return res.redirect(302, `/r/${encodeURIComponent(targetBranchSlug)}`);
      } else {
        let refererSlug: string | null = null;
        if (req.headers.referer) {
          try {
            const refUrl = new URL(req.headers.referer);
            refererSlug = refUrl.searchParams.get('branch') || refUrl.searchParams.get('r');
          } catch (_e) {}
        }
        if (refererSlug && !['admin', 'driver', 'delivery', 'api'].includes(refererSlug.toLowerCase())) {
          return res.redirect(302, `/r/${encodeURIComponent(refererSlug)}`);
        }
        return res.redirect(302, '/');
      }
    }

    let html = fs.readFileSync(indexPath, "utf8");

    if (targetBranchSlug && !['admin', 'driver', 'delivery', 'api'].includes(targetBranchSlug.toLowerCase())) {
      try {
        const cleanSlug = targetBranchSlug.trim();
        const branch = await prisma.branch.findFirst({
          where: {
            OR: [
              { slug: { equals: cleanSlug, mode: "insensitive" } },
              { id: cleanSlug },
              { name: { equals: cleanSlug, mode: "insensitive" } },
              { name: { contains: cleanSlug, mode: "insensitive" } },
            ],
          },
        });

        if (branch) {
          const branchKey = branch.slug || branch.id;
          let logoUrl = branch.logoUrl || "/logo.png";
          if (logoUrl.startsWith("data:")) {
            // الحفاظ على data: URL دون إضافة /uploads/
          } else if (logoUrl.startsWith("http")) {
            try {
              logoUrl = new URL(logoUrl).pathname;
            } catch (_e) {}
          } else if (!logoUrl.startsWith("/")) {
            logoUrl = `/uploads/${logoUrl}`;
          }

          // 1. استبدال رابط المانيفست بالمانيفست المخصص لهذا المطعم
          const customManifestTag = `<link rel="manifest" href="/manifest.json?branch=${encodeURIComponent(branchKey)}" />`;
          html = html.replace(/<link\s+rel="manifest"[^>]*>/i, customManifestTag);

          // تعقيم وتشفير رموز HTML لتفادي هجمات حقن النصوص البرمجية (XSS Defense)
          const safeBranchName = String(branch.name || "UniFood")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

          // 2. تحديث العنوان ليحمل اسم المطعم مباشرة بأمان تام
          html = html.replace(/<title>.*?<\/title>/i, `<title>${safeBranchName} | طلب وتوصيل وجبات أونلاين</title>`);

          // 3. تحديث أيقونة الموقع والأيقونة التي يعتمدها iOS وأندرويد للشاشة بأيقونة PNG مربعة ونقية للمطعم
          const branchIcon192 = `/api/branch-icon/${encodeURIComponent(branchKey)}-192.png`;
          const branchIcon512 = `/api/branch-icon/${encodeURIComponent(branchKey)}-512.png`;
          html = html.replace(/<link[^>]*rel="icon"[^>]*>/i, `<link rel="icon" type="image/png" sizes="192x192" href="${branchIcon192}" />`);
          html = html.replace(/<link[^>]*rel="apple-touch-icon"[^>]*>/i, `<link rel="apple-touch-icon" sizes="512x512" href="${branchIcon512}" />`);

          // 4. حقن سكريبت وعلامات iOS المخصصة لاسم وأيقونة ورابط التثبيت على الآيفون والبيانات المبدئية
          const host = req.headers['x-forwarded-host'] || req.headers.host || 'unifood.store';
          const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
          const branchStartUrl = `/r/${encodeURIComponent(branchKey)}`;
          const absoluteBranchStartUrl = `${proto}://${host}/r/${encodeURIComponent(branchKey)}`;
          const initialBranchJson = JSON.stringify({
            id: branch.id,
            slug: branch.slug || branchKey,
            name: branch.name,
            logoUrl: logoUrl,
            operationalStatus: branch.operationalStatus,
            deliveryFee: branch.deliveryFee,
            address: branch.address,
            openingTime: branch.openingTime,
            closingTime: branch.closingTime,
            workingDays: branch.workingDays,
            closedUntil: branch.closedUntil,
            isActive: branch.isActive,
            isOnline: isBranchOnline(branch.id),
          });
          const iosAppleTags = `
            <meta name="apple-mobile-web-app-title" content="${safeBranchName}">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
            <link rel="canonical" href="${absoluteBranchStartUrl}">
            <link rel="apple-touch-icon-precomposed" sizes="180x180" href="${branchIcon192}">
            <link rel="apple-touch-icon" sizes="180x180" href="${branchIcon192}">
            <script>
              window.__UNIFOOD_INITIAL_BRANCH__ = ${initialBranchJson};
              try { localStorage.setItem('pwa_installed_branch', '${encodeURIComponent(branchKey).toLowerCase()}'); } catch(e) {}
            </script>
          `;
          html = html.replace("</head>", `${iosAppleTags}</head>`);
        }
      } catch (_e) {}
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
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

// مزامنة تلقائية فورية لأعمدة وتحديثات قاعدة البيانات لضمان عدم حدوث أي أخطاء نقص أعمدة على الخادم السحابي
async function autoSyncDatabaseSchema() {
  try {
    const patches = [
      `CREATE TABLE IF NOT EXISTS "FlashDeal" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "subtitle" TEXT,
        "dealType" TEXT NOT NULL DEFAULT 'COMBO',
        "branchId" TEXT,
        "menuItemId" TEXT,
        "originalPrice" DOUBLE PRECISION,
        "discountPrice" DOUBLE PRECISION,
        "discountPercent" INTEGER,
        "promoCode" TEXT,
        "badgeText" TEXT,
        "imageUrl" TEXT,
        "maxQuantity" INTEGER,
        "soldQuantity" INTEGER NOT NULL DEFAULT 0,
        "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "FlashDeal_isActive_idx" ON "FlashDeal"("isActive");`,
      `CREATE INDEX IF NOT EXISTS "FlashDeal_expiresAt_idx" ON "FlashDeal"("expiresAt");`,
      `CREATE INDEX IF NOT EXISTS "FlashDeal_branchId_idx" ON "FlashDeal"("branchId");`,
      `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "applicableBranchIds" TEXT;`,
      `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "maxUses" INTEGER;`,
      `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "usedCount" INTEGER DEFAULT 0;`,
      `ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "oncePerUser" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unacceptedAlertSent" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "walletDiscount" DOUBLE PRECISION DEFAULT 0.0;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER DEFAULT 0;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointsAwarded" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentSenderPhone" TEXT;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickupPin" TEXT;`,
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "groupCartDetails" TEXT;`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER DEFAULT 0;`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "walletBalance" DOUBLE PRECISION DEFAULT 0.0;`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN DEFAULT true;`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "restaurantNotes" TEXT;`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "slug" TEXT;`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "workingDays" TEXT DEFAULT 'SUN,MON,TUE,WED,THU,FRI,SAT';`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "scheduledLeadMins" INTEGER DEFAULT 20;`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "operationalStatus" TEXT DEFAULT 'OPEN';`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "closedUntil" TIMESTAMP(3);`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "closingReason" TEXT;`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "deliveryType" TEXT DEFAULT 'FIXED';`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "deliveryRadiusKm" DOUBLE PRECISION DEFAULT 10.0;`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;`,
      `ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;`,
      `ALTER TABLE "GroupCart" ADD COLUMN IF NOT EXISTS "isClosed" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "GroupCart" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);`,
      `ALTER TABLE "FlashDeal" ADD COLUMN IF NOT EXISTS "isUnlimited" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "FlashDeal" ADD COLUMN IF NOT EXISTS "maxPerUser" INTEGER;`,
      `ALTER TABLE "FlashDeal" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "FlashDeal" ADD COLUMN IF NOT EXISTS "recurringDays" TEXT;`,
      `ALTER TABLE "FlashDeal" ADD COLUMN IF NOT EXISTS "dailyStartTime" TEXT;`,
      `ALTER TABLE "FlashDeal" ADD COLUMN IF NOT EXISTS "dailyEndTime" TEXT;`,
      `ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "unavailableUntil" TIMESTAMP(3);`,
      `ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "comboItems" TEXT;`,
      `ALTER TABLE "ModifierOption" ADD COLUMN IF NOT EXISTS "unavailableUntil" TIMESTAMP(3);`,
      `CREATE TABLE IF NOT EXISTS "WhatsAppAccount" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "phoneNumber" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "sendOtp" BOOLEAN NOT NULL DEFAULT false,
        "sendAdminAlerts" BOOLEAN NOT NULL DEFAULT false,
        "sendCustomerOrders" BOOLEAN NOT NULL DEFAULT false,
        "branchId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "WhatsAppAccount_isActive_idx" ON "WhatsAppAccount"("isActive");`,
      `CREATE INDEX IF NOT EXISTS "WhatsAppAccount_branchId_idx" ON "WhatsAppAccount"("branchId");`,
      `CREATE TABLE IF NOT EXISTS "WhatsAppSessionFile" (
        "id" TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "filename" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSessionFile_account_file_key" ON "WhatsAppSessionFile"("accountId", "filename");`,
      `CREATE INDEX IF NOT EXISTS "WhatsAppSessionFile_accountId_idx" ON "WhatsAppSessionFile"("accountId");`,
      `CREATE TABLE IF NOT EXISTS "BranchBlockedCustomer" (
        "id" TEXT PRIMARY KEY,
        "branchId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "isBlocked" BOOLEAN NOT NULL DEFAULT true,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `ALTER TABLE "BranchBlockedCustomer" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT true;`,
      `ALTER TABLE "BranchBlockedCustomer" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
      `ALTER TABLE "GroupCart" ADD COLUMN IF NOT EXISTS "hostToken" TEXT;`,
      `ALTER TABLE "GroupCartItem" ADD COLUMN IF NOT EXISTS "deleteKey" TEXT;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "requirePaymentProof" BOOLEAN NOT NULL DEFAULT true;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "vodafoneCashNumber" TEXT;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "instapayHandle" TEXT;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "cashEnabled" BOOLEAN DEFAULT true;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "vodafoneCashEnabled" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "instapayEnabled" BOOLEAN DEFAULT false;`,
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "cardEnabled" BOOLEAN DEFAULT false;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "BranchBlockedCustomer_branchId_userId_key" ON "BranchBlockedCustomer"("branchId", "userId");`,
      `CREATE INDEX IF NOT EXISTS "BranchBlockedCustomer_branchId_idx" ON "BranchBlockedCustomer"("branchId");`,
      `CREATE INDEX IF NOT EXISTS "BranchBlockedCustomer_userId_idx" ON "BranchBlockedCustomer"("userId");`
    ];

    for (const sql of patches) {
      await prisma.$executeRawUnsafe(sql).catch(() => {});
    }
    console.log("[DB Auto-Sync] Database schema columns verified and updated successfully.");

    // تنظيف وترحيل أي لوجو مطعم مخزن بنظام Base64 القديم إلى ملف حقيقي لمنع انهيار وتوقف صفحة APK ومتصفحات الجوال
    try {
      const branchesWithDataLogo = await prisma.branch.findMany({
        where: { logoUrl: { startsWith: "data:image" } },
      });
      for (const b of branchesWithDataLogo) {
        if (!b.logoUrl) continue;
        const match = b.logoUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (match) {
          const rawExt = match[1].toLowerCase();
          const ext = rawExt.includes("jpeg") || rawExt.includes("jpg") ? "jpg" : (rawExt.includes("png") ? "png" : "webp");
          const base64Data = match[2];
          const buffer = Buffer.from(base64Data, "base64");
          const filename = `branch-logo-${b.id}.${ext}`;
          const localPath = path.join(uploadsPath, filename);
          try {
            if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
            fs.writeFileSync(localPath, buffer);
          } catch (_e) {}

          await prisma.uploadedFile.upsert({
            where: { filename },
            update: { mimeType: `image/${ext === "jpg" ? "jpeg" : ext}`, data: buffer, size: buffer.length },
            create: { filename, mimeType: `image/${ext === "jpg" ? "jpeg" : ext}`, data: buffer, size: buffer.length },
          }).catch(() => {});

          await prisma.branch.update({
            where: { id: b.id },
            data: { logoUrl: `/uploads/${filename}` },
          });
          console.log(`[Auto-Clean] Successfully converted Base64 logo for branch "${b.name}" to /uploads/${filename}`);
        }
      }
    } catch (cleanErr: any) {
      console.warn("[Auto-Clean] Logo cleanup warning:", cleanErr?.message || cleanErr);
    }
  } catch (err: any) {
    console.warn("[DB Auto-Sync] Column patch warning:", err?.message || err);
  }
}

server.listen(PORT, "0.0.0.0", () => {
  autoSyncDatabaseSchema().catch(() => {});
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

  // مراقبة دورية لاستهلاك الذاكرة (Memory Watchdog) لضمان البقاء تحت سقف 512MB RAM
  setInterval(() => {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    if (rssMb > 340 || heapUsedMb > 280) {
      console.warn(`[Memory Watchdog] High RAM usage detected: RSS=${rssMb}MB, Heap=${heapUsedMb}MB.`);
      if (typeof global.gc === "function") {
        try {
          global.gc();
          console.log("[Memory Watchdog] Garbage Collection triggered successfully.");
        } catch (_gcErr) {}
      }
    }
  }, 60 * 1000);

  // مزامنة تدريجية للصور المحلية بعد استقرار إقلاع السيرفر (30 ثانية) لتجنب الضغط على الرام
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
                // إتاحة فرصة لـ Garbage Collection بين كل ملف والآخر
                await new Promise((resolve) => setTimeout(resolve, 150));
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[Backup] Image auto-sync to DB encountered:", err);
    }
  }, 30000);

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
