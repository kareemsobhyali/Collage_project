import fs from "fs";
import path from "path";
import crypto from "crypto";
import prisma from "../prisma.js";
import { notifyBranchMenuChanged } from "../sockets/socketManager.js";
import { optimizeImageToWebp } from "../utils/imageOptimizer.js";

export interface BulkItemSizeInput {
  name: string;
  price: number;
}

export interface BulkMenuItemInput {
  categoryName: string;
  name: string;
  description?: string | null;
  basePrice: number;
  imageUrl?: string | null;
  sizes?: BulkItemSizeInput[];
}

export interface BulkImportOptions {
  replaceExisting?: boolean;
}

export interface BulkImportResult {
  success: boolean;
  categoriesCreated: number;
  itemsCreated: number;
  sizesCreated: number;
  imagesDownloaded: number;
}

function resolveUploadsDir(): string {
  const cands = ["uploads", "backend/uploads", "../uploads"];
  for (const cand of cands) {
    const p = path.resolve(process.cwd(), cand);
    if (fs.existsSync(p)) return p;
  }
  const defaultPath = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(defaultPath)) {
    try { fs.mkdirSync(defaultPath, { recursive: true }); } catch {}
  }
  return defaultPath;
}

/**
 * تنزيل الصورة تلقائياً من الرابط الخارجي وحفظها في مجلد uploads الخاص بالسيرفر
 * وكذلك حفظ نسخة ثنائية في قاعدة البيانات (uploadedFile) لضمان بقائها للأبد
 */
export async function downloadAndSaveImage(imageUrl: string): Promise<string> {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) return "";

  // إذا كانت الصورة مخزنة مسبقاً على السيرفر كمسار محلي
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("uploads/")) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  // إذا لم تكن تبدأ بـ http أو https
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000); // مهلة 7 ثوانٍ للتنزيل

    const res = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) UniFood/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[MenuImport] Image download returned status ${res.status}: ${trimmed}`);
      return trimmed; // خطة بديلة: الاحتفاظ بالرابط الأصلي
    }

    const arrayBuffer = await res.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    // التحقق من حجم الصورة (بحد أقصى 25 ميجابايت وبحد أدنى 100 بايت)
    if (rawBuffer.length < 100 || rawBuffer.length > 25 * 1024 * 1024) {
      return trimmed;
    }

    // ضغط وتحويل الصورة المنزلة تلقائياً إلى صيغة WebP فائقة الكفاءة
    const optimized = await optimizeImageToWebp(rawBuffer, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 82,
    });

    const uploadsDir = resolveUploadsDir();
    const uniqueName = `menu-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${optimized.extension}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    // 1. الحفظ على القرص الصلب بصيغة WebP
    await fs.promises.writeFile(targetPath, optimized.buffer);

    // 2. الحفظ الثنائي في قاعدة البيانات PostgreSQL كنسخة دائمة ضد أي إعادة تشغيل أو إعادة بناء للسيرفر
    prisma.uploadedFile.upsert({
      where: { filename: uniqueName },
      update: {
        mimeType: optimized.mimeType,
        data: optimized.buffer,
        size: optimized.optimizedSize,
      },
      create: {
        filename: uniqueName,
        mimeType: optimized.mimeType,
        data: optimized.buffer,
        size: optimized.optimizedSize,
      },
    }).catch((dbErr) => {
      console.warn(`[MenuImport] Could not backup ${uniqueName} in DB:`, dbErr?.message || dbErr);
    });

    const origKB = (optimized.originalSize / 1024).toFixed(1);
    const optKB = (optimized.optimizedSize / 1024).toFixed(1);
    console.log(`[MenuImport] Downloaded & converted to WebP: ${uniqueName} (${origKB}KB -> ${optKB}KB)`);

    return `/uploads/${uniqueName}`;
  } catch (err: any) {
    console.warn(`[MenuImport] Failed to download image ${trimmed}, using original:`, err?.message || err);
    return trimmed; // خطة أمان بديلة لضمان عدم تعطل المنيو
  }
}

/**
 * معالجة واستيراد المنيو بالكامل من مصفوفة الأصناف وتخزينها في قاعدة البيانات
 */
export async function importBulkMenu(
  branchId: string,
  items: BulkMenuItemInput[],
  options: BulkImportOptions = {}
): Promise<BulkImportResult> {
  if (!branchId) throw new Error("معرّف الفرع مطلوب");
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("لا توجد أصناف صالحة للاستيراد في الملف");
  }

  // 1. مسح المنيو القديم بالكامل إن طُلب ذلك
  if (options.replaceExisting) {
    await prisma.menuItem.deleteMany({ where: { branchId } });
    await prisma.menuCategory.deleteMany({ where: { branchId } });
  }

  // 2. تنزيل الصور وتخزينها على السيرفر (معالجة بالتوازي مع التحكم في الدفعات)
  let imagesDownloadedCount = 0;
  const processedItems: BulkMenuItemInput[] = [];

  // معالجة دفعات صغيرة بحجم 5 صور لتسريع العملية ومنع إرهاق السيرفر
  const BATCH_SIZE = 5;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const resolvedBatch = await Promise.all(
      batch.map(async (it) => {
        let finalImage = it.imageUrl ? String(it.imageUrl).trim() : null;
        if (finalImage && (finalImage.startsWith("http://") || finalImage.startsWith("https://"))) {
          const downloaded = await downloadAndSaveImage(finalImage);
          if (downloaded.startsWith("/uploads/")) {
            imagesDownloadedCount++;
            finalImage = downloaded;
          }
        }
        return {
          ...it,
          imageUrl: finalImage || null,
        };
      })
    );
    processedItems.push(...resolvedBatch);
  }

  // 3. تجميع الأصناف تحت الأقسام
  const categoryMap = new Map<string, BulkMenuItemInput[]>();
  for (const it of processedItems) {
    const rawCat = (it.categoryName || "أصناف عامة").trim();
    const catName = rawCat.length > 0 ? rawCat : "أصناف عامة";
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, []);
    }
    categoryMap.get(catName)!.push(it);
  }

  // 4. جلب الأقسام الحالية لتجنب تكرار أسماء الأقسام الموجودة مسبقاً
  const existingCategories = await prisma.menuCategory.findMany({
    where: { branchId },
    orderBy: { displayOrder: "asc" },
  });

  const catNameToRecord = new Map<string, any>();
  for (const cat of existingCategories) {
    catNameToRecord.set(cat.name.trim().toLowerCase(), cat);
  }

  let nextOrder = existingCategories.length > 0
    ? Math.max(...existingCategories.map((c) => c.displayOrder || 0)) + 1
    : 1;

  let categoriesCreated = 0;
  let itemsCreated = 0;
  let sizesCreated = 0;

  for (const [catName, catItems] of categoryMap.entries()) {
    const lowerName = catName.toLowerCase();
    let categoryRecord = catNameToRecord.get(lowerName);

    if (!categoryRecord) {
      categoryRecord = await prisma.menuCategory.create({
        data: {
          branchId,
          name: catName,
          displayOrder: nextOrder++,
        },
      });
      catNameToRecord.set(lowerName, categoryRecord);
      categoriesCreated++;
    }

    // إنشاء أصناف هذا القسم
    for (const item of catItems) {
      const cleanName = (item.name || "").trim();
      if (!cleanName) continue;

      const rawPrice = Number(item.basePrice);
      const basePrice = !isNaN(rawPrice) && rawPrice >= 0 ? rawPrice : 0;

      const validSizes = (item.sizes || []).filter((s) => {
        const sName = (s.name || "").trim();
        const sPrice = Number(s.price);
        return sName.length > 0 && !isNaN(sPrice) && sPrice > 0;
      });

      await prisma.menuItem.create({
        data: {
          branchId,
          categoryId: categoryRecord.id,
          name: cleanName,
          description: item.description ? String(item.description).trim() : null,
          basePrice,
          imageUrl: item.imageUrl || null,
          isAvailable: true,
          sizes: validSizes.length > 0 ? {
            create: validSizes.map((s) => ({
              name: s.name.trim(),
              price: Number(s.price),
            })),
          } : undefined,
        },
      });

      itemsCreated++;
      sizesCreated += validSizes.length;
    }
  }

  // إشعار جميع المتصفحين والـ POS بالتحديث الفوري للمنيو
  notifyBranchMenuChanged(branchId);

  return {
    success: true,
    categoriesCreated,
    itemsCreated,
    sizesCreated,
    imagesDownloaded: imagesDownloadedCount,
  };
}
