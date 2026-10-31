import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  X,
  Heart,
  Star,
  Flame,
  Zap,
  Copy,
  Check,
  RotateCcw,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours, sanitizePromoCodeValue } from '../services/api';
import {
  getDisplayAddress,
  CAMPUS_LANDMARKS,
  calculateDistanceMeters,
  extractCoordinatesFromAddress,
  DEFAULT_CAMPUS_RESTAURANT_COORDS,
  getNearestLocationName,
  isBranchInDeliveryZone,
  findBranchForBanner,
  getStoredClientCoords
} from '../services/campusLocations';

interface BranchListProps {
  branches: any[];
  onSelectBranch: (branch: any, autoOpenItemId?: string | null) => void;
  onQuickReorder?: (order: any) => void;
  onTrackOrder?: (order: any) => void;
  user?: any | null;
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

const PROMO_BANNER_GRADIENTS = [
  'from-purple-950 via-indigo-900 to-blue-950',
  'from-indigo-950 via-purple-900 to-rose-950',
  'from-slate-950 via-indigo-950 to-blue-900',
  'from-emerald-950 via-teal-900 to-indigo-950',
  'from-rose-950 via-pink-900 to-purple-950'
];

const FOOD_EMOJIS = ['🍔', '🍕', '🌯', '🥪', '☕', '🍗', '🍟', '🥤', '🧇', '🍝'];

const formatFlashCountdown = (expiresAtIso?: string): string => {
  if (!expiresAtIso) return '02:00:00';
  const diffSec = Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

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

  if (branch.isOnline !== true) {
    return (
      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-slate-800 text-rose-300 backdrop-blur-md shadow-sm border border-rose-500/30 shrink-0 flex items-center gap-1">
        <PowerOff className="w-3 h-3 text-rose-400" />
        <span>مغلق مؤقتاً (غير متصل)</span>
      </span>
    );
  }

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

export const BranchList: React.FC<BranchListProps> = ({ branches, onSelectBranch, onQuickReorder, onTrackOrder, user }) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'FAVORITES' | 'DELIVERY' | 'PICKUP'>('ALL');
  const [mainTab, setMainTab] = useState<'RESTAURANTS' | 'FLASH_DEALS' | 'ACTIVE_ORDERS'>('RESTAURANTS');
  const [dealsFilter, setDealsFilter] = useState<'ALL' | 'COMBOS' | 'PROMOS'>('ALL');

  // Listen for global tab switch events if triggered from headers or modals
  useEffect(() => {
    const handleSwitchToDeals = () => setMainTab('FLASH_DEALS');
    const handleSwitchToOrders = () => setMainTab('ACTIVE_ORDERS');
    const handleSwitchToRestaurants = () => setMainTab('RESTAURANTS');
    window.addEventListener('unifood_switch_tab_deals', handleSwitchToDeals);
    window.addEventListener('unifood_switch_tab_orders', handleSwitchToOrders);
    window.addEventListener('unifood_switch_tab_restaurants', handleSwitchToRestaurants);
    return () => {
      window.removeEventListener('unifood_switch_tab_deals', handleSwitchToDeals);
      window.removeEventListener('unifood_switch_tab_orders', handleSwitchToOrders);
      window.removeEventListener('unifood_switch_tab_restaurants', handleSwitchToRestaurants);
    };
  }, []);

  // Favorite Branches stored in localStorage
  const [favBranchIds, setFavBranchIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unifood_fav_branches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavoriteBranch = (e: React.MouseEvent, branchId: string) => {
    e.stopPropagation();
    setFavBranchIds((prev) => {
      const next = prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId];
      try {
        localStorage.setItem('unifood_fav_branches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Usual Order ("اطلب وجبتك المعتادة بضغطة واحدة")
  const [usualOrder, setUsualOrder] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadUsualOrder = async () => {
      try {
        if (user) {
          const orders = await api.getMyOrders();
          if (isMounted && Array.isArray(orders) && orders.length > 0) {
            // البحث عن أكثر وجبة/مطعم تكرر طلبه من العميل أو آخر طلب ناجح له
            const validOrders = orders.filter((o: any) => o.status !== 'REJECTED' && Array.isArray(o.items) && o.items.length > 0);
            if (validOrders.length > 0) {
              const freqMap = new Map<string, { count: number; order: any }>();
              for (const ord of validOrders) {
                const sig = `${ord.branchId}__${(ord.items || []).map((i: any) => `${i.menuItemId || i.itemName}:${i.quantity}`).sort().join('|')}`;
                const existing = freqMap.get(sig);
                if (existing) {
                  existing.count += 1;
                } else {
                  freqMap.set(sig, { count: 1, order: ord });
                }
              }
              let best = validOrders[0];
              let maxCount = 1;
              for (const entry of freqMap.values()) {
                if (entry.count > maxCount) {
                  maxCount = entry.count;
                  best = entry.order;
                }
              }
              setUsualOrder({ ...best, repeatCount: maxCount });
              return;
            }
          }
        }
        // Fallback to localStorage last order
        const cachedLast = localStorage.getItem('unifood_last_order');
        if (cachedLast && isMounted) {
          const parsed = JSON.parse(cachedLast);
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            setUsualOrder(parsed);
          }
        }
      } catch (_e) {}
    };
    loadUsualOrder();
    return () => {
      isMounted = false;
    };
  }, [user?.id, branches.length]);

  // Client Live GPS Location & Automatic Delivery Radius Filter (طلب 10)
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem('unifood_client_gps_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          return { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch {}
    return null;
  });

  const [clientPlaceName, setClientPlaceName] = useState<string>(() => {
    try {
      return localStorage.getItem('unifood_client_gps_name') || '';
    } catch {
      return '';
    }
  });

  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);

  const detectClientGps = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setIsDetectingGps(false);
      return;
    }

    setIsDetectingGps(true);

    const handleSuccess = async (pos: GeolocationPosition) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setClientCoords(coords);
      setIsDetectingGps(false);
      try {
        localStorage.setItem('unifood_client_gps_coords', JSON.stringify(coords));
      } catch {}
      try {
        const place = await getNearestLocationName(coords.lat, coords.lng);
        if (place?.title) {
          setClientPlaceName(place.title);
          localStorage.setItem('unifood_client_gps_name', place.title);
        }
      } catch {}
    };

    const handleError = () => {
      // Fallback with lower accuracy if high accuracy timed out or failed
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        () => {
          setIsDetectingGps(false);
        },
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    detectClientGps();
  }, [detectClientGps]);

  // Flash Deals Countdown State
  const [flashDeals, setFlashDeals] = useState<{ deals?: any[]; promoDeals: any[]; comboDeals: any[] }>({ deals: [], promoDeals: [], comboDeals: [] });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const fetchFlash = () => {
      api.getFlashDeals()
        .then((res) => {
          if (res) {
            setFlashDeals({
              deals: Array.isArray(res.deals) ? res.deals : [],
              promoDeals: Array.isArray(res.promoDeals) ? res.promoDeals : [],
              comboDeals: Array.isArray(res.comboDeals) ? res.comboDeals : [],
            });
          }
        })
        .catch(() => {});
    };
    fetchFlash();
    const timer = setInterval(() => setTick((t) => t + 1), 1000);

    window.addEventListener('flash_deals_updated', fetchFlash);
    return () => {
      clearInterval(timer);
      window.removeEventListener('flash_deals_updated', fetchFlash);
    };
  }, []);

  // Dynamic Promotional Banners from Admin with Touch / Mouse Horizontal Scroll
  const [banners, setBanners] = useState<any[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const bannerScrollRef = useRef<HTMLDivElement | null>(null);
  const activeBannerIdxRef = useRef<number>(0);
  const isInteractingRef = useRef<boolean>(false);
  const isProgrammaticScroll = useRef<boolean>(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);
  const mouseStartXRef = useRef<number>(0);
  const mouseScrollLeftRef = useRef<number>(0);
  const mouseMovedRef = useRef<boolean>(false);
  const scrollDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeBannerIdxRef.current = activeBannerIdx;
  }, [activeBannerIdx]);

  useEffect(() => {
    const fetchBanners = () => {
      api.getBanners().then((data) => {
        if (Array.isArray(data)) {
          setBanners(data);
        }
      }).catch(err => console.error('Failed to load banners:', err));
    };

    fetchBanners();

    window.addEventListener('banners_updated', fetchBanners);
    return () => window.removeEventListener('banners_updated', fetchBanners);
  }, []);

  // فلترة البانرات الإعلانية: إخفاء أي بانر يروج لمطعم يقع خارج نطاق العميل (طلب المستخدم)
  const visibleBanners = useMemo(() => {
    return banners.filter(banner => {
      if (!clientCoords) return true;
      const targetBranch = findBranchForBanner(banner, branches);
      if (targetBranch) {
        const check = isBranchInDeliveryZone(targetBranch, clientCoords);
        if (!check.inZone) return false;
      }
      return true;
    });
  }, [banners, clientCoords, branches]);

  const scrollToBanner = (index: number, smooth: boolean = true) => {
    const container = bannerScrollRef.current;
    if (!container || visibleBanners.length === 0) return;
    const bounded = Math.max(0, Math.min(index, visibleBanners.length - 1));
    const slides = container.querySelectorAll('[data-banner-slide="true"]');
    const target = slides[bounded] as HTMLElement | undefined;
    if (target) {
      isProgrammaticScroll.current = true;
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const diff = (tRect.left + tRect.width / 2) - (cRect.left + cRect.width / 2);
      if (Math.abs(diff) > 2) {
        container.scrollBy({
          left: diff,
          behavior: smooth ? 'smooth' : 'instant',
        });
      }
      setActiveBannerIdx(bounded);
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, smooth ? 450 : 60);
    }
  };

  useEffect(() => {
    if (visibleBanners.length <= 1) return;
    const interval = setInterval(() => {
      if (!isInteractingRef.current && !isMouseDownRef.current) {
        const next = (activeBannerIdxRef.current + 1) % visibleBanners.length;
        scrollToBanner(next, true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [visibleBanners.length]);

  const handleBannerScroll = () => {
    if (isProgrammaticScroll.current) return;
    const container = bannerScrollRef.current;
    if (!container || visibleBanners.length <= 1) return;

    if (scrollDebounceTimer.current) clearTimeout(scrollDebounceTimer.current);
    scrollDebounceTimer.current = setTimeout(() => {
      if (isProgrammaticScroll.current) return;
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      const slides = container.querySelectorAll('[data-banner-slide="true"]');

      let closestIdx = 0;
      let minDistance = Infinity;

      slides.forEach((slide, idx) => {
        const rect = slide.getBoundingClientRect();
        const slideCenter = rect.left + rect.width / 2;
        const dist = Math.abs(containerCenter - slideCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      if (closestIdx !== activeBannerIdxRef.current) {
        setActiveBannerIdx(closestIdx);
      }
    }, 45);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isInteractingRef.current = true;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartPos.current.x);
    const diffY = Math.abs(touch.clientY - touchStartPos.current.y);
    if (diffX > 8 || diffY > 8) {
      isDraggingRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isInteractingRef.current = false;
      isDraggingRef.current = false;
    }, 1200);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = bannerScrollRef.current;
    if (!container) return;
    isMouseDownRef.current = true;
    mouseMovedRef.current = false;
    mouseStartXRef.current = e.pageX - container.offsetLeft;
    mouseScrollLeftRef.current = container.scrollLeft;
    isInteractingRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    const container = bannerScrollRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = x - mouseStartXRef.current;
    if (Math.abs(walk) > 5) {
      mouseMovedRef.current = true;
    }
    container.scrollLeft = mouseScrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      setTimeout(() => {
        isInteractingRef.current = false;
        mouseMovedRef.current = false;
      }, 400);
    }
  };

  const handlePrevBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = (activeBannerIdx - 1 + visibleBanners.length) % visibleBanners.length;
    scrollToBanner(prev, true);
  };

  const handleNextBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (activeBannerIdx + 1) % visibleBanners.length;
    scrollToBanner(next, true);
  };

  const handleDotClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    scrollToBanner(idx, true);
  };

  const handleBannerCardClick = (banner: any) => {
    if (isDraggingRef.current || mouseMovedRef.current) return;
    handleBannerClick(banner);
  };

  // ==========================================
  // Active Orders Live Tracking Under Banners
  // ==========================================
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

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

        const now = Date.now();
        const active = orders.filter((o: any) => {
          if (!o || o.status === 'REJECTED' || o.status === 'CANCELLED') return false;
          // Active ongoing orders
          if (['PENDING', 'PREPARING', 'ACCEPTED', 'READY'].includes(o.status)) return true;
          // Show freshly completed orders (within 12 seconds) so user sees completion before disappearing
          if (o.status === 'COMPLETED' && o.completedAt) {
            const diff = now - new Date(o.completedAt).getTime();
            return diff < 12000;
          }
          return false;
        });

        setActiveOrders(active);
      } catch (err) {
        console.error('Failed to load active orders:', err);
      }
    };

    fetchActiveOrders();

    // Regular interval poll every 8 seconds
    const pollInterval = setInterval(fetchActiveOrders, 8000);

    // Realtime socket events dispatched from App.tsx
    const handleStatusUpdate = (e: any) => {
      const updated = e.detail;
      if (!updated || !updated.id) return;

      setActiveOrders((prev) => {
        const exists = prev.some((o) => o.id === updated.id);
        if (exists) {
          if (updated.status === 'REJECTED' || updated.status === 'CANCELLED') {
            return prev.filter((o) => o.id !== updated.id);
          }
          return prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o));
        } else if (['PENDING', 'PREPARING', 'ACCEPTED', 'READY'].includes(updated.status)) {
          return [updated, ...prev];
        }
        return prev;
      });

      // If status updated to COMPLETED, auto-dismiss after 8 seconds ("وبعدها يختفي")
      if (updated.status === 'COMPLETED') {
        setTimeout(() => {
          if (isMounted) {
            setActiveOrders((prev) => prev.filter((o) => o.id !== updated.id));
          }
        }, 8000);
      }
    };

    const handleOrderCreated = (e: any) => {
      const created = e.detail;
      if (created && created.id) {
        setActiveOrders((prev) => {
          const exists = prev.some((o) => o.id === created.id);
          return exists ? prev : [created, ...prev];
        });
      }
    };

    window.addEventListener('order_status_updated', handleStatusUpdate);
    window.addEventListener('order_created', handleOrderCreated);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('order_status_updated', handleStatusUpdate);
      window.removeEventListener('order_created', handleOrderCreated);
    };
  }, [user]);

  // Auto-dismiss completed orders after 8s
  useEffect(() => {
    const completedOrders = activeOrders.filter((o) => o.status === 'COMPLETED');
    if (completedOrders.length === 0) return;

    const timers = completedOrders.map((o) => {
      return setTimeout(() => {
        setActiveOrders((prev) => prev.filter((item) => item.id !== o.id));
      }, 8000);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [activeOrders]);

  const handleDismissOrder = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setActiveOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const renderOrderTrackerCard = (order: any) => {
    const isDelivery = order.orderType === 'DELIVERY';
    const status = order.status;

    // Stages: 0: في انتظار القبول, 1: جاري التجهيز, 2: في التوصيل / جاهز للاستلام, 3: مكتمل
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

    const branch = branches.find((b) => b.id === order.branchId) || order.branch;
    const branchName = branch?.name || order.branch?.name || 'المطعم';
    const branchLogo = branch?.logoUrl || order.branch?.logoUrl;

    const itemsSummary = (order.items || [])
      .map((it: any) => `${it.quantity}× ${it.itemName || it.name}`)
      .join(' ، ');

    return (
      <div
        key={order.id}
        onClick={() => onTrackOrder?.(order)}
        className="bg-white rounded-3xl p-4 sm:p-5 border border-indigo-100 shadow-md hover:shadow-lg transition-all cursor-pointer relative overflow-hidden group select-none flex flex-col justify-between"
      >
        {/* Top Color Accent Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 transition-colors ${
            status === 'COMPLETED'
              ? 'bg-emerald-500'
              : status === 'READY'
              ? 'bg-sky-500'
              : status === 'PREPARING' || status === 'ACCEPTED'
              ? 'bg-indigo-600'
              : 'bg-amber-500'
          }`}
        />

        <div>
          {/* 1. Header: Branch Info + Order Type Badge + Live Pulse or Dismiss */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {branchLogo ? (
                  <img src={getFullImageUrl(branchLogo)} alt={branchName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">🍔</span>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                  {branchName}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md border border-indigo-100">
                    #{order.orderNumber}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {isDelivery ? '🛵 توصيل مباشر' : '🛍️ استلام من الفرع'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {status === 'COMPLETED' ? (
                <button
                  type="button"
                  onClick={(e) => handleDismissOrder(e, order.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="إخفاء البطاقة"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>مباشر</span>
                </span>
              )}
            </div>
          </div>

          {/* 2. Visual Status Stepper (4 Steps Progress Bar) */}
          <div className="my-3 px-1">
            <div className="relative flex items-center justify-between">
              {/* Background Gray Connector Line */}
              <div className="absolute top-4 right-7 left-7 h-1 bg-slate-200 z-0 rounded-full" />

              {/* Dynamic Animated Active Filled Line */}
              <div
                className="absolute top-4 right-7 h-1 bg-gradient-to-l from-indigo-600 via-violet-600 to-emerald-500 z-0 rounded-full transition-all duration-700"
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
                          ? status === 'COMPLETED'
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md scale-110'
                            : status === 'READY'
                            ? 'bg-sky-600 text-white ring-4 ring-sky-100 shadow-md scale-110 animate-pulse'
                            : status === 'PREPARING' || status === 'ACCEPTED'
                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md scale-110 animate-pulse'
                            : 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-md scale-110 animate-pulse'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <span
                      className={`text-[10px] mt-2 block leading-tight text-center ${
                        isActive
                          ? 'font-black text-slate-900'
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

          {/* 3. Live Contextual Status Message Banner */}
          <div
            className={`p-2.5 rounded-2xl flex items-center justify-between text-xs mb-3 border ${
              status === 'COMPLETED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : status === 'READY'
                ? 'bg-sky-50 border-sky-200 text-sky-900'
                : status === 'PREPARING' || status === 'ACCEPTED'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">
                {status === 'COMPLETED'
                  ? '🎉'
                  : status === 'READY'
                  ? isDelivery
                    ? '🛵'
                    : '🛍️'
                  : status === 'PREPARING' || status === 'ACCEPTED'
                  ? '👨‍🍳'
                  : '⏳'}
              </span>
              <span className="font-bold text-[11px] truncate">
                {status === 'COMPLETED' && 'تم استلام طلبك بنجاح، بالهنا والشفا!'}
                {status === 'READY' && (isDelivery ? (order.driver?.name ? `الكابتن ${order.driver.name} في الطريق إليك` : 'الكابتن في الطريق إليك') : 'طلبك جاهز للاستلام من الفرع')}
                {(status === 'PREPARING' || status === 'ACCEPTED') && (order.estimatedMinutes ? `جاري التجهيز بالمطبخ (~${order.estimatedMinutes} دقيقة متبقية)` : 'جاري تجهيز وجبتك طازجة بالمطبخ')}
                {status === 'PENDING' && 'المطعم يراجع طلبك وسيقوم بقبوله الآن'}
              </span>
            </div>

            {order.estimatedMinutes && (status === 'PREPARING' || status === 'ACCEPTED') && (
              <span className="text-[10px] font-mono font-black text-indigo-700 bg-white/90 px-2 py-0.5 rounded-lg border border-indigo-100 shrink-0 shadow-2xs">
                {order.estimatedMinutes} د
              </span>
            )}
          </div>
        </div>

        {/* 4. Order Items Summary & Track Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate" title={itemsSummary}>
              🍱 {itemsSummary || 'وجبة'}
            </p>
            <span className="text-xs font-mono font-black text-slate-900">
              {order.total} ج.م
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrackOrder?.(order);
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1 shrink-0"
          >
            <span>تتبع الطلب</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // 1. الفروع المتاحة جغرافياً بنطاق موقع العميل الحالي فقط (طلب المستخدم)
  const zoneBranches = useMemo(() => {
    return branches.filter(b => {
      if (!clientCoords) return true;
      return isBranchInDeliveryZone(b, clientCoords).inZone;
    });
  }, [branches, clientCoords]);

  // إحصائيات الفروع المرئية للمستخدم فقط حسب النطاق الجغرافي (طلب المستخدم: فلتر الكل يظهر فقط المطاعم الظاهرة لي)
  const totalVisibleBranchesCount = zoneBranches.length;
  const openBranchesCount = zoneBranches.filter(
    b => b.isOnline === true && b.operationalStatus === 'OPEN' && isBranchOpenByHours(b.openingTime, b.closingTime, b.isWithinWorkingHours)
  ).length;
  const favBranchesCount = zoneBranches.filter(b => favBranchIds.includes(b.id)).length;
  const deliveryBranchesCount = zoneBranches.filter(b => b.allowDelivery === true).length;
  const pickupBranchesCount = zoneBranches.filter(b => b.allowPickup === true).length;

  const filteredBranches = useMemo(() => {
    return zoneBranches.filter(b => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.address && b.address.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeFilter === 'OPEN') {
        return (
          b.isOnline === true &&
          b.operationalStatus === 'OPEN' &&
          isBranchOpenByHours(b.openingTime, b.closingTime, b.isWithinWorkingHours)
        );
      }
      if (activeFilter === 'FAVORITES') {
        return favBranchIds.includes(b.id);
      }
      if (activeFilter === 'DELIVERY') {
        return b.allowDelivery === true;
      }
      if (activeFilter === 'PICKUP') {
        return b.allowPickup === true;
      }

      return true;
    });
  }, [zoneBranches, search, activeFilter, favBranchIds]);

  // 2. ترتيب المطاعم: المفتوح أولاً ثم المشغول ثم المغلق في الأسفل (طلب المستخدم)
  const sortedFilteredBranches = useMemo(() => {
    return [...filteredBranches].sort((a, b) => {
      const isAOffline = a.isOnline !== true;
      const isAClosed = a.operationalStatus === 'CLOSED' || isAOffline;
      const isABusy = a.operationalStatus === 'BUSY';
      const isAOpen = !isAOffline && !isAClosed && !isABusy && isBranchOpenByHours(a.openingTime, a.closingTime, a.isWithinWorkingHours);

      const isBOffline = b.isOnline !== true;
      const isBClosed = b.operationalStatus === 'CLOSED' || isBOffline;
      const isBBusy = b.operationalStatus === 'BUSY';
      const isBOpen = !isBOffline && !isBClosed && !isBBusy && isBranchOpenByHours(b.openingTime, b.closingTime, b.isWithinWorkingHours);

      // 1. المطاعم المفتوحة في البداية
      if (isAOpen && !isBOpen) return -1;
      if (!isAOpen && isBOpen) return 1;

      // 2. المطاعم المشغولة (استراحة) ثانياً
      if (isABusy && isBClosed) return -1;
      if (isAClosed && isBBusy) return 1;

      return 0;
    });
  }, [filteredBranches]);

  const handleBannerClick = (banner: any) => {
    if (!banner?.linkUrl) return;
    const url = banner.linkUrl.trim();
    if (!url) return;

    // فحص ما إذا كان الرابط يوجه داخلياً لفرع معين أو لصنف/عرض مباشر
    if (url.includes('branch=') || url.includes('/r/') || url.startsWith('?') || url.includes('offer=') || url.includes('item=')) {
      try {
        const queryPart = url.includes('?') ? url.split('?')[1] : url;
        const params = new URLSearchParams(queryPart);
        const branchParam = params.get('branch') || params.get('r');
        const itemParam = params.get('item') || params.get('offer');

        if (branchParam) {
          const normalized = branchParam.trim().toLowerCase();
          const target = branches.find(
            (b) => b.id === branchParam || (b.slug && b.slug.toLowerCase() === normalized)
          );
          if (target) {
            if (clientCoords) {
              const check = isBranchInDeliveryZone(target, clientCoords);
              if (!check.inZone) {
                alert(`عذراً، مطعم (${target.name}) يقع خارج نطاق التوصيل لموقعك الحالي (${check.distKm.toFixed(1)} كم • الحد الأقصى للنطاق: ${check.radiusKm} كم). لا يمكن فتح العرض أو الطلب منه.`);
                return;
              }
            }
            onSelectBranch(target, itemParam);
            return;
          }
        }
      } catch (_e) {}
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (url.startsWith('/')) {
      window.location.href = url;
    } else {
      window.open(`https://${url}`, '_blank', 'noopener,noreferrer');
    }
  };

  // 4. فلترة عروض الفلاش والكودات: إخفاء أي عرض يخص مطعماً خارج النطاق (طلب المستخدم)
  const allFlashDeals = useMemo(() => {
    const raw = (flashDeals.deals && flashDeals.deals.length > 0)
      ? flashDeals.deals
      : [...(flashDeals.promoDeals || []), ...(flashDeals.comboDeals || [])];

    return raw.filter(deal => {
      if (!clientCoords) return true;
      const bId = deal.targetBranch?.id || deal.branchId;
      if (bId) {
        const branch = branches.find(b => b.id === bId);
        if (branch) {
          const check = isBranchInDeliveryZone(branch, clientCoords);
          if (!check.inZone) return false;
        }
      }
      return true;
    });
  }, [flashDeals, clientCoords, branches]);

  const hasFlashSection = allFlashDeals.length > 0;

  const renderDealCard = (deal: any) => {
    const rawCode = sanitizePromoCodeValue(deal.promoCode || deal.code);
    const isPromo = Boolean(rawCode && (deal.type === 'PROMO_CODE' || deal.type === 'PROMO' || !deal.menuItemId));
    const isCopied = Boolean(rawCode && copiedCode && copiedCode === rawCode);
    const isUnlimited = deal.isUnlimited === true;
    const remainingCount = isUnlimited ? 999 : Math.max(0, deal.remainingUses ?? 15);
    const totalQuota = deal.maxUses ?? 50;
    const remainingPercent = isUnlimited ? 100 : (totalQuota > 0 ? Math.min(100, Math.max(0, Math.round((remainingCount / totalQuota) * 100))) : 0);
    const isSoldOut = !isUnlimited && remainingCount <= 0;
    const targetBranchName = deal.targetBranch?.name || branches.find(b => b.id === deal.branchId)?.name || 'كافة المطاعم المشتركة';

    return (
      <div
        key={deal.id}
        className="w-full bg-white rounded-3xl p-3 sm:p-4 border border-rose-100 shadow-md hover:shadow-xl transition-all flex flex-col justify-between group relative overflow-hidden select-none text-slate-900"
      >
        {/* Top Image & Floating Badges */}
        <div className="relative h-32 sm:h-36 w-full rounded-2xl overflow-hidden bg-slate-100 mb-3 border border-slate-100 shrink-0">
          {deal.imageUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={getFullImageUrl(deal.imageUrl)}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-25 pointer-events-none"
              />
              <img
                src={getFullImageUrl(deal.imageUrl)}
                alt={deal.title}
                className="relative z-1 w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${isPromo ? 'from-purple-950 via-indigo-900 to-rose-950' : 'from-rose-600 via-orange-600 to-amber-500'} flex flex-col items-center justify-center text-white p-3 text-center`}>
              <span className="text-3xl mb-1">{isPromo ? '🎟️' : '🍔'}</span>
              <span className="text-xs font-black">{deal.title}</span>
            </div>
          )}

          {/* Right Badge: Deal Label */}
          <div className="absolute top-2 right-2 z-10">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-md flex items-center gap-1 backdrop-blur-md">
              <Flame className="w-3 h-3 text-amber-300 fill-amber-300" />
              <span>{deal.badgeText || (isPromo ? 'كوبون فلاش ⚡' : 'عرض خاص 🔥')}</span>
            </span>
          </div>

          {/* Left Badge: Live Countdown Timer */}
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-black/75 text-amber-300 shadow-md backdrop-blur-md flex items-center gap-1 border border-white/15">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{deal.expiresAt ? formatFlashCountdown(deal.expiresAt) : 'متاح الآن ✓'}</span>
            </span>
          </div>

          {/* Discount Percentage Badge */}
          {deal.discountPercent && deal.discountPercent > 0 && (
            <div className="absolute bottom-2 right-2 z-10">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-400 text-slate-950 shadow-sm">
                خصم {deal.discountPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Middle Content */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 mb-1">
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{targetBranchName}</span>
          </div>

          <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-snug group-hover:text-rose-600 transition-colors line-clamp-1">
            {deal.title}
          </h4>

          {deal.subtitle && (
            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-medium">
              {deal.subtitle}
            </p>
          )}

          {/* Max Quota Per User Badge */}
          {deal.maxPerUser && deal.maxPerUser > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/80 rounded-lg px-2 py-0.5 w-fit">
              <span>🔒 حد أقصى {deal.maxPerUser} لكل عميل</span>
            </div>
          )}

          {/* Recurring Schedule Badge (طلب 3) */}
          {deal.isRecurring && (
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 rounded-lg px-2 py-0.5 w-fit">
              <RotateCcw className="w-2.5 h-2.5 text-amber-600" />
              <span>عرض متكرر {deal.dailyStartTime ? `(${deal.dailyStartTime} - ${deal.dailyEndTime})` : 'يومياً'}</span>
            </div>
          )}

          {/* Price & Savings or Promo Code Box */}
          {deal.price !== undefined && Number(deal.price) > 0 ? (
            <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-100">
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black text-rose-600 font-mono">
                  {deal.discountPrice || deal.price} ج.م
                </span>
                {deal.originalPrice && Number(deal.originalPrice) > Number(deal.discountPrice || deal.price) && (
                  <span className="text-xs text-slate-400 line-through font-mono">
                    {deal.originalPrice} ج.م
                  </span>
                )}
              </div>

              {deal.originalPrice && Number(deal.originalPrice) > Number(deal.discountPrice || deal.price) && (
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                  توفير {Math.round(Number(deal.originalPrice) - Number(deal.discountPrice || deal.price))} ج.م
                </span>
              )}
            </div>
          ) : rawCode ? (
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2 mt-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-900">الكود:</span>
              <span className="font-mono font-black text-xs text-amber-950 tracking-wider bg-amber-200/70 px-2 py-0.5 rounded-md">
                {rawCode}
              </span>
            </div>
          ) : null}

          {/* Remaining Stock / Quota Indicator */}
          <div className="my-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
              {isUnlimited ? (
                <span className="flex items-center gap-1 text-emerald-600 font-black">
                  <span>كمية غير محدودة ♾️</span>
                </span>
              ) : isSoldOut ? (
                <span className="flex items-center gap-1 text-slate-500 font-black">
                  <span>نفدت الكمية ⌛</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-600 font-black">
                  <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                  <span>متبقي {remainingCount} فقط</span>
                </span>
              )}
              {isUnlimited ? (
                <span className="text-emerald-600 font-bold text-[10px]">متاح للجميع</span>
              ) : (
                <span className="text-slate-400">{totalQuota} متاح</span>
              )}
            </div>
            {!isUnlimited && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSoldOut
                      ? 'bg-slate-300 w-0'
                      : 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400'
                  }`}
                  style={{ width: `${remainingPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          {isPromo ? (
            <button
              type="button"
              disabled={isSoldOut}
              onClick={() => {
                if (isSoldOut || !rawCode) return;
                navigator.clipboard?.writeText(rawCode);
                try {
                  localStorage.setItem('unifood_auto_promo', rawCode);
                } catch {}
                setCopiedCode(rawCode);
                setTimeout(() => setCopiedCode(null), 2500);
                if (deal.targetBranch) {
                  const found = branches.find((b) => b.id === deal.targetBranch.id);
                  if (found) onSelectBranch(found);
                }
              }}
              className={`w-full py-2 px-3 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                isSoldOut
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white active:scale-95 shadow-sm'
              }`}
            >
              {isSoldOut ? (
                <span>انتهت الكمية المتاحة</span>
              ) : isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>{`تم نسخ الكود (${rawCode}) ✓`}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{rawCode ? `نسخ الكود (${rawCode}) وتطبيق الخصم` : 'نسخ كود الخصم'}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isSoldOut}
              onClick={() => {
                if (isSoldOut) return;
                const bId = deal.targetBranch?.id || deal.branchId;
                const found = bId ? branches.find((b) => b.id === bId) : branches[0];
                if (found) {
                  onSelectBranch(found, deal.menuItemId || deal.itemId);
                }
              }}
              className={`w-full py-2 px-3 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                isSoldOut
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white active:scale-95 shadow-md shadow-rose-600/20'
              }`}
            >
              {isSoldOut ? (
                <span>انتهت الكمية المتاحة</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>اطلب العرض الآن</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 0. Top Segmented Navigation Tabs */}
      <div className="bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-lg grid grid-cols-3 gap-1 sm:gap-1.5 select-none sticky top-2 z-20">
        <button
          type="button"
          onClick={() => setMainTab('RESTAURANTS')}
          className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
            mainTab === 'RESTAURANTS'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🍔</span>
          <span>المطاعم</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('FLASH_DEALS')}
          className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
            mainTab === 'FLASH_DEALS'
              ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span className="text-amber-400">🔥</span>
          <span>العروض</span>
          {hasFlashSection && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black shrink-0 ${
              mainTab === 'FLASH_DEALS' ? 'bg-black/30 text-amber-200' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {allFlashDeals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('ACTIVE_ORDERS')}
          className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap relative ${
            mainTab === 'ACTIVE_ORDERS'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🛵</span>
          <span>طلباتي</span>
          {activeOrders.length > 0 && (
            <span className="relative flex items-center gap-1 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                mainTab === 'ACTIVE_ORDERS' ? 'bg-black/30 text-white' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {activeOrders.length}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: RESTAURANTS (المطاعم والكافيهات)                         */}
      {/* ============================================================ */}
      {mainTab === 'RESTAURANTS' && (
        <div className="space-y-4 animate-fadeIn">
          {/* 1. Dynamic or Default UniFood Campus Banner Carousel (يدعم السكرول والسحب يمين وشمال) */}
      {visibleBanners.length > 0 ? (
        <div className="relative group select-none">
          {/* Horizontal Scrollable Carousel Container */}
          <div
            ref={bannerScrollRef}
            onScroll={handleBannerScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="flex overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth w-full rounded-3xl cursor-grab active:cursor-grabbing"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }}
          >
            {visibleBanners.map((banner, idx) => (
              <div
                key={banner.id || idx}
                data-banner-slide="true"
                id={`banner-slide-${idx}`}
                onClick={() => handleBannerCardClick(banner)}
                className={`w-full min-w-full shrink-0 snap-center relative overflow-hidden rounded-3xl bg-gradient-to-r ${PROMO_BANNER_GRADIENTS[idx % PROMO_BANNER_GRADIENTS.length]} text-white p-4 sm:p-6 shadow-md transition-all duration-300 ${
                  banner.linkUrl ? 'cursor-pointer hover:shadow-xl' : ''
                }`}
                title={banner.linkUrl ? `اضغط لفتح: ${banner.linkUrl}` : undefined}
              >
                {banner.imageUrl && (
                  <div className="absolute inset-0 z-0 opacity-25 group-hover:opacity-35 transition-opacity">
                    <img
                      src={getFullImageUrl(banner.imageUrl)}
                      alt={banner.title}
                      className="w-full h-full object-cover pointer-events-none"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="relative z-10 pb-7 sm:pb-5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-2xs">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>{banner.badgeText || 'إعلان حصري ⚡'}</span>
                    </span>

                    {banner.linkUrl && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md transition-all shadow-sm">
                        <span>فتح الرابط</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black mb-1 group-hover:text-amber-200 transition-colors">
                    {banner.title}
                  </h2>
                  {banner.subtitle && (
                    <p className="text-xs text-indigo-100 max-w-md line-clamp-2">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Controls: Arrows and Dots if visibleBanners.length > 1 */}
          {visibleBanners.length > 1 && (
            <>
              {/* Prev / Next Arrows for Desktop & Quick Navigation */}
              <button
                type="button"
                onClick={handlePrevBanner}
                aria-label="الإعلان السابق"
                className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md text-white items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg active:scale-90 border border-white/10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleNextBanner}
                aria-label="الإعلان التالي"
                className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md text-white items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg active:scale-90 border border-white/10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Bottom Overlay: Dots & Slide Counter */}
              <div className="absolute bottom-2.5 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1.5 pointer-events-auto bg-black/35 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                  {visibleBanners.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => handleDotClick(e, idx)}
                      aria-label={`انتقال للإعلان ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === activeBannerIdx ? 'w-5 bg-amber-400 shadow-xs' : 'w-1.5 bg-white/40 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>

                <div className="pointer-events-auto bg-black/35 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white/90 border border-white/10 shadow-sm flex items-center gap-1">
                  <span>{activeBannerIdx + 1}</span>
                  <span className="text-white/40">/</span>
                  <span>{visibleBanners.length}</span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-4 sm:p-6 shadow-md">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>UniFood توصيل سريع</span>
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full">
                ⚡ توصيل فوري لموقعك
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black mb-1">
              وجبتك السخنة لحد عندك في ثواني! 🍔
            </h2>
            <p className="text-xs text-indigo-200 max-w-md">
              اطلب من أفضل المطاعم والكافيهات بسهولة، مع توصيل سريع حتى باب بيتك أو استلام فوراً بدون انتظار
            </p>
          </div>

          {/* Decorative Watermark */}
          <div className="absolute left-3 -bottom-4 text-7xl opacity-15 select-none pointer-events-none">
            🍔🍕
          </div>
        </div>
      )}

      {/* 2. Client Live GPS Location Bar (Auto Delivery Radius Geofence) */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-indigo-50/90 border border-emerald-200/70 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-slate-900">موقعك الحالي:</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md truncate max-w-[180px] sm:max-w-xs">
                {isDetectingGps ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    جارٍ تحديد موقعك...
                  </span>
                ) : clientPlaceName ? (
                  clientPlaceName
                ) : clientCoords ? (
                  `GPS: ${clientCoords.lat.toFixed(4)}, ${clientCoords.lng.toFixed(4)}`
                ) : (
                  'لم يتم تفعيل الـ GPS'
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {clientCoords
                ? 'يتم عرض المطاعم المتاحة بنطاق توصيل يغطي موقعك الحالي فقط'
                : 'اضغط تحديث لتحديد موقعك تلقائياً وعرض المطاعم التي تغطي نطاقك'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={detectClientGps}
          disabled={isDetectingGps}
          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-emerald-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0 active:scale-95 disabled:opacity-50"
          title="تحديث موقعك الحالي عبر GPS"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
          <span className="hidden sm:inline">تحديث الموقع</span>
        </button>
      </div>

      {/* 3. Search & Quick Filters */}
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs font-bold no-scrollbar">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs ${
              activeFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>الكل ({totalVisibleBranchesCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('FAVORITES')}
            className={`px-3.5 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs ${
              activeFilter === 'FAVORITES'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-600'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeFilter === 'FAVORITES' ? 'fill-white text-white' : 'text-rose-500'}`} />
            <span>المفضلة ({favBranchesCount})</span>
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
            <span>مفتوح الآن ({openBranchesCount})</span>
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
            <span>توصيل للمباني ({deliveryBranchesCount})</span>
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
            <span>استلام من الفرع ({pickupBranchesCount})</span>
          </button>
        </div>
      </div>

      {/* 3. Restaurant Cards Section */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <span>أفضل المطاعم والكافيهات</span>
              <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {sortedFilteredBranches.length}
              </span>
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            ⚡ توصيل سريع حتى باب بيتك
          </span>
        </div>

        {sortedFilteredBranches.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200 shadow-sm">
            <Store className="w-14 h-14 mx-auto mb-2 opacity-30 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-700">
              {activeFilter === 'FAVORITES'
                ? 'لم تقم بإضافة أي مطعم للمفضلة بعد ❤️'
                : clientCoords && branches.length > 0 && !search
                ? 'لا توجد مطاعم تغطي نطاق موقعك الحالي حالياً 📍'
                : 'لا توجد مطاعم مطابقة للبحث'}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {activeFilter === 'FAVORITES'
                ? 'اضغط على علامة القلب ❤️ أعلى أي مطعم لحفظه في مفضلتك للوصول السريع'
                : clientCoords && branches.length > 0 && !search
                ? 'أنت خارج نطاق التوصيل المحدد للمطاعم المتاحة، يرجى اختيار موقع آخر أو تحديث موقعك الحالي'
                : 'جرب البحث بكلمة أخرى أو تغيير الفلتر'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedFilteredBranches.map((branch, idx) => {
              const payment = branch.paymentConfig;
              const gradientClass = BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length];
              const emoji = FOOD_EMOJIS[idx % FOOD_EMOJIS.length];
              const isOffline = branch.isOnline !== true;
              const isClosed = branch.operationalStatus === 'CLOSED';
              const isBusy = branch.operationalStatus === 'BUSY';
              const isOpenNow =
                !isOffline &&
                !isClosed &&
                !isBusy &&
                isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours);
              const isFav = favBranchIds.includes(branch.id);
              const crowdLevel = branch.crowdLevel || 'LOW';
              const estimatedPrep = branch.estimatedPrepMins || '15-25 د';

              // حساب مسافة الفرع بالنسبة لموقع العميل الحالي
              let bLat = typeof branch.latitude === 'number' && !isNaN(branch.latitude) ? branch.latitude : null;
              let bLng = typeof branch.longitude === 'number' && !isNaN(branch.longitude) ? branch.longitude : null;
              if (bLat === null || bLng === null) {
                const coords = extractCoordinatesFromAddress(branch.address);
                if (coords) {
                  bLat = coords.lat;
                  bLng = coords.lng;
                } else {
                  bLat = DEFAULT_CAMPUS_RESTAURANT_COORDS.lat;
                  bLng = DEFAULT_CAMPUS_RESTAURANT_COORDS.lng;
                }
              }
              const branchDistMeters = clientCoords ? calculateDistanceMeters(bLat, bLng, clientCoords.lat, clientCoords.lng) : null;
              const branchDistKm = branchDistMeters !== null ? branchDistMeters / 1000 : null;

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
                      <div className="relative z-10 flex items-center gap-1.5">
                        <BranchCountdownBadge branch={branch} />
                      </div>

                      {/* Left: Time Estimate + Favorite Heart Button */}
                      <div className="relative z-10 flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-black/40 text-white font-bold text-[11px] px-2.5 py-1 rounded-full backdrop-blur-md border border-white/20">
                          <Clock className="w-3 h-3 text-amber-300" />
                          <span>{estimatedPrep}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleFavoriteBranch(e, branch.id)}
                          title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                          className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md border transition-all active:scale-90 ${
                            isFav
                              ? 'bg-rose-500 text-white border-rose-300 shadow-sm'
                              : 'bg-black/35 text-white hover:bg-black/55 border-white/25'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
                        </button>
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

                      {/* Rating Badge + Delivery Fee Pill */}
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        {branch.ratingsCount > 0 ? (
                          <div className="bg-amber-50 text-amber-900 text-[11px] font-black px-2.5 py-1.5 rounded-full shadow-md border border-amber-200 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                            <span>{branch.avgRating}</span>
                            <span className="text-[10px] text-amber-700 font-bold">({branch.ratingsCount})</span>
                          </div>
                        ) : (
                          <div className="bg-amber-50/90 text-amber-800 text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow-sm border border-amber-200/80 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                            <span>جديد</span>
                          </div>
                        )}

                        <div className="bg-white text-indigo-700 text-xs font-black px-3 py-1.5 rounded-full shadow-md border border-slate-200/80 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{branch.deliveryFee > 0 ? `${branch.deliveryFee} ج.م توصيل` : 'توصيل مجاني'}</span>
                        </div>
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
                          <span title="فرع موثق ومعتمد">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center justify-between gap-1 text-xs text-slate-500 mt-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="line-clamp-1">{getDisplayAddress(branch.address, 'موقع المطعم')}</span>
                          </div>
                          {branchDistKm !== null && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded-md shrink-0">
                              يبعد {branchDistKm < 1 ? `${branchDistMeters} م` : `${branchDistKm.toFixed(1)} كم`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Live Kitchen Crowd Radar 🚦 (مؤشر زحمة المطبخ الحي) */}
                      {isOpenNow && (
                        <div
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 ${
                            crowdLevel === 'HIGH'
                              ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                              : crowdLevel === 'MEDIUM'
                              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                              : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                crowdLevel === 'HIGH'
                                  ? 'bg-rose-500 animate-ping'
                                  : crowdLevel === 'MEDIUM'
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            <span>
                              {crowdLevel === 'HIGH'
                                ? '🔴 ضغط عالي وقت البريك'
                                : crowdLevel === 'MEDIUM'
                                ? '🟡 متوسط الازدحام بالمطبخ'
                                : '🟢 المطبخ هادئ • تجهيز سريع'}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] font-black opacity-85">
                            ~{estimatedPrep}
                          </span>
                        </div>
                      )}

                      {/* Temporary notice if busy or closed */}
                      {isBusy && (
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="line-clamp-1">{branch.closingReason || 'استراحة وتجهيز طلبات'}</span>
                        </div>
                      )}

                      {isOffline && (
                        <div className="p-2 bg-slate-100 rounded-xl border border-slate-300 text-[11px] text-slate-800 flex items-center gap-1.5 font-bold">
                          <PowerOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>مغلق مؤقتاً (سيستم استقبال الطلبات غير متصل حالياً)</span>
                        </div>
                      )}

                      {!isOffline && isClosed && (
                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-900 flex items-center gap-1.5 font-bold">
                          <PowerOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>المطعم مغلق حالياً حتى إشعار آخر</span>
                        </div>
                      )}

                      {!isOffline && !isClosed && !isBusy && !isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours) && (
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
      )}

      {/* ============================================================ */}
      {/* TAB 2: FLASH DEALS (عروض الفلاش والبريك الموقوتة)              */}
      {/* ============================================================ */}
      {mainTab === 'FLASH_DEALS' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Deals Hero Header */}
          <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-4 sm:p-5 text-white border border-rose-500/40 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-1/4 w-48 h-20 bg-rose-500/15 blur-2xl pointer-events-none rounded-full" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 shrink-0">
                  <Flame className="w-6 h-6 animate-pulse text-amber-200 fill-amber-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                      <span>عروض الفلاش والبريك الموقوتة</span>
                      <span className="text-amber-400">🔥</span>
                    </h3>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-400/30">
                      لفترة محدودة
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    خصومات حصرية وعروض توفيرية مميزة تنتهي قريباً
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-amber-300 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{allFlashDeals.length} عروض حصرية متاحة</span>
                </span>
              </div>
            </div>

            {/* Sub-Filters for Deals */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setDealsFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                  dealsFilter === 'ALL'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                الكل ({allFlashDeals.length})
              </button>
              <button
                type="button"
                onClick={() => setDealsFilter('COMBOS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1 ${
                  dealsFilter === 'COMBOS'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <span>🍔 وجبات وكومبوهات</span>
              </button>
              <button
                type="button"
                onClick={() => setDealsFilter('PROMOS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1 ${
                  dealsFilter === 'PROMOS'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <span>🎟️ كوبونات خصم</span>
              </button>
            </div>
          </div>

          {/* Deals Grid or Empty State */}
          {(() => {
            const filteredDeals = allFlashDeals.filter(deal => {
              const isPromo = deal.type === 'PROMO_CODE' || deal.type === 'PROMO';
              if (dealsFilter === 'COMBOS') return !isPromo;
              if (dealsFilter === 'PROMOS') return isPromo;
              return true;
            });

            if (filteredDeals.length === 0) {
              return (
                <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-3">
                  <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-3xl mx-auto">
                    🔥
                  </div>
                  <h4 className="text-base font-black text-slate-900">لا توجد عروض في هذا التصنيف حالياً</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    تابع هذا القسم يومياً لاقتناص أقوى العروض والتخفيضات الحصرية قبل نفاد الكمية!
                  </p>
                  <button
                    type="button"
                    onClick={() => setMainTab('RESTAURANTS')}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-2xl shadow-md hover:bg-indigo-700 transition-all inline-flex items-center gap-1.5"
                  >
                    <span>تصفح كافة المطاعم</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDeals.map(deal => renderDealCard(deal))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: ACTIVE ORDERS (متابعة طلباتي الجارية)                   */}
      {/* ============================================================ */}
      {mainTab === 'ACTIVE_ORDERS' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Active Orders Header */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-4 sm:p-5 text-white border border-emerald-500/30 shadow-xl flex items-center justify-between gap-3 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 shrink-0 text-xl">
                🛵
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                    <span>متابعة طلباتك الجارية</span>
                  </h3>
                  {activeOrders.length > 0 && (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{activeOrders.length} {activeOrders.length === 1 ? 'طلب نشط' : 'طلبات نشطة'}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  تتبع حي لمراحل تجهيز الوجبة وخط سير كابتن التوصيل لموقعك
                </p>
              </div>
            </div>
          </div>

          {activeOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto">
                🛵
              </div>
              <h4 className="text-base font-black text-slate-900">لا توجد طلبات جارية حالياً</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                عند إتمام أي طلب، ستتمكن من متابعة مراحله وموقع الكابتن هنا فوراً حتى وصول وجبتك.
              </p>
              <button
                type="button"
                onClick={() => setMainTab('RESTAURANTS')}
                className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-black rounded-2xl shadow-md hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5"
              >
                <span>اطلب وجبتك الآن من المطاعم 🍔</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeOrders.map(ord => (
                <div key={ord.id} className="w-full">
                  {renderOrderTrackerCard(ord)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
