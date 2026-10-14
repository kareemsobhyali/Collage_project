import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Truck, 
  Phone, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  RotateCw, 
  BellRing, 
  Volume2, 
  VolumeX, 
  KeyRound, 
  AlertCircle, 
  ShoppingBag, 
  User, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  Smartphone,
  X,
  ChevronDown,
  Eye,
  MessageSquare,
  Store
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { registerServiceWorker, requestPushPermission, sendWebNotification, isRunningInNativeApk, triggerInstallApp } from '../services/notifications';

interface DriverPortalProps {
  onClose?: () => void;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({ onClose }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('driver_token'));
  const [driver, setDriver] = useState<any | null>(() => {
    const saved = localStorage.getItem('driver_info');
    return saved ? JSON.parse(saved) : null;
  });

  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Orders and socket
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [incomingAssignedOrders, setIncomingAssignedOrders] = useState<any[]>([]);

  // Delivery PIN dialog
  const [deliveringOrder, setDeliveringOrder] = useState<any | null>(null);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [deliveringLoading, setDeliveringLoading] = useState(false);

  // Audio alerts
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<any>(null);

  // Initialize Web Audio beep for loud alerts
  const playAlertSound = () => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Loud double-beep alert
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  const startRepeatingAlarm = () => {
    stopAlarm();
    playAlertSound();
    alarmIntervalRef.current = setInterval(() => {
      playAlertSound();
    }, 2500);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  };

  // Load Driver Profile & Orders
  const loadDriverData = async () => {
    if (!token) return;
    try {
      setLoadingOrders(true);
      const [driverData, ordersData] = await Promise.all([
        api.getDriverMe().catch(() => null),
        api.getDriverOrders().catch(() => []),
      ]);

      if (driverData) {
        setDriver(driverData);
        localStorage.setItem('driver_info', JSON.stringify(driverData));
      }
      setOrders(ordersData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    registerServiceWorker();
    if (token) {
      loadDriverData();
      requestPushPermission().catch(() => {});
    }
    return () => stopAlarm();
  }, [token]);

  // Socket setup for driver room
  useEffect(() => {
    if (!driver?.id) return;

    const socketHost = API_BASE_URL.replace('/api', '');
    const socket: Socket = io(socketHost);

    socket.on('connect', () => {
      socket.emit('join_driver', driver.id);
    });

    socket.on('new_order_assigned', (order: any) => {
      startRepeatingAlarm();
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      setIncomingAssignedOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      sendWebNotification(
        `🛵 طلب توصيل جديد مسند لك #${order.orderNumber || ''}!`,
        `العميل: ${order.customerName || 'طالب'} • العنوان: ${order.addressText || ''}`,
        '/delivery'
      );
    });

    socket.on('order_status_updated', (updated: any) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
      );
      if (updated.status === 'COMPLETED' || updated.status === 'REJECTED') {
        setIncomingAssignedOrders((prev) => prev.filter((o) => o.id !== updated.id));
      }
      setSelectedOrder((prev: any) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    });

    return () => {
      socket.disconnect();
    };
  }, [driver?.id]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await api.driverLogin(username.trim(), password);
      if (res.token) {
        localStorage.setItem('driver_token', res.token);
        localStorage.setItem('driver_info', JSON.stringify(res.driver));
        setToken(res.token);
        setDriver(res.driver);
      }
    } catch (err: any) {
      setLoginError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('driver_token');
    localStorage.removeItem('driver_info');
    setToken(null);
    setDriver(null);
    setOrders([]);
    stopAlarm();
  };

  // Reject order (only before pickup)
  const handleReject = async (orderId: string) => {
    if (!window.confirm('هل أنت متأكد من الاعتذار عن توصيل هذا الطلب؟ سيعاد للمطعم لإسناده لطيار آخر.')) return;
    try {
      await api.driverRejectOrder(orderId, 'اعتذار من الطيار');
      stopAlarm();
      loadDriverData();
    } catch (err: any) {
      alert(err.message || 'فشل رفض الطلب');
    }
  };

  // Pickup order from branch
  const handlePickup = async (order: any) => {
    if (order.status !== 'READY') {
      const confirmEarly = window.confirm(
        'تنبيه: الأوردر ما زال قيد التجهيز بالمطبخ ولم يحدد المطعم بعد أنه جاهز للاستلام.\nهل استلمت الوجبة بالفعل من الفرع وتريد بدء التوصيل للعميل؟'
      );
      if (!confirmEarly) return;
    }
    try {
      await api.driverPickupOrder(order.id);
      stopAlarm();
      loadDriverData();
    } catch (err: any) {
      alert(err.message || 'فشل تأكيد الاستلام من الفرع');
    }
  };

  // Confirm delivery with PIN
  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringOrder || !inputPin.trim()) {
      setPinError('يرجى إدخال رمز الأمان (PIN) المكون من 4 أرقام');
      return;
    }

    try {
      setDeliveringLoading(true);
      setPinError(null);
      await api.driverDeliverOrder(deliveringOrder.id, inputPin.trim());
      setDeliveringOrder(null);
      setInputPin('');
      loadDriverData();
    } catch (err: any) {
      setPinError(err.message || 'رمز PIN غير مطابق! تأكد من الطالب.');
    } finally {
      setDeliveringLoading(false);
    }
  };

  // Active vs completed orders
  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'REJECTED');
  const finishedOrders = orders.filter((o) => o.status === 'COMPLETED');

  // If not logged in, render Driver Login screen
  if (!token || !driver) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 text-right" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
              <Truck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-800">بوابة كباتن التوصيل (الطيارين)</h2>
            <p className="text-xs text-slate-500">سجل دخولك لمتابعة واستلام وتوصيل طلبات الحرم الجامعي</p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">اسم المستخدم (Username)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: ahmed_driver"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{loginLoading ? 'جاري التحقق...' : 'تسجيل الدخول للكابتن'}</span>
            </button>
          </form>

          {!isRunningInNativeApk() && (
            <button
              type="button"
              onClick={() => triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Driver.apk')}
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span>تثبيت تطبيق كابتن التوصيل (أندرويد)</span>
            </button>
          )}

          {onClose && !isRunningInNativeApk() && (
            <button
              onClick={onClose}
              className="w-full py-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold text-center block"
            >
              العودة لتطبيق الطلاب
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Driver Header */}
      <header className="bg-indigo-900 text-white sticky top-0 z-40 px-3.5 sm:px-6 py-2.5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-indigo-700 flex items-center justify-center font-black shrink-0 shadow-inner">
              <Truck className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-black leading-tight truncate">كابتن: {driver.name}</h1>
              <span className="text-[11px] text-indigo-300 font-mono block truncate" dir="ltr">
                @{driver.username} • {driver.phone}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Audio toggle */}
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                stopAlarm();
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${
                isMuted ? 'bg-rose-500/20 text-rose-300' : 'bg-indigo-800 text-indigo-200 hover:bg-indigo-700'
              }`}
              title={isMuted ? 'الصوت مكتوم' : 'الصوت مفعل'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Refresh */}
            <button
              onClick={loadDriverData}
              disabled={loadingOrders}
              className="w-9 h-9 flex items-center justify-center bg-indigo-800 hover:bg-indigo-700 rounded-xl transition-colors shrink-0"
              title="تحديث"
            >
              <RotateCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center bg-rose-600/30 hover:bg-rose-600 text-rose-200 rounded-xl transition-colors shrink-0"
              title="تسجيل خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="h-9 px-3 bg-indigo-800 hover:bg-indigo-700 rounded-xl text-indigo-200 text-xs font-bold whitespace-nowrap shrink-0 flex items-center justify-center"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Incoming Assigned Orders Dock / Stack */}
      {incomingAssignedOrders.length > 0 && (
        <aside aria-label="طلبات جديدة واردة" className="fixed top-3 left-3 right-3 z-40 max-w-lg mx-auto animate-slideDown" dir="rtl">
          <div className="bg-slate-900/95 backdrop-blur-md border-2 border-indigo-500 rounded-3xl p-3 sm:p-4 shadow-2xl text-white space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-emerald-400 animate-bounce" />
                  <span>
                    {incomingAssignedOrders.length === 1
                      ? 'طلب توصيل جديد مسند إليك الآن!'
                      : `${incomingAssignedOrders.length} طلبات توصيل مسندة إليك!`}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopAlarm();
                  setIncomingAssignedOrders([]);
                }}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 transition-colors"
              >
                تجاهل الكروت
              </button>
            </div>

            {/* Organized Small Cards Stack */}
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {incomingAssignedOrders.map((incOrder) => (
                <div
                  key={incOrder.id}
                  onClick={() => {
                    stopAlarm();
                    setSelectedOrder(incOrder);
                    setIncomingAssignedOrders((prev) => prev.filter((o) => o.id !== incOrder.id));
                  }}
                  className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-400 rounded-2xl p-3 cursor-pointer transition-all active:scale-98 flex items-center justify-between gap-3 group shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-mono font-black text-sm shrink-0 group-hover:scale-105 transition-transform">
                      #{incOrder.orderNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">
                          {incOrder.customerName || 'طالب'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/60">
                          {incOrder.branch?.name || 'المطعم'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate max-w-[190px] sm:max-w-xs">
                          {incOrder.deliveryZoneName || incOrder.addressText || 'الحرم الجامعي'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-left shrink-0">
                      <span className="text-xs font-mono font-black text-emerald-400 block">
                        {incOrder.total} ج.م
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block">
                        {incOrder.paymentMethod === 'CASH' ? '💵 كاش' : '💳 أونلاين'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIncomingAssignedOrders((prev) => prev.filter((o) => o.id !== incOrder.id));
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-700/60"
                      title="إخفاء الكارت"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-center text-indigo-300 font-medium">
              👆 اضغط على أي كارت لفتح شاشة وتفاصيل الطلب وبدء التوصيل
            </p>
          </div>
        </aside>
      )}

      {/* Main Container */}
      <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4">
        {/* Active Orders Count Badge */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
              {activeOrders.length}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-xs">الطلبات المسندة إليك حالياً</h3>
              <p className="text-[11px] text-slate-400">ستسمع تنبيهاً صوتياً فور إسناد أي طلب جديد</p>
            </div>
          </div>
          {alarmIntervalRef.current && (
            <button
              onClick={stopAlarm}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold animate-pulse shadow-sm"
            >
              إيقاف صوت الجرس
            </button>
          )}
        </div>

        {/* Orders List */}
        {loadingOrders ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <RotateCw className="w-6 h-6 mx-auto animate-spin mb-2" />
            <span>جاري تحميل الطلبات...</span>
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-2">
            <ShoppingBag className="w-12 h-12 mx-auto text-slate-300" />
            <h4 className="font-bold text-slate-700 text-sm">لا توجد طلبات توصيل مسندة لك الآن</h4>
            <p className="text-xs text-slate-400">عندما يسند إليك المطعم طلباً جديداً ستتلقى إشعاراً صوتياً فورياً</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => {
              const isPickedUp = Boolean(order.driverPickedUpAt);
              const isScheduled = order.isScheduled;
              const isReady = order.status === 'READY';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border overflow-hidden shadow-sm transition-all ${
                    isPickedUp
                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                      : isReady
                        ? 'border-emerald-300 ring-2 ring-emerald-100'
                        : 'border-amber-300 ring-2 ring-amber-100'
                  }`}
                >
                  {/* Card Top */}
                  <div className={`p-4 flex items-center justify-between border-b ${
                    isPickedUp ? 'bg-indigo-50' : isReady ? 'bg-emerald-50' : 'bg-amber-50'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-slate-900">طلب #{order.orderNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          isPickedUp
                            ? 'bg-indigo-600 text-white'
                            : isReady
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-amber-500 text-white animate-pulse'
                        }`}>
                          {isPickedUp ? '🛵 جاري التوصيل للعميل' : isReady ? '✅ جاهز للاستلام من الفرع' : '🍳 قيد التجهيز بالمطبخ'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span className="text-base font-black text-slate-900">{order.total} ج.م</span>
                  </div>

                  {/* Kitchen Status Alert (Before Pickup) */}
                  {!isPickedUp && (
                    isReady ? (
                      <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">✅</span>
                          <div>
                            <h4 className="font-black text-xs text-emerald-950">الوجبة جاهزة للاستلام الآن من الفرع!</h4>
                            <p className="text-[11px] text-emerald-700">انتهى المطبخ من تجهيز الأوردر، توجه للكاونتر واستلم الوجبة.</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-600 text-white font-black text-[10px] rounded-lg shrink-0 animate-pulse">
                          جاهز الآن
                        </span>
                      </div>
                    ) : (
                      <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="text-xl animate-pulse">🍳</span>
                          <div>
                            <h4 className="font-black text-xs text-amber-950">
                              الوجبة قيد التجهيز في المطبخ حالياً
                              {order.estimatedPrepTime ? ` (${order.estimatedPrepTime} دقيقة)` : ''}
                            </h4>
                            <p className="text-[11px] text-amber-700">المطعم يقوم بتحضير الطعام الآن، يرجى الانتظار حتى تصبح الوجبة جاهزة للاستلام.</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-500 text-white font-black text-[10px] rounded-lg shrink-0">
                          قيد التحضير
                        </span>
                      </div>
                    )
                  )}

                  {/* Scheduled Notice if any */}
                  {isScheduled && (
                    <div className="bg-purple-600 text-white px-4 py-1.5 text-xs font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>موعد التسليم المحجوز للبريك: {order.scheduledFor ? new Date(order.scheduledFor).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'محدد'}</span>
                    </div>
                  )}

                  {/* Customer and Location Info */}
                  <div className="p-4 space-y-3 text-xs bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>الطالب: {order.customerName}</span>
                      </div>
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold font-mono shadow-xs hover:bg-emerald-700 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال: {order.customerPhone}</span>
                      </a>
                    </div>

                    {/* University Building & Location */}
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-1">
                      {order.deliveryZoneName && (
                        <div className="font-bold text-indigo-700 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                          <span>منطقة التوصيل: {order.deliveryZoneName}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black">العنوان الجامعي: </span>
                          <span>{order.addressText}</span>
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-bold">
                        <span>ملاحظات التوصيل: </span>
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Bag / Group Details if present */}
                  {order.groupCartDetails && (() => {
                    try {
                      const bags = typeof order.groupCartDetails === 'string' ? JSON.parse(order.groupCartDetails) : order.groupCartDetails;
                      if (Array.isArray(bags) && bags.length > 0) {
                        return (
                          <div className="p-3 mx-4 my-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs space-y-1.5">
                            <span className="font-black text-purple-900 block">🛍️ الطلب مقسم أكياس منفصلة:</span>
                            {bags.map((b: any, bIdx: number) => (
                              <div key={bIdx} className="bg-white p-2 rounded-xl text-[11px] font-bold text-slate-700 flex justify-between border border-purple-100">
                                <span>كيس {b.studentName}: {b.items?.length || 0} أصناف</span>
                                <span>{b.subtotal} ج.م</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    } catch (e) {}
                    return null;
                  })()}

                  {/* Items Summary */}
                  <div className="p-4 space-y-2">
                    <span className="text-slate-400 text-xs font-bold block">محتويات الأوردر ({order.items?.length} أصناف):</span>
                    <div className="space-y-1.5">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs bg-slate-50 p-2 rounded-xl font-bold text-slate-700">
                          <span>{item.quantity} × {item.itemName} {item.sizeName ? `(${item.sizeName})` : ''}</span>
                          <span className="font-mono">{item.totalPrice} ج.م</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
                    {!isPickedUp ? (
                      <div className="grid grid-cols-2 gap-2">
                        {/* Reject button (only before pickup) */}
                        <button
                          type="button"
                          onClick={() => handleReject(order.id)}
                          className="py-3 px-3 bg-white border border-rose-300 text-rose-700 rounded-2xl font-bold text-xs hover:bg-rose-50 transition-colors"
                        >
                          اعتذار عن الطلب
                        </button>

                        {/* Pickup from branch button */}
                        <button
                          type="button"
                          onClick={() => handlePickup(order)}
                          className={`py-3 px-3 text-white rounded-2xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
                            isReady
                              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 ring-2 ring-emerald-300'
                              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                          }`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{isReady ? 'استلام الوجبة (جاهزة الآن)' : 'استلام من الفرع'}</span>
                        </button>
                      </div>
                    ) : (
                      /* Deliver with PIN button */
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveringOrder(order);
                          setInputPin('');
                          setPinError(null);
                        }}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-5 h-5" />
                        <span>تأكيد التسليم للعميل (إدخال PIN)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-indigo-600" />
                      <span>عرض تفاصيل الطلب والأصناف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* PIN Verification Modal */}
      {deliveringOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-slate-800">تأكيد التسليم بأمان</h3>
              <p className="text-xs text-slate-500">
                اطلب رمز الأمان (PIN) المكون من 4 أرقام من الطالب {deliveringOrder.customerName} عند تسليمه الطلب
              </p>
            </div>

            {pinError && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold text-center">
                {pinError}
              </div>
            )}

            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-3xl font-black tracking-widest p-3 bg-slate-50 border-2 border-indigo-200 rounded-2xl focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveringOrder(null)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deliveringLoading || inputPin.length !== 4}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {deliveringLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>إنهاء التسليم</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Order Details Modal for Driver */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-mono font-black text-sm text-white">
                  #{selectedOrder.orderNumber}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <span>تفاصيل طلب التوصيل</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                      {selectedOrder.branch?.name || 'المطعم'}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {selectedOrder.status === 'PREPARING' && 'المطبخ يقوم بالتحضير 👨‍🍳'}
                    {selectedOrder.status === 'READY' && 'جاهز للاستلام من الفرع 📦'}
                    {selectedOrder.status === 'COMPLETED' && 'تم تسليمه بنجاح ✅'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Customer Contact & Call */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">بيانات العميل (الطالب):</span>
                  <span className="text-sm font-black text-slate-800">{selectedOrder.customerName}</span>
                  <span className="text-xs font-mono text-slate-600 block">{selectedOrder.customerPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/20${selectedOrder.customerPhone.replace(/^0+/, '')}?text=${encodeURIComponent(
                      `مرحباً أستاذ ${selectedOrder.customerName}، كابتن التوصيل معك بخصوص طلبك رقم #${selectedOrder.orderNumber}...`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1 font-bold"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>واتساب</span>
                  </a>
                  <a
                    href={`tel:${selectedOrder.customerPhone}`}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1 font-bold"
                  >
                    <Phone className="w-4 h-4" />
                    <span>اتصال</span>
                  </a>
                </div>
              </div>

              {/* Delivery Address & Zone */}
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-1.5 shadow-xs">
                {selectedOrder.deliveryZoneName && (
                  <div className="font-bold text-indigo-700 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>منطقة التوصيل: {selectedOrder.deliveryZoneName}</span>
                  </div>
                )}
                <div className="flex items-start gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-slate-800">العنوان الجامعي المحدد: </span>
                    <span className="text-slate-600">{selectedOrder.addressText}</span>
                  </div>
                </div>
                {selectedOrder.notes && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-bold">
                    <span>ملاحظات الطالب: </span>
                    <span>{selectedOrder.notes}</span>
                  </div>
                )}
              </div>

              {/* Group Cart / Bag Division if present */}
              {selectedOrder.groupCartDetails && (() => {
                try {
                  const bags = typeof selectedOrder.groupCartDetails === 'string'
                    ? JSON.parse(selectedOrder.groupCartDetails)
                    : selectedOrder.groupCartDetails;
                  if (Array.isArray(bags) && bags.length > 0) {
                    return (
                      <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-1.5">
                        <span className="font-black text-purple-900 block">🛍️ الطلب مقسم أكياس منفصلة للطلاب:</span>
                        {bags.map((b: any, bIdx: number) => (
                          <div key={bIdx} className="bg-white p-2 rounded-xl text-[11px] font-bold text-slate-700 flex justify-between border border-purple-100">
                            <span>كيس: {b.label || `طالب ${bIdx + 1}`}</span>
                            <span className="font-mono text-purple-700">{b.totalAmount || b.subtotal || ''} ج.م</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                } catch (_e) {}
                return null;
              })()}

              {/* Order Items Breakdown */}
              <div className="space-y-1.5">
                <span className="font-black text-slate-700 block text-xs">أصناف ومحتويات الوجبة:</span>
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
                  {selectedOrder.items?.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-mono text-[10px] flex items-center justify-center font-black">
                          {it.quantity}x
                        </span>
                        <span className="font-bold text-slate-800">{it.itemName}</span>
                        {it.sizeName && <span className="text-[10px] text-slate-500">({it.sizeName})</span>}
                      </div>
                      <span className="font-mono font-bold text-slate-700">{it.totalPrice} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold block">المبلغ المطلوب تحصيله من الطالب:</span>
                  <span className="text-xl font-black text-emerald-700 font-mono">
                    {selectedOrder.paymentMethod === 'CASH' ? `${selectedOrder.total} ج.م` : '0.00 ج.م (مدفوع أونلاين)'}
                  </span>
                </div>
                <div className="text-left font-bold text-xs text-emerald-900">
                  <span className="block">{selectedOrder.paymentMethod === 'CASH' ? '💵 تحصيل نقدي' : '💳 مدفوع إلكترونياً'}</span>
                  <span className="text-[10px] text-emerald-700">إجمالي الفاتورة: {selectedOrder.total} ج.م</span>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
              {/* Pickup button */}
              {selectedOrder.status !== 'COMPLETED' && !selectedOrder.driverPickedUpAt && (
                <button
                  type="button"
                  onClick={() => {
                    handlePickup(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>تأكيد الاستلام من المطعم وبدء التوصيل</span>
                </button>
              )}

              {/* Deliver button with PIN */}
              {selectedOrder.status !== 'COMPLETED' && selectedOrder.driverPickedUpAt && (
                <button
                  type="button"
                  onClick={() => {
                    setDeliveringOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>تأكيد التسليم للطالب (PIN)</span>
                </button>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
