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
  Check,
  CheckCheck,
  CheckCircle2,
  Wallet,
  Sparkles,
  Radio,
  Navigation,
  RotateCcw,
  ChevronLeft
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { registerServiceWorker, requestPushPermission, sendWebNotification, isRunningInNativeApk, triggerInstallApp, openExternalLink, registerNativeBackgroundSession, clearNativeBackgroundSession } from '../services/notifications';
import { cleanAddressText, getDisplayAddress, getNearestLocationName, extractCoordinatesFromAddress, getStoredRestaurantCoords, setStoredRestaurantCoords } from '../services/campusLocations';
import { DriverRouteMap } from './DriverRouteMap';

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

  // Return order to branch PIN dialog
  const [returningOrder, setReturningOrder] = useState<any | null>(null);
  const [returnPin, setReturnPin] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnLoading, setReturnLoading] = useState(false);

  // Custom Confirmation Dialog & Toast States
  const [driverConfirmDialog, setDriverConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('driver_muted') === 'true';
  });
  const [driverTab, setDriverTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [customSoundUrl, setCustomSoundUrl] = useState<string | null>(null);
  const [customVolume, setCustomVolume] = useState<number>(1.0);

  // Live GPS Tracking states
  const socketRef = useRef<Socket | null>(null);
  const [gpsBroadcasting, setGpsBroadcasting] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [driverLocationName, setDriverLocationName] = useState<string>('');
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number }>(() =>
    getStoredRestaurantCoords()
  );

  useEffect(() => {
    if (!currentCoords) {
      setDriverLocationName('');
      return;
    }
    let isMounted = true;
    getNearestLocationName(currentCoords.lat, currentCoords.lng)
      .then((res) => {
        if (isMounted && res) {
          setDriverLocationName(res.title || res.details || 'موقعي الحالي');
        }
      })
      .catch(() => {
        if (isMounted) {
          setDriverLocationName('محدد بدقة عبر الـ GPS 🛰️');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentCoords?.lat, currentCoords?.lng]);

  useEffect(() => {
    api.getPublicRestaurantLocation()
      .then((res) => {
        if (res && typeof res.lat === 'number' && typeof res.lng === 'number') {
          setRestaurantCoords({ lat: res.lat, lng: res.lng });
          setStoredRestaurantCoords({ lat: res.lat, lng: res.lng });
        }
      })
      .catch(() => {});
  }, []);

  const getOrderRestaurantCoords = (order: any): { lat: number; lng: number } => {
    if (order?.branch?.address) {
      const fromBranch = extractCoordinatesFromAddress(order.branch.address);
      if (fromBranch) return fromBranch;
    }
    return restaurantCoords;
  };

  const getOrderCustomerCoords = (order: any): { lat: number; lng: number } => {
    const fromAddr = extractCoordinatesFromAddress(order?.addressText);
    if (fromAddr) return fromAddr;
    const fromZone = extractCoordinatesFromAddress(order?.deliveryZoneName);
    if (fromZone) return fromZone;
    return { lat: 30.0275, lng: 31.2110 };
  };

  const getEffectiveDriverCoords = (order: any, isPickedUp: boolean): { lat: number; lng: number } => {
    if (currentCoords) return currentCoords;
    const restCoords = getOrderRestaurantCoords(order);
    if (isPickedUp) {
      return restCoords;
    }
    return { lat: restCoords.lat + 0.0022, lng: restCoords.lng - 0.0022 };
  };

  const handleBroadcastRealLocation = () => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentCoords({ lat, lng });
          setGpsBroadcasting(true);
          const activeOrder = selectedOrder || orders.find(o => o.status !== 'COMPLETED' && o.status !== 'REJECTED' && o.status !== 'CANCELLED');
          socketRef.current?.emit('driver_location_update', {
            driverId: driver?.id,
            lat,
            lng,
            orderId: activeOrder?.id,
          });
          showToast('تم بث وتحديث موقعك الفعلي بنجاح 🛰️', 'success');
        },
        (_err) => {
          handleSimulateOrSendLocation();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      handleSimulateOrSendLocation();
    }
  };

  const handleSimulateOrSendLocation = (manualLat?: number, manualLng?: number) => {
    const activeOrder = selectedOrder || orders.find(o => o.status !== 'COMPLETED' && o.status !== 'REJECTED' && o.status !== 'CANCELLED');
    const lat = manualLat || (currentCoords ? currentCoords.lat + (Math.random() - 0.5) * 0.001 : 30.0268);
    const lng = manualLng || (currentCoords ? currentCoords.lng + (Math.random() - 0.5) * 0.001 : 31.2090);
    setCurrentCoords({ lat, lng });
    setGpsBroadcasting(true);
    socketRef.current?.emit('driver_location_update', {
      driverId: driver?.id,
      lat,
      lng,
      orderId: activeOrder?.id,
    });
    showToast('تم بث وتحديث موقعك على خريطة العميل بنجاح 🛰️', 'success');
  };
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<any>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const [showDriverExitDialog, setShowDriverExitDialog] = useState(false);

  // قفل تمرير الشاشة الخلفية تلقائياً عند فتح أي نافذة منبثقة للطيار (Universal Scroll Lock)
  const isDriverModalOpen = Boolean(selectedOrder || deliveringOrder || returningOrder || driverConfirmDialog || showDriverExitDialog);

  useEffect(() => {
    // Clear any previous documentElement lock to ensure smooth scrolling
    if (document.documentElement.style.overflow) {
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    }

    if (isDriverModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isDriverModalOpen]);

  // إدارة زر الرجوع في الهاتف للطيار (Android Back Button Handling)
  const isHandlingDriverPopstateRef = useRef(false);
  const driverHistoryDepthRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.history.replaceState({ uniFoodDriverRoot: true }, '');
      window.history.pushState({ uniFoodDriverStep: 1 }, '');
      driverHistoryDepthRef.current = 1;
    } catch (_e) {}
  }, []);

  const driverNavCount = [
    driverTab !== 'ACTIVE',
    Boolean(showDriverExitDialog),
    Boolean(selectedOrder),
    Boolean(deliveringOrder),
    Boolean(driverConfirmDialog)
  ].filter(Boolean).length;

  const prevDriverNavCountRef = useRef(0);

  useEffect(() => {
    if (isHandlingDriverPopstateRef.current) return;
    if (driverNavCount > prevDriverNavCountRef.current) {
      try {
        window.history.pushState({ uniFoodDriverStep: driverHistoryDepthRef.current + 1 }, '');
        driverHistoryDepthRef.current += 1;
      } catch (_e) {}
    }
    prevDriverNavCountRef.current = driverNavCount;
  }, [driverNavCount]);

  useEffect(() => {
    const handleDriverPopState = () => {
      isHandlingDriverPopstateRef.current = true;
      driverHistoryDepthRef.current = Math.max(0, driverHistoryDepthRef.current - 1);

      // أولاً: إذا كانت نافذة تأكيد الخروج مفتوحة
      if (showDriverExitDialog) {
        setShowDriverExitDialog(false);
      }
      // ثانياً: إغلاق الموديلات المنبثقة
      else if (deliveringOrder) {
        setDeliveringOrder(null);
      } else if (selectedOrder) {
        setSelectedOrder(null);
      } else if (driverConfirmDialog) {
        setDriverConfirmDialog(null);
      }
      // ثالثاً: إذا كان في تبويب الأرشيف/السجل -> الرجوع لتبويب الطلبات الجارية
      else if (driverTab === 'HISTORY') {
        setDriverTab('ACTIVE');
      }
      // رابعاً: في الشاشة الرئيسية للطيار -> إظهار تأكيد الخروج
      else {
        try {
          window.history.pushState({ uniFoodDriverStep: 1 }, '');
          driverHistoryDepthRef.current = 1;
        } catch (_e) {}
        setShowDriverExitDialog(true);
      }

      setTimeout(() => {
        isHandlingDriverPopstateRef.current = false;
        prevDriverNavCountRef.current = [
          driverTab !== 'ACTIVE',
          Boolean(showDriverExitDialog),
          Boolean(selectedOrder),
          Boolean(deliveringOrder),
          Boolean(driverConfirmDialog)
        ].filter(Boolean).length;
      }, 50);
    };

    window.addEventListener('popstate', handleDriverPopState);
    return () => window.removeEventListener('popstate', handleDriverPopState);
  }, [
    showDriverExitDialog,
    deliveringOrder,
    selectedOrder,
    driverConfirmDialog,
    driverTab
  ]);

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
    if (isMuted) return;

    if (customSoundUrl) {
      try {
        const fullUrl = customSoundUrl.startsWith('http')
          ? customSoundUrl
          : `${API_BASE_URL.replace('/api', '')}${customSoundUrl.startsWith('/') ? '' : '/'}${customSoundUrl}`;
        const audio = new Audio(fullUrl);
        audio.volume = customVolume;
        audio.loop = true;
        activeAudioRef.current = audio;
        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => {
            playSyntheticLoop();
          });
        }
        return;
      } catch (_e) {}
    }

    playSyntheticLoop();
  };

  const playSyntheticLoop = () => {
    playSyntheticBeep();
    alarmIntervalRef.current = setInterval(() => {
      playSyntheticBeep();
    }, 2500);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (_e) {}
      activeAudioRef.current = null;
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
    if (token && driver?.id) {
      registerNativeBackgroundSession(token, 'DRIVER', driver.id);
    }
    return () => stopAlarm();
  }, [token, driver?.id]);

  // Quick In-App Status Messages per Order (Driver <-> Student)
  const [quickMessagesByOrder, setQuickMessagesByOrder] = useState<Record<string, any[]>>({});
  const [driverCustomQuickText, setDriverCustomQuickText] = useState('');

  const handleSendDriverQuickMessage = (orderObj: any, text: string) => {
    const clean = text.trim();
    if (!clean || !orderObj?.id || !socketRef.current) return;
    socketRef.current.emit('send_order_quick_message', {
      orderId: orderObj.id,
      text: clean,
      senderName: driver?.name || 'كابتن التوصيل',
      userId: orderObj.userId,
      driverId: driver?.id,
      branchId: orderObj.branchId,
    });
    setDriverCustomQuickText('');
    showToast(`✅ تم إرسال للعميل: "${clean}"`, 'success');
  };

  useEffect(() => {
    if (selectedOrder?.id && socketRef.current) {
      socketRef.current.emit('join_order', selectedOrder.id);
      socketRef.current.emit('get_order_quick_messages', selectedOrder.id);
    }
  }, [selectedOrder?.id]);

  // Socket setup for driver room with Token Auth
  useEffect(() => {
    if (!driver?.id || !token) return;

    const socketHost = API_BASE_URL.replace('/api', '');
    const socket: Socket = io(socketHost, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const sendAppState = () => {
      const state = typeof document !== 'undefined' && document.visibilityState === 'visible' ? 'foreground' : 'background';
      socket.emit('app_state', { role: 'DRIVER', id: driver.id, state });
    };

    const handleVisibility = () => {
      sendAppState();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    socket.on('connect', () => {
      socket.emit('join_driver', driver.id);
      sendAppState();
      registerNativeBackgroundSession(token, 'DRIVER', driver.id);
    });

    socket.on('new_order_assigned', (order: any) => {
      startRepeatingAlarm();
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      sendWebNotification(
        `🛵 طلب توصيل جديد مسند لك #${order.orderNumber || ''}!`,
        `العميل: ${order.customerName || 'عميل'} • العنوان: ${order.addressText || ''}`,
        '/delivery',
        `order_${order.orderNumber || order.id}`
      );
    });

    socket.on('order_status_updated', (updated: any) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
      );
      setSelectedOrder((prev: any) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    });

    socket.on('order_unassigned', ({ orderId }: { orderId: string }) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelectedOrder((prev: any) => (prev && prev.id === orderId ? null : prev));
      setReturningOrder((prev: any) => (prev && prev.id === orderId ? null : prev));
      setDeliveringOrder((prev: any) => (prev && prev.id === orderId ? null : prev));
      showToast('تم إلغاء إسناد الطلب وإعادته للفرع', 'info');
    });

    socket.on('order_quick_messages_history', (payload: { orderId: string; messages: any[] }) => {
      if (payload?.orderId && Array.isArray(payload.messages)) {
        setQuickMessagesByOrder((prev) => ({
          ...prev,
          [payload.orderId]: payload.messages,
        }));
      }
    });

    socket.on('order_quick_message', (msg: any) => {
      if (!msg?.orderId) return;
      setQuickMessagesByOrder((prev) => {
        const list = prev[msg.orderId] || [];
        if (list.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          [msg.orderId]: [...list, msg],
        };
      });
      if (msg.senderRole === 'STUDENT' || msg.senderRole === 'CUSTOMER') {
        playAlertSound();
        showToast(`💬 رسالة من العميل (${msg.senderName}): ${msg.text}`, 'info');
        sendWebNotification(
          `💬 رسالة سريعة من العميل (${msg.senderName})`,
          msg.text,
          '/delivery',
          `chat_${msg.orderNumber || msg.orderId}`
        );
      }
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

    socket.on('restaurant_location_updated', (loc: { lat: number; lng: number }) => {
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        setRestaurantCoords({ lat: loc.lat, lng: loc.lng });
        setStoredRestaurantCoords({ lat: loc.lat, lng: loc.lng });
      }
    });

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [driver?.id, token]);

  // مراقبة وبث موقع الطيار عبر الـ GPS الحي للطلبات والعملاء والفرع
  useEffect(() => {
    if (!driver?.id || !token) return;

    setGpsBroadcasting(true);

    const activeOrder = orders.find(
      (o) => o.status !== 'COMPLETED' && o.status !== 'REJECTED' && o.status !== 'CANCELLED'
    );

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const handleLocationSuccess = (pos: GeolocationPosition) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });
        socketRef.current?.emit('driver_location_update', {
          driverId: driver.id,
          orderId: activeOrder?.id,
          lat,
          lng,
        });
      };

      navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        () => {
          navigator.geolocation.getCurrentPosition(
            handleLocationSuccess,
            () => {},
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );

      watchId = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        () => {},
        { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
      );
    }

    return () => {
      if (watchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [driver?.id, token, orders]);

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
    clearNativeBackgroundSession();
    localStorage.removeItem('driver_token');
    localStorage.removeItem('driver_info');
    setToken(null);
    setDriver(null);
    setOrders([]);
    stopAlarm();
  };

  const confirmLogout = () => {
    setDriverConfirmDialog({
      isOpen: true,
      title: 'تسجيل الخروج وإنهاء الوردية',
      message: 'هل أنت متأكد من تسجيل الخروج من حساب الكابتن وإنهاء وردية التوصيل الحالية؟',
      confirmText: 'نعم، تسجيل الخروج',
      cancelText: 'إلغاء واستمرار',
      isDanger: true,
      onConfirm: () => {
        handleLogout();
        showToast('تم تسجيل الخروج بنجاح 👋', 'info');
      },
    });
  };

  const toggleMute = () => {
    if (!isMuted) {
      setIsMuted(true);
      localStorage.setItem('driver_muted', 'true');
      stopAlarm();
      showToast('تم كتم صوت التنبيهات 🔕', 'info');
    } else {
      setIsMuted(false);
      localStorage.setItem('driver_muted', 'false');
      playAlertSound();
      showToast('تم تفعيل صوت التنبيهات 🔔', 'success');
    }
  };

  // Accept order
  const handleAccept = async (orderId: string) => {
    try {
      await api.driverAcceptOrder(orderId);
      stopAlarm();
      showToast('تم قبول الطلب بنجاح! ظهرت لك خريطة الطريق إلى المطعم 🏪🚀', 'success');
      setOrders((prev: any[]) => prev.map(o => o.id === orderId ? { ...o, isDriverAccepted: true } : o));
      setSelectedOrder((prev: any) => (prev && prev.id === orderId ? { ...prev, isDriverAccepted: true } : prev));
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }
    } catch (err: any) {
      showToast(err.message || 'فشل قبول الطلب', 'error');
    }
  };

  // Reject order (only before pickup)
  const handleReject = (order: any) => {
    const orderNumber = order?.orderNumber || order?.id?.slice(0, 5) || '';
    const branchName = order?.branch?.name || 'المطعم';
    setDriverConfirmDialog({
      isOpen: true,
      title: 'الاعتذار عن توصيل الطلب',
      message: `هل أنت متأكد من الاعتذار عن توصيل الطلب #${orderNumber} القادم من مطعم "${branchName}"؟\nسيعاد الطلب للمطعم لإسناده لكابتن آخر فوراً.`,
      confirmText: 'نعم، اعتذر عن الطلب',
      cancelText: 'تراجع واستمرار',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.driverRejectOrder(order.id, 'اعتذار من الطيار');
          stopAlarm();
          loadDriverData();
          if (selectedOrder?.id === order.id) {
            setSelectedOrder(null);
          }
          showToast('تم الاعتذار عن توصيل الطلب بنجاح', 'info');
        } catch (err: any) {
          showToast(err.message || 'فشل الاعتذار عن الطلب', 'error');
        }
      },
    });
  };

  // Pickup order from branch
  const handlePickup = (order: any) => {
    const branchName = order?.branch?.name || 'المطعم';
    const applyPickedUpState = () => {
      const nowIso = new Date().toISOString();
      setOrders((prev: any[]) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, driverPickedUpAt: nowIso, isDriverAccepted: true } : o
        )
      );
      setSelectedOrder((prev: any) =>
        prev && prev.id === order.id
          ? { ...prev, driverPickedUpAt: nowIso, isDriverAccepted: true }
          : prev
      );
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }
    };

    if (order.status !== 'READY') {
      setDriverConfirmDialog({
        isOpen: true,
        title: 'استلام الطلب قبل اكتمال التحضير',
        message: `تنبيه: الأوردر #${order.orderNumber} ما زال قيد التجهيز في مطبخ "${branchName}" ولم يحدد المطعم بعد أنه جاهز للاستلام.\nهل استلمت الوجبة بالفعل من الفرع وتريد بدء التوصيل للعميل الآن؟`,
        confirmText: 'نعم، استلمت وبدء التوصيل',
        cancelText: 'انتظار اكتمال التحضير',
        isDanger: false,
        onConfirm: async () => {
          try {
            await api.driverPickupOrder(order.id);
            stopAlarm();
            applyPickedUpState();
            loadDriverData();
            showToast('تم تأكيد الاستلام! تحولت الخريطة الآن لموقع العميل 🛵📍', 'success');
          } catch (err: any) {
            showToast(err.message || 'فشل تأكيد الاستلام من الفرع', 'error');
          }
        },
      });
      return;
    }

    // Direct pickup if already READY
    (async () => {
      try {
        await api.driverPickupOrder(order.id);
        stopAlarm();
        applyPickedUpState();
        loadDriverData();
        showToast('تم تأكيد الاستلام! تحولت الخريطة الآن لموقع العميل 🛵📍', 'success');
      } catch (err: any) {
        showToast(err.message || 'فشل تأكيد الاستلام من الفرع', 'error');
      }
    })();
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
      setPinError(err.message || 'رمز PIN غير مطابق! تأكد من العميل.');
    } finally {
      setDeliveringLoading(false);
    }
  };

  // Confirm returning order to branch with branch PIN
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningOrder || !returnPin.trim()) {
      setReturnError('يرجى إدخال رمز الاستلام (PIN) المكون من 4 أرقام');
      return;
    }

    try {
      setReturnLoading(true);
      setReturnError(null);
      await api.driverReturnOrder(returningOrder.id, returnPin.trim(), returnReason.trim() || undefined);
      showToast('تم إرجاع الوجبة للمطعم وإلغاء الطلب من عليك بنجاح ✅', 'success');
      setReturningOrder(null);
      setReturnPin('');
      setReturnReason('');
      loadDriverData();
      if (selectedOrder?.id === returningOrder.id) {
        setSelectedOrder(null);
      }
    } catch (err: any) {
      setReturnError(err.message || 'رمز الاستلام غير صحيح! يرجى مراجعة موظف الفرع');
    } finally {
      setReturnLoading(false);
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
            <p className="text-xs text-slate-500">سجل دخولك لمتابعة واستلام وتوصيل طلبات المطاعم</p>
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
              العودة لتطبيق العملاء
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Driver Header - تصميم داكن عصري وأنيق بدون زحام أزرار */}
      <header className="bg-slate-900/95 backdrop-blur-md text-white sticky top-0 z-40 px-3.5 sm:px-6 py-3 shadow-lg border-b border-slate-800">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* Driver identity & status */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-black shrink-0 shadow-md shadow-indigo-600/30 text-white">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black leading-tight truncate">
                  كابتن: {driver.name}
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="متصل بالخدمة" />
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                <span className="font-mono truncate" dir="ltr">
                  @{driver.username}
                </span>
                <span>•</span>
                <span className="font-mono truncate" dir="ltr">
                  {driver.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Action buttons (3 compact buttons only: Smart Audio Toggle, Refresh, Safe Logout) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Unified Smart Audio Toggle with preview on enable */}
            <button
              type="button"
              onClick={toggleMute}
              className={`h-9 px-2.5 sm:px-3 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95 ${
                isMuted
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
              title={isMuted ? 'الصوت مكتوم - اضغط للتشغيل' : 'الصوت مفعّل - اضغط للكتم'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="hidden sm:inline">الصوت مكتوم</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">الصوت مفعّل</span>
                </>
              )}
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => {
                loadDriverData();
                showToast('تم تحديث قائمة الطلبات 🔄', 'info');
              }}
              disabled={loadingOrders}
              className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl transition-all shrink-0 active:scale-95 disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RotateCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
            </button>

            {/* Safe Logout with Confirmation Dialog */}
            <button
              type="button"
              onClick={confirmLogout}
              className="w-9 h-9 flex items-center justify-center bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl transition-all shrink-0 active:scale-95"
              title="تسجيل خروج وإنهاء الوردية"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-3.5 sm:p-5 max-w-3xl w-full mx-auto space-y-4">
        {/* Urgent Ringing Alarm Banner */}
        {alarmIntervalRef.current && (
          <div className="bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 text-white p-3.5 rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-pulse border border-rose-400">
            <div className="flex items-center gap-2.5 min-w-0">
              <BellRing className="w-5 h-5 text-white animate-bounce shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black truncate">🔔 طلب توصيل جديد بانتظار قبولك!</p>
                <p className="text-[10px] text-white/90 truncate">يرجى مراجعة تفاصيل الطلب وقبوله سريعاً للتوجه للمطعم</p>
              </div>
            </div>
            <button
              onClick={stopAlarm}
              className="px-3.5 py-1.5 bg-white text-rose-700 hover:bg-rose-50 font-black rounded-xl text-xs shrink-0 shadow-sm transition-all active:scale-95"
            >
              كتم الرنين
            </button>
          </div>
        )}

        {/* Live GPS Broadcast Status Banner */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 rounded-2xl border border-emerald-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800">بث الـ GPS المباشر للخرائط والعملاء</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {gpsBroadcasting ? 'بث نشط 🛰️' : 'بانتظار الإشارة ⏳'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                {currentCoords ? (
                  <span>
                    <strong className="text-slate-800 font-bold">موقعك الحالي:</strong>{' '}
                    {driverLocationName || 'متصل بدقة عبر الـ GPS 🛰️'}
                  </span>
                ) : (
                  'يتم تحديد موقعك وبثه لحظياً للفرع والعميل على الخريطة'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleBroadcastRealLocation}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
              title="تحديث وبث موقعي الفعلي الحالي عبر الـ GPS"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>تحديث موقعي 🔄</span>
            </button>
          </div>
        </div>

        {/* Unified Driver Status & Shift KPI Bar */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-sm space-y-3.5">
          {/* Scope row */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${driver.isAllBranches ? 'bg-purple-600 animate-pulse' : 'bg-indigo-600'}`} />
              <div className="min-w-0">
                <span className="font-black block text-xs text-slate-800">
                  {driver.isAllBranches ? '🌐 طيار عام لجميع المطاعم والفروع' : '🏪 مطاعم وفروع محددة:'}
                </span>
                <span className="text-[11px] font-normal text-slate-500 truncate block">
                  {driver.isAllBranches
                    ? 'مؤهل لتوصيل الطلبات من كافة المطاعم والفروع'
                    : (driver.servedBranchNames?.length ? driver.servedBranchNames.join(' • ') : (driver.branch?.name || 'الفرع الأساسي'))}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
              {driver.isAllBranches ? 'تغطية شاملة' : `${driver.servedBranchNames?.length || 1} فروع`}
            </span>
          </div>

          {/* Quick 3 KPIs */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-bold block mb-0.5">الطلبات الجارية</span>
              <span className="text-base sm:text-lg font-black text-indigo-700 font-mono">
                {activeOrders.length}
              </span>
            </div>
            <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-bold block mb-0.5">المسلّمة اليوم</span>
              <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                {finishedOrders.length}
              </span>
            </div>
            <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-500 font-bold block mb-0.5">تحصيل نقدي</span>
              <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {finishedOrders.filter(o => o.paymentMethod === 'CASH').reduce((acc: number, o: any) => acc + (o.total || 0), 0)} <span className="text-[10px] font-normal">ج.م</span>
              </span>
            </div>
          </div>
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

        {/* Segmented Tab Switcher (الطلبات الحالية / سجل المكتملة) */}
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setDriverTab('ACTIVE')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              driverTab === 'ACTIVE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>الطلبات الحالية</span>
            {activeOrders.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                driverTab === 'ACTIVE' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {activeOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDriverTab('HISTORY')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              driverTab === 'HISTORY'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>سجل المكتملة اليوم</span>
            {finishedOrders.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                driverTab === 'HISTORY' ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {finishedOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: ACTIVE ORDERS */}
        {driverTab === 'ACTIVE' && (
          <>
            {loadingOrders ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <RotateCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                <span>جاري تحديث بيانات الطلبات...</span>
              </div>
            ) : activeOrders.length === 0 ? (
              /* Enhanced Friendly Empty State with Radar pulse and Test sound button */
              <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 text-slate-400 space-y-4 shadow-sm">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
                  <span className="absolute inset-2 rounded-full bg-indigo-500/20 animate-pulse" />
                  <div className="relative w-14 h-14 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Truck className="w-7 h-7" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-black text-slate-800 text-base">في انتظار إسناد طلبات جديدة 🛵</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    أنت متصل بالخدمة وجاهز لاستقبال الطلبات. سيصلك إشعار صوتي فوري بمجرد إسناد أي أوردر جديد لك من المطاعم.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMuted) setIsMuted(false);
                      playAlertSound();
                      showToast('تم تجربة نغمة الرنين بنجاح 🔔', 'success');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black transition-colors"
                  >
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <span>تجربة نغمة التنبيه الآن</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeOrders.map((order) => {
                  const isPickedUp = Boolean(order.driverPickedUpAt);
                  const isReady = order.status === 'READY';

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`bg-white rounded-2xl border p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer hover:border-indigo-400 active:scale-[0.99] flex flex-col justify-between gap-2.5 ${
                        isPickedUp
                          ? 'border-indigo-300 ring-2 ring-indigo-100 bg-gradient-to-b from-indigo-50/25 to-white'
                          : isReady
                            ? 'border-emerald-300 ring-2 ring-emerald-100 bg-gradient-to-b from-emerald-50/30 to-white'
                            : !order.isDriverAccepted
                              ? 'border-amber-300 ring-2 ring-amber-100 bg-gradient-to-b from-amber-50/25 to-white'
                              : 'border-slate-200'
                      }`}
                    >
                      {/* السطر الأول: رقم الأوردر وشارة الحالة */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-base text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-xl border border-slate-200 shadow-2xs">
                          #{order.orderNumber}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                          isPickedUp
                            ? 'bg-purple-600 text-white shadow-xs'
                            : !order.isDriverAccepted
                              ? 'bg-amber-500 text-white animate-pulse'
                              : isReady
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-indigo-600 text-white'
                        }`}>
                          {isPickedUp
                            ? '🛵 جاري التوصيل'
                            : !order.isDriverAccepted
                              ? '⚡ بانتظار قبولك'
                              : isReady
                                ? '✅ جاهز للاستلام'
                                : '👍 تم القبول'}
                        </span>
                      </div>

                      {/* السطر الثاني: اسم المطعم واسم العميل */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-800 truncate">
                          <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs shrink-0">
                            🏪
                          </span>
                          <span className="truncate">{order.branch?.name || 'مطعم غير محدد'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs shrink-0">
                            👤
                          </span>
                          <span className="truncate">{order.customerName || 'عميل'}</span>
                        </div>
                      </div>

                      {/* السطر الثالث: زر/تنبيه النقر لعرض تفاصيل الطلب والخريطة */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-bold text-indigo-600">
                        <span>عرض تفاصيل الطلب والخريطة</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: HISTORY (COMPLETED ORDERS TODAY) */}
        {driverTab === 'HISTORY' && (
          <div className="space-y-3">
            {finishedOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-400 space-y-2">
                <CheckCircle className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-sm">لا توجد طلبات مكتملة حتى الآن</h4>
                <p className="text-xs text-slate-400">الطلبات التي تقوم بتسليمها اليوم ستظهر هنا مع تفاصيل المبالغ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {finishedOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs hover:shadow-sm cursor-pointer space-y-2 hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-slate-900">#{order.orderNumber}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCheck className="w-3 h-3 text-emerald-600" />
                        <span>تم التسليم</span>
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 font-bold truncate">
                      🏪 {order.branch?.name || 'المطعم'}
                    </div>

                    <div className="text-[11px] text-slate-500 truncate">
                      👤 {order.customerName} {order.deliveryZoneName ? `• ${order.deliveryZoneName}` : ''}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 font-mono">
                      <span className="text-slate-500 font-sans text-[11px]">
                        {new Date(order.driverDeliveredAt || order.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-black text-slate-900">
                        {order.total} ج.م {order.paymentMethod === 'CASH' ? '💵' : '💳'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* PIN Verification Modal */}
      {deliveringOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 overscroll-contain">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-slate-800">تأكيد التسليم بأمان</h3>
              <p className="text-xs text-slate-500">
                اطلب رمز الأمان (PIN) المكون من 4 أرقام من العميل {deliveringOrder.customerName} عند تسليمه الطلب
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

      {/* Return to Branch PIN Modal */}
      {returningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 overscroll-contain">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-slate-800">إرجاع الطلب للمطعم #{returningOrder.orderNumber}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                اطلب رمز الاستلام (PIN) المكون من 4 أرقام المعروض على شاشة كاشير مطعم ({returningOrder.branch?.name || 'الفرع'}) لتأكيد تسليم الوجبة وإلغاء مسؤوليته عنك.
              </p>
            </div>

            {returnError && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold text-center">
                {returnError}
              </div>
            )}

            <form onSubmit={handleConfirmReturn} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 text-right">رمز تأكيد استلام الفرع (PIN):</label>
                <input
                  type="text"
                  maxLength={4}
                  value={returnPin}
                  onChange={(e) => setReturnPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center text-3xl font-black tracking-widest p-3 bg-slate-50 border-2 border-amber-200 rounded-2xl focus:border-amber-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 text-right">سبب الإرجاع (اختياري):</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: عطل في الدراجة، تعذر الوصول..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setReturningOrder(null);
                    setReturnPin('');
                    setReturnReason('');
                    setReturnError(null);
                  }}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={returnLoading || returnPin.length !== 4}
                  className="py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {returnLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>تأكيد الإرجاع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Order Details Modal for Driver */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp overscroll-contain">
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>رجوع</span>
                </button>
                <div className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 font-mono font-black text-xs text-indigo-700 shrink-0">
                  #{selectedOrder.orderNumber}
                </div>
                <h3 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                  {selectedOrder.branch?.name || 'تفاصيل الطلب'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  selectedOrder.driverPickedUpAt
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : selectedOrder.isDriverAccepted
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {selectedOrder.driverPickedUpAt ? '🛵 توصيل' : selectedOrder.isDriverAccepted ? '🏪 استلام' : 'طلب جديد'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs overscroll-contain pb-28 sm:pb-32">
              {/* Live Route Map inside Modal: To Restaurant after accept, To Customer after pickup */}
              {selectedOrder.status !== 'COMPLETED' && (selectedOrder.isDriverAccepted || selectedOrder.driverPickedUpAt) && (
                <DriverRouteMap
                  mode={selectedOrder.driverPickedUpAt ? 'TO_CUSTOMER' : 'TO_RESTAURANT'}
                  driverCoords={getEffectiveDriverCoords(selectedOrder, Boolean(selectedOrder.driverPickedUpAt))}
                  targetCoords={
                    selectedOrder.driverPickedUpAt
                      ? getOrderCustomerCoords(selectedOrder)
                      : getOrderRestaurantCoords(selectedOrder)
                  }
                  targetTitle={
                    selectedOrder.driverPickedUpAt
                      ? selectedOrder.customerName || 'العميل'
                      : selectedOrder.branch?.name || 'المطعم'
                  }
                  targetSubtitle={
                    selectedOrder.driverPickedUpAt
                      ? `${selectedOrder.deliveryZoneName ? `${selectedOrder.deliveryZoneName} • ` : ''}${getDisplayAddress(selectedOrder.addressText, 'موقع العميل')}`
                      : getDisplayAddress(selectedOrder.branch?.address, 'موقع المطعم')
                  }
                  driverName={driver?.name}
                  hasLiveGps={Boolean(currentCoords)}
                  onRefreshGps={() => handleBroadcastRealLocation()}
                />
              )}

              {/* DELIVERY STAGE: Show Customer Delivery Destination First */}
              {selectedOrder.driverPickedUpAt ? (
                <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 rounded-2xl border-2 border-emerald-400/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                          🎯 وجهة التوصيل الحالية:
                        </span>
                        <span className="text-sm font-black text-slate-900">{selectedOrder.customerName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`https://wa.me/20${selectedOrder.customerPhone.replace(/^0+/, '')}?text=${encodeURIComponent(
                          `مرحباً أستاذ ${selectedOrder.customerName}، كابتن التوصيل معك بخصوص طلبك رقم #${selectedOrder.orderNumber}...`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1 font-bold text-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </a>
                      <a
                        href={`tel:${selectedOrder.customerPhone}`}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1 font-bold text-xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال</span>
                      </a>
                    </div>
                  </div>

                  {selectedOrder.deliveryZoneName && (
                    <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700 bg-indigo-50/80 px-2.5 py-1.5 rounded-xl border border-indigo-100">
                      <Building2 className="w-4 h-4 shrink-0 text-indigo-600" />
                      <span>منطقة التوصيل: {selectedOrder.deliveryZoneName}</span>
                    </div>
                  )}

                  <div className="text-xs text-slate-700 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-slate-500 shrink-0">العنوان:</span>
                      <span className="font-bold text-slate-800 leading-relaxed">
                        {getDisplayAddress(selectedOrder.addressText, 'موقع العميل')}
                      </span>
                    </div>
                    {selectedOrder.notes && (
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-bold">
                        <span>ملاحظات العميل: </span>
                        <span>{selectedOrder.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* PICKUP STAGE: Prominent Restaurant Pickup Header Card */
                <div className="p-4 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/5 rounded-2xl border-2 border-amber-400/70 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Store className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-0.5">
                        🏪 مطعم الاستلام (توجه إلى):
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 break-words leading-snug">
                        {selectedOrder.branch?.name || 'مطعم غير محدد'}
                      </h3>
                      {selectedOrder.branch?.address && (
                        <p className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>{getDisplayAddress(selectedOrder.branch.address, 'موقع المطعم')}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedOrder.branch?.phone && (
                    <a
                      href={`tel:${selectedOrder.branch.phone}`}
                      className="px-3 py-2 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>اتصال</span>
                    </a>
                  )}
                </div>
              )}

              {/* Subtle Restaurant Badge during delivery stage */}
              {selectedOrder.driverPickedUpAt && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-bold block">تم استلام الوجبة من المطعم:</span>
                      <span className="text-xs font-black text-slate-800 truncate block">
                        {selectedOrder.branch?.name || 'المطعم'}
                      </span>
                    </div>
                  </div>
                  {selectedOrder.branch?.phone && (
                    <a
                      href={`tel:${selectedOrder.branch.phone}`}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Phone className="w-3 h-3" />
                      <span>المطعم</span>
                    </a>
                  )}
                </div>
              )}

              {/* Pickup Stage: Customer Contact & Delivery Details */}
              {!selectedOrder.driverPickedUpAt && (
                <>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">بيانات العميل:</span>
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

                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-1.5 shadow-xs">
                    {selectedOrder.deliveryZoneName && (
                      <div className="font-bold text-indigo-700 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>منطقة التوصيل: {selectedOrder.deliveryZoneName}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="w-full">
                        <span className="font-black text-slate-800">عنوان التوصيل المحدد: </span>
                        <span className="text-slate-600">{getDisplayAddress(selectedOrder.addressText, 'موقع العميل')}</span>
                      </div>
                    </div>
                    {selectedOrder.notes && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-bold">
                        <span>ملاحظات العميل: </span>
                        <span>{selectedOrder.notes}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Live GPS Broadcast Card when delivering */}
              {selectedOrder.status !== 'COMPLETED' && selectedOrder.driverPickedUpAt && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border-2 border-emerald-500/40 rounded-2xl flex items-center justify-between gap-2 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block">بث الـ GPS الحي للعميل مفعل 🛰️</span>
                      <span className="text-[10px] text-emerald-700 block truncate font-medium">
                        {currentCoords ? (driverLocationName ? `موقعك: ${driverLocationName}` : 'موقعك محدد بدقة عبر الـ GPS 🛰️') : 'جاري بث تحركاتك للعميل على الخريطة'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulateOrSendLocation()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1 shrink-0"
                    title="تحديث وبث موقعي الحالي فوراً"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>تحديث الموقع</span>
                  </button>
                </div>
              )}

              {/* Quick In-App Status Messages inside Order Details Modal */}
              {selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'REJECTED' && (
                <div className="p-3.5 bg-white border border-indigo-200 rounded-2xl shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                      <span>💬</span>
                      <span>رسائل سريعة لحظية مع العميل داخل التطبيق</span>
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      فوري ⚡
                    </span>
                  </div>

                  {/* Message Thread */}
                  {(quickMessagesByOrder[selectedOrder.id]?.length || 0) > 0 && (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                      {quickMessagesByOrder[selectedOrder.id].map((msg: any) => {
                        const isMe = msg.senderRole === 'DRIVER';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${
                              isMe
                                ? 'mr-auto bg-indigo-600 text-white rounded-tl-xs'
                                : 'ml-auto bg-amber-100 text-amber-950 border border-amber-200 rounded-tr-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[9px] opacity-80 font-bold mb-0.5">
                              <span>{isMe ? 'أنت (الكابتن)' : `👤 العميل (${msg.senderName})`}</span>
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

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '📍 أنا وصلت عند البوابة الآن',
                      '🛵 دقيقتين وأكون عندك جهز نفسك',
                      '🏪 استلمت الأوردر من المطعم وجاي في الطريق',
                      '📞 حاولت أتصل بك، افتح التليفون',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSendDriverQuickMessage(selectedOrder, preset)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-900 border border-indigo-200 transition-all active:scale-95"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Custom short message */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <input
                      type="text"
                      value={driverCustomQuickText}
                      onChange={(e) => setDriverCustomQuickText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && driverCustomQuickText.trim()) {
                          e.preventDefault();
                          handleSendDriverQuickMessage(selectedOrder, driverCustomQuickText);
                        }
                      }}
                      maxLength={140}
                      placeholder="اكتب رسالة سريعة للعميل..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={!driverCustomQuickText.trim()}
                      onClick={() => handleSendDriverQuickMessage(selectedOrder, driverCustomQuickText)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black transition-all shrink-0"
                    >
                      إرسال
                    </button>
                  </div>
                </div>
              )}

              {/* Group Cart / Bag Division if present */}
              {selectedOrder.groupCartDetails && (() => {
                try {
                  const bags = typeof selectedOrder.groupCartDetails === 'string'
                    ? JSON.parse(selectedOrder.groupCartDetails)
                    : selectedOrder.groupCartDetails;
                  if (Array.isArray(bags) && bags.length > 0) {
                    return (
                      <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-1.5">
                        <span className="font-black text-purple-900 block">🛍️ الطلب مقسم أكياس منفصلة للمشتركين:</span>
                        {bags.map((b: any, bIdx: number) => (
                          <div key={bIdx} className="bg-white p-2 rounded-xl text-[11px] font-bold text-slate-700 flex justify-between border border-purple-100">
                            <span>كيس: {b.label || `شخص ${bIdx + 1}`}</span>
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
                  <span className="text-[10px] text-emerald-800 font-bold block">المبلغ المطلوب تحصيله من العميل:</span>
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
            <div className="p-3.5 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 flex gap-2 shrink-0">
              {/* Accept button if not yet accepted */}
              {selectedOrder.status !== 'COMPLETED' && !selectedOrder.driverPickedUpAt && !selectedOrder.isDriverAccepted && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleAccept(selectedOrder.id);
                      setSelectedOrder({ ...selectedOrder, isDriverAccepted: true });
                    }}
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>قبول الطلب والتوجه للمطعم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleReject(selectedOrder);
                    }}
                    className="px-4 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs"
                  >
                    اعتذار
                  </button>
                </>
              )}

              {/* Pickup button if already accepted */}
              {selectedOrder.status !== 'COMPLETED' && !selectedOrder.driverPickedUpAt && selectedOrder.isDriverAccepted && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handlePickup(selectedOrder);
                    }}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    <span>تأكيد الاستلام وبدء التوصيل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleReject(selectedOrder);
                    }}
                    className="px-4 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs"
                    title="الاعتذار عن الطلب وإعادته للمطعم"
                  >
                    اعتذار
                  </button>
                </>
              )}

              {/* Deliver button with PIN */}
              {selectedOrder.status !== 'COMPLETED' && selectedOrder.driverPickedUpAt && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveringOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>تأكيد التسليم للعميل (PIN)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReturningOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="px-4 py-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl font-bold text-xs flex items-center gap-1 shrink-0"
                    title="إرجاع الوجبة للمطعم وإلغاء مسؤوليته عنك"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إرجاع للفرع</span>
                  </button>
                </>
              )}

              {/* Close button for completed or cancelled orders */}
              {(selectedOrder.status === 'COMPLETED' || selectedOrder.status === 'REJECTED' || selectedOrder.status === 'CANCELLED') && (
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors"
                >
                  إغلاق النافذة
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation / Alert Dialog */}
      {driverConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-scaleUp border border-slate-100 overscroll-contain">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                driverConfirmDialog.isDanger 
                  ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
              }`}>
                {driverConfirmDialog.isDanger ? <AlertCircle className="w-6 h-6" /> : <Store className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  {driverConfirmDialog.title}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold block">
                  تطبيق كابتن التوصيل
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">
              {driverConfirmDialog.message}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDriverConfirmDialog(null)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                {driverConfirmDialog.cancelText || 'تراجع'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = driverConfirmDialog.onConfirm;
                  setDriverConfirmDialog(null);
                  action();
                }}
                className={`py-2.5 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                  driverConfirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                <span>{driverConfirmDialog.confirmText || 'تأكيد'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-11/12 max-w-sm" dir="rtl">
          <div className={`p-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-black border ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-700'
              : toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-slate-900 text-white border-slate-800'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="p-1 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Driver Exit Confirmation Dialog */}
      {showDriverExitDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-scaleUp text-center overscroll-contain">
            <div className="w-14 h-14 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <LogOut className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-white text-base">
                الخروج من تطبيق الكابتن
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                هل تريد إنهاء وردية التوصيل وتسجيل الخروج من التطبيق؟
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDriverExitDialog(false)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors border border-slate-700/60"
              >
                البقاء في الخدمة
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDriverExitDialog(false);
                  handleLogout();
                }}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/20 transition-all active:scale-95"
              >
                إنهاء وخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
