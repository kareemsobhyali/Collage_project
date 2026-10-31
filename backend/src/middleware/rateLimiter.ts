import rateLimit, { ipKeyGenerator } from "express-rate-limit";

function normalizeDigitsAndStrip(input: unknown): string {
  if (!input) return "";
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let str = String(input).trim();
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
  }
  let digits = str.replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);
  return digits || str.toLowerCase();
}

// 1. محدد محاولات الدخول والتحقق المرتبط بالمعرّف الفعلي الخاص بكل مسار (منع التلاعب بحقول إضافية)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 15, // حد أقصى 15 محاولة للحساب خلال 15 دقيقة
  message: {
    error: "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول أو التحقق، يرجى المحاولة مرة أخرى بعد 15 دقيقة للحماية والأمان.",
  },
  keyGenerator: (req) => {
    const clientIp = req.ip ? ipKeyGenerator(req.ip) : "127.0.0.1";
    const fullPath = `${req.baseUrl || ""}${req.path || ""}`.toLowerCase();

    // مسارات الفروع والطيارين تعتمد حصراً على username (تجاهل أي حقل phone مرسل للتضليل)
    if (fullPath.includes("/branch/login") || fullPath.includes("/driver/login")) {
      const uname = String(req.body?.username || "").trim().toLowerCase();
      return `acct_${clientIp}_${uname || "anon"}`;
    }

    // مسار دخول الإدارة
    if (fullPath.includes("/admin/login")) {
      const adminId = String(req.body?.username || req.body?.phone || "").trim().toLowerCase();
      return `admin_${clientIp}_${adminId || "anon"}`;
    }

    // مسار الرابط السحري
    if (fullPath.includes("/verify-phone-link")) {
      const tokPrefix = String(req.body?.token || "").trim().slice(0, 16);
      return `mlink_${clientIp}_${tokPrefix || "notok"}`;
    }

    // مسارات مصادقة العملاء والـ OTP تعتمد على رقم الهاتف المطبّع فقط
    const cleanPhone = normalizeDigitsAndStrip(req.body?.phone);
    return `cust_${clientIp}_${cleanPhone || "nophone"}`;
  },
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. سقف أعلى لكل عنوان IP على مسارات المصادقة لمنع هجمات Password Spraying عبر تغيير أسماء الحسابات
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: "تم رصد عدد كبير من محاولات المصادقة من هذه الشبكة، يرجى الانتظار قليلاً ثم المحاولة.",
  },
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. حماية صارمة لأكواد التسليم والإرجاع المكونة من 4 أرقام (pickupPin / returnPin) مرتبطة بمعرف الطلب نفسه
export const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6, // 6 محاولات فقط لكل طلب خلال 15 دقيقة
  message: {
    error: "تم تجاوز عدد المحاولات المسموح لإدخال كود التأكيد لهذا الطلب، يرجى الانتظار 15 دقيقة أو مراجعة الإدارة.",
  },
  keyGenerator: (req) => {
    const match = req.originalUrl.match(/\/orders\/([^/?#]+)/i);
    const orderKey = match ? match[1] : (req.ip ? ipKeyGenerator(req.ip) : "127.0.0.1");
    return `pin_${orderKey}`;
  },
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. حماية مسار إنشاء الطلبات بسقف مريح للعميل الفعلي مع منع هجمات الإغراق الآلي (Order Flood)
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 دقائق
  max: 15, // حتى 15 طلباً لكل مستخدم خلال 10 دقائق
  message: {
    error: "تم إرسال عدد كبير من الطلبات خلال وقت قصير، يرجى الانتظار بضع دقائق قبل إرسال طلب جديد.",
  },
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ") && authHeader.length > 24) {
      // ربط العداد بجلسة المستخدم لتجنب حظر زملائه على نفس شبكة الواي فاي الجامعية
      return `ord_tok_${authHeader.slice(-24)}`;
    }
    const clientIp = req.ip ? ipKeyGenerator(req.ip) : "127.0.0.1";
    return `ord_ip_${clientIp}`;
  },
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 5. حماية عامة لكافة مسارات الـ API من هجمات الإغراق (DDoS / Flood)
export const generalApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 دقائق
  max: 600, // حد أقصى 600 طلب لكل 5 دقائق
  message: {
    error: "تم تجاوز معدل الطلبات المسموح به، يرجى المحاولة لاحقاً.",
  },
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 6. حماية مسار رفع الملفات من هجمات إغراق السيرفر
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 دقائق
  max: 30, // حد أقصى 30 ملفاً لكل 5 دقائق
  message: {
    error: "تم تجاوز الحد المسموح به لرفع الملفات مؤقتاً، يرجى المحاولة بعد قليل.",
  },
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
