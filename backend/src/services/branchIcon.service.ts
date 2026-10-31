import sharp from "sharp";
import fs from "fs";
import path from "path";
import prisma from "../prisma.js";
import { safeFetchBinary } from "../utils/safeFetch.js";

// ذاكرة تخزين مؤقت محدودة السعة لتسريع إرسال الأيقونات مع حماية من استنزاف الذاكرة (Bounded LRU Cache)
const MAX_CACHE_ENTRIES = 150;
const iconCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 ساعة

function setInCache(key: string, buffer: Buffer) {
  if (iconCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = iconCache.keys().next().value;
    if (oldestKey) iconCache.delete(oldestKey);
  }
  iconCache.set(key, { buffer, timestamp: Date.now() });
}

function getUploadDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "backend", "uploads"),
    path.resolve(process.cwd(), "..", "uploads"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "uploads");
}

function getDefaultLogoBuffer(): Buffer {
  const candidates = [
    path.resolve(process.cwd(), "customer-app", "public", "logo.png"),
    path.resolve(process.cwd(), "..", "customer-app", "public", "logo.png"),
    path.resolve(process.cwd(), "public", "logo.png"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return fs.readFileSync(c);
      } catch {}
    }
  }
  // في أسوأ الظروف، إنشاء صورة PNG بيضاء افتراضية
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
}

/**
 * توليد أيقونة PNG مربعة رسمية وبدقة عالية ومقاسات موحدة لأي مطعم،
 * متوافقة 100% مع معايير Google Chrome و Android WebAPK، ومؤمنة ضد SSRF و Path Traversal.
 */
export async function getBranchPngIcon(
  branchIdOrSlug: string,
  targetSize: number = 512,
  isMaskable: boolean = false
): Promise<Buffer> {
  const safeSize = targetSize === 192 ? 192 : 512;
  const cleanId = decodeURIComponent(branchIdOrSlug).trim();

  // 1. البحث عن الفرع في قاعدة البيانات
  let branch: any = null;
  if (cleanId && cleanId !== "default" && cleanId !== "platform") {
    try {
      branch = await prisma.branch.findFirst({
        where: {
          OR: [
            { slug: { equals: cleanId, mode: "insensitive" } },
            { id: cleanId },
            { name: { equals: cleanId, mode: "insensitive" } },
            { name: { contains: cleanId, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
        },
      });
    } catch (_e) {}
  }

  // إذا لم يتم العثور على الفرع وكان المطلوب معرف غير مسجل، يتم إرجاع الشعار الافتراضي فوراً دون استهلاك الكاش
  if (!branch && cleanId !== "default" && cleanId !== "platform") {
    return getDefaultLogoBuffer();
  }

  const rawLogo = branch?.logoUrl || "";
  const cacheKey = `${branch?.id || cleanId}_${safeSize}_${isMaskable ? "mask" : "any"}_${rawLogo}`;

  const cached = iconCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.buffer;
  }

  // 2. استخراج البايتات الخام لشعار المطعم
  let rawBuffer: Buffer | null = null;

  if (rawLogo) {
    try {
      if (rawLogo.startsWith("data:")) {
        const parts = rawLogo.split(",");
        if (parts.length === 2) {
          rawBuffer = Buffer.from(parts[1], "base64");
        }
      } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
        // إذا كان الرابط يشير لملف محلي تم رفعه على السيرفر
        let localFilename = "";
        try {
          const parsed = new URL(rawLogo);
          if (parsed.pathname.startsWith("/uploads/")) {
            // عزل اسم الملف ومنع أي محاولة اجتياز مسارات (Path Traversal Defense)
            localFilename = path.basename(parsed.pathname.replace(/^\/uploads\//, ""));
          }
        } catch {}

        if (localFilename) {
          const filePath = path.join(getUploadDir(), localFilename);
          if (fs.existsSync(filePath)) {
            rawBuffer = fs.readFileSync(filePath);
          } else {
            // محاولة الجلب من قاعدة البيانات
            const fileRecord = await prisma.uploadedFile.findUnique({
              where: { filename: localFilename },
              select: { data: true },
            });
            if (fileRecord?.data) {
              rawBuffer = fileRecord.data;
            }
          }
        }

        // إذا لم يكن ملفاً محلياً، جلبه عبر safeFetchBinary لمنع SSRF والتسلل للشبكة الداخلية
        if (!rawBuffer) {
          try {
            const fetched = await safeFetchBinary(rawLogo, {
              maxBytes: 5 * 1024 * 1024,
              timeoutMs: 3500,
            });
            if (fetched?.buffer) {
              rawBuffer = fetched.buffer;
            }
          } catch (_netErr) {}
        }
      } else {
        // مسار محلي مباشر مع تأمين اسم الملف بـ path.basename
        const cleanFile = path.basename(rawLogo.replace(/^\/?uploads\//, "").replace(/^\//, ""));
        const filePath = path.join(getUploadDir(), cleanFile);
        if (fs.existsSync(filePath)) {
          rawBuffer = fs.readFileSync(filePath);
        } else {
          const fileRecord = await prisma.uploadedFile.findUnique({
            where: { filename: cleanFile },
            select: { data: true },
          });
          if (fileRecord?.data) {
            rawBuffer = fileRecord.data;
          }
        }
      }
    } catch (_err) {}
  }

  // إذا لم يتوفر شعار للمطعم، استخدام الشعار الافتراضي
  if (!rawBuffer || rawBuffer.length < 10) {
    rawBuffer = getDefaultLogoBuffer();
  }

  // 3. المعالجة بـ Sharp لإنتاج صورة PNG مثالية لـ Google WebAPK
  try {
    let resultBuffer: Buffer;

    if (isMaskable) {
      // الأيقونة الـ Maskable تتطلب منطقة أمان (Safe Zone) بنسبة 80% لتجنب قص أطراف الشعار في أندرويد
      const innerSize = Math.round(safeSize * 0.78);
      const padTop = Math.floor((safeSize - innerSize) / 2);
      const padBottom = safeSize - innerSize - padTop;
      const padLeft = Math.floor((safeSize - innerSize) / 2);
      const padRight = safeSize - innerSize - padLeft;

      resultBuffer = await sharp(rawBuffer)
        .resize(innerSize, innerSize, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .extend({
          top: padTop,
          bottom: padBottom,
          left: padLeft,
          right: padRight,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png({ quality: 90, compressionLevel: 8 })
        .toBuffer();
    } else {
      // الأيقونة العادية: ملء المربع بدقة واضحة
      resultBuffer = await sharp(rawBuffer)
        .resize(safeSize, safeSize, {
          fit: "cover",
          position: "center",
        })
        .png({ quality: 90, compressionLevel: 8 })
        .toBuffer();
    }

    // حفظ في الكاش المحدود
    setInCache(cacheKey, resultBuffer);

    return resultBuffer;
  } catch (procErr) {
    console.error(`[BranchIconService] Sharp processing failed for ${cleanId}:`, procErr);
    // إرجاع الشعار الافتراضي المضمون
    return getDefaultLogoBuffer();
  }
}
