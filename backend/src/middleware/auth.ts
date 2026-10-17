import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

export const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-campus-delivery-2026";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️ [SECURITY WARNING]: JWT_SECRET is not set in environment variables! Please set a strong JWT_SECRET in production.");
}

export interface AuthenticatedUserPayload {
  userId: string;
  role: "CUSTOMER" | "SUPERADMIN";
  phone: string;
}

export interface AuthenticatedBranchPayload {
  branchUserId: string;
  branchId: string;
  username: string;
}

export interface AuthenticatedDriverPayload {
  driverId: string;
  branchId: string;
  name: string;
  username: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUserPayload;
  branch?: AuthenticatedBranchPayload;
  driver?: AuthenticatedDriverPayload;
}

export function generateToken(payload: object, expiresIn: string = "30d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

// حماية مسارات العملاء والأدمن مع التحقق من عدم حظر الحساب
export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ error: "غير مصرح، يرجى تسجيل الدخول" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    if (!decoded.userId) {
      res.status(403).json({ error: "رمز الدخول غير صالح لحساب العميل" });
      return;
    }

    // التحقق من أن الحساب غير محظور حالياً
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isBlocked: true },
    });
    if (user?.isBlocked) {
      res.status(403).json({ error: "عذراً، هذا الحساب موقوف حالياً من قبل الإدارة" });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
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
  });
}

// حماية مسارات تطبيق الديسكتوب الخاص بالفرع
export function authenticateBranch(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "يرجى تسجيل دخول الفرع أولاً" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedBranchPayload;
    if (!decoded.branchUserId || !decoded.branchId) {
      res.status(403).json({ error: "رمز الدخول غير خاص بالفرع" });
      return;
    }
    req.branch = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "جلسة دخول الفرع منتهية، يرجى إعادة تسجيل الدخول" });
  }
}

// حماية مسارات بوابة الطيار / كابتن التوصيل
export function authenticateDriver(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "يرجى تسجيل دخول الطيار أولاً" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedDriverPayload;
    if (!decoded.driverId) {
      res.status(403).json({ error: "رمز الدخول غير صالح لحساب الطيار" });
      return;
    }
    req.driver = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "جلسة دخول الطيار منتهية، يرجى إعادة تسجيل الدخول" });
  }
}

// التحقق من أي حساب معتمد في النظام (عميل، إدارة، فرع، طيار)
export function authenticateAny(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح، يرجى تسجيل الدخول أولاً" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.userId) {
      req.user = decoded;
      return next();
    }
    if (decoded.branchUserId && decoded.branchId) {
      req.branch = decoded;
      return next();
    }
    if (decoded.driverId) {
      req.driver = decoded;
      return next();
    }
    res.status(403).json({ error: "رمز الدخول غير صالح" });
  } catch (error) {
    res.status(401).json({ error: "رمز الدخول غير صالح أو منتهي الصلاحية" });
  }
}

