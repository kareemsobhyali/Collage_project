import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma.js";
import { authenticateUser, AuthRequest, JWT_SECRET } from "../middleware/auth.js";
import { 
  notifyBranchNewOrder, 
  notifyOrderStatusChanged, 
  notifyGroupCartUpdated, 
  isBranchOnline,
  notifySupportTicketCreated 
} from "../sockets/socketManager.js";
import { getLoyaltySettings, awardLoyaltyPointsIfCompleted, getRestaurantLocationSettings, getContactChannelsSettings } from "../services/settings.service.js";
import { isOrderAcceptedByDriver } from "../services/driver.service.js";
import { 
  recordFlashDealsConsumption, 
  restoreFlashDealsForOrder, 
  isFlashDealCurrentlyActive, 
  getDealStockInfo, 
  findActiveFlashDealForItem 
} from "../services/flashDeal.service.js";

const router = Router();

// جلب إعدادات قنوات التواصل (قسم انضم كشريك بالصفحة الرئيسية)
router.get("/public/contact-channels", async (_req: Request, res: Response) => {
  try {
    const settings = await getContactChannelsSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع إعدادات قنوات التواصل" });
  }
});

// جلب موقع المطعم الرئيسي والخرائط للعملاء والطيارين
router.get("/public/restaurant-location", async (_req: Request, res: Response) => {
  try {
    const settings = await getRestaurantLocationSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع موقع المطعم" });
  }
});

// جلب رقم واتساب الدعم الفني العام للطلاب
router.get("/public/support-contact", async (_req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "support_whatsapp_phone" },
    });
    const rawPhone = setting?.value?.trim() || "01016629986";
    let cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "2" + cleanPhone;
    else if (!cleanPhone.startsWith("2") && cleanPhone.length === 10) cleanPhone = "20" + cleanPhone;

    res.json({
      whatsappPhone: rawPhone,
      cleanPhone,
      whatsappUrl: `https://wa.me/${cleanPhone}`,
    });
  } catch (error) {
    res.json({
      whatsappPhone: "01016629986",
      cleanPhone: "201016629986",
      whatsappUrl: "https://wa.me/201016629986",
    });
  }
});

// جلب ملف الـ PWA Manifest المخصص للمطعم أو المنصة
router.get("/manifest", async (req: Request, res: Response) => {
  try {
    const rawBranchParam = (req.query.branch || req.query.r || req.query.slug) as string | undefined;
    const branchParam = typeof rawBranchParam === 'string' ? rawBranchParam.trim() : '';
    if (branchParam) {
      const branch = await prisma.branch.findFirst({
        where: {
          OR: [
            { slug: { equals: branchParam, mode: "insensitive" } },
            { id: branchParam },
            { name: { contains: branchParam, mode: "insensitive" } }
          ],
          isActive: true
        }
      });

      if (branch) {
        const branchKey = branch.slug || branch.id;
        const manifest = {
          name: `${branch.name} | UniFood`,
          short_name: branch.name,
          description: `اطلب وجبتك المفضلة من ${branch.name} مباشرة من تطبيق الموبايل`,
          start_url: `/r/${encodeURIComponent(branchKey)}`,
          scope: "/",
          id: `/r/${encodeURIComponent(branchKey)}`,
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
          prefer_related_applications: false,
          handle_links: "preferred",
          launch_handler: {
            client_mode: ["navigate-existing", "auto"]
          },
          background_color: "#ffffff",
          theme_color: "#4f46e5",
          orientation: "portrait",
          dir: "rtl",
          lang: "ar",
          icons: [
            {
              src: `/api/branch-icon/${encodeURIComponent(branchKey)}-192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: `/api/branch-icon/${encodeURIComponent(branchKey)}-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: `/api/branch-icon/${encodeURIComponent(branchKey)}-192.png?maskable=1`,
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: `/api/branch-icon/${encodeURIComponent(branchKey)}-512.png?maskable=1`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ]
        };
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        return res.json(manifest);
      }
    }

    const defaultManifest = {
      name: "UniFood | يونيفود - منصة طلب وتوصيل الطعام",
      short_name: "UniFood",
      description: "منصة طلب وتوصيل الوجبات السريعة وخدمة الطلب الجماعي",
      start_url: "/?installed=1",
      scope: "/",
      id: "/",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
      handle_links: "preferred",
      launch_handler: {
        client_mode: ["navigate-existing", "auto"]
      },
      background_color: "#f8fafc",
      theme_color: "#4f46e5",
      orientation: "portrait",
      dir: "rtl",
      lang: "ar",
      icons: [
        {
          src: "/logo.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: "/logo.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    };
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    return res.json(defaultManifest);
  } catch (error) {
    console.error("Get manifest error:", error);
    res.status(500).json({ error: "فشل استخراج ملف التطبيق" });
  }
});

// جلب بيانات صفحة تثبيت التطبيق APK المخصصة لمطعم أو للمنصة العامة
const getApkMetaHandler = async (req: Request, res: Response) => {
  try {
    const rawParam = req.params.slug;
    const rawSlug = (Array.isArray(rawParam) ? rawParam[0] : rawParam) || (req.query.slug as string) || (req.query.branch as string) || (req.query.r as string);
    let slug = typeof rawSlug === 'string' ? rawSlug.trim() : '';
    if (slug) {
      try {
        slug = decodeURIComponent(slug).trim();
      } catch {}
    }
    if (!slug) {
      const totalBranches = await prisma.branch.count({ where: { isActive: true } });
      return res.json({
        isBranch: false,
        name: "UniFood",
        title: "تطبيق UniFood لطلب وتوصيل الوجبات",
        subtitle: "أشهى المطاعم والوجبات السريعة بين يديك - اطلب واستلم فوراً",
        logoUrl: "/logo.png",
        totalBranches,
        appFeatures: [
          { title: "طلب جماعي تشاركي", desc: "اطلب أكلك أنت وأصدقاؤك أو زملاء العمل في سلة واحدة بدون حيرة الحسابات" },
          { title: "توصيل سريع ومباشر", desc: "استلم وجبتك عند باب بيتك أو مكان عملك مع تتبع مباشر لكابتن التوصيل" },
          { title: "عروض يومية وفلاش ديلز", desc: "خصومات حصرية يومية تبدأ من 20% وحتى 50%" },
          { title: "تنبيهات صوتية فورية", desc: "إشعار عند قبول الطلب، بدء التجهيز، وخروج كابتن التوصيل إليك" }
        ]
      });
    }

    const branch = await prisma.branch.findFirst({
      where: {
        OR: [
          { slug: { equals: slug, mode: "insensitive" } },
          { id: slug },
          { name: { equals: slug, mode: "insensitive" } },
          { name: { contains: slug, mode: "insensitive" } }
        ],
        isActive: true
      },
      include: {
        categories: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          take: 3,
          include: {
            items: {
              where: { isAvailable: true },
              orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
              take: 4
            }
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: "المطعم غير موجود أو تم إيقافه مؤقتاً" });
    }

    const featuredItems: any[] = [];
    branch.categories.forEach(cat => {
      cat.items.forEach(it => {
        if (featuredItems.length < 6) {
          featuredItems.push({
            id: it.id,
            name: it.name,
            basePrice: it.basePrice,
            imageUrl: it.imageUrl
          });
        }
      });
    });

    res.json({
      isBranch: true,
      branchId: branch.id,
      slug: branch.slug || branch.id,
      name: branch.name,
      title: `تطبيق ${branch.name}`,
      subtitle: `التطبيق الرسمي المباشر لمطعم ${branch.name}`,
      logoUrl: branch.logoUrl,
      address: branch.address,
      deliveryFee: branch.deliveryFee,
      operationalStatus: branch.operationalStatus,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      featuredItems,
      appFeatures: [
        { title: "منيو المطعم كاملاً", desc: `تصفح كل أصناف ${branch.name} وأحجامها وإضافاتها في ثواني` },
        { title: "طلب مسبق واستلام فوري", desc: "اطلب واستلم طلبك جاهز وساخن فور وصولك بدون انتظار في الطابور" },
        { title: "عروض وتخفيضات خاصة", desc: `عروض فلاش ديلز وكوبونات حصرية لعملاء تطبيق ${branch.name}` },
        { title: "تثبيت سريع وخفيف", desc: "تطبيق سريع جداً على شاشة هاتفك لا يستهلك باقة ولا مساحة تخزين" }
      ]
    });
  } catch (error) {
    console.error("Get APK meta error:", error);
    res.status(500).json({ error: "فشل استرجاع بيانات التطبيق" });
  }
};

router.get("/apk-meta", getApkMetaHandler);
router.get("/apk-meta/:slug", getApkMetaHandler);

// 0. استعراض البانرات الإعلانية الترويجية
router.get("/banners", async (_req: Request, res: Response) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع البانرات الإعلانية" });
  }
});

// 0.5 التحقق من صلاحية كود الخصم للطلاب (شامل عدد مرات الاستخدام وشرط المرة الواحدة)
router.post("/promo-codes/validate", async (req: Request, res: Response) => {
  try {
    const { code, subtotal, branchId } = req.body;
    if (!code || !code.trim()) {
      res.status(400).json({ error: "يرجى إدخال كود الخصم" });
      return;
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!promo || !promo.isActive) {
      res.status(404).json({ error: "كود الخصم غير صالح أو غير مفعل" });
      return;
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      res.status(400).json({ error: "انتهت صلاحية كود الخصم هذا" });
      return;
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      res.status(400).json({ error: "عذراً، تم استنفاد الحد الأقصى لعدد مرات استخدام هذا الكوبون" });
      return;
    }

    // التحقق من نطاق الفروع المسموح بها لهذا الكوبون (فروع معينة أو الكل)
    if (promo.applicableBranchIds) {
      try {
        const allowedBranches: string[] = JSON.parse(promo.applicableBranchIds);
        if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
          if (!branchId || !allowedBranches.includes(String(branchId).trim())) {
            res.status(400).json({ error: "كود الخصم هذا مخصص لمطاعم وفروع محددة فقط ولا ينطبق على هذا المطعم" });
            return;
          }
        }
      } catch (_e) {
        const allowedBranches = promo.applicableBranchIds.split(',').map(s => s.trim()).filter(Boolean);
        if (allowedBranches.length > 0 && (!branchId || !allowedBranches.includes(String(branchId).trim()))) {
          res.status(400).json({ error: "كود الخصم هذا مخصص لمطاعم وفروع محددة فقط ولا ينطبق على هذا المطعم" });
          return;
        }
      }
    }

    // التحقق من شرط الاستخدام لمرة واحدة لكل طالب إذا كان مسجلاً للدخول
    if (promo.oncePerUser && req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded?.userId) {
          const previousUses = await prisma.order.count({
            where: {
              userId: decoded.userId,
              promoCode: promo.code,
              status: { not: "REJECTED" },
            },
          });
          if (previousUses > 0) {
            res.status(400).json({ error: "لقد قمت باستخدام كود الخصم هذا مسبقاً (متاح لمرة واحدة لكل عميل)" });
            return;
          }
        }
      } catch (_e) {
        // ignore invalid token during pre-login validation
      }
    }

    const sub = parseFloat(subtotal) || 0;
    if (sub < promo.minOrder) {
      res.status(400).json({ error: `الحد الأدنى لتطبيق هذا الكود هو ${promo.minOrder} ج.م` });
      return;
    }

    let discount = 0;
    if (promo.discountType === "PERCENT" || promo.discountType === "PERCENTAGE") {
      discount = Math.round((sub * promo.value) / 100);
    } else {
      discount = Math.min(sub, promo.value);
    }

    res.json({
      success: true,
      valid: true,
      code: promo.code,
      discount,
      discountType: promo.discountType,
      value: promo.value,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل التحقق من كود الخصم" });
  }
});

// دالة مساعدة للتحقق من وقوع التوقيت وأيام العمل (بتوقيت مصر) داخل مواعيد العمل الرسمية للفرع
function isBranchWithinWorkingHours(
  openingTime?: string | null,
  closingTime?: string | null,
  targetDate?: Date,
  workingDays?: string | null
): boolean {
  const base = targetDate || new Date();
  const cairoDate = new Date(base.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));

  // التحقق من أيام العمل إذا كانت محددة explicitly
  if (workingDays && workingDays.trim()) {
    const wd = workingDays.trim();
    const dayIndex = cairoDate.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    if ((wd.includes("السبت - الخميس") || wd.includes("ماعدا الجمعة") || wd.includes("عدا الجمعة")) && dayIndex === 5) {
      return false;
    }
    const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const arabicAlt = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعة", "السبت"];
    if (!wd.includes("-") && !wd.includes("يوميا") && !wd.includes("يومياً") && !wd.includes("كل") && !wd.includes("طوال")) {
      const hasAnyDayName = arabicDays.some((d, idx) => wd.includes(d) || wd.includes(arabicAlt[idx]));
      if (hasAnyDayName && !wd.includes(arabicDays[dayIndex]) && !wd.includes(arabicAlt[dayIndex])) {
        return false;
      }
    }
  }

  if (!openingTime || !closingTime) return true;
  const openParts = openingTime.split(":").map(Number);
  const closeParts = closingTime.split(":").map(Number);
  if (openParts.length < 2 || closeParts.length < 2 || isNaN(openParts[0]) || isNaN(closeParts[0])) {
    return true;
  }
  const openMins = openParts[0] * 60 + (openParts[1] || 0);
  const closeMins = closeParts[0] * 60 + (closeParts[1] || 0);
  if (openMins === closeMins) return true;

  const currentMins = cairoDate.getHours() * 60 + cairoDate.getMinutes();

  if (closeMins > openMins) {
    return currentMins >= openMins && currentMins <= closeMins;
  } else {
    // في حال امتداد الدوام لما بعد منتصف الليل (مثال: 10:00 صباحاً حتى 02:00 فجراً)
    return currentMins >= openMins || currentMins <= closeMins;
  }
}

function computeBranchCrowdInfo(activeKitchenOrders: number) {
  if (activeKitchenOrders >= 6) {
    return {
      activeKitchenOrders,
      crowdLevel: "HIGH" as const,
      crowdLabel: "ضغط عالي وقت البريك",
      estimatedPrepMins: "30-40 د",
    };
  }
  if (activeKitchenOrders >= 3) {
    return {
      activeKitchenOrders,
      crowdLevel: "MEDIUM" as const,
      crowdLabel: "متوسط الازدحام",
      estimatedPrepMins: "20-25 د",
    };
  }
  return {
    activeKitchenOrders,
    crowdLevel: "LOW" as const,
    crowdLabel: "هادئ الآن • تجهيز سريع",
    estimatedPrepMins: "10-15 د",
  };
}

// 0.8 عروض الفلاش الموقوتة وقت البريك (Flash Deals المضافة حصراً من لوحة الإدارة)
router.get("/flash-deals", async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    // جلب عروض الفلاش المخصصة المدارة حصراً من لوحة الإدارة مع فحص التكرار وساعات العمل
    let customDeals: any[] = [];
    try {
      const allActiveDeals = await prisma.flashDeal.findMany({
        where: {
          isActive: true,
        },
        include: {
          branch: { select: { id: true, name: true, slug: true, logoUrl: true } }
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }]
      });

      const activeCustomDeals = allActiveDeals.filter(d => isFlashDealCurrentlyActive(d, now));

      // جلب بيانات الأصناف المرتبطة بالعروض مع الأحجام والإضافات
      const itemIdsToFetch = Array.from(new Set(activeCustomDeals.map(d => d.menuItemId).filter(Boolean))) as string[];
      let fetchedItemsMap: Record<string, any> = {};
      if (itemIdsToFetch.length > 0) {
        try {
          const itemsData = await prisma.menuItem.findMany({
            where: { id: { in: itemIdsToFetch }, isAvailable: true },
            include: {
              sizes: true,
              modifierGroupLinks: {
                include: {
                  group: {
                    include: {
                      options: { where: { isAvailable: true } }
                    }
                  }
                }
              }
            }
          });
          fetchedItemsMap = Object.fromEntries(itemsData.map(it => [it.id, it]));
        } catch (_errItems) {}
      }

      customDeals = activeCustomDeals.map((d) => {
        const stockInfo = getDealStockInfo(d);
        const linkedItem = d.menuItemId ? fetchedItemsMap[d.menuItemId] : null;
        return {
          id: `custom_${d.id}`,
          dbId: d.id,
          type: d.dealType, // "COMBO" | "PROMO" | "CUSTOM"
          title: d.title,
          subtitle: d.subtitle,
          originalPrice: d.originalPrice,
          discountPrice: d.discountPrice,
          price: d.discountPrice || d.originalPrice,
          discountPercent: d.discountPercent,
          promoCode: d.promoCode,
          code: d.promoCode,
          badgeText: d.badgeText || "عرض البريك 🔥",
          imageUrl: d.imageUrl || linkedItem?.imageUrl || null,
          expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
          maxUses: stockInfo.isUnlimited ? 9999 : (d.maxQuantity || 50),
          usedCount: d.soldQuantity || 0,
          remainingUses: stockInfo.remainingQuantity,
          isUnlimited: stockInfo.isUnlimited,
          maxPerUser: d.maxPerUser || null,
          isRecurring: Boolean(d.isRecurring),
          recurringDays: d.recurringDays,
          dailyStartTime: d.dailyStartTime,
          dailyEndTime: d.dailyEndTime,
          targetBranch: d.branch,
          branchId: d.branchId,
          menuItemId: d.menuItemId,
          item: linkedItem ? {
            ...linkedItem,
            originalBasePrice: d.originalPrice || linkedItem.basePrice,
            basePrice: d.discountPrice || linkedItem.basePrice,
          } : null,
        };
      });
    } catch (_e) {
      // Table may not exist yet on initial boot
    }

    res.json({
      deals: customDeals,
      customDeals,
      promoDeals: customDeals.filter((d) => d.type === "PROMO"),
      comboDeals: customDeals.filter((d) => d.type !== "PROMO"),
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error("Get flash deals error:", error);
    res.status(500).json({ error: "فشل جلب عروض الفلاش" });
  }
});

// 1. استعراض الفروع النشطة للطلاب (شامل مؤشر زحمة المطبخ الحي + تقييمات الطلاب)
router.get("/branches", async (_req: Request, res: Response) => {
  try {
    // التأكد التلقائي من وجود عمود requirePaymentProof لتفادي أي خطأ 500 في السيرفر السحابي
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "BranchPaymentConfig" ADD COLUMN IF NOT EXISTS "requirePaymentProof" BOOLEAN NOT NULL DEFAULT true;`
    ).catch(() => {});

    const [branches, activeOrderCounts, ratingAggregates] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        include: {
          paymentConfig: true,
          deliveryZones: true,
          _count: {
            select: { items: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.order.groupBy({
        by: ["branchId"],
        where: {
          status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
        },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["branchId"],
        where: {
          rating: { not: null },
        },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const activeMap = new Map<string, number>();
    for (const row of activeOrderCounts) {
      activeMap.set(row.branchId, row._count._all);
    }

    const ratingMap = new Map<string, { avgRating: number; ratingsCount: number }>();
    for (const row of ratingAggregates) {
      ratingMap.set(row.branchId, {
        avgRating: row._avg.rating ? Number(row._avg.rating.toFixed(1)) : 0,
        ratingsCount: row._count.rating || 0,
      });
    }

    const now = new Date();
    const formattedBranches = branches.map(b => {
      let currentStatus = b.operationalStatus;
      let currentClosedUntil = b.closedUntil;
      let currentReason = b.closingReason;

      if (currentStatus === "BUSY" && currentClosedUntil && now >= new Date(currentClosedUntil)) {
        currentStatus = "OPEN";
        currentClosedUntil = null;
        currentReason = null;
      }

      const isWithinWorkingHours = isBranchWithinWorkingHours(b.openingTime, b.closingTime, now, b.workingDays);
      const crowdInfo = computeBranchCrowdInfo(activeMap.get(b.id) || 0);
      const ratingInfo = ratingMap.get(b.id) || { avgRating: 0, ratingsCount: 0 };

      return {
        ...b,
        operationalStatus: currentStatus,
        closedUntil: currentClosedUntil,
        closingReason: currentReason,
        isWithinWorkingHours,
        isOnline: isBranchOnline(b.id),
        ...crowdInfo,
        avgRating: ratingInfo.avgRating,
        ratingsCount: ratingInfo.ratingsCount,
      };
    });

    res.json(formattedBranches);
  } catch (error) {
    console.error("Get customer branches error:", error);
    res.status(500).json({ error: "فشل استرجاع قائمة المطاعم المتاحة" });
  }
});

// 2. تصفح منيو الفرع وطرق الدفع ومناطق التوصيل المتاحة له (شامل التقييمات ومؤشر زحمة المطبخ)
router.get("/branches/:id/menu", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id as string;
    const id = typeof rawId === 'string' ? decodeURIComponent(rawId).trim() : '';
    const now = new Date();

    const branch = await prisma.branch.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
          { slug: id.toLowerCase() },
        ],
        isActive: true,
      },
      include: {
        paymentConfig: true,
        deliveryZones: true,
      },
    });

    if (!branch) {
      res.status(404).json({ error: "الفرع غير متاح أو غير موجود" });
      return;
    }

    const actualBranchId = branch.id;

    // إعادة تفعيل الأصناف والإضافات التي انتهت مدة نفادها المؤقت تلقائياً
    await prisma.menuItem.updateMany({
      where: {
        branchId: actualBranchId,
        isAvailable: false,
        unavailableUntil: { not: null, lte: now },
      },
      data: {
        isAvailable: true,
        unavailableUntil: null,
      },
    });

    await prisma.modifierOption.updateMany({
      where: {
        group: { branchId: actualBranchId },
        isAvailable: false,
        unavailableUntil: { not: null, lte: now },
      },
      data: {
        isAvailable: true,
        unavailableUntil: null,
      },
    });

    const [categories, activeOrdersCount, ratingStats, recentReviews, allFlashDeals, allBanners, allPromos] = await Promise.all([
      prisma.menuCategory.findMany({
        where: { branchId: actualBranchId },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
            include: {
              sizes: true,
              modifierGroupLinks: {
                include: {
                  group: {
                    include: {
                      options: {
                        where: { isAvailable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      }),
      prisma.order.count({
        where: {
          branchId: actualBranchId,
          status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
        },
      }),
      prisma.order.aggregate({
        where: {
          branchId: actualBranchId,
          rating: { not: null },
        },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.order.findMany({
        where: {
          branchId: actualBranchId,
          rating: { not: null },
        },
        select: {
          id: true,
          customerName: true,
          rating: true,
          review: true,
          createdAt: true,
          items: {
            select: {
              itemName: true,
              quantity: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      prisma.flashDeal.findMany({
        where: {
          isActive: true,
          OR: [
            { branchId: actualBranchId },
            { branchId: null },
          ],
        },
        include: {
          branch: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.banner.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.promoCode.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const liveFlashDeals = (allFlashDeals || []).filter(d => isFlashDealCurrentlyActive(d, now));

    // استخراج البانرات الخاصة بهذا المطعم أو البانرات العامة
    const branchSlugNorm = (branch.slug || "").toLowerCase();
    const relevantBanners = (allBanners || []).filter((b: any) => {
      if (!b.linkUrl) return true; // بانر ترويجي عام يظهر للكل
      const link = String(b.linkUrl).toLowerCase();
      return (
        link.includes(actualBranchId.toLowerCase()) ||
        (branchSlugNorm && link.includes(branchSlugNorm))
      );
    });

    // استخراج كوبونات الخصم الصالحة لهذا المطعم
    const relevantPromos = (allPromos || []).filter((p: any) => {
      if (p.expiresAt && new Date(p.expiresAt) <= now) return false;
      if (p.maxUses && p.usedCount >= p.maxUses) return false;
      if (!p.applicableBranchIds) return true;
      try {
        const allowed = JSON.parse(p.applicableBranchIds);
        if (Array.isArray(allowed)) {
          return allowed.some(
            (id: string) =>
              id === actualBranchId ||
              (branchSlugNorm && String(id).toLowerCase() === branchSlugNorm)
          );
        }
      } catch {
        const allowed = p.applicableBranchIds.split(",").map((s: string) => s.trim().toLowerCase());
        return (
          allowed.includes(actualBranchId.toLowerCase()) ||
          (branchSlugNorm && allowed.includes(branchSlugNorm))
        );
      }
      return true;
    });

    let currentStatus = branch.operationalStatus;
    let currentClosedUntil = branch.closedUntil;
    let currentReason = branch.closingReason;

    if (currentStatus === "BUSY" && currentClosedUntil && now >= new Date(currentClosedUntil)) {
      currentStatus = "OPEN";
      currentClosedUntil = null;
      currentReason = null;
    }

    const isWithinWorkingHours = isBranchWithinWorkingHours(branch.openingTime, branch.closingTime, now, branch.workingDays);
    const crowdInfo = computeBranchCrowdInfo(activeOrdersCount);
    const avgRating = ratingStats._avg.rating ? Number(ratingStats._avg.rating.toFixed(1)) : 0;
    const ratingsCount = ratingStats._count.rating || 0;

    // ربط وتطبيق عروض الفلاش النشطة حالياً على أسعار الأصناف في قائمة الطعام
    const formattedCategories = categories.map((cat) => ({
      ...cat,
      items: (cat.items || []).map((item) => {
        const matchingDeal = liveFlashDeals.find((d) => d.menuItemId === item.id);
        const stockInfo = matchingDeal ? getDealStockInfo(matchingDeal) : null;
        if (matchingDeal && stockInfo?.isStockAvailable && matchingDeal.discountPrice != null && matchingDeal.discountPrice > 0) {
          const originalPrice = matchingDeal.originalPrice || item.basePrice;
          const discountDiff = Math.max(0, originalPrice - matchingDeal.discountPrice);
          return {
            ...item,
            originalBasePrice: originalPrice,
            basePrice: matchingDeal.discountPrice,
            flashDeal: {
              id: matchingDeal.id,
              title: matchingDeal.title,
              badgeText: matchingDeal.badgeText || "عرض البريك 🔥",
              discountPrice: matchingDeal.discountPrice,
              originalPrice,
              expiresAt: matchingDeal.expiresAt,
              remainingQuantity: stockInfo.remainingQuantity,
              isUnlimited: stockInfo.isUnlimited,
              maxPerUser: matchingDeal.maxPerUser || null,
            },
            sizes: (item.sizes || []).map((s) => ({
              ...s,
              originalPrice: s.price,
              price: Math.max(1, s.price - discountDiff),
            })),
          };
        }
        return item;
      }),
    }));

    res.json({
      branch: {
        ...branch,
        operationalStatus: currentStatus,
        closedUntil: currentClosedUntil,
        closingReason: currentReason,
        isWithinWorkingHours,
        isOnline: isBranchOnline(actualBranchId),
        ...crowdInfo,
        avgRating,
        ratingsCount,
      },
      categories: formattedCategories,
      reviews: recentReviews.map((r) => ({
        id: r.id,
        customerName: r.customerName || "عميل",
        rating: r.rating || 5,
        review: r.review || "",
        createdAt: r.createdAt,
        itemsSummary: (r.items || []).map((i) => `${i.quantity}× ${i.itemName}`).join(" ، "),
      })),
      flashDeals: liveFlashDeals.map((d) => {
        const stockInfo = getDealStockInfo(d);
        return {
          id: `custom_${d.id}`,
          dbId: d.id,
          type: d.dealType,
          title: d.title,
          subtitle: d.subtitle,
          originalPrice: d.originalPrice,
          discountPrice: d.discountPrice,
          price: d.discountPrice || d.originalPrice,
          discountPercent: d.discountPercent,
          promoCode: d.promoCode,
          code: d.promoCode,
          badgeText: d.badgeText || "عرض البريك 🔥",
          imageUrl: d.imageUrl,
          expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
          maxUses: stockInfo.isUnlimited ? 9999 : (d.maxQuantity || 50),
          usedCount: d.soldQuantity || 0,
          remainingUses: stockInfo.remainingQuantity,
          isUnlimited: stockInfo.isUnlimited,
          maxPerUser: d.maxPerUser || null,
          isRecurring: Boolean(d.isRecurring),
          recurringDays: d.recurringDays,
          dailyStartTime: d.dailyStartTime,
          dailyEndTime: d.dailyEndTime,
          branchId: d.branchId,
          menuItemId: d.menuItemId,
        };
      }),
      banners: relevantBanners,
      promos: relevantPromos.map((p) => ({
        id: p.id,
        code: p.code,
        discountType: p.discountType,
        value: p.value,
        minOrder: p.minOrder,
        expiresAt: p.expiresAt,
      })),
    });
  } catch (error: any) {
    console.error("Get branch menu for customer error:", error);
    res.status(500).json({ error: error?.message || "فشل تحميل منيو الفرع" });
  }
});

// ==========================================
// مسارات السلة الجماعية التشاركية (سلة الشلة)
// ==========================================

// إنشاء سلة جماعية جديدة ومشاركتها بكود أو رابط
router.post("/group-cart/create", async (req: Request, res: Response) => {
  try {
    const { branchId, hostName } = req.body;
    if (!branchId || !hostName) {
      res.status(400).json({ error: "يرجى تحديد الفرع واسم صاحب السلة" });
      return;
    }

    // توليد كود مشاركة عشوائي آمن وفريد من 6 أحرف
    let shareCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = crypto.randomBytes(4).toString("hex").substring(0, 6).toUpperCase();
      const exists = await prisma.groupCart.findUnique({ where: { shareCode: candidate } });
      if (!exists) {
        shareCode = candidate;
        break;
      }
    }
    if (!shareCode) {
      shareCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    }

    // توليد رمز تحكم سري خاص بمنشئ السلة لحمايتها من الإغلاق والتخريب من قبل أطراف غير مصرح لها
    const hostToken = crypto.randomUUID();

    const cart = await prisma.groupCart.create({
      data: {
        branchId,
        hostName: String(hostName).trim(),
        shareCode,
        hostToken,
      },
      include: {
        items: true,
      },
    });

    res.status(201).json(cart);
  } catch (error) {
    console.error("Create group cart error:", error);
    res.status(500).json({ error: "فشل إنشاء سلة الشلة" });
  }
});

// استعراض محتويات السلة الجماعية بالكود
router.get("/group-cart/:code", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة أو انتهت صلاحيتها" });
      return;
    }

    if (cart.isClosed) {
      res.status(410).json({ error: "تم إغلاق سلة الشلة من قِبل المنشئ، ولم يعد بإمكان أي شخص الدخول إليها أو إضافة أصناف.", isClosed: true });
      return;
    }

    const branch = await prisma.branch.findUnique({
      where: { id: cart.branchId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        allowDelivery: true,
        allowPickup: true,
        deliveryFee: true,
        operationalStatus: true,
        openingTime: true,
        closingTime: true,
        workingDays: true,
      },
    });

    // تجريد الرموز السرية لعدم تسريبها للمشاركين العاديين
    const { hostToken: _ht, items, ...safeCart } = cart as any;
    const safeItems = (items || []).map((it: any) => {
      const { deleteKey: _dk, ...safeIt } = it;
      return safeIt;
    });

    res.json({ ...safeCart, items: safeItems, branch });
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع بيانات سلة الشلة" });
  }
});

// إضافة صنف لسلة الشلة باسم الطالب (مع التحقق من السعر الحقيقي من قاعدة البيانات)
router.post("/group-cart/:code/items", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const { studentName, menuItemId, itemName, sizeName, unitPrice, quantity, notes, selectedModifiers } = req.body;

    if (!studentName || !menuItemId || !itemName) {
      res.status(400).json({ error: "بيانات الصنف غير مكتملة" });
      return;
    }

    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة" });
      return;
    }

    if (cart.isClosed) {
      res.status(410).json({ error: "تم إغلاق سلة الشلة من قِبل المنشئ، ولا يمكن إضافة أصناف جديدة.", isClosed: true });
      return;
    }

    const dbItem = await prisma.menuItem.findUnique({
      where: { id: String(menuItemId) },
      include: { sizes: true },
    });

    if (!dbItem || dbItem.branchId !== cart.branchId || !dbItem.isAvailable) {
      res.status(400).json({ error: "الصنف المطلوب غير متاح في هذا المطعم" });
      return;
    }

    // التحقق مما إذا كان الصنف مشمولاً في عرض فلاش مؤقت نشط حالياً
    const activeItemDeal = await prisma.flashDeal.findFirst({
      where: {
        menuItemId: dbItem.id,
        isActive: true,
        expiresAt: { gt: new Date() },
        startsAt: { lte: new Date() },
      },
    });

    let effectiveItemBasePrice = dbItem.basePrice;
    let dealDiscountDiff = 0;
    if (activeItemDeal && activeItemDeal.discountPrice != null && activeItemDeal.discountPrice > 0) {
      const orig = activeItemDeal.originalPrice || dbItem.basePrice;
      effectiveItemBasePrice = activeItemDeal.discountPrice;
      dealDiscountDiff = Math.max(0, orig - activeItemDeal.discountPrice);
    }

    let realBasePrice = effectiveItemBasePrice;
    if (dbItem.sizes && dbItem.sizes.length > 0) {
      const matchedSize = sizeName ? dbItem.sizes.find(s => s.name === sizeName) : dbItem.sizes[0];
      if (!matchedSize) {
        res.status(400).json({ error: "حجم الصنف المختار غير صالح" });
        return;
      }
      realBasePrice = Math.max(1, matchedSize.price - dealDiscountDiff);
    }

    let modifiersExtra = 0;
    let comboExtra = 0;
    let parsedMods: any[] = [];
    if (selectedModifiers) {
      try {
        parsedMods = Array.isArray(selectedModifiers) ? selectedModifiers : JSON.parse(String(selectedModifiers));
      } catch {
        parsedMods = [];
      }
    }

    for (const mod of parsedMods) {
      if (mod.groupId === "combo" && dbItem.comboItems) {
        try {
          const combos = typeof dbItem.comboItems === "string" ? JSON.parse(dbItem.comboItems) : dbItem.comboItems;
          if (Array.isArray(combos)) {
            const foundCombo = combos.find((c: any) => c.id === mod.optionId || c.title === mod.optionName || mod.optionName?.startsWith(c.title));
            if (foundCombo) {
              const cQty = Math.max(1, Number(mod.quantity) || 1);
              comboExtra += Math.max(0, Number(foundCombo.price) || 0) * cQty;
            }
          }
        } catch {}
      } else if (mod.optionId) {
        const dbOpt = await prisma.modifierOption.findUnique({
          where: { id: String(mod.optionId) },
          include: { group: { select: { branchId: true } } },
        });
        if (dbOpt && dbOpt.isAvailable && dbOpt.group.branchId === cart.branchId) {
          modifiersExtra += Math.max(0, dbOpt.price);
        }
      }
    }

    const qty = Math.max(1, Math.min(100, parseInt(quantity) || 1));
    const verifiedUnitPrice = realBasePrice + modifiersExtra;
    const totalPrice = verifiedUnitPrice * qty + comboExtra;

    // توليد مفتاح أمان فريد لتفويض صاحب الصنف بحذفه لاحقاً
    const deleteKey = crypto.randomUUID();

    const createdItem = await prisma.groupCartItem.create({
      data: {
        groupCartId: cart.id,
        studentName: String(studentName).trim(),
        deleteKey,
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        sizeName: sizeName || null,
        unitPrice: verifiedUnitPrice,
        quantity: qty,
        totalPrice,
        notes: notes ? String(notes).trim() : null,
        selectedModifiers: parsedMods.length > 0 ? JSON.stringify(parsedMods) : null,
      },
    });

    const updatedCart = await prisma.groupCart.findUnique({
      where: { id: cart.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    notifyGroupCartUpdated(code, updatedCart);
    res.status(201).json({ ...updatedCart, addedItemDeleteKey: deleteKey });
  } catch (error) {
    console.error("Add group cart item error:", error);
    res.status(500).json({ error: "فشل إضافة الصنف لسلة الشلة" });
  }
});

// حذف صنف من سلة الشلة (محمي بصلاحية صاحب الصنف أو منشئ السلة حصراً)
router.delete("/group-cart/:code/items/:itemId", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const itemId = req.params.itemId as string;
    const studentName = (req.query.studentName as string)?.trim();
    const providedHostToken = (req.headers["x-host-token"] || req.query.hostToken) as string | undefined;
    const providedDeleteKey = (req.headers["x-delete-key"] || req.query.deleteKey) as string | undefined;

    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة" });
      return;
    }

    if (cart.isClosed) {
      res.status(410).json({ error: "تم إغلاق سلة الشلة من قِبل المنشئ، ولا يمكن تعديل الأصناف.", isClosed: true });
      return;
    }

    const item = await prisma.groupCartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.groupCartId !== cart.id) {
      res.status(404).json({ error: "الصنف غير موجود بالسلة" });
      return;
    }

    // التحقق الصارم من الصلاحية: مفتاح تفويض الصنف أو رمز تحكم منشئ السلة
    const isHostAuthorized = Boolean(cart.hostToken && providedHostToken && cart.hostToken === providedHostToken);
    const isItemOwnerAuthorized = Boolean(item.deleteKey && providedDeleteKey && item.deleteKey === providedDeleteKey);
    const isLegacyAllowed = !cart.hostToken && !item.deleteKey && (studentName === item.studentName || studentName === cart.hostName);

    if (!isHostAuthorized && !isItemOwnerAuthorized && !isLegacyAllowed) {
      res.status(403).json({ error: "لا يمكنك حذف هذا الصنف، يتطلب رمز تفويض صاحب الصنف أو منشئ السلة" });
      return;
    }

    await prisma.groupCartItem.delete({
      where: { id: itemId },
    });

    const updatedCart = await prisma.groupCart.findUnique({
      where: { id: cart.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    notifyGroupCartUpdated(code, updatedCart);
    res.json(updatedCart);
  } catch (error) {
    console.error("Delete group cart item error:", error);
    res.status(500).json({ error: "فشل حذف الصنف من سلة الشلة" });
  }
});

// إغلاق سلة الشلة المشتركة من قِبل المنشئ وتوقيف الرابط فوراً (محمي برمز تحكم المنشئ)
router.post("/group-cart/:code/close", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();
    const providedHostToken = (req.headers["x-host-token"] || req.query.hostToken || req.body?.hostToken) as string | undefined;

    const cart = await prisma.groupCart.findUnique({
      where: { shareCode: code },
    });

    if (!cart) {
      res.status(404).json({ error: "سلة الشلة غير موجودة" });
      return;
    }

    // التحقق من أن الطلب قادم من منشئ السلة الفعلي
    if (cart.hostToken && (!providedHostToken || cart.hostToken !== providedHostToken)) {
      res.status(403).json({ error: "غير مصرح لك بإغلاق السلة، يتطلب رمز تحكم منشئ ومسؤول السلة حصراً" });
      return;
    }

    const updated = await prisma.groupCart.update({
      where: { shareCode: code },
      data: {
        isClosed: true,
        closedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    notifyGroupCartUpdated(code, { ...updated, isClosed: true });

    res.json({ success: true, message: "تم إغلاق سلة الشلة بنجاح وتوقيف رابط المشاركة", isClosed: true });
  } catch (error) {
    console.error("Close group cart error:", error);
    res.status(500).json({ error: "فشل إغلاق سلة الشلة" });
  }
});

// المسارات التالية تتطلب تسجيل دخول العميل
router.use(authenticateUser);

// 3. إنشاء طلب جديد (Checkout)
router.post("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      branchId,
      orderType, // "DELIVERY" أو "PICKUP"
      paymentMethod, // "CASH", "VODAFONE_CASH", "INSTAPAY", "CARD"
      addressText,
      deliveryZoneName,
      deliveryFee: customDeliveryFee,
      paymentProofUrl,
      paymentSenderPhone,
      promoCode,
      discount: discountInput,
      customerPhone,
      customerName,
      notes,
      items, // قائمة الأصناف المختارة
      isScheduled,
      scheduledFor,
      groupCartDetails,
      useWallet,
    } = req.body;

    if (!branchId || !orderType || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
      return;
    }

    if (orderType === "DELIVERY" && (!addressText || !addressText.trim())) {
      res.status(400).json({ error: "يرجى كتابة عنوان التوصيل بالتفصيل (الشارع / العمارة / الشقة)" });
      return;
    }

    // جلب بيانات الفرع للتحقق من نشاطه وإعدادات الدفع
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { paymentConfig: true, deliveryZones: true },
    });

    if (!branch || !branch.isActive) {
      res.status(400).json({ error: "المطعم غير متاح لاستقبال الطلبات حالياً" });
      return;
    }

    // التحقق من اتصال سيستم المطعم بالإنترنت وفتح شاشة الاستقبال
    if (!isBranchOnline(branch.id)) {
      res.status(400).json({
        error: `عذراً، سيستم استقبال الطلبات في مطعم "${branch.name}" غير متصل حالياً (انقطاع في الإنترنت أو إغلاق التطبيق). لا يمكن إرسال الطلب حتى يعود اتصال المطعم حفاظاً على وجبتك ووقتك.`,
      });
      return;
    }

    // التحقق من حالة استقبال الطلبات (مغلق مؤقتاً أو مغلق تماماً أو خارج مواعيد العمل الرسمية)
    const currentTime = new Date();
    if (branch.operationalStatus === "CLOSED") {
      res.status(400).json({ error: "عذراً، هذا المطعم مغلق حالياً ولا يستقبل أي طلبات فورية أو حجز مسبق." });
      return;
    }

    if (branch.operationalStatus === "BUSY" && branch.closedUntil && currentTime < new Date(branch.closedUntil)) {
      const remainingMinutes = Math.ceil((new Date(branch.closedUntil).getTime() - currentTime.getTime()) / (60 * 1000));
      res.status(400).json({ 
        error: `المطعم في فترة استراحة/تجهيز مؤقتة (${remainingMinutes} دقيقة تقريباً). لا يمكن استقبال الطلبات أو الحجز المسبق حالياً حتى عودة الفرع للعمل.` 
      });
      return;
    }

    if (!isBranchWithinWorkingHours(branch.openingTime, branch.closingTime, currentTime, branch.workingDays)) {
      res.status(400).json({
        error: `عذراً، المطعم مغلق حالياً لانتهاء مواعيد العمل الرسمية (${branch.openingTime || "08:00"} - ${branch.closingTime || "22:00"}). غير متاح عمل طلبات أو حجز مسبق طالما الفرع مغلق.`,
      });
      return;
    }

    // التحقق من نطاق التوصيل الجغرافي للمطعم في حال كان الطلب توصيل (طلب المستخدم)
    if (orderType === "DELIVERY") {
      let clientLat: number | null = typeof req.body.latitude === "number" && !isNaN(req.body.latitude) ? req.body.latitude : null;
      let clientLng: number | null = typeof req.body.longitude === "number" && !isNaN(req.body.longitude) ? req.body.longitude : null;
      if (clientLat === null || clientLng === null) {
        const match = addressText?.match(/\[GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/i);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            clientLat = lat;
            clientLng = lng;
          }
        }
      }

      if (clientLat !== null && clientLng !== null) {
        let bLat = typeof branch.latitude === "number" && !isNaN(branch.latitude) ? branch.latitude : null;
        let bLng = typeof branch.longitude === "number" && !isNaN(branch.longitude) ? branch.longitude : null;
        if ((bLat === null || bLng === null) && branch.address) {
          const bMatch = branch.address.match(/\[GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/i);
          if (bMatch) {
            bLat = parseFloat(bMatch[1]);
            bLng = parseFloat(bMatch[2]);
          }
        }
        if (bLat === null || bLng === null) {
          bLat = 30.0275;
          bLng = 31.2095;
        }

        const radiusKm = typeof branch.deliveryRadiusKm === "number" && branch.deliveryRadiusKm > 0 ? branch.deliveryRadiusKm : 10.0;
        // حساب المسافة بمعادلة Haversine
        const R = 6371; // Earth radius in km
        const dLat = (clientLat - bLat) * Math.PI / 180;
        const dLon = (clientLng - bLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(bLat * Math.PI / 180) * Math.cos(clientLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distKm = R * c;

        if (distKm > radiusKm) {
          res.status(400).json({
            error: `عذراً، موقع التوصيل يقع خارج نطاق التوصيل المحدد لهذا المطعم (${distKm.toFixed(1)} كم • أقصى نطاق مسموح: ${radiusKm} كم). لا يمكن إتمام الطلب.`
          });
          return;
        }
      }
    }

    // إذا كان الطلب محجوزاً مسبقاً، يجب أن يكون موعد الحجز صالحاً وفي المستقبل وضمن ساعات عمل المطعم الرسمية
    if (isScheduled) {
      if (!scheduledFor) {
        res.status(400).json({ error: "يرجى تحديد موعد الاستلام أو التوصيل للطلب المجدول" });
        return;
      }
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < currentTime.getTime() - 60 * 1000) {
        res.status(400).json({ error: "موعد الحجز المسبق غير صالح أو في وقت سابق، يرجى اختيار موعد مستقبلي" });
        return;
      }
      if (!isBranchWithinWorkingHours(branch.openingTime, branch.closingTime, scheduledDate, branch.workingDays)) {
        res.status(400).json({
          error: `موعد الحجز المسبق المختار (${scheduledDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}) يقع خارج ساعات عمل المطعم (${branch.openingTime || "08:00"} - ${branch.closingTime || "22:00"}). يرجى اختيار موعد ضمن فترة العمل.`,
        });
        return;
      }
    }

    // التحقق من تفعيل خيار الطلب (توصيل أو استلام)
    if (orderType === "DELIVERY" && !branch.allowDelivery) {
      res.status(400).json({ error: "هذا الفرع لا يوفر خدمة التوصيل حالياً، يمكنك اختيار الاستلام من الفرع" });
      return;
    }

    if (orderType === "PICKUP" && !branch.allowPickup) {
      res.status(400).json({ error: "هذا الفرع لا يوفر خيار الاستلام المباشر" });
      return;
    }

    // التحقق من أن طريقة الدفع مفعلة لهذا الفرع تحديداً (الدفع كاش متاح وإجباري دائماً لجميع المطاعم)
    const paymentConfig = branch.paymentConfig;
    if (paymentConfig) {
      if (paymentMethod === "VODAFONE_CASH" && !paymentConfig.vodafoneCashEnabled) {
        res.status(400).json({ error: "الدفع بمحفظة فودافون كاش غير متاح لهذا الفرع" });
        return;
      }
      if (paymentMethod === "INSTAPAY" && !paymentConfig.instapayEnabled) {
        res.status(400).json({ error: "الدفع عبر إنستاباي غير متاح لهذا الفرع" });
        return;
      }
      if (paymentMethod === "CARD" && !paymentConfig.cardEnabled) {
        res.status(400).json({ error: "الدفع بالبطاقة الإلكترونية غير متاح لهذا الفرع" });
        return;
      }
    }

    // حساب الأسعار والمجموع من قاعدة البيانات لمنع التلاعب بالأسعار من المتصفح
    let subtotal = 0;
    const orderItemsData: any[] = [];

    for (const itemInput of items) {
      const dbItem = await prisma.menuItem.findUnique({
        where: { id: itemInput.menuItemId },
        include: { sizes: true },
      });

      if (!dbItem || dbItem.branchId !== branchId) {
        res.status(400).json({ error: `الصنف المطلوب غير موجود في هذا المطعم` });
        return;
      }

      if (!dbItem.isAvailable) {
        if (dbItem.unavailableUntil && currentTime >= new Date(dbItem.unavailableUntil)) {
          await prisma.menuItem.update({
            where: { id: dbItem.id },
            data: { isAvailable: true, unavailableUntil: null },
          });
        } else {
          res.status(400).json({ error: `عذراً، الصنف "${dbItem.name}" نفد للتو وغير متاح حالياً` });
          return;
        }
      }

      // التحقق مما إذا كان الصنف مشمولاً في عرض فلاش مؤقت نشط حالياً وتتوفر منه كمية
      const activeItemDeal = await findActiveFlashDealForItem(dbItem.id, currentTime, prisma);

      let effectiveItemBasePrice = dbItem.basePrice;
      let dealDiscountDiff = 0;

      if (activeItemDeal && activeItemDeal.discountPrice != null && activeItemDeal.discountPrice > 0) {
        const stockInfo = getDealStockInfo(activeItemDeal);
        const reqQty = Math.max(1, Number(itemInput.quantity) || 1);

        // 1. التحقق الصارم من توفر كمية العرض: منع طلب كمية أكبر من المتاح للعرض
        if (!stockInfo.isUnlimited && stockInfo.remainingQuantity < reqQty) {
          res.status(400).json({
            error: stockInfo.remainingQuantity <= 0
              ? `عذراً، نفدت كمية عرض الفلاش للصنف "${dbItem.name}" بالكامل ⌛`
              : `الكمية المطلوبة من الصنف "${dbItem.name}" (${reqQty}) تتجاوز المتبقي من عرض الفلاش (المتاح حالياً: ${stockInfo.remainingQuantity} فقط)`,
          });
          return;
        }

        // 2. التحقق الصارم من الحد الأقصى لكل حساب طالب (maxPerUser)
        if (activeItemDeal.maxPerUser && activeItemDeal.maxPerUser > 0) {
          if (reqQty > activeItemDeal.maxPerUser) {
            res.status(400).json({
              error: `الحد الأقصى المسموح به لكل عميل من عرض "${activeItemDeal.title}" هو ${activeItemDeal.maxPerUser} فقط (طلبت: ${reqQty})`,
            });
            return;
          }

          if (userId) {
            const userHistory = await prisma.orderItem.aggregate({
              _sum: { quantity: true },
              where: {
                order: {
                  userId: userId,
                  status: { notIn: ["REJECTED", "CANCELLED"] },
                  createdAt: { gte: activeItemDeal.startsAt || new Date(Date.now() - 24 * 3600 * 1000) },
                },
                menuItemId: dbItem.id,
              },
            });
            const alreadyOrdered = userHistory._sum.quantity || 0;
            if (alreadyOrdered + reqQty > activeItemDeal.maxPerUser) {
              const remainingAllowed = Math.max(0, activeItemDeal.maxPerUser - alreadyOrdered);
              res.status(400).json({
                error: `لقد استنفدت الحد الأقصى المسموح به لحسابك من عرض "${activeItemDeal.title}" (${activeItemDeal.maxPerUser} لكل طالب). المتبقي لحسابك: ${remainingAllowed}`,
              });
              return;
            }
          }
        }

        const orig = activeItemDeal.originalPrice || dbItem.basePrice;
        effectiveItemBasePrice = activeItemDeal.discountPrice;
        dealDiscountDiff = Math.max(0, orig - activeItemDeal.discountPrice);
      }

      let unitPrice = effectiveItemBasePrice;
      let resolvedSizeName: string | null = itemInput.sizeName || null;
      if (dbItem.sizes && dbItem.sizes.length > 0) {
        if (itemInput.sizeName) {
          const matchedSize = dbItem.sizes.find(s => s.name === itemInput.sizeName);
          if (!matchedSize) {
            res.status(400).json({ error: `الحجم المختار للصنف "${dbItem.name}" غير صالح` });
            return;
          }
          unitPrice = Math.max(1, matchedSize.price - dealDiscountDiff);
        } else {
          unitPrice = Math.max(1, dbItem.sizes[0].price - dealDiscountDiff);
          resolvedSizeName = dbItem.sizes[0].name;
        }
      }

      // جلب والتحقق الفعلي من أسعار الإضافات المختارة من قاعدة البيانات لمنع أي تلاعب بالسعر من العميل
      let modifiersExtra = 0;
      let comboExtra = 0;
      const verifiedModifiers: any[] = [];
      if (itemInput.selectedModifiers && Array.isArray(itemInput.selectedModifiers)) {
        for (const mod of itemInput.selectedModifiers) {
          let realModPrice = 0;
          let isComboMod = false;
          let optionName = String(mod.optionName || mod.name || "").trim();
          if (mod.groupId === 'combo' && dbItem.comboItems) {
            try {
              const combos = typeof dbItem.comboItems === 'string' ? JSON.parse(dbItem.comboItems) : dbItem.comboItems;
              if (Array.isArray(combos)) {
                const foundCombo = combos.find((c: any) => c.id === mod.optionId || c.title === mod.optionName || mod.optionName?.startsWith(c.title));
                if (foundCombo) {
                  const qty = Math.max(1, Number(mod.quantity) || 1);
                  realModPrice = Math.max(0, Number(foundCombo.price) || 0) * qty;
                  optionName = foundCombo.title + (qty > 1 ? ` (×${qty})` : "");
                  isComboMod = true;
                }
              }
            } catch (_e) {}
          } else if (mod.optionId) {
            const dbOption = await prisma.modifierOption.findUnique({
              where: { id: mod.optionId },
              include: { group: { select: { branchId: true } } },
            });
            if (dbOption && dbOption.isAvailable && dbOption.group.branchId === branchId) {
              realModPrice = Math.max(0, dbOption.price);
              optionName = dbOption.name;
            } else {
              continue;
            }
          } else if (optionName) {
            const dbOption = await prisma.modifierOption.findFirst({
              where: {
                name: optionName,
                group: { branchId },
                isAvailable: true,
              },
            });
            if (dbOption) {
              realModPrice = Math.max(0, dbOption.price);
            }
          }
          if (isComboMod) {
            comboExtra += realModPrice;
          } else {
            modifiersExtra += realModPrice;
          }
          verifiedModifiers.push({
            optionId: mod.optionId,
            optionName: optionName || "إضافة",
            price: realModPrice,
          });
        }
      }

      const totalItemUnit = unitPrice + modifiersExtra;
      const quantity = Math.max(1, Math.min(100, parseInt(itemInput.quantity) || 1));
      const itemTotalPrice = (totalItemUnit * quantity) + comboExtra;

      subtotal += itemTotalPrice;

      orderItemsData.push({
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        sizeName: resolvedSizeName,
        unitPrice: totalItemUnit,
        quantity,
        totalPrice: itemTotalPrice,
        notes: itemInput.notes ? String(itemInput.notes).trim() : null,
        selectedModifiers: verifiedModifiers.length > 0 ? JSON.stringify(verifiedModifiers) : null,
      });
    }

    // حساب رسوم التوصيل من إعدادات الفرع الفعلية
    let calculatedDeliveryFee = 0;
    if (orderType === "DELIVERY") {
      if (branch.deliveryType === "ZONES" && branch.deliveryZones.length > 0) {
        const matchedZone = deliveryZoneName
          ? branch.deliveryZones.find(z => z.name === deliveryZoneName)
          : null;
        if (matchedZone) {
          calculatedDeliveryFee = matchedZone.fee;
        } else {
          // في حال لم يطابق اسم المنطقة، استخدام أول منطقة معتمدة أو رسوم الفرع الأساسية
          calculatedDeliveryFee = Math.max(branch.deliveryFee, branch.deliveryZones[0].fee);
        }
      } else {
        calculatedDeliveryFee = Math.max(0, branch.deliveryFee);
      }
    }

    // التحقق الفعلي من كود الخصم على السيرفر (شامل حدود الاستخدام)
    let discount = 0;
    let verifiedPromoCode: string | null = null;
    let verifiedPromoId: string | null = null;

    if (promoCode && String(promoCode).trim()) {
      const cleanCode = String(promoCode).trim().toUpperCase();
      const promo = await prisma.promoCode.findUnique({
        where: { code: cleanCode },
      });

      const isUnderLimit = !promo?.maxUses || promo.usedCount < promo.maxUses;
      let allowedForUser = true;
      if (promo?.oncePerUser) {
        const previousUses = await prisma.order.count({
          where: { userId, promoCode: promo.code, status: { not: "REJECTED" } },
        });
        if (previousUses > 0) allowedForUser = false;
      }

      let allowedForBranch = true;
      if (promo?.applicableBranchIds) {
        try {
          const allowedBranches: string[] = JSON.parse(promo.applicableBranchIds);
          if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
            allowedForBranch = allowedBranches.includes(branchId);
          }
        } catch {
          const allowedBranches = promo.applicableBranchIds.split(',').map(s => s.trim()).filter(Boolean);
          if (allowedBranches.length > 0) {
            allowedForBranch = allowedBranches.includes(branchId);
          }
        }
      }

      if (
        promo &&
        promo.isActive &&
        (!promo.expiresAt || new Date() <= promo.expiresAt) &&
        subtotal >= promo.minOrder &&
        isUnderLimit &&
        allowedForUser &&
        allowedForBranch
      ) {
        verifiedPromoCode = promo.code;
        verifiedPromoId = promo.id;
        if (promo.discountType === "PERCENT" || promo.discountType === "PERCENTAGE") {
          discount = Math.round((subtotal * promo.value) / 100);
        } else {
          discount = Math.min(subtotal, promo.value);
        }
      }
    }

    const preWalletTotal = Math.max(0, subtotal + calculatedDeliveryFee - discount);

    // التحقق من حالة حساب الطالب وعدم حظره من قبل إدارة المنظومة (حظر عام)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser || currentUser.isBlocked) {
      res.status(403).json({
        error: "عذراً، تم إيقاف هذا الحساب من إرسال طلبات جديدة. يرجى التواصل مع الإدارة.",
      });
      return;
    }

    // التحقق من عدم حظر العميل على مستوى هذا الفرع تحديداً (عزل الحظر على مستوى المطعم)
    const branchCustomerBlock = await prisma.branchBlockedCustomer.findUnique({
      where: {
        branchId_userId: { branchId, userId },
      },
    });

    if (branchCustomerBlock && branchCustomerBlock.isBlocked) {
      res.status(403).json({
        error: "عذراً، تم إيقاف استقبال طلبات هذا الحساب لدى هذا المطعم تحديداً. يمكنك الطلب من مطاعم أخرى أو التواصل مع إدارة المطعم.",
      });
      return;
    }

    const finalPhone = customerPhone ? String(customerPhone).trim().replace(/\s+/g, "") : req.user!.phone;
    if (!/^01[0125][0-9]{8}$/.test(finalPhone) && currentUser.role !== "SUPERADMIN") {
      res.status(400).json({
        error: "يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015",
      });
      return;
    }

    // خصم رصيد المحفظة الجامعية إذا اختار الطالب الدفع/الخصم من المحفظة
    let walletDiscount = 0;
    if (useWallet && currentUser && currentUser.walletBalance > 0 && preWalletTotal > 0) {
      walletDiscount = Math.min(preWalletTotal, currentUser.walletBalance);
    }

    const total = Math.max(0, preWalletTotal - walletDiscount);

    // التحقق الصارم من صحة رقم المحفظة المصري وإلزامية إرفاق صورة التحويل (إذا كان المطعم يلزم إرفاق الإيصال مسبقاً)
    let validatedPaymentSender = paymentSenderPhone ? String(paymentSenderPhone).trim() : null;
    const requirePaymentProof = (branch.paymentConfig as any)?.requirePaymentProof !== false;

    if (total > 0) {
      if (paymentMethod === "VODAFONE_CASH") {
        let cleanSender = String(paymentSenderPhone || "").trim().replace(/\s+/g, "");
        if (cleanSender.startsWith("+20")) cleanSender = cleanSender.slice(3);
        else if (cleanSender.startsWith("0020")) cleanSender = cleanSender.slice(4);
        else if (cleanSender.startsWith("20") && cleanSender.length > 11) cleanSender = cleanSender.slice(2);

        if (requirePaymentProof) {
          if (!cleanSender) {
            res.status(400).json({ error: "يرجى إدخال رقم محفظة فودافون كاش التي قمت بالتحويل منها" });
            return;
          }
          if (!/^01[0125][0-9]{8}$/.test(cleanSender)) {
            res.status(400).json({
              error: "يرجى إدخال رقم محفظة مصري صحيح مكون من 11 رقماً ويبدأ بـ (010, 011, 012, 015)",
            });
            return;
          }
          if (!paymentProofUrl || !String(paymentProofUrl).trim()) {
            res.status(400).json({
              error: "يرجى رفع صورة إيصال أو لقطة شاشة التحويل (Screenshot) لتأكيد دفع المحفظة",
            });
            return;
          }
          validatedPaymentSender = cleanSender;
        } else {
          // التحويل عند الاستلام مع الكابتن (الرقم والإيصال اختياريان)
          if (cleanSender && !/^01[0125][0-9]{8}$/.test(cleanSender)) {
            res.status(400).json({
              error: "يرجى إدخال رقم محفظة مصري صحيح مكون من 11 رقماً ويبدأ بـ (010, 011, 012, 015)",
            });
            return;
          }
          validatedPaymentSender = cleanSender || null;
        }
      } else if (paymentMethod === "INSTAPAY") {
        const cleanSender = String(paymentSenderPhone || "").trim();
        if (requirePaymentProof) {
          if (!cleanSender) {
            res.status(400).json({
              error: "يرجى كتابة اسم الحساب أو رقم الهاتف المحول منه عبر إنستاباي",
            });
            return;
          }
          if (!paymentProofUrl || !String(paymentProofUrl).trim()) {
            res.status(400).json({
              error: "يرجى رفع صورة إيصال أو لقطة شاشة التحويل (Screenshot) لتأكيد دفع إنستاباي",
            });
            return;
          }
          validatedPaymentSender = cleanSender;
        } else {
          // التحويل عند الاستلام مع الكابتن
          validatedPaymentSender = cleanSender || null;
        }
      }
    }

    // حساب نقاط الولاء المحسوبة لهذا الطلب حسب إعدادات المنظومة (لا تُودع في المحفظة إلا بعد اكتمال الطلب والتسليم)
    const loyaltySettings = await getLoyaltySettings();
    const pointsEarned = loyaltySettings.enabled 
      ? Math.max(0, Math.floor(subtotal * loyaltySettings.pointsPerPound)) 
      : 0;

    // توليد رمز أمان استلام عشوائي (4 أرقام) للتحقق عند التسليم مع الطيار
    const pickupPin = crypto.randomInt(1000, 10000).toString();

    // إنشاء الطلب وخصم المحفظة في عملية متسلسلة ذرية واحدة لحماية الرصيد ومنع تكرار الطلبات
    const { order, updatedUser } = await prisma.$transaction(async (tx) => {
      // منع تكرار الطلبات الناتج عن الضغط المزدوج السريع (Idempotency guard خلال 5 ثوانٍ)
      const duplicateOrder = await tx.order.findFirst({
        where: {
          userId,
          branchId,
          subtotal,
          status: "PENDING",
          createdAt: { gte: new Date(Date.now() - 5000) },
        },
        select: { id: true },
      });
      if (duplicateOrder) {
        throw new Error("DUPLICATE_ORDER_SUBMISSION");
      }

      // التحقق الذري من كود الخصم وشرط المرة الواحدة داخل المعاملة
      if (verifiedPromoId && verifiedPromoCode) {
        const freshPromo = await tx.promoCode.findUnique({
          where: { id: verifiedPromoId },
        });
        if (!freshPromo || !freshPromo.isActive) {
          throw new Error("PROMO_INVALID");
        }
        if (freshPromo.maxUses && freshPromo.usedCount >= freshPromo.maxUses) {
          throw new Error("PROMO_EXHAUSTED");
        }
        if (freshPromo.oncePerUser) {
          const usedByUser = await tx.order.count({
            where: { userId, promoCode: verifiedPromoCode, status: { not: "REJECTED" } },
          });
          if (usedByUser > 0) {
            throw new Error("PROMO_ALREADY_USED_BY_USER");
          }
        }
        await tx.promoCode.update({
          where: { id: verifiedPromoId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // توليد رقم طلب تصاعدي وفريد داخل المعاملة
      const lastOrder = await tx.order.findFirst({
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const orderNumber = lastOrder && lastOrder.orderNumber >= 1000 ? lastOrder.orderNumber + 1 : 1001;

      // التحقق الذري من الرصيد داخل المعاملة لمنع استنزاف المحفظة بالتزامن
      let userAfterWallet = null;
      if (walletDiscount > 0) {
        const walletClaim = await tx.user.updateMany({
          where: { id: userId, walletBalance: { gte: walletDiscount } },
          data: { walletBalance: { decrement: walletDiscount } },
        });
        if (walletClaim.count === 0) {
          throw new Error("INSUFFICIENT_WALLET_BALANCE");
        }
      }

      userAfterWallet = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          loyaltyPoints: true,
          walletBalance: true,
        },
      });

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          branchId,
          userId,
          orderType,
          paymentMethod,
          addressText: orderType === "DELIVERY" ? addressText?.trim() : "استلام من الفرع",
          deliveryZoneName: deliveryZoneName ? String(deliveryZoneName).trim() : null,
          paymentProofUrl: paymentProofUrl ? String(paymentProofUrl).trim() : null,
          paymentSenderPhone: validatedPaymentSender,
          promoCode: verifiedPromoCode,
          discount,
          walletDiscount,
          pointsEarned,
          pointsAwarded: false,
          customerPhone: finalPhone,
          customerName: customerName ? customerName.trim() : "طالب",
          notes: notes ? notes.trim() : null,
          status: "PENDING",
          subtotal,
          deliveryFee: calculatedDeliveryFee,
          total,
          isScheduled: !!isScheduled,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          pickupPin,
          groupCartDetails: groupCartDetails ? (typeof groupCartDetails === "object" ? JSON.stringify(groupCartDetails) : String(groupCartDetails)) : null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              isBlocked: true,
              restaurantNotes: true,
              _count: {
                select: { orders: true },
              },
            },
          },
          branch: {
            select: { name: true, phone: true, address: true, logoUrl: true },
          },
          driver: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      // تسجيل استهلاك كميات عروض الفلاش فوراً بمجرد إنشاء الطلب حتى لو كان الطلب قيد الانتظار (PENDING)
      await recordFlashDealsConsumption(orderItemsData, verifiedPromoCode, branchId, tx);

      return { order: createdOrder, updatedUser: userAfterWallet };
    });

    // إشعار فوري لتطبيق الديسكتوب الخاص بالفرع لتشغيل التنبيه الصوتي فوراً
    notifyBranchNewOrder(branchId, order);

    res.status(201).json({
      success: true,
      order,
      user: updatedUser,
    });
  } catch (error: any) {
    if (error?.message === "DUPLICATE_ORDER_SUBMISSION") {
      res.status(409).json({ error: "تم استلام طلبك بالفعل، يرجى الانتظار لحظات" });
      return;
    }
    if (error?.message === "FLASH_DEAL_EXHAUSTED") {
      res.status(400).json({ error: "عذراً، نفدت كمية عرض الفلاش المتاحة أثناء معالجة طلبك ⌛" });
      return;
    }
    if (error?.message === "INSUFFICIENT_WALLET_BALANCE") {
      res.status(400).json({ error: "رصيد المحفظة الحالي غير كافٍ لإتمام عملية الخصم" });
      return;
    }
    if (error?.message === "PROMO_EXHAUSTED" || error?.message === "PROMO_INVALID") {
      res.status(400).json({ error: "عذراً، كود الخصم غير متاح أو وصل للحد الأقصى للاستخدام" });
      return;
    }
    if (error?.message === "PROMO_ALREADY_USED_BY_USER") {
      res.status(400).json({ error: "لقد قمت باستخدام كود الخصم هذا مسبقاً" });
      return;
    }
    console.error("Create order error:", error);
    res.status(500).json({ error: "فشل تسجيل الطلب" });
  }
});

// 4. تتبع حالة الطلب بالرقم التعريفي (محمي لملكية صاحب الطلب فقط)
router.get("/orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true, paymentConfig: true },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!order || (order.userId !== req.user!.userId && req.user!.role !== "SUPERADMIN")) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const isDriverAccepted = Boolean(order.driverPickedUpAt) || (order.driverId ? await isOrderAcceptedByDriver(order.id) : false);

    res.json({
      ...order,
      isDriverAccepted,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع بيانات الطلب" });
  }
});

// 5. سجل طلبات العميل
router.get("/my-orders", async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      include: {
        branch: {
          select: { id: true, name: true, phone: true, address: true, logoUrl: true },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(
      orders.map(async (o) => ({
        ...o,
        isDriverAccepted: Boolean(o.driverPickedUpAt) || (o.driverId ? await isOrderAcceptedByDriver(o.id) : false),
      }))
    );

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "فشل استرجاع سجل الطلبات" });
  }
});

// 6. إلغاء الطلب من جهة الطالب (فقط إذا كان ما زال جديداً PENDING) مع استرداد رصيد المحفظة تلقائياً دون خصم نقاط الولاء السابقة
router.put("/orders/:id/cancel", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!order || order.userId !== userId) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (order.status !== "PENDING") {
      res.status(400).json({ error: "عذراً، لا يمكن إلغاء الطلب بعد أن بدأ المطعم في تحضيره" });
      return;
    }

    const { updated, updatedUser } = await prisma.$transaction(async (tx) => {
      // تحديث ذري مشروط بكون الحالة PENDING لمنع تكرار استرداد المحفظة при الطلبات المتزامنة
      const claim = await tx.order.updateMany({
        where: { id, userId, status: "PENDING" },
        data: {
          status: "REJECTED",
          cancelledAt: new Date(),
          notes: `${order.notes ? order.notes + " | " : ""}تم إلغاء الطلب من قِبل الطالب (العميل)`,
        },
      });
      if (claim.count === 0) {
        throw new Error("ORDER_NOT_PENDING");
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, branch: true },
      });

      // استرجاع كميات عروض الفلاش فوراً عند إلغاء الطلب من الطالب
      await restoreFlashDealsForOrder(id, tx);

      let refundedUser = null;
      const currentUser = await tx.user.findUnique({ where: { id: userId } });
      if (currentUser) {
        const refundedWallet = Number(((currentUser.walletBalance || 0) + (order.walletDiscount || 0)).toFixed(2));
        // لا يتم خصم النقاط إلا إذا كانت قد أُودعت بالفعل (pointsAwarded === true)
        const revertedPoints = order.pointsAwarded
          ? Math.max(0, (currentUser.loyaltyPoints || 0) - (order.pointsEarned || 0))
          : (currentUser.loyaltyPoints || 0);

        refundedUser = await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: refundedWallet,
            loyaltyPoints: revertedPoints,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            loyaltyPoints: true,
            walletBalance: true,
          },
        });
      }

      if (order.promoCode) {
        const promo = await tx.promoCode.findUnique({ where: { code: order.promoCode } });
        if (promo && promo.usedCount > 0) {
          await tx.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { decrement: 1 } },
          }).catch(() => {});
        }
      }

      return { updated: updatedOrder, updatedUser: refundedUser };
    });

    notifyOrderStatusChanged(id, order.branchId, updated);

    res.json({ success: true, order: updated, user: updatedUser });
  } catch (error: any) {
    if (error?.message === "ORDER_NOT_PENDING") {
      res.status(400).json({ error: "لا يمكن إلغاء هذا الطلب حالياً" });
      return;
    }
    console.error("Cancel order error:", error);
    res.status(500).json({ error: "فشل إلغاء الطلب" });
  }
});

// 7. تقييم الطلب بعد اكتماله
router.post("/orders/:id/rate", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { rating, review } = req.body;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order || order.userId !== userId) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    if (order.status !== "COMPLETED") {
      res.status(400).json({ error: "يمكن تقييم الطلب بعد استلامه واكتماله فقط" });
      return;
    }

    const numRating = Math.max(1, Math.min(5, parseInt(rating) || 5));

    const updated = await prisma.order.update({
      where: { id },
      data: {
        rating: numRating,
        review: review ? String(review).trim() : null,
      },
      include: { items: true, branch: true },
    });

    res.json({ success: true, order: updated });
  } catch (error) {
    console.error("Rate order error:", error);
    res.status(500).json({ error: "فشل حفظ التقييم" });
  }
});

// 7. جلب عناوين العميل المحفوظة
router.get("/addresses", async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await prisma.userAddress.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(addresses);
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({ error: "فشل جلب العناوين" });
  }
});

// 8. إضافة عنوان جديد
router.post("/addresses", async (req: AuthRequest, res: Response) => {
  try {
    const { title, details, isDefault } = req.body;
    if (!title || !details) {
      res.status(400).json({ error: "يرجى إدخال اسم وتفاصيل العنوان" });
      return;
    }

    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.userAddress.create({
      data: {
        userId: req.user!.userId,
        title: title.trim(),
        details: details.trim(),
        isDefault: !!isDefault,
      },
    });

    res.status(201).json(address);
  } catch (error) {
    console.error("Create address error:", error);
    res.status(500).json({ error: "فشل حفظ العنوان" });
  }
});

// 9. حذف عنوان
router.delete("/addresses/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.userAddress.deleteMany({
      where: { id, userId: req.user!.userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ error: "فشل حذف العنوان" });
  }
});

// 10. تعديل بيانات البروفايل (الاسم)
router.put("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "الرجاء إدخال الاسم" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name: name.trim() },
      select: { id: true, name: true, phone: true, role: true, loyaltyPoints: true, walletBalance: true },
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "فشل تحديث البيانات الشخصية" });
  }
});

// 11. جلب بيانات المحفظة الجامعية ونقاط الولاء وسجل المكافآت
router.get("/wallet", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        walletBalance: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const rewardHistory = await prisma.order.findMany({
      where: {
        userId,
        OR: [{ pointsEarned: { gt: 0 } }, { walletDiscount: { gt: 0 } }],
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        pointsEarned: true,
        walletDiscount: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const loyaltySettings = await getLoyaltySettings();

    res.json({
      loyaltyPoints: user.loyaltyPoints,
      walletBalance: user.walletBalance,
      history: rewardHistory,
      settings: loyaltySettings,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل جلب بيانات المحفظة ونقاط الولاء" });
  }
});

// 12. تحويل نقاط الولاء إلى رصيد نقدي في المحفظة الجامعية حسب نسبة الاستبدال المحددة من الإدارة
router.post("/wallet/convert-points", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const loyaltySettings = await getLoyaltySettings();
    if (!loyaltySettings.enabled) {
      res.status(400).json({ error: "نظام استبدال نقاط الولاء غير مفعّل حالياً من قِبل إدارة المنظومة" });
      return;
    }

    if (user.loyaltyPoints < loyaltySettings.minPointsToRedeem) {
      res.status(400).json({ 
        error: `الحد الأدنى لاستبدال النقاط هو ${loyaltySettings.minPointsToRedeem} نقطة (رصيدك الحالي: ${user.loyaltyPoints} نقطة)` 
      });
      return;
    }

    const requestedPoints = req.body.points ? parseInt(req.body.points) : user.loyaltyPoints;
    const pointsToConvert = Math.min(user.loyaltyPoints, Math.max(0, requestedPoints || 0));

    if (pointsToConvert < loyaltySettings.minPointsToRedeem) {
      res.status(400).json({ 
        error: `يجب استبدال ${loyaltySettings.minPointsToRedeem} نقطة كحد أدنى في العملية الواحدة` 
      });
      return;
    }

    // حساب المبلغ المضاف بدقة بالجنيه حسب نسبة الاستبدال المحددة في لوحة الإدارة
    const cashAdded = Math.round(pointsToConvert * loyaltySettings.pointsRedemptionRate * 100) / 100;

    const updatedUser = await prisma.$transaction(async (tx) => {
      // حسم ذري مشروط برصيد كافٍ لمنع التكرار بالتزامن واستنزاف النقاط بالسالب
      const claim = await tx.user.updateMany({
        where: { id: userId, loyaltyPoints: { gte: pointsToConvert } },
        data: {
          loyaltyPoints: { decrement: pointsToConvert },
          walletBalance: { increment: cashAdded },
        },
      });
      if (claim.count === 0) {
        throw new Error("رصيد نقاط الولاء غير كافٍ لإتمام عملية الاستبدال");
      }
      return await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          loyaltyPoints: true,
          walletBalance: true,
        },
      });
    });

    res.json({
      success: true,
      message: `تم تحويل ${pointsToConvert} نقطة ولاء بنجاح إلى ${cashAdded} ج.م في محفظتك! 🎉`,
      convertedPoints: pointsToConvert,
      cashAdded,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Convert points error:", error);
    res.status(500).json({ error: "فشل تحويل نقاط الولاء إلى المحفظة" });
  }
});

// 13. حذف حساب المستخدم وتفريغ بياناته الشخصية نهائياً
router.delete("/account", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: {
            status: {
              in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"],
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    // منع الحذف إذا كانت هناك طلبات جارية لم تكتمل بعد
    if (user.orders.length > 0) {
      res.status(400).json({ 
        error: "لا يمكنك حذف الحساب حالياً نظراً لوجود طلب قيد التنفيذ بالمطعم. يُرجى الانتظار حتى اكتمال واستلام طلبك أولاً." 
      });
      return;
    }

    // حذف العناوين المسجلة للمستخدم
    await prisma.userAddress.deleteMany({ where: { userId } });

    // فحص ما إذا كان للمستخدم أي طلبات مسجلة مسبقاً في النظام
    const totalOrdersCount = await prisma.order.count({ where: { userId } });

    if (totalOrdersCount === 0) {
      // إذا لم يكن له أي طلبات نهائياً، يتم حذفه بالكامل من قاعدة البيانات
      await prisma.user.delete({ where: { id: userId } });
    } else {
      // إذا كانت له طلبات سابقة، يتم طمس وتجهيل بياناته الشخصية للحفاظ على القيود المالية والمحاسبية للمطاعم
      await prisma.user.update({
        where: { id: userId },
        data: {
          name: "مستخدم محذوف",
          phone: `deleted_${Date.now()}_${userId.slice(0, 6)}`,
          password: "",
          isBlocked: true,
          walletBalance: 0,
          loyaltyPoints: 0,
          restaurantNotes: "تم حذف الحساب نهائياً بناءً على طلب العميل",
        },
      });
    }

    res.json({ success: true, message: "تم حذف حسابك وجميع بياناتك وعناوينك بنجاح." });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "فشل حذف الحساب، يرجى المحاولة لاحقاً" });
  }
});

// 14. إرسال بلاغ أو تذكرة دعم فني للوحة الإدارة
router.post("/support-ticket", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { category, subject, message, orderNumber } = req.body;

    if (!subject || !subject.trim() || !message || !message.trim()) {
      res.status(400).json({ error: "يرجى كتابة عنوان المشكلة وتفاصيل الرسالة بوضوح" });
      return;
    }

    // إذا كانت الشكوى متعلقة بطلب سابق أو بالدفع، فاختيار الطلب إجباري
    if ((category === "ORDER_ISSUE" || category === "PAYMENT_ISSUE") && (!orderNumber || !String(orderNumber).trim())) {
      res.status(400).json({ error: "يرجى تحديد أو كتابة رقم الطلب المعني بهذه المشكلة لمتابعتها والتحقق منها (إجباري)" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true },
    });

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const categoryLabels: Record<string, string> = {
      ORDER_ISSUE: "مشكلة في طلب سابق",
      PAYMENT_ISSUE: "مشكلة في الدفع أو المحفظة",
      TECH_ISSUE: "مشكلة تقنية في التطبيق",
      SUGGESTION: "اقتراح أو فكرة تطوير",
      GENERAL: "استفسار عام أو مساعدة",
    };

    let branchId: string | undefined = undefined;
    let branchName: string | undefined = undefined;
    let orderTotal: number | undefined = undefined;
    let orderStatus: string | undefined = undefined;
    let orderCreatedAt: string | undefined = undefined;

    if (orderNumber) {
      const cleanNum = String(orderNumber).replace('#', '').trim();
      const parsedNum = parseInt(cleanNum, 10);
      try {
        const matchedOrder = await prisma.order.findFirst({
          where: !isNaN(parsedNum)
            ? { OR: [{ orderNumber: parsedNum }, { id: cleanNum }] }
            : { id: cleanNum },
          include: {
            branch: { select: { id: true, name: true } },
          },
        });
        if (matchedOrder) {
          branchId = matchedOrder.branchId;
          branchName = matchedOrder.branch?.name;
          orderTotal = matchedOrder.total;
          orderStatus = matchedOrder.status;
          orderCreatedAt = matchedOrder.createdAt.toISOString();
        }
      } catch (_e) {
        // Continue without blocking ticket creation
      }
    }

    const ticketData = {
      id: ticketId,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      category: category || "GENERAL",
      categoryLabel: categoryLabels[category] || "استفسار عام",
      subject: subject.trim(),
      message: message.trim(),
      orderNumber: orderNumber ? String(orderNumber).trim() : undefined,
      orderTotal,
      orderStatus,
      orderCreatedAt,
      branchId,
      branchName,
      status: "OPEN", // "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED"
      adminNotes: "",
      branchNotes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await prisma.systemSetting.upsert({
      where: { key: `support_ticket_${ticketId}` },
      update: { value: JSON.stringify(ticketData) },
      create: {
        key: `support_ticket_${ticketId}`,
        value: JSON.stringify(ticketData),
      },
    });

    // إشعار فوري لجميع الواجهات المتصلة (الأدمن، المطعم، والعميل)
    notifySupportTicketCreated(ticketData);

    res.json({
      success: true,
      message: "تم إرسال بلاغك لإدارة المنظومة بنجاح، وسيتم مراجعته والتواصل معك قريباً.",
      ticket: ticketData,
    });
  } catch (error) {
    console.error("Submit support ticket error:", error);
    res.status(500).json({ error: "فشل إرسال رسالة الدعم" });
  }
});

// 14.5 استعلام شكاوى وبلاغات العميل الحالية وحالتها اللحظية
router.get("/support-tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "support_ticket_" } },
      orderBy: { createdAt: "desc" },
    });

    const userTickets = settings
      .map((s) => {
        try {
          return JSON.parse(s.value);
        } catch {
          return null;
        }
      })
      .filter((t: any) => t && t.userId === userId);

    res.json({ success: true, tickets: userTickets });
  } catch (error) {
    console.error("Get customer support tickets error:", error);
    res.status(500).json({ error: "فشل استرجاع سجل الشكاوى" });
  }
});

export default router;
