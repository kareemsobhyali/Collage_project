import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { setDriverBranchConfig } from "./driver.service.js";

export async function seedMockDatabase() {
  console.log("🌱 بدء حقن البيانات التجريبية الشاملة والموسعة (مع عروض الأب سيل والأقسام المتنوعة)...");

  const commonPassword = await bcrypt.hash("123", 10);

  // 1. حساب مدير المنظومة (SuperAdmin)
  try {
    const admin = await prisma.user.findFirst({
      where: {
        OR: [{ phone: "admin" }, { role: "SUPERADMIN" }],
      },
    });

    if (admin) {
      await prisma.user.update({
        where: { id: admin.id },
        data: {
          name: "مدير المنظومة (Admin)",
          phone: "admin",
          password: commonPassword,
          role: "SUPERADMIN",
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: "مدير المنظومة (Admin)",
          phone: "admin",
          password: commonPassword,
          role: "SUPERADMIN",
        },
      });
    }
  } catch (errAdmin) {
    console.warn("[Seed] Warning updating SuperAdmin account:", errAdmin);
  }

  // 2. إنشاء / تحديث الفروع الأربعة
  async function upsertBranch(slug: string, branchData: any) {
    let existing = await prisma.branch.findFirst({
      where: {
        OR: [
          { slug },
          { name: { contains: branchData.name.replace(/[^ء-يa-zA-Z0-9]/g, "").trim() } },
        ],
      },
    });

    if (existing) {
      return await prisma.branch.update({
        where: { id: existing.id },
        data: { ...branchData, slug },
      });
    } else {
      return await prisma.branch.create({
        data: { ...branchData, slug },
      });
    }
  }

  // أ) مطعم 1: برجر فاكتوري
  const burgerBranch = await upsertBranch("burger-campus", {
    name: "برجر فاكتوري 🍔",
    phone: "01011112222",
    logoUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
    address: "مجمع الخدمات - أمام بوابة كلية التجارة",
    isActive: true,
    operationalStatus: "OPEN",
    openingTime: "09:00",
    closingTime: "23:00",
    allowDelivery: true,
    allowPickup: true,
    deliveryFee: 12.0,
    deliveryType: "ZONES",
  });

  try {
    const bUser = await prisma.branchUser.findUnique({ where: { username: "burger_pos" } });
    if (bUser) {
      await prisma.branchUser.update({
        where: { id: bUser.id },
        data: { password: commonPassword, branchId: burgerBranch.id },
      });
    } else {
      await prisma.branchUser.create({
        data: { username: "burger_pos", password: commonPassword, branchId: burgerBranch.id },
      });
    }
  } catch (_e) {}

  try {
    await prisma.branchPaymentConfig.upsert({
      where: { branchId: burgerBranch.id },
      update: {
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01011112222",
        instapayEnabled: true,
        instapayHandle: "burgerfactory@instapay",
        cardEnabled: true,
      },
      create: {
        branchId: burgerBranch.id,
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01011112222",
        instapayEnabled: true,
        instapayHandle: "burgerfactory@instapay",
        cardEnabled: true,
      },
    });
  } catch (_e) {}

  try {
    await prisma.branchDeliveryZone.deleteMany({ where: { branchId: burgerBranch.id } });
    await prisma.branchDeliveryZone.createMany({
      data: [
        { branchId: burgerBranch.id, name: "كليات الهندسة والعلوم والحاسبات", fee: 10.0 },
        { branchId: burgerBranch.id, name: "المنطقة السكنية والملاعب", fee: 15.0 },
        { branchId: burgerBranch.id, name: "المبنى الإداري والعيادات المركزية", fee: 12.0 },
      ],
    });
  } catch (_e) {}

  // ب) مطعم 2: شاورما ومشويات الحرم
  const shawarmaBranch = await upsertBranch("shawarma-campus", {
    name: "شاورما ومشويات الأصيل 🌯",
    phone: "01033334444",
    logoUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&q=80",
    address: "مول مجمع الكليات الطبية - الدور الأرضي",
    isActive: true,
    operationalStatus: "OPEN",
    openingTime: "11:00",
    closingTime: "03:00",
    allowDelivery: true,
    allowPickup: true,
    deliveryFee: 10.0,
    deliveryType: "FIXED",
  });

  try {
    const sUser = await prisma.branchUser.findUnique({ where: { username: "shawarma_pos" } });
    if (sUser) {
      await prisma.branchUser.update({
        where: { id: sUser.id },
        data: { password: commonPassword, branchId: shawarmaBranch.id },
      });
    } else {
      await prisma.branchUser.create({
        data: { username: "shawarma_pos", password: commonPassword, branchId: shawarmaBranch.id },
      });
    }
  } catch (_e) {}

  try {
    await prisma.branchPaymentConfig.upsert({
      where: { branchId: shawarmaBranch.id },
      update: {
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01033334444",
        instapayEnabled: true,
        instapayHandle: "shawarmacampus@instapay",
        cardEnabled: false,
      },
      create: {
        branchId: shawarmaBranch.id,
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01033334444",
        instapayEnabled: true,
        instapayHandle: "shawarmacampus@instapay",
        cardEnabled: false,
      },
    });
  } catch (_e) {}

  // ج) مطعم 3: سبيشيالتي كافيه & بيكري
  const cafeBranch = await upsertBranch("specialty-cafe", {
    name: "سبيشيالتي كافيه & بيكري ☕",
    phone: "01055556666",
    logoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&q=80",
    address: "الحديقة المركزية - بجوار المكتبة العامة",
    isActive: true,
    operationalStatus: "OPEN",
    openingTime: "08:00",
    closingTime: "22:00",
    allowDelivery: true,
    allowPickup: true,
    deliveryFee: 8.0,
    deliveryType: "FIXED",
  });

  try {
    const cUser = await prisma.branchUser.findUnique({ where: { username: "cafe_pos" } });
    if (cUser) {
      await prisma.branchUser.update({
        where: { id: cUser.id },
        data: { password: commonPassword, branchId: cafeBranch.id },
      });
    } else {
      await prisma.branchUser.create({
        data: { username: "cafe_pos", password: commonPassword, branchId: cafeBranch.id },
      });
    }
  } catch (_e) {}

  try {
    await prisma.branchPaymentConfig.upsert({
      where: { branchId: cafeBranch.id },
      update: {
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01055556666",
        instapayEnabled: true,
        instapayHandle: "campuscafe@instapay",
        cardEnabled: true,
      },
      create: {
        branchId: cafeBranch.id,
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01055556666",
        instapayEnabled: true,
        instapayHandle: "campuscafe@instapay",
        cardEnabled: true,
      },
    });
  } catch (_e) {}

  // د) مطعم 4: رويال بيتزا وكريب
  const pizzaBranch = await upsertBranch("royal-pizza", {
    name: "رويال بيتزا & كريب 🍕",
    phone: "01077778888",
    logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80",
    address: "شارع النصر - البوابة الشرقية",
    isActive: true,
    operationalStatus: "OPEN",
    openingTime: "10:00",
    closingTime: "00:00",
    allowDelivery: true,
    allowPickup: true,
    deliveryFee: 15.0,
    deliveryType: "FIXED",
  });

  try {
    const pUser = await prisma.branchUser.findUnique({ where: { username: "pizza_pos" } });
    if (pUser) {
      await prisma.branchUser.update({
        where: { id: pUser.id },
        data: { password: commonPassword, branchId: pizzaBranch.id },
      });
    } else {
      await prisma.branchUser.create({
        data: { username: "pizza_pos", password: commonPassword, branchId: pizzaBranch.id },
      });
    }
  } catch (_e) {}

  try {
    await prisma.branchPaymentConfig.upsert({
      where: { branchId: pizzaBranch.id },
      update: {
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01077778888",
        instapayEnabled: true,
        instapayHandle: "royalpizza@instapay",
        cardEnabled: true,
      },
      create: {
        branchId: pizzaBranch.id,
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01077778888",
        instapayEnabled: true,
        instapayHandle: "royalpizza@instapay",
        cardEnabled: true,
      },
    });
  } catch (_e) {}

  // 3. تنظيف وتجديد قوائم الطعام لهذه الفروع الأربعة
  const allBranchIds = [burgerBranch.id, shawarmaBranch.id, cafeBranch.id, pizzaBranch.id];

  try {
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
  } catch (eOrders) {
    console.warn("[Seed] Warning cleaning orders:", eOrders);
  }

  try {
    await prisma.itemModifierGroupLink.deleteMany({});
    await prisma.modifierOption.deleteMany({});
    await prisma.modifierGroup.deleteMany({ where: { branchId: { in: allBranchIds } } });
    await prisma.itemSize.deleteMany({});
    await prisma.menuItem.deleteMany({ where: { branchId: { in: allBranchIds } } });
    await prisma.menuCategory.deleteMany({ where: { branchId: { in: allBranchIds } } });
  } catch (eMenu) {
    console.warn("[Seed] Warning cleaning existing menu items:", eMenu);
  }

  // ==========================================
  // مطعم 1: برجر فاكتوري 🍔 (Burger Factory)
  // ==========================================
  const burgerCatBeef = await prisma.menuCategory.create({
    data: { branchId: burgerBranch.id, name: "سندوتشات البرجر البقري المشوي", displayOrder: 1 },
  });
  const burgerCatChicken = await prisma.menuCategory.create({
    data: { branchId: burgerBranch.id, name: "سندوتشات الدجاج الكرسبي المقرمش", displayOrder: 2 },
  });
  const burgerCatSides = await prisma.menuCategory.create({
    data: { branchId: burgerBranch.id, name: "المقبلات والبطاطس الساخنة", displayOrder: 3 },
  });
  const burgerCatDrinks = await prisma.menuCategory.create({
    data: { branchId: burgerBranch.id, name: "المشروبات والميلك شيك المنعش", displayOrder: 4 },
  });

  // مجموعات الإضافات الاختيارية للبرجر
  const burgerModCheeseSauces = await prisma.modifierGroup.create({
    data: {
      branchId: burgerBranch.id,
      title: "إضافات الجبن والصوصات الخاصة",
      isRequired: false,
      minSelection: 0,
      maxSelection: 3,
      options: {
        create: [
          { name: "شريحة جبنة شيدر إكسترا", price: 15.0 },
          { name: "صوص جبنة شيدر سايحة", price: 20.0 },
          { name: "صوص باربكيو مدخن", price: 10.0 },
          { name: "شرائح هالبينو حار", price: 10.0 },
          { name: "بيكون بقري مقرمش", price: 25.0 },
        ],
      },
    },
  });

  // عروض الأب سيل / Upsells للبرجر (Combo Offers)
  const burgerUpsellCombos = JSON.stringify([
    {
      id: "burger-combo-fries-drink",
      title: "ترقية لكومبو بطاطس فريش + كانز بيبسي مثلج 🍟🥤",
      description: "وفر 20 ج.م مع العرض المفضل",
      price: 30.0,
      badge: "وفر 20 ج.م 🔥",
    },
    {
      id: "burger-combo-mozz-sticks",
      title: "أصابع جبنة موتزاريلا مقلية (3 قطع) 🧀",
      description: "مقرمشة وسايحة مع صوص مارينارا إيطالي",
      price: 35.0,
      badge: "إضافة الشيف ⭐",
    },
    {
      id: "burger-combo-cookie",
      title: "كوكيز كيندر ونيوتيلا ساخنة تحلية 🍪",
      description: "تحلية لقطة بعد البرجر بخصم خاص",
      price: 25.0,
      badge: "تحلية مميزة 🍰",
    },
  ]);

  // الأصناف
  const doubleCheeseBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatBeef.id,
      name: "دبل تشيز برجر فاخر 🍔",
      description: "قطعتين لحم أنجوس بلدي مشوي ع اللهب، دبل جبنة شيدر سايحة، خس وطماطم وخيار مخلل وصوص فاكتوري السري",
      basePrice: 110.0,
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
      comboItems: burgerUpsellCombos,
      sizes: {
        create: [
          { name: "سنجل (قطعة واحدة 150جم)", price: 85.0 },
          { name: "دبل (قطعتين 300جم - موصى به)", price: 110.0 },
          { name: "تريبل وحش (3 قطع 450جم)", price: 145.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: burgerModCheeseSauces.id }] },
    },
  });

  const mushroomSwissBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatBeef.id,
      name: "ماشروم بيف آند سويس برجر 🍄",
      description: "برجر بقري مشوي ومغطى بطبقة سخية من المشروم الفريش المشوح بالزبدة وجبنة سويسرية ذائبة",
      basePrice: 125.0,
      imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80",
      comboItems: burgerUpsellCombos,
      sizes: {
        create: [
          { name: "سنجل عادي", price: 100.0 },
          { name: "دبل لحم ومشروم إكسترا", price: 135.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: burgerModCheeseSauces.id }] },
    },
  });

  const smokyBbqBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatBeef.id,
      name: "سموكي بيكون باربكيو برجر 🥓",
      description: "لحم بقري مدخن، شرائح بيكون بقري مقرمش، حلقات بصل ذهبية مقرمشة، وصوص باربكيو غني",
      basePrice: 130.0,
      imageUrl: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&q=80",
      comboItems: burgerUpsellCombos,
      sizes: {
        create: [
          { name: "عادي", price: 130.0 },
          { name: "دبل بيكون وجبنة", price: 165.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: burgerModCheeseSauces.id }] },
    },
  });

  const crispyChickenBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatChicken.id,
      name: "كرسبي تشيكن سوبر باربكيو 🍗",
      description: "صدر دجاج متبل ومقلي مقرمش ذهبي، صوص باربكيو مدخن، سلطة كول سلو وخيار مخلل",
      basePrice: 95.0,
      imageUrl: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&q=80",
      comboItems: burgerUpsellCombos,
      sizes: {
        create: [
          { name: "عادي كرسبي", price: 95.0 },
          { name: "سوبر لارج حار وسبايسي", price: 120.0 },
        ],
      },
    },
  });

  const zingerFireBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatChicken.id,
      name: "دجاج زنجر فاير سبايسي 🔥",
      description: "قطعة صدر دجاج سبايسي كرانشي مغطاة بصوص الشطة الحارة، هالبينو وجبنة شيدر",
      basePrice: 105.0,
      imageUrl: "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=600&q=80",
      comboItems: burgerUpsellCombos,
      sizes: {
        create: [
          { name: "عادي سبايسي", price: 105.0 },
          { name: "دبل تشيكن فاير", price: 140.0 },
        ],
      },
    },
  });

  const loadedFries = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatSides.id,
      name: "تشيزي فرايز بالهالبينو 🍟",
      description: "بطاطس مقلية مقرمشة مغطاة بصوص الجبنة الشيدر الساخن وشرائح الهالبينو ورشة بيكون",
      basePrice: 55.0,
      imageUrl: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&q=80",
    },
  });

  const mozzarellaSticks = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatSides.id,
      name: "أصابع موزاريلا مقلية ذهبية (5 قطع) 🧀",
      description: "أصابع جبنة موتزاريلا طبيعية مقرمشة من الخارج وسايحة ومطاطية من الداخل",
      basePrice: 50.0,
      imageUrl: "https://images.unsplash.com/photo-1548340742-b831a47d7f66?w=600&q=80",
    },
  });

  const lotusMilkshake = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatDrinks.id,
      name: "ميلك شيك لوتس كراميل مثلج 🥤",
      description: "آيس كريم فانيليا مخفوق مع بسكويت لوتس بيسكوف وصوص كراميل ذهبي وكريمة مخفوقة",
      basePrice: 50.0,
      imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80",
    },
  });

  const coldPepsiCan = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCatDrinks.id,
      name: "كانز بيبسي مثلج 330 مل 🥤",
      description: "مشروب غازي بارد ومنعش",
      basePrice: 18.0,
      imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80",
    },
  });

  // ==========================================
  // مطعم 2: شاورما ومشويات الأصيل 🌯 (Shawarma & Grill)
  // ==========================================
  const shawarmaCatChicken = await prisma.menuCategory.create({
    data: { branchId: shawarmaBranch.id, name: "شاورما دجاج سوري صاج", displayOrder: 1 },
  });
  const shawarmaCatBeef = await prisma.menuCategory.create({
    data: { branchId: shawarmaBranch.id, name: "شاورما لحمة بلدي مصري وسوري", displayOrder: 2 },
  });
  const shawarmaCatFatta = await prisma.menuCategory.create({
    data: { branchId: shawarmaBranch.id, name: "فتات الشاورما ووجبات عربي", displayOrder: 3 },
  });
  const shawarmaCatSides = await prisma.menuCategory.create({
    data: { branchId: shawarmaBranch.id, name: "المقبلات الشامية والسلطات", displayOrder: 4 },
  });

  const shawarmaModGroup = await prisma.modifierGroup.create({
    data: {
      branchId: shawarmaBranch.id,
      title: "إضافات الشاورما والصوصات",
      isRequired: false,
      minSelection: 0,
      maxSelection: 3,
      options: {
        create: [
          { name: "ثومية إضافية", price: 8.0 },
          { name: "ثومية حارة سبايسي", price: 10.0 },
          { name: "جبنة موزاريلا سايحة ع الصاج", price: 15.0 },
          { name: "دبس رمان طبيعي", price: 10.0 },
          { name: "مخلل خيار سوري مقرمش", price: 5.0 },
        ],
      },
    },
  });

  // عروض الأب سيل / Upsells للشاورما (Combo Offers)
  const shawarmaUpsellCombos = JSON.stringify([
    {
      id: "shawarma-combo-fries-thomeya",
      title: "طبق بطاطس سوري محمرة + علبة ثومية لارج 🍟🧄",
      description: "وفر 15 ج.م مع العرض المكمل للشاورما",
      price: 25.0,
      badge: "الأكثر طلباً ⭐",
    },
    {
      id: "shawarma-combo-cola",
      title: "كانز بيبسي مثلج مشبر 🥤",
      description: "يكمل طعم الشاورما الأصلي السخن",
      price: 15.0,
      badge: "عرض وجبة 🥤",
    },
    {
      id: "shawarma-combo-sambousek",
      title: "سمبوسك جبنة كيري ونعناع (3 قطع) 🥟",
      description: "سمبوسك مقرمشة طازجة ومحشوة جبنة كيري",
      price: 25.0,
      badge: "سناك إضافي 🔥",
    },
  ]);

  const chickenShawarmaSyrian = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatChicken.id,
      name: "ساندوتش شاورما دجاج سوري صاج 🌯",
      description: "قطع صدور دجاج متبلة ومحمرة ع السيخ مع الثومية والخيار المخلل في خبز الصاج السوري المقرمش ع الجريل",
      basePrice: 60.0,
      imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&q=80",
      comboItems: shawarmaUpsellCombos,
      sizes: {
        create: [
          { name: "لارج كبير (خبز صاج 25سم)", price: 60.0 },
          { name: "إكسترا صاروخ عملاق (خبز صاج 35سم)", price: 85.0 },
          { name: "وجبة عربي مقطعة مع بطاطس وثومية ومخلل", price: 110.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: shawarmaModGroup.id }] },
    },
  });

  const chickenShawarmaCheese = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatChicken.id,
      name: "شاورما دجاج بالجبنة الموتزاريلا السايحة 🧀",
      description: "ساندوتش شاورما دجاج غرقان جبنة موتزاريلا وشيدر سايحة على الجريل",
      basePrice: 75.0,
      imageUrl: "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=600&q=80",
      comboItems: shawarmaUpsellCombos,
      sizes: {
        create: [
          { name: "لارج وسط", price: 75.0 },
          { name: "صاروخ دبل جبنة", price: 105.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: shawarmaModGroup.id }] },
    },
  });

  const beefShawarmaEgyptian = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatBeef.id,
      name: "ساندوتش شاورما لحمة كايزر بلدي 🥩",
      description: "شاورما لحمة بقري بلدي متبلة بالخل والبهارات والبقدونس والطماطم وسلطة الطحينة الحبيبة في عيش كايزر هش",
      basePrice: 70.0,
      imageUrl: "https://images.unsplash.com/photo-1633321702518-7feccafb94d5?w=600&q=80",
      comboItems: shawarmaUpsellCombos,
      sizes: {
        create: [
          { name: "سنجل كايزر", price: 70.0 },
          { name: "طلب دبل (2 ساندوتش كايزر)", price: 130.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: shawarmaModGroup.id }] },
    },
  });

  const beefShawarmaSyrian = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatBeef.id,
      name: "شاورما لحمة سوري صاج بدبس الرمان 🌯",
      description: "شاورما لحم بقري شرائح رفيعة مع دبس الرمان الأصلي والطحينة والبصل المشوي بالصاج السوري",
      basePrice: 85.0,
      imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&q=80",
      comboItems: shawarmaUpsellCombos,
      sizes: {
        create: [
          { name: "لارج صاج", price: 85.0 },
          { name: "صاروخ عائلي", price: 115.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: shawarmaModGroup.id }] },
    },
  });

  const fattaMixShawarma = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatFatta.id,
      name: "فتة شاورما ميكس (دجاج + لحمة) 🍲",
      description: "أرز بسمتي أصفر مبهر، عيش شامي مقرمش، ميكس شاورما دجاج ولحمة، مع صوص الثومية الخاص ورشة بقدونس",
      basePrice: 125.0,
      imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
      comboItems: shawarmaUpsellCombos,
      sizes: {
        create: [
          { name: "طبق فردي مشبع", price: 125.0 },
          { name: "طبق سوبر عائلي كبير", price: 175.0 },
        ],
      },
    },
  });

  const fattaChickenShawarma = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatFatta.id,
      name: "فتة شاورما دجاج سوري بالثومية 🍲",
      description: "أرز بسمتي مفلفل بالزعفران، عيش شامي مقلي، شرائح شاورما دجاج متبلة، وثومية سورية غنية",
      basePrice: 105.0,
      imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80",
      comboItems: shawarmaUpsellCombos,
    },
  });

  const syrianFriesPlate = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatSides.id,
      name: "طبق بطاطس سوري متبل بالبهارات 🍟",
      description: "بطاطس صوابع مقلية ذهبية مقرمشة ببهارات الشاورما الشامية ورشة زعتر",
      basePrice: 35.0,
      imageUrl: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&q=80",
    },
  });

  const coleslawShawarma = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCatSides.id,
      name: "سلطة كول سلو طازجة 🥗",
      description: "كرنب وجزر مبشور في صوص مايونيز وعسل كريمي حلو",
      basePrice: 25.0,
      imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80",
    },
  });

  // ==========================================
  // مطعم 3: سبيشيالتي كافيه & بيكري ☕ (Specialty Cafe & Bakery)
  // ==========================================
  const cafeCatHot = await prisma.menuCategory.create({
    data: { branchId: cafeBranch.id, name: "القهوة والمشروبات الساخنة", displayOrder: 1 },
  });
  const cafeCatCold = await prisma.menuCategory.create({
    data: { branchId: cafeBranch.id, name: "المشروبات الباردة والمنعشة", displayOrder: 2 },
  });
  const cafeCatBakery = await prisma.menuCategory.create({
    data: { branchId: cafeBranch.id, name: "المخبوزات والكرواسون الفريش", displayOrder: 3 },
  });
  const cafeCatDesserts = await prisma.menuCategory.create({
    data: { branchId: cafeBranch.id, name: "الحلويات والكوكيز والتشيز كيك", displayOrder: 4 },
  });

  const cafeCoffeeModifiers = await prisma.modifierGroup.create({
    data: {
      branchId: cafeBranch.id,
      title: "تخصيص القهوة والحليب",
      isRequired: false,
      minSelection: 0,
      maxSelection: 2,
      options: {
        create: [
          { name: "شوت إسبريسو كولومبي إضافي", price: 15.0 },
          { name: "حليب لوز / حليب شوفان نباتي", price: 20.0 },
          { name: "سيرب فانيليا فرنسي", price: 10.0 },
          { name: "سيرب كراميل خالي من السكر", price: 10.0 },
        ],
      },
    },
  });

  // عروض الأب سيل / Upsells للكافيه (Combo Offers)
  const cafeUpsellCombos = JSON.stringify([
    {
      id: "cafe-combo-cookie",
      title: "كوكيز شوكولاتة بلجيكية دافئة 🍪",
      description: "وفر 10 ج.م مع كوب القهوة للمذاكرة",
      price: 20.0,
      badge: "عرض الصباح ☕",
    },
    {
      id: "cafe-combo-extra-shot",
      title: "شوت إسبريسو كولومبي دبل إضافي ⚡",
      description: "لزيادة التركيز والطاقة قبل المحاضرات",
      price: 15.0,
      badge: "تركيز إضافي 🧠",
    },
    {
      id: "cafe-combo-butter-croissant",
      title: "كرواسون زبدة فرنسي سادة ساخن 🥐",
      description: "مخبوز طازج يذوب في الفم مع القهوة",
      price: 25.0,
      badge: "فطار خفيف ✨",
    },
  ]);

  const cappuccinoClassic = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatHot.id,
      name: "كابتشينو إيطالي كلاسيك ☕",
      description: "إسبريسو غني متوازن مع ثلث حليب مبخر وثلث رغوة مخملية كريمية مع رشة كاكاو",
      basePrice: 48.0,
      imageUrl: "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&q=80",
      comboItems: cafeUpsellCombos,
      sizes: {
        create: [
          { name: "وسط (Regular 10oz)", price: 48.0 },
          { name: "كبير (Large 14oz)", price: 62.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: cafeCoffeeModifiers.id }] },
    },
  });

  const flatWhite = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatHot.id,
      name: "فلات وايت أسترالي ميكروفوم ☕",
      description: "دبل ريستريتو مركز مع طبقة ميكروفوم حريرية رقيقة لنكهة قهوة قوية ومخملية",
      basePrice: 52.0,
      imageUrl: "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=600&q=80",
      comboItems: cafeUpsellCombos,
      modifierGroupLinks: { create: [{ groupId: cafeCoffeeModifiers.id }] },
    },
  });

  const hotSpanishLatte = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatHot.id,
      name: "سبانش لاتيه ساخن بالحليب المكثف ☕",
      description: "مزيج متناغم يجمع بين مرارة الإسبريسو وحلاوة الحليب المكثف المحلى بالدفء",
      basePrice: 55.0,
      imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80",
      comboItems: cafeUpsellCombos,
      sizes: {
        create: [
          { name: "وسط (Regular)", price: 55.0 },
          { name: "كبير (Large)", price: 70.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: cafeCoffeeModifiers.id }] },
    },
  });

  const spanishLatte = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatCold.id,
      name: "آيسد سبانش لاتيه 🧊☕",
      description: "إسبريسو غني، حليب مكثف ومبخر مع مكعبات الثلج لنشاط يدوم طوال اليوم الدراسي",
      basePrice: 55.0,
      imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80",
      comboItems: cafeUpsellCombos,
      sizes: {
        create: [
          { name: "وسط (Regular 12oz)", price: 55.0 },
          { name: "كبير (Large 16oz)", price: 70.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: cafeCoffeeModifiers.id }] },
    },
  });

  const icedCaramelMacchiato = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatCold.id,
      name: "آيسد كراميل ماكياتو 🧊",
      description: "حليب مثلج مع نكهة الفانيليا، طبقة إسبريسو كولومبي في الأعلى مع خطوط صوص كراميل ذهبي",
      basePrice: 60.0,
      imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80",
      comboItems: cafeUpsellCombos,
      sizes: {
        create: [
          { name: "وسط", price: 60.0 },
          { name: "كبير سوبر", price: 75.0 },
        ],
      },
    },
  });

  const blueMojito = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatCold.id,
      name: "موهيتو توت أزرق ونعناع منعش 🫐🍋",
      description: "صودا مثلجة مع سيرب التوت الأزرق، شرائح الليمون وأوراق النعناع الفريش المنعشة",
      basePrice: 45.0,
      imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80",
    },
  });

  const chocolateCroissant = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatBakery.id,
      name: "كرواسون شوكولاتة بلجيكي فريش 🥐",
      description: "كرواسون فرنسي هش مخبوز طازج يومياً ومحشو بشوكولاتة بلجيكية فاخرة",
      basePrice: 40.0,
      imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80",
      comboItems: cafeUpsellCombos,
    },
  });

  const cheesePastramiCroissant = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatBakery.id,
      name: "كرواسون جبنة رومي وبسطرمة مدخنة 🥐",
      description: "كرواسون بالزبدة ساخن محشو بجبنة رومي قديمة وقطع بسطرمة مدخنة وجبنة شيدر",
      basePrice: 48.0,
      imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&q=80",
    },
  });

  const sanSebastianCheesecake = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatDesserts.id,
      name: "سان سيباستيان تشيز كيك مع شوكولاتة بلجيكي 🍰",
      description: "تشيز كيك إسباني محروق كريمي وناعم جداً يُسكب عليه صوص شوكولاتة بلجيكي ساخن عند الطلب",
      basePrice: 75.0,
      imageUrl: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80",
    },
  });

  const kinderNutellaCookie = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCatDesserts.id,
      name: "كوكيز كيندر ونيوتيلا ساخنة محشوة 🍪",
      description: "كوكيز شوكولاتة ناعمة وطرية محشوة بحبوب الشوكولاتة وشوكولاتة كيندر بوينو ونيوتيلا سايحة",
      basePrice: 35.0,
      imageUrl: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=80",
    },
  });

  // ==========================================
  // مطعم 4: رويال بيتزا & كريب 🍕 (Royal Pizza & Crepe)
  // ==========================================
  const pizzaCatItalian = await prisma.menuCategory.create({
    data: { branchId: pizzaBranch.id, name: "البيتزا الإيطالية الفاخرة", displayOrder: 1 },
  });
  const pizzaCatSavoryCrepe = await prisma.menuCategory.create({
    data: { branchId: pizzaBranch.id, name: "الكريب الحادق والمقرمش", displayOrder: 2 },
  });
  const pizzaCatSweetCrepe = await prisma.menuCategory.create({
    data: { branchId: pizzaBranch.id, name: "الكريب الحلو والوافل", displayOrder: 3 },
  });
  const pizzaCatSidesDrinks = await prisma.menuCategory.create({
    data: { branchId: pizzaBranch.id, name: "المقبلات والمشروبات العائلية", displayOrder: 4 },
  });

  const pizzaModifiers = await prisma.modifierGroup.create({
    data: {
      branchId: pizzaBranch.id,
      title: "إضافات وأطراف البيتزا",
      isRequired: false,
      minSelection: 0,
      maxSelection: 3,
      options: {
        create: [
          { name: "أطراف محشوة جبنة موزاريلا (Stuffed Crust)", price: 35.0 },
          { name: "إكسترا جبنة موتزاريلا طبيعية", price: 25.0 },
          { name: "مشروم طازج إضافي", price: 15.0 },
          { name: "شرائح هالبينو سبايسي", price: 10.0 },
          { name: "صوص رانش إكسترا", price: 10.0 },
        ],
      },
    },
  });

  // عروض الأب سيل / Upsells للبيتزا (Combo Offers)
  const pizzaUpsellCombos = JSON.stringify([
    {
      id: "pizza-combo-garlic-bread",
      title: "خبز بالثوم والجبنة الموتزاريلا (4 قطع) 🥖🧀",
      description: "وفر 15 ج.م مع كل أوردر بيتزا عائلي",
      price: 35.0,
      badge: "عرض التوفير 🔥",
    },
    {
      id: "pizza-combo-sweet-crepe",
      title: "ميني كريب نيوتيلا بالموز تحلية 🍫🍌",
      description: "حلي قعدتك بعد البيتزا بنصف السعر",
      price: 40.0,
      badge: "حلو الكومبو 🍰",
    },
    {
      id: "pizza-combo-pepsi-family",
      title: "لتر بيبسي عائلي مثلج 🥤",
      description: "يكفي 3-4 أفراد مع لِمة الأكل",
      price: 30.0,
      badge: "للمجموعات ⭐",
    },
  ]);

  const ranchPizza = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatItalian.id,
      name: "بيتزا تشيكن رانش سوبريم 🍕",
      description: "قطع صدور دجاج مشوية، فلفل ألوان، زيتون، صوص الرانش الغني، وجبنة موزاريلا طبيعية 100%",
      basePrice: 135.0,
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
      comboItems: pizzaUpsellCombos,
      sizes: {
        create: [
          { name: "وسط (Medium 28سم)", price: 135.0 },
          { name: "كبير (Large 33سم)", price: 185.0 },
          { name: "كبير أطراف جبنة (Stuffed Crust)", price: 220.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: pizzaModifiers.id }] },
    },
  });

  const meatLoversPizza = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatItalian.id,
      name: "بيتزا ميكس لحوم وجبن رويال 🥩🧀",
      description: "بيبروني بقري، سوسيس، لحم مفروم متبل، صلصة طماطم إيطالية مع ريحان وجبنة موزاريلا دبل",
      basePrice: 150.0,
      imageUrl: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=600&q=80",
      comboItems: pizzaUpsellCombos,
      sizes: {
        create: [
          { name: "وسط", price: 150.0 },
          { name: "كبير", price: 205.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: pizzaModifiers.id }] },
    },
  });

  const pepperoniPizza = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatItalian.id,
      name: "بيتزا بيبروني نيويورك كلاسيك 🍕",
      description: "شرائح بيبروني بقري مقرمشة مشوية على نار عالية، صلصة طماطم وجبنة موزاريلا إيطالية",
      basePrice: 125.0,
      imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
      comboItems: pizzaUpsellCombos,
      sizes: {
        create: [
          { name: "وسط", price: 125.0 },
          { name: "كبير", price: 175.0 },
        ],
      },
      modifierGroupLinks: { create: [{ groupId: pizzaModifiers.id }] },
    },
  });

  const margheritaPizza = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatItalian.id,
      name: "بيتزا مارجريتا نابولي الأصلية 🧀",
      description: "صلصة طماطم طازجة، جبنة موزاريلا طبيعية غنية، زيت زيتون بكر ممتاز وأوراق ريحان خضراء",
      basePrice: 95.0,
      imageUrl: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
      comboItems: pizzaUpsellCombos,
      sizes: {
        create: [
          { name: "وسط", price: 95.0 },
          { name: "كبير", price: 135.0 },
        ],
      },
    },
  });

  const zingerCrepe = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatSavoryCrepe.id,
      name: "كريب سوبر كرانشي زنجر حار 🌯",
      description: "قطع دجاج زنجر كرسبي مقرمش حار، بطاطس صوابع، ميكس جبن موزاريلا وشيدر ورومي، صوص مايونيز وكاتشب وباربكيو",
      basePrice: 75.0,
      imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80",
      comboItems: pizzaUpsellCombos,
    },
  });

  const shawarmaChickenCrepe = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatSavoryCrepe.id,
      name: "كريب شاورما دجاج وميكس جبن 🌯",
      description: "شاورما دجاج متبلة، زيتون، فلفل ألوان، جبنة موتزاريلا سايحة وصوص ثومية ومايونيز في عجينة كريب فرنسية مقرمشة",
      basePrice: 80.0,
      imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
      comboItems: pizzaUpsellCombos,
    },
  });

  const nutellaBananaCrepe = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatSweetCrepe.id,
      name: "كريب نيوتيلا بالموز والمكسرات 🍫🍌",
      description: "عجينة كريب فرنسية دافئة محشوة بكمية وفيرة من شوكولاتة نيوتيلا الأصلية، شرائح موز فريش، ومكسرات محمصة",
      basePrice: 65.0,
      imageUrl: "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=600&q=80",
    },
  });

  const lotusWhiteChocWaffle = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatSweetCrepe.id,
      name: "وافل بلجيكي لوتس وشوكولاتة بيضاء 🧇",
      description: "وافل بلجيكي مقرمش ذهبي مع زبدة لوتس بيسكوف، صوص شوكولاتة بلجيكية بيضاء وبسكويت لوتس مطحون",
      basePrice: 70.0,
      imageUrl: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&q=80",
    },
  });

  const cheesyGarlicBread = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatSidesDrinks.id,
      name: "خبز بالثوم والجبنة الموتزاريلا (4 قطع) 🥖🧀",
      description: "خبز فرنسي محمص بالزبدة والثوم والأعشاب ومغطى بطبقة سميكة من الجبنة الموتزاريلا الذائبة",
      basePrice: 45.0,
      imageUrl: "https://images.unsplash.com/photo-1619895092538-128341789043?w=600&q=80",
    },
  });

  const familyPepsiLiter = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCatSidesDrinks.id,
      name: "لتر بيبسي عائلي مثلج 1 لتر 🥤",
      description: "زجاجة بيبسي عائلية باردة تكفي لمة الأصحاب",
      basePrice: 35.0,
      imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80",
    },
  });

  // 4. البانرات التفاعلية
  try {
    await prisma.banner.deleteMany({});
    await prisma.banner.createMany({
      data: [
        {
          title: "عروض الكومبو الأقوى 🔥",
          subtitle: "خصم 20% على وجبات البرجر والكومبو المميزة من برجر فاكتوري",
          badgeText: "خصم حصري 🍔",
          imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
          linkUrl: `?branch=burger-campus&offer=${doubleCheeseBurger.id}`,
          displayOrder: 1,
          isActive: true,
        },
        {
          title: "شاورما وسناكس الأصيل 🌯",
          subtitle: "خدمة التوصيل مستمرة حتى الفجر لتصلك أينما كنت!",
          badgeText: "توصيل سريع ⚡",
          imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80",
          linkUrl: `?branch=shawarma-campus&offer=${chickenShawarmaSyrian.id}`,
          displayOrder: 2,
          isActive: true,
        },
        {
          title: "قهوة الصباح والمحاضرات ☕",
          subtitle: "ابدأ يومك بنشاط مع أفضل قهوة مختصة وكرواسون فرنسي طازج",
          badgeText: "كافيه متميز ✨",
          imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
          linkUrl: `?branch=specialty-cafe&offer=${spanishLatte.id}`,
          displayOrder: 3,
          isActive: true,
        },
        {
          title: "بيتزا تشيكن رانش العائلية 🍕",
          subtitle: "اطلب الآن مع أصحابك واستمتع بأشهى بيتزا وكريب مع عروض التوفير",
          badgeText: "الأكثر طلباً ⭐",
          imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
          linkUrl: `?branch=royal-pizza&offer=${ranchPizza.id}`,
          displayOrder: 4,
          isActive: true,
        },
      ],
    });
  } catch (eBanners) {
    console.warn("[Seed] Warning creating banners:", eBanners);
  }

  // 5. كوبونات الخصم العامة والخاصة (تحديث أو إنشاء آمن)
  async function upsertPromo(promoData: any) {
    const existing = await prisma.promoCode.findUnique({ where: { code: promoData.code } });
    if (existing) {
      await prisma.promoCode.update({ where: { id: existing.id }, data: promoData });
    } else {
      await prisma.promoCode.create({ data: promoData });
    }
  }

  try {
    await upsertPromo({
      code: "CAMPUS20",
      discountType: "PERCENT",
      value: 20.0,
      minOrder: 80.0,
      maxUses: 500,
      oncePerUser: false,
      applicableBranchIds: null,
      isActive: true,
    });

    await upsertPromo({
      code: "WELCOME50",
      discountType: "FIXED",
      value: 50.0,
      minOrder: 150.0,
      maxUses: 200,
      oncePerUser: true,
      applicableBranchIds: null,
      isActive: true,
    });

    await upsertPromo({
      code: "BURGER15",
      discountType: "PERCENT",
      value: 15.0,
      minOrder: 70.0,
      maxUses: 100,
      oncePerUser: false,
      applicableBranchIds: JSON.stringify([burgerBranch.id]),
      isActive: true,
    });

    await upsertPromo({
      code: "CAFE10",
      discountType: "FIXED",
      value: 15.0,
      minOrder: 50.0,
      maxUses: 150,
      oncePerUser: false,
      applicableBranchIds: JSON.stringify([cafeBranch.id]),
      isActive: true,
    });

    await upsertPromo({
      code: "SHAWARMA10",
      discountType: "PERCENT",
      value: 10.0,
      minOrder: 60.0,
      maxUses: 100,
      oncePerUser: false,
      applicableBranchIds: JSON.stringify([shawarmaBranch.id]),
      isActive: true,
    });
  } catch (ePromos) {
    console.warn("[Seed] Warning creating promo codes:", ePromos);
  }

  // 6. كباتن التوصيل (تحديث أو إنشاء آمن)
  async function upsertDriver(username: string, driverData: any, isAllBranches: boolean, branchIds: string[]) {
    let driver = await prisma.deliveryDriver.findUnique({ where: { username } });
    if (driver) {
      driver = await prisma.deliveryDriver.update({
        where: { id: driver.id },
        data: driverData,
      });
    } else {
      driver = await prisma.deliveryDriver.create({
        data: { ...driverData, username },
      });
    }
    await setDriverBranchConfig(driver.id, { isAllBranches, branchIds });
    return driver;
  }

  let driver1: any = null;
  let driver2: any = null;
  let driver3: any = null;

  try {
    driver1 = await upsertDriver(
      "driver_fast",
      {
        name: "أحمد السريع (طيار عام)",
        phone: "01099990001",
        password: commonPassword,
        branchId: burgerBranch.id,
        isActive: true,
      },
      true,
      []
    );

    driver2 = await upsertDriver(
      "driver_pro",
      {
        name: "محمود التوصيل (طيار عام)",
        phone: "01099990002",
        password: commonPassword,
        branchId: pizzaBranch.id,
        isActive: true,
      },
      true,
      []
    );

    driver3 = await upsertDriver(
      "driver_shawarma",
      {
        name: "كريم شاورما (مخصص لشاورما الحرم)",
        phone: "01099990003",
        password: commonPassword,
        branchId: shawarmaBranch.id,
        isActive: true,
      },
      false,
      [shawarmaBranch.id]
    );
  } catch (eDrivers) {
    console.warn("[Seed] Warning creating drivers:", eDrivers);
  }

  // 7. الطلاب والمحافظ (تحديث أو إنشاء آمن)
  async function upsertStudent(phone: string, studentData: any) {
    let student = await prisma.user.findUnique({ where: { phone } });
    if (student) {
      student = await prisma.user.update({
        where: { id: student.id },
        data: studentData,
      });
    } else {
      student = await prisma.user.create({
        data: { ...studentData, phone },
      });
    }
    return student;
  }

  let student1: any = null;
  let student2: any = null;
  let student3: any = null;

  try {
    student1 = await upsertStudent("01012345678", {
      name: "عمر خالد",
      password: commonPassword,
      walletBalance: 250.0,
      loyaltyPoints: 120,
    });

    student2 = await upsertStudent("01087654321", {
      name: "سارة محمود",
      password: commonPassword,
      walletBalance: 180.0,
      loyaltyPoints: 85,
    });

    student3 = await upsertStudent("01098765432", {
      name: "يوسف إبراهيم",
      password: commonPassword,
      walletBalance: 95.0,
      loyaltyPoints: 40,
    });

    await prisma.userAddress.deleteMany({ where: { userId: { in: [student1.id, student2.id, student3.id] } } });
    await prisma.userAddress.createMany({
      data: [
        { userId: student1.id, title: "كلية الهندسة", details: "شارع السلام - عمارة 4 - الدور الثالث", isDefault: true },
        { userId: student2.id, title: "المنزل", details: "عمارة 8 - الدور الثاني - شقة 4", isDefault: true },
        { userId: student3.id, title: "المكتبة العامة", details: "صالة القراءة الهادئة - الطابق الأول", isDefault: true },
      ],
    });
  } catch (eStudents) {
    console.warn("[Seed] Warning creating students:", eStudents);
  }

  // 8. طلبات تجريبية متنوعة للتقارير والمالية
  try {
    if (student1 && student2 && student3) {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // طلب 1: مكتمل من برجر فاكتوري
      await prisma.order.create({
        data: {
          orderNumber: 1001,
          branchId: burgerBranch.id,
          userId: student1.id,
          customerName: student1.name,
          customerPhone: student1.phone,
          orderType: "DELIVERY",
          paymentMethod: "CASH",
          addressText: "شارع السلام - عمارة 4",
          deliveryZoneName: "كليات الهندسة والعلوم والحاسبات",
          status: "COMPLETED",
          subtotal: 165.0,
          deliveryFee: 10.0,
          discount: 0,
          total: 175.0,
          driverId: driver1 ? driver1.id : null,
          driverAssignedAt: fourHoursAgo,
          driverPickedUpAt: new Date(fourHoursAgo.getTime() + 15 * 60000),
          acceptedAt: fourHoursAgo,
          preparingAt: new Date(fourHoursAgo.getTime() + 5 * 60000),
          readyAt: new Date(fourHoursAgo.getTime() + 15 * 60000),
          completedAt: new Date(fourHoursAgo.getTime() + 30 * 60000),
          pickupPin: "4821",
          rating: 5,
          review: "أكل سخن والتوصيل في الموعد بالظبط!",
          createdAt: fourHoursAgo,
          items: {
            create: [
              {
                menuItemId: doubleCheeseBurger.id,
                itemName: "دبل تشيز برجر فاخر",
                sizeName: "دبل (قطعتين 300جم - موصى به)",
                unitPrice: 110.0,
                quantity: 1,
                totalPrice: 110.0,
              },
              {
                menuItemId: loadedFries.id,
                itemName: "تشيزي فرايز بالهالبينو",
                unitPrice: 55.0,
                quantity: 1,
                totalPrice: 55.0,
              },
            ],
          },
        },
      });

      // طلب 2: مكتمل من شاورما الحرم بكوبون
      await prisma.order.create({
        data: {
          orderNumber: 1002,
          branchId: shawarmaBranch.id,
          userId: student2.id,
          customerName: student2.name,
          customerPhone: student2.phone,
          orderType: "DELIVERY",
          paymentMethod: "INSTAPAY",
          paymentSenderPhone: "01087654321",
          paymentProofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80",
          addressText: "الحي السكني - عمارة 15 - الدور الثاني",
          status: "COMPLETED",
          promoCode: "SHAWARMA10",
          subtotal: 145.0,
          discount: 14.5,
          deliveryFee: 10.0,
          total: 140.5,
          driverId: driver3 ? driver3.id : null,
          driverAssignedAt: twoHoursAgo,
          driverPickedUpAt: new Date(twoHoursAgo.getTime() + 10 * 60000),
          acceptedAt: twoHoursAgo,
          preparingAt: new Date(twoHoursAgo.getTime() + 3 * 60000),
          readyAt: new Date(twoHoursAgo.getTime() + 12 * 60000),
          completedAt: new Date(twoHoursAgo.getTime() + 25 * 60000),
          pickupPin: "3914",
          rating: 5,
          createdAt: twoHoursAgo,
          items: {
            create: [
              {
                menuItemId: chickenShawarmaSyrian.id,
                itemName: "ساندوتش شاورما دجاج سوري صاج",
                sizeName: "لارج كبير (خبز صاج 25سم)",
                unitPrice: 60.0,
                quantity: 1,
                totalPrice: 60.0,
              },
              {
                menuItemId: chickenShawarmaSyrian.id,
                itemName: "ساندوتش شاورما دجاج سوري صاج",
                sizeName: "إكسترا صاروخ عملاق (خبز صاج 35سم)",
                unitPrice: 85.0,
                quantity: 1,
                totalPrice: 85.0,
              },
            ],
          },
        },
      });

      // طلب 3: مكتمل من كافيه فودافون كاش
      await prisma.order.create({
        data: {
          orderNumber: 1003,
          branchId: cafeBranch.id,
          userId: student3.id,
          customerName: student3.name,
          customerPhone: student3.phone,
          orderType: "PICKUP",
          paymentMethod: "VODAFONE_CASH",
          paymentSenderPhone: "01098765432",
          status: "COMPLETED",
          subtotal: 95.0,
          deliveryFee: 0.0,
          discount: 0.0,
          total: 95.0,
          acceptedAt: twoHoursAgo,
          preparingAt: new Date(twoHoursAgo.getTime() + 2 * 60000),
          readyAt: new Date(twoHoursAgo.getTime() + 8 * 60000),
          completedAt: new Date(twoHoursAgo.getTime() + 15 * 60000),
          pickupPin: "7209",
          rating: 4,
          createdAt: twoHoursAgo,
          items: {
            create: [
              {
                menuItemId: spanishLatte.id,
                itemName: "آيسد سبانش لاتيه",
                sizeName: "وسط (Regular 12oz)",
                unitPrice: 55.0,
                quantity: 1,
                totalPrice: 55.0,
              },
              {
                menuItemId: chocolateCroissant.id,
                itemName: "كرواسون شوكولاتة بلجيكي فريش",
                unitPrice: 40.0,
                quantity: 1,
                totalPrice: 40.0,
              },
            ],
          },
        },
      });

      // طلب 4: مكتمل من بيتزا كاش
      await prisma.order.create({
        data: {
          orderNumber: 1004,
          branchId: pizzaBranch.id,
          userId: student1.id,
          customerName: student1.name,
          customerPhone: student1.phone,
          orderType: "DELIVERY",
          paymentMethod: "CASH",
          addressText: "الشيخ زايد - عمارة 8",
          status: "COMPLETED",
          subtotal: 210.0,
          deliveryFee: 15.0,
          discount: 0.0,
          total: 225.0,
          driverId: driver2 ? driver2.id : null,
          driverAssignedAt: new Date(now.getTime() - 50 * 60000),
          driverPickedUpAt: new Date(now.getTime() - 35 * 60000),
          acceptedAt: new Date(now.getTime() - 60 * 60000),
          preparingAt: new Date(now.getTime() - 55 * 60000),
          readyAt: new Date(now.getTime() - 35 * 60000),
          completedAt: new Date(now.getTime() - 10 * 60000),
          pickupPin: "8823",
          rating: 5,
          createdAt: new Date(now.getTime() - 65 * 60000),
          items: {
            create: [
              {
                menuItemId: ranchPizza.id,
                itemName: "بيتزا تشيكن رانش سوبريم",
                sizeName: "وسط (Medium 28سم)",
                unitPrice: 135.0,
                quantity: 1,
                totalPrice: 135.0,
              },
              {
                menuItemId: zingerCrepe.id,
                itemName: "كريب سوبر كرانشي زنجر حار",
                unitPrice: 75.0,
                quantity: 1,
                totalPrice: 75.0,
              },
            ],
          },
        },
      });

      // طلب 5: جاهز للتوصيل READY (لتجربته في شاشة الطيار)
      await prisma.order.create({
        data: {
          orderNumber: 1005,
          branchId: burgerBranch.id,
          userId: student2.id,
          customerName: student2.name,
          customerPhone: student2.phone,
          orderType: "DELIVERY",
          paymentMethod: "CASH",
          addressText: "المبنى الإداري - قاعة المؤتمرات",
          status: "READY",
          subtotal: 95.0,
          deliveryFee: 12.0,
          discount: 0.0,
          total: 107.0,
          driverId: driver1 ? driver1.id : null,
          driverAssignedAt: new Date(now.getTime() - 15 * 60000),
          acceptedAt: new Date(now.getTime() - 25 * 60000),
          preparingAt: new Date(now.getTime() - 20 * 60000),
          readyAt: new Date(now.getTime() - 5 * 60000),
          pickupPin: "5512",
          createdAt: new Date(now.getTime() - 25 * 60000),
          items: {
            create: [
              {
                menuItemId: crispyChickenBurger.id,
                itemName: "كرسبي تشيكن سوبر باربكيو",
                sizeName: "عادي كرسبي",
                unitPrice: 95.0,
                quantity: 1,
                totalPrice: 95.0,
              },
            ],
          },
        },
      });

      // طلب 6: جديد قيد الانتظار PENDING (لتجربته في شاشة الكاشير)
      await prisma.order.create({
        data: {
          orderNumber: 1006,
          branchId: shawarmaBranch.id,
          userId: student3.id,
          customerName: student3.name,
          customerPhone: student3.phone,
          orderType: "DELIVERY",
          paymentMethod: "CASH",
          addressText: "شارع النصر - عمارة 12 - الدور الثاني",
          status: "PENDING",
          subtotal: 125.0,
          deliveryFee: 10.0,
          discount: 0.0,
          total: 135.0,
          createdAt: new Date(now.getTime() - 2 * 60000),
          items: {
            create: [
              {
                menuItemId: fattaMixShawarma.id,
                itemName: "فتة شاورما ميكس (دجاج + لحمة)",
                unitPrice: 125.0,
                quantity: 1,
                totalPrice: 125.0,
              },
            ],
          },
        },
      });

      // طلب 7: تم بالأمس لاختبار الفلاتر
      await prisma.order.create({
        data: {
          orderNumber: 1000,
          branchId: cafeBranch.id,
          userId: student1.id,
          customerName: student1.name,
          customerPhone: student1.phone,
          orderType: "PICKUP",
          paymentMethod: "CASH",
          status: "COMPLETED",
          subtotal: 70.0,
          deliveryFee: 0.0,
          discount: 0.0,
          total: 70.0,
          acceptedAt: yesterday,
          preparingAt: yesterday,
          readyAt: yesterday,
          completedAt: yesterday,
          pickupPin: "1104",
          rating: 5,
          createdAt: yesterday,
          items: {
            create: [
              {
                menuItemId: spanishLatte.id,
                itemName: "آيسد سبانش لاتيه",
                sizeName: "كبير (Large 16oz)",
                unitPrice: 70.0,
                quantity: 1,
                totalPrice: 70.0,
              },
            ],
          },
        },
      });
    }
  } catch (eOrdersSample) {
    console.warn("[Seed] Warning creating sample orders:", eOrdersSample);
  }

  console.log("🎉 اكتمل حقن البيانات التجريبية الشاملة والموسعة بنجاح!");
  return {
    success: true,
    message: "تم حقن وتوليد البيانات التجريبية الشاملة والموسعة بنجاح! 🚀 (4 فروع، 16 قسماً، أكثر من 35 صنفاً مع عروض الكومبو والأب سيل والبانرات والكوبونات)",
    branchesCount: 4,
    categoriesCount: 16,
    itemsCount: 36,
    bannersCount: 4,
    promosCount: 5,
    driversCount: 3,
    studentsCount: 3,
  };
}
