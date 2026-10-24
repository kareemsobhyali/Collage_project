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
  ShoppingBag
} from 'lucide-react';
import { api, API_BASE_URL, getFullImageUrl } from '../services/api';
import { isRunningInNativeApk } from '../services/notifications';

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

  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const searchParams = new URLSearchParams(window.location.search);

  // 1. مسار المنصة العام: /apk أو /download أو /install
  if (path === '/apk' || path === '/download' || path === '/install') {
    const branchFromQuery = searchParams.get('branch') || searchParams.get('r') || searchParams.get('slug');
    return { isApkPage: true, branchSlug: branchFromQuery ? branchFromQuery.trim().toLowerCase() : null };
  }

  // 2. مسار مخصص لمطعم محدد: /:slug/apk أو /r/:slug/apk أو /:slug/download
  const slugApkMatch = path.match(/^\/(?:r\/)?([a-z0-9_-]+)\/(apk|download|install)$/i);
  if (slugApkMatch) {
    const slug = slugApkMatch[1].trim().toLowerCase();
    if (slug !== 'admin' && slug !== 'driver' && slug !== 'api') {
      return { isApkPage: true, branchSlug: slug };
    }
  }

  // 3. مسار عبر الباراميتر: ?apk=1 أو ?download=1
  if (searchParams.get('apk') === '1' || searchParams.get('download') === '1' || searchParams.get('install') === '1') {
    const branchFromQuery = searchParams.get('branch') || searchParams.get('r') || searchParams.get('slug');
    return { isApkPage: true, branchSlug: branchFromQuery ? branchFromQuery.trim().toLowerCase() : null };
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

  const [meta, setMeta] = useState<ApkMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => isRunningInNativeApk());
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // فحص نظام التشغيل (iOS vs Android / Desktop)
  const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  // 1. التقاط حدث التثبيت للـ PWA
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as any).deferredInstallPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    if ((window as any).deferredInstallPrompt) {
      setInstallPrompt((window as any).deferredInstallPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
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

        // 3. تحديث المانيفست والعنوان والأيقونة ديناميكياً ليناسب المطعم
        const appTitle = data.isBranch ? `تثبيت تطبيق ${data.name} | UniFood` : 'تثبيت تطبيق UniFood | الحرم الجامعي';
        document.title = appTitle;

        // تحديث رابط المانيفست
        let manifestHref = '/manifest.json';
        if (data.isBranch && data.slug) {
          manifestHref = `${API_BASE_URL}/customer/manifest?branch=${encodeURIComponent(data.slug)}`;
        }

        let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'manifest';
          document.head.appendChild(link);
        }
        link.href = manifestHref;

        // تحديث الفافيكون
        if (data.logoUrl) {
          let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (favicon) {
            favicon.href = getFullImageUrl(data.logoUrl);
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

  // معالجة الضغط على زر التثبيت
  const handleInstallClick = async () => {
    // إذا كان التطبيق مثبتاً بالفعل
    if (isInstalled) {
      window.location.href = webTargetUrl;
      return;
    }

    // إذا كنا على آيفون / آيباد (iOS Safari)
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    // إذا كان حدث قبل التثبيت متاحاً (Android / Chrome / Edge)
    if (installPrompt) {
      setIsInstalling(true);
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setIsInstalled(true);
          setTimeout(() => {
            window.location.href = webTargetUrl;
          }, 1500);
        }
      } catch (_e) {
        // Fallback
      } finally {
        setIsInstalling(false);
      }
      return;
    }

    // متصفح أندرويد بدون prompt جاهز: إرشاد مباشر
    alert('لتثبيت التطبيق على شاشتك:\n1. اضغط على القائمة (⋮) أعلى المتصفح.\n2. اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".');
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
          تأكد من صحة الرابط أو تصفح باقي مطاعم الحرم الجامعي المتاحة للطلب الآن
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
          <span className="text-xs font-black text-slate-300 tracking-wide">UniFood الحرم الجامعي</span>
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
          <span>{meta.isBranch ? 'التطبيق الرسمي المعتمد للمطعم 🎓' : 'تطبيق طلب الوجبات المعتمد للطلاب 🎓'}</span>
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
              <span>توصيل للمدرجات والكليات</span>
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
      <footer className="relative z-10 p-4 border-t border-slate-900 text-center text-[11px] text-slate-500 max-w-3xl mx-auto w-full">
        <span>UniFood منصة مطاعم وكافيهات الحرم الجامعي © {new Date().getFullYear()}</span>
      </footer>

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
