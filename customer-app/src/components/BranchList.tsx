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
  X,
  Heart,
  Star,
  Flame,
  Zap,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours } from '../services/api';

interface BranchListProps {
  branches: any[];
  onSelectBranch: (branch: any, autoOpenItemId?: string | null) => void;
  onQuickReorder?: (order: any) => void;
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

export const BranchList: React.FC<BranchListProps> = ({ branches, onSelectBranch, onQuickReorder, user }) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'FAVORITES' | 'DELIVERY' | 'PICKUP'>('ALL');

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
            // البحث عن أكثر وجبة/مطعم تكرر طلبه من الطالب أو آخر طلب ناجح له
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

  // Flash Deals Countdown State
  const [flashDeals, setFlashDeals] = useState<{ promoDeals: any[]; comboDeals: any[] }>({ promoDeals: [], comboDeals: [] });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const fetchFlash = () => {
      api.getFlashDeals()
        .then((res) => {
          if (res) {
            setFlashDeals({
              promoDeals: Array.isArray(res.promoDeals) ? res.promoDeals : [],
              comboDeals: Array.isArray(res.comboDeals) ? res.comboDeals : [],
            });
          }
        })
        .catch(() => {});
    };
    fetchFlash();
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic Promotional Banners from Admin
  const [banners, setBanners] = useState<any[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

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

  const currentBanner = banners.length > 0 ? banners[activeBannerIdx] : null;

  const handleBannerClick = () => {
    if (!currentBanner?.linkUrl) return;
    const url = currentBanner.linkUrl.trim();
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

  const hasFlashSection = flashDeals.promoDeals.length > 0 || flashDeals.comboDeals.length > 0;

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

      {/* 1.5 Smart Usual Order 1-Tap Card ("اطلب وجبتك المعتادة بضغطة واحدة") */}
      {usualOrder && onQuickReorder && (() => {
        const usualBranch = branches.find((b) => b.id === usualOrder.branchId) || usualOrder.branch;
        if (!usualBranch) return null;
        const itemsSummary = (usualOrder.items || [])
          .map((it: any) => `${it.quantity}× ${it.itemName || it.name}`)
          .join(' ، ');
        const itemsSubtotal = (usualOrder.items || []).reduce((acc: number, it: any) => acc + (it.totalPrice || 0), 0);

        return (
          <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-4 text-white shadow-lg border border-indigo-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 relative overflow-hidden">
            <div className="flex items-start sm:items-center gap-3 min-w-0 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 text-2xl shadow-sm">
                ⚡
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                    وجبتك المعتادة ❤️
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white truncate">
                    اطلب وجبتك المعتادة من {usualBranch.name} بضغطة واحدة
                  </span>
                </div>
                <p className="text-xs font-bold text-indigo-100 truncate mt-1">
                  🍱 {itemsSummary}
                </p>
                <span className="text-[11px] font-mono text-amber-200 font-bold block mt-0.5">
                  قيمة الوجبة: {itemsSubtotal || usualOrder.subtotal || usualOrder.total} ج.م
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onQuickReorder(usualOrder)}
              className="relative z-10 px-4 py-2.5 bg-white hover:bg-amber-50 text-indigo-950 rounded-2xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span>اطلبها الآن بضغطة واحدة 🚀</span>
            </button>
          </div>
        );
      })()}

      {/* 1.8 Flash Deals Countdown Section ("عروض الفلاش الموقوتة وقت البريك 🔥") */}
      {hasFlashSection && (
        <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-4 text-white border border-rose-500/30 shadow-md space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-sm">
                <Flame className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                  <span>عروض الفلاش الموقوتة وقت البريك 🔥</span>
                </h3>
                <p className="text-[10px] text-rose-200">
                  خصومات وكومبوهات سريعة لفترة محدودة أو حتى نفاد الكمية
                </p>
              </div>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-400/30 text-right shrink-0">
              <span className="text-[9px] text-rose-200 block">ينتهي العرض خلال</span>
              <span className="text-xs font-mono font-black text-amber-300">
                ⏱️ {formatFlashCountdown(flashDeals.promoDeals[0]?.expiresAt || flashDeals.comboDeals[0]?.expiresAt)}
              </span>
            </div>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto pb-1 no-scrollbar">
            {/* Active Promo Deals */}
            {flashDeals.promoDeals.map((deal) => {
              const usedPercent = Math.min(100, Math.max(12, Math.round(((deal.usedCount || 0) / (deal.maxUses || 50)) * 100)));
              const isCopied = copiedCode === deal.code;

              return (
                <div
                  key={deal.id}
                  className="min-w-[250px] sm:min-w-[270px] bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col justify-between gap-2.5 shrink-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                        كوبون فلاش ⚡
                      </span>
                      <span className="text-[10px] font-mono text-rose-200">
                        ⏱️ {formatFlashCountdown(deal.expiresAt)}
                      </span>
                    </div>
                    <h4 className="font-black text-xs sm:text-sm text-white leading-snug">
                      {deal.title}
                    </h4>
                    <p className="text-[10px] text-slate-300 line-clamp-1">
                      {deal.subtitle}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-amber-200 font-bold mb-1">
                        <span>متبقي {deal.remainingUses} كوبون فقط</span>
                        <span className="font-mono">{deal.code}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full"
                          style={{ width: `${100 - usedPercent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(deal.code);
                        try {
                          localStorage.setItem('unifood_auto_promo', deal.code);
                        } catch {}
                        setCopiedCode(deal.code);
                        setTimeout(() => setCopiedCode(null), 2500);
                        if (deal.targetBranch) {
                          const found = branches.find((b) => b.id === deal.targetBranch.id);
                          if (found) onSelectBranch(found);
                        }
                      }}
                      className="w-full py-1.5 px-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? `تم نسخ الكود (${deal.code}) ✓` : `انسخ الكود (${deal.code}) واطلب الآن`}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Featured Combo Deals */}
            {flashDeals.comboDeals.map((combo) => (
              <div
                key={combo.id}
                onClick={() => {
                  const found = branches.find((b) => b.id === combo.targetBranch?.id);
                  if (found) onSelectBranch(found, combo.itemId);
                }}
                className="min-w-[240px] sm:min-w-[260px] bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col justify-between gap-2.5 shrink-0 cursor-pointer transition-all"
              >
                <div className="flex items-start gap-2.5">
                  {combo.imageUrl ? (
                    <img
                      src={getFullImageUrl(combo.imageUrl)}
                      alt={combo.title}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-xl shrink-0">
                      🍱
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black text-amber-300 block truncate">
                      🏪 {combo.targetBranch?.name || 'مطعم الجامعة'}
                    </span>
                    <h4 className="font-black text-xs sm:text-sm text-white truncate">
                      {combo.title}
                    </h4>
                    <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                      {combo.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                  <span className="text-sm font-black text-amber-300 font-mono">
                    {combo.price} ج.م
                  </span>
                  <span className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-black flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>اطلب العرض</span>
                  </span>
                </div>
              </div>
            ))}
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
            <span>الكل ({branches.length})</span>
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
            <span>المفضلة ({favBranchIds.length})</span>
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
            <h4 className="text-sm font-bold text-slate-700">
              {activeFilter === 'FAVORITES' ? 'لم تقم بإضافة أي مطعم للمفضلة بعد ❤️' : 'لا توجد مطاعم مطابقة للبحث'}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {activeFilter === 'FAVORITES'
                ? 'اضغط على علامة القلب ❤️ أعلى أي مطعم لحفظه في مفضلتك للوصول السريع'
                : 'جرب البحث بكلمة أخرى أو تغيير الفلتر'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBranches.map((branch, idx) => {
              const payment = branch.paymentConfig;
              const gradientClass = BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length];
              const emoji = FOOD_EMOJIS[idx % FOOD_EMOJIS.length];
              const isClosed = branch.operationalStatus === 'CLOSED';
              const isBusy = branch.operationalStatus === 'BUSY';
              const isOpenNow =
                !isClosed &&
                !isBusy &&
                isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours);
              const isFav = favBranchIds.includes(branch.id);
              const crowdLevel = branch.crowdLevel || 'LOW';
              const estimatedPrep = branch.estimatedPrepMins || '15-25 د';

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
