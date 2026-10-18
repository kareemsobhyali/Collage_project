/**
 * خدمات ومعالم الحرم الجامعي وحساب المسافات الجغرافية مجاناً 100%
 */

export interface CampusLandmark {
  id: string;
  name: string;
  code: string;
  category: 'COLLEGE' | 'DORM' | 'FACILITY' | 'GATE';
  lat: number;
  lng: number;
}

// المعالم الرئيسية المعتمدة داخل الحرم الجامعي
export const CAMPUS_LANDMARKS: CampusLandmark[] = [
  { id: 'gate_main', name: 'البوابة الرئيسية للجامعة', code: 'GATE-1', category: 'GATE', lat: 30.0268, lng: 31.2085 },
  { id: 'eng_college', name: 'مبنى كلية الهندسة', code: 'ENG', category: 'COLLEGE', lat: 30.0275, lng: 31.2110 },
  { id: 'comp_college', name: 'كلية الحاسبات والذكاء الاصطناعي', code: 'FCI', category: 'COLLEGE', lat: 30.0282, lng: 31.2092 },
  { id: 'comm_college', name: 'كلية التجارة - مدرج الفردوس', code: 'COMM', category: 'COLLEGE', lat: 30.0255, lng: 31.2070 },
  { id: 'arts_complex', name: 'مجمع الكليات النظرية (مبنى ب)', code: 'ARTS', category: 'COLLEGE', lat: 30.0260, lng: 31.2062 },
  { id: 'med_college', name: 'مبنى كلية الطب والعلوم الصحية', code: 'MED', category: 'COLLEGE', lat: 30.0290, lng: 31.2125 },
  { id: 'pharm_college', name: 'كلية الصيدلة وطب الأسنان', code: 'PHARM', category: 'COLLEGE', lat: 30.0285, lng: 31.2135 },
  { id: 'central_library', name: 'المكتبة المركزية وقاعة المؤتمرات', code: 'LIB', category: 'FACILITY', lat: 30.0265, lng: 31.2095 },
  { id: 'dorm_male_a', name: 'سكن الطلاب المغتربين (مبنى أ)', code: 'DORM-A', category: 'DORM', lat: 30.0242, lng: 31.2045 },
  { id: 'dorm_male_b', name: 'سكن الطلاب المغتربين (مبنى ب)', code: 'DORM-B', category: 'DORM', lat: 30.0238, lng: 31.2052 },
  { id: 'dorm_female', name: 'مدينة الطالبات السكنية', code: 'DORM-G', category: 'DORM', lat: 30.0248, lng: 31.2035 },
  { id: 'sports_stadium', name: 'الملاعب الرياضية والمسبح الأولمبي', code: 'SPORT', category: 'FACILITY', lat: 30.0250, lng: 31.2105 },
];

// موقع افتراضي لمطاعم الجامعة إذا لم يكن للفرع إحداثيات
export const DEFAULT_CAMPUS_RESTAURANT_COORDS = { lat: 30.0262, lng: 31.2088 };

export function getStoredRestaurantCoords(): { lat: number; lng: number } {
  try {
    const saved = localStorage.getItem('unifood_restaurant_coords');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch (_) {}
  return DEFAULT_CAMPUS_RESTAURANT_COORDS;
}

export function setStoredRestaurantCoords(coords: { lat: number; lng: number }): void {
  try {
    localStorage.setItem('unifood_restaurant_coords', JSON.stringify(coords));
  } catch (_) {}
}

/**
 * حساب المسافة بدقة الأمتار بين نقطتين جغرافيين بمعادلة Haversine الرياضية (مجانية وسريعة 100%)
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // نصف قطر الأرض بالأمتار
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * حساب وقت الوصول المتوقع (ETA) بالدقائق بناءً على سرعة سكوتر / دراجة الطيار
 */
export function calculateEtaMinutes(distanceMeters: number, speedKmH: number = 18): number {
  if (distanceMeters <= 50) return 1;
  const speedMetersPerMin = (speedKmH * 1000) / 60;
  const mins = distanceMeters / speedMetersPerMin;
  return Math.max(1, Math.round(mins));
}

/**
 * تنسيق المسافة نصياً
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters} متر`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} كم`;
}

/**
 * استخراج الإحداثيات المضمنة في نص العنوان إن وُجدت
 * الصيغ المدعومة: [GPS:30.0275,31.2110] أو || GPS: 30.0275, 31.2110
 */
export function extractCoordinatesFromAddress(addressText?: string | null): { lat: number; lng: number } | null {
  if (!addressText) return null;

  // صيغة [GPS:lat,lng]
  const tagMatch = addressText.match(/\[GPS:([0-9.-]+),([0-9.-]+)\]/);
  if (tagMatch) {
    const lat = parseFloat(tagMatch[1]);
    const lng = parseFloat(tagMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // صيغة || GPS: lat, lng
  const pipeMatch = addressText.match(/GPS:\s*([0-9.-]+)[,\s]+([0-9.-]+)/i);
  if (pipeMatch) {
    const lat = parseFloat(pipeMatch[1]);
    const lng = parseFloat(pipeMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // إذا كان العنوان يطابق أحد المعالم المسجلة بالاسم
  const matchedLandmark = CAMPUS_LANDMARKS.find(lm => addressText.includes(lm.name) || addressText.includes(lm.code));
  if (matchedLandmark) {
    return { lat: matchedLandmark.lat, lng: matchedLandmark.lng };
  }

  return null;
}

/**
 * تضمين الإحداثيات في نص العنوان بطريقة متوافقة وغير معيقة
 */
export function formatAddressWithCoordinates(text: string, lat: number, lng: number): string {
  const clean = cleanAddressText(text);
  return `[GPS:${lat.toFixed(6)},${lng.toFixed(6)}] ${clean}`.trim();
}

/**
 * تنظيف نص العنوان من وسوم الـ GPS لعرضه بشكل بشري نظيف في الفواتير والشاشات
 */
export function cleanAddressText(addressText?: string | null): string {
  if (!addressText) return '';
  return addressText
    .replace(/\[GPS:[0-9.-]+,[0-9.-]+\]/g, '')
    .replace(/\|\|\s*GPS:.*$/i, '')
    .replace(/GPS:\s*[0-9.-]+[,\s]+[0-9.-]+/i, '')
    .replace(/^\s*[-•,،:]\s*/, '')
    .replace(/\s*[-•,،:]\s*$/, '')
    .trim();
}

/**
 * إرجاع نص العنوان بصيغة بشرية مقروءة مع منع ظهور أي إحداثيات أو أرقام مجردة
 */
export function getDisplayAddress(addressText?: string | null, fallback: string = 'داخل الحرم الجامعي'): string {
  if (!addressText) return fallback;
  const clean = cleanAddressText(addressText);
  // إذا كان النص فارغاً أو عبارة عن أرقام إحداثيات مجردة وفواصل
  if (!clean || /^[0-9.,\s\-_:;()]+$/.test(clean)) {
    return fallback;
  }
  return clean;
}


/**
 * البحث عن أقرب معلم جامعي أو جلب اسم المكان جغرافياً تلقائياً
 */
export async function getNearestLocationName(lat: number, lng: number): Promise<{
  title: string;
  details: string;
  distanceMeters: number;
  landmarkName?: string;
}> {
  // 1. فحص أقرب معلم من معالم الحرم الجامعي
  let nearestLandmark: CampusLandmark | null = null;
  let minDistance = Infinity;

  for (const lm of CAMPUS_LANDMARKS) {
    const dist = calculateDistanceMeters(lat, lng, lm.lat, lm.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestLandmark = lm;
    }
  }

  // إذا كان داخل الحرم أو قريباً من معلم (حتى 350 متر)
  if (nearestLandmark && minDistance <= 350) {
    const title = minDistance <= 60 
      ? nearestLandmark.name 
      : `بالقرب من ${nearestLandmark.name}`;
    const details = minDistance <= 60
      ? `داخل ${nearestLandmark.name}`
      : `موقعي الحالي (يبعد حوالي ${minDistance}م عن ${nearestLandmark.name})`;
    return {
      title,
      details,
      distanceMeters: minDistance,
      landmarkName: nearestLandmark.name,
    };
  }

  // 2. إذا كان الموقع خارج الحرم (مثلاً في هايبر وان أو منطقة سكنية خارجية)، نحاول جلب الاسم الجغرافي الحقيقي عبر OpenStreetMap
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const placeName = 
        data.name ||
        addr.amenity || 
        addr.shop || 
        addr.building || 
        addr.commercial || 
        addr.supermarket || 
        addr.mall || 
        addr.retail || 
        addr.office || 
        addr.neighbourhood || 
        addr.suburb || 
        addr.road;

      if (placeName) {
        const areaName = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village || '';
        const title = areaName && !placeName.includes(areaName) ? `${placeName}، ${areaName}` : placeName;
        const detailsParts = data.display_name 
          ? data.display_name.split(',').slice(0, 3).map((s: string) => s.trim()).join('، ')
          : `موقعي الحالي [${title}]`;

        return {
          title,
          details: detailsParts,
          distanceMeters: minDistance,
        };
      }
    }
  } catch (_) {
    // نتراجع للبديل المحلي في حال بطء الشبكة أو انقطاعها
  }

  // 3. التراجع لأقرب معلم جامعي فقط إذا كانت المسافة قريبة (أقل من 1500م)
  if (nearestLandmark && minDistance <= 1500) {
    return {
      title: `بالقرب من ${nearestLandmark.name}`,
      details: `موقعي الحالي بالحرم الجامعي (يبعد ${formatDistance(minDistance)} عن ${nearestLandmark.name})`,
      distanceMeters: minDistance,
      landmarkName: nearestLandmark.name,
    };
  }

  return {
    title: 'موقعي الحالي',
    details: 'تم تحديد موقعي عبر الـ GPS',
    distanceMeters: minDistance,
  };
}
