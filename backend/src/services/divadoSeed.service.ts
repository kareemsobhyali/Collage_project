import bcrypt from "bcryptjs";
import prisma from "../prisma.js";

export const DIVADO_MENU_DATA = [
  {
    category: "كريبات الدجاج",
    displayOrder: 1,
    items: [
      { name: "كريب بانيه فارم", price: 110, desc: "كريب بانيه فارم مقرمش مع الجبنة الموزاريلا والخضار والكاتشب والمايونيز" },
      { name: "كريب بانيه فريش", price: 120, desc: "كريب بانيه صدور دجاج طازجة مقلية ومتبلة بخلطة ديفادو الخاصة" },
      { name: "كريب تشيكن استربس (بارد / حار)", price: 120, desc: "قطع صدور دجاج استربس مقرمشة مع الجبنة الموزاريلا وصوص المايونيز والكاتشب" },
      { name: "كريب زنجر", price: 120, desc: "قطع زنجر دجاج حارة مقرمشة مع الجبنة الموزاريلا والخضار" },
      { name: "كريب سوبر كرانشي (كرسبي - سلامي)", price: 125, desc: "دجاج كرسبي مقرمش مع شرائح السلامي الفاخرة والجبنة الموزاريلا" },
      { name: "كريب تشيكن كرسبي", price: 120, desc: "صدور دجاج كرسبي مقرمشة مع الموزاريلا والخضار والكاتشب والمايونيز" },
      { name: "كريب برجر فراخ", price: 110, desc: "برجر دجاج شهي مشوي على الجريل مع الجبنة الموزاريلا" },
      { name: "كريب شيش طاووق المشوي", price: 125, desc: "قطع شيش طاووق صدور دجاج متبلة ومشوية على الجريل" },
      { name: "كريب كوردن بلو", price: 125, desc: "أصابع صدور دجاج كوردن بلو محشوة جبن وروز بيف مع الموزاريلا" },
      { name: "كريب ميكس فراخ (شيش - شاورما - استربس)", price: 140, desc: "توليفة ثلاثية غنية من قطع الشيش المشوي وشاورما الفراخ والاستربس المقرمش" },
      { name: "كريب فاهيتا فراخ", price: 125, desc: "شرائح صدور دجاج فاهيتا متبلة مع الفلفل الألوان والبصل والجبن" },
      { name: "كريب مشروم شيش", price: 125, desc: "قطع شيش طاووق مشوي مع شرائح المشروم الطازج والجبنة الموزاريلا" },
      { name: "كريب مشروم شاورما", price: 125, desc: "شاورما فراخ مشوية مع المشروم الطازج والجبنة الموزاريلا" },
    ],
  },
  {
    category: "كريبات اللحوم",
    displayOrder: 2,
    items: [
      { name: "كريب برجر مشوي", price: 125, desc: "برجر لحم بقري مشوي على الجريل مع الجبنة الموزاريلا والخضار" },
      { name: "كريب مشروم برجر", price: 125, desc: "برجر لحم بقري مشوي مع شرائح المشروم والجبنة الموزاريلا" },
      { name: "كريب سلامي برجر", price: 130, desc: "برجر لحم مشوي مع شرائح السلامي المدخن والجبنة الموزاريلا" },
      { name: "كريب دابل برجر", price: 140, desc: "طبقتين برجر لحم مشوي غني بالجبنة الموزاريلا والخضار" },
      { name: "كريب هوت دوج مكسيكان", price: 120, desc: "شرائح هوت دوج متبل على الطريقة المكسيكية مع الفلفل والجبن" },
      { name: "كريب كفته مشوي", price: 120, desc: "أصابع كفتة لحم بلدي مشوية على الجريل مع الجبنة والمخلل" },
      { name: "كريب سجق مشوي", price: 125, desc: "سجق شرقي بلدي متبل ومشوي على الجريل مع الموزاريلا" },
      { name: "كريب صب مارين (كفته - سجق)", price: 130, desc: "ميكس كفتة مشوية وسجق شرقي مع الجبنة الموزاريلا" },
      { name: "كريب بسطرمه", price: 125, desc: "شرائح بسطرمة فاخرة مع الجبنة الموزاريلا والفلفل" },
      { name: "كريب سلامي", price: 115, desc: "شرائح سلامي مدخن مع الجبنة الموزاريلا والكاتشب والمايونيز" },
      { name: "كريب ميكس مدخن (بسطرمه - سلامي - هوت دوج)", price: 140, desc: "توليفة مدخنة من البسطرمة والسلامي والهوت دوج مع الموزاريلا" },
      { name: "مكس لحوم", price: 140, desc: "ميكس غني من اللحوم المشوية والسجق والكفتة والهوت دوج" },
    ],
  },
  {
    category: "كريبات اسبيشيال",
    displayOrder: 3,
    items: [
      { name: "ميكس جريل", price: 140, desc: "صدور مشوية / شيش طاووق / كفتة مع الجبنة الموزاريلا" },
      { name: "استيك برجر", price: 140, desc: "وزن 150 جرام لحم صافي مع الجبن والخضار والمايونيز" },
      { name: "تشيكن باربيكيو", price: 140, desc: "صدور فراخ مقلية / صوص الباربيكيو / البيف المدخن مع الموزاريلا" },
      { name: "الصدور المشوية", price: 140, desc: "صدور فراخ مشوية مع الصوص المميز والجبنة والخضار" },
      { name: "تيستي", price: 140, desc: "صدور فراخ مقلية مع صوص البيج تيستي والبيف المدخن" },
      { name: "الرانش", price: 140, desc: "صدور فراخ مقلية مع صوص الرانش والرومي المدخن" },
      { name: "كريب ديفادو", price: 140, desc: "كريب ديفادو الخاص: شيش / استربس / مشروم / هوت دوج" },
      { name: "ديناميت", price: 140, desc: "كريب ديناميت: شيش / استربس / هوت دوج / بطاطس مقلية" },
      { name: "تشيكن دوج", price: 140, desc: "شرائح الهوت دوج مع قطع استربس الفراخ المقرمشة والجبنة" },
    ],
  },
  {
    category: "كريبات الجبنة",
    displayOrder: 4,
    items: [
      { name: "كريب جبنه موزاريلا", price: 65, desc: "كريب محشو جبنة موزاريلا غنية وذايبة مع الخضار والكاتشب والمايونيز" },
      { name: "كريب جبنه رومي / شيدر", price: 75, desc: "كريب محشو جبنة رومي أو شيدر مع الموزاريلا" },
      { name: "كريب ميكس جبن", price: 80, desc: "تشكيلة أجبان مشكلة (موزاريلا - رومي - شيدر)" },
    ],
  },
  {
    category: "كريبات الخضار",
    displayOrder: 5,
    items: [
      { name: "كريب البطاطس", price: 70, desc: "أصابع بطاطس مقلية ذهبية مع الموزاريلا والخضار والكاتشب والمايونيز" },
      { name: "كريب ميكس خضار", price: 65, desc: "تشكيلة خضار طازجة (فلفل، طماطم، زيتون، خس) مع الموزاريلا" },
    ],
  },
  {
    category: "كريبات الحلو",
    displayOrder: 6,
    items: [
      { name: "كريب حلو (شيكولاته / وايت)", price: 90, desc: "كريب ناعم بصوص الشوكولاتة اللذيذة (دارك أو وايت)" },
      { name: "كريب نوتيلا", price: 110, desc: "كريب غني بشوكولاتة النوتيلا الإيطالية الأصلية" },
    ],
  },
  {
    category: "البطاطس والمقبلات",
    displayOrder: 7,
    items: [
      { name: "باكت بطاطس", price: 55, desc: "باكت بطاطس مقلية ذهبية مقرمشة ومتبلة ببهارات ديفادو" },
      { name: "باكت بطاطس بالشيدر", price: 70, desc: "بطاطس مقلية مغطاة بصوص جبنة الشيدر الساخنة الغنية" },
      { name: "صوابع موزريلا", price: 65, desc: "أصابع جبنة موزاريلا مقلية مقرمشة وذايبة (3 قطع)" },
    ],
  },
  {
    category: "البرجر",
    displayOrder: 8,
    items: [
      { name: "تشيز برجر", price: 125, desc: "150 جم لحم بقري / الجبنة الشيدر / الخس / البصل / الطماطم / الخيار المخلل" },
      { name: "ديفادو برجر", price: 135, desc: "150 جم لحم / صوص الجبنة الشيدر / صوابع الموزريلا / البصل / خس / طماطم / خيار مخلل" },
      { name: "بيكون مشروم برجر", price: 140, desc: "150 جم لحم / البيكون المدخن / صوص الجبنة / الخس / الطماطم / الخيار المخلل / البصل" },
    ],
  },
  {
    category: "سندوتشات الفرايد تشيكن",
    displayOrder: 9,
    items: [
      {
        name: "البوص",
        price: 125,
        desc: "صدور دجاج / صوابع موزريلا / خس / طماطم / خيار مخلل / شيدر صوص / والبافيلو",
        sizes: [
          { name: "Single (سنجل)", price: 125 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
      {
        name: "تشيكن كلاسيك",
        price: 120,
        desc: "صدور دجاج / خس / طماطم / خيار مخلل / شيدر صوص / مايونيز",
        sizes: [
          { name: "Single (سنجل)", price: 120 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
      {
        name: "تيستي",
        price: 120,
        desc: "صدور دجاج / شيدر / بيف مدخن / خس / طماطم / خيار مخلل / صوص البيج تيستي",
        sizes: [
          { name: "Single (سنجل)", price: 120 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
      {
        name: "رانش",
        price: 120,
        desc: "صدور دجاج / مايونيز / خس / طماطم / خيار مخلل / صوص الرانش والرومي المدخن",
        sizes: [
          { name: "Single (سنجل)", price: 120 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
      {
        name: "فاير",
        price: 120,
        desc: "صدور دجاج / مايونيز / خس / طماطم / خيار مخلل / صوص الفاير الحار",
        sizes: [
          { name: "Single (سنجل)", price: 120 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
      {
        name: "تشيكن راب",
        price: 120,
        desc: "عيش التورتيلا المميز بالدجاج المقرمش و الشيدر صوص مع الخس والطماطم",
        sizes: [
          { name: "Single (سنجل)", price: 120 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
      {
        name: "تشيكن باربيكيو",
        price: 120,
        desc: "صدور دجاج / مايونيز / خس / طماطم / خيار مخلل / صوص الباربيكيو / البيف المدخن",
        sizes: [
          { name: "Single (سنجل)", price: 120 },
          { name: "Double (دبل)", price: 170 },
        ],
      },
    ],
  },
  {
    category: "سندوتشات الفرنساوي",
    displayOrder: 10,
    items: [
      { name: "استربس فرنساوي", price: 110, desc: "صدور استربس / مايونيز / خس / طماطم في خبز فرنساوي طازج" },
      { name: "سوبر كرانشي فرنساوي", price: 115, desc: "دجاج كرسبي / لحم تركي مدخن / مايونيز / خس / موزاريلا / طماطم" },
      { name: "شيش طاووق فرنساوي", price: 110, desc: "شيش طاووق / بصل / فلفل / طماطم / مايونيز" },
      { name: "كوردن بلو فرنساوي", price: 110, desc: "صدور دجاج محشية بالجبن والروز بيف / مايونيز / خس / طماطم" },
      { name: "تشيكن بانيه فرنساوي", price: 110, desc: "فراخ بانيه / خس / طماطم / مايونيز" },
      { name: "تشيكن اللجريك فرنساوي", price: 110, desc: "صدور دجاج مشوية / مايونيز / طماطم" },
      { name: "هوت دوج فرنساوي", price: 105, desc: "شرائح الهوت دوج مع الفلفل والطماطم والمايونيز" },
      { name: "سجق فرنساوي", price: 110, desc: "أصابع السجق الشرقي مع البصل والطماطم والمايونيز" },
      { name: "بطاطس فرنساوي", price: 60, desc: "أصابع البطاطس المقلية مع المايونيز والكاتشب" },
    ],
  },
  {
    category: "الوجبات",
    displayOrder: 11,
    items: [
      { name: "وجبة تشيكن كرسبي", price: 175, desc: "صدور فراخ مقرمشة مع الأرز والبطاطس والمخلل والخبز" },
      { name: "وجبة تشيكن زنجر", price: 175, desc: "أصابع الزنجر الحارة مع الأرز والبطاطس المقلية والمخلل" },
      { name: "وجبة شيش طاووق", price: 175, desc: "قطع الشيش طاووق المشوية مع الأرز والبطاطس والمخلل" },
      { name: "وجبة شاورما فراخ", price: 175, desc: "صدور فراخ مشوية مع الأرز والبطاطس المقلية والمخلل" },
      { name: "وجبة مشوي صدور", price: 175, desc: "صدور فراخ مشوية مع الصوص المميز والأرز والبطاطس" },
      { name: "وجبة كوردن بلو", price: 175, desc: "أصابع فراخ محشية جبنة مع سلامي مع الأرز والبطاطس والمخلل" },
      { name: "وجبة كفته جريل", price: 175, desc: "أصابع الكفتة المشوية مع الأرز والبطاطس والمخلل" },
      { name: "وجبة ميكس فراخ", price: 175, desc: "قطع الشيش طاووق مع شرائح الصدور المشوية وأصابع الاستربس المقرمشة مع الأرز والبطاطس" },
    ],
  },
  {
    category: "الوافل",
    displayOrder: 12,
    items: [
      { name: "وافل أمريكان (عادي / ساندوتش)", price: 105, desc: "وافل أمريكان كلاسيك مقرمش وخفيف مع اختيار الصوص" },
      { name: "وافل أمريكان نوتيلا", price: 130, desc: "وافل أمريكان مغطى بطبقة كثيفة من شوكولاتة النوتيلا الأصلية" },
      { name: "وافل ستيك نوتيلا", price: 100, desc: "وافل على عصا ستيك مغطى بالنوتيلا والتزيين" },
    ],
  },
  {
    category: "الحلو والبان كيك",
    displayOrder: 13,
    items: [
      {
        name: "بوكس بان كيك",
        price: 100,
        desc: "قطع ميني بان كيك هشة ولذيذة مع الصوصات",
        sizes: [
          { name: "Small (حجم صغير)", price: 100 },
          { name: "Medium (حجم وسط)", price: 130 },
        ],
      },
      { name: "وافل بوكس سلايزر", price: 130, desc: "قطع وافل سلايزر مشكلة مع صوصات شوكولاتة متنوعة" },
    ],
  },
  {
    category: "المشروبات",
    displayOrder: 14,
    items: [
      { name: "مياه معدنية", price: 10, desc: "زجاجة مياه معدنية طبيعية نقية" },
      { name: "كانز (بيبسي / مياه غازية)", price: 20, desc: "كانز مثلج بيبسي / سفن أب / ميرندا" },
    ],
  },
];

export async function seedDivadoBranchAndMenu() {
  console.log("🥞 بدء حقن وتحديث منيو مطعم ديفادو وافل اند كريب الكامل...");

  const commonPassword = await bcrypt.hash("123", 10);

  // 1. البحث عن الفرع أو إنشاؤه
  let branch = await prisma.branch.findFirst({
    where: {
      OR: [
        { slug: "divado-campus" },
        { name: { contains: "ديفادو" } },
      ],
    },
  });

  const branchPayload = {
    name: "ديفادو وافل اند كريب 🧇",
    slug: "divado-campus",
    phone: "01023231926",
    address: "أمام مدخل 2 (الشيخ زايد - هايبر وان)",
    logoUrl: "https://collage-project-5zby.onrender.com/uploads/1791832225692-750953839.jpg",
    isActive: true,
    operationalStatus: "OPEN",
    openingTime: "08:00",
    closingTime: "23:59",
    allowDelivery: true,
    allowPickup: true,
    deliveryFee: 10.0,
    deliveryType: "FIXED",
  };

  if (branch) {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: branchPayload,
    });
  } else {
    branch = await prisma.branch.create({
      data: branchPayload,
    });
  }

  // 2. مستخدم الفرع
  try {
    const existingUser = await prisma.branchUser.findFirst({
      where: {
        OR: [{ username: "divado" }, { branchId: branch.id }],
      },
    });

    if (existingUser) {
      await prisma.branchUser.update({
        where: { id: existingUser.id },
        data: { username: "divado", password: commonPassword, branchId: branch.id },
      });
    } else {
      await prisma.branchUser.create({
        data: { username: "divado", password: commonPassword, branchId: branch.id },
      });
    }
  } catch (errUser) {
    console.warn("[DivadoSeed] User upsert warning:", errUser);
  }

  // 3. إعدادات الدفع
  try {
    await prisma.branchPaymentConfig.upsert({
      where: { branchId: branch.id },
      update: {
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01023231926",
        instapayEnabled: true,
        instapayHandle: "kareemsobhyali@instapay",
        cardEnabled: false,
      },
      create: {
        branchId: branch.id,
        cashEnabled: true,
        vodafoneCashEnabled: true,
        vodafoneCashNumber: "01023231926",
        instapayEnabled: true,
        instapayHandle: "kareemsobhyali@instapay",
        cardEnabled: false,
      },
    });
  } catch (errPay) {
    console.warn("[DivadoSeed] Payment config warning:", errPay);
  }

  // 4. إنشاء مجموعات الإضافات
  let waffleSaucesGroup = await prisma.modifierGroup.findFirst({
    where: { branchId: branch.id, title: { contains: "صوص الوافل" } },
    include: { options: true },
  });

  if (!waffleSaucesGroup) {
    waffleSaucesGroup = await prisma.modifierGroup.create({
      data: {
        branchId: branch.id,
        title: "اختيار صوص الوافل والحلويات",
        isRequired: false,
        minSelection: 0,
        maxSelection: 3,
        options: {
          create: [
            { name: "وايت شوكليت", price: 0 },
            { name: "دارك شوكليت", price: 0 },
            { name: "ميكس شوكليت", price: 0 },
            { name: "كراميل", price: 0 },
            { name: "عسل نحل", price: 0 },
            { name: "صوص فراولة", price: 0 },
            { name: "صوص توت", price: 0 },
            { name: "صوص لوتس", price: 0 },
          ],
        },
      },
      include: { options: true },
    });
  }

  let extrasGroup = await prisma.modifierGroup.findFirst({
    where: { branchId: branch.id, title: { contains: "إضافات مميزة" } },
    include: { options: true },
  });

  if (!extrasGroup) {
    extrasGroup = await prisma.modifierGroup.create({
      data: {
        branchId: branch.id,
        title: "إضافات مميزة للوافل والحلويات",
        isRequired: false,
        minSelection: 0,
        maxSelection: 3,
        options: {
          create: [
            { name: "فواكه فريش قطع طازجة", price: 25 },
            { name: "بولاية أيس كريم فانيليا", price: 30 },
            { name: "مكسرات مشكلة فاخرة", price: 30 },
          ],
        },
      },
      include: { options: true },
    });
  }

  // 5. استيراد وتحديث الأقسام والأصناف
  let totalItemsCreated = 0;
  for (const catData of DIVADO_MENU_DATA) {
    let category = await prisma.menuCategory.findFirst({
      where: { branchId: branch.id, name: catData.category },
    });

    if (category) {
      category = await prisma.menuCategory.update({
        where: { id: category.id },
        data: { displayOrder: catData.displayOrder },
      });
    } else {
      category = await prisma.menuCategory.create({
        data: {
          branchId: branch.id,
          name: catData.category,
          displayOrder: catData.displayOrder,
        },
      });
    }

    const isWaffleOrDessert = catData.category.includes("وافل") || catData.category.includes("الحلو");

    for (const itemData of catData.items) {
      let item = await prisma.menuItem.findFirst({
        where: {
          branchId: branch.id,
          categoryId: category.id,
          name: itemData.name,
        },
      });

      if (!item) {
        item = await prisma.menuItem.create({
          data: {
            branchId: branch.id,
            categoryId: category.id,
            name: itemData.name,
            description: itemData.desc,
            basePrice: itemData.price,
            isAvailable: true,
            sizes: itemData.sizes && itemData.sizes.length > 0 ? {
              create: itemData.sizes.map(s => ({
                name: s.name,
                price: s.price,
              })),
            } : undefined,
            modifierGroupLinks: isWaffleOrDessert ? {
              create: [
                { groupId: waffleSaucesGroup.id },
                { groupId: extrasGroup.id },
              ],
            } : undefined,
          },
        });
        totalItemsCreated++;
      } else {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: {
            description: itemData.desc,
            basePrice: itemData.price,
            isAvailable: true,
          },
        });
      }
    }
  }

  console.log(`✅ تم تأكيد وحقن منيو ديفادو بنجاح (${DIVADO_MENU_DATA.length} قسماً و ${totalItemsCreated} صنفاً جديداً)`);
  return {
    success: true,
    branchId: branch.id,
    categoriesCount: DIVADO_MENU_DATA.length,
    message: `تم حقن منيو مطعم ديفادو بنجاح (${DIVADO_MENU_DATA.length} قسماً مع كافة الأصناف والأسعار)`,
  };
}
