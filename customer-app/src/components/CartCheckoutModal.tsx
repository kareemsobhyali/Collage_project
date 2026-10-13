import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Truck, 
  ShoppingBag, 
  MapPin, 
  Phone, 
  User, 
  FileText, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Tag,
  Upload,
  Image as ImageIcon,
  Check,
  RotateCw,
  Plus,
  Minus,
  MessageSquare,
  Clock,
  Calendar,
  Sparkles,
  Wallet,
  Gift
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { requestPushPermission } from '../services/notifications';

interface CartCheckoutModalProps {
  cart: any[];
  branch: any;
  user: any | null;
  groupCartDetails?: any;
  onUpdateCart: (newCart: any[]) => void;
  onRequireAuth: () => void;
  onOrderSuccess: (order: any) => void;
  onClose: () => void;
}

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  cart,
  branch,
  user,
  groupCartDetails,
  onUpdateCart,
  onRequireAuth,
  onOrderSuccess,
  onClose,
}) => {
  const [orderType, setOrderType] = useState<'DELIVERY' | 'PICKUP'>(
    branch.allowDelivery ? 'DELIVERY' : 'PICKUP'
  );

  // Scheduled order states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('12:30');

  const paymentConfig = branch.paymentConfig;

  // تحديد طريقة الدفع الافتراضية بناءً على المتاح للفرع
  const defaultPayment = paymentConfig?.cashEnabled
    ? 'CASH'
    : paymentConfig?.instapayEnabled
    ? 'INSTAPAY'
    : paymentConfig?.vodafoneCashEnabled
    ? 'VODAFONE_CASH'
    : paymentConfig?.cardEnabled
    ? 'CARD'
    : 'CASH';

  const [paymentMethod, setPaymentMethod] = useState<string>(defaultPayment);
  const [addressText, setAddressText] = useState('');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);

  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(user?.walletBalance || 0);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(user?.loyaltyPoints || 0);
  const [convertingPoints, setConvertingPoints] = useState(false);

  // تحديث بيانات المستخدم وعناوينه ومحفظته تلقائياً عند تسجيل الدخول
  useEffect(() => {
    if (user) {
      if (!customerPhone) setCustomerPhone(user.phone || '');
      if (!customerName) setCustomerName(user.name || '');
      setWalletBalance(user.walletBalance || 0);
      setLoyaltyPoints(user.loyaltyPoints || 0);

      api.getAddresses()
        .then(res => {
          if (Array.isArray(res)) {
            setSavedAddresses(res);
            const def = res.find((a: any) => a.isDefault);
            if (def && !addressText) {
              setAddressText(def.details);
            }
          }
        })
        .catch(() => {});

      api.getWallet()
        .then(w => {
          if (w) {
            setWalletBalance(w.walletBalance ?? 0);
            setLoyaltyPoints(w.loyaltyPoints ?? 0);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleQuickConvertPoints = async () => {
    if (loyaltyPoints <= 0) return;
    try {
      setConvertingPoints(true);
      const res = await api.convertPointsToWallet();
      if (res.user) {
        setWalletBalance(res.user.walletBalance);
        setLoyaltyPoints(res.user.loyaltyPoints);
        setUseWallet(true);
        localStorage.setItem('customer_user', JSON.stringify(res.user));
      }
    } catch (e: any) {
      alert(e.message || 'فشل تحويل النقاط');
    } finally {
      setConvertingPoints(false);
    }
  };

  // Custom Delivery Zones
  const hasZones = branch.deliveryType === 'ZONES' && branch.deliveryZones && branch.deliveryZones.length > 0;
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    hasZones ? branch.deliveryZones[0].id : ''
  );

  // Promo Code
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    discountType: string;
    value: number;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Payment Proof (Vodafone Cash / InstaPay)
  const [paymentSenderPhone, setPaymentSenderPhone] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate dynamic delivery fee
  let deliveryFee = 0;
  let deliveryZoneName = '';
  if (orderType === 'DELIVERY') {
    if (hasZones) {
      const selectedZone = branch.deliveryZones.find((z: any) => z.id === selectedZoneId) || branch.deliveryZones[0];
      deliveryFee = selectedZone ? selectedZone.fee : 0;
      deliveryZoneName = selectedZone ? selectedZone.name : '';
    } else {
      deliveryFee = branch.deliveryFee || 0;
    }
  }

  const discount = appliedPromo ? appliedPromo.discount : 0;
  const preWalletTotal = Math.max(0, subtotal + deliveryFee - discount);
  const walletDiscount = useWallet && walletBalance > 0 ? Math.min(preWalletTotal, walletBalance) : 0;
  const total = Math.max(0, preWalletTotal - walletDiscount);
  const pointsToEarn = Math.max(1, Math.floor(subtotal / 10));

  const handleRemoveItem = (index: number) => {
    const updated = cart.filter((_, idx) => idx !== index);
    onUpdateCart(updated);
    if (updated.length === 0) {
      onClose();
    }
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...cart];
    const item = updated[index];
    const unit = item.unitPrice || (item.totalPrice / item.quantity);
    updated[index] = {
      ...item,
      quantity: newQty,
      totalPrice: unit * newQty,
    };
    onUpdateCart(updated);
  };

  // Validate and Apply Promo Code
  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    setPromoError(null);
    try {
      setPromoLoading(true);
      const res = await api.validatePromoCode(promoCodeInput.trim().toUpperCase(), subtotal);
      if (res.valid || res.success) {
        setAppliedPromo({
          code: res.code,
          discount: res.discount,
          discountType: res.discountType,
          value: res.value,
        });
        setPromoError(null);
      } else {
        setPromoError(res.error || 'كوبون الخصم غير صالح أو منتهي');
      }
    } catch (err: any) {
      setPromoError(err.message || 'كوبون الخصم غير صحيح أو منتهي');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError(null);
  };

  // Upload Payment Proof Screenshot
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProof(true);
      const res = await api.uploadImage(file);
      if (res.url) {
        setPaymentProofUrl(res.url);
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع لقطة شاشة التحويل');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      onRequireAuth();
      return;
    }

    const finalPhone = (customerPhone.trim() || user.phone || '').trim();
    if (!/^01[0125][0-9]{8}$/.test(finalPhone)) {
      setError('يرجى إدخال رقم موبايل مصري صحيح للتواصل مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015');
      return;
    }

    if (orderType === 'DELIVERY' && !addressText.trim()) {
      setError('يرجى كتابة عنوان التوصيل داخل الحرم الجامعي (المبنى / الكلية / الدور)');
      return;
    }

    if (branch.operationalStatus === 'CLOSED') {
      setError('عذراً، هذا المطعم مغلق حالياً ولا يستقبل أي طلبات جديدة.');
      return;
    }

    if (branch.operationalStatus === 'BUSY' && branch.closedUntil && new Date() < new Date(branch.closedUntil)) {
      const remainingMinutes = Math.ceil((new Date(branch.closedUntil).getTime() - Date.now()) / (60 * 1000));
      setError(`عذراً، المطعم مغلق مؤقتاً لضغط الطلبات أو التجهيز. سيعاد استقبال الطلبات بعد ${remainingMinutes} دقيقة تقريباً.`);
      return;
    }

    if (!isScheduled && !isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours)) {
      setError(`عذراً، المطعم مغلق حالياً لانتهاء مواعيد العمل الرسمية (${branch.openingTime || '08:00'} - ${branch.closingTime || '22:00'}). يمكنك اختيار "حجز مسبق" لوقت العمل.`);
      return;
    }

    try {
      setLoading(true);
      requestPushPermission().catch(() => {});

      const res = await api.createOrder({
        branchId: branch.id,
        orderType,
        paymentMethod,
        addressText: orderType === 'DELIVERY' ? addressText.trim() : 'استلام من الفرع',
        customerPhone: finalPhone,
        customerName: customerName.trim() || user.name,
        notes: notes.trim() || undefined,
        deliveryZoneName: orderType === 'DELIVERY' ? (deliveryZoneName || undefined) : undefined,
        deliveryFee: orderType === 'DELIVERY' ? deliveryFee : 0,
        paymentSenderPhone: paymentSenderPhone.trim() || undefined,
        paymentProofUrl: paymentProofUrl.trim() || undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        discount: appliedPromo ? appliedPromo.discount : undefined,
        useWallet,
        isScheduled,
        scheduledFor: isScheduled && scheduledTime ? (() => {
          const [hours, minutes] = scheduledTime.split(':').map(Number);
          const d = new Date();
          d.setHours(hours, minutes, 0, 0);
          if (d.getTime() < Date.now()) {
            d.setDate(d.getDate() + 1);
          }
          return d.toISOString();
        })() : undefined,
        groupCartDetails: groupCartDetails ? (typeof groupCartDetails === 'object' ? JSON.stringify(groupCartDetails) : String(groupCartDetails)) : undefined,
        items: cart.map(item => ({
          menuItemId: item.menuItemId,
          sizeName: item.sizeName,
          sizePrice: item.sizePrice,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers,
          notes: item.notes,
        })),
      });

      if (res.user) {
        localStorage.setItem('customer_user', JSON.stringify(res.user));
      }

      if (saveAddressToProfile && addressText.trim() && user) {
        api.addAddress('مكان التوصيل', addressText.trim(), false).catch(() => {});
      }

      onOrderSuccess(res.order);
      onUpdateCart([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fadeIn">
      {/* Floating Error Toast Notification at Top of Screen */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[92%] max-w-md bg-rose-600 text-white p-3.5 rounded-2xl shadow-2xl border border-rose-400 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-black">
            <AlertCircle className="w-5 h-5 shrink-0 text-white" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 rounded-lg hover:bg-rose-700 text-white/90 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92dvh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0 z-20" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-800 text-sm">سلة الطلب - {branch.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto modal-scroll flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-700">الأصناف المحددة ({cart.length})</h4>
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-black text-slate-900">
                      <span>{item.itemName}</span>
                      {item.sizeName && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-normal">
                          {item.sizeName}
                        </span>
                      )}
                    </div>
                    {item.selectedModifiers?.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-1 space-x-1 space-x-reverse">
                        {item.selectedModifiers.map((m: any, mIdx: number) => (
                          <span key={mIdx} className="inline-block bg-white px-1.5 py-0.5 rounded border border-slate-200 mt-0.5">
                            + {m.optionName} ({m.price} ج.م)
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <div className="mt-1.5 text-[11px] text-amber-800 bg-amber-50/90 px-2 py-0.5 rounded-md border border-amber-200/70 font-bold inline-flex items-center gap-1">
                        <span>📝 ملاحظة:</span>
                        <span>{item.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Quantity modifier */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(idx, item.quantity - 1)}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-black text-xs text-slate-800 w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(idx, item.quantity + 1)}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-black text-indigo-700 min-w-[50px] text-left">{item.totalPrice} ج.م</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      title="حذف الصنف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Type Toggle (توصيل / استلام من الفرع) */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-700">طريقة الاستلام</h4>
            <div className="grid grid-cols-2 gap-2">
              {branch.allowDelivery && (
                <button
                  type="button"
                  onClick={() => setOrderType('DELIVERY')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orderType === 'DELIVERY'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-black shadow-sm ring-2 ring-indigo-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs">توصيل لمبنى الكلية</span>
                  <span className="text-[10px] text-slate-500">
                    {hasZones ? 'رسوم حسب المنطقة' : `رسوم التوصيل: ${branch.deliveryFee || 0} ج.م`}
                  </span>
                </button>
              )}

              {branch.allowPickup && (
                <button
                  type="button"
                  onClick={() => setOrderType('PICKUP')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orderType === 'PICKUP'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-black shadow-sm ring-2 ring-indigo-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs">استلام من الفرع</span>
                  <span className="text-[10px] text-emerald-600 font-bold">بدون رسوم توصيل (0 ج.م)</span>
                </button>
              )}
            </div>
          </div>

          {/* Working Hours Info Badge */}
          {branch.openingTime && branch.closingTime && (
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-2xl flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>مواعيد عمل المطعم الرسمية:</span>
              </span>
              <span className="font-mono font-bold text-slate-800">
                {branch.openingTime} - {branch.closingTime} {branch.workingDays ? `(${branch.workingDays})` : ''}
              </span>
            </div>
          )}

          {/* Timing Mode: Instant vs Scheduled */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-700">توقيت استلام الطلب</h4>
              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                بريك المحاضرات
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsScheduled(false)}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                  !isScheduled
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-black ring-2 ring-indigo-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs">⚡ طلب فوري (الآن)</span>
                <span className="text-[10px] text-slate-400">يبدأ التجهيز فوراً</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScheduled(true)}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                  isScheduled
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-black ring-2 ring-indigo-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs">🕒 حجز مسبق (موعد البريك)</span>
                <span className="text-[10px] text-slate-400">حدد وقت خروجك</span>
              </button>
            </div>

            {isScheduled && (
              <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2.5 animate-fadeIn">
                <span className="text-[11px] font-bold text-slate-700 block">اختر موعد البريك أو وقت الاستلام:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['11:30', '12:30', '13:30', '14:30', '15:30'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setScheduledTime(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                        scheduledTime === t
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500 font-bold">أو وقت مخصص:</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Delivery Zone Selection (إذا كان الفرع يعتمد مناطق مخصصة) */}
          {orderType === 'DELIVERY' && hasZones && (
            <div className="space-y-2 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
              <label className="block text-xs font-black text-indigo-950">
                اختر منطقة / مبنى التوصيل في الحرم الجامعي *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branch.deliveryZones.map((zone: any) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between text-xs ${
                      selectedZoneId === zone.id
                        ? 'border-indigo-600 bg-white font-black text-indigo-950 shadow-sm ring-2 ring-indigo-200'
                        : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span>{zone.name}</span>
                    <span className="font-mono text-indigo-600 font-bold">+{zone.fee} ج.م</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Address Input */}
          {orderType === 'DELIVERY' && (
            <div className="space-y-2.5 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-indigo-950">
                  عنوانك وتفاصيل مكانك بالتحديد *
                </label>
                {savedAddresses.length > 0 && (
                  <span className="text-[10px] text-indigo-600 font-bold">
                    ({savedAddresses.length} عناوين محفوظة)
                  </span>
                )}
              </div>

              {/* Fast Address Pills */}
              {savedAddresses.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500">اختر من عناويني المحفوظة سريعاً:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {savedAddresses.map((addr) => {
                      const isSelected = addressText === addr.details;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => setAddressText(addr.details)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{addr.title}</span>
                          {addr.isDefault && <span className="text-[9px] opacity-80">(رئيسي)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                rows={2}
                placeholder="اكتب رقم الدور - المدرج أو المعمل (مثال: مبنى ب - الدور الثالث - مدرج 5 بجوار الكافتيريا)"
                value={addressText}
                onChange={e => setAddressText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                required
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-indigo-100/60">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAddressToProfile}
                    onChange={e => setSaveAddressToProfile(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>حفظ هذا العنوان في حسابي للاختيار السريع لاحقاً</span>
                </label>

                <span className="text-[10px] text-indigo-700">
                  💡 سيتواصل معك مندوب الفرع هاتفياً لتسليمك
                </span>
              </div>
            </div>
          )}

          {/* Student Contact Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">اسم المستلم</label>
              <input
                type="text"
                placeholder="اسم الطالب"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">رقم الهاتف للتواصل (11 رقماً)</label>
              <input
                type="tel"
                maxLength={11}
                placeholder="010XXXXXXXX"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
              />
            </div>
          </div>

          {/* Dynamic Payment Method Selection per Branch */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-700">طريقة الدفع المتاحة لدى الفرع</h4>
            <div className="space-y-2">
              {paymentConfig?.cashEnabled && (
                <label className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-900 ring-2 ring-indigo-200'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment"
                      value="CASH"
                      checked={paymentMethod === 'CASH'}
                      onChange={() => setPaymentMethod('CASH')}
                      className="text-indigo-600"
                    />
                    <span>💵 الدفع نقداً عند الاستلام (كاش)</span>
                  </div>
                </label>
              )}

              {paymentConfig?.vodafoneCashEnabled && (
                <label className={`flex flex-col p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'VODAFONE_CASH'
                    ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-900 ring-2 ring-indigo-200'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment"
                      value="VODAFONE_CASH"
                      checked={paymentMethod === 'VODAFONE_CASH'}
                      onChange={() => setPaymentMethod('VODAFONE_CASH')}
                      className="text-indigo-600"
                    />
                    <span>📱 فودافون كاش ومحافظ إلكترونية</span>
                  </div>
                  {paymentConfig.vodafoneCashNumber && (
                    <span className="text-[11px] text-indigo-700 mt-1 mr-5 font-mono">
                      رقم محفظة الفرع للتحويل: {paymentConfig.vodafoneCashNumber}
                    </span>
                  )}
                </label>
              )}

              {paymentConfig?.instapayEnabled && (
                <label className={`flex flex-col p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'INSTAPAY'
                    ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-900 ring-2 ring-indigo-200'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment"
                      value="INSTAPAY"
                      checked={paymentMethod === 'INSTAPAY'}
                      onChange={() => setPaymentMethod('INSTAPAY')}
                      className="text-indigo-600"
                    />
                    <span>⚡ إنستاباي (InstaPay)</span>
                  </div>
                  {paymentConfig.instapayHandle && (
                    <span className="text-[11px] text-indigo-700 mt-1 mr-5 font-mono">
                      معرف التحويل: {paymentConfig.instapayHandle}
                    </span>
                  )}
                </label>
              )}

              {paymentConfig?.cardEnabled && (
                <label className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  paymentMethod === 'CARD'
                    ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-900 ring-2 ring-indigo-200'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment"
                      value="CARD"
                      checked={paymentMethod === 'CARD'}
                      onChange={() => setPaymentMethod('CARD')}
                      className="text-indigo-600"
                    />
                    <span>💳 بطاقة بنكية (فيزا / ماستركارد)</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Payment Proof Section for Vodafone Cash & InstaPay */}
          {(paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') && (
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-700" />
                <h4 className="text-xs font-black text-amber-900">
                  تأكيد تحويل المبلغ ({paymentMethod === 'VODAFONE_CASH' ? 'فودافون كاش' : 'إنستاباي'})
                </h4>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  رقم محفظتك أو حسابك الذي حولت منه:
                </label>
                <input
                  type="text"
                  placeholder="مثال: 01012345678 أو اسم حسابك"
                  value={paymentSenderPhone}
                  onChange={e => setPaymentSenderPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  لقطة شاشة التحويل (إيصال السداد):
                </label>
                {paymentProofUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-amber-200">
                    <img
                      src={getFullImageUrl(paymentProofUrl)}
                      alt="إيصال التحويل"
                      className="w-12 h-12 rounded-lg object-cover border"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-emerald-700 block">تم إرفاق الإيصال بنجاح</span>
                      <span className="text-[10px] text-slate-400">سيقوم المطعم بمراجعته وتأكيد الطلب</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentProofUrl('')}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center justify-center gap-2 p-3 bg-white hover:bg-amber-100/50 border border-dashed border-amber-300 rounded-xl text-xs font-bold text-amber-800 transition-all">
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>{uploadingProof ? 'جاري رفع الإيصال...' : 'اضغط لاختيار صورة إيصال التحويل'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingProof}
                      onChange={handleProofUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Promo Code Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">كوبون الخصم (Promo Code)</label>
            {appliedPromo ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-black">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>تم تطبيق الكوبون {appliedPromo.code} (خصم {appliedPromo.discount} ج.م)</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="text-rose-600 hover:text-rose-700 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="أدخل كود الخصم (مثال: UNI20)"
                    value={promoCodeInput}
                    onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <button
                  type="button"
                  disabled={promoLoading || !promoCodeInput.trim()}
                  onClick={handleApplyPromoCode}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {promoLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : 'تطبيق'}
                </button>
              </div>
            )}
            {promoError && (
              <p className="text-[11px] text-rose-600 font-bold">{promoError}</p>
            )}
          </div>

          {/* Student Wallet & Loyalty Points Box */}
          {user && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-l from-indigo-50 via-purple-50 to-amber-50 border border-indigo-200/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-xl">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">المحفظة ونقاط الولاء الجامعية</div>
                    <div className="text-[11px] text-slate-600">
                      رصيد المحفظة: <strong className="text-indigo-700">{walletBalance.toFixed(0)} ج.م</strong> • نقاطك: <strong className="text-amber-600">{loyaltyPoints} نقطة</strong>
                    </div>
                  </div>
                </div>

                {loyaltyPoints > 0 && (
                  <button
                    type="button"
                    disabled={convertingPoints}
                    onClick={handleQuickConvertPoints}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black shadow-sm transition-all shrink-0"
                  >
                    {convertingPoints ? 'جاري التحويل...' : `تحويل ${loyaltyPoints} نقطة لـ ${loyaltyPoints} ج.م`}
                  </button>
                )}
              </div>

              {walletBalance > 0 && (
                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={useWallet}
                      onChange={e => setUseWallet(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>استخدام رصيد المحفظة للخصم من هذا الطلب</span>
                  </div>
                  <span className="text-xs font-black text-emerald-600">
                    -{Math.min(preWalletTotal, walletBalance).toFixed(0)} ج.م
                  </span>
                </label>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-indigo-800 font-bold bg-white/70 px-2.5 py-1.5 rounded-xl border border-indigo-100/80">
                <Gift className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>ستكسب <strong>+{pointsToEarn} نقطة ولاء</strong> جديدة في حسابك فور إتمام هذا الطلب!</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات إضافية للفرع</label>
            <input
              type="text"
              placeholder="مثال: بدون بصل، زيادة كاتشب..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Summary */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي:</span>
              <span className="font-bold">{subtotal} ج.م</span>
            </div>
            {orderType === 'DELIVERY' && (
              <div className="flex justify-between text-slate-600">
                <span>رسوم التوصيل{deliveryZoneName ? ` (${deliveryZoneName})` : ''}:</span>
                <span className="font-bold">{deliveryFee} ج.م</span>
              </div>
            )}
            {appliedPromo && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>خصم الكوبون ({appliedPromo.code}):</span>
                <span>-{discount} ج.م</span>
              </div>
            )}
            {walletDiscount > 0 && (
              <div className="flex justify-between text-indigo-600 font-bold">
                <span>خصم المحفظة الجامعية:</span>
                <span>-{walletDiscount} ج.م</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 border-t pt-2">
              <span>الإجمالي المطلوب:</span>
              <span className="text-indigo-700">{total} ج.م</span>
            </div>
          </div>
        </div>

        {/* Footer Checkout Button */}
        <div className="p-4 border-t bg-slate-50 pb-safe space-y-2.5">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {!user && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>يرجى تسجيل الدخول كطالب لتأكيد ومتابعة الطلب</span>
              </div>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shadow-sm transition-colors shrink-0"
              >
                دخول الحساب
              </button>
            </div>
          )}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'جاري إرسال الطلب...' : !user ? 'تسجيل الدخول لإتمام الطلب' : 'تأكيد الطلب الآن'}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
