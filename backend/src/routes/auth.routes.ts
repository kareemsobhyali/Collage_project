import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateToken, authenticateUser, AuthRequest } from "../middleware/auth.js";

const router = Router();
const EGYPT_PHONE_REGEX = /^01[0125][0-9]{8}$/;

// تسجيل حساب عميل جديد (طالب / مستخدم)
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
      res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        password: hashedPassword,
        role: "CUSTOMER",
        loyaltyPoints: 10, // مكافأة ترحيبية 10 نقاط ولاء عند التسجيل
        walletBalance: 0,
      },
    });

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    res.status(201).json({
      success: true,
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

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    res.json({
      success: true,
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

export default router;
