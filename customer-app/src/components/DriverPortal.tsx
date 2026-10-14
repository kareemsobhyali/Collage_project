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
  Store,
  Check
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

  // Delivery PIN dialog
  const [deliveringOrder, setDeliveringOrder] = useState<any | null>(null);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [deliveringLoading, setDeliveringLoading] = useState(false);

  // Audio alerts & Custom sound settings
  const [isMuted, setIsMuted] = useState(false);
  const [customSoundUrl, setCustomSoundUrl] = useState<string | null>(null);
  const [customVolume, setCustomVolume] = useState<number>(1.0);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<any>(null);

  // فك حظر تشغيل الصوت تلقائياً فور أول نقرة أو لمس للشاشة
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      } catch (_e) {}
    };

    window.addEventListener('click', unlockAudio, { once: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // جلب إعدادات الصوت المخصص من السيرفر
  const fetchSoundSettings = async () => {
    try {
      const data = await api.getPublicSoundSettings();
      if (data && data.enabled && data.soundUrl) {
        setCustomSoundUrl(data.soundUrl);
        setCustomVolume(data.volume ?? 1.0);
      } else {
        setCustomSoundUrl(null);
      }
    } catch (_e) {}
  };

  useEffect(() => {
    fetchSoundSettings();
  }, []);

  // نغمة صفارة تخليقية مزدوجة عالية جداً في حال عدم توفر ملف صوت أو تقييد المتصفح
  const playSyntheticBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // نغمة أولى حادة
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.exponentialRampToValueAtTime(587.33, now + 0.35); // D5
      gain1.gain.setValueAtTime(0.9 * customVolume, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // نغمة ثانية أعلى لشد الانتباه
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.18); // E6
      gain2.gain.setValueAtTime(0.9 * customVolume, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  // تشغيل نغمة التنبيه (الصوت المخصص من الإدارة أو التخليقي)
  const playAlertSound = () => {
    if (isMuted) return;

    if (customSoundUrl) {
      try {
        const fullUrl = customSoundUrl.startsWith('http')
          ? customSoundUrl
          : `${API_BASE_URL.replace('/api', '')}${customSoundUrl.startsWith('/') ? '' : '/'}${customSoundUrl}`;
        const audio = new Audio(fullUrl);
        audio.volume = customVolume;
        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => {
            playSyntheticBeep();
          });
        }
        return;
      } catch (_e) {
        // Fallback
      }
    }

    playSyntheticBeep();
  };

  const startRepeatingAlarm = () => {
    stopAlarm();
    playAlertSound();
    alarmIntervalRef.current = setInterval(() => {
      playAlertSound();
    }, 2200);
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
    }
    return () => stopAlarm();
  }, [token]);

  // Socket setup for driver room with Token Auth
  useEffect(() => {
    if (!driver?.id || !token) return;

    const socketHost = API_BASE_URL.replace('/api', '');
    const socket: Socket = io(socketHost, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

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
      setSelectedOrder((prev: any) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    });

    // تحديث النغمة الصوتية لحظياً فور تغييرها من الإدارة
    socket.on('notification_sound_updated', (soundSettings: any) => {
      if (soundSettings && soundSettings.enabled && soundSettings.soundUrl) {
        setCustomSoundUrl(soundSettings.soundUrl);
        setCustomVolume(soundSettings.volume ?? 1.0);
      } else {
        setCustomSoundUrl(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [driver?.id, token]);

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

  // Accept order
  const handleAccept = async (orderId: string) => {
    try {
      await api.driverAcceptOrder(orderId);
      stopAlarm();
      setOrders((prev: any[]) => prev.map(o => o.id === orderId ? { ...o, isDriverAccepted: true } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, isDriverAccepted: true });
      }
    } catch (err: any) {
      alert(err.message || 'فشل قبول الطلب');
    }
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
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-800/90 text-indigo-200 border border-indigo-700/60 inline-flex items-center gap-1">
                  {driver.isAllBranches ? '🌐 طيار عام لجميع المطاعم' : `🏪 ${driver.servedBranchNames?.length ? `${driver.servedBranchNames.length} مطاعم مخصصة` : (driver.branch?.name || 'مطعم محدد')}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Test sound button */}
            <button
              onClick={() => {
                if (isMuted) setIsMuted(false);
                playAlertSound();
              }}
              className="h-9 px-2.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-200 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 text-[11px] font-bold"
              title="تجربة صوت التنبيه"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">تجربة الصوت</span>
            </button>

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

      {/* Main Container */}
      <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4">
        {/* Scope Banner */}
        <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-sm ${
          driver.isAllBranches
            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 text-indigo-900'
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${driver.isAllBranches ? 'bg-purple-600 animate-pulse' : 'bg-indigo-600'}`} />
            <div className="min-w-0">
              <span className="font-black block text-xs">
                {driver.isAllBranches ? '🌐 طيار عام لجميع المطاعم والفروع' : '🏪 مطاعم وفروع محددة:'}
              </span>
              <span className="text-[11px] font-normal text-slate-600 truncate block">
                {driver.isAllBranches
                  ? 'مؤهل لاستقبال وتوصيل الطلبات من كافة مطاعم الحرم الجامعي'
                  : (driver.servedBranchNames?.length ? driver.servedBranchNames.join(' • ') : (driver.branch?.name || 'الفرع الأساسي'))}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 shrink-0">
            {driver.isAllBranches ? 'نطاق شامل' : `${driver.servedBranchNames?.length || 1} فروع`}
          </span>
        </div>
        {/* Permission Banner if notifications not granted */}
        {!hasNotificationPermission && typeof window !== 'undefined' && 'Notification' in window && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white p-3 sm:p-3.5 rounded-3xl shadow-md flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 text-white animate-bounce" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate">تفعيل إشعارات وصوت التنبيهات 🔔</p>
                <p className="text-[10px] text-white/90 truncate">انقر هنا لتشغيل التنبيهات الصوتية فور إسناد أي أوردر جديد لك</p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                playAlertSound();
                const granted = await requestPushPermission();
                setHasNotificationPermission(granted);
              }}
              className="px-3.5 py-1.5 bg-white text-indigo-950 font-black rounded-xl text-xs shrink-0 shadow-sm hover:bg-indigo-50 active:scale-95 transition-all"
            >
              تفعيل الآن
            </button>
          </div>
        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeOrders.map((order) => {
              const isPickedUp = Boolean(order.driverPickedUpAt);
              const isReady = order.status === 'READY';
              const itemsCount = order.items?.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) || order.items?.length || 0;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`bg-white rounded-3xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-indigo-400 active:scale-[0.98] flex flex-col justify-between gap-3 ${
                    isPickedUp
                      ? 'border-indigo-300 ring-2 ring-indigo-100 bg-gradient-to-b from-indigo-50/30 to-white'
                      : isReady
                        ? 'border-emerald-300 ring-2 ring-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white'
                        : 'border-amber-300 ring-2 ring-amber-100 bg-gradient-to-b from-amber-50/30 to-white'
                  }`}
                >
                  {/* 1. Header: Order #, Branch, Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-black text-base text-slate-900">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold truncate max-w-[120px]">
                        {order.branch?.name || 'المطعم'}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                      isPickedUp
                        ? 'bg-indigo-600 text-white'
                        : !order.isDriverAccepted
                          ? 'bg-amber-500 text-white animate-pulse'
                          : isReady
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-indigo-500 text-white'
                    }`}>
                      {isPickedUp
                        ? '🛵 جاري التوصيل'
                        : !order.isDriverAccepted
                          ? '⚡ بانتظار قبولك'
                          : isReady
                            ? '✅ جاهز للاستلام'
                            : '👍 تم القبول (قيد التجهيز)'}
                    </span>
                  </div>

                  {/* 2. Customer & Campus Location */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-bold truncate max-w-[160px]">
                      👤 {order.customerName || 'طالب'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {order.deliveryZoneName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{order.deliveryZoneName} {order.addressText ? `• ${order.addressText}` : ''}</span>
                    </div>
                  )}

                  {/* 3. Items Count & Price (Requested: رقم الأوردر، عدد الأصناف، السعر) */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
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

                  {/* 4. Actions: Accept/Reject quick buttons if not accepted, or open details */}
                  {!isPickedUp && !order.isDriverAccepted ? (
                    <div className="pt-2 flex items-center gap-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleAccept(order.id)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>قبول الطلب والتوجه للمطعم</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(order.id)}
                        className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all"
                      >
                        اعتذار
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1 flex items-center justify-between text-xs font-black text-indigo-600 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض تفاصيل الطلب والتوصيل</span>
                      </span>
                      <span className="text-slate-400">←</span>
                    </div>
                  )}
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
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>رجوع لشاشة الأوردرات</span>
                </button>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-mono font-black text-xs text-white">
                  #{selectedOrder.orderNumber}
                </div>
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <span>{selectedOrder.branch?.name || 'المطعم'}</span>
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="إغلاق"
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
              {/* Accept button if not yet accepted */}
              {selectedOrder.status !== 'COMPLETED' && !selectedOrder.driverPickedUpAt && !selectedOrder.isDriverAccepted && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleAccept(selectedOrder.id);
                      setSelectedOrder({ ...selectedOrder, isDriverAccepted: true });
                    }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>قبول الطلب والتوجه للمطعم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleReject(selectedOrder.id);
                      setSelectedOrder(null);
                    }}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs"
                  >
                    اعتذار
                  </button>
                </>
              )}

              {/* Pickup button if already accepted */}
              {selectedOrder.status !== 'COMPLETED' && !selectedOrder.driverPickedUpAt && selectedOrder.isDriverAccepted && (
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
