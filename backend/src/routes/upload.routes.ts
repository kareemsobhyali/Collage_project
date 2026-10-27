import { Router, Request, Response } from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../prisma.js";
import { authenticateAny, requireSuperAdmin, AuthRequest } from "../middleware/auth.js";


const router = Router();

function isValidImageBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF: GIF87a or GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return true;
  }
  return false;
}


// التأكد من وجود مجلد الرفع وتحديده بدقة
function getUploadDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "backend", "uploads"),
    path.resolve(process.cwd(), "..", "uploads"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const defaultDir = path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}
const uploadDir = getUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(12).toString("hex");
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB حد أقصى
  fileFilter: (_req, file, cb) => {
    const allowed = /^(jpeg|jpg|png|webp|gif)$/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase().replace(".", ""));
    const mime = /^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype.toLowerCase());
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error("يُسمح فقط برفع ملفات الصور بصيغة (JPG, PNG, WEBP, GIF)"));
    }
  },
}).single("image");

// نقطة نهاية رفع الصور مع التحقق من الهوية ومعالجة آمنة للأخطاء
router.post("/", authenticateAny, (req: AuthRequest, res: Response) => {
  upload(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "حجم الصورة كبير جداً، الحد الأقصى المسموح به هو 5 ميجابايت" });
      }
      return res.status(400).json({ error: `خطأ أثناء رفع الملف: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || "فشل رفع الصورة" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "لم يتم اختيار أي صورة للرفع" });
    }

    const filename = req.file.filename;
    const mimeType = req.file.mimetype || "image/jpeg";

    try {
      const fileBuffer = fs.readFileSync(req.file.path);

      if (!isValidImageBuffer(fileBuffer)) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json({ error: "محتوى الملف غير صالح كصورة، يرجى اختيار صورة حقيقية" });
      }

      // حفظ نسخة احتياطية ثنائية (Binary ByteA) في قاعدة البيانات لضمان بقائها حتى لو تم إعادة تشغيل السيرفر أو الاستضافة
      prisma.uploadedFile.upsert({
        where: { filename },
        update: {
          mimeType,
          data: fileBuffer,
          size: fileBuffer.length,
        },
        create: {
          filename,
          mimeType,
          data: fileBuffer,
          size: fileBuffer.length,
        },
      }).catch((dbErr) => {
        console.warn("[Upload] Could not store binary copy in DB:", dbErr);
      });

      const fileUrl = `/uploads/${filename}`;
      return res.json({
        success: true,
        url: fileUrl,
        fileUrl,
        filename,
      });
    } catch {
      const fileUrl = `/uploads/${filename}`;
      return res.json({
        success: true,
        url: fileUrl,
        filename,
      });
    }

  });
});

// تكوين رفع الملفات الصوتية الخاصة بنغمات الإشعارات والتنبيهات
const audioUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB حد أقصى للملفات الصوتية
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    const isAudioExt = /^(mp3|wav|ogg|m4a|aac|webm|flac|mpeg|mp4)$/i.test(ext);
    const isAudioMime = file.mimetype.startsWith("audio/") || file.mimetype.includes("mpeg") || file.mimetype.includes("mp4") || file.mimetype.includes("ogg") || file.mimetype.includes("wav");
    if (isAudioExt && isAudioMime) {
      cb(null, true);
    } else {
      cb(new Error("يُسمح فقط برفع ملفات صوتية بصيغة (MP3, WAV, OGG, M4A, AAC)"));
    }
  },
}).single("audio");

// نقطة نهاية رفع الملفات الصوتية (محصورة بالمسؤول العام للنظام)
router.post("/audio", requireSuperAdmin, (req: AuthRequest, res: Response) => {
  audioUpload(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "حجم الملف الصوتي كبير جداً، الحد الأقصى 10 ميجابايت" });
      }
      return res.status(400).json({ error: `خطأ أثناء رفع الملف الصوتي: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || "فشل رفع الملف الصوتي" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "لم يتم اختيار أي ملف صوتي للرفع" });
    }

    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype || "audio/mpeg";

    try {
      const fileBuffer = fs.readFileSync(req.file.path);

      // حفظ نسخة احتياطية في قاعدة البيانات لضمان البقاء في أي استضافة
      prisma.uploadedFile.upsert({
        where: { filename },
        update: {
          mimeType,
          data: fileBuffer,
          size: fileBuffer.length,
        },
        create: {
          filename,
          mimeType,
          data: fileBuffer,
          size: fileBuffer.length,
        },
      }).catch((dbErr) => {
        console.warn("[Upload] Could not store binary audio copy in DB:", dbErr);
      });

      const fileUrl = `/uploads/${filename}`;
      return res.json({
        success: true,
        fileUrl,
        filename,
        originalName,
      });
    } catch (_e) {
      return res.json({
        success: true,
        fileUrl: `/uploads/${filename}`,
        filename,
        originalName,
      });
    }
  });
});

export default router;

