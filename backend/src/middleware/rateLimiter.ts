import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// حماية مسارات تسجيل الدخول من محاولات التخمين والهجمات العنيفة (Brute Force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 20, // حد أقصى 20 محاولة تسجيل دخول للحساب خلال 15 دقيقة
  message: {
    error: "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول، يرجى المحاولة مرة أخرى بعد 15 دقيقة للحماية والأمان.",
  },
  keyGenerator: (req) => {
    // دمج عنوان الـ IP مع معرف الحساب (الهاتف أو اسم المستخدم) مع دعم وتطبيع IPv6 لتفادي حظر شبكة واي فاي الجامعة بالكامل
    const identifier = String(req.body?.phone || req.body?.username || "").trim();
    const clientIp = req.ip ? ipKeyGenerator(req.ip) : "127.0.0.1";
    return `${clientIp}_${identifier}`;
  },
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});


// حماية مسار إنشاء الطلبات من السبام والطلبات الوهمية المكثفة
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 دقائق
  max: 20, // حد أقصى 20 طلب خلال 10 دقائق من نفس العنوان
  message: {
    error: "تم إرسال عدد كبير من الطلبات في وقت قصير، يرجى الانتظار قليلاً.",
  },
  validate: {
    xForwardedForHeader: false,
    default: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// حماية عامة لكافة مسارات الـ API من هجمات الإغراق (DDoS / Flood)
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

// حماية مسار رفع الملفات من هجمات إغراق السيرفر
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 دقائق
  max: 30, // حد أقصى 30 صورة لكل 5 دقائق
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

