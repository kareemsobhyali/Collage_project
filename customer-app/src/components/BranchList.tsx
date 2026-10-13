import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Search, 
  MapPin, 
  Truck, 
  ShoppingBag, 
  Clock, 
  ArrowLeft, 
  PowerOff, 
  CheckCircle2, 
  Sparkles,
  UtensilsCrossed,
  ExternalLink,
  X
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours } from '../services/api';

interface BranchListProps {
  branches: any[];
  onSelectBranch: (branch: any) => void;
}

// Preset vibrant banner gradients for appetizing restaurant cards
const BANNER_GRADIENTS = [
  'from-amber-500 via-orange-500 to-red-600',
  'from-indigo-600 via-purple-600 to-pink-600',
  'from-emerald-600 via-teal-600 to-cyan-600',
  'from-rose-600 via-pink-600 to-orange-500',
  'from-blue-600 via-indigo-600 to-violet-700',
  'from-amber-600 via-amber-700 to-yellow-600'
];

const FOOD_EMOJIS = ['🍔', '🍕', '🌯', '🥪', '☕', '🍗', '🍟', '🥤', '🧇', '🍝'];

const BranchCountdownBadge: React.FC<{ branch: any }> = ({ branch }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!branch.closedUntil || branch.operationalStatus !== 'BUSY') return 0;
    const diff = Math.max(0, Math.floor((new Date(branch.closedUntil).getTime() - Date.now()) / 1000));
    return diff;
  });

  useEffect(() => {
    if (!branch.closedUntil || branch.operationalStatus !== 'BUSY') {
      setSecondsLeft(0);
      return;
    }

    const calc = () => Math.max(0, Math.floor((new Date(branch.closedUntil).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());

    const interval = setInterval(() => {
      setSecondsLeft(calc());
    }, 1000);

    return () => clearInterval(interval);
  }, [branch.closedUntil, branch.operationalStatus]);

  if (branch.operationalStatus === 'CLOSED') {
    return (
      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-600 text-white backdrop-blur-md shadow-sm border border-white/20 shrink-0 flex items-center gap-1">
        <PowerOff className="w-3 h-3" />
        <span>مغلق حالياً</span>
      </span>
    );
  }

  if (branch.operationalStatus === 'BUSY' && secondsLeft > 0) {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500 text-white backdrop-blur-md shadow-sm border border-white/20 shrink-0 flex items-center gap-1.5 animate-pulse">
        <Clock className="w-3.5 h-3.5" />
        <span>مغلق مؤقتاً • {timeStr}</span>
      </span>
    );
  }

  if (!isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours)) {
    return (
      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-600 text-white backdrop-blur-md shadow-sm border border-white/20 shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>مغلق (خارج مواعيد العمل)</span>
      </span>
    );
  }

  return (
    <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white backdrop-blur-md shadow-sm border border-white/20 shrink-0 flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span>مفتوح للطلب</span>
    </span>
  );
};

export const BranchList: React.FC<BranchListProps> = ({ branches, onSelectBranch }) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'DELIVERY' | 'PICKUP'>('ALL');

  // Dynamic Promotional Banners from Admin
  const [banners, setBanners] = useState<any[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    api.getBanners().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setBanners(data);
      }
    }).catch(err => console.error('Failed to load banners:', err));
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [banners.length]);

  const filteredBranches = branches.filter(b => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeFilter === 'OPEN') {
      return (
        b.operationalStatus === 'OPEN' &&
        isBranchOpenByHours(b.openingTime, b.closingTime, b.isWithinWorkingHours)
      );
    }
    if (activeFilter === 'DELIVERY') {
      return b.allowDelivery === true;
    }
    if (activeFilter === 'PICKUP') {
      return b.allowPickup === true;
    }

    return true;
  });

  const currentBanner = banners.length > 0 ? banners[activeBannerIdx] : null;

  const handleBannerClick = () => {
    if (!currentBanner?.linkUrl) return;
    const url = currentBanner.linkUrl.trim();
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (url.startsWith('/')) {
      window.location.href = url;
    } else {
      window.open(`https://${url}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Dynamic or Default UniFood Campus Banner */}
      {currentBanner ? (
        <div 
          onClick={currentBanner.linkUrl ? handleBannerClick : undefined}
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 text-white p-4 sm:p-6 shadow-md transition-all duration-300 ${
            currentBanner.linkUrl ? 'cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] group' : ''
          }`}
          title={currentBanner.linkUrl ? `اضغط لفتح: ${currentBanner.linkUrl}` : undefined}
        >
          {currentBanner.imageUrl && (
            <div className="absolute inset-0 z-0 opacity-25 group-hover:opacity-35 transition-opacity">
              <img
                src={getFullImageUrl(currentBanner.imageUrl)}
                alt={currentBanner.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{currentBanner.badgeText || 'إعلان حصري ⚡'}</span>
              </span>

              {currentBanner.linkUrl && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md transition-all shadow-sm">
                  <span>فتح الرابط</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-black mb-1 group-hover:text-amber-200 transition-colors">
              {currentBanner.title}
            </h2>
            {currentBanner.subtitle && (
              <p className="text-xs text-indigo-100 max-w-md">
                {currentBanner.subtitle}
              </p>
            )}

            {/* Dots navigation if multiple banners */}
            {banners.length > 1 && (
              <div className="flex items-center gap-1.5 mt-3">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBannerIdx(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === activeBannerIdx ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-4 sm:p-6 shadow-md">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>UniFood الحرم الجامعي</span>
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full">
                ⚡ توصيل مباشر للمدرجات
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black mb-1">
              وجبتك السخنة لحد عندك في ثواني! 🍔
            </h2>
            <p className="text-xs text-indigo-200 max-w-md">
              اطلب من كافيهات ومطاعم الجامعة بسهولة، أو اطلب واستلم فوراً بدون وقفة في الطوابير
            </p>
          </div>

          {/* Decorative Watermark */}
          <div className="absolute left-3 -bottom-4 text-7xl opacity-15 select-none pointer-events-none">
            🎓🍔
          </div>
        </div>
      )}

      {/* 2. Search & Quick Filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            placeholder="ابحث عن مطعم أو مبنى كلية (مثل: برجر، بيتزا، كلية العلوم)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-9 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-3 top-3 p-0.5 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs ${
              activeFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>الكل ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('OPEN')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs ${
              activeFilter === 'OPEN'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>مفتوح الآن</span>
          </button>

          <button
            onClick={() => setActiveFilter('DELIVERY')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs ${
              activeFilter === 'DELIVERY'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>توصيل للمباني</span>
          </button>

          <button
            onClick={() => setActiveFilter('PICKUP')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs ${
              activeFilter === 'PICKUP'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>استلام من الفرع</span>
          </button>
        </div>
      </div>

      {/* 3. Restaurant Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <span>مطاعم وكافيهات الحرم الجامعي</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              {filteredBranches.length}
            </span>
          </h3>
        </div>

        {filteredBranches.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200 shadow-sm">
            <Store className="w-14 h-14 mx-auto mb-2 opacity-30 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-700">لا توجد مطاعم مطابقة للبحث</h4>
            <p className="text-xs text-slate-500 mt-1">جرب البحث بكلمة أخرى أو تغيير الفلتر</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBranches.map((branch, idx) => {
              const payment = branch.paymentConfig;
              const gradientClass = BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length];
              const emoji = FOOD_EMOJIS[idx % FOOD_EMOJIS.length];
              const isClosed = branch.operationalStatus === 'CLOSED';
              const isBusy = branch.operationalStatus === 'BUSY';

              return (
                <div
                  key={branch.id}
                  onClick={() => onSelectBranch(branch)}
                  className={`bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between overflow-hidden ${
                    isClosed ? 'opacity-80' : ''
                  }`}
                >
                  <div>
                    {/* A. Cover Header Banner (Zero internal clipping for badges) */}
                    <div className={`relative h-24 w-full bg-gradient-to-r ${gradientClass} p-3 flex items-start justify-between rounded-t-3xl overflow-hidden select-none`}>
                      {/* Watermark emoji */}
                      <span className="absolute -left-2 -bottom-3 text-6xl opacity-20 pointer-events-none transform -rotate-12">
                        {emoji}
                      </span>
                      <div className="absolute inset-0 bg-black/10" />

                      {/* Right: Operational Status */}
                      <div className="relative z-10">
                        <BranchCountdownBadge branch={branch} />
                      </div>

                      {/* Left: Time Estimate */}
                      <div className="relative z-10 flex items-center gap-1 bg-black/40 text-white font-bold text-[11px] px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20">
                        <Clock className="w-3 h-3 text-amber-300" />
                        <span>15 - 25 دقيقة</span>
                      </div>
                    </div>

                    {/* B. Floating Sibling Bar (OVERLAPS BANNER WITH ZERO CLIPPING!) */}
                    <div className="px-4 -mt-7 relative z-20 flex items-end justify-between pointer-events-none">
                      {/* Full Logo Avatar */}
                      <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-md border-2 border-white ring-1 ring-slate-200/60 flex items-center justify-center shrink-0 pointer-events-auto">
                        {branch.logoUrl ? (
                          <img
                            src={getFullImageUrl(branch.logoUrl)}
                            alt={branch.name}
                            className="w-full h-full object-cover rounded-xl bg-slate-50"
                          />
                        ) : (
                          <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                            <Store className="w-7 h-7" />
                          </div>
                        )}
                      </div>

                      {/* Full Delivery Fee Pill */}
                      <div className="bg-white text-indigo-700 text-xs font-black px-3 py-1.5 rounded-full shadow-md border border-slate-200/80 flex items-center gap-1.5 pointer-events-auto">
                        <Truck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{branch.deliveryFee > 0 ? `${branch.deliveryFee} ج.م توصيل` : 'توصيل مجاني'}</span>
                      </div>
                    </div>

                    {/* C. Card Details */}
                    <div className="pt-2.5 px-4 pb-3 space-y-2">
                      {/* Title & Verified Partner */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-base text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {branch.name}
                          </h4>
                          <span title="فرع موثق بالحرم الجامعي">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="line-clamp-1">{branch.address || 'داخل الحرم الجامعي'}</span>
                        </div>
                      </div>

                      {/* Temporary notice if busy or closed */}
                      {isBusy && (
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="line-clamp-1">{branch.closingReason || 'استراحة وتجهيز طلبات'}</span>
                        </div>
                      )}

                      {isClosed && (
                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-900 flex items-center gap-1.5 font-bold">
                          <PowerOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>المطعم مغلق حالياً حتى إشعار آخر</span>
                        </div>
                      )}

                      {!isClosed && !isBusy && !isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours) && (
                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-900 flex items-center gap-1.5 font-bold">
                          <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>مغلق لانتهاء مواعيد العمل ({branch.openingTime || '08:00'} - {branch.closingTime || '22:00'})</span>
                        </div>
                      )}

                      {/* Feature Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
                        {branch._count?.items ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-bold">
                            {branch._count.items} صنف متاح
                          </span>
                        ) : null}

                        {branch.allowDelivery && (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span>توصيل للمباني</span>
                          </span>
                        )}

                        {branch.allowPickup && (
                          <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" />
                            <span>استلام من الفرع</span>
                          </span>
                        )}
                      </div>

                      {/* Payment Methods */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">طرق الدفع:</span>
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                          {payment?.cashEnabled && <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">كاش</span>}
                          {payment?.vodafoneCashEnabled && <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">محفظة</span>}
                          {payment?.instapayEnabled && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">إنستاباي</span>}
                          {payment?.cardEnabled && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">فيزا</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* D. Bottom Action Button Strip */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-xs group-hover:bg-indigo-50/60 transition-colors">
                    <span className="group-hover:text-indigo-700 font-black">تصفح المنيو واطلب</span>
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-indigo-600" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
