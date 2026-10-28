import * as XLSX from 'xlsx';

export interface ParsedBulkItem {
  categoryName: string;
  name: string;
  description: string;
  basePrice: number;
  sizes: Array<{ name: string; price: number }>;
  imageUrl: string;
}

export interface ParseResult {
  items: ParsedBulkItem[];
  categoriesCount: number;
  itemsWithSizesCount: number;
  itemsWithImagesCount: number;
  errors: string[];
}

/**
 * تحليل نص الأحجام والأسعار بصيغ مرنة
 * يدعم: "صغير:45, وسط:65, كبير:85" أو "عادي=60 / دبل=90" أو "كبير 85"
 */
export function parseSizesString(sizesStr: any): Array<{ name: string; price: number }> {
  if (!sizesStr || typeof sizesStr !== 'string' || !sizesStr.trim()) return [];
  const parts = sizesStr.split(/[,،\n\/|]/).map((s: string) => s.trim()).filter(Boolean);
  const result: Array<{ name: string; price: number }> = [];

  for (const part of parts) {
    // تنسيق: "اسم_الحجم:السعر" أو "السعر:اسم_الحجم" أو مع علامة =
    const match = part.match(/^([^:=0-9]+)\s*[:=]\s*([0-9.]+)/) || part.match(/^([0-9.]+)\s*[:=]\s*([^:=0-9]+)/);
    if (match) {
      const name = isNaN(Number(match[1])) ? match[1].trim() : match[2].trim();
      const price = isNaN(Number(match[1])) ? parseFloat(match[2]) : parseFloat(match[1]);
      if (name && !isNaN(price) && price > 0) {
        result.push({ name, price });
        continue;
      }
    }

    // تنسيق: "اسم_الحجم السعر"
    const spaceMatch = part.match(/^(.+?)\s+([0-9.]+)$/);
    if (spaceMatch) {
      const name = spaceMatch[1].trim();
      const price = parseFloat(spaceMatch[2]);
      if (name && !isNaN(price) && price > 0) {
        result.push({ name, price });
      }
    }
  }

  return result;
}

/**
 * قراءة وتحليل ملف Excel أو CSV
 */
export function parseExcelFile(arrayBuffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // تحويل إلى مصفوفة صفوف (Array of Arrays)
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (!rows || rows.length < 2) {
    return {
      items: [],
      categoriesCount: 0,
      itemsWithSizesCount: 0,
      itemsWithImagesCount: 0,
      errors: ['الملف فارغ أو لا يحتوي على صفوف بيانات بعد العناوين'],
    };
  }

  // التعرف على ترتيب الأعمدة من الصف الأول (العناوين)
  const headerRow = (rows[0] || []).map((c: any) => String(c || '').trim().toLowerCase());

  let catIdx = -1;
  let nameIdx = -1;
  let descIdx = -1;
  let priceIdx = -1;
  let sizesIdx = -1;
  let imageIdx = -1;

  headerRow.forEach((col: string, idx: number) => {
    if (col.includes('قسم') || col.includes('category') || col.includes('section')) catIdx = idx;
    else if (col.includes('صنف') || col.includes('اسم') || col.includes('item') || col.includes('name') || col.includes('وجبة')) nameIdx = idx;
    else if (col.includes('وصف') || col.includes('desc') || col.includes('مكونات')) descIdx = idx;
    else if (col.includes('سعر') || col.includes('price')) priceIdx = idx;
    else if (col.includes('حجم') || col.includes('احجام') || col.includes('أحجام') || col.includes('sizes')) sizesIdx = idx;
    else if (col.includes('صورة') || col.includes('صوره') || col.includes('image') || col.includes('photo') || col.includes('url')) imageIdx = idx;
  });

  // إذا لم يتعرف على العناوين، نعتمد الترتيب الافتراضي:
  // 0: القسم | 1: اسم الصنف | 2: الوصف | 3: السعر | 4: الأحجام | 5: رابط الصورة
  if (nameIdx === -1 && priceIdx === -1) {
    catIdx = 0;
    nameIdx = 1;
    descIdx = 2;
    priceIdx = 3;
    sizesIdx = 4;
    imageIdx = 5;
  } else {
    if (catIdx === -1) catIdx = 0;
    if (nameIdx === -1) nameIdx = 1;
    if (priceIdx === -1) priceIdx = 3;
  }

  const items: ParsedBulkItem[] = [];
  const errors: string[] = [];
  let currentCategory = 'أصناف عامة';

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowCat = catIdx >= 0 && row[catIdx] ? String(row[catIdx]).trim() : '';
    if (rowCat) {
      currentCategory = rowCat;
    }

    const itemName = nameIdx >= 0 && row[nameIdx] ? String(row[nameIdx]).trim() : '';
    if (!itemName) continue; // صف فارغ أو لا يحتوي على اسم صنف

    const itemDesc = descIdx >= 0 && row[descIdx] ? String(row[descIdx]).trim() : '';
    const rawPrice = priceIdx >= 0 && row[priceIdx] !== undefined ? row[priceIdx] : 0;
    const cleanPrice = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

    const rawSizes = sizesIdx >= 0 && row[sizesIdx] ? String(row[sizesIdx]).trim() : '';
    const parsedSizes = parseSizesString(rawSizes);

    const rawImage = imageIdx >= 0 && row[imageIdx] ? String(row[imageIdx]).trim() : '';

    items.push({
      categoryName: currentCategory,
      name: itemName,
      description: itemDesc,
      basePrice: cleanPrice,
      sizes: parsedSizes,
      imageUrl: rawImage,
    });
  }

  const categories = new Set(items.map((i) => i.categoryName));
  const withSizes = items.filter((i) => i.sizes && i.sizes.length > 0).length;
  const withImages = items.filter((i) => i.imageUrl && i.imageUrl.length > 0).length;

  return {
    items,
    categoriesCount: categories.size,
    itemsWithSizesCount: withSizes,
    itemsWithImagesCount: withImages,
    errors,
  };
}

/**
 * تحليل نص المنيو المنسوخ مباشرة (Plain text / WhatsApp / Word)
 */
export function parsePastedMenuText(text: string): ParseResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedBulkItem[] = [];
  let currentCategory = 'أصناف عامة';

  for (const line of lines) {
    // 1. فحص هل السطر يمثل قسماً، مثل: [الشاورما] أو --- الشاورما --- أو # الشاورما
    const catMatch = line.match(/^\[(.+?)\]$/) || line.match(/^---+\s*(.+?)\s*---+$/) || line.match(/^#+\s*(.+)$/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }

    // 2. فحص هل السطر يحتوي على فاصلة أعمدة (Tab أو فاصلة منقوطة)
    if (line.includes('\t')) {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const price = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
        const desc = parts[2] || '';
        const sizes = parts[3] ? parseSizesString(parts[3]) : [];
        const img = parts[4] || '';
        items.push({
          categoryName: currentCategory,
          name,
          description: desc,
          basePrice: price,
          sizes,
          imageUrl: img,
        });
        continue;
      }
    }

    // 3. فحص صيغة الوجبة مع السعر: "اسم الصنف - السعر - الأحجام - الوصف"
    const dashParts = line.split(/\s*[-–—]\s*/);
    if (dashParts.length >= 2) {
      const name = dashParts[0].trim();
      const rawPrice = dashParts[1].trim();
      const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;

      let sizes: Array<{ name: string; price: number }> = [];
      let desc = '';
      let img = '';

      if (dashParts.length >= 3) {
        // فحص هل الجزء الثالث أحجام أم وصف
        if (dashParts[2].includes(':') || dashParts[2].includes('=')) {
          sizes = parseSizesString(dashParts[2]);
          desc = dashParts[3] || '';
        } else {
          desc = dashParts[2];
        }
      }

      items.push({
        categoryName: currentCategory,
        name,
        description: desc,
        basePrice: cleanPrice,
        sizes,
        imageUrl: img,
      });
    }
  }

  const categories = new Set(items.map((i) => i.categoryName));
  const withSizes = items.filter((i) => i.sizes && i.sizes.length > 0).length;
  const withImages = items.filter((i) => i.imageUrl && i.imageUrl.length > 0).length;

  return {
    items,
    categoriesCount: categories.size,
    itemsWithSizesCount: withSizes,
    itemsWithImagesCount: withImages,
    errors: items.length === 0 ? ['لم نتمكن من استخراج أي وجبات صالحة من النص الملصق'] : [],
  };
}

/**
 * إنشاء وتنزيل ملف Excel جاهز ومنسق (.xlsx) كقالب للأصناف
 */
export function downloadMenuExcelTemplate(restaurantName: string = 'المطعم') {
  const sampleData = [
    {
      'القسم': 'الشاورما والساندوتشات',
      'اسم الصنف': 'شاورما دجاج سوري سوبر',
      'الوصف': 'خبز صاج سوري مع صوص ثومية وخيار مخلل وبطاطس',
      'السعر الأساسي': 75,
      'الأحجام والأسعار': 'صغير:50, وسط:75, كبير:95',
      'رابط الصورة': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
    },
    {
      'القسم': 'الشاورما والساندوتشات',
      'اسم الصنف': 'فتة شاورما فراخ',
      'الوصف': 'أرز بسمتي أصفر مع قطع الشاورما والعيش المحمص وصوص الثومية المميز',
      'السعر الأساسي': 110,
      'الأحجام والأسعار': '',
      'رابط الصورة': '',
    },
    {
      'القسم': 'البرجر والسناكس',
      'اسم الصنف': 'دبل تشيز برجر فاكتوري',
      'الوصف': 'شريحتا لحم بلدي مشوي على اللهب مع جبن شيدر ذائب وصوص سموكي',
      'السعر الأساسي': 125,
      'الأحجام والأسعار': 'وسط:105, دبل:125, تريبل:155',
      'رابط الصورة': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
    },
    {
      'القسم': 'المشروبات والحلويات',
      'اسم الصنف': 'بيبسي كانز 330 مل',
      'الوصف': 'مشروب غازي مثلج ومنعش',
      'السعر الأساسي': 20,
      'الأحجام والأسعار': '',
      'رابط الصورة': '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // ضبط أبعاد الأعمدة تلقائياً لتكون مريحة للقراءة باللغة العربية
  worksheet['!cols'] = [
    { wch: 22 }, // القسم
    { wch: 28 }, // اسم الصنف
    { wch: 45 }, // الوصف
    { wch: 14 }, // السعر الأساسي
    { wch: 32 }, // الأحجام والأسعار
    { wch: 40 }, // رابط الصورة
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الطعام');

  const fileName = `نموذج_منيو_${restaurantName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
