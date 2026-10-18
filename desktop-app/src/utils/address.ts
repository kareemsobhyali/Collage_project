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
  if (!clean || /^[0-9.,\s\-_:;()]+$/.test(clean)) {
    return fallback;
  }
  return clean;
}
