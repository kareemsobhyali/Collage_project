/**
 * خدمات ومعالم الخريطة وحساب المسافات الجغرافية مجاناً 100%
 */

export interface CampusLandmark {
  id: string;
  name: string;
  code: string;
  category: 'COLLEGE' | 'DORM' | 'FACILITY' | 'GATE';
  lat: number;
  lng: number;
}

// المعالم الرئيسية المعتمدة على الخريطة
export const CAMPUS_LANDMARKS: CampusLandmark[] = [
  { id: 'gate_main', name: 'الميدان والمدخل الرئيسي للمدينة', code: 'GATE-1', category: 'GATE', lat: 30.0268, lng: 31.2085 },
  { id: 'eng_college', name: 'مول ومركز تسوق المدينة', code: 'ENG', category: 'COLLEGE', lat: 30.0275, lng: 31.2110 },
  { id: 'comp_college', name: 'مجمع الشركات ومقرات الأعمال', code: 'FCI', category: 'COLLEGE', lat: 30.0282, lng: 31.2092 },
  { id: 'comm_college', name: 'شارع الخدمات والمطاعم المركزي', code: 'COMM', category: 'COLLEGE', lat: 30.0255, lng: 31.2070 },
  { id: 'arts_complex', name: 'المنطقة السكنية (قطاع ب)', code: 'ARTS', category: 'COLLEGE', lat: 30.0260, lng: 31.2062 },
  { id: 'med_college', name: 'المجمع الطبي والمستشفى العام', code: 'MED', category: 'COLLEGE', lat: 30.0290, lng: 31.2125 },
  { id: 'pharm_college', name: 'مجمع العيادات والصيدليات المركزية', code: 'PHARM', category: 'COLLEGE', lat: 30.0285, lng: 31.2135 },
  { id: 'central_library', name: 'المركز الثقافي وقاعة الفعاليات', code: 'LIB', category: 'FACILITY', lat: 30.0265, lng: 31.2095 },
  { id: 'dorm_male_a', name: 'الحي السكني الراقي (مجمع أ)', code: 'DORM-A', category: 'DORM', lat: 30.0242, lng: 31.2045 },
  { id: 'dorm_male_b', name: 'الحي السكني الراقي (مجمع ب)', code: 'DORM-B', category: 'DORM', lat: 30.0238, lng: 31.2052 },
  { id: 'dorm_female', name: 'كمبوند الهدوء السكني', code: 'DORM-G', category: 'DORM', lat: 30.0248, lng: 31.2035 },
  { id: 'sports_stadium', name: 'النادي الرياضي والملاعب المفتوحة', code: 'SPORT', category: 'FACILITY', lat: 30.0250, lng: 31.2105 },
];

// موقع افتراضي للمطعم إذا لم يكن للفرع إحداثيات
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
export function getDisplayAddress(addressText?: string | null, fallback: string = 'عنوان التوصيل'): string {
  if (!addressText) return fallback;
  const clean = cleanAddressText(addressText);
  // إذا كان النص فارغاً أو عبارة عن أرقام إحداثيات مجردة وفواصل
  if (!clean || /^[0-9.,\s\-_:;()]+$/.test(clean)) {
    return fallback;
  }
  return clean;
}


/**
 * البحث عن أقرب معلم أو جلب اسم المكان جغرافياً تلقائياً
 */
export async function getNearestLocationName(lat: number, lng: number): Promise<{
  title: string;
  details: string;
  distanceMeters: number;
  landmarkName?: string;
}> {
  // 1. فحص أقرب معلم من المعالم المسجلة
  let nearestLandmark: CampusLandmark | null = null;
  let minDistance = Infinity;

  for (const lm of CAMPUS_LANDMARKS) {
    const dist = calculateDistanceMeters(lat, lng, lm.lat, lm.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestLandmark = lm;
    }
  }

  // إذا كان قريباً من معلم (حتى 350 متر)
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

  // 2. محاولة جلب الاسم الجغرافي الحقيقي للمكان عبر OpenStreetMap
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

  // 3. التراجع لأقرب معلم فقط إذا كانت المسافة قريبة (أقل من 1500م)
  if (nearestLandmark && minDistance <= 1500) {
    return {
      title: `بالقرب من ${nearestLandmark.name}`,
      details: `موقعي الحالي (يبعد ${formatDistance(minDistance)} عن ${nearestLandmark.name})`,
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

/**
 * استرجاع إحداثيات موقع العميل الحالية من التخزين المحلي
 */
export function getStoredClientCoords(): { lat: number; lng: number } | null {
  try {
    const saved = localStorage.getItem('unifood_client_gps_coords');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number' && !isNaN(parsed.lat) && !isNaN(parsed.lng)) {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch (_) {}
  return null;
}

/**
 * فحص ما إذا كان المطعم يقع ضمن نطاق التوصيل لموقع العميل الحالي
 */
export function isBranchInDeliveryZone(
  branch: any,
  clientCoords?: { lat: number; lng: number } | null
): { inZone: boolean; distKm: number; radiusKm: number } {
  const radiusKm = typeof branch?.deliveryRadiusKm === 'number' && branch.deliveryRadiusKm > 0 ? branch.deliveryRadiusKm : 10;

  if (!clientCoords || typeof clientCoords.lat !== 'number' || typeof clientCoords.lng !== 'number' || isNaN(clientCoords.lat) || isNaN(clientCoords.lng)) {
    return { inZone: true, distKm: 0, radiusKm };
  }

  // استخراج إحداثيات الفرع
  let bLat = typeof branch?.latitude === 'number' && !isNaN(branch.latitude) ? branch.latitude : null;
  let bLng = typeof branch?.longitude === 'number' && !isNaN(branch.longitude) ? branch.longitude : null;
  if (bLat === null || bLng === null) {
    const coords = extractCoordinatesFromAddress(branch?.address);
    if (coords) {
      bLat = coords.lat;
      bLng = coords.lng;
    } else {
      bLat = DEFAULT_CAMPUS_RESTAURANT_COORDS.lat;
      bLng = DEFAULT_CAMPUS_RESTAURANT_COORDS.lng;
    }
  }

  const distMeters = calculateDistanceMeters(bLat, bLng, clientCoords.lat, clientCoords.lng);
  const distKm = distMeters / 1000;

  return {
    inZone: distKm <= radiusKm,
    distKm,
    radiusKm,
  };
}

/**
 * مطابقة البانر مع الفرع المستهدف في حال كان البانر مرتبطاً بمطعم معين
 */
export function findBranchForBanner(banner: any, branches: any[]): any | null {
  if (!banner || !Array.isArray(branches) || branches.length === 0) return null;
  if (banner.branchId) {
    return branches.find(b => b.id === banner.branchId) || null;
  }
  if (!banner.linkUrl) return null;
  const url = String(banner.linkUrl).trim();

  // فحص معاملات الرابط مثل ?branch= أو ?r=
  if (url.includes('?')) {
    try {
      const q = url.split('?')[1];
      const params = new URLSearchParams(q);
      const bParam = params.get('branch') || params.get('r');
      if (bParam) {
        const norm = bParam.trim().toLowerCase();
        return branches.find(b => b.id === bParam || (b.slug && b.slug.toLowerCase() === norm)) || null;
      }
    } catch (_) {}
  }

  // فحص أجزاء المسار مثل /slug أو /r/slug أو /slug/menu أو /slug/apk
  const cleanPath = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0].replace(/^\//, '').replace(/\/$/, '');
  const parts = cleanPath.split('/');
  for (const part of parts) {
    if (!part || part === 'r' || part === 'menu' || part === 'apk' || part === 'download') continue;
    const norm = part.toLowerCase();
    const match = branches.find(b => (b.slug && b.slug.toLowerCase() === norm) || b.id === part);
    if (match) return match;
  }

  return null;
}


/**
 * استخراج بيانات الموقع الجغرافي ونطاق التغطية من اسم المنطقة
 * الصيغة المدعومة: اسم المنطقة [GPS:lat,lng,radiusMeters] أو اسم المنطقة
 * مع دعم التخصيص الاتجاهي: [GPS:lat,lng,radiusMeters,DIR:N=3000,E=1500,S=1500,W=0]
 */
export interface DirectionalCoverage {
  north: number; // بالأمتار، 0 يعني التوصيل مغلق وغير متاح بهذا الاتجاه
  east: number;
  south: number;
  west: number;
}

export interface ZoneGeoData {
  cleanName: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  isDirectional?: boolean;
  directions?: DirectionalCoverage;
}

export function extractZoneGeo(zoneName?: string | null): ZoneGeoData {
  if (!zoneName) return { cleanName: '' };

  const tagMatch = zoneName.match(/\[GPS:([^\]]+)\]/);
  if (tagMatch) {
    const rawContent = tagMatch[1];
    const cleanName = zoneName.replace(/\[GPS:[^\]]+\]/g, '').trim();

    let directions: DirectionalCoverage | undefined = undefined;
    let isDirectional = false;

    const dirMatch = rawContent.match(/DIR:N=([0-9.]+),E=([0-9.]+),S=([0-9.]+),W=([0-9.]+)/i);
    if (dirMatch) {
      directions = {
        north: parseFloat(dirMatch[1]) || 0,
        east: parseFloat(dirMatch[2]) || 0,
        south: parseFloat(dirMatch[3]) || 0,
        west: parseFloat(dirMatch[4]) || 0,
      };
      isDirectional = true;
    }

    const baseParts = rawContent.split(',DIR:')[0].split(',');
    const lat = parseFloat(baseParts[0]);
    const lng = parseFloat(baseParts[1]);
    const radiusMeters = baseParts[2] ? parseFloat(baseParts[2]) : undefined;

    return {
      cleanName: cleanName || zoneName,
      lat: !isNaN(lat) ? lat : undefined,
      lng: !isNaN(lng) ? lng : undefined,
      radiusMeters: radiusMeters && !isNaN(radiusMeters) ? radiusMeters : undefined,
      isDirectional,
      directions,
    };
  }

  return {
    cleanName: zoneName.trim(),
  };
}

export function cleanZoneName(zoneName?: string | null): string {
  if (!zoneName) return '';
  return extractZoneGeo(zoneName).cleanName;
}

export function formatZoneWithGeo(
  cleanName: string,
  lat?: number | null,
  lng?: number | null,
  radiusMeters?: number | null,
  directions?: DirectionalCoverage | null
): string {
  const base = cleanZoneName(cleanName).trim();
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    const rad = typeof radiusMeters === 'number' && !isNaN(radiusMeters) ? Math.round(radiusMeters) : 1500;
    if (
      directions &&
      (typeof directions.north === 'number' ||
       typeof directions.east === 'number' ||
       typeof directions.south === 'number' ||
       typeof directions.west === 'number')
    ) {
      const n = Math.round(directions.north ?? rad);
      const e = Math.round(directions.east ?? rad);
      const s = Math.round(directions.south ?? rad);
      const w = Math.round(directions.west ?? rad);
      return `${base} [GPS:${lat.toFixed(6)},${lng.toFixed(6)},${rad},DIR:N=${n},E=${e},S=${s},W=${w}]`;
    }
    return `${base} [GPS:${lat.toFixed(6)},${lng.toFixed(6)},${rad}]`;
  }
  return base;
}

/**
 * حساب زاوية البوصلة (Bearing) بالدرجات من نقطة البداية إلى نقطة الهدف
 * 0° = شمال، 90° = شرق، 180° = جنوب، 270° = غرب
 */
export function calculateBearingDegrees(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const dLon = ((toLng - fromLng) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180) / Math.PI;
  return (bearingDeg + 360) % 360;
}

/**
 * معرفة الاتجاه الأساسي (شمال، شرق، جنوب، غرب) بناءً على زاوية البوصلة
 */
export function getDirectionForBearing(bearingDeg: number): 'north' | 'east' | 'south' | 'west' {
  const norm = ((bearingDeg % 360) + 360) % 360;
  if (norm >= 315 || norm < 45) return 'north';
  if (norm >= 45 && norm < 135) return 'east';
  if (norm >= 135 && norm < 225) return 'south';
  return 'west';
}

/**
 * حساب أقصى نصف قطر مسموح عند زاوية معينة مع التنعيم الانسيابي بين الاتجاهات
 */
export function getAllowedRadiusAtBearing(
  bearingDeg: number,
  baseRadius: number,
  directions?: DirectionalCoverage
): number {
  if (!directions) return baseRadius;

  const theta = ((bearingDeg % 360) + 360) % 360;

  let rA: number, rB: number, tA: number, tB: number;
  if (theta >= 0 && theta < 90) {
    tA = 0; tB = 90;
    rA = directions.north; rB = directions.east;
  } else if (theta >= 90 && theta < 180) {
    tA = 90; tB = 180;
    rA = directions.east; rB = directions.south;
  } else if (theta >= 180 && theta < 270) {
    tA = 180; tB = 270;
    rA = directions.south; rB = directions.west;
  } else {
    tA = 270; tB = 360;
    rA = directions.west; rB = directions.north;
  }

  const progress = (theta - tA) / (tB - tA);
  const factor = (1 - Math.cos(progress * Math.PI)) / 2;
  return Math.max(0, rA + factor * (rB - rA));
}

/**
 * التحقق مما إذا كان موقع العميل يقع داخل نطاق التغطية الجغرافي للمنطقة (مع فحص الاتجاهات)
 */
export function isCustomerWithinZoneGeo(
  custLat: number,
  custLng: number,
  zoneGeo: ZoneGeoData
): { isCovered: boolean; distanceMeters: number; maxAllowedMeters: number; reason?: string } {
  if (typeof zoneGeo.lat !== 'number' || typeof zoneGeo.lng !== 'number') {
    return { isCovered: true, distanceMeters: 0, maxAllowedMeters: Infinity };
  }

  const distance = calculateDistanceMeters(zoneGeo.lat, zoneGeo.lng, custLat, custLng);
  const baseRadius = zoneGeo.radiusMeters || 1500;

  if (!zoneGeo.isDirectional || !zoneGeo.directions) {
    const isCovered = distance <= baseRadius;
    return {
      isCovered,
      distanceMeters: distance,
      maxAllowedMeters: baseRadius,
      reason: !isCovered ? `المسافة (${formatDistance(distance)}) أكبر من نصف قطر التغطية (${formatDistance(baseRadius)})` : undefined
    };
  }

  const bearing = calculateBearingDegrees(zoneGeo.lat, zoneGeo.lng, custLat, custLng);
  const cardinal = getDirectionForBearing(bearing);
  const cardinalRadius = zoneGeo.directions[cardinal];

  const cardinalNames = {
    north: 'الشمال',
    east: 'الشرق',
    south: 'الجنوب',
    west: 'الغرب'
  };

  // إذا كان التوصيل مغلقاً تماماً في هذا الاتجاه
  if (cardinalRadius === 0) {
    return {
      isCovered: false,
      distanceMeters: distance,
      maxAllowedMeters: 0,
      reason: `التوصيل غير متاح حالياً باتجاه ${cardinalNames[cardinal]}`
    };
  }

  const allowedRadius = getAllowedRadiusAtBearing(bearing, baseRadius, zoneGeo.directions);
  const isCovered = distance <= allowedRadius;

  return {
    isCovered,
    distanceMeters: distance,
    maxAllowedMeters: Math.round(allowedRadius),
    reason: !isCovered
      ? `المسافة (${formatDistance(distance)}) تتجاوز الحد المسموح باتجاه ${cardinalNames[cardinal]} (${formatDistance(Math.round(allowedRadius))})`
      : undefined
  };
}

/**
 * توليد مصفوفة نقاط مضلع التغطية [lat, lng] لرسمها على خريطة Leaflet
 */
export function generateCoveragePolygonPoints(
  centerLat: number,
  centerLng: number,
  baseRadius: number,
  directions?: DirectionalCoverage,
  steps: number = 72
): [number, number][] {
  const points: [number, number][] = [];
  const R = 6371000; // نصف قطر الأرض بالمتر
  const lat1 = (centerLat * Math.PI) / 180;
  const lon1 = (centerLng * Math.PI) / 180;

  for (let i = 0; i < steps; i++) {
    const bearingDeg = (i * 360) / steps;
    const rad = getAllowedRadiusAtBearing(bearingDeg, baseRadius, directions);

    if (rad <= 1) {
      points.push([centerLat, centerLng]);
      continue;
    }

    const angularDist = rad / R;
    const bearingRad = (bearingDeg * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearingRad)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );

    points.push([
      Number(((lat2 * 180) / Math.PI).toFixed(6)),
      Number(((lon2 * 180) / Math.PI).toFixed(6))
    ]);
  }

  return points;
}
