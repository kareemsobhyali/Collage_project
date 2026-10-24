import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Phone, 
  Plus, 
  ShoppingBag, 
  Store,
  Clock,
  PowerOff,
  ChevronRight,
  ChevronLeft,
  UtensilsCrossed,
  Heart,
  Star,
  MessageSquare,
  X,
  CheckCircle2
} from 'lucide-react';
import { getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { getDisplayAddress } from '../services/campusLocations';
import { getItemFallbackImage } from '../utils/foodImages';

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
  favItemIds: string[];
  onToggleFavItem: (e: React.MouseEvent, itemId: string) => void;
  branchName?: string;
}

const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  category,
  isBranchOpen,
  onItemClick,
  favItemIds,
  onToggleFavItem,
  branchName = '',
}) => {
  const items: any[] = Array.isArray(category.items) ? category.items : [];
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // إنشاء مسار لا نهائي مكرر بحساب دقيق لضمان استمرارية السكرول بدون توقف
  const { displayCards, middleSetStartIndex, middleSetIndex } = useMemo(() => {
    if (items.length <= 1) {
      return {
        displayCards: items.map((item, idx) => ({
          item,
          originalIndex: idx,
          uniqueKey: `item-${item.id || idx}`,
        })),
        middleSetStartIndex: 0,
        middleSetIndex: 0,
      };
    }

    // نضمن 15 بطاقة على الأقل كمسار متصل ومستمر للسحب
    const minCards = 15;
    const rawRepeats = Math.max(3, Math.ceil(minCards / items.length));
    const repeats = rawRepeats % 2 === 0 ? rawRepeats + 1 : rawRepeats;
    const midSet = Math.floor(repeats / 2);

    const cards: Array<{
      item: any;
      originalIndex: number;
      uniqueKey: string;
    }> = [];

    for (let s = 0; s < repeats; s++) {
      for (let i = 0; i < items.length; i++) {
        cards.push({
          item: items[i],
          originalIndex: i,
          uniqueKey: `item-${items[i].id || i}-set-${s}`,
        });
      }
    }

    return {
      displayCards: cards,
      middleSetStartIndex: midSet * items.length,
      middleSetIndex: midSet,
    };
  }, [items]);

  const [activeIndex, setActiveIndex] = useState<number>(middleSetStartIndex);
  const isTouching = useRef<boolean>(false);
  const isNormalizing = useRef<boolean>(false);
  const isProgrammaticScroll = useRef<boolean>(false);
  const normalizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // إعادة المحاذاة غير المرئية إلى المجموعة المركزية بدون أي قفز بصري
  const normalizeToMiddleSet = (fromIndex?: number) => {
    if (items.length <= 1 || isTouching.current || isProgrammaticScroll.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const currentIdx = typeof fromIndex === 'number' ? fromIndex : activeIndex;
    const currentSet = Math.floor(currentIdx / items.length);

    if (currentSet === middleSetIndex) return;

    const itemPos = currentIdx % items.length;
    const targetCardIdx = middleSetStartIndex + itemPos;

    const cards = container.querySelectorAll('[data-carousel-card="true"]');
    const currentCard = cards[currentIdx] as HTMLElement | undefined;
    const targetCard = cards[targetCardIdx] as HTMLElement | undefined;

    if (currentCard && targetCard) {
      const currentCardRect = currentCard.getBoundingClientRect();
      const targetCardRect = targetCard.getBoundingClientRect();
      const diff = targetCardRect.left - currentCardRect.left;

      if (Math.abs(diff) > 2) {
        isNormalizing.current = true;
        container.scrollBy({
          left: diff,
          behavior: 'instant' as ScrollBehavior,
        });
        setActiveIndex(targetCardIdx);
        requestAnimationFrame(() => {
          isNormalizing.current = false;
        });
      }
    }
  };

  const centerCardInContainer = (index: number, smooth: boolean) => {
    const container = scrollRef.current;
    if (!container || displayCards.length === 0) return;
    const bounded = Math.max(0, Math.min(index, displayCards.length - 1));
    const cards = container.querySelectorAll('[data-carousel-card="true"]');
    const target = cards[bounded] as HTMLElement | undefined;
    if (target) {
      isProgrammaticScroll.current = true;
      if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current);

      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const diff = (tRect.left + tRect.width / 2) - (cRect.left + cRect.width / 2);
      if (Math.abs(diff) > 2) {
        container.scrollBy({
          left: diff,
          behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior),
        });
      }
      setActiveIndex(bounded);
      programmaticScrollTimer.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
        if (items.length > 1) {
          normalizeToMiddleSet(bounded);
        }
      }, smooth ? 350 : 50);
    }
  };

  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || displayCards.length === 0) {
      setActiveIndex(0);
      return;
    }
    // نقوم بالتوسيط على بداية المجموعات فقط لأول مرة عند بناء الكاروسيل لمنع إعادة التمرير للأول عند العودة من شاشة الصنف
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      setActiveIndex(middleSetStartIndex);
      const timer = setTimeout(() => {
        centerCardInContainer(middleSetStartIndex, false);
      }, 60);
      return () => {
        clearTimeout(timer);
        if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
        if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current);
      };
    }
  }, [category.id, items.length, middleSetStartIndex]);

  const handleScroll = () => {
    if (isNormalizing.current || isProgrammaticScroll.current) return;
    const container = scrollRef.current;
    if (!container || displayCards.length <= 1) return;

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

    if (items.length > 1) {
      if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
      normalizeTimer.current = setTimeout(() => {
        if (!isTouching.current && !isProgrammaticScroll.current) {
          normalizeToMiddleSet(closestIdx);
        }
      }, 150);
    }
  };

  const scrollToCard = (index: number) => {
    centerCardInContainer(index, true);
  };

  const handleTouchStart = () => {
    isTouching.current = true;
    if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
  };

  const handleTouchEnd = () => {
    isTouching.current = false;
    if (items.length > 1) {
      if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
      normalizeTimer.current = setTimeout(() => {
        if (!isTouching.current && !isProgrammaticScroll.current) {
          normalizeToMiddleSet();
        }
      }, 180);
    }
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
              className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm active:scale-90"
              title="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToCard(activeIndex + 1)}
              className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm active:scale-90"
              title="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Peek Carousel (Endless continuous track) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`flex items-stretch overflow-x-auto snap-x snap-mandatory no-scrollbar py-2 -mx-3 sm:-mx-4 ${
          items.length === 1
            ? 'justify-center px-6'
            : 'gap-3 px-[16%] sm:px-[22%]'
        }`}
      >
        {displayCards.map((cardData, idx: number) => {
          const item = cardData.item;
          const isCenter = displayCards.length === 1 || idx === activeIndex;
          const isItemAvailable = item.isAvailable !== false && (!item.unavailableUntil || new Date() >= new Date(item.unavailableUntil));
          const isFavItem = favItemIds.includes(item.id);
          const fallbackImg = getItemFallbackImage(item.name, category?.name, branchName);
          const displayImg = item.imageUrl ? getFullImageUrl(item.imageUrl) : fallbackImg;

          return (
            <div
              key={cardData.uniqueKey}
              id={`menu-item-card-${item.id}`}
              data-carousel-card="true"
              onClick={() => {
                if (!isCenter && displayCards.length > 1) {
                  scrollToCard(idx);
                  return;
                }
                if (!isItemAvailable) {
                  alert(`عذراً، صنف "${item.name}" غير متوفر حالياً بالمطعم.`);
                  return;
                }
                if (typeof window !== 'undefined') {
                  const currentY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
                  sessionStorage.setItem('unifood_last_item_scroll_y', String(currentY));
                  sessionStorage.setItem('unifood_last_item_id', item.id);
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
                {/* Card Top Image with smart categorized fallback */}
                <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 mb-3">
                  <img
                    src={displayImg}
                    alt={item.name}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== fallbackImg) {
                        target.src = fallbackImg;
                      }
                    }}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />

                  {/* Favorite Heart Button on Meal Card */}
                  <button
                    type="button"
                    onClick={(e) => onToggleFavItem(e, item.id)}
                    title={isFavItem ? 'إزالة من وجباتي المفضلة' : 'حفظ في وجباتي المفضلة'}
                    className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md border transition-all active:scale-90 ${
                      isFavItem
                        ? 'bg-rose-500 text-white border-rose-300 shadow-md'
                        : 'bg-black/40 text-white hover:bg-black/60 border-white/25'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFavItem ? 'fill-white' : ''}`} />
                  </button>

                  {/* Unavailable / Sold Out Badge */}
                  {!isItemAvailable ? (
                    <div className="absolute top-2 right-2 bg-rose-600/95 backdrop-blur-md text-white px-2.5 py-0.5 rounded-xl text-[10px] font-black shadow-md border border-white/20">
                      غير متوفر الآن
                    </div>
                  ) : item.flashDeal ? (
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-rose-600 to-amber-500 text-white px-2 py-0.5 rounded-xl text-[10px] font-black shadow-md border border-white/30 flex items-center gap-1 animate-pulse">
                      <span>🔥</span>
                      <span>{item.flashDeal.badgeText || 'عرض فلاش'}</span>
                    </div>
                  ) : null}

                  {/* Price Badge Floating on Image */}
                  <div className="absolute bottom-2 right-2 bg-slate-900/85 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-md border border-white/15 flex items-center gap-1.5">
                    {item.originalBasePrice && item.originalBasePrice > item.basePrice ? (
                      <>
                        <span className="text-rose-400 font-black">{item.basePrice} ج.م</span>
                        <span className="line-through text-slate-400 text-[10px] font-normal">{item.originalBasePrice} ج.م</span>
                      </>
                    ) : (
                      <span>{item.basePrice} ج.م</span>
                    )}
                  </div>
                </div>

                {/* Item Title & Description */}
                <div className="px-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-black text-sm text-slate-900 line-clamp-1">
                      {item.name}
                    </h4>
                    {item.originalBasePrice && item.originalBasePrice > item.basePrice && (
                      <span className="shrink-0 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded-md">
                        وفر {Math.round(item.originalBasePrice - item.basePrice)} ج.م
                      </span>
                    )}
                  </div>
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
          {items.map((item: any, idx: number) => {
            const activeRealIndex = ((activeIndex % items.length) + items.length) % items.length;
            const isActive = idx === activeRealIndex;
            return (
              <button
                key={`dot-${item.id || idx}`}
                type="button"
                onClick={() => scrollToCard(middleSetStartIndex + idx)}
                className={`h-1.5 rounded-full transition-all ${
                  isActive
                    ? 'w-5 bg-indigo-600'
                    : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`انتقال إلى ${item.name}`}
              />
            );
          })}
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
  const [showReviewsModal, setShowReviewsModal] = useState<boolean>(false);

  const lastOpenedBranchId = useRef<string | null>(null);

  // إعادة التمرير لأعلى الصفحة فقط عند فتح مطعم جديد لأول مرة، وليس عند العودة من شاشات الأصناف
  useEffect(() => {
    if (typeof window !== 'undefined' && branch?.id && lastOpenedBranchId.current !== branch.id) {
      lastOpenedBranchId.current = branch.id;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [branch?.id]);

  // Favorite Meals stored in localStorage
  const [favItemIds, setFavItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unifood_fav_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleToggleFavItem = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setFavItemIds((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      try {
        localStorage.setItem('unifood_fav_items', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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

  // استخراج الوجبات المفضلة للطالب داخل هذا المطعم
  const favoriteItemsInBranch: any[] = [];
  for (const cat of nonEmptyCategories) {
    for (const it of cat.items || []) {
      if (favItemIds.includes(it.id)) {
        favoriteItemsInBranch.push(it);
      }
    }
  }

  // عرض كافة الأقسام دائماً في الصفحة دون إخفاء أي قسم
  const displayedCategories = nonEmptyCategories;

  const isManualScrolling = useRef<boolean>(false);
  const categoryPillsRef = useRef<HTMLDivElement | null>(null);
  const activeCategoryRef = useRef<string>(activeCategoryId);

  useEffect(() => {
    activeCategoryRef.current = activeCategoryId;
  }, [activeCategoryId]);

  const centerPillInContainer = (catId: string) => {
    const container = categoryPillsRef.current;
    const pill = document.getElementById(`pill-${catId}`);
    if (container && pill) {
      const cRect = container.getBoundingClientRect();
      const pRect = pill.getBoundingClientRect();
      const diff = (pRect.left + pRect.width / 2) - (cRect.left + cRect.width / 2);
      if (Math.abs(diff) > 15) {
        container.scrollBy({ left: diff, behavior: 'smooth' });
      }
    }
  };

  // التمرير السلس إلى القسم المطلوب عند الضغط عليه دون إخفاء باقي الأقسام
  const handleCategoryClick = (catId: string) => {
    setActiveCategoryId(catId);
    activeCategoryRef.current = catId;
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

    centerPillInContainer(catId);

    setTimeout(() => {
      isManualScrolling.current = false;
    }, 850);
  };

  // مراقبة السكرول بالاتجاهين (لأعلى ولأسفل) لتحديد القسم المعروض أمام المستخدم حالياً
  useEffect(() => {
    if (nonEmptyCategories.length === 0) return;

    let ticking = false;

    const handleScroll = () => {
      if (isManualScrolling.current) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isManualScrolling.current) {
            ticking = false;
            return;
          }

          const anchorY = 170; // نقطة استشعار القسم الحالي على الشاشة (أسفل الهيدر)
          const firstCatEl = document.getElementById(`category-section-${nonEmptyCategories[0]?.id}`);

          // إذا صعد المستخدم لأعلى فوق الأقسام، ننشط زر "كافة الأقسام"
          if (firstCatEl) {
            const firstRect = firstCatEl.getBoundingClientRect();
            if (firstRect.top > anchorY) {
              if (activeCategoryRef.current !== 'ALL') {
                setActiveCategoryId('ALL');
                activeCategoryRef.current = 'ALL';
                centerPillInContainer('ALL');
              }
              ticking = false;
              return;
            }
          }

          // فحص القسم الذي يغطي نقطة الاستشعار سواء أثناء التمرير لأعلى أو لأسفل
          let currentCatId: string | null = null;
          for (let i = 0; i < nonEmptyCategories.length; i++) {
            const cat = nonEmptyCategories[i];
            const el = document.getElementById(`category-section-${cat.id}`);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            if (rect.top <= anchorY && rect.bottom > anchorY) {
              currentCatId = cat.id;
              break;
            }
          }

          // عند الوصول لنهاية الصفحة ننشط آخر قسم
          if (!currentCatId && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
            currentCatId = nonEmptyCategories[nonEmptyCategories.length - 1]?.id;
          }

          if (currentCatId && currentCatId !== activeCategoryRef.current) {
            setActiveCategoryId(currentCatId);
            activeCategoryRef.current = currentCatId;
            centerPillInContainer(currentCatId);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  const branchReviews: any[] = Array.isArray(branch?.reviews) ? branch.reviews : [];
  const avgRating = branch?.avgRating || (branchReviews.length > 0
    ? Number((branchReviews.reduce((acc, r) => acc + (r.rating || 5), 0) / branchReviews.length).toFixed(1))
    : 0);
  const ratingsCount = branch?.ratingsCount || branchReviews.length;
  const crowdLevel = branch?.crowdLevel || 'LOW';
  const estimatedPrepMins = branch?.estimatedPrepMins || '15-25 د';

  return (
    <div className="space-y-5 pb-36 w-full max-w-full overflow-x-clip">
      {/* Top Navigation & Branch Info Card (Design 3: 3-Stat Geometric Grid) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
        {/* Row 1: Back Button & Context Title */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 text-slate-700 text-xs font-bold transition-all active:scale-95 group shadow-2xs"
            title="العودة لقائمة المطاعم"
          >
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            <span>المطاعم</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 hidden sm:inline">
              قائمة المنيو
            </span>
          </div>
        </div>

        {/* Row 2: Restaurant Identity */}
        <div className="flex items-center gap-3.5 sm:gap-4">
          {branch.logoUrl ? (
            <img
              src={getFullImageUrl(branch.logoUrl)}
              alt={branch.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-slate-200/80 shadow-xs shrink-0 bg-white p-0.5"
            />
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
              <Store className="w-7 h-7" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug truncate">
              {branch.name}
            </h2>

            {/* Campus Location */}
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate">{getDisplayAddress(branch.address, 'داخل الحرم الجامعي')}</span>
            </div>

            {/* Phone contact if available */}
            {branch.phone && (
              <div className="mt-1">
                <a
                  href={`tel:${branch.phone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <Phone className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>{branch.phone}</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: The 3 Equal Geometric Metric Badges (Zero Clutter, Rating appears ONLY in Card 1) */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center select-none">
          {/* Card 1: Verified Rating (The ONLY Place - Clickable to open reviews) */}
          <button
            type="button"
            onClick={() => setShowReviewsModal(true)}
            className="p-2 sm:p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200/80 transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-2xs"
            title="انقر لعرض آراء وتقييمات الطلاب"
          >
            <div className="text-amber-500 text-sm font-black flex items-center justify-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
              <span>{avgRating > 0 ? avgRating : 'جديد'}</span>
            </div>
            <span className="text-[10px] text-amber-800 font-bold block mt-0.5 whitespace-nowrap">
              {ratingsCount > 0 ? `${ratingsCount} تقييم موثق` : 'تقييم الطلاب'}
            </span>
          </button>

          {/* Card 2: Kitchen Speed & Crowd Indicator */}
          <div
            className={`p-2 sm:p-2.5 rounded-2xl border flex flex-col items-center justify-center ${
              crowdLevel === 'HIGH'
                ? 'bg-rose-50 border-rose-200/80 text-rose-900'
                : crowdLevel === 'MEDIUM'
                ? 'bg-amber-50 border-amber-200/80 text-amber-900'
                : 'bg-emerald-50 border-emerald-200/80 text-emerald-900'
            }`}
          >
            <div className="text-sm font-black flex items-center justify-center gap-1 font-mono">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  crowdLevel === 'HIGH'
                    ? 'bg-rose-500 animate-ping'
                    : crowdLevel === 'MEDIUM'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <span>~{estimatedPrepMins}</span>
            </div>
            <span className="text-[10px] font-bold block mt-0.5 whitespace-nowrap truncate max-w-full">
              {crowdLevel === 'HIGH'
                ? 'ضغط عالي 🔴'
                : crowdLevel === 'MEDIUM'
                ? 'مطبخ متوسط 🟡'
                : 'مطبخ هادئ 🟢'}
            </span>
          </div>

          {/* Card 3: Operational Status & Working Hours */}
          <div
            className={`p-2 sm:p-2.5 rounded-2xl border flex flex-col items-center justify-center ${
              !isBranchOpen
                ? 'bg-rose-50 border-rose-200/80 text-rose-900'
                : branch.operationalStatus === 'BUSY' && secondsLeft > 0
                ? 'bg-amber-50 border-amber-200/80 text-amber-900 animate-pulse'
                : 'bg-indigo-50/70 border-indigo-100 text-indigo-950'
            }`}
          >
            <div className="text-xs sm:text-sm font-black whitespace-nowrap">
              {branch?.isActive === false
                ? 'موقوف'
                : branch.operationalStatus === 'CLOSED'
                ? 'مغلق'
                : branch.operationalStatus === 'BUSY' && secondsLeft > 0
                ? 'استراحة'
                : !isWithinWorkingHours
                ? 'خارج المواعيد'
                : 'مفتوح للطلب'}
            </div>
            <span className="text-[10px] font-bold text-slate-500 block mt-0.5 whitespace-nowrap">
              {branch.operationalStatus === 'BUSY' && secondsLeft > 0
                ? formatCountdown(secondsLeft)
                : branch.closingTime
                ? `حتى ${branch.closingTime}`
                : 'متاح الآن'}
            </span>
          </div>
        </div>

        {/* Row 4: Category Tabs with Modern Smooth Pills */}
        {nonEmptyCategories.length > 0 && (
          <div ref={categoryPillsRef} className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-slate-100 no-scrollbar select-none">
            <button
              id="pill-ALL"
              onClick={() => handleCategoryClick('ALL')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                activeCategoryId === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              <span>كافة الأقسام</span>
            </button>

            {favoriteItemsInBranch.length > 0 && (
              <button
                id="pill-FAV"
                onClick={() => handleCategoryClick('FAV')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                  activeCategoryId === 'FAV'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20 scale-[1.02]'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${activeCategoryId === 'FAV' ? 'fill-white' : 'fill-rose-500 text-rose-500'}`} />
                <span>مفضلتي</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeCategoryId === 'FAV' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-800'
                }`}>
                  {favoriteItemsInBranch.length}
                </span>
              </button>
            )}

            {nonEmptyCategories.map((cat) => {
              const isActive = activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`pill-${cat.id}`}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {cat.items.length}
                  </span>
                </button>
              );
            })}
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
          {/* قسم الوجبات المفضلة للطالب داخل هذا المطعم */}
          {favoriteItemsInBranch.length > 0 && (
            <div
              id="category-section-FAV"
              data-category-id="FAV"
              className="scroll-mt-24 sm:scroll-mt-28 bg-rose-50/50 p-3 rounded-3xl border border-rose-100"
            >
              <CategoryCarousel
                category={{ id: 'FAV', name: '❤️ وجباتي المفضلة في المطعم', items: favoriteItemsInBranch }}
                isBranchOpen={isBranchOpen}
                onItemClick={handleItemSelection}
                favItemIds={favItemIds}
                onToggleFavItem={handleToggleFavItem}
                branchName={branch?.name}
              />
            </div>
          )}

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
                favItemIds={favItemIds}
                onToggleFavItem={handleToggleFavItem}
                branchName={branch?.name}
              />
            </div>
          ))}
        </div>
      )}

      {/* Verified Student Reviews Modal ⭐ */}
      {showReviewsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Star className="w-5 h-5 fill-slate-950" />
                </div>
                <div>
                  <h3 className="font-black text-sm">تقييمات ومراجعات الطلاب ⭐</h3>
                  <span className="text-[11px] text-slate-300">{branch.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Summary Score Card */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 block">متوسط التقييم العام</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-slate-900 font-mono">
                      {avgRating > 0 ? avgRating : '5.0'}
                    </span>
                    <span className="text-xs font-bold text-amber-700">من 5 نجوم</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    بناءً على {ratingsCount} طلب وتقييم فعلي من طلاب الجامعة
                  </span>
                </div>
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((st) => (
                    <Star
                      key={st}
                      className={`w-5 h-5 ${st <= Math.round(avgRating || 5) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Reviews List */}
              {branchReviews.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <Star className="w-12 h-12 mx-auto text-amber-300 opacity-60" />
                  <h4 className="font-bold text-slate-700 text-sm">لا توجد تعليقات مكتوبة بعد</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    كن أول من يطلب من {branch.name} ويشارك تجربته وتقييمه مع زملائه في الجامعة!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {branchReviews.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                            {(rev.customerName || 'ط').charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-slate-900">
                                {rev.customerName || 'طالب جامعي'}
                              </span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('ar-EG') : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span className="text-xs font-black text-amber-900 font-mono">{rev.rating}</span>
                        </div>
                      </div>

                      {rev.review && (
                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100">
                          "{rev.review}"
                        </p>
                      )}

                      {rev.itemsSummary && (
                        <div className="text-[10px] text-indigo-700 font-bold flex items-center gap-1 truncate">
                          <span>🍱 طلب:</span>
                          <span className="truncate">{rev.itemsSummary}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
