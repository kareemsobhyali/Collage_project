import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  X, 
  CheckCircle, 
  Clock, 
  ChefHat, 
  Truck, 
  ShoppingBag, 
  Phone, 
  MapPin, 
  XCircle,
  AlertCircle,
  Timer,
  Star,
  Send,
  RotateCw,
  ShieldCheck,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { notifyOrderStatusPush, sendWebNotification } from '../services/notifications';
import { LiveOrderMap } from './LiveOrderMap';
import { extractCoordinatesFromAddress, cleanAddressText, getDisplayAddress, DEFAULT_CAMPUS_RESTAURANT_COORDS, getStoredRestaurantCoords, setStoredRestaurantCoords } from '../services/campusLocations';

interface OrderTrackingModalProps {
  order: any;
  onClose: () => void;
  onOrderUpdated?: (updatedOrder: any) => void;
}

const cleanDriverDisplayName = (name?: string | null): string => {
  if (!name) return 'كابتن التوصيل';
  return name.replace(/\s*\(طيار عام\)\s*/g, '').trim() || name;
};

// دالات مساعدة لحساب الفترات الزمنية
const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '-';
  if (minutes < 1) return 'أقل من دقيقة';
  if (minutes < 60) return `${Math.round(minutes)} دقيقة`;
  const hrs = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return `${hrs} س ${rem > 0 ? `و ${rem} د` : ''}`;
};

const formatTimeOnly = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

const getDiffMins = (start?: string | null, end?: string | null): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return Math.max(0, Math.round(((e - s) / 60000) * 10) / 10);
};

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({ 
  order: initialOrder, 
  onClose,
  onOrderUpdated 
}) => {
  const [order, setOrder] = useState<any>(initialOrder);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [refreshingOrder, setRefreshingOrder] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  // مزامنة حالة الطلب فوراً عند تغير الـ prop من الشاشة الأب (App.tsx)
  useEffect(() => {
    if (initialOrder) {
      setOrder((prev: any) => ({
        ...prev,
        ...initialOrder,
        branch: initialOrder.branch || prev?.branch,
        items: initialOrder.items || prev?.items,
      }));
    }
  }, [initialOrder]);

  // تحديث التوقيت الحي كل 10 ثوانٍ
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Rating State
  const [rating, setRating] = useState<number>(order.rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState<string>(order.review || '');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(Boolean(order.rating));

  // Countdown timer for estimated preparation / delivery
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!order.estimatedMinutes) return 0;
    const startTime = new Date(order.acceptedAt || order.createdAt).getTime();
    const targetTime = startTime + order.estimatedMinutes * 60 * 1000;
    return Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!order.estimatedMinutes || order.status === 'COMPLETED' || order.status === 'REJECTED') {
      setRemainingSeconds(0);
      return;
    }

    const calc = () => {
      const startTime = new Date(order.acceptedAt || order.createdAt).getTime();
      const targetTime = startTime + order.estimatedMinutes * 60 * 1000;
      return Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    };

    setRemainingSeconds(calc());
    const timer = setInterval(() => {
      setRemainingSeconds(calc());
    }, 1000);

    return () => clearInterval(timer);
  }, [order.estimatedMinutes, order.acceptedAt, order.status]);

  const [liveDriverCoords, setLiveDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  // رسائل سريعة لحظية بين الطالب والطيار داخل التطبيق
  const [quickMessages, setQuickMessages] = useState<any[]>([]);
  const [customQuickText, setCustomQuickText] = useState<string>('');
  const [sendingQuickMsg, setSendingQuickMsg] = useState<boolean>(false);

  const playQuickMsgChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (_e) {}
  };

  const handleSendStudentQuickMessage = (text: string) => {
    const clean = text.trim();
    if (!clean || !socketRef.current || !order?.id) return;
    setSendingQuickMsg(true);
    socketRef.current.emit(
      'send_order_quick_message',
      {
        orderId: order.id,
        text: clean,
        senderRole: 'CUSTOMER',
        senderName: order.customerName || 'الطالب',
      },
      (res: any) => {
        setSendingQuickMsg(false);
        if (res?.success && res?.message) {
          setQuickMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
          setCustomQuickText('');
        }
      }
    );
    setTimeout(() => setSendingQuickMsg(false), 1200);
  };

  // موقع المطعم الفعلي (من إعدادات المنظومة أو عنوان الفرع أو المخزن محلياً)
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number }>(() => {
    if (order.branch?.address) {
      const branchCoords = extractCoordinatesFromAddress(order.branch.address);
      if (branchCoords) return branchCoords;
    }
    return getStoredRestaurantCoords();
  });

  // موقع الطالب الفعلي (من إحداثيات الطلب أو قراءة GPS الجهاز اللحظي في حال عدم وجود إحداثيات سابقة)
  const [studentCoords, setStudentCoords] = useState<{ lat: number; lng: number }>(() => {
    const extracted = extractCoordinatesFromAddress(order.addressText);
    if (extracted) return extracted;
    return { lat: 30.0275, lng: 31.2110 };
  });

  // جلب موقع المطعم الفعلي المسجل من لوحة الإدارة
  useEffect(() => {
    api.getPublicRestaurantLocation()
      .then(res => {
        if (res && typeof res.lat === 'number' && typeof res.lng === 'number') {
          setRestaurantCoords({ lat: res.lat, lng: res.lng });
          setStoredRestaurantCoords({ lat: res.lat, lng: res.lng });
        }
      })
      .catch(() => {});
  }, []);

  // في حال كان الطلب قديماً أو مسجلاً بدون إحداثيات GPS، نقرأ موقع جهاز الطالب الفعلي لوضعه على الخريطة
  useEffect(() => {
    const hasExistingCoords = extractCoordinatesFromAddress(order.addressText);
    if (!hasExistingCoords && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStudentCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [order.addressText]);

  // دالة جلب أحدث حالة للطلب من السيرفر (تستخدم للتحديث الفوري والتحديث الدوري الاحتياطي)
  const fetchLatestOrderState = async (showSpinner = false) => {
    if (!order?.id) return;
    try {
      if (showSpinner) setRefreshingOrder(true);
      const fresh = await api.getOrder(order.id);
      if (fresh && fresh.id === order.id) {
        setOrder((prev: any) => {
          const hasChanged =
            prev?.status !== fresh.status ||
            prev?.driverId !== fresh.driverId ||
            prev?.driver?.id !== fresh.driver?.id ||
            prev?.driverPickedUpAt !== fresh.driverPickedUpAt ||
            prev?.isDriverAccepted !== fresh.isDriverAccepted ||
            prev?.estimatedMinutes !== fresh.estimatedMinutes ||
            prev?.acceptedAt !== fresh.acceptedAt ||
            prev?.readyAt !== fresh.readyAt ||
            prev?.completedAt !== fresh.completedAt;

          const merged = {
            ...prev,
            ...fresh,
            branch: fresh.branch || prev?.branch,
            items: fresh.items || prev?.items,
          };

          if (hasChanged) {
            if (prev?.status && prev.status !== fresh.status) {
              notifyOrderStatusPush(merged);
            }
            if (onOrderUpdated) onOrderUpdated(merged);
          }
          return merged;
        });
      }
    } catch (_e) {
      // Ignore transient network errors during background poll
    } finally {
      if (showSpinner) setRefreshingOrder(false);
    }
  };

  // تحديث دوري تلقائي كل 3.5 ثانية طالما شاشة التتبع مفتوحة والطلب نشط
  useEffect(() => {
    if (!order?.id || order?.status === 'COMPLETED' || order?.status === 'REJECTED') return;
    fetchLatestOrderState(false);
    const pollTimer = setInterval(() => {
      fetchLatestOrderState(false);
    }, 3500);
    return () => clearInterval(pollTimer);
  }, [order?.id, order?.status]);

  // الاتصال بـ Socket.io لمتابعة التحديثات الحية لحالة الطلب والموقع الجغرافي للطيار والمطعم
  useEffect(() => {
    if (!order?.id) return;

    const socketHost = API_BASE_URL.replace('/api', '');
    const customerToken = localStorage.getItem('customer_token') || '';
    const socket: Socket = io(socketHost, {
      auth: customerToken ? { token: customerToken } : undefined,
    });
    socketRef.current = socket;

    const joinRooms = () => {
      socket.emit('join_order', order.id);
      if (order.userId) {
        socket.emit('join_user', order.userId);
      }
      socket.emit('get_order_quick_messages', order.id, (msgs: any[]) => {
        if (Array.isArray(msgs)) {
          setQuickMessages(msgs);
        }
      });
      const currentDriverId = order.driverId || order.driver?.id;
      if (currentDriverId) {
        socket.emit('get_driver_location', currentDriverId, (loc: any) => {
          if (loc && loc.lat && loc.lng) {
            setLiveDriverCoords({ lat: loc.lat, lng: loc.lng });
          }
        });
      }
    };

    joinRooms();
    socket.on('connect', joinRooms);

    socket.on('order_quick_messages_history', (payload: { orderId: string; messages: any[] }) => {
      if (payload && payload.orderId === order.id && Array.isArray(payload.messages)) {
        setQuickMessages(payload.messages);
      }
    });

    socket.on('order_quick_message', (msg: any) => {
      if (msg && msg.orderId === order.id) {
        setQuickMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.senderRole === 'DRIVER') {
          playQuickMsgChime();
          sendWebNotification(
            `💬 رسالة سريعة من الكابتن ${msg.senderName || ''}`,
            msg.text,
            '/',
            `chat_${order.orderNumber || order.id}`
          );
        }
      }
    });

    socket.on('order_status_updated', (updatedOrder: any) => {
      if (updatedOrder && updatedOrder.id === order.id) {
        setOrder((prev: any) => {
          const merged = {
            ...prev,
            ...updatedOrder,
            branch: updatedOrder.branch || prev?.branch,
            items: updatedOrder.items || prev?.items,
          };
          if (onOrderUpdated) onOrderUpdated(merged);
          return merged;
        });
        notifyOrderStatusPush(updatedOrder);
      }
    });

    // استقبال تحديث موقع الطيار الحي على الخريطة
    socket.on('driver_location_updated', (locData: any) => {
      if (locData && typeof locData.lat === 'number' && typeof locData.lng === 'number') {
        setOrder((currOrder: any) => {
          const activeDriverId = currOrder?.driverId || currOrder?.driver?.id;
          if (locData.orderId === currOrder?.id || (activeDriverId && locData.driverId === activeDriverId)) {
            setLiveDriverCoords({ lat: locData.lat, lng: locData.lng });
          }
          return currOrder;
        });
      }
    });

    // استقبال تحديث موقع المطعم في حال قام الآدمن بتعديله
    socket.on('restaurant_location_updated', (locData: any) => {
      if (locData && typeof locData.lat === 'number' && typeof locData.lng === 'number') {
        setRestaurantCoords({ lat: locData.lat, lng: locData.lng });
      }
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [order?.id]);

  // عند تعيين طيار جديد للطلب أثناء فتح الشاشة، نطلب موقعه الحالي دون قطع اتصال السوكيت
  useEffect(() => {
    const activeDriverId = order?.driverId || order?.driver?.id;
    if (activeDriverId && socketRef.current) {
      socketRef.current.emit('get_driver_location', activeDriverId, (loc: any) => {
        if (loc && loc.lat && loc.lng) {
          setLiveDriverCoords({ lat: loc.lat, lng: loc.lng });
        }
      });
    }
  }, [order?.driverId, order?.driver?.id]);

  const handleCancelOrder = async () => {
    setShowCancelConfirmModal(false);
    try {
      setCancelling(true);
      const res = await api.cancelOrder(order.id);
      if (res.user) {
        localStorage.setItem('customer_user', JSON.stringify(res.user));
      }
      if (res.order) {
        setOrder(res.order);
        if (onOrderUpdated) onOrderUpdated(res.order);
      }
    } catch (err: any) {
      alert(err.message || 'فشل إلغاء الطلب');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingRating(true);
      const res = await api.rateOrder(order.id, rating, reviewText.trim() || undefined);
      if (res.order) {
        setOrder(res.order);
        setRatingSubmitted(true);
        if (onOrderUpdated) onOrderUpdated(res.order);
      }
    } catch (err: any) {
      alert(err.message || 'فشل إرسال التقييم');
    } finally {
      setSubmittingRating(false);
    }
  };

  const status = order.status; // PENDING, ACCEPTED, PREPARING, READY, COMPLETED, REJECTED

  // حساب أوقات المراحل والمدد المنقضية
  const createdAt = order.createdAt;
  const acceptedAt = order.acceptedAt;
  const preparingAt = order.preparingAt || (order.status !== 'PENDING' ? order.acceptedAt : null);
  const readyAt = order.readyAt;
  const completedAt = order.completedAt;

  const waitMins = getDiffMins(createdAt, acceptedAt || (status === 'PENDING' ? new Date(currentTime).toISOString() : null));
  const prepMins = getDiffMins(
    preparingAt,
    readyAt || (status === 'PREPARING' || status === 'ACCEPTED' ? new Date(currentTime).toISOString() : null)
  );
  const deliveryMins = getDiffMins(
    readyAt,
    completedAt || (status === 'READY' ? new Date(currentTime).toISOString() : null)
  );
  const totalMins = completedAt
    ? getDiffMins(createdAt, completedAt)
    : getDiffMins(createdAt, new Date(currentTime).toISOString());

  const assignedDriverCleanName = order.driver ? cleanDriverDisplayName(order.driver.name) : null;

  const steps = [
    {
      key: 'PENDING',
      title: 'تم إرسال الطلب',
      subtitle: status === 'PENDING'
        ? `بانتظار موافقة المطعم (منذ ${formatDuration(waitMins)})`
        : acceptedAt
        ? `تم قبول الطلب وبدء التنفيذ (استغرق ${formatDuration(waitMins)})`
        : 'تم تأكيد استلام الطلب من المطعم',
      timeText: formatTimeOnly(createdAt),
      icon: Clock,
      isActive: status === 'PENDING',
      isDone: status !== 'PENDING' && status !== 'REJECTED',
    },
    {
      key: 'PREPARING',
      title: 'جاري التحضير والطهي',
      subtitle: (status === 'PREPARING' || status === 'ACCEPTED')
        ? `المطعم يجهز وجبتك الآن (منذ ${formatDuration(prepMins)})${assignedDriverCleanName ? ` • تم تعيين ${assignedDriverCleanName} للتوصيل 🛵` : ''}`
        : readyAt
        ? `تم الانتهاء من التجهيز بالمطبخ (استغرق ${formatDuration(prepMins)})`
        : 'المطعم يقوم بتجهيز وجبتك',
      timeText: formatTimeOnly(preparingAt),
      icon: ChefHat,
      isActive: status === 'PREPARING' || status === 'ACCEPTED',
      isDone: status === 'READY' || status === 'COMPLETED',
    },
    {
      key: 'READY',
      title: order.orderType === 'DELIVERY' ? 'في الطريق للتوصيل' : 'جاهز للاستلام من الفرع',
      subtitle: status === 'READY'
        ? (order.orderType === 'DELIVERY'
            ? `طلبك خرج للتوصيل${assignedDriverCleanName ? ` مع ${assignedDriverCleanName}` : ''} (منذ ${formatDuration(deliveryMins)})`
            : `الوجبة جاهزة للاستلام بالفرع (منذ ${formatDuration(deliveryMins)})`)
        : completedAt
        ? `تم التسليم للعميل (استغرق ${formatDuration(deliveryMins)})`
        : (order.orderType === 'DELIVERY' ? 'طلبك في الطريق لمبنى كليتك' : 'يمكنك التوجه للفرع واستلام طلبك'),
      timeText: formatTimeOnly(readyAt),
      icon: order.orderType === 'DELIVERY' ? Truck : ShoppingBag,
      isActive: status === 'READY',
      isDone: status === 'COMPLETED',
    },
    {
      key: 'COMPLETED',
      title: 'تم التسليم بنجاح',
      subtitle: status === 'COMPLETED'
        ? `بالهناء والشفاء! استغرق طلبك إجمالاً ${formatDuration(totalMins)}`
        : 'استلام وجبتك اللذيذة',
      timeText: formatTimeOnly(completedAt),
      icon: CheckCircle,
      isActive: status === 'COMPLETED',
      isDone: status === 'COMPLETED',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0 z-20" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-800">تتبع الطلب #{order.orderNumber}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                {order.orderType === 'DELIVERY' ? 'توصيل' : 'استلام من الفرع'}
              </span>
              {status !== 'COMPLETED' && status !== 'REJECTED' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>مباشر</span>
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {order.branch?.name || 'مطعم الجامعة'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {status !== 'COMPLETED' && status !== 'REJECTED' && (
              <button
                type="button"
                onClick={() => fetchLatestOrderState(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="تحديث حالة الطلب الآن"
              >
                <RotateCw className={`w-4 h-4 ${refreshingOrder ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto modal-scroll flex-1 space-y-5">
          {/* Total Fulfillment Celebration Banner if Completed */}
          {status === 'COMPLETED' && totalMins !== null && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
                  ⚡
                </div>
                <div>
                  <span className="text-xs font-black block text-emerald-100">إجمالي وقت إنجاز الطلب:</span>
                  <span className="text-sm font-black text-white font-mono">
                    {formatDuration(totalMins)} (من الطلب حتى الاستلام)
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold">
                تم بنجاح ✓
              </span>
            </div>
          )}

          {/* Estimated Delivery Countdown Timer */}
          {remainingSeconds > 0 && status !== 'COMPLETED' && status !== 'REJECTED' && (
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white shadow-md flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                <Timer className="w-6 h-6 animate-pulse text-indigo-200" />
                <div>
                  <span className="text-xs font-bold text-indigo-100 block">الوقت المتبقي حتى وصول الوجبة:</span>
                  <span className="text-lg font-black font-mono">
                    {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')} دقيقة
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold">
                تجهيز سريع ⚡
              </span>
            </div>
          )}

          {/* Scheduled Order Banner */}
          {order.isScheduled && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-center gap-2 text-xs text-purple-900 font-bold animate-fadeIn">
              <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                طلب محجوز مسبقاً لموعد البريك: {order.scheduledFor ? new Date(order.scheduledFor).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'محدد مسبقاً'}
              </span>
            </div>
          )}

          {/* Pickup Security PIN Badge */}
          {order.pickupPin && status !== 'COMPLETED' && status !== 'REJECTED' && (
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl shadow-lg shadow-emerald-600/20 space-y-2 text-center animate-fadeIn">
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-100 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>رمز أمان استلام الطلب من الكابتن (PIN):</span>
              </div>
              <div className="text-3xl font-black font-mono tracking-widest bg-white/20 py-2 px-6 rounded-2xl inline-block border border-white/30 backdrop-blur-xs">
                {order.pickupPin}
              </div>
              <p className="text-[11px] text-emerald-100">
                أعطِ هذا الرمز لكابتن الدليفري عند استلامك الأوردر لتأكيد التسليم.
              </p>
            </div>
          )}

          {/* Assigned Driver Status Card + Live GPS Campus Tracking Map */}
          {order.driver && (
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs animate-fadeIn">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm text-lg">
                  🛵
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-indigo-600 font-black">كابتن التوصيل:</span>
                    <span className="font-black text-indigo-950 text-sm truncate">{assignedDriverCleanName}</span>
                  </div>
                  <span className={`text-[11px] font-bold mt-0.5 block ${
                    order.driverPickedUpAt || status === 'READY'
                      ? 'text-emerald-700'
                      : order.isDriverAccepted
                      ? 'text-indigo-700'
                      : 'text-amber-700'
                  }`}>
                    {order.driverPickedUpAt || status === 'READY'
                      ? '🚀 استلم الطلب من المطعم وفي الطريق إليك الآن'
                      : order.isDriverAccepted
                      ? '✅ قبل الكابتن الطلب وفي طريقه للمطعم للاستلام'
                      : '⏳ تم تعيين الكابتن من المطعم وبانتظار استلامه للوجبة'}
                  </span>
                </div>
              </div>
              {order.driver.phone && (
                <a
                  href={`tel:${order.driver.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black font-mono shadow-xs transition-all active:scale-95 shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>اتصال</span>
                </a>
              )}
            </div>
          )}

          {/* Quick In-App Status Messages between Student & Driver */}
          {order.driver && status !== 'COMPLETED' && status !== 'REJECTED' && (
            <div className="p-3.5 bg-white border border-indigo-200 rounded-2xl shadow-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">💬</span>
                  <span className="text-xs font-black text-slate-900">رسائل سريعة لحظية مع الكابتن</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  بدون رصيد أو خروج من التطبيق ⚡
                </span>
              </div>

              {/* Message Thread */}
              {quickMessages.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {quickMessages.map((msg) => {
                    const isMe = msg.senderRole === 'STUDENT';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${
                          isMe
                            ? 'mr-auto bg-indigo-600 text-white rounded-tl-xs'
                            : 'ml-auto bg-emerald-100 text-emerald-950 border border-emerald-200 rounded-tr-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[9px] opacity-80 font-bold mb-0.5">
                          <span>{isMe ? 'أنت (الطالب)' : `🛵 كابتن ${msg.senderName}`}</span>
                          <span className="font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="font-bold leading-snug">{msg.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 1-Tap Quick Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  '👋 أنا واقف عند البوابة الآن',
                  '⏱️ نازل حالا في الطريق ليك',
                  '📍 أنا موجود عند نقطة التسليم المحددة',
                  '🤫 من فضلك رن عليا لما توصل عشان في المحاضرة',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={sendingQuickMsg}
                    onClick={() => handleSendStudentQuickMessage(preset)}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Custom Short Message Input */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  value={customQuickText}
                  onChange={(e) => setCustomQuickText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customQuickText.trim()) {
                      e.preventDefault();
                      handleSendStudentQuickMessage(customQuickText);
                    }
                  }}
                  maxLength={140}
                  placeholder="اكتب رسالة سريعة للكابتن (مثال: أنا لابس جاكيت أسود)..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={!customQuickText.trim() || sendingQuickMsg}
                  onClick={() => handleSendStudentQuickMessage(customQuickText)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black flex items-center gap-1 transition-all shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال</span>
                </button>
              </div>
            </div>
          )}

          {order.orderType === 'DELIVERY' && order.driver && (
            <div className="space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>تتبع وصول الكابتن مباشرة على الخريطة:</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  GPS مباشر 🛰️
                </span>
              </div>
              <LiveOrderMap
                orderId={order.id}
                driverName={assignedDriverCleanName || order.driver.name}
                driverPhone={order.driver.phone}
                restaurantName={order.branch?.name || 'مطعم الجامعة'}
                orderStatus={status}
                restaurantCoords={restaurantCoords}
                studentCoords={studentCoords}
                liveDriverCoords={liveDriverCoords}
                pickupPin={order.pickupPin}
              />
            </div>
          )}

          {status === 'REJECTED' ? (
            (
              order.notes?.includes('من قِبل الطالب') ||
              order.notes?.includes('من قِبل العميل') ||
              order.notes?.includes('بواسطة الطالب') ||
              order.notes?.includes('بواسطة العميل')
            ) ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-700 space-y-2.5">
                <XCircle className="w-12 h-12 mx-auto text-slate-400" />
                <h4 className="font-black text-sm text-slate-900">تم إلغاء الطلب بنجاح</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  قمت بإلغاء هذا الطلب بناءً على رغبتك قبل بدء التجهيز.
                </p>
                {order.walletDiscount > 0 && (
                  <p className="text-[11px] font-black text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-200">
                    ✓ تم استرداد {order.walletDiscount} ج.م إلى رصيد محفظتك الجامعية بنجاح.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-700 space-y-2.5">
                <XCircle className="w-12 h-12 mx-auto text-rose-500" />
                <h4 className="font-black text-sm">تم الاعتذار عن الطلب</h4>
                {order.notes?.includes('سبب الإلغاء:') ? (
                  <div className="bg-white/90 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-bold space-y-1 text-right">
                    <span className="text-[11px] text-rose-500 font-bold block">سبب الاعتذار المسجل من المطعم:</span>
                    <p className="text-xs font-black text-rose-900 leading-relaxed">
                      {order.notes.split('سبب الإلغاء:')[1].trim()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-600">
                    تم الاعتذار عن هذا الطلب من المطعم. إذا كان لديك استفسار يمكنك التواصل مع الفرع مباشرة.
                  </p>
                )}
                {order.walletDiscount > 0 && (
                  <p className="text-[11px] font-black text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-200">
                    ✓ تم استرداد {order.walletDiscount} ج.م إلى رصيد محفظتك الجامعية بنجاح.
                  </p>
                )}
              </div>
            )
          ) : (
            /* Progress Timeline */
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCurrent = step.isActive;
                const isFinished = step.isDone;

                return (
                  <div key={idx} className="flex items-start gap-4 relative">
                    {/* Vertical Connector Line */}
                    {idx < steps.length - 1 && (
                      <div className={`absolute right-5 top-10 bottom-0 w-0.5 -mb-4 ${
                        isFinished ? 'bg-emerald-500' : 'bg-slate-200'
                      }`} />
                    )}

                    {/* Step Icon */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 transition-all ${
                      isFinished
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md animate-pulse'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Step Text */}
                    <div className="pt-1 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-black ${
                            isCurrent ? 'text-indigo-600 font-black' : isFinished ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {step.title}
                          </h4>
                          {step.timeText && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                              {step.timeText}
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 animate-pulse">
                            المرحلة الحالية
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${
                        isCurrent ? 'text-indigo-700 font-bold' : isFinished ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        {step.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delivery & Address Info */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
            {order.orderType === 'DELIVERY' ? (
              <div className="space-y-1">
                {order.deliveryZoneName && (
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold mb-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>منطقة التوصيل: {order.deliveryZoneName}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">العنوان الجامعي: </span>
                    <span className="text-slate-600">{getDisplayAddress(order.addressText, 'موقعي الحالي بالحرم الجامعي')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <ShoppingBag className="w-4 h-4" />
                <span>الاستلام من مقر الفرع بالجامعة فور جاهزيته</span>
              </div>
            )}

            {order.branch?.phone && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">هاتف المطعم:</span>
                <a
                  href={`tel:${order.branch.phone}`}
                  className="flex items-center gap-1 font-mono font-bold text-indigo-600 hover:underline"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{order.branch.phone}</span>
                </a>
              </div>
            )}
          </div>

          {/* Rating Section (إذا اكتمل الطلب) */}
          {status === 'COMPLETED' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h4 className="text-xs font-black text-amber-950">
                    {ratingSubmitted ? 'تقييمك للطلب' : 'ما رأيك في الوجبة والخدمة؟'}
                  </h4>
                </div>
                {ratingSubmitted && (
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    تم التقييم ⭐
                  </span>
                )}
              </div>

              {ratingSubmitted ? (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= (order.rating || rating) ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  {order.review && (
                    <p className="text-xs text-amber-900 bg-white/80 p-2 rounded-xl mt-1 border border-amber-200/50">
                      "{order.review}"
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitRating} className="space-y-2">
                  <div className="flex items-center gap-2 justify-center py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= (hoverRating ?? rating)
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="اكتب رأيك أو ملاحظاتك على الأكل (اختياري)..."
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />

                  <button
                    type="submit"
                    disabled={submittingRating}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  >
                    {submittingRating ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>إرسال التقييم</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Items Summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-700">محتويات الطلب</h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50">
                  <span className="font-bold text-slate-800">
                    {item.quantity} × {item.itemName} {item.sizeName ? `(${item.sizeName})` : ''}
                  </span>
                  <span className="font-black text-indigo-700">{item.totalPrice} ج.م</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total & Payment Method */}
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">طريقة الدفع</span>
              <span className="font-black text-slate-800">
                {order.paymentMethod === 'CASH' && '💵 كاش عند الاستلام'}
                {order.paymentMethod === 'VODAFONE_CASH' && '📱 محفظة فودافون كاش'}
                {order.paymentMethod === 'INSTAPAY' && '⚡ إنستاباي'}
                {order.paymentMethod === 'CARD' && '💳 فيزا / بطاقة'}
              </span>
              {order.paymentSenderPhone && (
                <span className="block text-[10px] text-indigo-700 font-mono font-bold mt-0.5">
                  رقم التحويل: {order.paymentSenderPhone}
                </span>
              )}
            </div>
            <div className="text-left">
              <span className="text-slate-500 block text-[10px]">الإجمالي الكلي</span>
              <span className="text-base font-black text-indigo-700">{order.total} ج.م</span>
            </div>
          </div>
        </div>

        {/* Footer: Cancel Button or Close */}
        <div className="p-4 border-t bg-slate-50 pb-safe flex gap-2">
          {status === 'PENDING' && (
            <button
              onClick={() => setShowCancelConfirmModal(true)}
              disabled={cancelling}
              className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
            >
              {cancelling ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>إلغاء الطلب</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>

        {/* Cancel Confirmation Modal */}
        {showCancelConfirmModal && (
          <div 
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overscroll-contain"
            onClick={() => setShowCancelConfirmModal(false)}
          >
            <div 
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-5 space-y-4 animate-in zoom-in-95 duration-200 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200/60 shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">إلغاء الطلب؟</h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ سيتم إرجاع أي مبالغ مدفوعة أو مخصومة من محفظتك فوراً.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition-colors shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>نعم، إلغاء الطلب</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
