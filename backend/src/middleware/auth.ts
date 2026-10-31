import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import prisma from "../prisma.js";

// تحميل متغيرات البيئة مبكراً قبل تقييم JWT_SECRET لتفادي ترتيب رفع الاستيراد في ESM
dotenv.config();
const backendEnvPath = path.resolve(process.cwd(), "backend", ".env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath, override: true });
}

const KNOWN_INSECURE_SECRETS = new Set<string>([
  "super-secret-key-campus-delivery-2026",
  "change-this-to-a-strong-random-secret-in-production-2026",
  "unifood-super-secret-jwt-key-2026",
  "your-super-secret-jwt-key-change-in-production",
  "<GENERATE_64_CHAR_RANDOM_HEX_SECRET>",
]);

const rawSecret = (process.env.JWT_SECRET || "").trim();
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  if (!rawSecret || KNOWN_INSECURE_SECRETS.has(rawSecret) || rawSecret.length < 32) {
    throw new Error(
      "FATAL CONFIGURATION: A strong, unique JWT_SECRET (minimum 32 characters, not an example placeholder) must be set in production mode!"
    );
  }
} else if (!rawSecret || KNOWN_INSECURE_SECRETS.has(rawSecret) || rawSecret.length < 32) {
  console.warn(
    "⚠️ [DEV NOTICE]: JWT_SECRET is missing or uses an example placeholder. Generated a random ephemeral secret for this local process."
  );
}

export const JWT_SECRET: string =
  rawSecret && !KNOWN_INSECURE_SECRETS.has(rawSecret) && rawSecret.length >= 32
    ? rawSecret
    : crypto.randomBytes(48).toString("hex");

export interface AuthenticatedUserPayload {
  userId: string;
  role: "CUSTOMER" | "SUPERADMIN";
  phone: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedBranchPayload {
  branchUserId: string;
  branchId: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedDriverPayload {
  driverId: string;
  branchId: string;
  name: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUserPayload;
  branch?: AuthenticatedBranchPayload;
  driver?: AuthenticatedDriverPayload;
}

// ذاكرة تخزين مؤقت لطوابع إبطال الجلسات عند تغيير كلمة المرور أو إيقاف الحساب
const revocationCache = new Map<string, { revokedBeforeMs: number; checkedAt: number }>();
const REVOCATION_CACHE_TTL_MS = 30 * 1000;

export async function revokeTokensForPrincipal(principalKey: string): Promise<void> {
  const nowMs = Date.now();
  revocationCache.set(principalKey, { revokedBeforeMs: nowMs, checkedAt: nowMs });
  try {
    const key = `token_revoked_before_${principalKey}`;
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(nowMs) },
      create: { key, value: String(nowMs) },
    });
  } catch {
    // الذاكرة المؤقتة تستمر بالعمل حتى لو تعذر الحفظ اللحظي
  }
}

async function isTokenRevoked(principalKey: string, iatSeconds?: number): Promise<boolean> {
  if (!iatSeconds) return false;
  const now = Date.now();
  let entry = revocationCache.get(principalKey);

  if (!entry || now - entry.checkedAt > REVOCATION_CACHE_TTL_MS) {
    let revokedBeforeMs = 0;
    try {
      const rec = await prisma.systemSetting.findUnique({
        where: { key: `token_revoked_before_${principalKey}` },
        select: { value: true },
      });
      if (rec?.value) {
        revokedBeforeMs = parseInt(rec.value, 10) || 0;
      }
    } catch {}
    entry = { revokedBeforeMs, checkedAt: now };
    revocationCache.set(principalKey, entry);
  }

  // هامش 1000ms لأن حقل iat في JWT مقرب بالثواني
  return entry.revokedBeforeMs > 0 && iatSeconds * 1000 + 1000 < entry.revokedBeforeMs;
}

export function generateToken(payload: object, expiresIn: string = "14d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

export type VerifiedPrincipal =
  | { kind: "USER"; user: AuthenticatedUserPayload }
  | { kind: "BRANCH"; branch: AuthenticatedBranchPayload }
  | { kind: "DRIVER"; driver: AuthenticatedDriverPayload };

/**
 * فحص شامل لصحة التوكن، وعدم إبطاله، وبقاء الحساب نشطاً وغير محظور في قاعدة البيانات
 * يُستخدم في وسطاء HTTP وفي مصادقة Socket.IO واستعلام الإشعارات
 */
export async function verifyTokenAndResolvePrincipal(
  token: string
): Promise<{ principal: VerifiedPrincipal | null; errorStatus?: number; errorMessage?: string }> {
  if (!token) {
    return { principal: null, errorStatus: 401, errorMessage: "غير مصرح، يرجى تسجيل الدخول" };
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return { principal: null, errorStatus: 401, errorMessage: "رمز الدخول غير صالح أو منتهي الصلاحية" };
  }

  if (decoded.userId) {
    const user = await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      select: { id: true, role: true, phone: true, isBlocked: true },
    });
    if (!user) {
      return { principal: null, errorStatus: 401, errorMessage: "الحساب غير موجود، يرجى تسجيل الدخول مجدداً" };
    }
    if (user.isBlocked) {
      return { principal: null, errorStatus: 403, errorMessage: "عذراً، هذا الحساب موقوف حالياً من قبل الإدارة" };
    }
    if (await isTokenRevoked(`user_${user.id}`, decoded.iat)) {
      return { principal: null, errorStatus: 401, errorMessage: "تم تغيير بيانات الأمان، يرجى إعادة تسجيل الدخول" };
    }
    return {
      principal: {
        kind: "USER",
        user: {
          userId: user.id,
          role: (user.role === "SUPERADMIN" ? "SUPERADMIN" : "CUSTOMER") as "CUSTOMER" | "SUPERADMIN",
          phone: user.phone,
          iat: decoded.iat,
          exp: decoded.exp,
        },
      },
    };
  }

  if (decoded.branchUserId && decoded.branchId) {
    const branchUser = await prisma.branchUser.findUnique({
      where: { id: String(decoded.branchUserId) },
      select: {
        id: true,
        username: true,
        branchId: true,
        branch: { select: { isActive: true } },
      },
    });
    if (!branchUser || branchUser.branchId !== String(decoded.branchId)) {
      return { principal: null, errorStatus: 401, errorMessage: "حساب الفرع غير صالح، يرجى إعادة تسجيل الدخول" };
    }
    if (!branchUser.branch?.isActive) {
      return { principal: null, errorStatus: 403, errorMessage: "عذراً، هذا الفرع موقوف حالياً من قبل الإدارة" };
    }
    if (await isTokenRevoked(`branch_${branchUser.branchId}`, decoded.iat)) {
      return { principal: null, errorStatus: 401, errorMessage: "تم تحديث بيانات دخول الفرع، يرجى إعادة تسجيل الدخول" };
    }
    return {
      principal: {
        kind: "BRANCH",
        branch: {
          branchUserId: branchUser.id,
          branchId: branchUser.branchId,
          username: branchUser.username,
          iat: decoded.iat,
          exp: decoded.exp,
        },
      },
    };
  }

  if (decoded.driverId) {
    const driver = await prisma.deliveryDriver.findUnique({
      where: { id: String(decoded.driverId) },
      select: { id: true, branchId: true, name: true, username: true, isActive: true },
    });
    if (!driver) {
      return { principal: null, errorStatus: 401, errorMessage: "حساب كابتن التوصيل غير موجود" };
    }
    if (!driver.isActive) {
      return { principal: null, errorStatus: 403, errorMessage: "عذراً، حساب كابتن التوصيل موقوف حالياً" };
    }
    if (await isTokenRevoked(`driver_${driver.id}`, decoded.iat)) {
      return { principal: null, errorStatus: 401, errorMessage: "تم تحديث بيانات دخول الكابتن، يرجى إعادة تسجيل الدخول" };
    }
    return {
      principal: {
        kind: "DRIVER",
        driver: {
          driverId: driver.id,
          branchId: driver.branchId,
          name: driver.name,
          username: driver.username,
          iat: decoded.iat,
          exp: decoded.exp,
        },
      },
    };
  }

  return { principal: null, errorStatus: 403, errorMessage: "رمز الدخول غير صالح" };
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

// حماية مسارات العملاء والأدمن مع التحقق الفعلي من قاعدة البيانات وعدم حظر الحساب
export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "غير مصرح، يرجى تسجيل الدخول" });
    return;
  }

  try {
    const result = await verifyTokenAndResolvePrincipal(token);
    if (!result.principal) {
      res.status(result.errorStatus || 401).json({ error: result.errorMessage || "رمز الدخول غير صالح" });
      return;
    }
    if (result.principal.kind !== "USER") {
      res.status(403).json({ error: "رمز الدخول غير صالح لحساب العميل" });
      return;
    }

    req.user = result.principal.user;
    next();
  } catch {
    res.status(401).json({ error: "رمز الدخول غير صالح أو منتهي الصلاحية" });
  }
}

// حماية مسارات السوبر أدمن
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  authenticateUser(req, res, () => {
    if (req.user?.role !== "SUPERADMIN") {
      res.status(403).json({ error: "صلاحيات غير كافية، يتطلب حساب مسؤول المنظومة" });
      return;
    }
    next();
  }).catch(next);
}

// حماية مسارات تطبيق الكاشير الخاص بالفرع مع التحقق من بقاء الفرع مفعلاً
export async function authenticateBranch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "يرجى تسجيل دخول الفرع أولاً" });
    return;
  }

  try {
    const result = await verifyTokenAndResolvePrincipal(token);
    if (!result.principal) {
      res.status(result.errorStatus || 401).json({ error: result.errorMessage || "جلسة دخول الفرع منتهية" });
      return;
    }
    if (result.principal.kind !== "BRANCH") {
      res.status(403).json({ error: "رمز الدخول غير خاص بالفرع" });
      return;
    }

    req.branch = result.principal.branch;
    next();
  } catch {
    res.status(401).json({ error: "جلسة دخول الفرع منتهية، يرجى إعادة تسجيل الدخول" });
  }
}

// حماية مسارات بوابة الطيار / كابتن التوصيل مع التحقق من بقاء حسابه نشطاً
export async function authenticateDriver(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "يرجى تسجيل دخول الطيار أولاً" });
    return;
  }

  try {
    const result = await verifyTokenAndResolvePrincipal(token);
    if (!result.principal) {
      res.status(result.errorStatus || 401).json({ error: result.errorMessage || "جلسة دخول الطيار منتهية" });
      return;
    }
    if (result.principal.kind !== "DRIVER") {
      res.status(403).json({ error: "رمز الدخول غير صالح لحساب الطيار" });
      return;
    }

    req.driver = result.principal.driver;
    next();
  } catch {
    res.status(401).json({ error: "جلسة دخول الطيار منتهية، يرجى إعادة تسجيل الدخول" });
  }
}

// التحقق من أي حساب معتمد ونشط في النظام (عميل، إدارة، فرع، طيار)
export async function authenticateAny(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "غير مصرح، يرجى تسجيل الدخول أولاً" });
    return;
  }

  try {
    const result = await verifyTokenAndResolvePrincipal(token);
    if (!result.principal) {
      res.status(result.errorStatus || 401).json({ error: result.errorMessage || "رمز الدخول غير صالح أو منتهي الصلاحية" });
      return;
    }

    if (result.principal.kind === "USER") {
      req.user = result.principal.user;
      next();
      return;
    }
    if (result.principal.kind === "BRANCH") {
      req.branch = result.principal.branch;
      next();
      return;
    }
    if (result.principal.kind === "DRIVER") {
      req.driver = result.principal.driver;
      next();
      return;
    }

    res.status(403).json({ error: "رمز الدخول غير صالح" });
  } catch {
    res.status(401).json({ error: "رمز الدخول غير صالح أو منتهي الصلاحية" });
  }
}
