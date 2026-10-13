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
  Truck
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
import { Logo } from './components/Logo';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('branch_token'));
  const [branch, setBranch] = useState<any | null>(() => {
    const saved = localStorage.getItem('branch_info');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'MENU' | 'MODIFIERS' | 'DRIVERS' | 'PROFILE'>('ORDERS');
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showQuickStock, setShowQuickStock] = useState<boolean>(false);
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

    const socketUrl = (window.location.port === '5173' || window.location.port === '5174')
      ? `http://${window.location.hostname}:5000`
      : window.location.origin;
    const socket: Socket = io(socketUrl);

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_branch', branch.id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // استلام طلب جديد لحظياً!
    socket.on('new_order', (newOrder: any) => {
      // إضافة الطلب في أول القائمة
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      // تشغيل جرس التنبيه المستمر
      soundNotifier.startRepeatingAlarm();
    });

    // تحديث حالة طلب
    socket.on('order_status_updated', (updatedOrder: any) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3 shadow-sm flex items-center justify-between">
        {/* Branch identity with UniFood branding */}
        <div className="flex items-center gap-4">
          <Logo size="sm" showSubtitle={false} />
          <div className="h-7 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-tight">{branch.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                  {socketConnected ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      متصل بالخادم لحظياً
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      جاري إعادة الاتصال...
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'ORDERS'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>الطلبات المباشرة</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-black animate-bounce">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('MENU')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'MENU'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>إدارة المنيو والأصناف</span>
          </button>

          <button
            onClick={() => setActiveTab('MODIFIERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'MODIFIERS'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>أقسام الإضافات</span>
          </button>

          <button
            onClick={() => setActiveTab('DRIVERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'DRIVERS'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>كباتن التوصيل (الطيارين)</span>
          </button>

          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'PROFILE'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>بيانات الفرع والدفع</span>
          </button>
        </nav>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Quick Stock Toggle Button */}
          <button
            onClick={() => setShowQuickStock(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
            title="إيقاف وتشغيل الأصناف والإضافات فوراً"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>توفر الأصناف</span>
            {(() => {
              const outCount =
                categories.reduce((acc, cat) => acc + (cat.items || []).filter((i: any) => !i.isAvailable).length, 0) +
                modifierGroups.reduce((acc, g) => acc + (g.options || []).filter((o: any) => !o.isAvailable).length, 0);
              return outCount > 0 ? (
                <span className="font-mono bg-rose-600 text-white px-1.5 py-0.5 rounded-md text-[10px]">
                  {outCount} نفد
                </span>
              ) : null;
            })()}
          </button>
          {/* Status Badge Button */}
          <button
            onClick={() => setShowStatusModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all border shadow-sm ${
              branch.operationalStatus === 'OPEN' || !branch.operationalStatus
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : branch.operationalStatus === 'BUSY'
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/30'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
            title="انقر لتعديل حالة استقبال الطلبات (مفتوح / مغلق مؤقتاً / مغلق)"
          >
            <span className={`w-2 h-2 rounded-full ${
              branch.operationalStatus === 'OPEN' || !branch.operationalStatus ? 'bg-emerald-500 animate-pulse' :
              branch.operationalStatus === 'BUSY' ? 'bg-amber-500 animate-ping' : 'bg-rose-500'
            }`}></span>
            <span>
              {branch.operationalStatus === 'OPEN' || !branch.operationalStatus ? 'المطعم مفتوح' : ''}
              {branch.operationalStatus === 'BUSY' ? `مغلق مؤقتاً (${formatCountdown(secondsLeft)})` : ''}
              {branch.operationalStatus === 'CLOSED' ? 'المطعم مغلق' : ''}
            </span>
          </button>

          {/* Sound Mute/Unmute */}
          <button
            onClick={handleToggleMute}
            className={`p-2.5 rounded-xl border transition-colors ${
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
            className="p-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            title="تحديث البيانات"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all"
            title="تسجيل الخروج من هذا الفرع"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      {/* Operational Status Alerts */}
      {branch.operationalStatus === 'BUSY' && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-6 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3 text-xs font-bold">
            <Clock className="w-4 h-4 animate-spin text-amber-200" />
            <span>
              المطعم في فترة إغلاق مؤقتة ({branch.closingReason || 'ضغط طلبات وتجهيز'}) • سيعاد الفتح تلقائياً بعد:
            </span>
            <span className="font-mono text-sm font-black bg-black/20 px-3 py-0.5 rounded-lg border border-amber-300/40">
              {formatCountdown(secondsLeft)}
            </span>
          </div>
          <button
            onClick={handleQuickReopen}
            className="px-3.5 py-1 bg-white hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
          >
            إلغاء الإغلاق والفتح فوراً
          </button>
        </div>
      )}

      {branch.operationalStatus === 'CLOSED' && (
        <div className="bg-rose-600 text-white px-6 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 text-xs font-bold">
            <PowerOff className="w-4 h-4" />
            <span>المطعم مغلق حالياً حتى إشعار آخر ولا يستقبل أي طلبات جديدة</span>
          </div>
          <button
            onClick={handleQuickReopen}
            className="px-3.5 py-1 bg-white hover:bg-rose-50 text-rose-900 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
          >
            فتح المطعم الآن
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'ORDERS' && (
          <OrdersView
            orders={orders}
            branchName={branch.name}
            onRefreshOrders={loadData}
          />
        )}

        {activeTab === 'MENU' && (
          <MenuManager
            categories={categories}
            modifierGroups={modifierGroups}
            onRefresh={loadData}
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
    </div>
  );
}

export default App;
