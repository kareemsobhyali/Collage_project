import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import prisma from "../prisma.js";
import { generateToken, authenticateUser, AuthRequest } from "../middleware/auth.js";

const router = Router();
const EGYPT_PHONE_REGEX = /^01[0125][0-9]{8}$/;

// دالة مساعدة لتحديد عنوان الـ Web App لإرسال الروابط الذكية مع قراءة إعدادات الدومين بأمان تام
function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");

  // 1. قراءة النطاق المعتمد من ملف server-config.json المركزي في المشروع
  let configuredWebUrl: string | null = null;
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), "server-config.json"),
      path.resolve(process.cwd(), "..", "server-config.json"),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data && data.webUrl) {
          configuredWebUrl = data.webUrl.replace(/\/$/, "");
          break;
        }
      }
    }
  } catch (_e) {}

  // 2. فحص النطاق الوارد والتحقق من أنه يتبع النطاقات المسموح بها لتفادي ثغرة Host Header Poisoning
  const candidateHost = req.get("host") || "";
  const candidateOrigin = req.get("origin") || "";
  const hostToCheck = (candidateHost || candidateOrigin.replace(/^https?:\/\//i, "")).split(":")[0].toLowerCase();

  const isAllowedHost =
    hostToCheck === "localhost" ||
    hostToCheck === "127.0.0.1" ||
    hostToCheck === "::1" ||
    hostToCheck.endsWith(".onrender.com") ||
    hostToCheck.endsWith(".railway.app") ||
    (configuredWebUrl && configuredWebUrl.toLowerCase().includes(hostToCheck));

  if (isAllowedHost && candidateHost) {
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    return `${protocol}://${candidateHost}`;
  }

  return configuredWebUrl || "https://collage-project-5zby.onrender.com";
}


// تسجيل حساب عميل جديد (طالب / مستخدم) مع إرسال كود ورابط التفعيل عبر الواتساب
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      res.status(400).json({ error: "الرجاء إدخال الاسم، رقم الهاتف، وكلمة المرور" });
      return;
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({
        error: "يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015",
      });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      if (!existing.isVerified) {
        // الحساب موجود ولكنه غير مفعل بعد - إعادة إرسال كود التفعيل ورابط التفعيل السريع
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const magicToken = crypto.randomUUID();

        await prisma.phoneVerificationToken.create({
          data: {
            phone: cleanPhone,
            code: otpCode,
            token: magicToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });

        const baseUrl = getAppBaseUrl(req);
        const magicLink = `${baseUrl}/?verifyToken=${magicToken}`;

        const { whatsappService } = await import("../services/whatsapp.service.js");
        await whatsappService.sendVerificationOtp(cleanPhone, otpCode, magicLink, existing.name);

        res.status(200).json({
          success: true,
          requireVerification: true,
          phone: cleanPhone,
          message: "هذا الحساب مسجل بالفعل ولكنه بانتظار التفعيل. تم إرسال كود ورابط التفعيل مجدداً إلى واتساب 💬",
        });
        return;
      }

      res.status(400).json({ error: "رقم الهاتف مسجل ومفعل مسبقاً، يرجى تسجيل الدخول" });
      return;
    }

    const { getLoyaltySettings } = await import("../services/settings.service.js");
    const loyaltySettings = await getLoyaltySettings();
    const initialPoints = loyaltySettings.enabled ? loyaltySettings.welcomePoints : 0;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        password: hashedPassword,
        role: "CUSTOMER",
        isVerified: false, // يحتاج لتأكيد رقم الهاتف عبر الواتساب
        loyaltyPoints: initialPoints, // حسب إعدادات المنظومة المحددة من الإدارة
        walletBalance: 0,
      },
    });

    // توليد كود التفعيل ورابط التفعيل السريع
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const magicToken = crypto.randomUUID();

    await prisma.phoneVerificationToken.create({
      data: {
        phone: cleanPhone,
        code: otpCode,
        token: magicToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // صالح لمدة 15 دقيقة
      },
    });

    const baseUrl = getAppBaseUrl(req);
    const magicLink = `${baseUrl}/?verifyToken=${magicToken}`;

    const { whatsappService } = await import("../services/whatsapp.service.js");
    await whatsappService.sendVerificationOtp(cleanPhone, otpCode, magicLink, user.name);

    res.status(201).json({
      success: true,
      requireVerification: true,
      phone: cleanPhone,
      message: "تم إنشاء الحساب بنجاح! تم إرسال كود التفعيل ورابط التفعيل السريع إلى رقم الواتساب الخاص بك 💬",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء الحساب" });
  }
});

// تسجيل دخول العميل
router.post("/login", async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phone || req.body.username || "").trim();
    const { password } = req.body;

    if (!cleanPhone || !password) {
      res.status(400).json({ error: "الرجاء إدخال رقم الهاتف أو اسم المستخدم وكلمة المرور" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: cleanPhone.toLowerCase() },
        ],
      },
    });

    if (!user) {
      // 1. فحص إمكانية تسجيل الدخول ككابتن توصيل (Driver)
      const driver = await prisma.deliveryDriver.findUnique({
        where: { username: cleanPhone },
        include: {
          branch: {
            select: { id: true, name: true, phone: true, address: true, logoUrl: true },
          },
        },
      });

      if (driver) {
        if (!driver.isActive) {
          res.status(403).json({ error: "حساب الكابتن موقوف حالياً من قِبل إدارة الفرع" });
          return;
        }

        const isDriverMatch = await bcrypt.compare(password, driver.password);
        if (!isDriverMatch) {
          res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
          return;
        }

        const driverToken = generateToken({
          driverId: driver.id,
          branchId: driver.branchId,
          name: driver.name,
          username: driver.username,
        });

        const { getDriverBranchConfig } = await import("../services/driver.service.js");
        const config = await getDriverBranchConfig(driver.id, driver.branchId);
        let servedBranchNames: string[] = [];
        if (config.isAllBranches) {
          servedBranchNames = ["جميع المطاعم والفروع (طيار عام)"];
        } else {
          const branches = await prisma.branch.findMany({
            where: { id: { in: config.branchIds } },
            select: { name: true },
          });
          servedBranchNames = branches.map(b => b.name);
        }

        res.json({
          success: true,
          role: "DRIVER",
          token: driverToken,
          driver: {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            username: driver.username,
            branchId: driver.branchId,
            branch: driver.branch,
            isAllBranches: config.isAllBranches,
            servedBranchNames,
          },
          redirect: "/driver",
        });
        return;
      }

      // 2. فحص إمكانية تسجيل الدخول كفرع (Branch POS)
      const branchUser = await prisma.branchUser.findUnique({
        where: { username: cleanPhone },
        include: { branch: true },
      });

      if (branchUser) {
        if (!branchUser.branch.isActive) {
          res.status(403).json({ error: "هذا الفرع موقوف حالياً من قِبل إدارة المنظومة" });
          return;
        }

        const isBranchMatch = await bcrypt.compare(password, branchUser.password);
        if (!isBranchMatch) {
          res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
          return;
        }

        const branchToken = generateToken({
          branchUserId: branchUser.id,
          branchId: branchUser.branchId,
          username: branchUser.username,
        });

        res.json({
          success: true,
          role: "BRANCH",
          token: branchToken,
          branch: branchUser.branch,
          redirect: "/branch-pos",
        });
        return;
      }

      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ error: "عذراً، تم إيقاف هذا الحساب ولا يمكنه إجراء طلبات حالياً" });
      return;
    }

    // التحقق من تفعيل رقم الهاتف
    if (!user.isVerified) {
      // توليد كود تفعيل ورابط سريع وإرسالهما فوراً عبر الواتساب
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const magicToken = crypto.randomUUID();

      await prisma.phoneVerificationToken.create({
        data: {
          phone: user.phone,
          code: otpCode,
          token: magicToken,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const baseUrl = getAppBaseUrl(req);
      const magicLink = `${baseUrl}/?verifyToken=${magicToken}`;

      const { whatsappService } = await import("../services/whatsapp.service.js");
      await whatsappService.sendVerificationOtp(user.phone, otpCode, magicLink, user.name);

      res.status(403).json({
        error: "يرجى تفعيل رقم هاتفك أولاً عبر كود أو رابط الواتساب لإتمام تسجيل الدخول",
        requireVerification: true,
        phone: user.phone,
      });
      return;
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    res.json({
      success: true,
      token,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

// بيانات المستخدم الحالي
router.get("/me", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        walletBalance: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ في جلب بيانات الحساب" });
  }
});

// 1. طلب كود استعادة كلمة المرور عبر الواتساب (Forgot Password OTP)
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: "يرجى إدخال رقم الهاتف المسجل" });
      return;
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    if (!EGYPT_PHONE_REGEX.test(cleanPhone)) {
      res.status(400).json({
        error: "يرجى إدخال رقم هاتف مصري صحيح (11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015)",
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: cleanPhone.toLowerCase() },
        ],
      },
    });

    if (!user) {
      // حماية من هجمات استطلاع وتخمين أرقام الهواتف (Phone Number Enumeration Defense)
      res.json({
        success: true,
        message: "إذا كان هذا الرقم مسجلاً لدينا، فسيتم إرسال كود التحقق فوراً إلى رقم الواتساب الخاص به 💬",
      });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ error: "هذا الحساب موقوف، يرجى التواصل مع الإدارة" });
      return;
    }

    // Rate Limiting: منع طلب أكثر من كود خلال دقيقة واحدة
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        phone: cleanPhone,
        used: false,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentToken) {
      res.status(429).json({
        error: "تم إرسال كود تحقق بالفعل إلى واتساب هذا الرقم، يرجى الانتظار دقيقة قبل طلب كود جديد",
      });
      return;
    }

    // توليد كود عشوائي من 6 أرقام
    const otp = crypto.randomInt(100000, 1000000).toString();

    // حفظ الكود في قاعدة البيانات بصلاحية 5 دقائق
    await prisma.passwordResetToken.create({
      data: {
        phone: cleanPhone,
        token: otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // إرسال الكود فوراً عبر خدمة الواتساب الذاتية
    const { whatsappService } = await import("../services/whatsapp.service.js");
    const sendRes = await whatsappService.sendOtp(cleanPhone, otp);

    res.json({
      success: true,
      simulated: sendRes.simulated,
      message: "تم إرسال كود التحقق بنجاح إلى رقم الواتساب الخاص بك",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "فشل إرسال كود استعادة كلمة المرور" });
  }
});

// 2. التحقق المبدئي من صحة كود الواتساب
router.post("/verify-reset-otp", async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      res.status(400).json({ error: "يرجى إدخال رقم الهاتف وكود التحقق" });
      return;
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    const cleanOtp = String(otp).trim();

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        phone: cleanPhone,
        token: cleanOtp,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!resetToken) {
      res.status(400).json({ error: "كود التحقق غير صحيح أو انتهت صلاحيته (5 دقائق)" });
      return;
    }

    res.json({ success: true, valid: true });
  } catch (error) {
    res.status(500).json({ error: "فشل التحقق من كود التحقق" });
  }
});

// 3. تأكيد وتعيين كلمة المرور الجديدة بعد مطابقة كود الواتساب
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      res.status(400).json({ error: "الرجاء إدخال رقم الهاتف، كود التحقق، وكلمة المرور الجديدة" });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام" });
      return;
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    const cleanOtp = String(otp).trim();

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        phone: cleanPhone,
        token: cleanOtp,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!resetToken) {
      res.status(400).json({ error: "كود التحقق غير صحيح أو انتهت صلاحيته، يرجى طلب كود جديد" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: cleanPhone.toLowerCase() },
        ],
      },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    // تشفير كلمة المرور وتحديثها
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // استهلاك الكود لمنع استخدامه مرة أخرى
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // تسجيل الدخول التلقائي للطالب
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    res.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح وتسجيل دخولك إلى حسابك",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "فشل تعيين كلمة المرور الجديدة" });
  }
});

// 4. تفعيل وتأكيد رقم الهاتف عبر كود الواتساب (6 أرقام)
router.post("/verify-phone-code", async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      res.status(400).json({ error: "الرجاء إدخال رقم الهاتف وكود التفعيل" });
      return;
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    const cleanCode = String(code).trim();

    const record = await prisma.phoneVerificationToken.findFirst({
      where: {
        phone: cleanPhone,
        code: cleanCode,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      res.status(400).json({ error: "كود التفعيل غير صحيح أو انتهت صلاحيته (15 دقيقة)" });
      return;
    }

    // استهلاك الكود
    await prisma.phoneVerificationToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    // تفعيل حساب المستخدم
    const user = await prisma.user.update({
      where: { phone: cleanPhone },
      data: { isVerified: true },
    });

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    res.json({
      success: true,
      message: "تم تأكيد وتفعيل رقم هاتفك بنجاح! مرحباً بك 🚀",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Verify phone code error:", error);
    res.status(500).json({ error: "فشل تأكيد كود التفعيل" });
  }
});

// 5. تفعيل رقم الهاتف تلقائياً عبر الرابط السريع (Magic Link - POST)
router.post("/verify-phone-link", async (req: Request, res: Response) => {
  try {
    const { token: magicToken } = req.body;
    if (!magicToken) {
      res.status(400).json({ error: "رمز الرابط مفقود" });
      return;
    }

    const record = await prisma.phoneVerificationToken.findUnique({
      where: { token: String(magicToken).trim() },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      res.status(400).json({ error: "رابط التفعيل غير صالح أو تم استخدامه مسبقاً أو انتهت صلاحيته" });
      return;
    }

    // استهلاك التوكن
    await prisma.phoneVerificationToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    // تفعيل حساب المستخدم
    const user = await prisma.user.update({
      where: { phone: record.phone },
      data: { isVerified: true },
    });

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    res.json({
      success: true,
      message: "تم تفعيل حسابك بنجاح بضغطة واحدة! 🎉",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Verify phone link error:", error);
    res.status(500).json({ error: "فشل تفعيل الحساب عبر الرابط السريع" });
  }
});

// 6. تفعيل مباشر عند فتح الرابط كـ GET في المتصفح وتوجيه الطالب للتطبيق
router.get("/verify-phone-link", async (req: Request, res: Response) => {
  try {
    const magicToken = req.query.token as string;
    const baseUrl = getAppBaseUrl(req);

    if (!magicToken) {
      res.redirect(`${baseUrl}/?verifyError=missing_token`);
      return;
    }

    const cleanToken = String(magicToken).trim();
    const record = await prisma.phoneVerificationToken.findUnique({
      where: { token: cleanToken },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      res.redirect(`${baseUrl}/?verifyError=invalid_or_expired`);
      return;
    }

    res.redirect(`${baseUrl}/?verifyToken=${encodeURIComponent(cleanToken)}`);
  } catch (error) {
    console.error("GET verify-phone-link error:", error);
    const baseUrl = getAppBaseUrl(req);
    res.redirect(`${baseUrl}/?verifyError=server_error`);
  }
});

// 7. إعادة إرسال كود ورابط التفعيل عبر الواتساب
router.post("/resend-verification-otp", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: "يرجى إدخال رقم الهاتف" });
      return;
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, "");
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: cleanPhone.toLowerCase() },
        ],
      },
    });

    if (!user) {
      res.status(404).json({ error: "هذا الحساب غير مسجل" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ error: "هذا الحساب مفعل بالفعل، يمكنك تسجيل الدخول مباشرة" });
      return;
    }

    // Rate Limiting: منع طلب أكثر من كود خلال 60 ثانية
    const recentToken = await prisma.phoneVerificationToken.findFirst({
      where: {
        phone: cleanPhone,
        used: false,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentToken) {
      res.status(429).json({
        error: "تم إرسال كود تفعيل بالفعل، يرجى الانتظار 60 ثانية قبل طلب كود جديد",
      });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const magicToken = crypto.randomUUID();

    await prisma.phoneVerificationToken.create({
      data: {
        phone: cleanPhone,
        code: otpCode,
        token: magicToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const baseUrl = getAppBaseUrl(req);
    const magicLink = `${baseUrl}/?verifyToken=${magicToken}`;

    const { whatsappService } = await import("../services/whatsapp.service.js");
    const sendRes = await whatsappService.sendVerificationOtp(cleanPhone, otpCode, magicLink, user.name);

    res.json({
      success: true,
      simulated: sendRes.simulated,
      message: "تم إرسال كود ورابط التفعيل مجدداً إلى واتساب الرقم 💬",
    });
  } catch (error) {
    console.error("Resend verification otp error:", error);
    res.status(500).json({ error: "فشل إعادة إرسال كود التفعيل" });
  }
});

export default router;
