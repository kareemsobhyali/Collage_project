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
  if (!clean || /^[0-9.,\s\-_:;()]+$/.test(clean)) {
    return fallback;
  }
  return clean;
}

export const DEFAULT_CAMPUS_RESTAURANT_COORDS = { lat: 30.0275, lng: 31.2095 };

/**
 * استخراج إحداثيات خط الطول ودوائر العرض الجغرافية للعميل من نص العنوان
 */
export function extractCoordinatesFromAddress(address?: string | null): { lat: number; lng: number } | null {
  if (!address) return null;
  const match = address.match(/\[GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/i);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * حساب المسافة بالأمتار بين نقطتين جغرافيين بمعادلة Haversine
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * حساب الوقت المقدر للوصول بالدقائق (ETA) بناءً على المسافة ومتوسط سرعة الدليفري
 */
export function calculateEtaMinutes(distanceMeters: number): number {
  if (distanceMeters <= 0) return 1;
  const speedMetersPerMin = 360; // متوسط سرعة سكوتر التوصيل والشوارع
  const travelMins = Math.ceil(distanceMeters / speedMetersPerMin);
  return Math.max(1, travelMins + 1);
}

/**
 * تنسيق المسافة بشكل مقروء (أمتار أو كيلومترات)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} م`;
  }
  return `${(meters / 1000).toFixed(1)} كم`;
}
