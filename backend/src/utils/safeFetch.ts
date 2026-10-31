import dns from "dns";
import net from "net";

/**
 * فحص ما إذا كان عنوان الـ IP ينتمي إلى شبكة داخلية أو محلية أو بيانات تعريف الاستضافة السحابية (SSRF Protection)
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // معالجة عناوين IPv4 المضمّنة في IPv6 مثل ::ffff:127.0.0.1 أو ::ffff:7f00:1
  if (cleanIp.startsWith("::ffff:")) {
    const tail = cleanIp.slice(7);
    if (net.isIPv4(tail)) {
      return isPrivateOrReservedIp(tail);
    }
    // صيغة سداسية عشرية ::ffff:aabb:ccdd
    const hexMatch = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateOrReservedIp(v4);
    }
  }

  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split(".").map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b, c] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 (Private)
    if (a === 127) return true; // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local / Cloud Metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (Private)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (Private)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking 198.18.0.0/15
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224) return true; // Multicast & Reserved (224.0.0.0/4, 240.0.0.0/4)
    return false;
  }

  if (net.isIPv6(cleanIp)) {
    if (cleanIp === "::" || cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:0" || cleanIp === "0:0:0:0:0:0:0:1") {
      return true;
    }
    // Unique local (fc00::/7 -> fc.. or fd..)
    if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
    // Link-local (fe80::/10 -> fe8, fe9, fea, feb)
    if (/^fe[89ab]/i.test(cleanIp)) return true;
    // Multicast (ff00::/8)
    if (cleanIp.startsWith("ff")) return true;
    // IPv4-compatible / NAT64
    if (cleanIp.startsWith("64:ff9b:")) return true;
    return false;
  }

  return true;
}

/**
 * التحقق من أن الرابط الخارجي آمن ولا يشير إلى شبكة داخلية أو خدمة محلية
 */
export async function validateSafeExternalUrl(rawUrl: string): Promise<URL | null> {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }

    const hostname = parsed.hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal"
    ) {
      return null;
    }

    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIp(hostname)) return null;
      return parsed;
    }

    const records = await dns.promises.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return null;
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * جلب ملف ثنائي (صورة) من رابط خارجي بأمان تام مع:
 * 1. منع SSRF وحظر كافة العناوين الخاصة والمحلية وخدمات Metadata
 * 2. فحص كل خطوة إعادة توجيه (Redirect) يدوياً
 * 3. قطع التحميل فور تجاوز الحد الأقصى للبايتات لمنع استنزاف الذاكرة (OOM Protection)
 */
export async function safeFetchBinary(
  rawUrl: string,
  options?: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number }
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const maxBytes = options?.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = options?.timeoutMs ?? 8000;
  const maxRedirects = options?.maxRedirects ?? 3;

  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const safeUrl = await validateSafeExternalUrl(currentUrl);
    if (!safeUrl) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(safeUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "UniFood-MediaFetcher/1.0",
          Accept: "image/*,*/*;q=0.8",
        },
      });

      // التعامل الآمن مع التحويلات (301, 302, 303, 307, 308) وإعادة فحص الوجهة
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || redirectCount === maxRedirects) {
          return null;
        }
        currentUrl = new URL(location, safeUrl).toString();
        continue;
      }

      if (!res.ok) {
        return null;
      }

      const contentLengthHeader = res.headers.get("content-length");
      if (contentLengthHeader) {
        const declaredSize = parseInt(contentLengthHeader, 10);
        if (!isNaN(declaredSize) && declaredSize > maxBytes) {
          controller.abort();
          return null;
        }
      }

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (!res.body) {
        return null;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel().catch(() => {});
            controller.abort();
            return null;
          }
          chunks.push(Buffer.from(value));
        }
      }

      if (totalBytes < 32) {
        return null;
      }

      return {
        buffer: Buffer.concat(chunks, totalBytes),
        contentType,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/**
 * استخراج قائمة النطاقات الرسمية الموثوقة للمنصة
 */
export function getTrustedAllowedHosts(): Set<string> {
  const hosts = new Set<string>(["unifood.store", "www.unifood.store"]);

  const configuredWebUrl = (process.env.PUBLIC_WEB_URL || "").trim();
  if (configuredWebUrl) {
    try {
      const parsed = new URL(configuredWebUrl);
      if (parsed.host) hosts.add(parsed.host.toLowerCase());
    } catch {}
  }

  const renderHost = (process.env.RENDER_EXTERNAL_HOSTNAME || "").trim().toLowerCase();
  if (renderHost) hosts.add(renderHost);

  const railwayHost = (process.env.RAILWAY_PUBLIC_DOMAIN || "").trim().toLowerCase();
  if (railwayHost) hosts.add(railwayHost);

  const extraHosts = (process.env.TRUSTED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  for (const h of extraHosts) {
    hosts.add(h);
  }

  return hosts;
}

/**
 * بناء الرابط الأساسي الموثوق للمنصة دون السماح بتسميم ترويسة Host (Host Header Poisoning Protection)
 */
export function getTrustedAppBaseUrl(req?: { headers?: Record<string, any>; protocol?: string }): string {
  const configuredWebUrl = (process.env.PUBLIC_WEB_URL || "https://unifood.store").trim().replace(/\/+$/, "");

  if (!req || !req.headers) {
    return configuredWebUrl;
  }

  const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!rawHost || !/^[a-z0-9.-]+(?::\d{1,5})?$/.test(rawHost)) {
    return configuredWebUrl;
  }

  // في بيئة التطوير المحلية فقط نسمح بـ localhost أو 127.0.0.1
  if (process.env.NODE_ENV !== "production") {
    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(rawHost)) {
      return `http://${rawHost}`;
    }
  }

  const allowedHosts = getTrustedAllowedHosts();
  if (allowedHosts.has(rawHost)) {
    return `https://${rawHost}`;
  }

  return configuredWebUrl;
}

/**
 * فحص صلاحية Origin في طلبات CORS و Socket.IO
 */
export function isAllowedCorsOrigin(origin?: string): boolean {
  // الطلبات المباشرة من السيرفر أو تطبيق الأندرويد الأصلي لا تحمل Origin
  if (!origin) return true;

  const trimmed = origin.trim();
  // تطبيق سطح المكتب Electron عند التشغيل من الملف المحلي (loadFile) وتطبيقات الموبايل الهجينة
  if (trimmed === "file://" || trimmed === "capacitor://localhost" || trimmed === "ionic://localhost") {
    return true;
  }

  // السماح بمنافذ التطوير المحلية في وضع التطوير غير الإنتاجي
  if (process.env.NODE_ENV !== "production") {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d{1,5})?$/i.test(trimmed)) {
      return true;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.host.toLowerCase();
    const allowedHosts = getTrustedAllowedHosts();
    if (allowedHosts.has(host)) {
      return true;
    }

    const extraOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, "").toLowerCase())
      .filter(Boolean);
    if (extraOrigins.includes(trimmed.replace(/\/+$/, "").toLowerCase())) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * تحويل كائن إلى نص JSON آمن للحقن داخل وسم <script> في HTML مع منع كسر الوسم عبر </script> (SSR XSS Protection)
 */
export function serializeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * تعقيم النصوص قبل إدراجها داخل سمات وسوم HTML (مثل href أو content)
 */
export function escapeHtmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
