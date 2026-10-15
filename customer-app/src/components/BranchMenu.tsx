import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Phone, 
  Plus, 
  ShoppingBag, 
  Image as ImageIcon,
  Store,
  Clock,
  PowerOff,
  ChevronRight,
  ChevronLeft,
  UtensilsCrossed
} from 'lucide-react';
import { getFullImageUrl, isBranchOpenByHours } from '../services/api';

interface BranchMenuProps {
  branch: any;
  categories: any[];
  cart: any[];
  onBack: () => void;
  onSelectItem: (item: any) => void;
  onOpenCart: () => void;
}

const DAY_NAMES_AR: Record<string, string> = {
  SUN: 'الأحد',
  MON: 'الإثنين',
  TUE: 'الثلاثاء',
  WED: 'الأربعاء',
  THU: 'الخميس',
  FRI: 'الجمعة',
  SAT: 'السبت',
};

function formatWorkingDaysArabic(workingDays?: string | null): string {
  if (!workingDays) return 'يومياً';
  const parts = workingDays
    .split(',')
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0 || parts.length >= 7) {
    return 'طوال أيام الأسبوع';
  }
  return parts.map((p) => DAY_NAMES_AR[p] || p).join('، ');
}

interface CategoryCarouselProps {
  category: any;
  isBranchOpen: boolean;
  onItemClick: (item: any) => void;
}

const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  category,
  isBranchOpen,
  onItemClick,
}) => {
  const items: any[] = Array.isArray(category.items) ? category.items : [];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() => (items.length >= 3 ? 1 : 0));

  const centerCardInContainer = (index: number, smooth: boolean) => {
    const container = scrollRef.current;
    if (!container) return;
    const bounded = Math.max(0, Math.min(items.length - 1, index));
    const cards = container.querySelectorAll('[data-carousel-card="true"]');
    const target = cards[bounded] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({
        behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior),
        inline: 'center',
        block: 'nearest',
      });
      setActiveIndex(bounded);
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || items.length < 3) {
      setActiveIndex(0);
      return;
    }
    // عند وجود 3 أصناف أو أكثر، نبدأ بالكارت الأوسط ليظهر الكارت الأيمن والأيسر بجانبه فوراً
    const initialIdx = 1;
    setActiveIndex(initialIdx);
    const timer = setTimeout(() => {
      centerCardInContainer(initialIdx, false);
    }, 80);
    return () => clearTimeout(timer);
  }, [category.id, items.length]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container || items.length <= 1) return;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    const cards = container.querySelectorAll('[data-carousel-card="true"]');
    let closestIdx = 0;
    let minDistance = Infinity;

    cards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== activeIndex) {
      setActiveIndex(closestIdx);
    }
  };

  const scrollToCard = (index: number) => {
    centerCardInContainer(index, true);
  };

  return (
    <div className="space-y-2.5">
      {/* Category Title + Swipe Controls */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-600/40" />
          <span>{category.name}</span>
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            {items.length}
          </span>
        </h3>

        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 ml-1">اسحب للجانبين</span>
            <button
              type="button"
              onClick={() => scrollToCard(activeIndex - 1)}
              disabled={activeIndex <= 0}
              className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-35 transition-all shadow-sm"
              title="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToCard(activeIndex + 1)}
              disabled={activeIndex >= items.length - 1}
              className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-35 transition-all shadow-sm"
              title="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Peek Carousel (Right Card + Center Card + Left Card) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex items-stretch overflow-x-auto snap-x snap-mandatory no-scrollbar py-2 -mx-3 sm:-mx-4 ${
          items.length === 1
            ? 'justify-center px-6'
            : 'gap-3 px-[16%] sm:px-[22%]'
        }`}
      >
        {items.map((item: any, idx: number) => {
          const isCenter = items.length === 1 || idx === activeIndex;
          const isItemAvailable = item.isAvailable !== false && (!item.unavailableUntil || new Date() >= new Date(item.unavailableUntil));
          return (
            <div
              key={item.id}
              data-carousel-card="true"
              onClick={() => {
                if (!isCenter && items.length > 1) {
                  scrollToCard(idx);
                }
                if (!isItemAvailable) {
                  alert(`عذراً، صنف "${item.name}" غير متوفر حالياً بالمطعم.`);
                  return;
                }
                onItemClick(item);
              }}
              className={`w-[68vw] max-w-[250px] sm:w-[240px] shrink-0 snap-center bg-white rounded-3xl border p-3 flex flex-col justify-between cursor-pointer select-none transition-all duration-300 ${
                isCenter
                  ? 'scale-100 opacity-100 shadow-lg border-indigo-200 ring-2 ring-indigo-500/15 z-10'
                  : 'scale-[0.92] opacity-75 shadow-sm border-slate-200/80 hover:opacity-95'
              } ${(!isBranchOpen || !isItemAvailable) ? 'grayscale-[20%] opacity-75' : ''}`}
            >
              <div>
                {/* Card Top Image */}
                <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 mb-3">
                  {item.imageUrl ? (
                    <img
                      src={getFullImageUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-gradient-to-br from-slate-50 to-slate-100">
                      <ImageIcon className="w-9 h-9 mb-1" />
                      <span className="text-[10px] font-bold text-slate-400">بدون صورة</span>
                    </div>
                  )}

                  {/* Unavailable / Sold Out Badge */}
                  {!isItemAvailable && (
                    <div className="absolute top-2 right-2 bg-rose-600/95 backdrop-blur-md text-white px-2.5 py-0.5 rounded-xl text-[10px] font-black shadow-md border border-white/20">
                      غير متوفر الآن
                    </div>
                  )}

                  {/* Price Badge Floating on Image */}
                  <div className="absolute bottom-2 right-2 bg-slate-900/85 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-md border border-white/15">
                    {item.basePrice} ج.م
                  </div>
                </div>

                {/* Item Title & Description */}
                <div className="px-0.5">
                  <h4 className="font-black text-sm text-slate-900 line-clamp-1">
                    {item.name}
                  </h4>
                  {item.description ? (
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed min-h-[2.25rem]">
                      {item.description}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1 min-h-[2.25rem]">
                      وجبة طازجة من مطبخ {category.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={!isItemAvailable}
                className={`mt-3 w-full py-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  !isItemAvailable
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : isCenter
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {isItemAvailable ? (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>اختيار الصنف</span>
                  </>
                ) : (
                  <span>نفد مؤقتاً</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Carousel Dots Indicator */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {items.map((item: any, idx: number) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToCard(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIndex
                  ? 'w-5 bg-indigo-600'
                  : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`انتقال إلى ${item.name}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const BranchMenu: React.FC<BranchMenuProps> = ({
  branch,
  categories,
  cart,
  onBack,
  onSelectItem,
  onOpenCart,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');

  // عداد تنازلي حي في حال كان الفرع مغلقاً مؤقتاً
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!branch?.closedUntil || branch?.operationalStatus !== 'BUSY') return 0;
    const diff = Math.max(0, Math.floor((new Date(branch.closedUntil).getTime() - Date.now()) / 1000));
    return diff;
  });

  useEffect(() => {
    if (!branch?.closedUntil || branch?.operationalStatus !== 'BUSY') {
      setSecondsLeft(0);
      return;
    }

    const calc = () => Math.max(0, Math.floor((new Date(branch.closedUntil).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());

    const timer = setInterval(() => {
      const remaining = calc();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [branch?.closedUntil, branch?.operationalStatus]);

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isWithinWorkingHours = isBranchOpenByHours(
    branch?.openingTime,
    branch?.closingTime,
    branch?.isWithinWorkingHours
  );

  const isBranchOpen =
    branch?.isActive !== false &&
    (branch?.operationalStatus === 'OPEN' ||
      !branch?.operationalStatus ||
      (branch?.operationalStatus === 'BUSY' && secondsLeft <= 0)) &&
    isWithinWorkingHours;

  // إخفاء أي قسم فارغ لا يحتوي على أصناف متاحة للطلاب
  const nonEmptyCategories = (categories || []).filter(
    (cat) => Array.isArray(cat.items) && cat.items.length > 0
  );

  // عرض كافة الأقسام دائماً في الصفحة دون إخفاء أي قسم
  const displayedCategories = nonEmptyCategories;

  const isManualScrolling = useRef<boolean>(false);

  // التمرير السلس إلى القسم المطلوب عند الضغط عليه دون إخفاء باقي الأقسام
  const handleCategoryClick = (catId: string) => {
    setActiveCategoryId(catId);
    isManualScrolling.current = true;

    if (catId === 'ALL') {
      const topTarget = document.getElementById('menu-categories-top') || document.getElementById(`category-section-${nonEmptyCategories[0]?.id}`);
      if (topTarget) {
        topTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      const target = document.getElementById(`category-section-${catId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    const pill = document.getElementById(`pill-${catId}`);
    pill?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    setTimeout(() => {
      isManualScrolling.current = false;
    }, 800);
  };

  // مراقبة السكرول التلقائي لتحديد وتنشيط القسم المعروض أمام المستخدم حالياً
  useEffect(() => {
    if (nonEmptyCategories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScrolling.current) return;
        const visibleEntry = entries.find((e) => e.isIntersecting);
        if (visibleEntry) {
          const catId = visibleEntry.target.getAttribute('data-category-id');
          if (catId) {
            setActiveCategoryId(catId);
            const pill = document.getElementById(`pill-${catId}`);
            pill?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0.1,
      }
    );

    nonEmptyCategories.forEach((cat) => {
      const el = document.getElementById(`category-section-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [nonEmptyCategories]);

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleItemSelection = (item: any) => {
    if (!isBranchOpen) {
      if (branch?.isActive === false) {
        alert('عذراً، هذا المطعم موقوف حالياً من قِبل إدارة المنظومة.');
      } else if (branch.operationalStatus === 'BUSY' && secondsLeft > 0) {
        alert(
          `المطعم مغلق مؤقتاً لضغط الطلبات أو التجهيز.\nسيعاد فتح استقبال الطلبات تلقائياً بعد ${formatCountdown(secondsLeft)}.`
        );
      } else if (!isWithinWorkingHours) {
        alert(
          `عذراً، المطعم مغلق حالياً لانتهاء مواعيد العمل الرسمية (${branch.openingTime || '08:00'} - ${branch.closingTime || '22:00'}).`
        );
      } else {
        alert('عذراً، هذا المطعم مغلق حالياً ولا يستقبل طلبات جديدة.');
      }
      return;
    }
    onSelectItem(item);
  };

  return (
    <div className="space-y-5 pb-36 w-full max-w-full overflow-x-clip">
      {/* Top Navigation & Branch Info */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span>العودة لقائمة المطاعم</span>
          </button>

          {branch?.isActive === false ? (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 shrink-0">
              موقوف مؤقتاً
            </span>
          ) : branch.operationalStatus === 'CLOSED' ? (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
              مغلق حالياً
            </span>
          ) : branch.operationalStatus === 'BUSY' && secondsLeft > 0 ? (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shrink-0 animate-pulse">
              مغلق مؤقتاً
            </span>
          ) : !isWithinWorkingHours ? (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
              مغلق (خارج مواعيد العمل)
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
              مفتوح للطلب
            </span>
          )}
        </div>

        <div className="flex items-start gap-3.5">
          {branch.logoUrl ? (
            <img
              src={getFullImageUrl(branch.logoUrl)}
              alt={branch.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0 bg-slate-50"
            />
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
              <Store className="w-7 h-7" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {branch.name}
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-xl font-bold text-[11px] text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{branch.address || 'داخل الحرم الجامعي'}</span>
              </span>

              {branch.phone && (
                <a
                  href={`tel:${branch.phone}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 text-[11px] font-mono font-bold transition-colors"
                >
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{branch.phone}</span>
                </a>
              )}

              {(branch.openingTime || branch.closingTime) && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-xl font-bold text-[11px] text-slate-600">
                  <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>{branch.openingTime || '08:00'} - {branch.closingTime || '22:00'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Categories selector pills (Only non-empty categories) */}
        {nonEmptyCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-2.5 border-t border-slate-100 no-scrollbar">
            <button
              id="pill-ALL"
              onClick={() => handleCategoryClick('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                activeCategoryId === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كافة الأقسام
            </button>
            {nonEmptyCategories.map((cat) => (
              <button
                key={cat.id}
                id={`pill-${cat.id}`}
                onClick={() => handleCategoryClick(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  activeCategoryId === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name} ({cat.items.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Operational Live Countdown Banner */}
      {branch.operationalStatus === 'BUSY' && secondsLeft > 0 && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white p-4 rounded-3xl shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-200 animate-spin" />
            </div>
            <div className="min-w-0">
              <span className="font-black text-xs sm:text-sm block">
                المطعم في فترة إغلاق مؤقتة ({branch.closingReason || 'ضغط طلبات وتجهيز المطبخ'})
              </span>
              <span className="text-[11px] text-amber-100 block mt-0.5">
                يمكنك استعراض المنيو، وسيعاد استقبال الطلبات تلقائياً فور انتهاء العداد
              </span>
            </div>
          </div>
          <div className="text-center shrink-0 bg-black/25 px-3 py-1.5 rounded-2xl border border-amber-300/30 font-mono">
            <span className="text-[10px] text-amber-200 block font-sans">يعود بعد</span>
            <span className="text-sm sm:text-base font-black tracking-wider text-white">{formatCountdown(secondsLeft)}</span>
          </div>
        </div>
      )}

      {branch.operationalStatus === 'CLOSED' && (
        <div className="bg-rose-600 text-white p-4 rounded-3xl shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
            <PowerOff className="w-5 h-5 text-rose-200" />
          </div>
          <div>
            <span className="font-black text-xs sm:text-sm block">المطعم مغلق حالياً حتى إشعار آخر</span>
            <span className="text-[11px] text-rose-100">لا يستقبل هذا الفرع طلبات جديدة في الوقت الحالي</span>
          </div>
        </div>
      )}

      {branch.operationalStatus !== 'CLOSED' && !(branch.operationalStatus === 'BUSY' && secondsLeft > 0) && !isWithinWorkingHours && (
        <div className="bg-rose-600 text-white p-4 rounded-3xl shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-rose-200" />
          </div>
          <div className="min-w-0">
            <span className="font-black text-xs sm:text-sm block">
              المطعم مغلق حالياً لانتهاء مواعيد العمل الرسمية ({branch.openingTime || '08:00'} - {branch.closingTime || '22:00'})
            </span>
            <span className="text-[11px] text-rose-100 block mt-0.5">
              يعود المطعم لاستقبال الطلبات في أوقات العمل المحددة ({formatWorkingDaysArabic(branch.workingDays)})
            </span>
          </div>
        </div>
      )}

      {/* Menu Categories and Horizontal Card Carousels */}
      {displayedCategories.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200 shadow-sm">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-30 text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-700">لا توجد أصناف متاحة حالياً في هذا القسم</h4>
          <p className="text-xs text-slate-500 mt-1">سيتم عرض الأصناف هنا فور إضافتها من إدارة المطعم</p>
        </div>
      ) : (
        <div id="menu-categories-top" className="space-y-6">
          {displayedCategories.map((cat) => (
            <div
              key={cat.id}
              id={`category-section-${cat.id}`}
              data-category-id={cat.id}
              className="scroll-mt-24 sm:scroll-mt-28"
            >
              <CategoryCarousel
                category={cat}
                isBranchOpen={isBranchOpen}
                onItemClick={handleItemSelection}
              />
            </div>
          ))}
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 max-w-lg mx-auto z-40 pb-safe">
          <button
            onClick={() => {
              if (!isBranchOpen) {
                alert(
                  branch.operationalStatus === 'BUSY'
                    ? `عذراً، لا يمكن إتمام الطلب الآن لأن الفرع في فترة إغلاق مؤقتة.\nسيعاد الفتح تلقائياً بعد ${formatCountdown(secondsLeft)}.`
                    : 'المطعم مغلق حالياً'
                );
                return;
              }
              onOpenCart();
            }}
            className={`w-full text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between transition-all active:scale-95 border border-slate-700/50 backdrop-blur-md ${
              isBranchOpen ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-800/90'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black ${
                  isBranchOpen ? 'bg-indigo-600' : 'bg-amber-600'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">سلة المشتريات ({cartItemCount} أصناف)</div>
                <div className="text-base font-black text-white">{cartTotal} ج.م</div>
              </div>
            </div>

            <span
              className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-all ${
                isBranchOpen ? 'bg-indigo-600' : 'bg-amber-600'
              }`}
            >
              {isBranchOpen ? 'إتمام الطلب' : 'المطعم مغلق'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
