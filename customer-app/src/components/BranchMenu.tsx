import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MapPin, 
  MapPinOff,
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
  X,
  CheckCircle2,
  Copy,
  Check,
  Flame,
  Zap,
  Truck,
  ChefHat,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Download,
  User,
  LogOut,
  ShieldCheck,
  Tag,
  Ticket,
  ImageIcon
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { getDisplayAddress, getStoredClientCoords, isBranchInDeliveryZone } from '../services/campusLocations';
import { getItemFallbackImage } from '../utils/foodImages';

interface BranchMenuProps {
  branch: any;
  categories: any[];
  cart: any[];
  user?: any | null;
  onBack?: () => void;
  onSelectItem: (item: any) => void;
  onOpenCart: () => void;
  onTrackOrder?: (order: any) => void;
  onQuickReorder?: (order: any) => void;
  onRequireAuth?: () => void;
  onLogout?: () => void;
  onOpenMyOrders?: () => void;
  onOpenProfile?: () => void;
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
        container.scrollLeft += diff;
        setActiveIndex(targetCardIdx);
        requestAnimationFrame(() => {
          isNormalizing.current = false;
        });
      }
    }
  };

  const scheduleNormalization = (fromIndex?: number) => {
    if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
    normalizeTimer.current = setTimeout(() => {
      normalizeToMiddleSet(fromIndex);
    }, 450);
  };

  // تهيئة المسار إلى المجموعة المركزية فور التحميل
  useEffect(() => {
    if (items.length <= 1) return;
    const container = scrollRef.current;
    if (!container) return;

    const initPos = () => {
      const cards = container.querySelectorAll('[data-carousel-card="true"]');
      const targetCard = cards[middleSetStartIndex] as HTMLElement | undefined;
      if (targetCard) {
        const containerWidth = container.clientWidth;
        const cardWidth = targetCard.offsetWidth;
        const targetLeft = targetCard.offsetLeft - (containerWidth / 2 - cardWidth / 2);
        isNormalizing.current = true;
        container.scrollLeft = targetLeft;
        setActiveIndex(middleSetStartIndex);
        setTimeout(() => {
          isNormalizing.current = false;
        }, 100);
      }
    };

    const timer = setTimeout(initPos, 80);
    return () => clearTimeout(timer);
  }, [items.length, middleSetStartIndex]);

  // مراقبة السكرول وتحديث البطاقة النشطة بدقة
  const handleScroll = () => {
    if (isNormalizing.current || isProgrammaticScroll.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const cards = container.querySelectorAll('[data-carousel-card="true"]');
    if (cards.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;

    let closestIdx = activeIndex;
    let closestDist = Infinity;

    cards.forEach((card, idx) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const dist = Math.abs(centerX - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== activeIndex) {
      setActiveIndex(closestIdx);
    }

    if (!isTouching.current) {
      scheduleNormalization(closestIdx);
    }
  };

  const scrollToIndex = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;

    const cards = container.querySelectorAll('[data-carousel-card="true"]');
    const targetCard = cards[index] as HTMLElement | undefined;
    if (!targetCard) return;

    const containerWidth = container.clientWidth;
    const cardWidth = targetCard.offsetWidth;
    const targetLeft = targetCard.offsetLeft - (containerWidth / 2 - cardWidth / 2);

    isProgrammaticScroll.current = true;
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setActiveIndex(index);

    if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current);
    programmaticScrollTimer.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
      scheduleNormalization(index);
    }, 450);
  };

  const handleNext = () => {
    if (items.length <= 1) return;
    const nextIdx = Math.min(displayCards.length - 1, activeIndex + 1);
    scrollToIndex(nextIdx);
  };

  const handlePrev = () => {
    if (items.length <= 1) return;
    const prevIdx = Math.max(0, activeIndex - 1);
    scrollToIndex(prevIdx);
  };

  if (items.length === 0) return null;

  return (
    <div
      id={`category-section-${category.id}`}
      data-category-id={category.id}
      className="space-y-2.5 scroll-mt-24 sm:scroll-mt-28"
    >
      {/* Category Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4.5 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-full" />
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            {category.name}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 font-mono">
            ({items.length})
          </span>
        </div>

        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-90"
              title="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-90"
              title="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Infinite Horizontal Carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          isTouching.current = true;
          if (normalizeTimer.current) clearTimeout(normalizeTimer.current);
        }}
        onTouchEnd={() => {
          isTouching.current = false;
          scheduleNormalization();
        }}
        className="flex items-stretch gap-3 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayCards.map(({ item, uniqueKey }, idx) => {
          const isItemActive = idx === activeIndex;
          const isFav = favItemIds.includes(item.id);

          return (
            <div
              key={uniqueKey}
              data-carousel-card="true"
              id={`menu-item-card-${item.id}`}
              onClick={() => onItemClick(item)}
              className={`snap-center shrink-0 w-[240px] sm:w-[260px] bg-white rounded-3xl p-3 border transition-all duration-300 flex flex-col justify-between cursor-pointer select-none group relative ${
                isItemActive
                  ? 'border-indigo-400 shadow-md ring-2 ring-indigo-500/10 scale-[1.01]'
                  : 'border-slate-200/90 shadow-2xs hover:shadow-sm'
              }`}
            >
              <div>
                {/* Image Container with Badges */}
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 mb-2.5">
                  <img
                    src={item.imageUrl ? getFullImageUrl(item.imageUrl) : getItemFallbackImage(item.name, category.name, branchName)}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => onToggleFavItem(e, item.id)}
                    className="absolute top-2 left-2 p-1.5 rounded-xl bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all active:scale-90"
                    title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isFav ? 'fill-rose-500 text-rose-500' : 'text-white'
                      }`}
                    />
                  </button>

                  {/* Customization Badge */}
                  {Array.isArray(item.customizations) && item.customizations.length > 0 && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
                      خيارات متعددة
                    </span>
                  )}
                </div>

                {/* Item Details */}
                <h4 className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 leading-snug">
                  {item.name}
                </h4>

                {item.description && (
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Price & Add Action */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                {(() => {
                  const displayPrice = item.basePrice ?? item.price ?? (Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes[0].price : 0);
                  const hasMultipleSizes = Array.isArray(item.sizes) && item.sizes.length > 1;
                  return (
                    <div className="flex items-baseline gap-1">
                      {hasMultipleSizes && (
                        <span className="text-[10px] font-bold text-slate-400">من</span>
                      )}
                      <span className="text-sm sm:text-base font-black text-indigo-700 font-mono">
                        {displayPrice}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">ج.م</span>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  disabled={!isBranchOpen}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 active:scale-95 ${
                    isBranchOpen
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BranchMenu: React.FC<BranchMenuProps> = ({
  branch,
  categories,
  cart,
  user,
  onBack,
  onSelectItem,
  onOpenCart,
  onTrackOrder,
  onQuickReorder,
  onRequireAuth,
  onLogout,
  onOpenMyOrders,
  onOpenProfile,
}) => {
  // الـ 3 زراير الرئيسية للفرع: [المطعم] [الطلبات] [العروض]
  const [branchTab, setBranchTab] = useState<'RESTAURANT' | 'ORDERS' | 'DEALS'>('RESTAURANT');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [showReviewsModal, setShowReviewsModal] = useState<boolean>(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);

  // العروض والصفقات الخاطفة والبانرات التابعة للفرع
  const [flashDeals, setFlashDeals] = useState<any[]>(branch?.flashDeals || []);
  const [branchBanners, setBranchBanners] = useState<any[]>(branch?.banners || []);
  const [branchPromos, setBranchPromos] = useState<any[]>(branch?.promos || []);
  const [copiedPromoCode, setCopiedPromoCode] = useState<string | null>(null);

  // الطلبات الجارية للعميل
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  const lastOpenedBranchId = useRef<string | null>(null);

  // إعادة التمرير لأعلى الصفحة فقط عند فتح مطعم جديد لأول مرة
  useEffect(() => {
    if (typeof window !== 'undefined' && branch?.id && lastOpenedBranchId.current !== branch.id) {
      lastOpenedBranchId.current = branch.id;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [branch?.id]);

  // نسخ الرابط المباشر للمطعم
  const handleCopyDirectLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const branchKey = branch?.slug || branch?.id;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/?branch=${encodeURIComponent(branchKey)}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedDirectLink(true);
      setTimeout(() => setCopiedDirectLink(false), 2500);
    }
  };

  // تحديث البيانات عند تغير خصائص الفرع القادمة من الـ Props
  useEffect(() => {
    if (branch?.flashDeals && Array.isArray(branch.flashDeals)) {
      setFlashDeals(branch.flashDeals);
    }
    if (branch?.banners && Array.isArray(branch.banners)) {
      setBranchBanners(branch.banners);
    }
    if (branch?.promos && Array.isArray(branch.promos)) {
      setBranchPromos(branch.promos);
    }
  }, [branch]);

  // جلب فوري وتحديث حي للعروض والبانرات الترويجية التابعة لهذا المطعم
  const fetchOffersAndBanners = useRef<() => void>(() => {});
  fetchOffersAndBanners.current = async () => {
    try {
      const [dealsRes, bannersRes] = await Promise.all([
        api.getFlashDeals().catch(() => null),
        api.getBanners().catch(() => null),
      ]);

      const bId = branch?.id;
      const bSlug = branch?.slug ? String(branch.slug).toLowerCase() : '';

      // 1. تصفية العروض الخاطفة لهذا المطعم
      if (dealsRes && Array.isArray(dealsRes.deals)) {
        const relevantDeals = dealsRes.deals.filter((d: any) => {
          if (!d.branchId && !d.targetBranch) return true; // عام
          const dealBId = d.branchId || d.targetBranch?.id;
          const dealBSlug = d.targetBranch?.slug ? String(d.targetBranch.slug).toLowerCase() : '';
          return (
            dealBId === bId ||
            (bSlug && (String(dealBId).toLowerCase() === bSlug || dealBSlug === bSlug))
          );
        });
        setFlashDeals(relevantDeals);
      }

      // 2. تصفية البانرات الإعلانية لهذا المطعم
      if (Array.isArray(bannersRes)) {
        const relevantB = bannersRes.filter((b: any) => {
          if (!b.linkUrl) return true; // بانر عام
          const link = String(b.linkUrl).toLowerCase();
          return (
            (bId && link.includes(bId.toLowerCase())) ||
            (bSlug && link.includes(bSlug))
          );
        });
        setBranchBanners(relevantB);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchOffersAndBanners.current();
    const handleBannersUpdate = () => fetchOffersAndBanners.current();
    const handleDealsUpdate = () => fetchOffersAndBanners.current();

    window.addEventListener('banners_updated', handleBannersUpdate);
    window.addEventListener('flash_deals_updated', handleDealsUpdate);

    return () => {
      window.removeEventListener('banners_updated', handleBannersUpdate);
      window.removeEventListener('flash_deals_updated', handleDealsUpdate);
    };
  }, [branch?.id, branch?.slug]);

  // إجمالي العروض والبانرات والكوبونات المتاحة
  const totalOffersCount = flashDeals.length + branchBanners.length + branchPromos.length;

  // جلب ومتابعة الطلبات الحالية للعميل لحظياً
  useEffect(() => {
    let isMounted = true;
    const fetchActiveOrders = async () => {
      if (!user) {
        if (isMounted) setActiveOrders([]);
        return;
      }
      try {
        const orders = await api.getMyOrders();
        if (!isMounted || !Array.isArray(orders)) return;

        const active = orders.filter((o: any) => {
          if (!o || o.status === 'REJECTED' || o.status === 'CANCELLED') return false;
          return ['PENDING', 'PREPARING', 'ACCEPTED', 'READY', 'COMPLETED'].includes(o.status);
        });

        // ترتيب الطلبات: طلبات هذا المطعم أولاً
        const sorted = active.sort((a: any, b: any) => {
          if (a.branchId === branch?.id && b.branchId !== branch?.id) return -1;
          if (a.branchId !== branch?.id && b.branchId === branch?.id) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        setActiveOrders(sorted);
      } catch (_err) {}
    };

    fetchActiveOrders();
    const interval = setInterval(fetchActiveOrders, 8000);

    const handleUpdate = () => fetchActiveOrders();
    window.addEventListener('order_status_updated', handleUpdate);
    window.addEventListener('order_created', handleUpdate);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('order_status_updated', handleUpdate);
      window.removeEventListener('order_created', handleUpdate);
    };
  }, [user, branch?.id]);

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

  // إخفاء أي قسم فارغ لا يحتوي على أصناف متاحة للعملاء
  const nonEmptyCategories = (categories || []).filter(
    (cat) => Array.isArray(cat.items) && cat.items.length > 0
  );

  // استخراج الوجبات المفضلة للعميل داخل هذا المطعم
  const favoriteItemsInBranch: any[] = [];
  for (const cat of nonEmptyCategories) {
    for (const it of cat.items || []) {
      if (favItemIds.includes(it.id)) {
        favoriteItemsInBranch.push(it);
      }
    }
  }

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

  // مراقبة السكرول لتحديد القسم المعروض أمام المستخدم حالياً
  useEffect(() => {
    if (nonEmptyCategories.length === 0 || branchTab !== 'RESTAURANT') return;

    let ticking = false;

    const handleScroll = () => {
      if (isManualScrolling.current) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isManualScrolling.current) {
            ticking = false;
            return;
          }

          const anchorY = 170;
          const firstCatEl = document.getElementById(`category-section-${nonEmptyCategories[0]?.id}`);

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
  }, [nonEmptyCategories, branchTab]);

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // فحص نطاق التوصيل الجغرافي للمطعم
  const clientCoords = useMemo(() => getStoredClientCoords(), []);
  const zoneCheck = useMemo(() => isBranchInDeliveryZone(branch, clientCoords), [branch, clientCoords]);
  const isOutOfDeliveryZone = !zoneCheck.inZone;

  const handleItemSelection = (item: any) => {
    if (isOutOfDeliveryZone) {
      alert(
        `عذراً، هذا المطعم يقع خارج نطاق التوصيل لموقعك الحالي (${zoneCheck.distKm.toFixed(1)} كم • الحد الأقصى للنطاق: ${zoneCheck.radiusKm} كم).\nلا يمكن إضافة أصناف أو طلب وجبات منه.`
      );
      return;
    }
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

  const handleBannerClick = (banner: any) => {
    if (!banner.linkUrl) {
      setBranchTab('RESTAURANT');
      return;
    }
    const url = String(banner.linkUrl);
    let targetItemId: string | null = null;
    if (url.includes('?')) {
      const q = url.split('?')[1];
      const params = new URLSearchParams(q);
      targetItemId = params.get('offer') || params.get('item');
    }
    if (targetItemId) {
      for (const cat of displayedCategories || []) {
        const found = (cat.items || []).find((i: any) => i.id === targetItemId);
        if (found) {
          handleItemSelection(found);
          return;
        }
      }
    }
    setBranchTab('RESTAURANT');
  };

  const branchReviews: any[] = Array.isArray(branch?.reviews) ? branch.reviews : [];
  const avgRating = branch?.avgRating || (branchReviews.length > 0
    ? Number((branchReviews.reduce((acc, r) => acc + (r.rating || 5), 0) / branchReviews.length).toFixed(1))
    : 5.0);
  const ratingsCount = branch?.ratingsCount || branchReviews.length;
  const crowdLevel = branch?.crowdLevel || 'LOW';
  const estimatedPrepMins = branch?.estimatedPrepMins || '15-25 د';

  return (
    <div className="space-y-2.5 sm:space-y-3 pb-36 w-full max-w-full overflow-x-clip select-none animate-fadeIn">
      {/* Toast الإشعار بنسخ الرابط المباشر */}
      {copiedDirectLink && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-black animate-bounce border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>تم نسخ رابط المطعم المباشر بنجاح! يمكنك مشاركته مع زبائنك 📋✨</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0. الـ 3 زراير الرئيسية للفرع: [المطعم] [الطلبات] [العروض]                 */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-lg grid grid-cols-3 gap-1 sm:gap-1.5 select-none sticky top-13 z-20 mt-0">
        {/* زر المطعم */}
        <button
          type="button"
          onClick={() => setBranchTab('RESTAURANT')}
          className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            branchTab === 'RESTAURANT'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🍔</span>
          <span>المطعم</span>
        </button>

        {/* زر الطلبات */}
        <button
          type="button"
          onClick={() => setBranchTab('ORDERS')}
          className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap relative cursor-pointer ${
            branchTab === 'ORDERS'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🛵</span>
          <span>الطلبات</span>
          {activeOrders.length > 0 && (
            <span className="relative flex items-center gap-1 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                branchTab === 'ORDERS' ? 'bg-black/30 text-white' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {activeOrders.length}
              </span>
            </span>
          )}
        </button>

        {/* زر العروض */}
        <button
          type="button"
          onClick={() => setBranchTab('DEALS')}
          className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            branchTab === 'DEALS'
              ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span className="text-amber-400">🔥</span>
          <span>العروض</span>
          {totalOffersCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black shrink-0 ${
              branchTab === 'DEALS' ? 'bg-black/30 text-amber-200' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {totalOffersCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: المطعم (RESTAURANT) - تفاصيل المطعم والمنيو                        */}
      {/* ========================================================================= */}
      {branchTab === 'RESTAURANT' && (
        <div className="space-y-4 animate-fadeIn">
          {/* بطاقة هوية المطعم والشعار والبيانات */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
            {/* الشعار والاسم والعنوان والتليفون */}
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

                {/* العنوان */}
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="truncate">{getDisplayAddress(branch.address, 'موقع المطعم')}</span>
                </div>

                {/* التليفون */}
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

            {/* الصف 3: البطاقات الثلاث (التقييم، سرعة المطبخ، الحالة التشغيلية) */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center select-none">
              {/* بطاقة التقييم الموثق */}
              <button
                type="button"
                onClick={() => setShowReviewsModal(true)}
                className="p-2 sm:p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200/80 transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center shadow-2xs"
                title="انقر لعرض آراء وتقييمات العملاء"
              >
                <div className="text-amber-500 text-sm font-black flex items-center justify-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                  <span>{avgRating > 0 ? avgRating : '5.0'}</span>
                </div>
                <span className="text-[10px] text-amber-800 font-bold block mt-0.5 whitespace-nowrap">
                  {ratingsCount > 0 ? `${ratingsCount} تقييم موثق` : 'تقييمات العملاء'}
                </span>
              </button>

              {/* بطاقة ضغط وسرعة المطبخ */}
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

              {/* بطاقة الحالة التشغيلية ومواعيد العمل */}
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

            {/* الصف 4: أقسام المنيو السلسة (Category Tabs Pills) */}
            {nonEmptyCategories.length > 0 && (
              <div
                ref={categoryPillsRef}
                className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-slate-100 no-scrollbar select-none"
              >
                <button
                  id="pill-ALL"
                  onClick={() => handleCategoryClick('ALL')}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
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
                    className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
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
                      className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
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

          {/* تنبيه إذا كان المطعم خارج نطاق التوصيل الجغرافي */}
          {isOutOfDeliveryZone && (
            <div className="bg-rose-50 border-2 border-rose-200 text-rose-900 p-4 rounded-3xl shadow-sm flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 text-rose-600 mt-0.5 sm:mt-0">
                <MapPinOff className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-xs sm:text-sm text-rose-700">المطعم خارج نطاق التوصيل لموقعك الحالي 📍</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-200/70 text-rose-800">
                    المسافة: {zoneCheck.distKm.toFixed(1)} كم / أقصى نطاق: {zoneCheck.radiusKm} كم
                  </span>
                </div>
                <p className="text-[11px] text-rose-600 mt-1 leading-relaxed">
                  أنت تتصفح قائمة الطعام للاطلاع فقط؛ لا يمكن إضافة أصناف للسلة أو إرسال طلبات لهذا المطعم لأنك خارج نطاق التغطية.
                </p>
              </div>
            </div>
          )}

          {/* بانر الإغلاق المؤقت بالعداد التنازلي الحي */}
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

          {/* بانر الإغلاق العام */}
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

          {/* بانر انتهاء مواعيد العمل */}
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

          {/* أقسام المنيو وقوائم الأصناف والوجبات */}
          {displayedCategories.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200 shadow-sm">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-30 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-700">لا توجد أصناف متاحة حالياً في هذا القسم</h4>
              <p className="text-xs text-slate-500 mt-1">سيتم عرض الأصناف هنا فور إضافتها من إدارة المطعم</p>
            </div>
          ) : (
            <div id="menu-categories-top" className="space-y-6">
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

              {displayedCategories.map((category) => (
                <CategoryCarousel
                  key={category.id}
                  category={category}
                  isBranchOpen={isBranchOpen}
                  onItemClick={handleItemSelection}
                  favItemIds={favItemIds}
                  onToggleFavItem={handleToggleFavItem}
                  branchName={branch?.name}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: الطلبات (ORDERS) - متابعة الطلبات الجارية والسابقة                   */}
      {/* ========================================================================= */}
      {branchTab === 'ORDERS' && (
        <div className="space-y-4 animate-fadeIn">
          {!user ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
              <Clock className="w-12 h-12 text-indigo-400 mx-auto" />
              <h3 className="text-base font-black text-slate-900">سجّل دخولك لمتابعة طلباتك</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                قم بتسجيل الدخول للاطلاع على حالة طلباتك الحالية وتتبع خط سير الكابتن وإعادة الطلب بلمسة واحدة.
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <span>تسجيل الدخول الآن</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-black text-slate-900">لا توجد طلبات جارية حالياً</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                اختر وجبتك المفضلة من منيو المطعم واطلبها الآن لتتابع مراحل التجهيز والتوصيل مباشرة!
              </p>
              <button
                type="button"
                onClick={() => setBranchTab('RESTAURANT')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <span>تصفح المنيو واطلب الآن</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>طلباتك الحالية والمباشرة ({activeOrders.length})</span>
                </h3>
              </div>

              {activeOrders.map((order: any) => {
                const isDelivery = order.orderType === 'DELIVERY';
                const status = order.status;

                let currentStep = 0;
                if (status === 'PREPARING' || status === 'ACCEPTED') currentStep = 1;
                else if (status === 'READY') currentStep = 2;
                else if (status === 'COMPLETED') currentStep = 3;

                const steps = [
                  { label: 'في انتظار القبول', icon: Clock },
                  { label: 'جاري التجهيز', icon: ChefHat },
                  { label: isDelivery ? 'في التوصيل' : 'جاهز للاستلام', icon: isDelivery ? Truck : ShoppingBag },
                  { label: 'مكتمل', icon: CheckCircle2 },
                ];

                const itemsSummary = (order.items || [])
                  .map((it: any) => `${it.quantity}× ${it.itemName || it.name}`)
                  .join(' ، ');

                return (
                  <div
                    key={order.id}
                    onClick={() => onTrackOrder?.(order)}
                    className="bg-white rounded-3xl p-4 sm:p-5 border border-indigo-100 shadow-md hover:shadow-lg transition-all cursor-pointer relative overflow-hidden select-none space-y-3"
                  >
                    {/* خط ملون يحدد الحالة في أعلى البطاقة */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1.5 ${
                        status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : status === 'READY'
                          ? 'bg-sky-500'
                          : status === 'PREPARING' || status === 'ACCEPTED'
                          ? 'bg-indigo-600'
                          : 'bg-amber-500'
                      }`}
                    />

                    {/* تفاصيل رأس الطلب */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {isDelivery ? '🛵 توصيل مباشر' : '🛍️ استلام من الفرع'}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>مباشر</span>
                      </span>
                    </div>

                    {/* شريط المراحل الأربعة (Progress Stepper) */}
                    <div className="py-2">
                      <div className="relative flex items-center justify-between">
                        <div className="absolute top-4 right-7 left-7 h-1 bg-slate-200 z-0 rounded-full" />
                        <div
                          className="absolute top-4 right-7 h-1 bg-gradient-to-l from-indigo-600 to-emerald-500 z-0 rounded-full transition-all duration-700"
                          style={{
                            width: `${(currentStep / 3) * 100}%`,
                            maxWidth: 'calc(100% - 56px)',
                          }}
                        />

                        {steps.map((st, idx) => {
                          const Icon = st.icon;
                          const isDone = idx < currentStep;
                          const isActive = idx === currentStep;

                          return (
                            <div key={idx} className="flex flex-col items-center relative z-10 text-center w-1/4">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                  isDone
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : isActive
                                    ? 'bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100 scale-110'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <span
                                className={`text-[10px] mt-1.5 whitespace-nowrap ${
                                  isActive
                                    ? 'font-black text-indigo-700'
                                    : isDone
                                    ? 'font-bold text-emerald-700'
                                    : 'font-medium text-slate-400'
                                }`}
                              >
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ملخص الوجبات والإجراءات */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 font-medium truncate" title={itemsSummary}>
                          🍱 {itemsSummary || 'وجبة'}
                        </p>
                        <span className="text-xs font-mono font-black text-slate-900">
                          {order.total} ج.م
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onQuickReorder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickReorder(order);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>إعادة الطلب</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTrackOrder?.(order);
                          }}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>تتبع الطلب</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: العروض (DEALS) - صفقات الفلاش، البانرات الترويجية، وكوبونات الخصم */}
      {/* ========================================================================= */}
      {branchTab === 'DEALS' && (
        <div className="space-y-6 animate-fadeIn">
          {totalOffersCount === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
              <Flame className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-base font-black text-slate-900">لا توجد عروض نشطة حالياً لهذا المطعم</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                يتم تحديث العروض والبانرات والصفقات الخاطفة باستمرار؛ تصفح قائمة الطعام للاستمتاع بأشهى الوجبات!
              </p>
              <button
                type="button"
                onClick={() => setBranchTab('RESTAURANT')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <span>تصفح المنيو الآن</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. قسم البانرات الإعلانية الترويجية للمطعم */}
              {branchBanners.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-purple-600" />
                      <span>بانرات وعروض حصرية ({branchBanners.length})</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {branchBanners.map((banner: any, bIdx: number) => (
                      <div
                        key={banner.id || `banner-${bIdx}`}
                        className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-lg border border-purple-500/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
                      >
                        {banner.imageUrl && (
                          <div className="w-full sm:w-48 h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                            <img
                              src={getFullImageUrl(banner.imageUrl)}
                              alt={banner.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}

                        <div className="flex-1 space-y-1.5 text-right w-full">
                          {banner.badgeText && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 mb-1">
                              <Sparkles className="w-3 h-3" />
                              <span>{banner.badgeText}</span>
                            </span>
                          )}
                          <h4 className="text-base font-black text-white leading-snug">
                            {banner.title}
                          </h4>
                          {banner.subtitle && (
                            <p className="text-xs text-purple-200/80 leading-relaxed font-medium">
                              {banner.subtitle}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBannerClick(banner)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                        >
                          <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                          <span>اطلب العرض الآن</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. قسم عروض الفلاش والكومبو الموقوتة */}
              {flashDeals.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-500" />
                      <span>عروض وتخفيضات خاصة بالمطعم ({flashDeals.length})</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {flashDeals.map((deal: any, dIdx: number) => {
                      const isPromo = deal.type === 'PROMO' || Boolean(deal.promoCode || deal.code);
                      const isCopied = copiedPromoCode === (deal.promoCode || deal.code);

                      // استخراج الصنف المرتبط بالعرض
                      const linkedItem = deal.item || (() => {
                        if (!deal.menuItemId) return null;
                        for (const cat of displayedCategories || []) {
                          const it = (cat.items || []).find((i: any) => i.id === deal.menuItemId);
                          if (it) return it;
                        }
                        return null;
                      })();

                      return (
                        <div
                          key={deal.id || `deal-${dIdx}`}
                          className="bg-white rounded-3xl p-4 border border-rose-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 select-none"
                        >
                          <div>
                            {/* Header: Deal Badge */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-rose-500" />
                                <span>{deal.badgeText || (isPromo ? 'كوبون خصم' : 'صفقة خاطفة 🔥')}</span>
                              </span>

                              {deal.expiresAt && (
                                <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>مؤقت</span>
                                </span>
                              )}
                            </div>

                            {/* Deal Image if available */}
                            {(deal.imageUrl || linkedItem?.imageUrl) && (
                              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 mb-2.5">
                                <img
                                  src={getFullImageUrl(deal.imageUrl || linkedItem?.imageUrl)}
                                  alt={deal.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            <h4 className="font-black text-sm text-slate-900 leading-snug">
                              {deal.title}
                            </h4>

                            {deal.subtitle && (
                              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                                {deal.subtitle}
                              </p>
                            )}

                            {/* Price Details */}
                            {deal.discountPrice && (
                              <div className="flex items-baseline gap-2 mt-2 pt-2 border-t border-slate-100">
                                <span className="text-base font-black text-rose-600 font-mono">
                                  {deal.discountPrice} ج.م
                                </span>
                                {deal.originalPrice && (
                                  <span className="text-xs text-slate-400 line-through font-mono">
                                    {deal.originalPrice} ج.م
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="pt-1">
                            {isPromo ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const code = deal.promoCode || deal.code;
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(code);
                                    try {
                                      localStorage.setItem('unifood_auto_promo', code);
                                    } catch {}
                                    setCopiedPromoCode(code);
                                    setTimeout(() => setCopiedPromoCode(null), 2500);
                                  }
                                }}
                                className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-300" />
                                    <span>{`تم نسخ الكود (${deal.promoCode || deal.code}) ✓`}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    <span>{`نسخ كود الخصم (${deal.promoCode || deal.code})`}</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (linkedItem) {
                                    handleItemSelection(linkedItem);
                                  } else {
                                    setBranchTab('RESTAURANT');
                                  }
                                }}
                                className="w-full py-2 px-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-rose-600/20 cursor-pointer"
                              >
                                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                                <span>اطلب العرض الآن</span>
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. قسم كوبونات الخصم وقسائم التوفير للمطعم */}
              {branchPromos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-emerald-600" />
                      <span>كوبونات وقسائم الخصم ({branchPromos.length})</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branchPromos.map((promo: any, pIdx: number) => {
                      const isCopied = copiedPromoCode === promo.code;
                      return (
                        <div
                          key={promo.id || `promo-${pIdx}`}
                          className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-emerald-900 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300">
                                {promo.code}
                              </span>
                              <span className="text-[11px] font-black text-emerald-700">
                                {promo.discountType === 'PERCENT' || promo.discountType === 'PERCENTAGE'
                                  ? `خصم ${promo.value}%`
                                  : `خصم ${promo.value} ج.م`}
                              </span>
                            </div>
                            {promo.minOrder > 0 && (
                              <p className="text-[10px] text-slate-500">
                                الحد الأدنى للطلب: {promo.minOrder} ج.م
                              </p>
                            )}
                            {promo.description && (
                              <p className="text-[10px] text-slate-600 font-medium">
                                {promo.description}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(promo.code);
                                try {
                                  localStorage.setItem('unifood_auto_promo', promo.code);
                                } catch {}
                                setCopiedPromoCode(promo.code);
                                setTimeout(() => setCopiedPromoCode(null), 2500);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0 ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-600/10 text-emerald-800 hover:bg-emerald-600/20'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>تم النسخ ✓</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ الكود</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* نافذة تقييمات وآراء العملاء */}
      {showReviewsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                <h3 className="font-black text-sm text-slate-900">تقييمات عملاء {branch.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewsModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Average summary */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 block">متوسط التقييم العام</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-slate-900 font-mono">
                      {avgRating > 0 ? avgRating : '5.0'}
                    </span>
                    <span className="text-xs font-bold text-amber-700">من 5 نجوم</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    بناءً على {ratingsCount} طلب وتقييم فعلي من العملاء
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
                    كن أول من يطلب من {branch.name} ويشارك تجربته وتقييمه مع الآخرين!
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
                            {(rev.customerName || 'ع').charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-slate-900">
                                {rev.customerName || 'عميل موثق'}
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
              if (isOutOfDeliveryZone) {
                alert(`عذراً، هذا المطعم يقع خارج نطاق التوصيل لموقعك الحالي (${zoneCheck.distKm.toFixed(1)} كم • الحد الأقصى للنطاق: ${zoneCheck.radiusKm} كم). لا يمكن إتمام الطلب.`);
                return;
              }
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
            className={`w-full text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between transition-all active:scale-95 border backdrop-blur-md cursor-pointer ${
              isOutOfDeliveryZone
                ? 'bg-rose-950/95 border-rose-800/80 hover:bg-rose-900/95 shadow-rose-950/30'
                : isBranchOpen
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-700/50'
                : 'bg-slate-800/90 border-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black ${
                  isOutOfDeliveryZone ? 'bg-rose-600' : isBranchOpen ? 'bg-indigo-600' : 'bg-amber-600'
                }`}
              >
                {isOutOfDeliveryZone ? <MapPinOff className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">سلة المشتريات ({cartItemCount} أصناف)</div>
                <div className="text-base font-black text-white">{cartTotal} ج.م</div>
              </div>
            </div>

            <span
              className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-all ${
                isOutOfDeliveryZone ? 'bg-rose-600' : isBranchOpen ? 'bg-indigo-600' : 'bg-amber-600'
              }`}
            >
              {isOutOfDeliveryZone ? 'خارج نطاق التوصيل 🚫' : isBranchOpen ? 'إتمام الطلب' : 'المطعم مغلق'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
