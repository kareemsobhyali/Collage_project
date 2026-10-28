import sharp from "sharp";

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  originalSize: number;
  optimizedSize: number;
  width?: number;
  height?: number;
}

/**
 * دالة ذكية لتحسين وضغط الصور وتحويلها إلى WebP:
 * 1. قراءة التوجيه الحقيقي من كاميرا الهاتف (EXIF Orientation) لعدم قلب الصور.
 * 2. وضع سقف للأبعاد (افتراضياً 1200×1200 بكسل) مع الحفاظ على النسبة والتناسب وبدون تكبير الصور الصغيرة.
 * 3. التحويل إلى صيغة WebP بضغط فائق وجودة 82% (خالية من التشويش البصري وتوفر أكثر من 85-95% من الحجم).
 * 4. في حالة حدوث أي استثناء أو صيغة غير قياسية، يتم التراجع للبيانات الأصلية بأمان دون إفساد الرفع.
 */
export async function optimizeImageToWebp(
  inputBuffer: Buffer,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  const originalSize = inputBuffer.length;
  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 1200;
  const quality = options.quality ?? 82;

  try {
    const pipeline = sharp(inputBuffer)
      .rotate() // auto-orient based on EXIF tag from smartphone cameras
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality,
        effort: 4, // balanced speed vs compression ratio
        force: true,
      });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      mimeType: "image/webp",
      extension: ".webp",
      originalSize,
      optimizedSize: data.length,
      width: info.width,
      height: info.height,
    };
  } catch (err) {
    console.warn("[ImageOptimizer] Failed to convert to WebP, falling back to original:", err);
    return {
      buffer: inputBuffer,
      mimeType: "image/jpeg",
      extension: ".jpg",
      originalSize,
      optimizedSize: originalSize,
    };
  }
}
