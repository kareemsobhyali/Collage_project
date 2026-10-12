import rateLimit from "express-rate-limit";

// حماية مسارات تسجيل الدخول من محاولات التخمين والهجمات العنيفة (Brute Force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 15, // حد أقصى 15 محاولة تسجيل دخول لكل IP خلال 15 دقيقة
  message: {
    error: "تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول، يرجى المحاولة مرة أخرى بعد 15 دقيقة للحماية والأمان.",
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
  standardHeaders: true,
  legacyHeaders: false,
});
