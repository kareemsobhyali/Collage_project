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
  Smartphone
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { registerServiceWorker, requestPushPermission, sendWebNotification, isRunningInNativeApk } from '../services/notifications';

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
  const handlePickup = async (orderId: string) => {
    try {
      await api.driverPickupOrder(orderId);
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
            <a
              href="https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Driver.apk"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span>تحميل تطبيق كابتن التوصيل للأندرويد (APK)</span>
            </a>
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
      <header className="bg-indigo-900 text-white sticky top-0 z-40 px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-700 flex items-center justify-center font-black">
            <Truck className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <h1 className="text-sm font-black leading-tight">كابتن: {driver.name}</h1>
            <span className="text-[11px] text-indigo-300 font-mono">@{driver.username} • {driver.phone}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              stopAlarm();
            }}
            className={`p-2 rounded-xl transition-colors ${
              isMuted ? 'bg-rose-500/20 text-rose-300' : 'bg-indigo-800 text-indigo-200'
            }`}
            title={isMuted ? 'الصوت مكتوم' : 'الصوت مفعل'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Refresh */}
          <button
            onClick={loadDriverData}
            disabled={loadingOrders}
            className="p-2 bg-indigo-800 hover:bg-indigo-700 rounded-xl transition-colors"
            title="تحديث"
          >
            <RotateCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 bg-rose-600/30 hover:bg-rose-600 text-rose-200 rounded-xl transition-colors"
            title="تسجيل خروج"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-indigo-800 rounded-xl text-indigo-300 text-xs font-bold"
            >
              إغلاق
            </button>
          )}
        </div>
      </header>

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

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border overflow-hidden shadow-sm transition-all ${
                    isPickedUp
                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                      : 'border-amber-300 ring-2 ring-amber-100'
                  }`}
                >
                  {/* Card Top */}
                  <div className={`p-4 flex items-center justify-between border-b ${
                    isPickedUp ? 'bg-indigo-50' : 'bg-amber-50'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-slate-900">طلب #{order.orderNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          isPickedUp ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white animate-pulse'
                        }`}>
                          {isPickedUp ? '🛵 جاري التوصيل للعميل' : '⏳ بانتظار استلامك من الفرع'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span className="text-base font-black text-slate-900">{order.total} ج.م</span>
                  </div>

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
                          onClick={() => handlePickup(order.id)}
                          className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>استلام من الفرع</span>
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
    </div>
  );
};
