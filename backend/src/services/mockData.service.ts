import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { setDriverBranchConfig } from "./driver.service.js";

export async function seedMockDatabase() {
  console.log("🌱 بدء حقن البيانات التجريبية الشاملة لمنظومة UniFood...");

  // 1. حساب مدير المنظومة (SuperAdmin)
  const adminPassword = await bcrypt.hash("123", 10);
  const admin = await prisma.user.upsert({
    where: { phone: "admin" },
    update: {
      name: "مدير المنظومة (Admin)",
      role: "SUPERADMIN",
      password: adminPassword,
    },
    create: {
      name: "مدير المنظومة (Admin)",
      phone: "admin",
      password: adminPassword,
      role: "SUPERADMIN",
    },
  });

  const commonPassword = await bcrypt.hash("123", 10);

  // 2. الفروع والمطاعم
  // مطعم 1: برجر فاكتوري
  const burgerBranch = await prisma.branch.upsert({
    where: { slug: "burger-campus" },
    update: {
      name: "برجر فاكتوري الجامعي 🍔",
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
    },
    create: {
      name: "برجر فاكتوري الجامعي 🍔",
      slug: "burger-campus",
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
    },
  });

  // كاشير برجر فاكتوري
  await prisma.branchUser.upsert({
    where: { username: "burger_pos" },
    update: { password: commonPassword, branchId: burgerBranch.id },
    create: { username: "burger_pos", password: commonPassword, branchId: burgerBranch.id },
  });

  // إعدادات الدفع لبرجر فاكتوري
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

  // مناطق التوصيل لبرجر فاكتوري
  await prisma.branchDeliveryZone.deleteMany({ where: { branchId: burgerBranch.id } });
  await prisma.branchDeliveryZone.createMany({
    data: [
      { branchId: burgerBranch.id, name: "كليات الهندسة والعلوم والحاسبات", fee: 10.0 },
      { branchId: burgerBranch.id, name: "سكن الطلاب والملاعب الرياضية", fee: 15.0 },
      { branchId: burgerBranch.id, name: "المبنى الإداري والعيادات المركزية", fee: 12.0 },
    ],
  });

  // مطعم 2: شاورما الحرم
  const shawarmaBranch = await prisma.branch.upsert({
    where: { slug: "shawarma-campus" },
    update: {
      name: "شاورما ومشويات الحرم 🌯",
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
    },
    create: {
      name: "شاورما ومشويات الحرم 🌯",
      slug: "shawarma-campus",
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
    },
  });

  await prisma.branchUser.upsert({
    where: { username: "shawarma_pos" },
    update: { password: commonPassword, branchId: shawarmaBranch.id },
    create: { username: "shawarma_pos", password: commonPassword, branchId: shawarmaBranch.id },
  });

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

  // مطعم 3: سبيشيالتي كافيه & بيكري
  const cafeBranch = await prisma.branch.upsert({
    where: { slug: "specialty-cafe" },
    update: {
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
    },
    create: {
      name: "سبيشيالتي كافيه & بيكري ☕",
      slug: "specialty-cafe",
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
    },
  });

  await prisma.branchUser.upsert({
    where: { username: "cafe_pos" },
    update: { password: commonPassword, branchId: cafeBranch.id },
    create: { username: "cafe_pos", password: commonPassword, branchId: cafeBranch.id },
  });

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

  // مطعم 4: رويال بيتزا وكريب
  const pizzaBranch = await prisma.branch.upsert({
    where: { slug: "royal-pizza" },
    update: {
      name: "رويال بيتزا & كريب 🍕",
      phone: "01077778888",
      logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80",
      address: "صالة الأنشطة الطلابية - البوابة الشرقية",
      isActive: true,
      operationalStatus: "OPEN",
      openingTime: "10:00",
      closingTime: "00:00",
      allowDelivery: true,
      allowPickup: true,
      deliveryFee: 15.0,
      deliveryType: "FIXED",
    },
    create: {
      name: "رويال بيتزا & كريب 🍕",
      slug: "royal-pizza",
      phone: "01077778888",
      logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80",
      address: "صالة الأنشطة الطلابية - البوابة الشرقية",
      isActive: true,
      operationalStatus: "OPEN",
      openingTime: "10:00",
      closingTime: "00:00",
      allowDelivery: true,
      allowPickup: true,
      deliveryFee: 15.0,
      deliveryType: "FIXED",
    },
  });

  await prisma.branchUser.upsert({
    where: { username: "pizza_pos" },
    update: { password: commonPassword, branchId: pizzaBranch.id },
    create: { username: "pizza_pos", password: commonPassword, branchId: pizzaBranch.id },
  });

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

  // 3. تنظيف وتجديد المنيو
  const allBranchIds = [burgerBranch.id, shawarmaBranch.id, cafeBranch.id, pizzaBranch.id];
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.itemModifierGroupLink.deleteMany({});
  await prisma.modifierOption.deleteMany({});
  await prisma.modifierGroup.deleteMany({ where: { branchId: { in: allBranchIds } } });
  await prisma.itemSize.deleteMany({});
  await prisma.menuItem.deleteMany({ where: { branchId: { in: allBranchIds } } });
  await prisma.menuCategory.deleteMany({ where: { branchId: { in: allBranchIds } } });

  // أ) أصناف برجر فاكتوري
  const burgerCat1 = await prisma.menuCategory.create({
    data: { branchId: burgerBranch.id, name: "سندوتشات البرجر الفاخرة", displayOrder: 1 },
  });
  const burgerCat2 = await prisma.menuCategory.create({
    data: { branchId: burgerBranch.id, name: "المقبلات والبطاطس", displayOrder: 2 },
  });

  const burgerModGroup = await prisma.modifierGroup.create({
    data: {
      branchId: burgerBranch.id,
      title: "إضافات الصوص والجبنة الاختيارية",
      isRequired: false,
      minSelection: 0,
      maxSelection: 3,
      options: {
        create: [
          { name: "شريحة جبنة شيدر إكسترا", price: 15.0 },
          { name: "بيكون بقري مقرمش", price: 20.0 },
          { name: "صوص باربكيو مدخن", price: 10.0 },
          { name: "قطع هالبينو حارة", price: 10.0 },
        ],
      },
    },
  });

  const doubleCheeseBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCat1.id,
      name: "دبل تشيز برجر فاخر 🍔",
      description: "قطعتين لحم أنجوس بلدي مشوي ع اللهب، دبل جبنة شيدر سايحة، خس وطماطم وصوص فاكتوري السري",
      basePrice: 110.0,
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
      sizes: {
        create: [
          { name: "سنجل (قطعة واحدة)", price: 85.0 },
          { name: "دبل (قطعتين - موصى به)", price: 110.0 },
          { name: "تريبل وحش (3 قطع)", price: 145.0 },
        ],
      },
      modifierGroupLinks: {
        create: [{ groupId: burgerModGroup.id }],
      },
    },
  });

  const crispyChickenBurger = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCat1.id,
      name: "كرسبي تشيكن سوبر باربكيو 🍗",
      description: "صدر دجاج مقرمش ذهبي مع صوص الباربكيو المدخن وسلطة كول سلو طازجة",
      basePrice: 95.0,
      imageUrl: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&q=80",
      sizes: {
        create: [
          { name: "عادي", price: 95.0 },
          { name: "كومبو مع بطاطس ومشروب", price: 130.0 },
        ],
      },
    },
  });

  const loadedFries = await prisma.menuItem.create({
    data: {
      branchId: burgerBranch.id,
      categoryId: burgerCat2.id,
      name: "تشيزي فرايز بالهالبينو 🍟",
      description: "بطاطس مقلية مقرمشة مغطاة بصوص الجبنة الشيدر الساخن وشرائح الهالبينو",
      basePrice: 55.0,
      imageUrl: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&q=80",
    },
  });

  // ب) أصناف شاورما الحرم
  const shawarmaCat1 = await prisma.menuCategory.create({
    data: { branchId: shawarmaBranch.id, name: "شاورما دجاج ولحم سوري", displayOrder: 1 },
  });
  const shawarmaCat2 = await prisma.menuCategory.create({
    data: { branchId: shawarmaBranch.id, name: "فتات ومقبلات", displayOrder: 2 },
  });

  const shawarmaModGroup = await prisma.modifierGroup.create({
    data: {
      branchId: shawarmaBranch.id,
      title: "إضافات شاورما خاصة",
      isRequired: false,
      minSelection: 0,
      maxSelection: 3,
      options: {
        create: [
          { name: "ثومية إضافية", price: 8.0 },
          { name: "جبنة موزاريلا سايحة", price: 15.0 },
          { name: "دبس رمان أصلي", price: 10.0 },
        ],
      },
    },
  });

  const chickenShawarmaSyrian = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCat1.id,
      name: "ساندوتش شاورما دجاج سوري صاج 🌯",
      description: "قطع صدور دجاج متبلة ومحمرة ع السيخ مع الثومية والخيار المخلل في خبز الصاج السوري المقرمش",
      basePrice: 60.0,
      imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&q=80",
      sizes: {
        create: [
          { name: "لارج كبير", price: 60.0 },
          { name: "إكسترا صاروخ", price: 85.0 },
          { name: "وجبة عربي مقطعة مع بطاطس وثومية", price: 110.0 },
        ],
      },
      modifierGroupLinks: {
        create: [{ groupId: shawarmaModGroup.id }],
      },
    },
  });

  const fattaMixShawarma = await prisma.menuItem.create({
    data: {
      branchId: shawarmaBranch.id,
      categoryId: shawarmaCat2.id,
      name: "فتة شاورما ميكس (دجاج + لحمة) 🍲",
      description: "أرز بسمتي أصفر مبهر، عيش شامي مقرمش، ميكس شاورما دجاج ولحمة، مع صوص الثومية الخاص",
      basePrice: 125.0,
      imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
    },
  });

  // ج) أصناف كافيه
  const cafeCat1 = await prisma.menuCategory.create({
    data: { branchId: cafeBranch.id, name: "القهوة والمشروبات الساخنة والباردة", displayOrder: 1 },
  });
  const cafeCat2 = await prisma.menuCategory.create({
    data: { branchId: cafeBranch.id, name: "المخبوزات والكرواسون والحلويات", displayOrder: 2 },
  });

  const spanishLatte = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCat1.id,
      name: "آيسد سبانش لاتيه 🧊☕",
      description: "إسبريسو غني، حليب مكثف ومبخر مع مكعبات الثلج لنشاط يدوم طوال اليوم الدراسي",
      basePrice: 55.0,
      imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&q=80",
      sizes: {
        create: [
          { name: "وسط (Regular 12oz)", price: 55.0 },
          { name: "كبير (Large 16oz)", price: 70.0 },
        ],
      },
    },
  });

  const chocolateCroissant = await prisma.menuItem.create({
    data: {
      branchId: cafeBranch.id,
      categoryId: cafeCat2.id,
      name: "كرواسون شوكولاتة بلجيكي فريش 🥐",
      description: "كرواسون فرنسي هش مخبوز طازج يومياً ومحشو بشوكولاتة بلجيكية فاخرة",
      basePrice: 40.0,
      imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80",
    },
  });

  // د) أصناف بيتزا
  const pizzaCat1 = await prisma.menuCategory.create({
    data: { branchId: pizzaBranch.id, name: "البيتزا الإيطالية", displayOrder: 1 },
  });
  const pizzaCat2 = await prisma.menuCategory.create({
    data: { branchId: pizzaBranch.id, name: "الكريب الحادق والمقرمش", displayOrder: 2 },
  });

  const ranchPizza = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCat1.id,
      name: "بيتزا تشيكن رانش سوبريم 🍕",
      description: "قطع صدور دجاج مشوية، فلفل ألوان، زيتون، صوص الرانش الغني، وجبنة موزاريلا طبيعية 100%",
      basePrice: 135.0,
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
      sizes: {
        create: [
          { name: "وسط (Medium)", price: 135.0 },
          { name: "كبير (Large)", price: 185.0 },
          { name: "كبير أطراف جبنة (Stuffed Crust)", price: 220.0 },
        ],
      },
    },
  });

  const zingerCrepe = await prisma.menuItem.create({
    data: {
      branchId: pizzaBranch.id,
      categoryId: pizzaCat2.id,
      name: "كريب سوبر كرانشي زنجر 🌯",
      description: "قطع دجاج زنجر كرسبي حار، بطاطس، جبنة موزاريلا ورومي، صوص مايونيز وكاتشب",
      basePrice: 75.0,
      imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80",
    },
  });

  // 4. البانرات التفاعلية
  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({
    data: [
      {
        title: "عروض كومبو الطلاب الأقوى 🔥",
        subtitle: "خصم 20% على وجبات البرجر والكومبو المميزة من برجر فاكتوري",
        badgeText: "خصم حصري 🍔",
        imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
        linkUrl: `?branch=burger-campus&offer=${doubleCheeseBurger.id}`,
        displayOrder: 1,
        isActive: true,
      },
      {
        title: "شاورما وسناكس الحرم الجامعي 🌯",
        subtitle: "سهران في المذاكرة؟ خدمة التوصيل مستمرة حتى الفجر لسكن الطلاب والمستشفى!",
        badgeText: "توصيل سريع ⚡",
        imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80",
        linkUrl: `?branch=shawarma-campus&offer=${chickenShawarmaSyrian.id}`,
        displayOrder: 2,
        isActive: true,
      },
      {
        title: "قهوة الصباح والمحاضرات ☕",
        subtitle: "ابدأ يومك بنشاط مع أفضل قهوة مختصة وكرواسون فرنسي طازج",
        badgeText: "كافيه الطلاب ✨",
        imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
        linkUrl: "?branch=specialty-cafe",
        displayOrder: 3,
        isActive: true,
      },
      {
        title: "بيتزا تشيكن رانش ولّمت الشلة 🍕",
        subtitle: "اطلب الآن مع أصحابك واستمتع بأشهى بيتزا وكريب في الجامعة",
        badgeText: "الأكثر طلباً ⭐",
        imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
        linkUrl: "?branch=royal-pizza",
        displayOrder: 4,
        isActive: true,
      },
    ],
  });

  // 5. كوبونات الخصم العامة والخاصة
  await prisma.promoCode.deleteMany({});
  await prisma.promoCode.create({
    data: {
      code: "CAMPUS20",
      discountType: "PERCENT",
      value: 20.0,
      minOrder: 80.0,
      maxUses: 500,
      oncePerUser: false,
      applicableBranchIds: null,
      isActive: true,
    },
  });

  await prisma.promoCode.create({
    data: {
      code: "WELCOME50",
      discountType: "FIXED",
      value: 50.0,
      minOrder: 150.0,
      maxUses: 200,
      oncePerUser: true,
      applicableBranchIds: null,
      isActive: true,
    },
  });

  await prisma.promoCode.create({
    data: {
      code: "BURGER15",
      discountType: "PERCENT",
      value: 15.0,
      minOrder: 70.0,
      maxUses: 100,
      oncePerUser: false,
      applicableBranchIds: JSON.stringify([burgerBranch.id]),
      isActive: true,
    },
  });

  await prisma.promoCode.create({
    data: {
      code: "CAFE10",
      discountType: "FIXED",
      value: 15.0,
      minOrder: 50.0,
      maxUses: 150,
      oncePerUser: false,
      applicableBranchIds: JSON.stringify([cafeBranch.id]),
      isActive: true,
    },
  });

  await prisma.promoCode.create({
    data: {
      code: "SHAWARMA10",
      discountType: "PERCENT",
      value: 10.0,
      minOrder: 60.0,
      maxUses: 100,
      oncePerUser: false,
      applicableBranchIds: JSON.stringify([shawarmaBranch.id]),
      isActive: true,
    },
  });

  // 6. كباتن التوصيل
  const driver1 = await prisma.deliveryDriver.upsert({
    where: { username: "driver_fast" },
    update: {
      name: "أحمد السريع (طيار عام)",
      phone: "01099990001",
      password: commonPassword,
      branchId: burgerBranch.id,
      isActive: true,
    },
    create: {
      name: "أحمد السريع (طيار عام)",
      phone: "01099990001",
      username: "driver_fast",
      password: commonPassword,
      branchId: burgerBranch.id,
      isActive: true,
    },
  });
  await setDriverBranchConfig(driver1.id, { isAllBranches: true, branchIds: [] });

  const driver2 = await prisma.deliveryDriver.upsert({
    where: { username: "driver_pro" },
    update: {
      name: "محمود التوصيل (طيار عام)",
      phone: "01099990002",
      password: commonPassword,
      branchId: pizzaBranch.id,
      isActive: true,
    },
    create: {
      name: "محمود التوصيل (طيار عام)",
      phone: "01099990002",
      username: "driver_pro",
      password: commonPassword,
      branchId: pizzaBranch.id,
      isActive: true,
    },
  });
  await setDriverBranchConfig(driver2.id, { isAllBranches: true, branchIds: [] });

  const driver3 = await prisma.deliveryDriver.upsert({
    where: { username: "driver_shawarma" },
    update: {
      name: "كريم شاورما (مخصص لشاورما الحرم)",
      phone: "01099990003",
      password: commonPassword,
      branchId: shawarmaBranch.id,
      isActive: true,
    },
    create: {
      name: "كريم شاورما (مخصص لشاورما الحرم)",
      phone: "01099990003",
      username: "driver_shawarma",
      password: commonPassword,
      branchId: shawarmaBranch.id,
      isActive: true,
    },
  });
  await setDriverBranchConfig(driver3.id, { isAllBranches: false, branchIds: [shawarmaBranch.id] });

  // 7. الطلاب والمحافظ
  const student1 = await prisma.user.upsert({
    where: { phone: "01012345678" },
    update: {
      name: "عمر خالد (طالب هندسة)",
      password: commonPassword,
      walletBalance: 250.0,
      loyaltyPoints: 120,
    },
    create: {
      name: "عمر خالد (طالب هندسة)",
      phone: "01012345678",
      password: commonPassword,
      walletBalance: 250.0,
      loyaltyPoints: 120,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { phone: "01087654321" },
    update: {
      name: "سارة محمود (طالبة صيدلة)",
      password: commonPassword,
      walletBalance: 180.0,
      loyaltyPoints: 85,
    },
    create: {
      name: "سارة محمود (طالبة صيدلة)",
      phone: "01087654321",
      password: commonPassword,
      walletBalance: 180.0,
      loyaltyPoints: 85,
    },
  });

  const student3 = await prisma.user.upsert({
    where: { phone: "01098765432" },
    update: {
      name: "يوسف إبراهيم (طالب تجارة)",
      password: commonPassword,
      walletBalance: 95.0,
      loyaltyPoints: 40,
    },
    create: {
      name: "يوسف إبراهيم (طالب تجارة)",
      phone: "01098765432",
      password: commonPassword,
      walletBalance: 95.0,
      loyaltyPoints: 40,
    },
  });

  await prisma.userAddress.deleteMany({ where: { userId: { in: [student1.id, student2.id, student3.id] } } });
  await prisma.userAddress.createMany({
    data: [
      { userId: student1.id, title: "كلية الهندسة", details: "مبنى عمارة - الدور الثالث - مدرج 302", isDefault: true },
      { userId: student2.id, title: "سكن الطالبات", details: "مبنى ج - الدور الثاني - غرفة 214", isDefault: true },
      { userId: student3.id, title: "المكتبة العامة", details: "صالة القراءة الهادئة - الطابق الأول", isDefault: true },
    ],
  });

  // 8. طلبات تجريبية متنوعة للتقارير والمالية
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
      addressText: "كلية الهندسة - مدرج 302",
      deliveryZoneName: "كليات الهندسة والعلوم والحاسبات",
      status: "COMPLETED",
      subtotal: 165.0,
      deliveryFee: 10.0,
      discount: 0,
      total: 175.0,
      driverId: driver1.id,
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
            sizeName: "دبل (قطعتين - موصى به)",
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
      addressText: "المدينة الجامعية طالبات - مبنى ج",
      status: "COMPLETED",
      promoCode: "SHAWARMA10",
      subtotal: 145.0,
      discount: 14.5,
      deliveryFee: 10.0,
      total: 140.5,
      driverId: driver3.id,
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
            sizeName: "لارج كبير",
            unitPrice: 60.0,
            quantity: 1,
            totalPrice: 60.0,
          },
          {
            menuItemId: chickenShawarmaSyrian.id,
            itemName: "ساندوتش شاورما دجاج سوري صاج",
            sizeName: "إكسترا صاروخ",
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
      addressText: "كلية التجارة - مدرج ب",
      status: "COMPLETED",
      subtotal: 210.0,
      deliveryFee: 15.0,
      discount: 0.0,
      total: 225.0,
      driverId: driver2.id,
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
            sizeName: "وسط (Medium)",
            unitPrice: 135.0,
            quantity: 1,
            totalPrice: 135.0,
          },
          {
            menuItemId: zingerCrepe.id,
            itemName: "كريب سوبر كرانشي زنجر",
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
      driverId: driver1.id,
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
            sizeName: "عادي",
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
      addressText: "سكن الطلاب - مبنى د - الدور الثاني",
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

  console.log("🎉 اكتمل حقن البيانات التجريبية الشاملة بنجاح!");
  return {
    success: true,
    message: "تم حقن كافة البيانات التجريبية بنجاح!",
    branchesCount: 4,
    bannersCount: 4,
    promosCount: 5,
    driversCount: 3,
    studentsCount: 3,
    ordersCount: 7,
  };
}
