import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Phone, 
  Plus, 
  ShoppingBag, 
  Image as ImageIcon,
  Truck,
  Store,
  Clock,
  PowerOff
} from 'lucide-react';
import { getFullImageUrl } from '../services/api';

interface BranchMenuProps {
  branch: any;
  categories: any[];
  cart: any[];
  onBack: () => void;
  onSelectItem: (item: any) => void;
  onOpenCart: () => void;
}

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

  const isBranchOpen = branch?.operationalStatus === 'OPEN' || !branch?.operationalStatus || (branch?.operationalStatus === 'BUSY' && secondsLeft <= 0);

  const displayedCategories = activeCategoryId === 'ALL'
    ? categories
    : categories.filter(c => c.id === activeCategoryId);

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6 pb-36">
      {/* Top Navigation & Branch Info */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة المطاعم</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {branch.logoUrl ? (
              <img
                src={getFullImageUrl(branch.logoUrl)}
                alt={branch.name}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                <Store className="w-7 h-7" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-900">{branch.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{branch.address || 'داخل الحرم الجامعي'}</span>
              </div>
            </div>
          </div>

          <div className="text-left">
            {branch.operationalStatus === 'CLOSED' ? (
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                مغلق حالياً
              </span>
            ) : branch.operationalStatus === 'BUSY' && secondsLeft > 0 ? (
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 inline-block animate-pulse">
                مغلق مؤقتاً
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 inline-block">
                مفتوح للطلب
              </span>
            )}
            {branch.phone && (
              <a
                href={`tel:${branch.phone}`}
                className="block text-[11px] font-mono text-indigo-600 hover:underline mt-1"
              >
                {branch.phone}
              </a>
            )}
          </div>
        </div>

        {/* Categories selector pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
          <button
            onClick={() => setActiveCategoryId('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategoryId === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            كافة الأقسام
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategoryId === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name} ({cat.items?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Operational Live Countdown Banner */}
      {branch.operationalStatus === 'BUSY' && secondsLeft > 0 && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white p-4.5 rounded-3xl shadow-lg flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-200 animate-spin" />
            </div>
            <div>
              <span className="font-black text-xs sm:text-sm block">
                المطعم في فترة إغلاق مؤقتة ({branch.closingReason || 'ضغط طلبات وتجهيز المطبخ'})
              </span>
              <span className="text-[11px] text-amber-100">
                يمكنك استعراض المنيو حالياً، وسيعاد استقبال الطلبات تلقائياً فور انتهاء العداد
              </span>
            </div>
          </div>
          <div className="text-center shrink-0 bg-black/25 px-3.5 py-2 rounded-2xl border border-amber-300/30 font-mono">
            <span className="text-[10px] text-amber-200 block font-sans">يعود بعد</span>
            <span className="text-base sm:text-lg font-black tracking-wider text-white">{formatCountdown(secondsLeft)}</span>
          </div>
        </div>
      )}

      {branch.operationalStatus === 'CLOSED' && (
        <div className="bg-rose-600 text-white p-4.5 rounded-3xl shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
            <PowerOff className="w-5 h-5 text-rose-200" />
          </div>
          <div>
            <span className="font-black text-sm block">المطعم مغلق حالياً حتى إشعار آخر</span>
            <span className="text-xs text-rose-100">لا يستقبل هذا الفرع طلبات جديدة في الوقت الحالي</span>
          </div>
        </div>
      )}

      {/* Menu Categories and Items */}
      <div className="space-y-6">
        {displayedCategories.map(cat => (
          <div key={cat.id} className="space-y-3">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span>{cat.name}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cat.items?.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!isBranchOpen) {
                      if (branch.operationalStatus === 'BUSY') {
                        alert(`المطعم مغلق مؤقتاً لضغط الطلبات أو التجهيز.\nسيعاد فتح استقبال الطلبات تلقائياً بعد ${formatCountdown(secondsLeft)}.`);
                      } else {
                        alert('عذراً، هذا المطعم مغلق حالياً ولا يستقبل طلبات جديدة.');
                      }
                      return;
                    }
                    onSelectItem(item);
                  }}
                  className={`bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-3.5 justify-between group ${
                    !isBranchOpen ? 'opacity-90' : ''
                  }`}
                >
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {item.name}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm font-black text-indigo-700">
                        {item.basePrice} ج.م
                      </span>
                      <button className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                        <Plus className="w-3.5 h-3.5" />
                        <span>اختيار</span>
                      </button>
                    </div>
                  </div>

                  {/* Item Image */}
                  {item.imageUrl ? (
                    <img
                      src={getFullImageUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-20 h-20 rounded-2xl object-cover border border-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 max-w-lg mx-auto z-40 pb-safe">
          <button
            onClick={() => {
              if (!isBranchOpen) {
                alert(branch.operationalStatus === 'BUSY' ? `عذراً، لا يمكن إتمام الطلب الآن لأن الفرع في فترة إغلاق مؤقتة.\nسيعاد الفتح تلقائياً بعد ${formatCountdown(secondsLeft)}.` : 'المطعم مغلق حالياً');
                return;
              }
              onOpenCart();
            }}
            className={`w-full text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between transition-all active:scale-95 border border-slate-700/50 backdrop-blur-md ${
              isBranchOpen ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-800/90'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black ${
                isBranchOpen ? 'bg-indigo-600' : 'bg-amber-600'
              }`}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">سلة المشتريات ({cartItemCount} أصناف)</div>
                <div className="text-base font-black text-white">{cartTotal} ج.م</div>
              </div>
            </div>

            <span className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-all ${
              isBranchOpen ? 'bg-indigo-600' : 'bg-amber-600'
            }`}>
              {isBranchOpen ? 'إتمام الطلب' : `مغلق مؤقتاً (${formatCountdown(secondsLeft)})`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
