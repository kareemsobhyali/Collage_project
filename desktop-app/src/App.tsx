import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertTriangle,
  RotateCcw,
  LifeBuoy,
  Lock,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { api, syncRemoteServerConfig, getPublicWebUrl } from './services/api';
import { soundNotifier } from './services/audioAlert';
import { LoginModal } from './components/LoginModal';
import { OrdersView } from './components/OrdersView';
import { MenuManager } from './components/MenuManager';
import { ModifiersManager } from './components/ModifiersManager';
import { DriversManager } from './components/DriversManager';
import { BranchSupportView } from './components/BranchSupportView';
import { QuickStockModal } from './components/QuickStockModal';
import { BranchProfileView } from './components/BranchProfileView';
import { BranchStatusModal } from './components/BranchStatusModal';
import { PrinterSettingsModal } from './components/PrinterSettingsModal';
import { InstallAppButton } from './components/InstallAppButton';
import { getAutoPrintOnNewOrder, printOrderReceipt } from './services/printer';
import { Logo } from './components/Logo';
import { ToastContainer, toast } from './utils/toast';
import { useLockBodyScroll } from './utils/scrollLock';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('branch_token'));
  const [branch, setBranch] = useState<any | null>(() => {
    const saved = localStorage.getItem('branch_info');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'MENU' | 'MODIFIERS' | 'DRIVERS' | 'SUPPORT' | 'PROFILE'>('ORDERS');
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [openComplaintsCount, setOpenComplaintsCount] = useState<number>(0);
  const [newOrderTrigger, setNewOrderTrigger] = useState<number>(0);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showQuickStock, setShowQuickStock] = useState<boolean>(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);
  const [targetedDetailedOrder, setTargetedDetailedOrder] = useState<any | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState<boolean>(false);
  const [driverRejectionAlert, setDriverRejectionAlert] = useState<{
    orderNumber: number;
    driverName: string;
    orderId: string;
    order?: any;
  } | null>(null);
  const [driverReturnAlert, setDriverReturnAlert] = useState<{
    orderNumber: number;
    driverName: string;
    orderId: string;
    reason?: string;
    order?: any;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const [liveDriverLocations, setLiveDriverLocations] = useState<Record<string, { lat: number; lng: number; orderId?: string; timestamp: number }>>({});

  // حماية إعدادات وتحكمات الفرع بكلمة مرور / PIN
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [showSettingsLockModal, setShowSettingsLockModal] = useState(false);
  const [settingsInputPassword, setSettingsInputPassword] = useState('');
  const [showSettingsPasswordText, setShowSettingsPasswordText] = useState(false);
  const [verifyingSettingsPin, setVerifyingSettingsPin] = useState(false);
  const [settingsPinError, setSettingsPinError] = useState<string | null>(null);

  const handleOpenProfileTab = () => {
    if (branch?.hasSettingsPassword && !isSettingsUnlocked) {
      setSettingsInputPassword('');
      setSettingsPinError(null);
      setShowSettingsLockModal(true);
      return;
    }
    setActiveTab('PROFILE');
  };

  const handleVerifySettingsPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsInputPassword.trim()) {
      setSettingsPinError('يرجى إدخال كلمة المرور');
      return;
    }
    try {
      setVerifyingSettingsPin(true);
      setSettingsPinError(null);
      await api.verifySettingsPassword(settingsInputPassword.trim());
      setIsSettingsUnlocked(true);
      setShowSettingsLockModal(false);
      setActiveTab('PROFILE');
      toast.success('تم فتح لوحة التحكمات والإعدادات بنجاح 🔓');
    } catch (err: any) {
      setSettingsPinError(err.message || 'كلمة المرور غير صحيحة، يرجى مراجعة إدارة المطعم');
    } finally {
      setVerifyingSettingsPin(false);
    }
  };

  // وضع ملء الشاشة (Full Screen)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return Boolean(document.fullscreenElement);
    }
    return false;
  });

  const toggleFullScreen = () => {
    try {
      if ((window as any).electronAPI?.send) {
        (window as any).electronAPI.send('toggle-fullscreen');
        setIsFullscreen(!isFullscreen);
        return;
      }
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch (_e) {}
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // محاولة الدخول في وضع ملء الشاشة الكامل تلقائياً عند أول نقرة أو لمس من الكاشير
  useEffect(() => {
    const handleFirstGesture = () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (_e) {}
    };

    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // حالة إذن إشعارات الويندوز الأصلية
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'granted';
  });

  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          toast.success('تم تفعيل إشعارات الويندوز الفورية بنجاح! 🔔');
          try {
            new Notification('UniFood Branch | نظام الكاشير', {
              body: 'تم تفعيل التنبيهات الفورية فوق البرامج بنجاح!',
              icon: './icon-192.png'
            });
          } catch (_e) {}
        } else {
          toast.error('تم رفض إذن الإشعارات من المتصفح');
        }
      } catch (_e) {}
    }
  };

  // مزامنة عنوان السيرفر تلقائياً من GitHub عند بدء التطبيق
  useEffect(() => {
    syncRemoteServerConfig();
  }, []);

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

  // قفل السكرول فقط عند ظهور تنبيه عاجل لرفض أو إرجاع السائق (باقي النوافذ تدير القفل ذاتياً بأمان)
  useLockBodyScroll(Boolean(driverRejectionAlert || driverReturnAlert));

  // 1. تحميل البيانات عند تسجيل الدخول
  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [profileData, ordersData, menuData, ticketsData] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getOrders(),
        api.getMenu(),
        api.getSupportTickets().catch(() => []),
      ]);

      if (profileData) {
        setBranch(profileData);
        localStorage.setItem('branch_info', JSON.stringify(profileData));
      }
      setOrders(ordersData || []);
      setCategories(menuData.categories || []);
      setModifierGroups(menuData.modifierGroups || []);
      if (Array.isArray(ticketsData)) {
        const openCount = ticketsData.filter((t: any) => t.status === 'OPEN').length;
        setOpenComplaintsCount(openCount);
      }
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
      ? getPublicWebUrl()
      : (window.location.port === '5173' || window.location.port === '5174' || window.location.port === '3000')
        ? `http://${window.location.hostname || 'localhost'}:5000`
        : window.location.origin;
    const socket: Socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // استقبال تحديث موقع الطيار الحي على الخريطة وبثه لشاشة استقبال الطلبات
    socket.on('driver_location_updated', (payload: any) => {
      if (payload && payload.driverId && typeof payload.lat === 'number' && typeof payload.lng === 'number') {
        setLiveDriverLocations((prev) => ({
          ...prev,
          [payload.driverId]: {
            lat: payload.lat,
            lng: payload.lng,
            orderId: payload.orderId,
            timestamp: payload.timestamp || Date.now(),
          },
        }));
      }
    });

    const sendAppState = () => {
      const state = typeof document !== 'undefined' && document.visibilityState === 'visible' ? 'foreground' : 'background';
      socket.emit('app_state', { role: 'BRANCH', id: branch.id, state });
    };

    const handleVisibility = () => {
      sendAppState();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    const handleBeforeUnload = () => {
      try {
        if (socket.connected && branch?.id) {
          socket.emit('app_state', { role: 'BRANCH', id: branch.id, state: 'background' });
          socket.disconnect();
        }
      } catch (_e) {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);
    }

    const heartbeatInterval = setInterval(() => {
      if (socket.connected && branch?.id) {
        socket.emit('heartbeat', {
          role: 'BRANCH',
          id: branch.id,
          state: typeof document !== 'undefined' && document.visibilityState === 'visible' ? 'foreground' : 'background'
        });
      }
    }, 4000);

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_branch', branch.id);
      sendAppState();
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
      // 1. نقل شاشة البرنامج للواجهة تلقائياً فوق أي نافذة مفتوحة
      try {
        (window as any).electronAPI?.send?.('bring-to-front');
      } catch (_e) {}

      try {
        window.focus();
      } catch (_e) {}

      // 2. إظهار إشعار ويندوز الأصلي (Native Windows Banner) للظهور فوق أي تطبيق آخر مفتوح
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const title = `🚨 طلب جديد #${newOrder.orderNumber || ''}`;
          const options = {
            body: `المبلغ: ${newOrder.total} ج.م • اضغط هنا لفتح الطلب فوراً في الواجهة`,
            icon: './icon-192.png',
            badge: './icon-192.png',
            dir: 'rtl' as NotificationDirection,
            lang: 'ar',
            requireInteraction: true,
            tag: `order_${newOrder.id}`,
          };

          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, { ...options, data: { url: './', orderId: newOrder.id } }).catch(() => {
                const notif = new Notification(title, options);
                notif.onclick = () => {
                  window.focus();
                  try { (window as any).electronAPI?.send?.('bring-to-front'); } catch (_e) {}
                  setActiveTab('ORDERS');
                  setTargetedDetailedOrder(newOrder);
                  setIsOrderDetailsOpen(true);
                  notif.close();
                };
              });
            }).catch(() => {
              const notif = new Notification(title, options);
              notif.onclick = () => {
                window.focus();
                try { (window as any).electronAPI?.send?.('bring-to-front'); } catch (_e) {}
                setActiveTab('ORDERS');
                setTargetedDetailedOrder(newOrder);
                setIsOrderDetailsOpen(true);
                notif.close();
              };
            });
          } else {
            const notif = new Notification(title, options);
            notif.onclick = () => {
              window.focus();
              try { (window as any).electronAPI?.send?.('bring-to-front'); } catch (_e) {}
              setActiveTab('ORDERS');
              setTargetedDetailedOrder(newOrder);
              setIsOrderDetailsOpen(true);
              notif.close();
            };
          }
        } catch (_e) {}
      }

      // 3. وميض شريط المهام عبر عنوان النافذة (Taskbar Tab Flash)
      try {
        const originalTitle = document.title;
        let flashes = 0;
        const flashTimer = setInterval(() => {
          document.title = flashes % 2 === 0 ? `🚨 طلب جديد #${newOrder.orderNumber || ''}!` : originalTitle;
          flashes++;
          if (flashes > 20) {
            clearInterval(flashTimer);
            document.title = originalTitle;
          }
        }, 700);
      } catch (_e) {}

      // إضافة الطلب في أول القائمة
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      // تشغيل جرس التنبيه المستمر
      soundNotifier.startRepeatingAlarm();

      // الرجوع لشاشة الطلبات الجديدة لمرة واحدة فقط عند وصول الطلب الجديد
      setActiveTab('ORDERS');
      setTargetedDetailedOrder(null);
      setIsOrderDetailsOpen(false);
      setShowQuickStock(false);
      setShowStatusModal(false);
      setShowPrinterSettings(false);
      setDriverRejectionAlert(null);
      setDriverReturnAlert(null);
      setNewOrderTrigger(Date.now());

      // طباعة تلقائية فورية للبون دون أي تدخل يدوي إن كانت مفعلة
      if (getAutoPrintOnNewOrder()) {
        printOrderReceipt(newOrder, branch?.name || 'UniFood');
      }
    });

    // تحديث حالة طلب
    socket.on('order_status_updated', (updatedOrder: any) => {
      setOrders(prev => {
        const existing = prev.find(o => o.id === updatedOrder.id);
        if (
          existing &&
          existing.status !== 'REJECTED' &&
          existing.status !== 'CANCELLED' &&
          (updatedOrder.status === 'REJECTED' || updatedOrder.status === 'CANCELLED')
        ) {
          const isClientCancel =
            !updatedOrder.rejectionReason &&
            String(updatedOrder.notes || '').includes('العميل');
          toast.warning(
            isClientCancel
              ? `⚠️ تم إلغاء طلب #${updatedOrder.orderNumber || ''} من قِبل العميل`
              : `⚠️ تم إلغاء / رفض طلب #${updatedOrder.orderNumber || ''}`
          );
        }
        const next = prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        const hasPending = next.some(o => o.status === 'PENDING');
        if (!hasPending) {
          soundNotifier.stopRepeatingAlarm();
        }
        return next;
      });
      if (updatedOrder.status === 'REJECTED' || updatedOrder.status === 'CANCELLED') {
        setTargetedDetailedOrder((prev: any) => (prev?.id === updatedOrder.id ? null : prev));
        setDriverRejectionAlert((prev) => (prev?.orderId === updatedOrder.id ? null : prev));
      }
    });

    // استلام تنبيه فوري وتشغيل جرس إنذار عند اعتذار/رفض الطيار لاستلام الطلب
    socket.on('driver_rejected_order', (data: any) => {
      if (data?.order) {
        setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
      }
      // تشغيل جرس التنبيه المستمر فوراً لتنبيه الكاشير
      soundNotifier.startRepeatingAlarm();

      // إظهار نافذة التنبيه العاجل
      setDriverRejectionAlert({
        orderNumber: data.orderNumber || data.order?.orderNumber,
        driverName: data.driverName || 'الطيار',
        orderId: data.orderId || data.order?.id,
        order: data.order,
      });
    });

    // استلام تنبيه فوري وتشغيل جرس إنذار عند إرجاع الطيار للطلب إلى الفرع
    socket.on('driver_returned_order', (data: any) => {
      if (data?.order) {
        setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
      }
      // تشغيل جرس التنبيه المستمر فوراً لتنبيه الكاشير والمطبخ
      soundNotifier.startRepeatingAlarm();

      // إظهار نافذة التنبيه العاجل لإرجاع الطلب
      setDriverReturnAlert({
        orderNumber: data.orderNumber || data.order?.orderNumber,
        driverName: data.driverName || 'الطيار',
        orderId: data.orderId || data.order?.id,
        reason: data.reason,
        order: data.order,
      });
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

    // تحديث صوت التنبيه المخصص فورياً عند تغييره من قِبل الإدارة
    socket.on('notification_sound_updated', (soundSettings: any) => {
      if (soundSettings && soundSettings.enabled && soundSettings.soundUrl) {
        soundNotifier.setCustomSound(soundSettings.soundUrl, soundSettings.volume ?? 1.0);
      } else {
        soundNotifier.setCustomSound(null);
      }
    });

    // تحديث عداد الشكاوى الحية لحظياً عند تسجيل شكوى جديدة أو تغيير حالتها
    socket.on('support_ticket_created', (ticket: any) => {
      if (!ticket.branchId || ticket.branchId === branch?.id) {
        setOpenComplaintsCount(prev => prev + 1);
      }
    });

    socket.on('support_ticket_updated', () => {
      api.getSupportTickets().then((list: any[]) => {
        if (Array.isArray(list)) {
          setOpenComplaintsCount(list.filter((t: any) => t.status === 'OPEN').length);
        }
      }).catch(() => {});
    });

    socket.on('support_ticket_deleted', () => {
      api.getSupportTickets().then((list: any[]) => {
        if (Array.isArray(list)) {
          setOpenComplaintsCount(list.filter((t: any) => t.status === 'OPEN').length);
        }
      }).catch(() => {});
    });

    return () => {
      clearInterval(heartbeatInterval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
      }
      socketRef.current = null;
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

  useEffect(() => {
    if (token && branch?.id && typeof window !== 'undefined') {
      try {
        (window as any).AndroidBridge?.registerBackgroundSession?.(token, 'BRANCH', branch.id);
      } catch (_e) {}
    }
  }, [token, branch?.id]);

  const handleLogout = () => {
    try {
      (window as any).AndroidBridge?.clearBackgroundSession?.();
    } catch (_e) {}
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

  const handleClearDetailedOrder = useCallback(() => {
    setTargetedDetailedOrder(null);
  }, []);

  const handleDetailedOrderOpenChange = useCallback((isOpen: boolean) => {
    setIsOrderDetailsOpen(isOpen);
  }, []);

  const handleOptimisticOrderUpdate = useCallback((orderId: string, patch: Record<string, any>) => {
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...patch } : o)));
  }, []);

  if (!token || !branch) {
    return (
      <div onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}>
        <ToastContainer />
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <div 
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }}
      className="min-h-screen w-full max-w-full overflow-x-clip bg-slate-100 flex flex-col font-sans select-none"
    >
      {/* 1. تنبيه تفعيل إشعارات الويندوز الفورية للظهور فوق أي نافذة */}
      {notificationPermission === 'default' && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-3 sm:px-6 py-2 text-xs font-black flex items-center justify-between gap-3 shadow-md border-b border-amber-600 z-50">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0 animate-bounce">🔔</span>
            <span className="truncate">
              تنبيه مهم للكاشير: فعّل إشعارات الويندوز الفورية لتنبيهك ورفع شاشة البرنامج فوق أي تطبيق مفتوح!
            </span>
          </div>
          <button
            onClick={handleRequestNotificationPermission}
            className="bg-white text-amber-800 hover:bg-amber-50 px-3 py-1 rounded-lg font-black text-xs shrink-0 shadow transition-transform active:scale-95 cursor-pointer"
          >
            تفعيل التنبيهات الآن ⚡
          </button>
        </div>
      )}

      {/* 2. شريط التحويل لملء الشاشة الكامل (Full Screen) مثل الصورة رقم 2 */}
      {!isFullscreen && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-3 sm:px-6 py-1.5 text-xs font-bold flex items-center justify-between gap-2 border-b border-indigo-700/50 z-50">
          <div className="flex items-center gap-2 min-w-0">
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
            <span className="truncate text-slate-200">
              لتكبير الشاشة بالكامل وإخفاء شريط العنوان وشريط المهام (مثل صورة POS 2):
            </span>
          </div>
          <button
            onClick={toggleFullScreen}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg font-black text-[11px] shrink-0 transition-transform active:scale-95 flex items-center gap-1.5 shadow-sm border border-indigo-400/40 cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>عرض ملء الشاشة الكامل ⛶</span>
          </button>
        </div>
      )}

      {/* Top Application Header (Two-tier responsive layout) */}
      <header 
        onDoubleClick={toggleFullScreen}
        title="انقر نقراً مزدوجاً لتبديل وضع ملء الشاشة"
        className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm w-full select-none cursor-default"
      >
        {/* Tier 1: Brand Identity & Quick Operational Actions */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Top/Right on mobile: Branch identity + Mobile Status Pill */}
          <div className="flex items-center justify-between min-w-0 w-full md:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Logo size="sm" showSubtitle={false} />
              <div className="h-6 sm:h-7 w-px bg-slate-200 shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xs sm:text-base font-black text-slate-900 leading-tight truncate" title={branch.name}>
                  {branch.name}
                </h1>
                <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 whitespace-nowrap">
                  {socketConnected ? (
                    <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>متصل لحظياً</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>جاري الاتصال...</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Pill right in row 1 on mobile */}
            <button
              onClick={() => setShowStatusModal(true)}
              className={`md:hidden h-8 px-2.5 rounded-xl text-[11px] font-black transition-all border shadow-2xs flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                branch.operationalStatus === 'OPEN' || !branch.operationalStatus
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : branch.operationalStatus === 'BUSY'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/40'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  branch.operationalStatus === 'OPEN' || !branch.operationalStatus
                    ? 'bg-emerald-500 animate-pulse'
                    : branch.operationalStatus === 'BUSY'
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-rose-500'
                }`}
              />
              <span>
                {branch.operationalStatus === 'OPEN' || !branch.operationalStatus ? 'المطعم مفتوح' : ''}
                {branch.operationalStatus === 'BUSY' ? `مغلق (${formatCountdown(secondsLeft)})` : ''}
                {branch.operationalStatus === 'CLOSED' ? 'المطعم مغلق' : ''}
              </span>
            </button>
          </div>

          {/* Tools Row (on desktop: inline, on mobile: neat second row) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0 justify-between md:justify-end w-full md:w-auto">
            {/* Quick Stock Toggle Button */}
            <button
              onClick={() => setShowQuickStock(true)}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="إيقاف وتشغيل الأصناف والإضافات فوراً"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>توفر الأصناف</span>
              {(() => {
                const outCount =
                  categories.filter((cat) => cat.isAvailable === false).length +
                  categories.reduce((acc, cat) => acc + (cat.items || []).filter((i: any) => !i.isAvailable).length, 0) +
                  modifierGroups.reduce((acc, g) => acc + (g.options || []).filter((o: any) => !o.isAvailable).length, 0);
                return outCount > 0 ? (
                  <span className="font-mono bg-rose-600 text-white px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                    {outCount} نفد
                  </span>
                ) : null;
              })()}
            </button>

            {/* Desktop Status Badge Button */}
            <button
              onClick={() => setShowStatusModal(true)}
              className={`hidden md:flex h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-black transition-all border shadow-sm items-center gap-2 whitespace-nowrap shrink-0 ${
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

            {/* Install on Windows / Mobile PWA Button (auto-hides once installed) */}
            <InstallAppButton variant="header" />

            {/* Printer Settings Button */}
            <button
              onClick={() => setShowPrinterSettings(true)}
              className="h-8 sm:h-9 px-2 sm:px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
              title="إعدادات واختيار الطابعة الحرارية وتثبيتها والطباعة الصامتة"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">الطابعة</span>
              {getAutoPrintOnNewOrder() && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="الطباعة الفورية مفعلة" />
              )}
            </button>

            {/* Sound Mute/Unmute */}
            <button
              onClick={handleToggleMute}
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 shadow-2xs ${
                isMuted
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={isMuted ? 'الصوت مكتوم - اضغط للتشغيل' : 'الصوت مفعل - اضغط لكتم التنبيهات'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullScreen}
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 shadow-2xs ${
                isFullscreen
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-indigo-600'
              }`}
              title={isFullscreen ? 'الخروج من وضع ملء الشاشة' : 'تشغيل وضع ملء الشاشة الكامل (Full Screen ⛶)'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="h-8 w-8 sm:h-9 sm:w-9 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-2xs"
              title="تحديث البيانات"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 shadow-2xs"
              title="تسجيل الخروج من هذا الفرع"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Navigation Tabs Bar (Desktop / Large Screens only) */}
        <div className="hidden md:block border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6 py-2">
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
              onClick={() => setActiveTab('SUPPORT')}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 relative ${
                activeTab === 'SUPPORT'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              <LifeBuoy className="w-4 h-4 shrink-0" />
              <span>شكاوى وبلاغات العملاء</span>
              {openComplaintsCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {openComplaintsCount}
                </span>
              )}
            </button>

            <button
              onClick={handleOpenProfileTab}
              className={`h-9 sm:h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'PROFILE'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-indigo-700 border border-slate-200/80'
              }`}
            >
              {branch?.hasSettingsPassword && !isSettingsUnlocked ? (
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <UserCheck className="w-4 h-4 shrink-0" />
              )}
              <span>بيانات الفرع والدفع</span>
              {branch?.hasSettingsPassword && !isSettingsUnlocked && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="محمية بكلمة مرور"></span>
              )}
            </button>
          </nav>
        </div>
      </header>

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
      <main className={`flex-1 max-w-7xl w-full mx-auto ${
        isOrderDetailsOpen || targetedDetailedOrder
          ? 'px-3 sm:px-6 pt-2.5 sm:pt-3.5 pb-2 md:pb-4'
          : 'p-3 sm:p-6 pb-28 md:pb-8'
      }`}>
        {activeTab === 'ORDERS' && (
          <OrdersView
            orders={orders}
            branchName={branch.name}
            branch={branch}
            socket={socketRef.current}
            liveDriverLocations={liveDriverLocations}
            onRefreshOrders={loadData}
            onOptimisticOrderUpdate={handleOptimisticOrderUpdate}
            initialDetailedOrder={targetedDetailedOrder}
            onClearDetailedOrder={handleClearDetailedOrder}
            onDetailedOrderOpenChange={handleDetailedOrderOpenChange}
            newOrderTrigger={newOrderTrigger}
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
          <DriversManager socket={socketRef.current} />
        )}

        {activeTab === 'SUPPORT' && (
          <BranchSupportView socket={socketRef.current} branchId={branch?.id} />
        )}

        {activeTab === 'PROFILE' && (
          <BranchProfileView 
            branch={branch}
            onUpdateBranch={(updated) => {
              setBranch(updated);
              localStorage.setItem('branch_info', JSON.stringify(updated));
            }}
            onLockSettings={() => {
              setIsSettingsUnlocked(false);
              setActiveTab('ORDERS');
              toast.info('تم قفل لوحة التحكمات والإعدادات 🔒');
            }}
          />
        )}
      </main>

      {/* Bottom Navigation Bar (Floating Island Dock on mobile / tablet) */}
      <nav 
        aria-label="شريط التنقل السفلي"
        className={`fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-40 bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_12px_36px_rgba(15,23,42,0.14)] rounded-3xl p-1.5 md:hidden transition-all duration-300 ${
          showQuickStock || showStatusModal || showPrinterSettings || targetedDetailedOrder || isOrderDetailsOpen || driverRejectionAlert
            ? 'opacity-0 pointer-events-none translate-y-8'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="grid grid-cols-6 gap-0.5 items-center">
          {/* 1. الطلبات */}
          <button
            type="button"
            onClick={() => setActiveTab('ORDERS')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 ${
              activeTab === 'ORDERS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-bold'
            }`}
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 shrink-0" />
              {pendingCount > 0 && (
                <span className={`absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center leading-none ring-2 ${
                  activeTab === 'ORDERS' ? 'bg-amber-400 text-amber-950 ring-indigo-600 animate-bounce' : 'bg-rose-500 text-white ring-white animate-pulse'
                }`}>
                  {pendingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] leading-tight mt-1 whitespace-nowrap">الطلبات</span>
          </button>

          {/* 2. المنيو */}
          <button
            type="button"
            onClick={() => setActiveTab('MENU')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 ${
              activeTab === 'MENU'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-bold'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] leading-tight mt-1 whitespace-nowrap">المنيو</span>
          </button>

          {/* 3. الإضافات */}
          <button
            type="button"
            onClick={() => setActiveTab('MODIFIERS')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 ${
              activeTab === 'MODIFIERS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-bold'
            }`}
          >
            <Sliders className="w-5 h-5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] leading-tight mt-1 whitespace-nowrap">الإضافات</span>
          </button>

          {/* 4. الطيارين */}
          <button
            type="button"
            onClick={() => setActiveTab('DRIVERS')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 ${
              activeTab === 'DRIVERS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-bold'
            }`}
          >
            <Truck className="w-5 h-5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] leading-tight mt-1 whitespace-nowrap">الطيارين</span>
          </button>

          {/* 5. الشكاوى */}
          <button
            type="button"
            onClick={() => setActiveTab('SUPPORT')}
            className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-2xl transition-all duration-200 relative active:scale-95 ${
              activeTab === 'SUPPORT'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-bold'
            }`}
          >
            <div className="relative">
              <LifeBuoy className="w-5 h-5 shrink-0" />
              {openComplaintsCount > 0 && (
                <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] font-black flex items-center justify-center leading-none ring-2 ${
                  activeTab === 'SUPPORT' ? 'bg-amber-400 text-amber-950 ring-indigo-600 animate-bounce' : 'bg-rose-500 text-white ring-white animate-pulse'
                }`}>
                  {openComplaintsCount}
                </span>
              )}
            </div>
            <span className="text-[9px] sm:text-[10px] leading-tight mt-1 whitespace-nowrap">الشكاوى</span>
          </button>

          {/* 6. الفرع */}
          <button
            type="button"
            onClick={handleOpenProfileTab}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 ${
              activeTab === 'PROFILE'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-bold'
            }`}
          >
            {branch?.hasSettingsPassword && !isSettingsUnlocked ? (
              <Lock className="w-5 h-5 shrink-0 text-amber-500" />
            ) : (
              <Store className="w-5 h-5 shrink-0" />
            )}
            <span className="text-[10px] sm:text-[11px] leading-tight mt-1 whitespace-nowrap">الفرع</span>
          </button>
        </div>
      </nav>

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

      {/* Driver Rejection Urgent Alert Dialog */}
      {driverRejectionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border-2 border-rose-500 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border-2 border-rose-300 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-black text-rose-600 uppercase tracking-wider block mb-1">
                ⚠️ إنذار عاجل: اعتذار كابتن التوصيل
              </span>
              <h3 className="font-black text-lg text-slate-900">
                الطيار اعتذر عن طلب #{driverRejectionAlert.orderNumber}
              </h3>
              <p className="text-xs text-slate-600 font-bold mt-2 leading-relaxed">
                قام الكابتن <span className="text-rose-600 font-black">"{driverRejectionAlert.driverName}"</span> بالاعتذار عن استلام وتوصيل هذا الطلب. الطلب الآن بانتظار إسناده لطيار آخر فوراً لتجنب تأخير العميل!
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundNotifier.stopRepeatingAlarm();
                  setActiveTab('ORDERS');
                  const target = orders.find(o => o.id === driverRejectionAlert.orderId) || driverRejectionAlert.order;
                  setTargetedDetailedOrder(target || null);
                  setDriverRejectionAlert(null);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>فتح الطلب الآن لإسناد طيار بديل</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundNotifier.stopRepeatingAlarm();
                  setDriverRejectionAlert(null);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-colors"
              >
                إيقاف الإنذار الصوتي وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Return Order Alert Dialog */}
      {driverReturnAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border-2 border-amber-500 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto border-2 border-amber-300 animate-bounce">
              <RotateCcw className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-black text-amber-600 uppercase tracking-wider block mb-1">
                ⚠️ إرجاع وجبة: قام الطيار بإرجاع الطلب للفرع
              </span>
              <h3 className="font-black text-lg text-slate-900">
                تم استلام وجبة طلب #{driverReturnAlert.orderNumber} بالفرع
              </h3>
              <p className="text-xs text-slate-600 font-bold mt-2 leading-relaxed">
                قام الكابتن <span className="text-amber-600 font-black">"{driverReturnAlert.driverName}"</span> بإرجاع هذا الطلب وتأكيده برمز الفرع. الطلب عاد لحالة (جاهز) بالمطبخ ويمكن إسناده لطيار آخر.
              </p>
              {driverReturnAlert.reason && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 font-semibold text-right">
                  <span className="font-black text-amber-950">سبب الإرجاع: </span>
                  {driverReturnAlert.reason}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundNotifier.stopRepeatingAlarm();
                  setActiveTab('ORDERS');
                  const target = orders.find(o => o.id === driverReturnAlert.orderId) || driverReturnAlert.order;
                  setTargetedDetailedOrder(target || null);
                  setDriverReturnAlert(null);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>فتح تفاصيل الطلب لإعادة التعيين</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundNotifier.stopRepeatingAlarm();
                  setDriverReturnAlert(null);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-colors"
              >
                إيقاف الإنذار الصوتي وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إدخال كلمة مرور قفل الإعدادات والتحكمات */}
      {showSettingsLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp">
            <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">لوحة التحكمات محمية 🔒</h3>
                  <p className="text-[10px] text-slate-500">أدخل كلمة المرور المحددة من الإدارة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsLockModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifySettingsPin} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-right">
                <span className="text-[11px] text-amber-900 font-bold block leading-relaxed">
                  🔐 شاشة «بيانات الفرع والدفع والتحكمات» مقفلة لحمايتها من التعديلات غير المصرح بها.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور / الرمز السري:</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showSettingsPasswordText ? "text" : "password"}
                    autoFocus
                    value={settingsInputPassword}
                    onChange={e => {
                      setSettingsInputPassword(e.target.value);
                      if (settingsPinError) setSettingsPinError(null);
                    }}
                    placeholder="أدخل كلمة المرور..."
                    className="w-full pr-9 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSettingsPasswordText(!showSettingsPasswordText)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showSettingsPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {settingsPinError && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1 animate-fadeIn">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{settingsPinError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSettingsLockModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={verifyingSettingsPin}
                  className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {verifyingSettingsPin ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>فتح اللوحة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global In-App Notifications Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default App;
