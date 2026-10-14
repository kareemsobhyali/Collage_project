import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Store, 
  ShoppingBag, 
  UtensilsCrossed, 
  Sliders, 
  UserCheck, 
  LogOut, 
  Volume2, 
  VolumeX, 
  RotateCw,
  Wifi,
  WifiOff,
  Clock,
  PowerOff,
  Truck,
  Printer,
  BellRing,
  Eye,
  X,
  MapPin
} from 'lucide-react';
import { api } from './services/api';
import { soundNotifier } from './services/audioAlert';
import { LoginModal } from './components/LoginModal';
import { OrdersView } from './components/OrdersView';
import { MenuManager } from './components/MenuManager';
import { ModifiersManager } from './components/ModifiersManager';
import { DriversManager } from './components/DriversManager';
import { QuickStockModal } from './components/QuickStockModal';
import { BranchProfileView } from './components/BranchProfileView';
import { BranchStatusModal } from './components/BranchStatusModal';
import { PrinterSettingsModal } from './components/PrinterSettingsModal';
import { getAutoPrintOnNewOrder, printOrderReceipt } from './services/printer';
import { Logo } from './components/Logo';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('branch_token'));
  const [branch, setBranch] = useState<any | null>(() => {
    const saved = localStorage.getItem('branch_info');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'MENU' | 'MODIFIERS' | 'DRIVERS' | 'PROFILE'>('ORDERS');
  const [orders, setOrders] = useState<any[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
  const [selectedModalOrder, setSelectedModalOrder] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showQuickStock, setShowQuickStock] = useState<boolean>(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // حساب العداد التنازلي وتحديثه كل ثانية عندما يكون الفرع مغلقاً مؤقتاً
  useEffect(() => {
    if (!branch?.closedUntil || branch?.operationalStatus !== 'BUSY') {
      setSecondsLeft(0);
      return;
    }

    const calcDiff = () => {
      const target = new Date(branch.closedUntil).getTime();
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      return diff;
    };

    setSecondsLeft(calcDiff());

    const timer = setInterval(() => {
      const remaining = calcDiff();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        loadData();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [branch?.closedUntil, branch?.operationalStatus]);

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 1. تحميل البيانات عند تسجيل الدخول
  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [profileData, ordersData, menuData] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getOrders(),
        api.getMenu(),
      ]);

      if (profileData) {
        setBranch(profileData);
        localStorage.setItem('branch_info', JSON.stringify(profileData));
      }
      setOrders(ordersData || []);
      setCategories(menuData.categories || []);
      setModifierGroups(menuData.modifierGroups || []);
    } catch (err: any) {
      console.error("Load data error:", err);
      if (err.message && err.message.includes("401")) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // 2. إعداد الاتصال اللحظي عبر Socket.io
  useEffect(() => {
    if (!token || !branch?.id) return;

    const isElectronFile = typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null');
    const socketUrl = isElectronFile
      ? 'http://localhost:5000'
      : (window.location.port === '5173' || window.location.port === '5174' || window.location.port === '3000')
        ? `http://${window.location.hostname || 'localhost'}:5000`
        : window.location.origin;
    const socket: Socket = io(socketUrl, { auth: { token } });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_branch', branch.id);
      // مزامنة فورية للطلبات بعد انقطاع الاتصال لضمان عدم ضياع أي طلب جديد تم إرساله أثناء انقطاع الإنترنت
      api.getOrders().then(freshOrders => {
        if (Array.isArray(freshOrders)) {
          setOrders(freshOrders);
        }
      }).catch(() => {});
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // استلام طلب جديد لحظياً!
    socket.on('new_order', (newOrder: any) => {
      // إضافة الطلب في أول القائمة
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      // إضافة الطلب للكروت المصغرة الواردة
      setIncomingOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      // تشغيل جرس التنبيه المستمر
      soundNotifier.startRepeatingAlarm();

      // طباعة تلقائية فورية للبون دون أي تدخل يدوي إن كانت مفعلة
      if (getAutoPrintOnNewOrder()) {
        printOrderReceipt(newOrder, branch?.name || 'UniFood');
      }
    });

    // تحديث حالة طلب
    socket.on('order_status_updated', (updatedOrder: any) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      if (updatedOrder.status !== 'PENDING') {
        setIncomingOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
      }
    });

    // تحديث حالة عمل الفرع لحظياً
    socket.on('branch_status_updated', (data: any) => {
      if (data.branchId === branch?.id) {
        setBranch((prev: any) => ({
          ...prev,
          operationalStatus: data.operationalStatus,
          closedUntil: data.closedUntil,
          closingReason: data.closingReason,
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, branch?.id]);

  const handleSaveOperationalStatus = async (status: 'OPEN' | 'BUSY' | 'CLOSED', durationMinutes?: number, reason?: string) => {
    const res = await api.updateOperationalStatus(status, durationMinutes, reason);
    if (res.branch) {
      setBranch(res.branch);
      localStorage.setItem('branch_info', JSON.stringify(res.branch));
    }
  };

  const handleQuickReopen = async () => {
    await handleSaveOperationalStatus('OPEN');
  };

  const handleLoginSuccess = (branchData: any, newToken: string) => {
    setBranch(branchData);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('branch_token');
    localStorage.removeItem('branch_info');
    soundNotifier.stopRepeatingAlarm();
    setIncomingOrders([]);
    setSelectedModalOrder(null);
    setToken(null);
    setBranch(null);
  };

  const handleToggleMute = () => {
    const muted = soundNotifier.toggleMute();
    setIsMuted(muted);
  };

  if (!token || !branch) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 flex flex-col font-sans">
      {/* Top Application Header (Two-tier responsive layout) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm w-full">
        {/* Tier 1: Brand Identity & Quick Operational Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Right: Branch identity with UniFood branding */}
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" showSubtitle={false} />
            <div className="h-7 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">
                  {branch.name}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                  {socketConnected ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>متصل بالخادم لحظياً</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>جاري إعادة الاتصال...</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Left: Quick Action Tools (All uniform h-9 sm:h-10 whitespace-nowrap shrink-0) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Stock Toggle Button */}
            <button
              onClick={() => setShowQuickStock(true)}
              className="h-9 sm:h-10 px-3 sm:px-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="إيقاف وتشغيل الأصناف والإضافات فوراً"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>توفر الأصناف</span>
              {(() => {
                const outCount =
                  categories.reduce((acc, cat) => acc + (cat.items || []).filter((i: any) => !i.isAvailable).length, 0) +
                  modifierGroups.reduce((acc, g) => acc + (g.options || []).filter((o: any) => !o.isAvailable).length, 0);
                return outCount > 0 ? (
                  <span className="font-mono bg-rose-600 text-white px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                    {outCount} نفد
                  </span>
                ) : null;
              })()}
            </button>

            {/* Status Badge Button */}
            <button
              onClick={() => setShowStatusModal(true)}
              className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-black transition-all border shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0 ${
                branch.operationalStatus === 'OPEN' || !branch.operationalStatus
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : branch.operationalStatus === 'BUSY'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/30'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
              title="انقر لتعديل حالة استقبال الطلبات (مفتوح / مغلق مؤقتاً / مغلق)"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  branch.operationalStatus === 'OPEN' || !branch.operationalStatus
                    ? 'bg-emerald-500 animate-pulse'
                    : branch.operationalStatus === 'BUSY'
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-rose-500'
                }`}
              />
              <span>
                {branch.operationalStatus === 'OPEN' || !branch.operationalStatus ? 'المطعم مفتوح' : ''}
                {branch.operationalStatus === 'BUSY' ? `مغلق مؤقتاً (${formatCountdown(secondsLeft)})` : ''}
                {branch.operationalStatus === 'CLOSED' ? 'المطعم مغلق' : ''}
              </span>
            </button>

            {/* Printer Settings Button */}
            <button
              onClick={() => setShowPrinterSettings(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
              title="إعدادات واختيار الطابعة الحرارية وتثبيتها والطباعة الصامتة"
            >
              <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">الطابعة</span>
              {getAutoPrintOnNewOrder() && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="الطباعة الفورية مفعلة" />
              )}
            </button>

            {/* Sound Mute/Unmute */}
            <button
              onClick={handleToggleMute}
              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                isMuted
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={isMuted ? 'الصوت مكتوم - اضغط للتشغيل' : 'الصوت مفعل - اضغط لكتم التنبيهات'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="h-9 w-9 sm:h-10 sm:w-10 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-colors shrink-0"
              title="تحديث البيانات"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="h-9 sm:h-10 px-3 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              title="تسجيل الخروج من هذا الفرع"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Navigation Tabs Bar */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6 py-2">
          <nav className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'ORDERS'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>الطلبات المباشرة</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-black animate-bounce leading-none">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('MENU')}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'MENU'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 shrink-0" />
              <span>إدارة المنيو والأصناف</span>
            </button>

            <button
              onClick={() => setActiveTab('MODIFIERS')}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'MODIFIERS'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span>أقسام الإضافات</span>
            </button>

            <button
              onClick={() => setActiveTab('DRIVERS')}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'DRIVERS'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>كباتن التوصيل (الطيارين)</span>
            </button>

            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'PROFILE'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>بيانات الفرع والدفع</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Floating / Sticky Incoming Orders Tray (شريط الكروت المصغرة للطلبات الواردة لحظياً) */}
      {incomingOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-xl border-b border-orange-600/30 sticky top-[102px] z-30 transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <span className="font-black text-sm sm:text-base flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 animate-bounce" />
                  <span>طلبات جديدة واردة الآن ({incomingOrders.length})</span>
                </span>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-bold hidden md:inline">
                  اضغط على أي كارت لفتح تفاصيل الطلب وقبوله
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => soundNotifier.stopRepeatingAlarm()}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  title="إيقاف صوت التنبيه مؤقتاً"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">كتم الصوت</span>
                </button>
                <button
                  onClick={() => setIncomingOrders([])}
                  className="px-2.5 py-1 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs font-bold transition-colors"
                  title="إخفاء هذا الشريط"
                >
                  إخفاء الشريط
                </button>
              </div>
            </div>

            {/* Mini Cards Horizontal Grid / Tray */}
            <div className="flex items-stretch gap-3 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
              {incomingOrders.map((incOrder) => (
                <div
                  key={incOrder.id}
                  onClick={() => {
                    setActiveTab('ORDERS');
                    setSelectedModalOrder(incOrder);
                    setIncomingOrders(prev => prev.filter(o => o.id !== incOrder.id));
                  }}
                  className="bg-white text-slate-900 rounded-2xl p-3 shadow-lg min-w-[260px] sm:min-w-[290px] max-w-[320px] cursor-pointer hover:shadow-2xl hover:scale-[1.02] active:scale-98 transition-all border border-orange-200 shrink-0 relative group flex flex-col justify-between"
                >
                  {/* Dismiss Mini Card */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIncomingOrders(prev => prev.filter(o => o.id !== incOrder.id));
                    }}
                    className="absolute top-2 left-2 p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors"
                    title="تجاهل الكارت المصغر"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 pl-6">
                      <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-xs">
                        #{incOrder.orderNumber}
                      </span>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 font-mono">
                        {incOrder.total} ج.م
                      </span>
                    </div>

                    <div className="text-xs font-black text-slate-800 truncate mb-1">
                      👤 {incOrder.customerName || 'طالب'}
                      <span className="text-[11px] font-bold text-slate-500 mr-1.5">
                        {incOrder.orderType === 'DELIVERY' ? '• 🛵 توصيل' : '• 🛍️ استلام'}
                      </span>
                    </div>

                    {incOrder.deliveryLocation && (
                      <div className="text-[11px] text-slate-500 truncate mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{incOrder.deliveryLocation}</span>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-600 line-clamp-1 mb-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      🛒 {incOrder.items?.length || 0} أصناف: {incOrder.items?.map((i: any) => i.itemName || i.item?.name).slice(0, 2).join('، ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-black text-indigo-600 group-hover:text-indigo-700">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>فتح وقبول الطلب</span>
                    </span>
                    <span className="text-slate-400 group-hover:translate-x-[-2px] transition-transform">←</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Operational Status Alerts */}
      {branch.operationalStatus === 'BUSY' && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <Clock className="w-4 h-4 animate-spin text-amber-200 shrink-0" />
            <span>
              المطعم في فترة إغلاق مؤقتة ({branch.closingReason || 'ضغط طلبات وتجهيز'}) • سيعاد الفتح تلقائياً بعد:
            </span>
            <span className="font-mono text-sm font-black bg-black/20 px-3 py-0.5 rounded-lg border border-amber-300/40 whitespace-nowrap">
              {formatCountdown(secondsLeft)}
            </span>
          </div>
          <button
            onClick={handleQuickReopen}
            className="px-3.5 py-1.5 bg-white hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            إلغاء الإغلاق والفتح فوراً
          </button>
        </div>
      )}

      {branch.operationalStatus === 'CLOSED' && (
        <div className="bg-rose-600 text-white px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2 text-xs font-bold">
            <PowerOff className="w-4 h-4 shrink-0" />
            <span>المطعم مغلق حالياً حتى إشعار آخر ولا يستقبل أي طلبات جديدة</span>
          </div>
          <button
            onClick={handleQuickReopen}
            className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-900 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            فتح المطعم الآن
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'ORDERS' && (
          <OrdersView
            orders={orders}
            branchName={branch.name}
            onRefreshOrders={loadData}
            initialDetailedOrder={selectedModalOrder}
            onClearDetailedOrder={() => setSelectedModalOrder(null)}
          />
        )}

        {activeTab === 'MENU' && (
          <MenuManager
            categories={categories}
            modifierGroups={modifierGroups}
            onRefresh={loadData}
            branch={branch}
          />
        )}

        {activeTab === 'MODIFIERS' && (
          <ModifiersManager
            modifierGroups={modifierGroups}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'DRIVERS' && (
          <DriversManager />
        )}

        {activeTab === 'PROFILE' && (
          <BranchProfileView 
            branch={branch}
            onUpdateBranch={(updated) => {
              setBranch(updated);
              localStorage.setItem('branch_info', JSON.stringify(updated));
            }}
          />
        )}
      </main>

      {showQuickStock && (
        <QuickStockModal
          categories={categories}
          modifierGroups={modifierGroups}
          onClose={() => setShowQuickStock(false)}
          onRefreshMenu={loadData}
        />
      )}

      {showStatusModal && (
        <BranchStatusModal
          currentStatus={branch.operationalStatus || 'OPEN'}
          currentClosedUntil={branch.closedUntil}
          currentReason={branch.closingReason}
          onSave={handleSaveOperationalStatus}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {showPrinterSettings && (
        <PrinterSettingsModal
          branchName={branch.name}
          onClose={() => setShowPrinterSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
