import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Navigation
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';
import { toast } from '../utils/toast';
import { useLockBodyScroll } from '../utils/scrollLock';
import { 
  getDisplayAddress,
  extractCoordinatesFromAddress,
  calculateDistanceMeters,
  calculateEtaMinutes,
  formatDistance,
  DEFAULT_CAMPUS_RESTAURANT_COORDS
} from '../utils/address';
import { ReceiptModal } from './ReceiptModal';
import { soundNotifier } from '../services/audioAlert';
import { getAutoPrintEnabled, getAutoPrintOnAccept, printOrderReceipt } from '../services/printer';
import { OrderDriverLiveMap } from './OrderDriverLiveMap';

interface OrdersViewProps {
  orders: any[];
  branchName: string;
  branch?: any;
  socket?: any;
  liveDriverLocations?: Record<string, { lat: number; lng: number; orderId?: string; timestamp: number }>;
  onRefreshOrders: () => void;
  initialDetailedOrder?: any | null;
  onClearDetailedOrder?: () => void;
  onDetailedOrderOpenChange?: (isOpen: boolean) => void;
  newOrderTrigger?: number;
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
  branch,
  socket,
  liveDriverLocations,
  onRefreshOrders,
  initialDetailedOrder,
  onClearDetailedOrder,
  onDetailedOrderOpenChange,
  newOrderTrigger
}) => {
  const [selectedTab, setSelectedTab] = useState<string>('PENDING');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [expandedTimingId, setExpandedTimingId] = useState<string | null>(null);

  // Detailed Full Order Modal state
  const [detailedOrder, setDetailedOrder] = useState<any | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [showDriverPicker, setShowDriverPicker] = useState<boolean>(false);
  const [trackingOrderMap, setTrackingOrderMap] = useState<any | null>(null);

  // مرجع لتسجيل وقت آخر طلب جديد تم التوجيه له، لضمان التحويل مرة واحدة فقط وعدم تكرار الإغلاق
  const lastHandledNewOrderRef = useRef<number>(0);

  // عند وصول طلب جديد فعلياً: يتم إرجاع الكاشير لشاشة الطلبات الجديدة لمرة واحدة فقط
  useEffect(() => {
    if (newOrderTrigger && newOrderTrigger > lastHandledNewOrderRef.current) {
      lastHandledNewOrderRef.current = newOrderTrigger;
      // يحدث لمرة واحدة فقط لحظة استلام طلب جديد فعلي
      setDetailedOrder(null);
      setTrackingOrderMap(null);
      setAcceptingOrder(null);
      setRejectingOrder(null);
      setSelectedTab('PENDING');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [newOrderTrigger]);

  // عند فتح تفاصيل الطلب أو خريطة التتبع، ننضم لغرفة السوكيت ونطلب موقع الطيار اللحظي
  useEffect(() => {
    const activeOrd = detailedOrder || trackingOrderMap;
    const activeDriverId = activeOrd?.driver?.id || activeOrd?.driverId;
    if (socket && activeOrd?.id) {
      socket.emit('join_order', activeOrd.id);
    }
    if (socket && activeDriverId) {
      socket.emit('get_driver_location', activeDriverId);
    }
  }, [detailedOrder?.id, trackingOrderMap?.id, socket]);

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
      printingOrder ||
      trackingOrderMap
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
      customerName: order.customerName || order.user?.name || 'عميل',
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

  useEffect(() => {
    if (!socket) return;
    const handleDriverPresence = ({ driverId, isOnline }: { driverId: string; isOnline: boolean }) => {
      setDrivers(prev => prev.map(d => (d.id === driverId ? { ...d, isOnline } : d)));
    };
    socket.on('driver_presence_changed', handleDriverPresence);
    return () => {
      socket.off('driver_presence_changed', handleDriverPresence);
    };
  }, [socket]);

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

    if (driverId && driverId !== 'AUTO') {
      const selectedDrv = drivers.find(d => d.id === driverId);
      if (selectedDrv && !selectedDrv.isOnline) {
        const confirmed = window.confirm(
          `⚠️ تنبيه: الكابتن "${cleanDriverName(selectedDrv.name)}" غير متصل حالياً (التطبيق مغلق أو لا يوجد إنترنت لديه).\n\nيفضل اختيار كابتن متصل لضمان استلام الطلب وتوصيله في أسرع وقت.\nهل أنت متأكد من رغبتك في إسناد الطلب إليه الآن؟`
        );
        if (!confirmed) {
          return;
        }
      }
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
    onDetailedOrderOpenChange?.(false);
    setSelectedTab('PENDING');
    await handleUpdateStatus(orderToReject.id, 'REJECTED', undefined, finalReason);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingOrder) return;
    const orderToAccept = acceptingOrder;
    const minutes = prepMinutes || 15;
    const driverToAssign = acceptDriverId;
    setAcceptingOrder(null);

    // إغلاق شاشة تفاصيل الأوردر والرجوع فوراً لشاشة الطلبات الجديدة
    setDetailedOrder(null);
    onClearDetailedOrder?.();
    onDetailedOrderOpenChange?.(false);
    setSelectedTab('PENDING');

    // إيقاف صوت التنبيه فور قبول الطلب
    soundNotifier.stopRepeatingAlarm();

    // 1. تحديث حالة الطلب إلى قيد التحضير أولاً (قبول الطلب وتأكيده)
    await handleUpdateStatus(orderToAccept.id, 'PREPARING', minutes);

    // 2. إذا اختار المطعم طياراً فورياً أو إسناداً تلقائياً ذكياً عند القبول، يتم إسناده الآن بعد أن تم قبول الطلب
    if (driverToAssign) {
      if (driverToAssign !== 'AUTO') {
        const selectedDrv = drivers.find(d => d.id === driverToAssign);
        if (selectedDrv && !selectedDrv.isOnline) {
          const confirmed = window.confirm(
            `⚠️ تنبيه: الكابتن "${cleanDriverName(selectedDrv.name)}" غير متصل حالياً (التطبيق مغلق أو لا يوجد إنترنت لديه).\n\nيفضل اختيار كابتن متصل لضمان استلام الطلب وتوصيله في أسرع وقت.\nهل تريد المتابعة وإسناد الطلب إليه على أي حال؟`
          );
          if (!confirmed) {
            onRefreshOrders();
            return;
          }
        }
      }
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
          <div className="max-w-3xl mx-auto animate-fadeIn pb-3">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/5">
              {/* 1. Unified Receipt Ticket Header with Direct Action Buttons */}
              <div className="bg-slate-900 text-white rounded-t-3xl px-4 sm:px-5 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailedOrder(null);
                      onClearDetailedOrder?.();
                      onDetailedOrderOpenChange?.(false);
                      if (isPending) setSelectedTab('PENDING');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition-all active:scale-95 shrink-0 cursor-pointer"
                    title="رجوع لقائمة الأوردرات"
                  >
                    <ArrowRight className="w-4 h-4 shrink-0 text-slate-300" />
                    <span>رجوع</span>
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-base sm:text-lg text-white">
                        طلب رقم #{dOrder.orderNumber}
                      </span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 flex items-center gap-1 ${
                        dOrder.orderType === 'DELIVERY'
                          ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-400/30'
                          : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/30'
                      }`}>
                        {dOrder.orderType === 'DELIVERY' ? '🛵 توصيل' : '🛍️ استلام'}
                      </span>
                      {isPending && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-black whitespace-nowrap shrink-0 flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>طلب جديد</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      {isPending && <span>منذ {formatDuration(waitMins)}</span>}
                      {isPreparing && <span>المحدد: {dOrder.estimatedMinutes || 15} د • مضى {formatDuration(prepMins)}</span>}
                      {isReady && <span>في انتظار الاستلام منذ {formatDuration(deliveryMins)}</span>}
                      {isCompleted && <span>استغرق إجمالاً {formatDuration(totalMins)}</span>}
                      {isRejected && <span>السبب: {dOrder.rejectionReason || 'بدون سبب'}</span>}
                      <span className="text-slate-600">•</span>
                      <span>مطلوب تحصيل <strong className="font-mono text-white font-black">{dOrder.total} ج.م</strong></span>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons & Status in Ticket Header (Immediately visible at top) */}
                <div className="flex items-center gap-2 flex-wrap shrink-0 mr-auto sm:mr-0">
                  <button
                    type="button"
                    onClick={() => setPrintingOrder(dOrder)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                    title="طباعة الفاتورة"
                  >
                    <Printer className="w-4 h-4 text-indigo-400" />
                  </button>

                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrder(dOrder);
                          setRejectionReason('نفاد المكونات المطلوبة');
                        }}
                        className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-300" />
                        <span>رفض الطلب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAcceptingOrder(dOrder);
                          setPrepMinutes(15);
                          setAcceptDriverId(dOrder.driverId || '');
                        }}
                        className="px-4 sm:px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>قبول وتجهيز الطلب</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap ${
                        isPreparing
                          ? isOverdue
                            ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                          : isReady
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                          : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                      }`}>
                        {isPreparing && <ChefHat className="w-3.5 h-3.5" />}
                        {isReady && <Truck className="w-3.5 h-3.5" />}
                        {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                        {isRejected && <XCircle className="w-3.5 h-3.5" />}
                        <span>
                          {isPreparing && (isOverdue ? `متأخر بـ ${overdueMins} د` : 'قيد التحضير')}
                          {isReady && 'جاهز للتسليم'}
                          {isCompleted && 'مكتمل'}
                          {isRejected && 'ملغي / مرفوض'}
                        </span>
                      </span>

                      {isPreparing && (
                        <button
                          type="button"
                          disabled={updatingId === dOrder.id}
                          onClick={() => handleUpdateStatus(dOrder.id, 'READY')}
                          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/25 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>جاهز للاستلام</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          type="button"
                          disabled={updatingId === dOrder.id}
                          onClick={() => handleUpdateStatus(dOrder.id, 'COMPLETED')}
                          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/25 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>تأكيد التسليم</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Flush Alert Strip under Header (only when Overdue or Rejected) */}
              {isPreparing && isOverdue && (
                <div className="px-4 sm:px-5 py-2 bg-rose-50 border-b border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تنبيه: هذا الطلب متأخر عن وقت التجهيز المحدد بـ {overdueMins} دقيقة — يرجى سرعة إنهائه.</span>
                </div>
              )}
              {isRejected && (
                <div className="px-4 sm:px-5 py-2 bg-rose-50/70 border-b border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-bold">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تم رفض / إلغاء هذا الطلب ({dOrder.rejectionReason || 'بدون سبب'})</span>
                </div>
              )}

              {/* 2. Unified Receipt Ticket Body */}
              <div className="p-3.5 sm:p-4 space-y-3.5">
                {/* A. Items Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>الأصناف المطلوبة ({dOrder.items?.length || 0}):</span>
                    </h4>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {formatTimeOnly(dOrder.createdAt)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {dOrder.items?.map((item: any, idx: number) => {
                      const itemTitle = item.item?.name || item.itemName || 'صنف';
                      return (
                        <div key={idx} className="p-2.5 sm:p-3 hover:bg-slate-50/60 transition-colors space-y-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                                {item.quantity}×
                              </span>
                              <div className="min-w-0">
                                <div className="font-black text-slate-900 text-xs sm:text-sm leading-snug flex items-center gap-1.5 flex-wrap">
                                  <span>{itemTitle}</span>
                                  {item.sizeName && (
                                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                      {item.sizeName}
                                    </span>
                                  )}
                                </div>
                                {item.itemPrice && Number(item.quantity) > 1 && (
                                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                                    سعر الواحدة: {item.itemPrice} ج.م
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="font-mono font-black text-slate-900 text-xs sm:text-sm shrink-0">
                              {item.totalPrice} ج.م
                            </span>
                          </div>

                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="mr-8 flex flex-wrap gap-1 pt-0.5">
                              {item.modifiers.map((mod: any, mIdx: number) => (
                                <span key={mIdx} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                                  + {mod.optionName} {mod.price > 0 && `(${mod.price} ج.م)`}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.notes && (
                            <div className="mr-8 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-lg font-bold">
                              <span>ملاحظة: </span>
                              <span>{item.notes}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* General Customer Note on Order */}
                  {(dOrder.notes || dOrder.orderNotes) && (
                    <div className="mt-3 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-1">
                      <span className="font-black text-amber-900 flex items-center gap-1.5">
                        <span>📝</span>
                        <span>ملاحظة العميل مع الطلب:</span>
                      </span>
                      <p className="font-bold text-amber-950 leading-relaxed whitespace-pre-wrap select-text">
                        {dOrder.notes || dOrder.orderNotes}
                      </p>
                    </div>
                  )}

                  {/* Group Cart Bags Breakdown */}
                  {dOrder.groupCartDetails && (() => {
                    try {
                      const details = typeof dOrder.groupCartDetails === 'string' ? JSON.parse(dOrder.groupCartDetails) : dOrder.groupCartDetails;
                      if (Array.isArray(details) && details.length > 0) {
                        return (
                          <div className="mt-3 p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-2.5 text-xs">
                            <div className="flex items-center gap-2 font-black text-purple-900">
                              <Users className="w-4 h-4 text-purple-700" />
                              <span>تقسيم أكياس الطلب الجماعي ({details.length} أفراد):</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {details.map((group: any, gIdx: number) => (
                                <div key={gIdx} className="bg-white p-2.5 rounded-xl border border-purple-100">
                                  <div className="flex items-center justify-between font-black text-purple-800 border-b border-purple-50 pb-1 mb-1">
                                    <span>🛍️ كيس: {group.studentName}</span>
                                    {group.subtotal !== undefined && <span className="font-mono">{group.subtotal} ج.م</span>}
                                  </div>
                                  <div className="space-y-0.5 text-slate-600">
                                    {(group.items || []).map((gi: any, giIdx: number) => (
                                      <div key={giIdx} className="flex justify-between">
                                        <span>{gi.quantity}× {gi.itemName} {gi.sizeName ? `(${gi.sizeName})` : ''}</span>
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
                </div>

                {/* B. Customer & Delivery Logistics (Equal 2-Column Row) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                  {/* Card 1: Customer Information */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs flex flex-col justify-between gap-2.5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-400 text-[11px]">بيانات العميل:</span>
                        <button
                          type="button"
                          onClick={() => handleOpenCustomerCRM(dOrder, customerOrderCount)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                          title="سجل وملاحظات العميل"
                        >
                          <History className="w-3 h-3" />
                          <span>السجل ({customerOrderCount})</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-black text-slate-900 text-sm block truncate">
                            {dOrder.customerName || 'عميل'}
                          </span>
                          <span className="font-mono font-bold text-slate-500 text-xs mt-0.5 block" dir="ltr">
                            {customerPhone || 'بدون رقم هاتف'}
                          </span>
                        </div>

                        {customerPhone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`tel:${customerPhone}`}
                              className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors flex items-center gap-1 font-bold"
                              title="اتصال بالعميل"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>اتصال</span>
                            </a>
                            <a
                              href={`https://wa.me/${whatsappNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-1 font-bold"
                              title="مراسلة واتساب"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>واتساب</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-start gap-1.5 text-slate-700 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {dOrder.orderType === 'PICKUP'
                          ? 'استلام شخصي من الفرع'
                          : `${dOrder.deliveryZoneName ? `${dOrder.deliveryZoneName} • ` : ''}${getDisplayAddress(dOrder.deliveryLocation || dOrder.addressText, 'موقع العميل')}`}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Delivery & Driver Assignment */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs flex flex-col justify-between gap-2.5">
                    {dOrder.orderType !== 'DELIVERY' ? (
                      <>
                        <div className="space-y-1">
                          <span className="font-bold text-slate-400 text-[11px] block">طريقة الاستلام:</span>
                          <span className="font-black text-slate-900 text-sm block">🛍️ استلام شخصي من المطعم</span>
                          <span className="text-slate-500 block leading-snug">
                            يحضر العميل لاستلام الطلب مباشرة من الفرع.
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/80 text-emerald-700 font-bold flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>بدون رسوم توصيل</span>
                        </div>
                      </>
                    ) : assignedDriver && !showDriverPicker ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-400 text-[11px]">كابتن التوصيل المعين:</span>
                            <div className="flex items-center gap-2">
                              {!isCompleted && !isRejected && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setShowDriverPicker(true)}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                                  >
                                    تغيير
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignDriver(dOrder.id, null)}
                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800"
                                  >
                                    إلغاء
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-slate-900 text-sm truncate">
                                  🛵 {cleanDriverName(assignedDriver.name)}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  assignedDriver.isGeneralDriver || assignedDriver.name?.includes('طيار عام')
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}>
                                  {assignedDriver.isGeneralDriver || assignedDriver.name?.includes('طيار عام') ? 'عام' : 'الفرع'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-500 text-xs mt-0.5 block" dir="ltr">
                                {assignedDriver.phone}
                              </span>
                            </div>

                            {assignedDriver.phone && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={`tel:${assignedDriver.phone}`}
                                  className="p-1.5 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors"
                                  title="اتصال بالطيار"
                                >
                                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                </a>
                                <a
                                  href={`https://wa.me/${assignedDriver.phone.replace(/[^0-9]/g, '').startsWith('0') ? `20${assignedDriver.phone.replace(/[^0-9]/g, '').slice(1)}` : assignedDriver.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                                  title="واتساب الطيار"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/80 space-y-2">
                          {isPickedUpByDriver ? (
                            <div className="flex items-center justify-between gap-2 text-emerald-800 font-bold">
                              <span className="flex items-center gap-1.5 min-w-0 truncate">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">استلم الوجبة ({formatTimeOnly(dOrder.driverPickedUpAt)})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(dOrder)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-black shrink-0 flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>رمز PIN</span>
                              </button>
                            </div>
                          ) : dOrder.isDriverAccepted ? (
                            <div className="text-indigo-800 font-bold flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>قبل الطلب وفي طريقه للفرع</span>
                            </div>
                          ) : (
                            <div className="text-amber-800 font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                              <span>مسند للطيار • بانتظار استلام الوجبة</span>
                            </div>
                          )}

                          {!isCompleted && !isRejected && (
                            <button
                              type="button"
                              onClick={() => setTrackingOrderMap(dOrder)}
                              className="w-full py-1.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                              <span>تتبع موقع الطيار مباشرة على الخريطة</span>
                            </button>
                          )}
                        </div>
                      </>
                    ) : isPending ? (
                      <>
                        <div className="space-y-1">
                          <span className="font-bold text-slate-400 text-[11px] block">كابتن التوصيل:</span>
                          <span className="font-black text-slate-900 text-sm block">⏳ يُعين عند قبول الطلب</span>
                          <span className="text-slate-500 block leading-snug text-[11px]">
                            تحديد وقت التحضير وإسناد الطيار فور قبول الطلب.
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-slate-700 font-bold">
                          <span>{dOrder.deliveryZoneName || 'توصيل دليفري'}</span>
                          <span className="font-mono text-indigo-700">
                            {dOrder.deliveryFee ? `${dOrder.deliveryFee} ج.م توصيل` : 'توصيل مجاني'}
                          </span>
                        </div>
                      </>
                    ) : isCompleted || isRejected ? (
                      <>
                        <div className="space-y-1">
                          <span className="font-bold text-slate-400 text-[11px] block">كابتن التوصيل:</span>
                          <span className="font-black text-slate-900 text-sm block">
                            {isCompleted ? '✓ تم التسليم المباشر عبر الفرع' : '✕ لم يتم تعيين طيار'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/80 text-slate-500 font-bold">
                          {isCompleted ? 'أُكمل الطلب بنجاح' : 'الطلب ملغي / مرفوض'}
                        </div>
                      </>
                    ) : (
                      /* Compact Inline Driver Picker (when accepted order has no driver or user clicked "تغيير") */
                      (() => {
                        const currentSelectedDriverId = selectedDriverMap[dOrder.id] !== undefined
                          ? selectedDriverMap[dOrder.id]
                          : (dOrder.driverId || '');
                        const activeDriversCount = drivers.filter((d: any) => d.isActive).length;

                        return (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-500 text-[11px]">
                                {assignedDriver ? 'اختر طياراً بديلاً:' : `اختر كابتن التوصيل (${activeDriversCount} متاح):`}
                              </span>
                              {activeDriversCount > 0 && (
                                <button
                                  type="button"
                                  disabled={assigningDriverOrderId === dOrder.id}
                                  onClick={async () => {
                                    await handleAssignDriver(dOrder.id, 'AUTO');
                                    setShowDriverPicker(false);
                                  }}
                                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black transition-all active:scale-95"
                                >
                                  ⚡ إسناد ذكي تلقائي
                                </button>
                              )}
                            </div>

                            {drivers.length === 0 ? (
                              <div className="p-3 bg-white border border-slate-200 rounded-xl text-center text-slate-500 font-bold">
                                لا يوجد طيارون مسجلون حالياً في الفرع.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-36 overflow-y-auto">
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
                                      className={`w-full text-right px-2.5 py-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                        !d.isActive
                                          ? 'bg-slate-100 opacity-50 cursor-not-allowed border-slate-200'
                                          : isSelected
                                          ? 'bg-indigo-50 border-indigo-600'
                                          : 'bg-white hover:border-indigo-300 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${d.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                        <span className="font-black text-slate-900 truncate">
                                          {cleanDriverName(d.name)}
                                        </span>
                                        {isGeneral && (
                                          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                                            عام
                                          </span>
                                        )}
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                          !d.isActive
                                            ? 'bg-rose-50 text-rose-600'
                                            : driverActiveOrders === 0
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-amber-50 text-amber-700'
                                        }`}>
                                          {!d.isActive ? 'غير متاح' : driverActiveOrders === 0 ? 'متفرغ' : `معه ${driverActiveOrders}`}
                                        </span>
                                        {d.distanceKm !== null && d.distanceKm !== undefined && (
                                          <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                                            {d.distanceKm} كم
                                          </span>
                                        )}
                                      </div>

                                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              {showDriverPicker && (
                                <button
                                  type="button"
                                  onClick={() => setShowDriverPicker(false)}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors"
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
                                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-black transition-all active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>
                                  {assigningDriverOrderId === dOrder.id
                                    ? 'جاري الحفظ...'
                                    : assignedDriver
                                    ? 'تأكيد التغيير'
                                    : 'إسناد الكابتن المختار'}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* C. Financial Breakdown & Total Due Strip */}
                <div className="space-y-2.5">
                  <div className="rounded-2xl border border-indigo-100 overflow-hidden">
                    {Boolean(
                      (dOrder.deliveryFee && Number(dOrder.deliveryFee) > 0) ||
                      (dOrder.discount && Number(dOrder.discount) > 0) ||
                      (dOrder.walletDiscount && Number(dOrder.walletDiscount) > 0)
                    ) && (
                      <div className="bg-slate-50/70 px-3.5 py-2 space-y-1 border-b border-indigo-100 text-xs">
                        {dOrder.subtotal !== undefined && (
                          <div className="flex justify-between text-slate-600">
                            <span>المجموع الفرعي للأصناف:</span>
                            <span className="font-mono font-bold text-slate-800">{dOrder.subtotal} ج.م</span>
                          </div>
                        )}
                        {Boolean(dOrder.deliveryFee && Number(dOrder.deliveryFee) > 0) && (
                          <div className="flex justify-between text-slate-600">
                            <span>رسوم التوصيل:</span>
                            <span className="font-mono font-bold text-slate-800">{dOrder.deliveryFee} ج.م</span>
                          </div>
                        )}
                        {Boolean(dOrder.discount && Number(dOrder.discount) > 0) && (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>🎟️ خصم الكوبون ({dOrder.promoCode || 'ترويجي'}):</span>
                            <span className="font-mono font-black">-{dOrder.discount} ج.م</span>
                          </div>
                        )}
                        {Boolean(dOrder.walletDiscount && Number(dOrder.walletDiscount) > 0) && (
                          <div className="flex justify-between text-purple-700 font-bold">
                            <span>💳 خصم من محفظة العميل:</span>
                            <span className="font-mono font-black">-{dOrder.walletDiscount} ج.م</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-indigo-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-indigo-950 text-sm">الإجمالي النهائي المطلوب:</span>
                        <span className="text-xs font-bold bg-white text-slate-800 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg">
                          {dOrder.paymentMethod === 'CASH' && '💵 نقداً عند الاستلام'}
                          {dOrder.paymentMethod === 'WALLET' && '💳 محفظة إلكترونية'}
                          {dOrder.paymentMethod === 'ONLINE' && '💳 دفع إلكتروني'}
                          {dOrder.paymentMethod === 'VODAFONE_CASH' && (!dOrder.paymentProofUrl && !dOrder.paymentSenderPhone ? '📱 فودافون كاش (عند الاستلام)' : '📱 فودافون كاش (بإيصال)')}
                          {dOrder.paymentMethod === 'INSTAPAY' && (!dOrder.paymentProofUrl && !dOrder.paymentSenderPhone ? '⚡ إنستاباي (عند الاستلام)' : '⚡ إنستاباي (بإيصال)')}
                          {!['CASH', 'WALLET', 'ONLINE', 'VODAFONE_CASH', 'INSTAPAY'].includes(dOrder.paymentMethod) && (dOrder.paymentMethod || 'نقداً')}
                        </span>
                      </div>
                      <span className="font-mono font-black text-indigo-700 text-lg sm:text-xl">
                        {dOrder.total} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Electronic Transfer Verification (Vodafone Cash / InstaPay Proof) */}
                  {(dOrder.paymentSenderPhone || dOrder.paymentProofUrl) && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[11px] font-bold text-amber-800 block">
                          {dOrder.paymentMethod === 'INSTAPAY' ? '⚡ حساب إنستاباي المحول منه:' : '📱 رقم المحفظة المحول منها:'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm select-all">
                            {dOrder.paymentSenderPhone || 'لم يحدد العميل رقماً'}
                          </span>
                          {dOrder.paymentSenderPhone && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(dOrder.paymentSenderPhone);
                                toast.success('تم نسخ الرقم');
                              }}
                              className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-amber-200 rounded-lg font-bold transition-colors flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>نسخ</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {dOrder.paymentProofUrl ? (
                        <button
                          type="button"
                          onClick={() => setViewingProofUrl(dOrder.paymentProofUrl)}
                          className="flex items-center gap-2.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-950 rounded-xl font-bold border border-amber-300 transition-colors shrink-0"
                        >
                          <img
                            src={getFullImageUrl(dOrder.paymentProofUrl)}
                            alt="إيصال التحويل"
                            className="w-8 h-8 object-cover rounded-lg border border-amber-200"
                          />
                          <div className="text-right">
                            <span className="block font-black text-xs">معاينة صورة الإيصال</span>
                            <span className="block text-[10px] text-amber-700">اضغط للتكبير</span>
                          </div>
                          <Eye className="w-4 h-4 text-amber-700 mr-1" />
                        </button>
                      ) : (
                        <span className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-1.5 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>بدون صورة إيصال</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Unified Ticket Footer Action Strip (Always sticky to viewport bottom when ticket is tall, flush when short) */}
              <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-b-3xl px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
                <button
                  type="button"
                  onClick={() => setPrintingOrder(dOrder)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>طباعة الفاتورة</span>
                </button>

                <div className="flex items-center gap-2 flex-wrap justify-end flex-1 sm:flex-none">
                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrder(dOrder);
                          setRejectionReason('نفاد المكونات المطلوبة');
                        }}
                        className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>رفض الطلب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAcceptingOrder(dOrder);
                          setPrepMinutes(15);
                          setAcceptDriverId(dOrder.driverId || '');
                        }}
                        className="flex-1 sm:flex-none justify-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>قبول وتجهيز الطلب</span>
                      </button>
                    </>
                  )}

                  {isPreparing && (
                    <button
                      type="button"
                      disabled={updatingId === dOrder.id}
                      onClick={() => handleUpdateStatus(dOrder.id, 'READY')}
                      className="flex-1 sm:flex-none justify-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>جاهز للاستلام / انتهى التحضير</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      type="button"
                      disabled={updatingId === dOrder.id}
                      onClick={() => handleUpdateStatus(dOrder.id, 'COMPLETED')}
                      className="flex-1 sm:flex-none justify-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>تأكيد التسليم (مكتمل)</span>
                    </button>
                  )}

                  {isCompleted && (
                    <div className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-black text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>تم إكمال وتسليم الطلب بنجاح</span>
                    </div>
                  )}

                  {isRejected && (
                    <div className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-black text-xs flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>الطلب مرفوض / ملغي</span>
                    </div>
                  )}
                </div>
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
                  <p className="text-xs opacity-90">يرجى قبول الطلبات وتحديد وقت التجهيز للعملاء</p>
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
                  : 'ستظهر الطلبات الجديدة هنا فور قيام العملاء بالطلب.'}
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
                        👤 {order.customerName || 'عميل'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Electronic Payment Proof Bar on Card */}
                    {(order.paymentMethod === 'VODAFONE_CASH' || order.paymentMethod === 'INSTAPAY' || order.paymentSenderPhone || order.paymentProofUrl) && (
                      <div className={`border rounded-xl p-2 flex items-center justify-between gap-1.5 text-xs ${
                        !order.paymentProofUrl && !order.paymentSenderPhone 
                          ? 'bg-indigo-50/80 border-indigo-200/90' 
                          : 'bg-amber-50/90 border-amber-200/90'
                      }`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                            !order.paymentProofUrl && !order.paymentSenderPhone
                              ? 'bg-indigo-200 text-indigo-950'
                              : 'bg-amber-200 text-amber-950'
                          }`}>
                            {order.paymentMethod === 'INSTAPAY' ? '⚡ إنستاباي' : '📱 فودافون كاش'}
                          </span>
                          {order.paymentSenderPhone ? (
                            <span className="text-[11px] font-mono font-black text-amber-900 truncate" title={`المحول منه: ${order.paymentSenderPhone}`}>
                              {order.paymentSenderPhone}
                            </span>
                          ) : (
                            <span className="text-[10px] text-indigo-800 font-bold">تحويل عند الاستلام مع الكابتن 🛵</span>
                          )}
                        </div>

                        {order.paymentProofUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingProofUrl(order.paymentProofUrl);
                            }}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 shadow-2xs transition-all"
                            title="معاينة إيصال التحويل"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>الإيصال</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Discount Badge on Card */}
                    {Boolean((order.discount && Number(order.discount) > 0) || (order.walletDiscount && Number(order.walletDiscount) > 0)) && (
                      <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                        <span className="flex items-center gap-1">
                          <span>🏷️</span>
                          <span>خصم:</span>
                          <span className="text-[10px] text-emerald-600 font-normal">
                            {[
                              order.discount && Number(order.discount) > 0 ? `كوبون (${order.promoCode || 'كود'})` : null,
                              order.walletDiscount && Number(order.walletDiscount) > 0 ? 'محفظة' : null
                            ].filter(Boolean).join(' + ')}
                          </span>
                        </span>
                        <span className="font-mono font-black text-emerald-700">
                          -{((Number(order.discount) || 0) + (Number(order.walletDiscount) || 0)).toFixed(1)} ج.م
                        </span>
                      </div>
                    )}

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

                    {/* ملاحظات العميل تظهر مباشرة على بطاقة الأوردر في شاشة الاستقبال */}
                    {(order.notes || order.orderNotes) && (
                      <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                        <span className="text-base shrink-0">📝</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-black text-amber-800 block mb-0.5">ملاحظات العميل:</span>
                          <p className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-relaxed" title={order.notes || order.orderNotes}>
                            {order.notes || order.orderNotes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* شريط تتبع الطيار الحي على بطاقة الطلب (قبل الاستلام وبعد الاستلام) */}
                    {order.orderType === 'DELIVERY' && (order.driver || order.driverId) && !isCompleted && !isRejected && (() => {
                      const drv = order.driver || drivers.find((d: any) => d.id === order.driverId);
                      const isPickedUp = Boolean(order.driverPickedUpAt) || order.status === 'READY';
                      const drvCoords = (drv?.id && liveDriverLocations?.[drv.id]) || null;
                      
                      let cardDistMeters: number | null = null;
                      let cardEtaMins: number | null = null;
                      if (drvCoords) {
                        const targetPos = isPickedUp
                          ? (extractCoordinatesFromAddress(order.addressText) || { lat: 30.031, lng: 31.212 })
                          : (branch?.latitude && branch?.longitude ? { lat: branch.latitude, lng: branch.longitude } : DEFAULT_CAMPUS_RESTAURANT_COORDS);
                        cardDistMeters = calculateDistanceMeters(drvCoords.lat, drvCoords.lng, targetPos.lat, targetPos.lng);
                        cardEtaMins = calculateEtaMinutes(cardDistMeters);
                      }

                      return (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingOrderMap(order);
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                            isPickedUp
                              ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300 text-emerald-950 shadow-2xs'
                              : 'bg-indigo-50 hover:bg-indigo-100/80 border-indigo-300 text-indigo-950 shadow-2xs'
                          }`}
                          title="اضغط لعرض خريطة تتبع الكابتن المباشرة"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-base shrink-0 animate-pulse">
                              {isPickedUp ? '🚀' : '🛵'}
                            </span>
                            <div className="min-w-0">
                              <span className="text-[11px] font-black block truncate leading-tight">
                                {isPickedUp ? 'الكابتن في طريقه للعميل' : 'الكابتن في طريقه للمطعم'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 block truncate mt-0.5">
                                {cleanDriverName(drv?.name)}
                                {cardEtaMins !== null ? ` • ~${cardEtaMins} د (${formatDistance(cardDistMeters!)})` : ''}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-2xs shrink-0 active:scale-90 transition-transform ${
                              isPickedUp ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                            }`}
                          >
                            <Navigation className="w-3 h-3" />
                            <span>خريطة</span>
                          </span>
                        </div>
                      );
                    })()}

                    {/* Quick Acceptance Action Buttons on Card for PENDING orders */}
                    {isPending && (
                      <div className="pt-2 flex items-center gap-1.5 border-t border-amber-200/80" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setAcceptingOrder(order);
                            setPrepMinutes(15);
                            setAcceptDriverId(order.driverId || '');
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>قبول وبدء التجهيز</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingOrder(order);
                            setRejectionReason('نفاد المكونات المطلوبة');
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold active:scale-95 transition-all"
                        >
                          رفض
                        </button>
                      </div>
                    )}

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
                  <h4 className="font-black text-slate-900 text-sm">
                    {acceptingOrder.orderType === 'DELIVERY' ? 'تحديد وقت التجهيز والطيار' : 'تحديد وقت تجهيز الطلب'}
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400">
                    طلب العميل #{acceptingOrder.orderNumber} ({acceptingOrder.orderType === 'DELIVERY' ? '🛵 توصيل' : '🛍️ استلام'})
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
              {/* Payment Verification Banner for Cashier */}
              {(acceptingOrder.paymentMethod === 'VODAFONE_CASH' || acceptingOrder.paymentMethod === 'INSTAPAY' || acceptingOrder.paymentProofUrl || acceptingOrder.paymentSenderPhone) && (
                !acceptingOrder.paymentProofUrl && !acceptingOrder.paymentSenderPhone ? (
                  <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛵</span>
                      <div>
                        <span className="text-xs font-black text-indigo-950 block">
                          الدفع والتحويل عند الاستلام مع الكابتن
                        </span>
                        <span className="text-[11px] font-bold text-indigo-800">
                          {acceptingOrder.paymentMethod === 'INSTAPAY' ? '⚡ إنستاباي' : '📱 فودافون كاش / محفظة'}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-200 text-xs text-indigo-900 font-bold leading-relaxed">
                      💡 اختار العميل التحويل المباشر عند وصول كابتن التوصيل. يقوم الكابتن بمحاسبته والتأكد من نجاح التحويل قبل تسليم الوجبة.
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚠️</span>
                        <div>
                          <span className="text-xs font-black text-amber-950 block">
                            تأكيد استلام التحويل الإلكتروني
                          </span>
                          <span className="text-[11px] font-bold text-amber-800">
                            {acceptingOrder.paymentMethod === 'INSTAPAY' ? '⚡ إنستاباي' : '📱 فودافون كاش / محفظة'}
                          </span>
                        </div>
                      </div>
                      {acceptingOrder.paymentProofUrl && (
                        <button
                          type="button"
                          onClick={() => setViewingProofUrl(acceptingOrder.paymentProofUrl)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>معاينة الإيصال</span>
                        </button>
                      )}
                    </div>
                    {acceptingOrder.paymentSenderPhone && (
                      <div className="flex items-center justify-between text-xs bg-white/90 px-3 py-2 rounded-xl border border-amber-200">
                        <span className="text-slate-600 font-bold">رقم / حساب المحوّل:</span>
                        <span className="font-mono font-black text-amber-950 text-sm tracking-wider dir-ltr">
                          {acceptingOrder.paymentSenderPhone}
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}

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

              {/* 2. Interactive Driver Cards Selector (Delivery orders only) */}
              {acceptingOrder.orderType === 'DELIVERY' && (
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
                              {d.isOnline ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  متصل الآن
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  غير متصل
                                </span>
                              )}
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
              )}
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
                  <p className="text-[11px] text-slate-400">يرجى توضيح سبب الرفض لإشعار العميل والسيستم</p>
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
                {updatingId === rejectingOrder.id ? 'جارٍ الإلغاء...' : 'تأكيد رفض الطلب وإشعار العميل'}
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
                <h4 className="font-black text-slate-800 text-sm">إيصال تحويل العميل</h4>
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

      {/* نافذة خريطة تتبع الطيار المباشرة (Live GPS Tracking Modal) */}
      {trackingOrderMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl animate-scaleIn">
            <OrderDriverLiveMap
              order={trackingOrderMap}
              branch={branch || { name: branchName }}
              liveDriverCoords={liveDriverLocations?.[trackingOrderMap.driver?.id || trackingOrderMap.driverId] || null}
              onRefreshLocation={() => {
                const drvId = trackingOrderMap.driver?.id || trackingOrderMap.driverId;
                if (socket && drvId) {
                  socket.emit('get_driver_location', drvId);
                }
              }}
              onClose={() => setTrackingOrderMap(null)}
              isModal={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
