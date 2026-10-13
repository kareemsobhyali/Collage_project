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
  KeyRound
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';
import { ReceiptModal } from './ReceiptModal';
import { soundNotifier } from '../services/audioAlert';
import { getAutoPrintEnabled, printOrderReceipt } from '../services/printer';

interface OrdersViewProps {
  orders: any[];
  branchName: string;
  onRefreshOrders: () => void;
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

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, branchName, onRefreshOrders }) => {
  const [selectedTab, setSelectedTab] = useState<string>('PENDING');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [expandedTimingId, setExpandedTimingId] = useState<string | null>(null);

  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Acceptance & Prep Time Dialog
  const [acceptingOrder, setAcceptingOrder] = useState<any | null>(null);
  const [prepMinutes, setPrepMinutes] = useState<number>(15);

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

  const handleOpenCustomerCRM = (order: any, orderCount: number) => {
    const userId = order.userId || order.user?.id;
    if (!userId) {
      alert('هذا الطلب غير مرتبط بحساب مسجل');
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
      setEditingCustomerCRM(null);
      onRefreshOrders();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ ملاحظات أو حالة حساب العميل');
    } finally {
      setSavingCRM(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const data = await api.getDrivers();
      setDrivers(data || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      setAssigningDriverOrderId(orderId);
      await api.assignDriver(orderId, driverId || null);
      onRefreshOrders();
    } catch (error: any) {
      alert(error.message || 'فشل إسناد الطلب للطيار');
    } finally {
      setAssigningDriverOrderId(null);
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

  const handleUpdateStatus = async (orderId: string, newStatus: string, estimatedMinutes?: number) => {
    try {
      setUpdatingId(orderId);
      await api.updateOrderStatus(orderId, newStatus, estimatedMinutes);
      if (newStatus !== 'PENDING') {
        soundNotifier.stopRepeatingAlarm();
      }
      onRefreshOrders();
    } catch (error: any) {
      alert(error.message || 'فشل تحديث الحالة');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmAccept = async () => {
    if (!acceptingOrder) return;
    const orderToAccept = acceptingOrder;
    const minutes = prepMinutes || 15;
    setAcceptingOrder(null);

    await handleUpdateStatus(orderToAccept.id, 'PREPARING', minutes);

    // Auto-print receipt if enabled in settings
    if (getAutoPrintEnabled()) {
      printOrderReceipt({ ...orderToAccept, estimatedMinutes: minutes }, branchName);
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
      {/* Pending Orders Flash Banner if there are any new orders */}
      {pendingOrders.length > 0 && (
        <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <BellRing className="w-8 h-8 animate-bounce" />
            <div>
              <h3 className="text-lg font-black">يوجد {pendingOrders.length} طلب جديد بانتظار استجابتك!</h3>
              <p className="text-sm opacity-90">يرجى قبول الطلبات وتحديد وقت التجهيز للطلاب</p>
            </div>
          </div>
          <button
            onClick={() => soundNotifier.stopRepeatingAlarm()}
            className="px-4 py-2 bg-white text-amber-700 font-bold rounded-xl text-sm hover:bg-amber-50 transition-colors shadow"
          >
            إيقاف صوت التنبيه مؤقتاً
          </button>
        </div>
      )}

      {/* Tabs & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedTab('ALL')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>كافة الطلبات</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-white">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedTab('PENDING')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'PENDING'
                ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                : 'bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>طلبات جديدة</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-600 text-white font-black">
              {pendingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedTab('SCHEDULED')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'SCHEDULED'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                : 'bg-white text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>طلبات محجوزة مسبقاً</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-black">
              {scheduledOrders.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedTab('PREPARING')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'PREPARING'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-blue-700 hover:bg-blue-50'
            }`}
          >
            <span>جاري التحضير</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
              {preparingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedTab('READY')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'READY'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-purple-700 hover:bg-purple-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>جاهز للتسليم / التوصيل</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
              {readyOrders.length}
            </span>
          </button>

          <button
            onClick={() => setSelectedTab('COMPLETED')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              selectedTab === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>مكتملة</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800">
              {completedOrders.length}
            </span>
          </button>
        </div>

        {/* Sort Controls (FIFO vs Newest) */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-sm">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
          <span className="text-slate-500 font-bold ml-1">ترتيب:</span>
          <button
            type="button"
            onClick={() => setSortBy('NEWEST')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              sortBy === 'NEWEST'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            الأحدث أولاً
          </button>
          <button
            type="button"
            onClick={() => setSortBy('OLDEST')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              sortBy === 'OLDEST'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="أولوية الطلبات الأقدم للمطبخ (FIFO)"
          >
            الأقدم أولاً (FIFO)
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {sortedOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100 shadow-sm">
          <ShoppingBag className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <h4 className="text-lg font-bold text-slate-600">لا توجد طلبات في هذا القسم حالياً</h4>
          <p className="text-sm">ستظهر الطلبات الجديدة هنا فور قيام الطلاب بطلبها</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedOrders.map(order => {
            const isPending = order.status === 'PENDING';
            const isPreparing = order.status === 'PREPARING' || order.status === 'ACCEPTED';
            const isReady = order.status === 'READY';
            const isCompleted = order.status === 'COMPLETED';
            const isRejected = order.status === 'REJECTED';

            // حسابات أوقات المراحل
            const createdAt = order.createdAt;
            const acceptedAt = order.acceptedAt;
            const preparingAt = order.preparingAt || (order.status !== 'PENDING' ? order.acceptedAt : null);
            const readyAt = order.readyAt;
            const completedAt = order.completedAt;

            // 1. وقت مرحلة القبول
            const waitMins = getDiffMins(createdAt, acceptedAt || (isPending ? new Date(currentTime).toISOString() : null));

            // 2. وقت مرحلة التحضير
            const prepMins = getDiffMins(
              preparingAt,
              readyAt || (isPreparing ? new Date(currentTime).toISOString() : null)
            );

            // هل يوجد تأخير في التحضير عن الوقت المقدر؟
            const isOverdue = isPreparing && Boolean(order.estimatedMinutes) && prepMins !== null && prepMins > (order.estimatedMinutes || 15);
            const overdueMins = isOverdue ? Math.round(prepMins - order.estimatedMinutes) : 0;

            // 3. وقت مرحلة التسليم / التوصيل
            const deliveryMins = getDiffMins(
              readyAt,
              completedAt || (isReady ? new Date(currentTime).toISOString() : null)
            );

            // 4. إجمالي وقت دورة الطلب
            const totalMins = isCompleted
              ? getDiffMins(createdAt, completedAt)
              : getDiffMins(createdAt, new Date(currentTime).toISOString());

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition-all shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isPending
                    ? 'border-amber-400 ring-2 ring-amber-200'
                    : isPreparing
                    ? isOverdue ? 'border-rose-300 ring-2 ring-rose-200' : 'border-blue-200'
                    : isReady
                    ? 'border-purple-200'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Order Card Header */}
                <div className={`p-4 border-b flex items-center justify-between ${
                  isPending ? 'bg-amber-50' : isPreparing ? (isOverdue ? 'bg-rose-50' : 'bg-blue-50') : isReady ? 'bg-purple-50' : 'bg-slate-50'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-slate-800">#{order.orderNumber}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        order.orderType === 'DELIVERY'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {order.orderType === 'DELIVERY' ? 'توصيل' : 'استلام من الفرع'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white animate-pulse">
                        جديد بانتظار الرد
                      </span>
                    )}
                    {isPreparing && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                        isOverdue ? 'bg-rose-600 animate-pulse' : 'bg-blue-600'
                      }`}>
                        {isOverdue ? 'متأخر في التحضير' : 'جاري التحضير'}
                      </span>
                    )}
                    {isReady && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white">
                        جاهز للتسليم
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                        مكتمل
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white">
                        ملغي / مرفوض
                      </span>
                    )}
                  </div>
                </div>

                {/* Scheduled Order Banner */}
                {order.isScheduled && (
                  <div className="bg-indigo-600 text-white px-3 py-1.5 text-xs font-black flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>حجز مسبق لموعد: {order.scheduledFor ? new Date(order.scheduledFor).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'محدد مسبقاً'}</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">بريك المحاضرة</span>
                  </div>
                )}

                {/* Overdue Alert Banner if kitchen exceeded SLA */}
                {isOverdue && (
                  <div className="bg-rose-600 text-white px-3 py-2 text-xs font-black flex items-center justify-between shadow-inner animate-pulse">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>⚠️ تنبيه تأخير: تجاوز الوقت المحدد بـ {overdueMins} دقيقة (المحدد: {order.estimatedMinutes} د)</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">عاجل</span>
                  </div>
                )}

                {/* Live Stopwatch & Stage Elapsed Bar */}
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                  {isPending && (
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold animate-pulse">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>بانتظار الموافقة منذ: {formatDuration(waitMins)}</span>
                    </div>
                  )}
                  {isPreparing && (
                    <div className={`flex items-center gap-1.5 font-bold ${isOverdue ? 'text-rose-700' : 'text-blue-700'}`}>
                      <ChefHat className="w-4 h-4" />
                      <span>قيد التحضير منذ: {formatDuration(prepMins)}</span>
                    </div>
                  )}
                  {isReady && (
                    <div className="flex items-center gap-1.5 text-purple-700 font-bold">
                      <Truck className="w-4 h-4" />
                      <span>في انتظار التسليم منذ: {formatDuration(deliveryMins)}</span>
                    </div>
                  )}
                  {isCompleted && (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <CheckCircle className="w-4 h-4" />
                      <span>استغرق إجمالاً: {formatDuration(totalMins)}</span>
                    </div>
                  )}
                  {isRejected && (
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>طلب ملغي</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedTimingId(expandedTimingId === order.id ? null : order.id)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white hover:bg-indigo-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{expandedTimingId === order.id ? 'إخفاء الأوقات' : 'سجل الأوقات'}</span>
                  </button>
                </div>

                {/* Detailed Stage Timings Breakdown Card (Always toggleable or auto-expanded) */}
                {expandedTimingId === order.id && (
                  <div className="p-3 mx-4 mt-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-indigo-950 flex items-center gap-1 text-[11px]">
                        <Timer className="w-3.5 h-3.5 text-indigo-600" />
                        <span>تفاصيل مراحل ووقت الطلب:</span>
                      </span>
                      {totalMins !== null && (
                        <span className="text-[10px] font-black font-mono text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                          الإجمالي: {formatDuration(totalMins)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      {/* مرحلة الاستلام */}
                      <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-0.5">
                        <div className="text-slate-400 font-bold">1. الطلب والقبول</div>
                        <div className="font-mono text-slate-700 font-bold">{formatTimeOnly(createdAt)}</div>
                        <div className="text-amber-700 font-bold">
                          {acceptedAt ? `استغرق ${formatDuration(waitMins)}` : `بانتظار الرد (${formatDuration(waitMins)})`}
                        </div>
                      </div>

                      {/* مرحلة التحضير */}
                      <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-0.5">
                        <div className="text-slate-400 font-bold">2. التحضير والطهي</div>
                        <div className="font-mono text-slate-700 font-bold">
                          {preparingAt ? formatTimeOnly(preparingAt) : 'لم يبدأ'}
                        </div>
                        <div className={`${isOverdue ? 'text-rose-600 font-black' : 'text-blue-700 font-bold'}`}>
                          {readyAt ? `استغرق ${formatDuration(prepMins)}` : preparingAt ? `قيد الطهي (${formatDuration(prepMins)})` : '-'}
                        </div>
                      </div>

                      {/* مرحلة التسليم والتوصيل */}
                      <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-0.5">
                        <div className="text-slate-400 font-bold">3. التسليم للعميل</div>
                        <div className="font-mono text-slate-700 font-bold">
                          {readyAt ? formatTimeOnly(readyAt) : 'لم يجهز بعد'}
                        </div>
                        <div className="text-emerald-700 font-bold">
                          {completedAt ? `استغرق ${formatDuration(deliveryMins)}` : readyAt ? `في الطريق (${formatDuration(deliveryMins)})` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer and Location Info */}
                <div className="p-4 space-y-2 text-xs border-b border-slate-100 bg-slate-50/50">
                  {(() => {
                    const branchOrderCount = orders.filter(
                      o =>
                        (order.userId && o.userId === order.userId) ||
                        (order.customerPhone && o.customerPhone === order.customerPhone)
                    ).length;
                    const customerOrderCount = Math.max(branchOrderCount, order.user?._count?.orders || 1);
                    const isFirstTimeCustomer = customerOrderCount <= 1;

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 flex-wrap">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{order.customerName}</span>
                            {isFirstTimeCustomer ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                                🌟 أول مرة يطلب!
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                🔄 طلب {customerOrderCount} مرات
                              </span>
                            )}
                            {order.user?.isBlocked && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                🚫 حساب موقوف
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="flex items-center gap-1 font-mono text-indigo-600 hover:underline font-bold"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{order.customerPhone}</span>
                            </a>
                            {(order.userId || order.user?.id) && (
                              <button
                                type="button"
                                onClick={() => handleOpenCustomerCRM(order, customerOrderCount)}
                                className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-[10px] font-black transition-colors shadow-2xs"
                                title="إضافة ملاحظة للعميل أو إيقاف حسابه"
                              >
                                📝 ملاحظة / حظر
                              </button>
                            )}
                          </div>
                        </div>

                        {order.user?.restaurantNotes && (
                          <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 flex items-start justify-between gap-2">
                            <div className="text-[11px]">
                              <span className="font-black text-purple-800">📌 ملاحظة مسجلة على العميل: </span>
                              <span className="font-bold">{order.user.restaurantNotes}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenCustomerCRM(order, customerOrderCount)}
                              className="text-[10px] text-purple-700 underline font-bold shrink-0"
                            >
                              تعديل
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {order.orderType === 'DELIVERY' && (
                    <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200">
                      {order.deliveryZoneName && (
                        <div className="flex items-center gap-1.5 text-indigo-700 font-bold mb-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          <span>منطقة التوصيل: {order.deliveryZoneName}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800">العنوان الجامعي: </span>
                          <span>{order.addressText}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {order.notes && (
                    <div className="text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                      <span className="font-bold">ملاحظات الطالب: </span>
                      <span>{order.notes}</span>
                    </div>
                  )}

                  {/* Payment Details & Proof Badge */}
                  <div className="flex flex-col gap-1.5 pt-1 text-[11px] border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">طريقة الدفع:</span>
                      <span className="font-bold text-slate-800">
                        {order.paymentMethod === 'CASH' && '💵 كاش عند الاستلام'}
                        {order.paymentMethod === 'VODAFONE_CASH' && '📱 محفظة كاش'}
                        {order.paymentMethod === 'INSTAPAY' && '⚡ إنستاباي (InstaPay)'}
                        {order.paymentMethod === 'CARD' && '💳 فيزا / كارت'}
                      </span>
                    </div>

                    {order.paymentSenderPhone && (
                      <div className="flex items-center justify-between text-indigo-700 font-bold bg-indigo-50/80 px-2 py-1 rounded-lg">
                        <span>رقم المحول منه:</span>
                        <span className="font-mono">{order.paymentSenderPhone}</span>
                      </div>
                    )}

                    {order.paymentProofUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingProofUrl(order.paymentProofUrl)}
                        className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold border border-rose-200 transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>معاينة إيصال تحويل فودافون كاش / إنستاباي</span>
                      </button>
                    )}
                  </div>

                  {/* Estimated Delivery / Prep Time Indicator */}
                  {order.estimatedMinutes && (
                    <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50/70 px-2 py-1 rounded-lg font-bold text-[11px]">
                      <Timer className="w-3.5 h-3.5" />
                      <span>وقت التجهيز والتوصيل المحدد: {order.estimatedMinutes} دقيقة</span>
                    </div>
                  )}

                  {/* Delivery Driver Assignment Section */}
                  {order.orderType === 'DELIVERY' && (() => {
                    const assignedDriver = order.driver || drivers.find((d: any) => d.id === order.driverId);
                    return (
                      <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{order.status === 'COMPLETED' ? 'الطيار المسلم:' : 'كابتن التوصيل:'}</span>
                          </span>
                          {assignedDriver ? (
                            <span className="font-black text-indigo-800 bg-white px-2 py-0.5 rounded-lg border border-indigo-200">
                              {order.status === 'COMPLETED' ? '✅ ' : ''}{assignedDriver.name} ({assignedDriver.phone})
                            </span>
                          ) : order.status === 'COMPLETED' ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                              تم التسليم عبر الفرع
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
                              بانتظار إسناد طيار
                            </span>
                          )}
                        </div>

                        {order.status !== 'COMPLETED' && order.status !== 'REJECTED' && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <select
                              value={selectedDriverMap[order.id] !== undefined ? selectedDriverMap[order.id] : (order.driverId || '')}
                              onChange={(e) => setSelectedDriverMap({ ...selectedDriverMap, [order.id]: e.target.value })}
                              className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] font-bold text-slate-700"
                            >
                              <option value="">-- اختر طيار لتوصيل الطلب --</option>
                              {drivers.map((d: any) => (
                                <option key={d.id} value={d.id} disabled={!d.isActive}>
                                  {d.name} {d.isActive ? '' : '(غير متاح)'}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={assigningDriverOrderId === order.id}
                              onClick={() => handleAssignDriver(order.id, selectedDriverMap[order.id] ?? order.driverId ?? '')}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shrink-0"
                            >
                              {assigningDriverOrderId === order.id ? '...' : 'إسناد'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Group Cart Bags Partition (سلة الشلة) */}
                {order.groupCartDetails && (() => {
                  try {
                    const details = typeof order.groupCartDetails === 'string' ? JSON.parse(order.groupCartDetails) : order.groupCartDetails;
                    if (Array.isArray(details) && details.length > 0) {
                      return (
                        <div className="p-3 mx-4 my-2 rounded-2xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 font-black text-purple-900">
                            <Users className="w-4 h-4 text-purple-700" />
                            <span>تقسيم أكياس وحقائب سلة الشلة ({details.length} طلاب):</span>
                          </div>
                          <div className="space-y-1.5">
                            {details.map((group: any, gIdx: number) => (
                              <div key={gIdx} className="bg-white p-2 rounded-xl border border-purple-100 text-[11px]">
                                <div className="flex items-center justify-between font-black text-purple-800 border-b border-purple-50 pb-1 mb-1">
                                  <span>🛍️ كيس: {group.studentName}</span>
                                  {group.subtotal !== undefined && <span>{group.subtotal} ج.م</span>}
                                </div>
                                <div className="space-y-0.5 text-slate-600">
                                  {(group.items || []).map((gi: any, giIdx: number) => (
                                    <div key={giIdx} className="flex justify-between">
                                      <span>{gi.quantity} × {gi.itemName} {gi.sizeName ? `(${gi.sizeName})` : ''}</span>
                                      <span>{gi.totalPrice} ج.م</span>
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

                {/* Items List */}
                <div className="p-4 space-y-2 flex-1">
                  <div className="font-bold text-xs text-slate-400 mb-2">الأصناف المطلوبة ({order.items?.length})</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {order.items?.map((item: any, idx: number) => {
                      let modifiers: any[] = [];
                      if (item.selectedModifiers) {
                        try {
                          modifiers = typeof item.selectedModifiers === 'string' 
                            ? JSON.parse(item.selectedModifiers) 
                            : item.selectedModifiers;
                        } catch (e) {}
                      }

                      return (
                        <div key={idx} className="bg-slate-50 p-2 rounded-xl text-xs">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{item.quantity} × {item.itemName}</span>
                            <span>{item.totalPrice} ج.م</span>
                          </div>
                          {item.sizeName && (
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                              الحجم: {item.sizeName}
                            </span>
                          )}
                          {modifiers.length > 0 && (
                            <div className="text-[10px] text-slate-500 mt-1 space-x-1 space-x-reverse">
                              {modifiers.map((m: any, mIdx: number) => (
                                <span key={mIdx} className="bg-white border px-1.5 py-0.5 rounded inline-block mt-0.5">
                                  + {m.optionName} ({m.price} ج.م)
                                </span>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-1.5 text-[11px] text-amber-900 bg-amber-100/70 border border-amber-300/80 px-2 py-0.5 rounded-lg flex items-start gap-1 font-bold">
                              <span>📝 ملاحظة الصنف:</span>
                              <span>{item.notes}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total and Actions Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs text-slate-500 block">إجمالي الطلب:</span>
                      {order.discount && order.discount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600">
                          خصم {order.discount} ج.م (كوبون: {order.promoCode})
                        </span>
                      )}
                    </div>
                    <span className="text-base font-black text-slate-900">{order.total} ج.م</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPrintingOrder(order)}
                      className="col-span-2 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة بون المطبخ</span>
                    </button>

                    {isPending && (
                      <>
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => {
                            setAcceptingOrder(order);
                            setPrepMinutes(15);
                          }}
                          className="col-span-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
                        >
                          قبول وبدء التجهيز
                        </button>
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => handleUpdateStatus(order.id, 'REJECTED')}
                          className="col-span-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all"
                        >
                          رفض الطلب
                        </button>
                      </>
                    )}

                    {isPreparing && (
                      <button
                        disabled={updatingId === order.id}
                        onClick={() => handleUpdateStatus(order.id, 'READY')}
                        className="col-span-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>جاهز للاستلام / خرج للتوصيل</span>
                      </button>
                    )}

                    {isReady && (
                      <button
                        disabled={updatingId === order.id}
                        onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                        className="col-span-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>تأكيد استلام الطالب (اكتمل)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Acceptance Modal: Estimated Time Chips */}
      {acceptingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-indigo-600" />
                <h4 className="font-black text-slate-800 text-sm">تحديد وقت التجهيز والتوصيل</h4>
              </div>
              <button onClick={() => setAcceptingOrder(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              اختر الوقت المتوقع لإعداد وجبة الطالب #{acceptingOrder.orderNumber} ليظهر له عد تنازلي حي في شاشته:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20, 25, 30, 45].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setPrepMinutes(mins)}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                    prepMinutes === mins
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {mins} دقيقة
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">أو حدد بالدقائق يدوياً:</label>
              <input
                type="number"
                min="5"
                max="120"
                value={prepMinutes}
                onChange={e => setPrepMinutes(parseInt(e.target.value) || 15)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleConfirmAccept}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                تأكيد القبول ({prepMinutes} دقيقة)
              </button>
              <button
                type="button"
                onClick={() => setAcceptingOrder(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إلغاء
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
