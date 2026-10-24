import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  ShoppingBag, 
  Eye, 
  Store, 
  RotateCw, 
  RotateCcw, 
  Star, 
  Timer,
  CheckCircle2,
  XCircle,
  ChefHat,
  Truck,
  ArrowRight
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';

interface MyOrdersModalProps {
  onSelectOrderToTrack: (order: any) => void;
  onReorder?: (order: any) => void;
  onClose: () => void;
}

// دالة حساب مدة استغراق الطلب السابق
const getOrderDurationText = (order: any): string | null => {
  if (!order.createdAt || !order.completedAt) return null;
  const start = new Date(order.createdAt).getTime();
  const end = new Date(order.completedAt).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 1) return 'أقل من دقيقة';
  if (mins < 60) return `${mins} دقيقة`;
  return `${Math.floor(mins / 60)} س و ${mins % 60} د`;
};

// تنسيق التاريخ والوقت بصيغة عربية واضحة بدون ارتباك في الأرقام
const formatOrderDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'م' : 'ص';
    const h12 = hours % 12 || 12;
    return `${day} ${month} • ${h12}:${mins} ${period}`;
  } catch {
    return dateStr;
  }
};

const getStatusBadgeConfig = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return {
        label: 'مكتمل',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
      };
    case 'REJECTED':
      return {
        label: 'ملغي',
        className: 'bg-rose-50 text-rose-800 border-rose-200/80',
        icon: <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
      };
    case 'PREPARING':
      return {
        label: 'جاري التحضير',
        className: 'bg-amber-50 text-amber-800 border-amber-200/80 animate-pulse',
        icon: <ChefHat className="w-3 h-3 text-amber-600 shrink-0" />
      };
    case 'READY':
      return {
        label: 'جاهز / في الطريق',
        className: 'bg-indigo-50 text-indigo-800 border-indigo-200/80 animate-pulse',
        icon: <Truck className="w-3 h-3 text-indigo-600 shrink-0" />
      };
    case 'PENDING':
    default:
      return {
        label: 'قيد الانتظار',
        className: 'bg-blue-50 text-blue-800 border-blue-200/80',
        icon: <Clock className="w-3 h-3 text-blue-600 shrink-0" />
      };
  }
};

const getPaymentMethodInfo = (method: string) => {
  switch (method) {
    case 'VODAFONE_CASH':
      return { label: 'فودافون كاش', icon: '📱' };
    case 'INSTAPAY':
      return { label: 'إنستاباي', icon: '⚡' };
    case 'CARD':
      return { label: 'فيزا', icon: '💳' };
    case 'CASH':
    default:
      return { label: 'كاش', icon: '💵' };
  }
};

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({ onSelectOrderToTrack, onReorder, onClose }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-t-[28px] sm:rounded-3xl w-full max-w-lg max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-2.5 sm:hidden shrink-0 z-20" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shadow-2xs border border-indigo-100/70">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-sm sm:text-base">سجل طلباتي السابقة</h3>
                {orders.length > 0 && (
                  <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {orders.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">متابعة وإعادة طلب وجباتك السابقة بسهولة</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer active:scale-95 disabled:opacity-40"
              title="تحديث قائمة الطلبات"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button 
              type="button"
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Orders List Container */}
        <div className="p-4 sm:p-5 overflow-y-auto modal-scroll flex-1 space-y-3.5 pb-8 sm:pb-6 overscroll-contain">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RotateCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
              <p className="text-xs font-bold text-slate-600">جاري تحميل سجل طلباتك...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 px-4 text-center text-slate-400 space-y-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-3xl">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                <ShoppingBag className="w-8 h-8 opacity-75" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-700">لا توجد طلبات سابقة حتى الآن</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  استكشف مطاعم وكافيهات الحرم واطلب وجبتك المفضلة لتصلك أينما كنت!
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <span>تصفح مطاعم الجامعة</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          ) : (
            orders.map(order => {
              const durationText = getOrderDurationText(order);
              const statusConfig = getStatusBadgeConfig(order.status);
              const paymentInfo = getPaymentMethodInfo(order.paymentMethod);

              return (
                <div
                  key={order.id}
                  className="p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 bg-white hover:border-indigo-300 hover:shadow-md transition-all space-y-3 shadow-2xs group"
                >
                  {/* Top Row: Restaurant Info & Status */}
                  <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {order.branch?.logoUrl ? (
                          <img
                            src={getFullImageUrl(order.branch.logoUrl)}
                            alt={order.branch?.name || ''}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Store className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {order.branch?.name || 'مطعم الجامعة'}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <span className="font-mono font-bold text-slate-700">#{order.orderNumber}</span>
                          <span>•</span>
                          <span>{formatOrderDate(order.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-full border shadow-2xs ${statusConfig.className}`}>
                        {statusConfig.icon}
                        <span>{statusConfig.label}</span>
                      </span>
                      {order.rating && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>{order.rating} / 5</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delivery / Prep Duration Pill if available */}
                  {durationText && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl w-fit">
                      <Timer className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>استغرق إجمالاً: {durationText}</span>
                    </div>
                  )}

                  {/* Middle: Items Summary */}
                  <div className="bg-slate-50/80 rounded-2xl p-2.5 space-y-1.5 border border-slate-100 text-xs">
                    {order.items?.map((it: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-slate-700">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-[10px] font-black text-slate-800 flex items-center justify-center shrink-0">
                            {it.quantity}×
                          </span>
                          <span className="font-bold text-xs truncate text-slate-800">{it.itemName}</span>
                        </div>
                        <span className="font-bold text-xs text-slate-900 shrink-0 font-mono">
                          {it.totalPrice} <span className="text-[10px] font-normal text-slate-500">ج.م</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Meta & Discounts Strip */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500">الإجمالي:</span>
                      <span className="text-sm sm:text-base font-black text-slate-950 font-mono">
                        {order.total} <span className="text-xs font-bold text-indigo-600">ج.م</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 inline-flex items-center gap-1">
                        <span>{paymentInfo.icon}</span>
                        <span>{paymentInfo.label}</span>
                      </span>
                      {order.paymentSenderPhone && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ({order.paymentSenderPhone})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {order.discount && order.discount > 0 ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                          كوبون -{order.discount} ج.م
                        </span>
                      ) : null}
                      {order.walletDiscount && order.walletDiscount > 0 ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md">
                          محفظة -{order.walletDiscount} ج.م
                        </span>
                      ) : null}
                      {order.pointsEarned && order.pointsEarned > 0 && order.status !== 'REJECTED' ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <span>+{order.pointsEarned} نقطة</span>
                          <span>🎁</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Responsive Bottom Actions: Grid 2 Columns on Mobile & Desktop */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    {onReorder ? (
                      <button
                        type="button"
                        onClick={() => onReorder(order)}
                        className="py-2.5 px-3 rounded-xl text-xs font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200/80 flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-2xs cursor-pointer"
                        title="إضافة نفس الأصناف والإضافات إلى السلة بضغطة واحدة"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">إعادة نفس الطلب</span>
                      </button>
                    ) : <div />}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectOrderToTrack(order);
                        onClose();
                      }}
                      className="py-2.5 px-3 rounded-xl text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200/80 flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">تتبع والتقييم</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};