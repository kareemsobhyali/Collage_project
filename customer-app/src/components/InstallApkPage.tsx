import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  Sparkles,
  Share2,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  QrCode,
  Store,
  Clock,
  Flame,
  ShieldCheck,
  Copy,
  Check,
  X,
  HelpCircle,
  Truck,
  Zap,
  ShoppingBag,
  Bell,
  Compass
} from 'lucide-react';
import { api, API_BASE_URL, getFullImageUrl } from '../services/api';
import { isRunningInNativeApk, getDeferredInstallPrompt, setDeferredInstallPrompt, triggerInstallApp, registerServiceWorker } from '../services/notifications';

interface ApkMeta {
  isBranch: boolean;
  branchId?: string;
  slug?: string;
  name: string;
  title: string;
  subtitle: string;
  logoUrl?: string;
  address?: string;
  deliveryFee?: number;
  operationalStatus?: string;
  openingTime?: string;
  closingTime?: string;
  totalBranches?: number;
  featuredItems?: Array<{
    id: string;
    name: string;
    basePrice: number;
    imageUrl?: string;
  }>;
  appFeatures?: Array<{
    title: string;
    desc: string;
  }>;
}

export function parseApkRoute(): { isApkPage: boolean; branchSlug: string | null } {
  if (typeof window === 'undefined') return { isApkPage: false, branchSlug: null };

  // 1. فحص مسار الـ Hash أولاً (مثل #/burger-campus/apk أو #/apk)
  let hashPath = '';
  if (window.location.hash && window.location.hash.length > 1) {
    const rawHash = window.location.hash.replace(/^#+/, '').replace(/\?.*$/, '');
    try {
      hashPath = decodeURIComponent(rawHash).trim().toLowerCase();
    } catch {
      hashPath = rawHash.trim().toLowerCase();
    }
  }

  // 2. معالجة الـ Pathname مع فك الترميز لدعم الأحرف العربية والمشفرة (URL Decoded)
  let pathname = '';
  try {
    pathname = decodeURIComponent(window.location.pathname).trim().toLowerCase();
  } catch {
    pathname = window.location.pathname.trim().toLowerCase();
  }

  // 3. البحث في الباراميترات (Query params)
  const searchParams = new URLSearchParams(window.location.search);
  const paramSlug = (searchParams.get('branch') || searchParams.get('r') || searchParams.get('slug') || '')
    .trim()
    .toLowerCase();

  // فحص إذا كان الرابط يطلب صفحة التثبيت عبر الباراميتر
  const isQueryApk =
    searchParams.get('apk') === '1' ||
    searchParams.get('download') === '1' ||
    searchParams.get('install') === '1' ||
    paramSlug.endsWith('/apk') ||
    paramSlug.endsWith('/download') ||
    paramSlug.endsWith('/install');

  const cleanParamSlug = paramSlug.replace(/\/(?:apk|download|install)$/i, '').trim();

  // قائمة المسارات المطلوب فحصها (الرئيسي ومسار الهاش)
  const pathsToCheck = [pathname, hashPath].filter(Boolean);

  for (const p of pathsToCheck) {
    const cleanPath = p.replace(/^\/+|\/+$/g, '');
    if (!cleanPath) continue;

    const segments = cleanPath.split('/').filter(Boolean);

    // أ) مسار عام للمنصة: /apk أو /download أو /install
    if (segments.length === 1 && ['apk', 'download', 'install'].includes(segments[0])) {
      return {
        isApkPage: true,
        branchSlug: cleanParamSlug && !['admin', 'driver', 'delivery', 'api'].includes(cleanParamSlug)
          ? cleanParamSlug
          : null
      };
    }

    // ب) مسار مسبوق بـ r: مثل /r/:slug/apk أو /r/:slug/download
    if (segments.length === 3 && segments[0] === 'r' && ['apk', 'download', 'install'].includes(segments[2])) {
      const slug = segments[1];
      if (slug && !['admin', 'driver', 'delivery', 'api'].includes(slug)) {
        return { isApkPage: true, branchSlug: slug };
      }
    }

    // ج) مسار مباشر مخصص لمطعم: مثل /:slug/apk أو /:slug/download
    if (segments.length === 2 && ['apk', 'download', 'install'].includes(segments[1])) {
      const slug = segments[0];
      if (slug && !['admin', 'driver', 'delivery', 'api', 'r'].includes(slug)) {
        return { isApkPage: true, branchSlug: slug };
      }
    }

    // د) مسار معكوس: مثل /apk/:slug أو /download/:slug
    if (segments.length === 2 && ['apk', 'download', 'install'].includes(segments[0])) {
      const slug = segments[1];
      if (slug && !['admin', 'driver', 'delivery', 'api', 'r'].includes(slug)) {
        return { isApkPage: true, branchSlug: slug };
      }
    }
  }

  // 4. إذا تم طلب الـ APK عبر الباراميترات فقط
  if (isQueryApk) {
    return {
      isApkPage: true,
      branchSlug: cleanParamSlug && !['admin', 'driver', 'delivery', 'api'].includes(cleanParamSlug)
        ? cleanParamSlug
        : null
    };
  }

  return { isApkPage: false, branchSlug: null };
}

export const InstallApkPage: React.FC<{
  initialSlug?: string | null;
  onNavigateHome?: () => void;
}> = ({ initialSlug, onNavigateHome }) => {
  const [slug, setSlug] = useState<string | null>(() => {
    if (initialSlug !== undefined) return initialSlug;
    return parseApkRoute().branchSlug;
  });

  useEffect(() => {
    if (initialSlug !== undefined) {
      setSlug(initialSlug);
    } else {
      setSlug(parseApkRoute().branchSlug);
    }
  }, [initialSlug]);

  const [meta, setMeta] = useState<ApkMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [installPrompt, setInstallPrompt] = useState<any>(() => getDeferredInstallPrompt());
  const [isInstalled, setIsInstalled] = useState(() => isRunningInNativeApk());
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showInstallHelpModal, setShowInstallHelpModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // فحص نظام التشغيل والمتصفحات المدمجة (In-App Browsers مثل متصفح واتساب وتيك توك وفيسبوك)
  const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isInAppBrowser = typeof window !== 'undefined' && /FBAN|FBAV|Instagram|WhatsApp|TikTok|Snapchat|Line/i.test(window.navigator.userAgent);

  // 1. التقاط ومزامنة حدث التثبيت للـ PWA مع المتصفح
  useEffect(() => {
    // تسجيل Service Worker فوراً لضمان جاهزية متصفح كروم لتثبيت PWA وتوليد WebAPK
    registerServiceWorker();

    const syncPrompt = (e?: any) => {
      const p = e?.detail || getDeferredInstallPrompt();
      if (p) {
        setInstallPrompt(p);
      }
    };

    syncPrompt();

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa_prompt_available', syncPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setDeferredInstallPrompt(null);
      setShowInstallBanner(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa_prompt_available', syncPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 2. جلب بيانات الصفحة واللوجو من السيرفر
  useEffect(() => {
    setLoading(true);
    setError(null);

    const targetUrl = slug
      ? `${API_BASE_URL}/customer/apk-meta/${encodeURIComponent(slug)}`
      : `${API_BASE_URL}/customer/apk-meta`;

    fetch(targetUrl)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'تعذر جلب بيانات تطبيق المطعم');
        }
        return res.json();
      })
      .then((data: ApkMeta) => {
        setMeta(data);

        if (data.isBranch && (data.slug || data.branchId)) {
          try {
            localStorage.setItem('pwa_installed_branch', (data.slug || data.branchId || '').toLowerCase());
          } catch (_e) {}
        }

        // 3. تحديث العنوان والأيقونة والمانيفست ديناميكياً ليناسب المطعم وشعاره
        const appTitle = data.isBranch ? `تثبيت تطبيق ${data.name} | UniFood` : 'تثبيت تطبيق UniFood | اطلب وجبتك أونلاين';
        document.title = appTitle;

        // تحديث أيقونة الموقع وأيقونة تطبيق الهاتف لشاشة أندرويد و iOS
        if (data.logoUrl) {
          const fullLogo = getFullImageUrl(data.logoUrl);

          // تحديث Favicon
          const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (favicon) {
            favicon.href = fullLogo;
          }

          // تحديث Apple Touch Icon (المسؤول الأول عن أيقونة تطبيق الشاشة الرئيسية في iOS وبعض أجهزة أندرويد)
          let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
          if (appleIcon) {
            appleIcon.href = fullLogo;
          } else {
            appleIcon = document.createElement('link');
            appleIcon.rel = 'apple-touch-icon';
            appleIcon.href = fullLogo;
            document.head.appendChild(appleIcon);
          }
        }

        // تحديث رابط الـ Manifest لفرع المطعم المحدد لضمان تحميل بيانات وشعار المطعم في الـ WebAPK
        const branchKey = (data.slug || data.branchId || slug || '').trim().toLowerCase();
        if (branchKey) {
          const branchManifestUrl = `/manifest.json?branch=${encodeURIComponent(branchKey)}`;
          let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
          if (manifestLink) {
            manifestLink.href = branchManifestUrl;
          } else {
            manifestLink = document.createElement('link');
            manifestLink.rel = 'manifest';
            manifestLink.href = branchManifestUrl;
            document.head.appendChild(manifestLink);
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'المطعم غير متاح حالياً');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  // الرابط المباشر للمطعم في المتصفح أو التطبيق
  const webTargetUrl = meta?.isBranch && meta?.slug
    ? `/?r=${encodeURIComponent(meta.slug)}`
    : '/';

  // فتح الصفحة مباشرة في تطبيق Google Chrome (لتخطي متصفح الواتساب والفيسبوك)
  const handleOpenInChrome = () => {
    if (typeof window === 'undefined') return;
    const cleanUrl = window.location.href.replace(/^https?:\/\//i, '');
    const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
  };

  // معالجة الضغط على زر التثبيت
  const handleInstallClick = async () => {
    // 1. إذا كان التطبيق مثبتاً بالفعل على الهاتف
    if (isInstalled) {
      window.location.href = webTargetUrl;
      return;
    }

    // 2. إذا كنا داخل متصفح وسائط مدمج مثل واتساب أو فيسبوك، نفتح كروم مباشرة لدعم التثبيت
    if (isInAppBrowser) {
      handleOpenInChrome();
      return;
    }

    // 3. إذا كنا على آيفون / آيباد (iOS Safari)
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    setIsInstalling(true);

    try {
      // 4. الحصول على كائن التثبيت الأصلي لمتصفح كروم / أندرويد
      let promptObj = installPrompt || getDeferredInstallPrompt();

      // إذا لم يكن جاهزاً في تلك اللحظة (مثلاً تم النقر فور فتح الصفحة)، ننتظر حتى 2.5 ثانية لوصول الحدث
      if (!promptObj) {
        promptObj = await new Promise<any>((resolve) => {
          let resolved = false;
          const handler = (e: any) => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(e?.detail || e || getDeferredInstallPrompt());
            }
          };
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(getDeferredInstallPrompt());
            }
          }, 2500);

          function cleanup() {
            clearTimeout(timer);
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('pwa_prompt_available', handler);
          }

          window.addEventListener('beforeinstallprompt', handler, { once: true });
          window.addEventListener('pwa_prompt_available', handler, { once: true });
        });
      }

      if (promptObj && typeof promptObj.prompt === 'function') {
        // إظهار نافذة التثبيت الرسمية للنظام مباشرة بدون أي شاشة تعليمات مزعجة
        await promptObj.prompt();

        // انتظار قرار المستخدم براحة تامة بدون مؤقت سباق زمني
        const choice = await promptObj.userChoice;

        if (choice?.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredInstallPrompt(null);
          setInstallPrompt(null);
          setShowInstallBanner(false);
          setTimeout(() => {
            window.location.href = webTargetUrl;
          }, 1000);
        }
      } else {
        // إذا كان النظام يعمل بالفعل كتطبيق
        if (isRunningInNativeApk()) {
          setIsInstalled(true);
          window.location.href = webTargetUrl;
        } else {
          // المتصفح لا يدعم التثبيت التلقائي بنقرة واحدة (مثلاً متصفح قديم)
          setShowInstallHelpModal(true);
        }
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  // نسخ رابط الصفحة
  const handleCopyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {});
  };

  // مشاركة الرابط عبر النظام
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: meta?.title || 'تطبيق UniFood',
          text: meta?.subtitle || 'ثبت التطبيق واطلب وجبتك فوراً',
          url: window.location.href,
        });
      } catch (_e) {}
    } else {
      setShowQrModal(true);
    }
  };

  // حالة التحميل
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center animate-pulse">
            <Smartphone className="w-10 h-10 text-indigo-400 animate-bounce" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 font-bold text-xs">
            ⚡
          </div>
        </div>
        <h3 className="text-lg font-black mt-4">جاري تجهيز بيانات التطبيق...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">يرجى الانتظار ثواني معدودة لتوليد رابط التثبيت المباشر</p>
      </div>
    );
  }

  // حالة الخطأ
  if (error || !meta) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4">
          <X className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white">{error || 'تعذر العثور على التطبيق المطلوب'}</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          تأكد من صحة الرابط أو تصفح باقي المطاعم المتاحة للطلب الآن
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => {
              setSlug(null);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            تثبيت تطبيق UniFood العام
          </button>
          <a
            href="/"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            <span>الصفحة الرئيسية للمطاعم</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  const logoSrc = meta.logoUrl ? getFullImageUrl(meta.logoUrl) : '/logo.png';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden" dir="rtl">
      {/* Decorative Glow Backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 bg-gradient-to-b from-indigo-600/25 via-purple-600/15 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/60 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="UniFood" className="w-7 h-7 rounded-lg object-contain bg-slate-900 border border-slate-800" />
          <span className="text-xs font-black text-slate-300 tracking-wide">UniFood</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>مشاركة</span>
          </button>
          <a
            href={webTargetUrl}
            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
          >
            <span>المتصفح</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-xl mx-auto w-full text-center">
        {/* Restaurant / App Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-black mb-4 shadow-sm backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{meta.isBranch ? 'التطبيق الرسمي المعتمد للمطعم 🌟' : 'تطبيق طلب وتوصيل الطعام السريع 🚀'}</span>
        </div>

        {/* Big Branded App Icon with Glow */}
        <div className="relative mb-5 group">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-400 rounded-3xl blur-xl opacity-40 group-hover:opacity-75 transition-opacity" />
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-slate-900 p-2 border-2 border-indigo-500/40 shadow-2xl overflow-hidden flex items-center justify-center">
            {meta.logoUrl ? (
              <img
                src={logoSrc}
                alt={meta.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex flex-col items-center justify-center text-white p-2">
                <Store className="w-10 h-10 mb-1" />
                <span className="text-[10px] font-black">{meta.name}</span>
              </div>
            )}

            {/* Corner Badge */}
            <div className="absolute bottom-1 right-1 bg-amber-400 text-slate-950 p-1 rounded-lg shadow-md">
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
            </div>
          </div>
        </div>

        {/* Titles */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          {meta.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md font-medium leading-relaxed mb-6">
          {meta.subtitle}
        </p>

        {/* Meta Stats Badges */}
        {meta.isBranch && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${meta.operationalStatus === 'OPEN' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{meta.operationalStatus === 'OPEN' ? 'يستقبل الطلبات الآن' : 'مغلق حالياً'}</span>
            </span>

            {meta.openingTime && meta.closingTime && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>من {meta.openingTime} حتى {meta.closingTime}</span>
              </span>
            )}

            <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>توصيل سريع حتى باب بيتك</span>
            </span>
          </div>
        )}

        {/* Primary Action Button (Install App) */}
        <div className="w-full max-w-sm space-y-3 mb-8">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base transition-all duration-300 shadow-xl flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer relative overflow-hidden group ${
              isInstalled
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-600/40 hover:shadow-indigo-600/60'
            }`}
          >
            <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />

            {isInstalled ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>افتح التطبيق المثبت على جهازك</span>
              </>
            ) : isInstalling ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري فتح شاشة التثبيت...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5 text-amber-300" />
                <span>تثبيت تطبيق {meta.name} للشاشة</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>تطبيق آمن وخفيف جداً (أقل من 2 ميجابايت) - يفتح بدون متصفح</span>
          </div>

          {/* Secondary Button (Browse in Web) */}
          <a
            href={webTargetUrl}
            className="w-full py-3 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <span>أو تصفح منيو المطعم عبر المتصفح بدون تثبيت</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </a>

          {/* Voluntary Help Link for Users Facing Issues */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowInstallHelpModal(true)}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>تواجه مشكلة في التثبيت التلقائي؟ اضغط هنا للتعليمات</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-right mb-8">
          {(meta.appFeatures || []).map((feat, idx) => (
            <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5 shadow-sm flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                {idx === 0 ? '🚀' : idx === 1 ? '⚡' : idx === 2 ? '🔥' : '🔔'}
              </div>
              <div>
                <h4 className="text-xs font-black text-white">{feat.title}</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-snug">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Featured Items Preview (Teaser) */}
        {meta.isBranch && meta.featuredItems && meta.featuredItems.length > 0 && (
          <div className="w-full text-right mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>أصناف مميزة بانتظارك في تطبيق {meta.name}</span>
              </h3>
              <a href={webTargetUrl} className="text-[11px] font-bold text-indigo-400 hover:underline">
                عرض المنيو كامل ↗
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {meta.featuredItems.slice(0, 3).map((it) => (
                <div key={it.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2 flex flex-col justify-between">
                  <div className="h-20 w-full rounded-xl bg-slate-800 overflow-hidden mb-2">
                    {it.imageUrl ? (
                      <img src={getFullImageUrl(it.imageUrl)} alt={it.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🍔</div>
                    )}
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-white truncate">{it.name}</h5>
                    <span className="text-xs font-black text-amber-400 font-mono mt-0.5 block">
                      {it.basePrice} ج.م
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share & QR Code Card */}
        <div className="w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
          <div>
            <span className="text-xs font-black text-white block">مشاركة كود تثبيت التطبيق</span>
            <span className="text-[11px] text-slate-400">شارك الرابط مع أصحابك بالكلية أو اطبع كود الـ QR للمطعم</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>كود QR</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-4 border-t border-slate-900 text-center text-[11px] text-slate-500 max-w-3xl mx-auto w-full mb-16 sm:mb-0">
        <span>UniFood منصة طلب وتوصيل الطعام أونلاين © {new Date().getFullYear()}</span>
      </footer>

      {/* Floating Notification / Install Action Toast (او يجي ليه اشعار ويدوس علي كلمة تثبيت) */}
      {showInstallBanner && !isInstalled && (
        <aside
          aria-label="تنبيه تثبيت التطبيق"
          className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 z-40 animate-in fade-in slide-in-from-bottom-5 duration-500"
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-2xl p-3.5 shadow-2xl shadow-indigo-950/60 flex items-center justify-between gap-3 text-right">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={logoSrc}
                  alt={meta.name}
                  className="w-11 h-11 rounded-xl object-cover border border-indigo-400/30 bg-slate-800"
                />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center animate-ping" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[7px] text-white">✓</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white truncate">{meta.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 font-bold shrink-0">تطبيق</span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  {isIos ? 'اضغط للمشاركة والإضافة للشاشة' : 'تثبيت فوري على شاشتك بنقرة واحدة'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/40 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {isInstalling ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>تثبيت</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal: Quick Installation Instructions (Without any APK download) */}
      {showInstallHelpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 text-right shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">تثبيت تطبيق {meta.name} للشاشة</h3>
              </div>
              <button
                onClick={() => setShowInstallHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              لتثبيت التطبيق مباشرة على شاشة هاتفك الرئيسية ليفتح كأيقونة سريعة:
            </p>

            <div className="space-y-3">
              {/* Option: Open in Google Chrome (if inside in-app browser like WhatsApp) */}
              {isInAppBrowser && (
                <button
                  type="button"
                  onClick={handleOpenInChrome}
                  className="w-full p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer shadow-lg shadow-indigo-950/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Compass className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black block">فتح في متصفح Google Chrome</span>
                      <span className="text-[10px] text-indigo-100">لتفعيل التثبيت المباشر بنقرة واحدة وتخطي الواتساب</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white" />
                </button>
              )}

              {/* Instructions */}
              <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>اضغط على قائمة الخيارات (⋮) بأعلى متصفح هاتفك</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                  سيتم إنشاء أيقونة التطبيق باسم وشعار {meta.name} على شاشتك فوراً وبدون أي استهلاك لمساحة الهاتف.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInstallHelpModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                فهمت ذلك
              </button>
              <a
                href={webTargetUrl}
                className="py-2.5 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-bold transition-all text-center"
              >
                تصفح الويب
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: iOS Installation Steps */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 text-right shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">طريقة التثبيت على أجهزة iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                <div>
                  <span className="font-bold text-white block">اضغط على زر المشاركة (Share) في متصفح Safari</span>
                  <span className="text-[11px] text-slate-400">تجد الأيقونة المربعة مع سهم لأعلى ⬆️ أسفل شاشة الهاتف.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <div>
                  <span className="font-bold text-white block">اختر "إضافة إلى الشاشة الرئيسية"</span>
                  <span className="text-[11px] text-slate-400">مرر للأسفل في القائمة واضغط على (Add to Home Screen ➕).</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                <div>
                  <span className="font-bold text-white block">اضغط على "إضافة" (Add) في الزاوية</span>
                  <span className="text-[11px] text-slate-400">سيظهر تطبيق {meta.name} فوراً على شاشتك بأيقونة المطعم الرسمية!</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                فهمت ذلك، شكراً!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Code to Print or Share */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute left-4 top-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-white">كود QR لتثبيت التطبيق</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              امسح الكود بكاميرا الموبايل لتثبيت تطبيق {meta.name} فوراً
            </p>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-md mb-4">
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 object-contain" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                طباعة الكود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
