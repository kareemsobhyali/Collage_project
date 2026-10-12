import React, { useState, useEffect } from 'react';
import { X, Clock, ShoppingBag, Eye, Store, RotateCw, RotateCcw, Star, Timer } from 'lucide-react';
import { api } from '../services/api';

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

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({ onSelectOrderToTrack, onReorder, onClose }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getMyOrders();
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0 z-20" />

        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-800 text-sm">سجل طلباتي السابقة</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto modal-scroll flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RotateCw className="w-8 h-8 mx-auto animate-spin mb-2 text-indigo-600" />
              <p className="text-xs">جاري تحميل طلباتك...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold text-slate-600">لا توجد طلبات سابقة</p>
              <p className="text-[11px]">اطلب أول وجبة لك الآن من مطاعم الحرم الجامعي!</p>
            </div>
          ) : (
            orders.map(order => {
              const durationText = getOrderDurationText(order);

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-all space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-black text-xs text-slate-900">
                        {order.branch?.name || 'مطعم الجامعة'}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        #{order.orderNumber} • {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                      {durationText && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                          <Timer className="w-3 h-3 text-emerald-600" />
                          <span>استغرق إجمالاً: {durationText}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700 animate-pulse'
                      }`}>
                        {order.status === 'PENDING' && 'قيد الانتظار'}
                        {order.status === 'PREPARING' && 'جاري التحضير'}
                        {order.status === 'READY' && 'جاهز / في الطريق'}
                        {order.status === 'COMPLETED' && 'مكتمل'}
                        {order.status === 'REJECTED' && 'ملغي'}
                      </span>
                      {order.rating && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>{order.rating} / 5</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 border-t pt-2 space-y-0.5">
                    {order.items?.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{it.quantity} × {it.itemName}</span>
                        <span>{it.totalPrice} ج.م</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900">الإجمالي: {order.total} ج.م</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {order.discount && order.discount > 0 ? (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            (كوبون -{order.discount} ج.م)
                          </span>
                        ) : null}
                        {order.walletDiscount && order.walletDiscount > 0 ? (
                          <span className="text-[10px] text-indigo-600 font-bold">
                            (محفظة -{order.walletDiscount} ج.م)
                          </span>
                        ) : null}
                        {order.pointsEarned && order.pointsEarned > 0 && order.status !== 'REJECTED' ? (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                            ★ +{order.pointsEarned} نقطة
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onReorder && (
                        <button
                          type="button"
                          onClick={() => onReorder(order)}
                          className="flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition-all active:scale-95 shadow-2xs"
                          title="إضافة نفس الأصناف والإضافات إلى السلة بضغطة واحدة"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>إعادة نفس الطلب</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectOrderToTrack(order);
                          onClose();
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-xl transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>تتبع والتقييم</span>
                      </button>
                    </div>
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
