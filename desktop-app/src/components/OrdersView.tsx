import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  Truck, 
  XCircle, 
  Printer, 
  Phone, 
  MapPin, 
  User, 
  DollarSign, 
  ShoppingBag, 
  BellRing, 
  AlertTriangle,
  Eye,
  Image as ImageIcon,
  X,
  Tag,
  Timer,
  ArrowUpDown,
  History,
  ChefHat,
  Flame,
  Check,
  Calendar,
  Users,
  KeyRound,
  RotateCcw,
  MessageSquare,
  ArrowRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';
import { toast } from '../utils/toast';
import { useLockBodyScroll } from '../utils/scrollLock';
import { getDisplayAddress } from '../utils/address';
import { ReceiptModal } from './ReceiptModal';
import { soundNotifier } from '../services/audioAlert';
import { getAutoPrintEnabled, getAutoPrintOnAccept, printOrderReceipt } from '../services/printer';

interface OrdersViewProps {
  orders: any[];
  branchName: string;
  onRefreshOrders: () => void;
  initialDetailedOrder?: any | null;
  onClearDetailedOrder?: () => void;
  onDetailedOrderOpenChange?: (isOpen: boolean) => void;
}

// دالات مساعدة لحساب الفترات الزمنية وتنسيقها
const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '-';
  if (minutes < 1) return 'أقل من دقيقة';
  if (minutes < 60) return `${Math.round(minutes)} دقيقة`;
  const hrs = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return `${hrs} س ${rem > 0 ? `و ${rem} د` : ''}`;
};

const formatTimeOnly = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
};

const getDiffMins = (start?: string | null, end?: string | null): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return Math.max(0, Math.round(((e - s) / 60000) * 10) / 10);
};

const cleanDriverName = (name?: string | null): string => {
  if (!name) return 'كابتن التوصيل';
  return name.replace(/\s*\(طيار عام\)\s*/g, '').trim() || name;
};

export const OrdersView: React.FC<OrdersViewProps> = ({ 
  orders, 
  branchName, 
  onRefreshOrders,
  initialDetailedOrder,
  onClearDetailedOrder,
  onDetailedOrderOpenChange
}) => {
  const [selectedTab, setSelectedTab] = useState<string>('PENDING');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [expandedTimingId, setExpandedTimingId] = useState<string | null>(null);

  // Detailed Full Order Modal state
  const [detailedOrder, setDetailedOrder] = useState<any | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [showDriverPicker, setShowDriverPicker] = useState<boolean>(false);

  // Return Modal state (PIN and direct confirm from cashier)
  const [returnModalOrder, setReturnModalOrder] = useState<any | null>(null);
  const [returnPin, setReturnPin] = useState<string>('');
  const [returnPinLoading, setReturnPinLoading] = useState<boolean>(false);
  const [confirmingDirectReturn, setConfirmingDirectReturn] = useState<boolean>(false);

  useEffect(() => {
    if (initialDetailedOrder) {
      setDetailedOrder(initialDetailedOrder);
    }
  }, [initialDetailedOrder]);

  useEffect(() => {
    onDetailedOrderOpenChange?.(Boolean(detailedOrder));
    if (detailedOrder) {
      window.scrollTo(0, 0);
    }
  }, [detailedOrder, onDetailedOrderOpenChange]);

  useEffect(() => {
    if (detailedOrder) {
      const fresh = orders.find(o => o.id === detailedOrder.id);
      if (fresh) {
        setDetailedOrder(fresh);
      }
    }
  }, [orders]);

  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Acceptance & Prep Time Dialog
  const [acceptingOrder, setAcceptingOrder] = useState<any | null>(null);
  const [prepMinutes, setPrepMinutes] = useState<number>(15);

  // Rejection & Cancellation Dialog State
  const [rejectingOrder, setRejectingOrder] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Payment Proof Modal
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);

  // Drivers Management & Assignment State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverMap, setSelectedDriverMap] = useState<Record<string, string>>({});
  const [assigningDriverOrderId, setAssigningDriverOrderId] = useState<string | null>(null);

  // Customer CRM (Notes & Account Block) Modal State
  const [editingCustomerCRM, setEditingCustomerCRM] = useState<{
    userId: string;
    customerName: string;
    customerPhone: string;
    restaurantNotes: string;
    isBlocked: boolean;
    orderCount: number;
  } | null>(null);
  const [crmNotesInput, setCrmNotesInput] = useState<string>('');
  const [crmBlockedInput, setCrmBlockedInput] = useState<boolean>(false);
  const [savingCRM, setSavingCRM] = useState<boolean>(false);

  // Synchronous scroll locking whenever any modal/dialog is visible
  useLockBodyScroll(
    Boolean(
      acceptingOrder ||
      rejectingOrder ||
      viewingProofUrl ||
      editingCustomerCRM ||
      printingOrder
    )
  );

  const handleOpenCustomerCRM = (order: any, orderCount: number) => {
    const userId = order.userId || order.user?.id;
    if (!userId) {
      toast.warning('هذا الطلب غير مرتبط بحساب مسجل');
      return;
    }
    const existingNotes = order.user?.restaurantNotes || '';
    const existingBlocked = Boolean(order.user?.isBlocked);
    setEditingCustomerCRM({
      userId,
      customerName: order.customerName || order.user?.name || 'طالب',
      customerPhone: order.customerPhone || order.user?.phone || '',
      restaurantNotes: existingNotes,
      isBlocked: existingBlocked,
      orderCount,
    });
    setCrmNotesInput(existingNotes);
    setCrmBlockedInput(existingBlocked);
  };

  const handleSaveCustomerCRM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerCRM) return;
    try {
      setSavingCRM(true);
      await api.updateCustomerCRM(editingCustomerCRM.userId, {
        restaurantNotes: crmNotesInput.trim(),
        isBlocked: crmBlockedInput,
      });
      toast.success('تم حفظ بيانات وملاحظات العميل بنجاح');
      setEditingCustomerCRM(null);
      onRefreshOrders();
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ ملاحظات أو حالة حساب العميل');
    } finally {
      setSavingCRM(false);
    }
  };

  const [acceptDriverId, setAcceptDriverId] = useState<string>('');

  const fetchDrivers = async () => {
    try {
      const data = await api.getDrivers();
      setDrivers(data || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchDrivers();
  }, [orders.length]);

  const handleAssignDriver = async (orderId: string, driverId: string | null) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (driverId && targetOrder?.status === 'PENDING') {
      toast.warning('يجب قبول الطلب وتأكيده أولاً قبل إسناده لكابتن التوصيل (الطيار)');
      return;
    }
    if (driverId === '') {
      toast.warning('يرجى اختيار كابتن التوصيل (الطيار) من القائمة أولاً');
      return;
    }
    try {
      setAssigningDriverOrderId(orderId);
      const res: any = await api.assignDriver(orderId, driverId || null);
      if (driverId === 'AUTO' && res?.autoAssignedDriver) {
        const cleanName = cleanDriverName(res.autoAssignedDriver.name);
        const distInfo = res.autoAssignedDriver.distanceKm !== null && res.autoAssignedDriver.distanceKm !== undefined
          ? ` (${res.autoAssignedDriver.distanceKm} كم)`
          : '';
        toast.success(`🤖 تم الإسناد التلقائي الذكي للكابتن: ${cleanName}${distInfo} بنجاح!`);
      } else {
        toast.success(driverId ? 'تم إسناد الطلب للطيار بنجاح' : 'تم إلغاء إسناد الطلب');
      }
      onRefreshOrders();
    } catch (error: any) {
      toast.error(error.message || 'فشل إسناد الطلب للطيار');
    } finally {
      setAssigningDriverOrderId(null);
    }
  };

  const handleOpenReturnModal = async (order: any) => {
    setReturnModalOrder(order);
    setReturnPin('');
    setReturnPinLoading(true);
    try {
      const res = await api.getBranchReturnPin(order.id);
      setReturnPin(res.pin);
    } catch (err: any) {
      toast.error(err.message || 'فشل استخراج رمز الاستلام');
    } finally {
      setReturnPinLoading(false);
    }
  };

  const handleConfirmDirectReturn = async () => {
    if (!returnModalOrder) return;
    try {
      setConfirmingDirectReturn(true);
      await api.confirmReturnFromDriver(returnModalOrder.id);
      toast.success('تم تأكيد استلام الوجبة من الطيار بنجاح ✅');
      setReturnModalOrder(null);
      onRefreshOrders();
    } catch (err: any) {
      toast.error(err.message || 'فشل استلام الطلب من الطيار');
    } finally {
      setConfirmingDirectReturn(false);
    }
  };

  // تحديث التوقيت الحي كل 10 ثوانٍ لحساب الفترات المنقضية بدقة
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const scheduledOrders = orders.filter(o => o.isScheduled && o.status !== 'COMPLETED' && o.status !== 'REJECTED');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING' || o.status === 'ACCEPTED');
  const readyOrders = orders.filter(o => o.status === 'READY');
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');

  // إيقاف التنبيه الصوتي إذا لم يعد هناك طلبات معلقة
  if (pendingOrders.length === 0) {
    soundNotifier.stopRepeatingAlarm();
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string, estimatedMinutes?: number, reason?: string) => {
    try {
      setUpdatingId(orderId);
      await api.updateOrderStatus(orderId, newStatus, estimatedMinutes, reason);
      if (newStatus !== 'PENDING') {
        soundNotifier.stopRepeatingAlarm();
      }
      if (detailedOrder && detailedOrder.id === orderId) {
        setDetailedOrder(null);
        onClearDetailedOrder?.();
      }
      onRefreshOrders();
    } catch (error: any) {
      toast.error(error.message || 'فشل تحديث حالة الطلب');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    const orderToReject = rejectingOrder;
    const finalReason = rejectionReason.trim() || 'نفاد المكونات المطلوبة';
    setRejectingOrder(null);
    soundNotifier.stopRepeatingAlarm();
    setDetailedOrder(null);
    onClearDetailedOrder?.();
    await handleUpdateStatus(orderToReject.id, 'REJECTED', undefined, finalReason);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingOrder) return;
    const orderToAccept = acceptingOrder;
    const minutes = prepMinutes || 15;
    const driverToAssign = acceptDriverId;
    setAcceptingOrder(null);

    // إغلاق شاشة تفاصيل الأوردر والرجوع فوراً لشاشة الأوردرات الرئيسية
    setDetailedOrder(null);
    onClearDetailedOrder?.();

    // إيقاف صوت التنبيه فور قبول الطلب
    soundNotifier.stopRepeatingAlarm();

    // 1. تحديث حالة الطلب إلى قيد التحضير أولاً (قبول الطلب وتأكيده)
    await handleUpdateStatus(orderToAccept.id, 'PREPARING', minutes);

    // 2. إذا اختار المطعم طياراً فورياً أو إسناداً تلقائياً ذكياً عند القبول، يتم إسناده الآن بعد أن تم قبول الطلب
    if (driverToAssign) {
      try {
        const res: any = await api.assignDriver(orderToAccept.id, driverToAssign);
        if (driverToAssign === 'AUTO' && res?.autoAssignedDriver) {
          toast.success(`🤖 تم الإسناد التلقائي الذكي للكابتن: ${cleanDriverName(res.autoAssignedDriver.name)}`);
        }
        onRefreshOrders();
      } catch (err: any) {
        console.error('Assign driver on accept error:', err);
      }
    }

    // طباعة البون تلقائياً عند قبول الطلب
    if (getAutoPrintOnAccept() || getAutoPrintEnabled()) {
      try {
        await printOrderReceipt({ ...orderToAccept, estimatedMinutes: minutes }, branchName);
      } catch (err) {
        console.error('Auto-print on accept error:', err);
      }
    }
  };

  const filteredOrders = orders.filter(order => {
    if (selectedTab === 'ALL') return true;
    if (selectedTab === 'PENDING') return order.status === 'PENDING';
    if (selectedTab === 'SCHEDULED') return order.isScheduled && order.status !== 'COMPLETED' && order.status !== 'REJECTED';
    if (selectedTab === 'PREPARING') return order.status === 'PREPARING' || order.status === 'ACCEPTED';
    if (selectedTab === 'READY') return order.status === 'READY';
    if (selectedTab === 'COMPLETED') return order.status === 'COMPLETED';
    return true;
  });

  // فرز الطلبات حسب الأحدث أو الأقدم (FIFO)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortBy === 'OLDEST' ? timeA - timeB : timeB - timeA;
  });

  return (
    <div className="space-y-6">
      {detailedOrder ? (() => {
        const dOrder = detailedOrder;
        const isPending = dOrder.status === 'PENDING';
        const isPreparing = dOrder.status === 'PREPARING' || dOrder.status === 'ACCEPTED';
        const isReady = dOrder.status === 'READY';
        const isCompleted = dOrder.status === 'COMPLETED';
        const isRejected = dOrder.status === 'REJECTED';

        const customerPhone = dOrder.customerPhone || dOrder.user?.phone || '';
        const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
        const whatsappNumber = cleanPhone.startsWith('0') ? `20${cleanPhone.slice(1)}` : cleanPhone;

        const customerOrderCount = orders.filter(
          (o: any) =>
            (dOrder.userId && o.userId === dOrder.userId) ||
            (customerPhone && (o.customerPhone === customerPhone || o.user?.phone === customerPhone))
        ).length;

        const createdAt = dOrder.createdAt;
        const acceptedAt = dOrder.acceptedAt;
        const preparingAt = dOrder.preparingAt || (dOrder.status !== 'PENDING' ? dOrder.acceptedAt : null);
        const readyAt = dOrder.readyAt;
        const completedAt = dOrder.completedAt;

        const waitMins = getDiffMins(createdAt, acceptedAt || (isPending ? new Date(currentTime).toISOString() : null));
        const prepMins = getDiffMins(preparingAt, readyAt || (isPreparing ? new Date(currentTime).toISOString() : null));
        const isOverdue = isPreparing && Boolean(dOrder.estimatedMinutes) && prepMins !== null && prepMins > (dOrder.estimatedMinutes || 15);
        const overdueMins = isOverdue ? Math.round(prepMins - dOrder.estimatedMinutes) : 0;
        const deliveryMins = getDiffMins(readyAt, completedAt || (isReady ? new Date(currentTime).toISOString() : null));
        const totalMins = isCompleted ? getDiffMins(createdAt, completedAt) : getDiffMins(createdAt, new Date(currentTime).toISOString());

        const assignedDriver = dOrder.driver || drivers.find((d: any) => d.id === dOrder.driverId);
        const isPickedUpByDriver = Boolean(dOrder.driverPickedUpAt);

        return (
          <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto animate-fadeIn pb-1.5 sm:pb-2">
            {/* Top Navigation Bar with Back Button & Order ID */}
            <div className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 sticky top-14 sm:top-20 z-20">
              <button
                type="button"
                onClick={() => {
                  setDetailedOrder(null);
                  onClearDetailedOrder?.();
                  onDetailedOrderOpenChange?.(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs sm:text-sm transition-all active:scale-95 shrink-0"
              >
                <ArrowRight className="w-4 h-4 shrink-0 text-slate-600" />
                <span>رجوع للأوردرات</span>
              </button>

              <div className="flex items-center gap-2 text-right min-w-0">
                <span className="font-mono font-black text-base sm:text-lg text-slate-900 whitespace-nowrap">
                  طلب #{dOrder.orderNumber}
                </span>
                <span className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-black whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  dOrder.orderType === 'DELIVERY' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {dOrder.orderType === 'DELIVERY' ? '🛵 توصيل' : '🛍️ استلام'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono hidden xs:inline whitespace-nowrap">
                  • {new Date(dOrder.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Status & Timing Banner */}
            <div className={`p-3 sm:p-3.5 rounded-2xl text-white shadow-xs flex items-center justify-between gap-3 ${
              isPending
                ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                : isPreparing
                ? isOverdue ? 'bg-gradient-to-r from-rose-600 to-rose-700' : 'bg-gradient-to-r from-indigo-600 to-indigo-700'
                : isReady
                ? 'bg-gradient-to-r from-purple-600 to-purple-700'
                : isCompleted
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700'
                : 'bg-gradient-to-r from-slate-600 to-slate-700'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                  {isPending && <Clock className="w-4 h-4 animate-spin" />}
                  {isPreparing && <ChefHat className="w-4 h-4" />}
                  {isReady && <Truck className="w-4 h-4" />}
                  {isCompleted && <CheckCircle className="w-4 h-4" />}
                  {isRejected && <XCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-xs sm:text-sm leading-tight truncate">
                    {isPending && 'طلب جديد بانتظار استجابتك وقبوله'}
                    {isPreparing && (isOverdue ? `⚠️ متأخر في التحضير بـ ${overdueMins} دقيقة!` : 'الطلب قيد التحضير في المطبخ')}
                    {isReady && 'الطلب جاهز للتسليم / خروج مع الطيار'}
                    {isCompleted && 'تم تسليم الطلب وإكماله بنجاح'}
                    {isRejected && `الطلب ملغي / مرفوض (${dOrder.rejectionReason || 'بدون سبب'})`}
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-90 font-mono mt-0.5">
                    {isPending && `بانتظار الموافقة منذ: ${formatDuration(waitMins)}`}
                    {isPreparing && `المحدد: ${dOrder.estimatedMinutes || 15} د • مضى: ${formatDuration(prepMins)}`}
                    {isReady && `في انتظار الاستلام منذ: ${formatDuration(deliveryMins)}`}
                    {isCompleted && `استغرق إجمالاً: ${formatDuration(totalMins)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center shrink-0 border border-indigo-200/60 shadow-2xs">
                    {(dOrder.customerName || 'ط').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span className="block font-black text-slate-900 text-xs sm:text-sm leading-tight truncate">
                      {dOrder.customerName || 'طالب'}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 mt-0.5 block" dir="ltr">
                      {customerPhone || 'بدون رقم هاتف'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {customerPhone && (
                    <>
                      <a
                        href={`tel:${customerPhone}`}
                        className="p-2 sm:px-2.5 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-colors flex items-center gap-1 font-bold text-xs shadow-2xs active:scale-95"
                        title="اتصال"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">اتصال</span>
                      </a>
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 sm:px-2.5 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-1 font-bold text-xs shadow-2xs active:scale-95"
                        title="واتساب"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">واتساب</span>
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenCustomerCRM(dOrder, customerOrderCount)}
                    className="p-2 sm:px-2.5 sm:py-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs shadow-2xs"
                    title="سجل وملاحظات العميل"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">السجل ({customerOrderCount})</span>
                  </button>
                </div>
              </div>

              {(dOrder.deliveryLocation || dOrder.deliveryZoneName || dOrder.addressText) && (
                <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs flex items-center gap-2 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-bold truncate">
                    {dOrder.deliveryZoneName ? `${dOrder.deliveryZoneName} • ` : ''}
                    {getDisplayAddress(dOrder.deliveryLocation || dOrder.addressText, 'موقع العميل بالحرم')}
                  </span>
                </div>
              )}

              {dOrder.orderNotes && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900 text-xs">
                  <span className="font-black block mb-0.5">📝 ملاحظات خاصة مع الطلب:</span>
                  <p className="font-medium leading-relaxed">{dOrder.orderNotes}</p>
                </div>
              )}
            </div>

            {/* Delivery Driver Assignment Section: Only shown after order is accepted AND orderType is DELIVERY */}
            {!isPending && dOrder.orderType === 'DELIVERY' && (
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2 border-b border-slate-100 pb-3">
                <span className="font-black text-slate-800 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>كابتن التوصيل (الطيار)</span>
                </span>

                {assignedDriver && !isCompleted && !isRejected && (
                  <button
                    type="button"
                    onClick={() => setShowDriverPicker(!showDriverPicker)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 transition-colors"
                  >
                    {showDriverPicker ? 'إغلاق تغيير الطيار' : 'تغيير الطيار ▾'}
                  </button>
                )}
              </div>

              {assignedDriver ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0 border border-indigo-200/60 shadow-2xs text-lg">
                        🛵
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm sm:text-base">
                            {cleanDriverName(assignedDriver.name)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                            assignedDriver.isGeneralDriver || assignedDriver.name?.includes('طيار عام')
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {assignedDriver.isGeneralDriver || assignedDriver.name?.includes('طيار عام') ? '🌐 طيار عام' : '🛵 طيار الفرع'}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 mt-0.5 block" dir="ltr">
                          {assignedDriver.phone}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {assignedDriver.phone && (
                        <>
                          <a
                            href={`tel:${assignedDriver.phone}`}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-colors flex items-center gap-1 font-bold text-xs"
                            title="اتصال بالطيار"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>اتصال</span>
                          </a>
                          <a
                            href={`https://wa.me/${assignedDriver.phone.replace(/[^0-9]/g, '').startsWith('0') ? `20${assignedDriver.phone.replace(/[^0-9]/g, '').slice(1)}` : assignedDriver.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-1 font-bold text-xs shadow-2xs"
                            title="واتساب الطيار"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>
                        </>
                      )}
                      {!isCompleted && !isRejected && (
                        <button
                          type="button"
                          onClick={() => handleAssignDriver(dOrder.id, null)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 transition-colors"
                        >
                          إلغاء التعيين
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs">
                    {isPickedUpByDriver ? (
                      <div className="p-2.5 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-300 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span className="truncate">استلم الطيار الوجبة من الفرع وخرج للتوصيل ({formatTimeOnly(dOrder.driverPickedUpAt)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenReturnModal(dOrder)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
                          title="عرض رمز الاستلام المكون من 4 أرقام أو استلام الوجبة من الكابتن"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>استلام من الطيار (PIN)</span>
                        </button>
                      </div>
                    ) : dOrder.isDriverAccepted ? (
                      <div className="p-2.5 bg-indigo-50 text-indigo-900 rounded-2xl border border-indigo-300 font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-indigo-700 shrink-0" />
                        <span>قبل الطيار الطلب وفي طريقه للفرع لاستلام الوجبة 🛵</span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-amber-50 text-amber-900 rounded-2xl border border-amber-300 font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0 animate-pulse" />
                        <span>مسند للطيار • بانتظار استلامه للوجبة من الفرع</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : isCompleted ? (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl font-bold border border-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم التسليم المباشر عبر الفرع</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 text-amber-900 rounded-2xl font-bold border border-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>لم يتم تعيين طيار لهذا الطلب بعد</span>
                </div>
              )}

              {/* Interactive Driver Cards Picker (Shows if no driver assigned or user clicked change) */}
              {(!assignedDriver || showDriverPicker) && !isCompleted && !isRejected && (() => {
                const currentSelectedDriverId = selectedDriverMap[dOrder.id] !== undefined
                  ? selectedDriverMap[dOrder.id]
                  : (dOrder.driverId || '');
                const activeDriversCount = drivers.filter((d: any) => d.isActive).length;

                return (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-black text-slate-800">
                        {assignedDriver ? 'اختر طياراً بديلاً لهذا الطلب:' : 'اختر كابتن التوصيل لإسناد الطلب:'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          {activeDriversCount} طيار متاح
                        </span>
                        {activeDriversCount > 0 && dOrder.status !== 'PENDING' && (
                          <button
                            type="button"
                            disabled={assigningDriverOrderId === dOrder.id}
                            onClick={async () => {
                              await handleAssignDriver(dOrder.id, 'AUTO');
                              setShowDriverPicker(false);
                            }}
                            className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-[11px] font-black shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <span>🤖 إسناد تلقائي ذكي لأقرب طيار متفرغ ⚡</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {drivers.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-bold">
                        لا يوجد طيارون مسجلون حالياً في الفرع.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-0.5">
                        {drivers.map((d: any) => {
                          const isSelected = currentSelectedDriverId === d.id;
                          const isGeneral = Boolean(d.isGeneralDriver || d.name?.includes('طيار عام'));
                          const driverActiveOrders = orders.filter(
                            (o: any) =>
                              o.driverId === d.id &&
                              (o.status === 'PREPARING' || o.status === 'ACCEPTED' || o.status === 'READY')
                          ).length;

                          return (
                            <button
                              key={d.id}
                              type="button"
                              disabled={!d.isActive}
                              onClick={() => setSelectedDriverMap({ ...selectedDriverMap, [dOrder.id]: d.id })}
                              className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                                !d.isActive
                                  ? 'bg-slate-100/70 border-slate-200 opacity-55 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/25 shadow-sm'
                                  : 'bg-slate-50/70 hover:bg-white border-slate-200/90 hover:border-indigo-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : isGeneral
                                    ? 'bg-sky-100 text-sky-700 border-sky-200'
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}>
                                  {isGeneral ? '🌐' : '🛵'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                                      {cleanDriverName(d.name)}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                                      isGeneral
                                        ? 'bg-sky-100 text-sky-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}>
                                      {isGeneral ? 'طيار عام' : 'طيار الفرع'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[11px] font-mono font-bold text-slate-500" dir="ltr">
                                      {d.phone}
                                    </span>
                                    {!d.isActive ? (
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                        غير متاح
                                      </span>
                                    ) : driverActiveOrders === 0 ? (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                        متفرغ الآن ✓
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                        معه {driverActiveOrders} طلب
                                      </span>
                                    )}
                                    {d.distanceKm !== null && d.distanceKm !== undefined && (
                                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono">
                                        📍 {d.distanceKm} كم
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                  : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {showDriverPicker && (
                        <button
                          type="button"
                          onClick={() => setShowDriverPicker(false)}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          إلغاء
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={assigningDriverOrderId === dOrder.id || !currentSelectedDriverId}
                        onClick={async () => {
                          await handleAssignDriver(dOrder.id, currentSelectedDriverId);
                          setShowDriverPicker(false);
                        }}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/20 shrink-0 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Truck className="w-4 h-4" />
                        <span>
                          {assigningDriverOrderId === dOrder.id
                            ? 'جاري الحفظ...'
                            : assignedDriver
                            ? 'تأكيد تغيير الطيار'
                            : 'إسناد الطلب للكابتن المختار'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            )}

            {/* Group Cart Details if present */}
            {dOrder.groupCartDetails && (() => {
              try {
                const details = typeof dOrder.groupCartDetails === 'string' ? JSON.parse(dOrder.groupCartDetails) : dOrder.groupCartDetails;
                if (Array.isArray(details) && details.length > 0) {
                  return (
                    <div className="p-4 rounded-3xl bg-purple-50 border border-purple-200 space-y-3 text-xs">
                      <div className="flex items-center gap-2 font-black text-purple-900">
                        <Users className="w-5 h-5 text-purple-700" />
                        <span>تقسيم أكياس وحقائب سلة الشلة ({details.length} طلاب):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {details.map((group: any, gIdx: number) => (
                          <div key={gIdx} className="bg-white p-3 rounded-2xl border border-purple-100 shadow-2xs">
                            <div className="flex items-center justify-between font-black text-purple-800 border-b border-purple-50 pb-1 mb-1.5">
                              <span>🛍️ كيس: {group.studentName}</span>
                              {group.subtotal !== undefined && <span>{group.subtotal} ج.م</span>}
                            </div>
                            <div className="space-y-1 text-slate-600">
                              {(group.items || []).map((gi: any, giIdx: number) => (
                                <div key={giIdx} className="flex justify-between">
                                  <span>{gi.quantity} × {gi.itemName} {gi.sizeName ? `(${gi.sizeName})` : ''}</span>
                                  <span className="font-mono">{gi.totalPrice} ج.م</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                return null;
              }
              return null;
            })()}

            {/* Full Items Breakdown */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  <span>الأصناف المطلوبة في الأوردر ({dOrder.items?.length || 0})</span>
                </h4>
              </div>

              <div className="space-y-2.5">
                {dOrder.items?.map((item: any, idx: number) => {
                  const itemTitle = item.item?.name || item.itemName || 'صنف';
                  return (
                    <div key={idx} className="p-3.5 sm:p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/80 text-xs shadow-2xs space-y-2 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-mono font-black flex items-center justify-center shrink-0 shadow-xs text-xs">
                            {item.quantity}×
                          </span>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                              {itemTitle}
                              {item.sizeName && (
                                <span className="mr-2 text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-lg">
                                  {item.sizeName}
                                </span>
                              )}
                            </div>
                            {item.itemPrice && (
                              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                                سعر القطعة: {item.itemPrice} ج.م
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="font-mono font-black text-slate-900 text-sm sm:text-base shrink-0">
                          {item.totalPrice} ج.م
                        </span>
                      </div>

                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="mr-9 pr-2 border-r-2 border-indigo-200 space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 block">الإضافات والخيارات:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.modifiers.map((mod: any, mIdx: number) => (
                              <span key={mIdx} className="text-[11px] bg-white text-slate-700 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                +{mod.optionName} {mod.price > 0 && `(${mod.price} ج.م)`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.notes && (
                        <div className="mr-9 text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                          <span className="font-black">ملاحظات على الصنف: </span>
                          <span>{item.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Summary & Payment */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600 border-b border-slate-100 pb-2.5">
                <span className="font-bold text-slate-700">طريقة الدفع:</span>
                <span className="font-black text-slate-900 text-sm px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200">
                  {dOrder.paymentMethod === 'CASH' && '💵 نقداً عند الاستلام'}
                  {dOrder.paymentMethod === 'WALLET' && '💳 محفظة إلكترونية'}
                  {dOrder.paymentMethod === 'ONLINE' && '💳 دفع إلكتروني'}
                  {dOrder.paymentMethod === 'VODAFONE_CASH' && '📱 فودافون كاش'}
                  {dOrder.paymentMethod === 'INSTAPAY' && '⚡ إنستاباي'}
                  {!['CASH', 'WALLET', 'ONLINE', 'VODAFONE_CASH', 'INSTAPAY'].includes(dOrder.paymentMethod) && (dOrder.paymentMethod || 'نقداً')}
                </span>
              </div>

              {dOrder.subtotal !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي للأصناف:</span>
                  <span className="font-mono font-bold text-slate-800">{dOrder.subtotal} ج.م</span>
                </div>
              )}

              {dOrder.deliveryFee !== undefined && dOrder.deliveryFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>رسوم التوصيل:</span>
                  <span className="font-mono font-bold text-slate-800">{dOrder.deliveryFee} ج.م</span>
                </div>
              )}

              {Boolean(dOrder.discount && Number(dOrder.discount) > 0) && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم الكوبون ({dOrder.promoCode}):</span>
                  <span className="font-mono">-{dOrder.discount} ج.م</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm sm:text-base font-black text-slate-900 pt-2.5 border-t border-slate-200">
                <span>الإجمالي المطلوب تحصيله:</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">{dOrder.total} ج.م</span>
              </div>

              {dOrder.paymentProofUrl && (
                <button
                  type="button"
                  onClick={() => setViewingProofUrl(dOrder.paymentProofUrl)}
                  className="w-full mt-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold border border-indigo-200 transition-colors flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>معاينة إيصال تحويل المحفظة / فودافون كاش</span>
                </button>
              )}
            </div>

            {/* Action Controls Bar (Sticky Floating Card at bottom) */}
            <div className="p-3 sm:p-3.5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex items-center justify-between gap-2.5 sticky bottom-2.5 sm:bottom-4 z-30">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPrintingOrder(dOrder)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 rounded-xl text-xs font-bold transition-colors shadow-2xs active:scale-95"
                >
                  <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>طباعة بون</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isPending && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptingOrder(dOrder);
                        setPrepMinutes(15);
                        setAcceptDriverId(dOrder.driverId || '');
                      }}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول وبدء التجهيز</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingOrder(dOrder);
                        setRejectionReason('نفاد المكونات المطلوبة');
                      }}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      رفض الطلب
                    </button>
                  </>
                )}

                {isPreparing && (
                  <button
                    type="button"
                    disabled={updatingId === dOrder.id}
                    onClick={() => handleUpdateStatus(dOrder.id, 'READY')}
                    className="w-full sm:w-auto justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>جاهز للاستلام / تم انتهاء التحضير</span>
                  </button>
                )}

                {isReady && (
                  <button
                    type="button"
                    disabled={updatingId === dOrder.id}
                    onClick={() => handleUpdateStatus(dOrder.id, 'COMPLETED')}
                    className="w-full sm:w-auto justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>تأكيد التسليم (مكتمل)</span>
                  </button>
                )}

                {isCompleted && (
                  <div className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl font-black text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>تم إكمال وتسليم هذا الطلب بنجاح</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })() : (
        <>
          {/* Pending Orders Flash Banner if there are any new orders */}
          {pendingOrders.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2.5 text-center sm:text-right">
                <BellRing className="w-6 h-6 sm:w-7 sm:h-7 animate-bounce shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">يوجد {pendingOrders.length} طلب جديد بانتظار استجابتك!</h3>
                  <p className="text-xs opacity-90">يرجى قبول الطلبات وتحديد وقت التجهيز للطلاب</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => soundNotifier.stopRepeatingAlarm()}
                className="w-full sm:w-auto px-4 py-2 bg-white text-amber-800 font-black rounded-xl text-xs hover:bg-amber-50 transition-colors shadow-sm whitespace-nowrap text-center"
              >
                إيقاف صوت التنبيه مؤقتاً
              </button>
            </div>
          )}

          {/* Tabs & Sort Controls (Unified single-row layout on mobile) */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
            {/* Horizontal Scrolling Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedTab('ALL')}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                <span>كافة الطلبات</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedTab === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {orders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('PENDING')}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedTab === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                    : 'bg-white text-amber-700 hover:bg-amber-50 border border-slate-200/70'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>طلبات جديدة</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-black ${
                  selectedTab === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {pendingOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('SCHEDULED')}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedTab === 'SCHEDULED'
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                    : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-slate-200/70'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>محجوزة مسبقاً</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-black ${
                  selectedTab === 'SCHEDULED' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {scheduledOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('PREPARING')}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedTab === 'PREPARING'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-blue-700 hover:bg-blue-50 border border-slate-200/70'
                }`}
              >
                <span>جاري التحضير</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedTab === 'PREPARING' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {preparingOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('READY')}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedTab === 'READY'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white text-purple-700 hover:bg-purple-50 border border-slate-200/70'
                }`}
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>جاهز للتسليم</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedTab === 'READY' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'
                }`}>
                  {readyOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab('COMPLETED')}
                className={`h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  selectedTab === 'COMPLETED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200/70'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>مكتملة</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedTab === 'COMPLETED' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {completedOrders.length}
                </span>
              </button>
            </div>

            {/* Compact Toggle Sort Button */}
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'NEWEST' ? 'OLDEST' : 'NEWEST')}
              className="h-9 px-2.5 sm:px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs whitespace-nowrap active:scale-95"
              title="انقر للتبديل بين الأحدث أولاً والأقدم أولاً"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">
                {sortBy === 'NEWEST' ? 'الأحدث أولاً' : 'الأقدم أولاً (FIFO)'}
              </span>
              <span className="sm:hidden text-[11px]">
                {sortBy === 'NEWEST' ? 'الأحدث' : 'الأقدم'}
              </span>
            </button>
          </div>

          {/* Small Cards Grid */}
          {sortedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center text-slate-400 border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" />
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-800">لا توجد طلبات في هذا القسم حالياً</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {selectedTab === 'PENDING'
                  ? 'رائع! لا توجد طلبات جديدة معلقة. جميع الطلبات تم قبولها أو تحضيرها.'
                  : selectedTab === 'PREPARING'
                  ? 'لا توجد طلبات قيد التحضير في المطبخ حالياً.'
                  : 'ستظهر الطلبات الجديدة هنا فور قيام الطلاب بالطلب.'}
              </p>

              {orders.length > 0 && selectedTab !== 'ALL' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTab('ALL')}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <span>عرض كافة الطلبات ({orders.length})</span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full w-fit mx-auto mt-2 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>الفرع متصل وجاهز لاستقبال الطلبات لحظياً</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {sortedOrders.map((order: any) => {
                const isPending = order.status === 'PENDING';
                const isPreparing = order.status === 'PREPARING' || order.status === 'ACCEPTED';
                const isReady = order.status === 'READY';
                const isCompleted = order.status === 'COMPLETED';
                const isRejected = order.status === 'REJECTED';

                const itemsCount = order.items?.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) || order.items?.length || 0;

                return (
                  <div
                    key={order.id}
                    onClick={() => setDetailedOrder(order)}
                    className={`bg-white rounded-2xl border p-4 transition-all shadow-xs hover:shadow-lg cursor-pointer hover:border-indigo-400 active:scale-[0.98] flex flex-col justify-between gap-3 group relative ${
                      isPending
                        ? 'border-amber-400 ring-2 ring-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white'
                        : isPreparing
                        ? 'border-blue-200 hover:border-blue-400'
                        : isReady
                        ? 'border-purple-200 hover:border-purple-400 bg-gradient-to-b from-purple-50/20 to-white'
                        : isCompleted
                        ? 'border-slate-200 opacity-90'
                        : 'border-rose-200 opacity-80'
                    }`}
                  >
                    {/* 1. Header: Order #, Order Type, Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-black text-base sm:text-lg text-slate-900 tracking-tight">
                          #{order.orderNumber}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${
                          order.orderType === 'DELIVERY'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {order.orderType === 'DELIVERY' ? '🛵 توصيل' : '🛍️ استلام'}
                        </span>
                      </div>

                      <div className="shrink-0">
                        {isPending && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white animate-pulse">
                            جديد
                          </span>
                        )}
                        {isPreparing && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white bg-blue-600">
                            جاري التحضير
                          </span>
                        )}
                        {isReady && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-600 text-white">
                            جاهز للتسليم
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                            مكتمل
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white">
                            ملغي
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Customer and Time */}
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-bold truncate max-w-[150px]">
                        👤 {order.customerName || 'طالب'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* 3. The 3 requested fields: رقم الأوردر، عدد الأصناف، السعر */}
                    <div className="flex items-center justify-between bg-slate-50 group-hover:bg-indigo-50/50 p-2.5 rounded-xl border border-slate-100 transition-colors">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                        <ShoppingBag className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>عدد الأصناف:</span>
                        <span className="font-black text-indigo-700 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {itemsCount}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-slate-900 text-sm sm:text-base font-mono">
                          {order.total} ج.م
                        </span>
                      </div>
                    </div>

                    {/* 4. Footer link to open */}
                    <div className="pt-1 flex items-center justify-between text-[11px] font-black text-indigo-600 group-hover:text-indigo-700 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض تفاصيل الأوردر</span>
                      </span>
                      <span className="text-slate-400 group-hover:translate-x-[-3px] transition-transform">←</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Acceptance Modal: Estimated Time Chips & Interactive Driver Cards */}
      {acceptingOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">تحديد وقت التجهيز والطيار</h4>
                  <span className="text-[11px] font-bold text-slate-400">
                    طلب الطالب #{acceptingOrder.orderNumber} ({acceptingOrder.orderType === 'DELIVERY' ? '🛵 توصيل' : '🛍️ استلام'})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAcceptingOrder(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* 1. Prep Time Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الوقت المتوقع لتجهيز الوجبة:</span>
                  </label>
                  <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    {prepMinutes} دقيقة
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 20, 25, 30, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setPrepMinutes(mins)}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                        prepMinutes === mins
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-200'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                      }`}
                    >
                      {mins} دقيقة
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">أو حدد يدوياً (دقيقة):</span>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={prepMinutes}
                    onChange={e => setPrepMinutes(parseInt(e.target.value) || 15)}
                    className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* 2. Interactive Driver Cards Selector */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>إسناد كابتن التوصيل (الطيار):</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">
                    اختياري عند القبول
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {/* Option AUTO: Smart Auto-Dispatch */}
                  {drivers.some((d: any) => d.isActive) && (
                    <button
                      type="button"
                      onClick={() => setAcceptDriverId('AUTO')}
                      className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                        acceptDriverId === 'AUTO'
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                          : 'bg-indigo-50/70 hover:bg-indigo-50 text-indigo-950 border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
                          acceptDriverId === 'AUTO' ? 'bg-white/20 text-white' : 'bg-indigo-600 text-white shadow-xs'
                        }`}>
                          🤖
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs block">
                              إسناد تلقائي ذكي لأقرب طيار متفرغ ⚡
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              acceptDriverId === 'AUTO' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              موصى به
                            </span>
                          </div>
                          <span className={`text-[10px] font-medium block mt-0.5 ${
                            acceptDriverId === 'AUTO' ? 'text-indigo-100' : 'text-indigo-700'
                          }`}>
                            يختار تلقائياً الكابتن المتفرغ الأقرب للمطعم عبر الـ GPS
                          </span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                        acceptDriverId === 'AUTO'
                          ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                          : 'border-indigo-300 bg-white'
                      }`}>
                        {acceptDriverId === 'AUTO' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  )}

                  {/* Option 0: Assign Later */}
                  <button
                    type="button"
                    onClick={() => setAcceptDriverId('')}
                    className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                      acceptDriverId === ''
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        acceptDriverId === '' ? 'bg-white/15 text-white' : 'bg-white text-slate-500 border border-slate-200'
                      }`}>
                        ⏳
                      </div>
                      <div>
                        <span className="font-black text-xs block">
                          بدون تعيين طيار الآن
                        </span>
                        <span className={`text-[10px] font-medium block ${
                          acceptDriverId === '' ? 'text-slate-300' : 'text-slate-400'
                        }`}>
                          قبول الطلب وبدء التجهيز وتعيين الطيار لاحقاً
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                      acceptDriverId === ''
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {acceptDriverId === '' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Driver Cards */}
                  {drivers.map((d: any) => {
                    const isSelected = acceptDriverId === d.id;
                    const isGeneral = Boolean(d.isGeneralDriver || d.name?.includes('طيار عام'));
                    const driverActiveOrders = orders.filter(
                      (o: any) =>
                        o.driverId === d.id &&
                        (o.status === 'PREPARING' || o.status === 'ACCEPTED' || o.status === 'READY')
                    ).length;

                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!d.isActive}
                        onClick={() => setAcceptDriverId(d.id)}
                        className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                          !d.isActive
                            ? 'bg-slate-100/60 border-slate-200 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : isGeneral
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {isGeneral ? '🌐' : '🛵'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                                {cleanDriverName(d.name)}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                                isGeneral
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {isGeneral ? 'طيار عام' : 'طيار الفرع'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] font-mono font-bold text-slate-500" dir="ltr">
                                {d.phone}
                              </span>
                              {!d.isActive ? (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  غير متاح
                                </span>
                              ) : driverActiveOrders === 0 ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  متفرغ الآن ✓
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                  معه {driverActiveOrders} طلب
                                </span>
                              )}
                              {d.distanceKm !== null && d.distanceKm !== undefined && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono">
                                  📍 {d.distanceKm} كم
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleConfirmAccept}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {acceptDriverId === 'AUTO'
                    ? `قبول وإسناد ذكي تلقائي (${prepMinutes} د)`
                    : acceptDriverId
                    ? `قبول وإسناد للكابتن (${prepMinutes} د)`
                    : `تأكيد القبول (${prepMinutes} دقيقة)`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAcceptingOrder(null)}
                className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection & Cancellation Dialog */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm">رفض الطلب #{rejectingOrder.orderNumber}</h4>
                  <p className="text-[11px] text-slate-400">يرجى توضيح سبب الرفض لإشعار الطالب والسيستم</p>
                </div>
              </div>
              <button 
                onClick={() => setRejectingOrder(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              اختر سبباً سريعاً أو اكتب سبباً مخصصاً:
            </p>

            <div className="space-y-1.5">
              {[
                'نفاد المكونات المطلوبة',
                'ضغط طلبات شديد والمطعم غير قادر على الاستلام حالياً',
                'المطعم في استراحة / إغلاق مؤقت',
                'العنوان خارج نطاق التوصيل المتاح',
                'العميل لم يستجب لتأكيد الطلب',
                'خطأ في بيانات أو أصناف الطلب'
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className={`w-full text-right p-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between ${
                    rejectionReason === reason
                      ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{reason}</span>
                  {rejectionReason === reason && <Check className="w-4 h-4 text-rose-600 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">سبب مخصص أو ملاحظة إضافية للعميل:</label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="اكتب سبب الإلغاء هنا..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                disabled={updatingId === rejectingOrder.id || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 transition-all active:scale-95"
              >
                {updatingId === rejectingOrder.id ? 'جارٍ الإلغاء...' : 'تأكيد رفض الطلب وإشعار الطالب'}
              </button>
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Preview Modal */}
      {viewingProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-rose-600" />
                <h4 className="font-black text-slate-800 text-sm">إيصال تحويل الطالب</h4>
              </div>
              <button onClick={() => setViewingProofUrl(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              <img
                src={getFullImageUrl(viewingProofUrl)}
                alt="إيصال التحويل"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewingProofUrl(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer CRM Modal (Notes & Block Account) */}
      {editingCustomerCRM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="font-black text-slate-800 text-sm">سجل وملاحظات العميل: {editingCustomerCRM.customerName}</h4>
                  <span className="text-xs font-mono text-slate-500">{editingCustomerCRM.customerPhone}</span>
                </div>
              </div>
              <button onClick={() => setEditingCustomerCRM(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">عدد مرات الطلب من الحساب:</span>
              <span className="font-black text-indigo-700 bg-white px-3 py-1 rounded-xl border border-indigo-200">
                {editingCustomerCRM.orderCount <= 1
                  ? '🌟 أول مرة يطلب (طلب واحد)'
                  : `🔄 طلب ${editingCustomerCRM.orderCount} مرات`}
              </span>
            </div>

            <form onSubmit={handleSaveCustomerCRM} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  ملاحظات المطعم على هذا الرقم (تظهر لك تلقائياً في أي طلب قادم منه):
                </label>
                <textarea
                  rows={3}
                  placeholder="مثال: عميل ممتاز / يفضل الاتصال قبل الوصول بـ 5 دقائق / تأخر في استلام الطلب السابق..."
                  value={crmNotesInput}
                  onChange={e => setCrmNotesInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                crmBlockedInput
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
              }`}>
                <input
                  type="checkbox"
                  checked={crmBlockedInput}
                  onChange={e => setCrmBlockedInput(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <span className="font-black block text-rose-700">🚫 إيقاف وحظر هذا الحساب من الطلب مستقبلاً</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    عند التفعيل، لن يتمكن صاحب هذا الرقم من إرسال أي طلبات جديدة أو تسجيل الدخول.
                  </span>
                </div>
              </label>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={savingCRM}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingCRM ? 'جاري الحفظ...' : 'حفظ الملاحظة وحالة الحساب'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCustomerCRM(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return from Driver Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center animate-scaleIn">
            <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-slate-800">
                استلام الطلب #{returnModalOrder.orderNumber} من الطيار
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                أعطِ هذا الرمز للطيار ليكتبه في تطبيقه لتأكيد استلامك للوجبة وإلغاء مسؤوليته عنها:
              </p>
            </div>

            {/* 4-Digit PIN Display */}
            <div className="py-2">
              {returnPinLoading ? (
                <div className="py-4 flex justify-center">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl py-3 px-6 inline-block tracking-widest text-3xl font-mono font-black text-amber-900 shadow-inner">
                  {returnPin || '••••'}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              أو يمكنك الضغط أدناه لتأكيد الاستلام مباشرة إذا استلمت الوجبة بالفعل من الكابتن:
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={confirmingDirectReturn || returnPinLoading}
                onClick={handleConfirmDirectReturn}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{confirmingDirectReturn ? 'جاري التأكيد...' : 'تأكيد استلام الوجبة من الطيار مباشرة'}</span>
              </button>

              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {printingOrder && (
        <ReceiptModal
          order={printingOrder}
          branchName={branchName}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
};
