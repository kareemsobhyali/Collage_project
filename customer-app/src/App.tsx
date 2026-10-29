import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { 
  User, 
  ShoppingBag, 
  Clock, 
  LogOut, 
  Users,
  Smartphone,
  X,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { api, API_BASE_URL, getFullImageUrl, syncRemoteServerConfig } from './services/api';
import { registerServiceWorker, isRunningInNativeApk, registerNativeBackgroundSession, clearNativeBackgroundSession } from './services/notifications';
import { BranchList } from './components/BranchList';
import { BranchMenu } from './components/BranchMenu';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { ItemCustomizeModal } from './components/ItemCustomizeModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { MyOrdersModal } from './components/MyOrdersModal';
import { ProfileModal } from './components/ProfileModal';
const AdminPage = React.lazy(() => import('./components/AdminPage').then(m => ({ default: m.AdminPage })));
const DriverPortal = React.lazy(() => import('./components/DriverPortal').then(m => ({ default: m.DriverPortal })));
import { GroupCartModal } from './components/GroupCartModal';
import { Logo } from './components/Logo';
import { SplashScreen } from './components/SplashScreen';
import { InstallApkPage, parseApkRoute } from './components/InstallApkPage';

/**
 * دالة مركزية وشاملة لاستخراج معرّف المطعم (Slug أو ID) بدقة من كافة أنواع الروابط:
 * 1. البيانات المحقونة من السيرفر (__UNIFOOD_INITIAL_BRANCH__)
 * 2. الباراميترات (?branch= أو ?r= أو ?slug= أو ?b=)
 * 3. مسار الصفحة (/r/:slug أو /:slug أو /:slug/apk أو /apk/:slug)
 * 4. مسار الهاش (#/r/:slug أو #/:slug)
 * 5. التطبيق المثبت في الهاتف (PWA Standalone)
 */
export function getRequestedBranchKeyFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // 0. التحقق أولاً من الفرع المحقون مسبقاً من السيرفر
    const serverInjected = (window as any).__UNIFOOD_INITIAL_BRANCH__;
    if (serverInjected && (serverInjected.slug || serverInjected.id)) {
      return (serverInjected.slug || serverInjected.id).trim();
    }

    // 1. فحص معاملات الاستعلام (Query Parameters)
    const params = new URLSearchParams(window.location.search);
    const bParam = params.get('branch') || params.get('r') || params.get('b') || params.get('slug');
    if (bParam) {
      try { return decodeURIComponent(bParam).trim(); } catch { return bParam.trim(); }
    }

    // 2. فحص مسار الهاش (Hash Routing)
    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#+/, '');
      const hashMatch = hash.match(/(?:branch|r|b)[\/=]([^&?\/]+)/i);
      if (hashMatch && hashMatch[1]) {
        try { return decodeURIComponent(hashMatch[1]).trim(); } catch { return hashMatch[1].trim(); }
      }
      const hashSegments = hash.split('?')[0].replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      if (hashSegments.length >= 2 && (hashSegments[0] === 'r' || hashSegments[0] === 'branch' || hashSegments[0] === 'b')) {
        try { return decodeURIComponent(hashSegments[1]).trim(); } catch { return hashSegments[1].trim(); }
      }
      if (hashSegments.length >= 2 && ['apk', 'download', 'install'].includes(hashSegments[hashSegments.length - 1].toLowerCase())) {
        const target = hashSegments[0] === 'r' ? hashSegments[1] : hashSegments[0];
        if (target && !['admin', 'driver', 'delivery', 'elviery', 'apk', 'download', 'install'].includes(target.toLowerCase())) {
          try { return decodeURIComponent(target).trim(); } catch { return target.trim(); }
        }
      }
      if (hashSegments.length === 1 && !['admin', 'driver', 'delivery', 'elviery', 'apk', 'download', 'install'].includes(hashSegments[0].toLowerCase())) {
        try { return decodeURIComponent(hashSegments[0]).trim(); } catch { return hashSegments[0].trim(); }
      }
    }

    // 3. فحص مسار المسار المباشر (Pathname)
    let cleanPath = '';
    try { cleanPath = decodeURIComponent(window.location.pathname); } catch { cleanPath = window.location.pathname; }
    const pathParts = cleanPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

    if (pathParts.length >= 2 && (pathParts[0] === 'r' || pathParts[0] === 'branch' || pathParts[0] === 'b')) {
      return pathParts[1].trim();
    }
    // دعم روابط /:slug/apk أو /r/:slug/apk
    if (pathParts.length >= 2 && ['apk', 'download', 'install'].includes(pathParts[pathParts.length - 1].toLowerCase())) {
      const target = pathParts[0] === 'r' ? pathParts[1] : pathParts[0];
      if (target && !['admin', 'driver', 'delivery', 'elviery', 'apk', 'download', 'install'].includes(target.toLowerCase())) {
        return target.trim();
      }
    }
    // دعم روابط /apk/:slug
    if (pathParts.length >= 2 && ['apk', 'download', 'install'].includes(pathParts[0].toLowerCase())) {
      const target = pathParts[1];
      if (target && !['admin', 'driver', 'delivery', 'elviery', 'apk', 'download', 'install'].includes(target.toLowerCase())) {
        return target.trim();
      }
    }
    // دعم المسار المباشر مثل /shawarma-campus
    if (pathParts.length === 1 && !['admin', 'driver', 'delivery', 'elviery', 'apk', 'download', 'install', 'pos'].includes(pathParts[0].toLowerCase())) {
      return pathParts[0].trim();
    }

    // 4. فحص التطبيق المثبت (PWA Standalone)
    const isStandalone = (
      isRunningInNativeApk() ||
      params.get('installed') === '1' ||
      window.location.search.includes('installed=1') ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
    if (isStandalone) {
      const saved = localStorage.getItem('pwa_installed_branch');
      if (saved) return saved.trim();
    }
  } catch (_e) {}
  return null;
}

export function App() {
  const isMobileAppExperience = typeof window !== 'undefined' && (
    isRunningInNativeApk() ||
    window.location.search.includes('splash') ||
    window.location.search.includes('app')
  );
  const [showSplash, setShowSplash] = useState(isMobileAppExperience);
  const [branches, setBranches] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('unifood_cached_branches');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_e) {}
    return [];
  });
  const isAdminRoute = typeof window !== 'undefined' && (
    (window as any).AndroidBridge?.getFlavor?.() === 'admin' ||
    window.location.pathname.startsWith('/admin') ||
    window.location.search.includes('admin') ||
    window.location.hash.includes('admin')
  );

  const isDriverRoute = typeof window !== 'undefined' && (
    (window as any).AndroidBridge?.getFlavor?.() === 'driver' ||
    window.location.pathname.startsWith('/driver') ||
    window.location.pathname.startsWith('/delivery') ||
    window.location.pathname.startsWith('/elviery') ||
    window.location.search.includes('driver') ||
    window.location.search.includes('delivery') ||
    window.location.search.includes('elviery') ||
    window.location.hash.includes('driver') ||
    window.location.hash.includes('delivery') ||
    window.location.hash.includes('elviery')
  );

  const groupParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('group') : null;
  const isIosDevice = typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isCurrentlyStandalone = typeof window !== 'undefined' && (
    isRunningInNativeApk() ||
    new URLSearchParams(window.location.search).get('installed') === '1' ||
    window.location.search.includes('installed=1') ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
  const apkRouteInfo = parseApkRoute();
  // إذا كان المستخدم على جهاز آيفون (iOS) أو التطبيق مثبت على الهاتف، نلغي شاشة التثبيت فوراً ونفتح المطعم/الموقع مباشرة
  const [isApkRoute, setIsApkRoute] = useState(() => (isCurrentlyStandalone || isIosDevice ? false : apkRouteInfo.isApkPage));
  const [apkSlug, setApkSlug] = useState<string | null>(apkRouteInfo.branchSlug);

  // مزامنة حالة مسار تثبيت الـ APK مع تغيرات الـ URL والـ Hash والـ History
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUrlChange = () => {
      const info = parseApkRoute();
      const isStandalone = (
        isRunningInNativeApk() ||
        new URLSearchParams(window.location.search).get('installed') === '1' ||
        window.location.search.includes('installed=1') ||
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
      setIsApkRoute(isStandalone || isIosDevice ? false : info.isApkPage);
      setApkSlug(info.branchSlug);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // مزامنة أحدث عنوان للسيرفر من GitHub تلقائياً عند فتح التطبيق
  useEffect(() => {
    syncRemoteServerConfig();
  }, []);

  const [showDriverPortal, setShowDriverPortal] = useState(isDriverRoute);
  const [groupCartCode, setGroupCartCode] = useState<string | null>(() => {
    if (groupParam) {
      localStorage.setItem('active_group_cart_code', groupParam.toUpperCase());
      return groupParam.toUpperCase();
    }
    return localStorage.getItem('active_group_cart_code') || null;
  });
  const [showGroupCartModal, setShowGroupCartModal] = useState(false);
  const [pendingOpenGroupCart, setPendingOpenGroupCart] = useState(Boolean(groupParam));
  const [groupCartDetailsForCheckout, setGroupCartDetailsForCheckout] = useState<any | null>(null);

  const [user, setUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('customer_user') || localStorage.getItem('admin_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // إذا كان الحساب سوبر أدمن، تأكد من مزامنة توكن الإدارة
      if (parsed.role === 'SUPERADMIN') {
        const adminTok = localStorage.getItem('admin_token') || localStorage.getItem('customer_token');
        if (adminTok) {
          localStorage.setItem('admin_token', adminTok);
          localStorage.setItem('customer_token', adminTok);
        }
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const requestedBranchKey = useMemo(() => getRequestedBranchKeyFromUrl(), []);
  const enteredDirectlyRef = useRef(Boolean(requestedBranchKey));
  const isMountedTimeRef = useRef(Date.now());
  const socketRef = useRef<any>(null);
  const selectedBranchRef = useRef<any>(null);

  const [selectedBranch, setSelectedBranch] = useState<any | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      // 0. التحقق أولاً من الفرع المحقون مسبقاً من السيرفر (Server Injected Branch) لفتح المنيو فوراً بدون تأخير
      const serverInjected = (window as any).__UNIFOOD_INITIAL_BRANCH__;
      if (serverInjected && (serverInjected.slug || serverInjected.id)) {
        return {
          ...serverInjected,
          isOnline: Boolean(serverInjected.isOnline),
        };
      }

      const bParam = getRequestedBranchKeyFromUrl();
      if (bParam) {
        try {
          const cached = localStorage.getItem('unifood_cached_branches');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const normalized = bParam.trim().toLowerCase();
              const found = parsed.find(
                (b: any) => b.id === bParam || (b.slug && b.slug.toLowerCase() === normalized) || (b.name && b.name.toLowerCase() === normalized)
              );
              if (found) {
                return {
                  ...found,
                  isOnline: Boolean(found.isOnline),
                };
              }
            }
          }
        } catch (_err) {}
      }
    } catch (_e) {}
    return null;
  });
  const [branchCategories, setBranchCategories] = useState<any[]>([]);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
  }, [selectedBranch]);

  useEffect(() => {
    if (!selectedBranch?.id || !socketRef.current?.connected) return;
    socketRef.current.emit('check_branch_presence', selectedBranch.id, (isOnline: boolean) => {
      setSelectedBranch((prev: any) =>
        prev && prev.id === selectedBranch.id ? { ...prev, isOnline: Boolean(isOnline) } : prev
      );
    });
  }, [selectedBranch?.id]);

  // جلب فوري ومباشر لقائمة المطعم عند وجود فرع بالرابط لمنع أي وميض أو ظهور للصفحة الرئيسية
  useEffect(() => {
    if (isAdminRoute || showDriverPortal) return;
    const directKey = requestedBranchKey;
    if (directKey) {
      api.getBranchMenu(directKey)
        .then((data) => {
          if (data && data.branch) {
            setSelectedBranch({
              ...data.branch,
              reviews: data.reviews || [],
              banners: data.banners || [],
              flashDeals: data.flashDeals || [],
              promos: data.promos || [],
            });
            setBranchCategories(data.categories || []);
          }
        })
        .catch((err) => {
          console.warn('Could not directly fetch branch menu:', err);
        });
    }
  }, [requestedBranchKey, isAdminRoute, showDriverPortal]);
  const [cart, setCart] = useState<any[]>([]);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<any | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activationToast, setActivationToast] = useState<string | null>(null);
  const [showExitAppDialog, setShowExitAppDialog] = useState(false);

  // قفل تمرير الشاشة الخلفية تلقائياً عند فتح أي نافذة منبثقة (Scroll Lock)
  const isAnyModalOpen = Boolean(
    customizingItem ||
    showCartModal ||
    showGroupCartModal ||
    showProfileModal ||
    trackingOrder ||
    showMyOrdersModal ||
    showAuthModal ||
    showExitAppDialog
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
    } else {
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
    }

    return () => {
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
    };
  }, [isAnyModalOpen]);

  // فحص ما إذا كان التطبيق يعمل كتطبيق مخصص ومثبت لمطعم معين (PWA / WebAPK / Standalone / Dedicated Branch App)
  const isDedicatedRestaurantApp = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      // 0. إذا وجد فرع محقون من السيرفر مسبقاً
      if ((window as any).__UNIFOOD_INITIAL_BRANCH__) return true;

      const params = new URLSearchParams(window.location.search);
      const isStandaloneMode = (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        params.get('installed') === '1' ||
        params.get('app') === '1' ||
        isRunningInNativeApk()
      );

      let cleanPath = '';
      try { cleanPath = decodeURIComponent(window.location.pathname); } catch { cleanPath = window.location.pathname; }
      const pathParts = cleanPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      const hasBranchInPath = (pathParts.length >= 2 && (pathParts[0] === 'r' || pathParts[0] === 'branch' || pathParts[0] === 'b')) ||
        (pathParts.length === 1 && !['admin', 'driver', 'delivery', 'elviery', 'apk', 'download', 'install'].includes(pathParts[0].toLowerCase()));

      const hasBranchInQuery = Boolean(params.get('r') || params.get('branch') || params.get('b'));
      const savedBranch = (localStorage.getItem('pwa_installed_branch') || '').trim().toLowerCase();
      const currentBranchKey = (selectedBranch?.slug || selectedBranch?.id || '').trim().toLowerCase();

      // 1. إذا كان التطبيق في وضع Standalone وله فرع بالمسار أو بالاستعلام أو بالتخزين أو محدد
      if (isStandaloneMode && (hasBranchInPath || hasBranchInQuery || savedBranch || selectedBranch)) {
        return true;
      }

      // 2. إذا كان المسار صريحاً لفرع ومحدد كـ PWA
      if (hasBranchInPath && (params.get('installed') === '1' || isStandaloneMode)) {
        return true;
      }

      // 3. إذا كان الفرع الحالي يطابق الفرع المثبت في التخزين
      if (savedBranch && currentBranchKey && (savedBranch === currentBranchKey || savedBranch.includes(currentBranchKey))) {
        return true;
      }

      // 4. إذا كان الرابط يحتوي على وسم التثبيت لمطعم محدد
      if (params.get('installed') === '1' && (Boolean(params.get('r') || params.get('branch')) || selectedBranch)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, [selectedBranch]);

  // إدارة زر الرجوع في الهاتف (Android Back Button & In-App Navigation)
  const isHandlingPopstateRef = useRef(false);
  const historyDepthRef = useRef(0);

  // تهيئة حارس الرجوع الأولي لمنع الخروج المفاجئ
  useEffect(() => {
    if (typeof window === 'undefined' || isAdminRoute || showDriverPortal || isApkRoute) return;
    try {
      window.history.replaceState({ uniFoodRoot: true, depth: 0 }, '');
      window.history.pushState({ uniFoodStep: 1, depth: 1 }, '');
      historyDepthRef.current = 1;
    } catch (_e) {}
  }, [isAdminRoute, showDriverPortal, isApkRoute]);

  // تتبع فتح الشاشات الفرعية والنوافذ لدفع خطوة في الـ History
  const currentNavStateKey = [
    Boolean(selectedBranch),
    Boolean(customizingItem),
    Boolean(showCartModal),
    Boolean(showGroupCartModal),
    Boolean(showProfileModal),
    Boolean(trackingOrder),
    Boolean(showMyOrdersModal),
    Boolean(showAuthModal),
    Boolean(showExitAppDialog)
  ].filter(Boolean).length;

  const prevNavCountRef = useRef(0);

  useEffect(() => {
    if (isHandlingPopstateRef.current) return;
    if (currentNavStateKey > prevNavCountRef.current) {
      try {
        window.history.pushState({ uniFoodStep: historyDepthRef.current + 1 }, '');
        historyDepthRef.current += 1;
      } catch (_e) {}
    }
    prevNavCountRef.current = currentNavStateKey;
  }, [currentNavStateKey]);

  // الاستماع لحدث الرجوع (popstate)
  useEffect(() => {
    if (isAdminRoute || showDriverPortal || isApkRoute) return;
    const handlePopState = () => {
      // إذا كان حدث popstate التلقائي صادراً من المتصفح خلال أول 1500 ملي ثانية من فتح الصفحة -> تجاهله لمنع الخروج التلقائي
      if (Date.now() - isMountedTimeRef.current < 1500) {
        return;
      }

      isHandlingPopstateRef.current = true;
      historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);

      // أولاً: إذا كانت نافذة الخروج مفتوحة بالفعل ونقر المستخدم زر الرجوع مرة أخرى -> خروج فوري من التطبيق
      if (showExitAppDialog) {
        handleConfirmExit();
        return;
      }
      // ثانياً: إغلاق النوافذ المنبثقة بترتيب أسبقيتها (الأحدث فالأقدم)
      else if (customizingItem) {
        setCustomizingItem(null);
        restoreItemScroll();
      } else if (showCartModal) {
        setShowCartModal(false);
      } else if (showGroupCartModal) {
        setShowGroupCartModal(false);
      } else if (showProfileModal) {
        setShowProfileModal(false);
      } else if (trackingOrder) {
        setTrackingOrder(null);
      } else if (showMyOrdersModal) {
        setShowMyOrdersModal(false);
      } else if (showAuthModal) {
        setShowAuthModal(false);
      }
      // ثالثاً: إذا كان المستخدم داخل تطبيق مطعم مثبت أو دخل عبر رابط مباشر للمطعم:
      // نمنع الرجوع لشاشة الموقع الرئيسي نهائياً ونعرض نافذة تأكيد إغلاق التطبيق والخروج
      else if (selectedBranch && (isDedicatedRestaurantApp || enteredDirectlyRef.current)) {
        try {
          window.history.pushState({ uniFoodStep: 1 }, '');
          historyDepthRef.current = 1;
        } catch (_e) {}
        setShowExitAppDialog(true);
      }
      // رابعاً: إذا كان تصفحاً عادياً في الموقع الرئيسي للجامعة وانتقل لمطعم أثناء التصفح -> يرجع لقائمة الفروع الرئيسية
      else if (selectedBranch && !enteredDirectlyRef.current) {
        handleReturnHome();
      }
      // خامساً: إذا كان في الشاشة الرئيسية ولا توجد أي شاشة فرعية -> إظهار تأكيد الخروج
      else {
        try {
          window.history.pushState({ uniFoodStep: 1 }, '');
          historyDepthRef.current = 1;
        } catch (_e) {}
        setShowExitAppDialog(true);
      }

      setTimeout(() => {
        isHandlingPopstateRef.current = false;
        prevNavCountRef.current = [
          Boolean(selectedBranch),
          Boolean(customizingItem),
          Boolean(showCartModal),
          Boolean(showGroupCartModal),
          Boolean(showProfileModal),
          Boolean(trackingOrder),
          Boolean(showMyOrdersModal),
          Boolean(showAuthModal),
          Boolean(showExitAppDialog)
        ].filter(Boolean).length;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isAdminRoute,
    showDriverPortal,
    isApkRoute,
    showExitAppDialog,
    customizingItem,
    showCartModal,
    showGroupCartModal,
    showProfileModal,
    trackingOrder,
    showMyOrdersModal,
    showAuthModal,
    selectedBranch,
    isDedicatedRestaurantApp
  ]);

  const handleConfirmExit = () => {
    setShowExitAppDialog(false);
    if (typeof window !== 'undefined') {
      // 1. Android Native Bridge / Cordova / Capacitor
      if ((window as any).AndroidBridge?.exitApp) {
        try {
          (window as any).AndroidBridge.exitApp();
          return;
        } catch (_e) {}
      }
      if ((window.navigator as any)?.app?.exitApp) {
        try {
          (window.navigator as any).app.exitApp();
          return;
        } catch (_e) {}
      }

      // 2. محاولة إغلاق النافذة
      try {
        window.close();
      } catch (_e) {}

      // 3. الرجوع للخلف في تاريخ المتصفح للخروج من نافذة الـ PWA / WebAPK إلى الشاشة الرئيسية للهاتف
      try {
        window.history.go(-(window.history.length || 10));
      } catch (_e) {
        try {
          window.history.back();
        } catch (_e2) {}
      }
    }
  };

  // فحص روابط التفعيل السريع من الواتساب (WhatsApp Magic Link Auto-Activation)
  useEffect(() => {
    if (typeof window === 'undefined' || isAdminRoute || showDriverPortal) return;
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verifyToken');

    if (verifyToken) {
      setLoading(true);
      api.verifyPhoneLink(verifyToken)
        .then((res) => {
          if (res.token && res.user) {
            localStorage.setItem('customer_token', res.token);
            localStorage.setItem('customer_user', JSON.stringify(res.user));
            setUser(res.user);
            setActivationToast('تم تفعيل حسابك وتأكيد هاتفك بنجاح! مرحباً بك في UniFood 🎉🍔');
            // إزالة التوكن من الرابط بسلاسة
            params.delete('verifyToken');
            params.delete('verified');
            const newQuery = params.toString() ? `?${params.toString()}` : window.location.pathname;
            window.history.replaceState({}, '', newQuery);
          }
        })
        .catch((err) => {
          alert(err.message || 'رابط التفعيل غير صالح أو انتهت صلاحيته');
          params.delete('verifyToken');
          params.delete('verified');
          const newQuery = params.toString() ? `?${params.toString()}` : window.location.pathname;
          window.history.replaceState({}, '', newQuery);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isAdminRoute, showDriverPortal]);

  // إخفاء إشعار التفعيل التلقائي بعد 6 ثوانٍ
  useEffect(() => {
    if (!activationToast) return;
    const t = setTimeout(() => setActivationToast(null), 6000);
    return () => clearTimeout(t);
  }, [activationToast]);

  // إذا دخل العميل برابط دعوة للسلة الجماعية: يفتح السلة إن كان مسجلاً، أو يطلب تسجيل الدخول أولاً
  useEffect(() => {
    if (pendingOpenGroupCart && !isAdminRoute && !showDriverPortal) {
      if (user) {
        setShowGroupCartModal(true);
        setPendingOpenGroupCart(false);
      } else {
        setShowAuthModal(true);
      }
    }
  }, [pendingOpenGroupCart, user, isAdminRoute, showDriverPortal]);

  const handleReturnHome = () => {
    // إذا كان التطبيق مخصصاً لمطعم مثبت، يمنع الخروج للموقع الرئيسي
    if (isDedicatedRestaurantApp) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSelectedBranch(null);
    if (typeof window !== 'undefined') {
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('branch');
        newUrl.searchParams.delete('r');
        newUrl.searchParams.delete('b');
        if (newUrl.pathname.startsWith('/branch') || newUrl.pathname.startsWith('/r/') || newUrl.pathname.startsWith('/b/')) {
          newUrl.pathname = '/';
        }
        window.history.pushState({}, '', newUrl.toString());
      } catch (_e) {}
    }
  };

  // عند اختيار فرع، جلب المنيو الخاص به مع إمكانية فتح صنف/عرض محدد تلقائياً
  const handleSelectBranch = async (branch: any, autoOpenItemId?: string | null) => {
    try {
      setLoading(true);
      const data = await api.getBranchMenu(branch.id);
      setSelectedBranch({
        ...data.branch,
        reviews: data.reviews || [],
        banners: data.banners || [],
        flashDeals: data.flashDeals || [],
        promos: data.promos || [],
      });
      setBranchCategories(data.categories || []);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        try {
          const newUrl = new URL(window.location.href);
          const slugOrId = branch.slug || branch.id;
          if (!newUrl.pathname.startsWith('/r/') && !newUrl.pathname.startsWith('/branch/')) {
            newUrl.pathname = `/r/${encodeURIComponent(slugOrId)}`;
          }
          newUrl.searchParams.set('branch', slugOrId);
          const isCurrentUrlAlreadyBranch = window.location.pathname.includes(slugOrId) || window.location.search.includes(slugOrId);
          if (isCurrentUrlAlreadyBranch) {
            window.history.replaceState({ branchId: branch.id }, '', newUrl.toString());
          } else {
            window.history.pushState({ branchId: branch.id }, '', newUrl.toString());
          }
        } catch (_e) {}
      }
      // إفراغ السلة إذا كانت تخص فرعاً آخر
      if (cart.length > 0 && cart[0].branchId !== branch.id) {
        setCart([]);
      }
      // إذا كان الرابط أو البانر يوجه لصنف/عرض محدد داخل المنيو
      if (autoOpenItemId && Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          const found = (cat.items || []).find((it: any) => it.id === autoOpenItemId);
          if (found) {
            setCustomizingItem(found);
            break;
          }
        }
      }
    } catch (err: any) {
      alert(err.message || 'فشل فتح منيو المطعم');
    } finally {
      setLoading(false);
    }
  };

  // تحميل قائمة الفروع عند بدء التطبيق والتحقق من الروابط المباشرة (Direct Links / QR / Banners)
  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await api.getBranches();
      const loadedBranches = data || [];
      setBranches(loadedBranches);
      try {
        localStorage.setItem('unifood_cached_branches', JSON.stringify(loadedBranches));
      } catch (_e) {}

      // التحقق أولاً إذا كان الرابط مخصصاً لصفحة تثبيت التطبيق APK المباشر للمطعم
      const currentApkInfo = parseApkRoute();
      const isStandaloneMode = (
        isRunningInNativeApk() ||
        new URLSearchParams(window.location.search).get('installed') === '1' ||
        window.location.search.includes('installed') ||
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );

      if (currentApkInfo.isApkPage) {
        if (isStandaloneMode || isIosDevice) {
          // إذا كان المستخدم على آيفون، أو التطبيق يعمل كـ PWA مثبت على الهاتف، نلغي شاشة التثبيت ونفتح منيو المطعم مباشرة
          setIsApkRoute(false);
        } else {
          if (!isApkRoute) {
            setIsApkRoute(true);
            setApkSlug(currentApkInfo.branchSlug);
          }
          return; // منع فتح منيو الفرع لأن المستخدم في صفحة تثبيت وتنزيل التطبيق
        }
      }

      // فحص إذا كان الرابط يحتوي على معرّف مباشر لمطعم (Slug أو ID) أو صنف/عرض
      if (typeof window !== 'undefined') {
        const branchParam = getRequestedBranchKeyFromUrl();
        const params = new URLSearchParams(window.location.search);
        const itemParam = params.get('item') || params.get('offer');

        if (branchParam) {
          let cleanBranchParam = branchParam;
          try { cleanBranchParam = decodeURIComponent(branchParam); } catch {}
          const normalized = cleanBranchParam.trim().toLowerCase();
          try {
            localStorage.setItem('pwa_installed_branch', normalized);
          } catch (_e) {}
          const target = loadedBranches.find(
            (b: any) =>
              b.id === cleanBranchParam ||
              b.id === normalized ||
              (b.slug && b.slug.toLowerCase() === normalized) ||
              (b.name && b.name.toLowerCase() === normalized)
          );
          if (target) {
            handleSelectBranch(target, itemParam);
          } else {
            // محاولة جلب الفرع مباشرة من الـ Backend عبر الـ slug أو الـ id
            api.getBranchMenu(cleanBranchParam)
              .then((menuData) => {
                if (menuData && menuData.branch) {
                  setSelectedBranch({
                    ...menuData.branch,
                    reviews: menuData.reviews || [],
                    banners: menuData.banners || [],
                    flashDeals: menuData.flashDeals || [],
                    promos: menuData.promos || [],
                  });
                  setBranchCategories(menuData.categories || []);
                  if (itemParam && Array.isArray(menuData.categories)) {
                    for (const cat of menuData.categories) {
                      const found = (cat.items || []).find((it: any) => it.id === itemParam);
                      if (found) {
                        setCustomizingItem(found);
                        break;
                      }
                    }
                  }
                }
              })
              .catch((err) => console.warn('Could not auto-open branch:', err));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // مزامنة المانيفست وأيقونة التطبيق لشاشة الهاتف مع الفرع المختار
  useEffect(() => {
    if (isAdminRoute || showDriverPortal) return;
    if (selectedBranch && (selectedBranch.slug || selectedBranch.id)) {
      const branchSlug = (selectedBranch.slug || selectedBranch.id).toLowerCase();
      try {
        localStorage.setItem('pwa_installed_branch', branchSlug);
      } catch (_e) {}

      // تحديث رابط الـ Manifest المخصص للفرع
      const manifestUrl = `/manifest.json?branch=${encodeURIComponent(branchSlug)}`;
      const mLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (mLink) {
        mLink.href = manifestUrl;
      }

      // تحديث أيقونة الموقع وأيقونة الهاتف للشاشة الرئيسية بأيقونة PNG موحدة ومربعة
      const branchIcon192 = `/api/branch-icon/${encodeURIComponent(branchSlug)}-192.png`;
      const branchIcon512 = `/api/branch-icon/${encodeURIComponent(branchSlug)}-512.png`;
      const fav = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (fav) fav.href = branchIcon192;
      let apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      if (apple) {
        apple.href = branchIcon512;
      } else {
        apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        apple.href = branchIcon512;
        document.head.appendChild(apple);
      }
    }
  }, [selectedBranch, isAdminRoute, showDriverPortal]);

  useEffect(() => {
    if (isAdminRoute) return;
    loadBranches();
    registerServiceWorker();

    const socketHost = API_BASE_URL.replace('/api', '');
    const token = localStorage.getItem('customer_token');
    const socket = io(socketHost, {
      auth: { token: token || '' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    const getStoredUserId = (): string | null => {
      if (user?.id) return user.id;
      try {
        const saved = localStorage.getItem('customer_user');
        if (saved) return JSON.parse(saved)?.id || null;
      } catch (_e) {}
      return null;
    };

    const sendAppState = () => {
      const currentUid = getStoredUserId();
      if (!currentUid) return;
      const state = typeof document !== 'undefined' && document.visibilityState === 'visible' ? 'foreground' : 'background';
      socket.emit('app_state', { role: 'STUDENT', id: currentUid, state });
    };

    const handleVisibility = () => {
      sendAppState();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    socket.on('connect', () => {
      const currentUid = getStoredUserId();
      const currentToken = localStorage.getItem('customer_token');
      if (currentUid) {
        socket.emit('join_user', currentUid);
        sendAppState();
        if (currentToken) {
          registerNativeBackgroundSession(currentToken, 'STUDENT', currentUid);
        }
      }
      const curBranch = selectedBranchRef.current;
      if (curBranch?.id) {
        socket.emit('check_branch_presence', curBranch.id, (isOnline: boolean) => {
          setSelectedBranch((prev: any) => (prev && prev.id === curBranch.id ? { ...prev, isOnline: Boolean(isOnline) } : prev));
        });
      }
    });

    if (token) {
      api.getMe().then((res: any) => {
        const fresh = res?.user || res;
        if (fresh && fresh.id) {
          localStorage.setItem('customer_user', JSON.stringify(fresh));
          setUser(fresh);
          socket.emit('join_user', fresh.id);
          registerNativeBackgroundSession(token, 'STUDENT', fresh.id);
          sendAppState();
        }
      }).catch(() => {});
    }

    // 1. تحديث حالة وتفاصيل الفرع لحظياً (مواعيد العمل، الإغلاق/الفتح، الرسوم، طرق الدفع، التواجد)
    socket.on('branch_status_updated', (data: any) => {
      if (!data) return;
      const targetId = data.branchId;
      const targetSlug = data.slug;
      setBranches(prev => prev.map(b => {
        if (b.id === targetId || (targetSlug && b.slug === targetSlug) || b.slug === targetId) {
          const { branchId: _branchId, ...rest } = data;
          return {
            ...b,
            ...rest,
            isOnline: data.isOnline !== undefined ? data.isOnline : b.isOnline,
            paymentConfig: rest.paymentConfig ? { ...b.paymentConfig, ...rest.paymentConfig } : b.paymentConfig,
          };
        }
        return b;
      }));

      setSelectedBranch((prev: any) => {
        if (!prev) return prev;
        const matches =
          prev.id === targetId ||
          (targetSlug && prev.slug === targetSlug) ||
          prev.slug === targetId ||
          (prev.id && targetId && String(prev.id).toLowerCase() === String(targetId).toLowerCase());

        if (matches) {
          if (data.isDeleted) {
            return null;
          }
          const { branchId: _branchId, ...rest } = data;
          return {
            ...prev,
            ...rest,
            isOnline: data.isOnline !== undefined ? data.isOnline : prev.isOnline,
            paymentConfig: rest.paymentConfig ? { ...prev.paymentConfig, ...rest.paymentConfig } : prev.paymentConfig,
          };
        }
        return prev;
      });
    });

    // تحديث اتصال الفرع الحي بالإنترنت لحظياً (فتح/إغلاق السيستم أو انقطاع النت)
    const handleBranchPresence = ({ branchId, slug, isOnline }: { branchId: string; slug?: string; isOnline: boolean }) => {
      setBranches(prev => prev.map(b => (b.id === branchId || (slug && b.slug === slug) || b.slug === branchId ? { ...b, isOnline } : b)));
      setSelectedBranch((prev: any) => {
        if (!prev) return prev;
        const matches =
          prev.id === branchId ||
          (slug && prev.slug === slug) ||
          prev.slug === branchId ||
          (prev.id && branchId && String(prev.id).toLowerCase() === String(branchId).toLowerCase());

        if (matches) {
          const updated = { ...prev, isOnline };
          // عند عودة المطعم أونلاين، يتم استدعاء بيانات المنيو تلقائياً في الخلفية لتحديث الأصناف والحالة فوراً دون الحاجة لريفريش
          if (isOnline) {
            const directKey = prev.slug || prev.id || branchId;
            api.getBranchMenu(directKey).then((data) => {
              if (data && data.branch) {
                setSelectedBranch((latest: any) => {
                  if (!latest) return data.branch;
                  return {
                    ...latest,
                    ...data.branch,
                    isOnline: true,
                    reviews: data.reviews || latest.reviews || [],
                    banners: data.banners || latest.banners || [],
                    flashDeals: data.flashDeals || latest.flashDeals || [],
                    promos: data.promos || latest.promos || [],
                  };
                });
                if (data.categories && Array.isArray(data.categories)) {
                  setBranchCategories(data.categories);
                }
              }
            }).catch(() => {});
          }
          return updated;
        }
        return prev;
      });
      window.dispatchEvent(new CustomEvent('branch_presence_changed', { detail: { branchId, slug, isOnline } }));
    };

    socket.on('branch_presence_changed', handleBranchPresence);

    // 2. تحديث قائمة الفروع فورياً عند إضافة أو حذف فرع من لوحة الإدارة
    socket.on('branches_list_changed', () => {
      loadBranches();
    });

    // 3. تحديث منيو الفرع لحظياً عند إضافة/تعديل/حذف صنف أو قسم أو إضافة
    socket.on('branch_menu_updated', (data: any) => {
      setSelectedBranch((currBranch: any) => {
        if (currBranch && currBranch.id === data.branchId) {
          api.getBranchMenu(data.branchId).then((res) => {
            if (res && res.categories) {
              setBranchCategories(res.categories);
            }
          }).catch(() => {});
        }
        return currBranch;
      });
    });

    // 4. تغيير فوري لحالة توفر الأصناف والإضافات (تفعيل / نفاد فوري من الكاشير)
    socket.on('menu_item_availability_changed', (data: any) => {
      const { branchId: _branchId, type, id, isAvailable, unavailableUntil } = data;
      setBranchCategories((prevCategories: any[]) => {
        if (!Array.isArray(prevCategories)) return prevCategories;
        if (type === 'ITEM') {
          return prevCategories.map((cat: any) => {
            if (!Array.isArray(cat.items)) return cat;
            return {
              ...cat,
              items: cat.items.map((it: any) => {
                if (it.id === id) {
                  return { ...it, isAvailable, unavailableUntil };
                }
                return it;
              }),
            };
          });
        } else if (type === 'MODIFIER') {
          return prevCategories.map((cat: any) => {
            if (!Array.isArray(cat.items)) return cat;
            return {
              ...cat,
              items: cat.items.map((it: any) => {
                if (!Array.isArray(it.modifierGroupLinks)) return it;
                return {
                  ...it,
                  modifierGroupLinks: it.modifierGroupLinks.map((link: any) => {
                    if (!link.group || !Array.isArray(link.group.options)) return link;
                    return {
                      ...link,
                      group: {
                        ...link.group,
                        options: link.group.options.map((opt: any) => {
                          if (opt.id === id) {
                            return { ...opt, isAvailable, unavailableUntil };
                          }
                          return opt;
                        }),
                      },
                    };
                  }),
                };
              }),
            };
          });
        }
        return prevCategories;
      });

      setCustomizingItem((currItem: any) => {
        if (currItem && currItem.id === id && type === 'ITEM') {
          return { ...currItem, isAvailable, unavailableUntil };
        }
        return currItem;
      });
    });

    // 5. تحديث البانرات الإعلانية لحظياً
    socket.on('banners_updated', () => {
      window.dispatchEvent(new CustomEvent('banners_updated'));
      setSelectedBranch((currBranch: any) => {
        if (currBranch && currBranch.id) {
          api.getBranchMenu(currBranch.id).then((res) => {
            if (res && res.branch) {
              setSelectedBranch((prev: any) => ({
                ...prev,
                banners: res.banners || [],
                flashDeals: res.flashDeals || [],
                promos: res.promos || [],
              }));
            }
          }).catch(() => {});
        }
        return currBranch;
      });
    });

    // 5.1 تحديث عروض الفلاش والكميات المستهلكة/المتبقية لحظياً لجميع العملاء
    socket.on('flash_deals_updated', () => {
      window.dispatchEvent(new CustomEvent('flash_deals_updated'));
      setSelectedBranch((currBranch: any) => {
        if (currBranch && currBranch.id) {
          api.getBranchMenu(currBranch.id).then((res) => {
            if (res && res.categories) {
              setBranchCategories(res.categories);
              setSelectedBranch((prev: any) => ({
                ...prev,
                banners: res.banners || [],
                flashDeals: res.flashDeals || [],
                promos: res.promos || [],
              }));
            }
          }).catch(() => {});
        }
        return currBranch;
      });
    });

    // 5.2 تحديث السلة الجماعية المشتركة فور إغلاقها من المنشئ
    socket.on('group_cart_updated', (data: any) => {
      if (data?.isClosed) {
        setGroupCartCode((currentCode) => {
          if (currentCode === data.shareCode) {
            localStorage.removeItem('active_group_cart_code');
            alert('تم إغلاق السلة الجماعية من قِبل المنشئ وتوقيف رابط المشاركة.');
            setShowGroupCartModal(false);
            return null;
          }
          return currentCode;
        });
      }
    });

    // 6. تحديث رصيد المحفظة ونقاط الولاء أو حظر الحساب للعميل فورياً
    socket.on('user_profile_updated', (data: any) => {
      setUser((prevUser: any) => {
        if (!prevUser) return prevUser;
        if (data.userId && data.userId !== prevUser.id && data.id !== prevUser.id) return prevUser;
        const merged = { ...prevUser, ...data };
        localStorage.setItem('customer_user', JSON.stringify(merged));
        return merged;
      });
    });

    // 7. تحديث شاشة تتبع الطلب المفتوحة لحظياً عند قبول الطلب أو إسناد الطيار أو تغيير الحالة
    socket.on('order_status_updated', (updatedOrder: any) => {
      if (!updatedOrder || !updatedOrder.id) return;
      window.dispatchEvent(new CustomEvent('order_status_updated', { detail: updatedOrder }));
      setTrackingOrder((prevOrder: any) => {
        if (!prevOrder || prevOrder.id !== updatedOrder.id) return prevOrder;
        return {
          ...prevOrder,
          ...updatedOrder,
          branch: updatedOrder.branch || prevOrder.branch,
          items: updatedOrder.items || prevOrder.items,
        };
      });
    });

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      socket.disconnect();
    };
  }, [isAdminRoute]);

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (user?.id && token) {
      registerNativeBackgroundSession(token, 'STUDENT', user.id);
    }
  }, [user?.id]);

  if (isAdminRoute) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold" dir="rtl">جاري تحميل لوحة التحكم...</div>}>
        <AdminPage />
      </React.Suspense>
    );
  }

  if (showDriverPortal) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold" dir="rtl">جاري تحميل بوابة كابتن التوصيل...</div>}>
        <DriverPortal onClose={() => setShowDriverPortal(false)} />
        {showSplash && (
          <SplashScreen
            branches={branches}
            isReady={true}
            onFinish={() => setShowSplash(false)}
          />
        )}
      </React.Suspense>
    );
  }

  if (isApkRoute) {
    return (
      <InstallApkPage
        initialSlug={apkSlug}
        onNavigateHome={() => {
          setIsApkRoute(false);
          const url = new URL(window.location.href);
          url.pathname = '/';
          url.search = '';
          window.history.pushState({}, '', url.toString());
        }}
      />
    );
  }

  const handleLogout = () => {
    clearNativeBackgroundSession();
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  const handleOpenGroupCartClick = () => {
    if (!user) {
      setPendingOpenGroupCart(true);
      setShowAuthModal(true);
      return;
    }
    setShowGroupCartModal(true);
  };

  const handleActiveGroupCodeChange = (code: string | null) => {
    if (code) {
      localStorage.setItem('active_group_cart_code', code);
      setGroupCartCode(code);
    } else {
      localStorage.removeItem('active_group_cart_code');
      setGroupCartCode(null);
    }
  };

  const savedItemScrollYRef = useRef<number>(0);
  const savedItemIdRef = useRef<string | null>(null);

  const restoreItemScroll = () => {
    if (typeof window === 'undefined') return;
    const savedYStr = sessionStorage.getItem('unifood_last_item_scroll_y');
    const savedItemId = sessionStorage.getItem('unifood_last_item_id') || savedItemIdRef.current;
    const savedY = savedYStr ? parseInt(savedYStr, 10) : savedItemScrollYRef.current;

    const performRestore = () => {
      if (savedY > 0) {
        window.scrollTo({ top: savedY, behavior: 'instant' });
        document.documentElement.scrollTop = savedY;
        document.body.scrollTop = savedY;
      }
      if (savedItemId) {
        const el = document.getElementById(`menu-item-card-${savedItemId}`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
      }
    };

    performRestore();
    requestAnimationFrame(() => {
      performRestore();
      setTimeout(performRestore, 40);
      setTimeout(performRestore, 120);
      setTimeout(performRestore, 250);
    });
  };

  const handleAddToCart = async (itemToAdd: any) => {
    // إذا كان العميل مشتركاً حالياً في "السلة الجماعية"، نضيف الصنف مباشرة لحسابه في السلة الجماعية!
    if (groupCartCode && user) {
      try {
        await api.addGroupCartItem(groupCartCode, {
          studentName: user.name,
          menuItemId: itemToAdd.menuItemId || itemToAdd.id,
          itemName: itemToAdd.itemName || itemToAdd.name,
          sizeName: itemToAdd.sizeName,
          unitPrice: itemToAdd.unitPrice,
          quantity: itemToAdd.quantity || 1,
          notes: itemToAdd.notes,
          selectedModifiers: itemToAdd.selectedModifiers,
        });
        setShowGroupCartModal(true);
        return;
      } catch (err: any) {
        alert(err.message || 'فشل إضافة الصنف للسلة الجماعية');
      }
    }
    setCart([...cart, { ...itemToAdd, branchId: selectedBranch.id }]);
    restoreItemScroll();
  };

  const handleReorder = async (order: any) => {
    try {
      const data = await api.getBranchMenu(order.branchId);
      if (data?.branch) {
        setSelectedBranch(data.branch);
        setBranchCategories(data.categories || []);
      }
    } catch (_e) {
      let targetBranch = branches.find((b: any) => b.id === order.branchId);
      if (!targetBranch) {
        try {
          const allBranches = await api.getBranches();
          targetBranch = (allBranches || []).find((b: any) => b.id === order.branchId);
        } catch (_err) {}
      }
      if (targetBranch) {
        setSelectedBranch(targetBranch);
      }
    }

    const reorderedItems = (order.items || []).map((it: any) => {
      let mods = [];
      if (it.selectedModifiers) {
        try {
          mods = typeof it.selectedModifiers === 'string' ? JSON.parse(it.selectedModifiers) : it.selectedModifiers;
        } catch (e) {}
      }
      return {
        menuItemId: it.menuItemId,
        id: it.menuItemId,
        name: it.itemName,
        itemName: it.itemName,
        sizeName: it.sizeName,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        quantity: it.quantity,
        selectedModifiers: mods,
        notes: it.notes,
        branchId: order.branchId,
      };
    });

    setCart(reorderedItems);
    setShowMyOrdersModal(false);
    setShowCartModal(true);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 flex flex-col font-sans">
      {/* إشعار التفعيل السريع لحساب العميل */}
      {activationToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-bounce border border-emerald-400">
          <div className="flex items-center gap-2.5 text-xs font-black">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
            <span>{activationToast}</span>
          </div>
          <button
            onClick={() => setActivationToast(null)}
            className="p-1 hover:bg-emerald-700 rounded-lg text-white/80 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Mobile/Desktop Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-4 py-2.5 shadow-sm w-full">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          {/* Right: Logo & Restaurant Brand */}
          <div
            onClick={() => {
              if (isDedicatedRestaurantApp) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                handleReturnHome();
              }
            }}
            className="cursor-pointer shrink-0 flex items-center gap-2"
            title={selectedBranch ? selectedBranch.name : 'الرئيسية — منصة UniFood'}
          >
            {isDedicatedRestaurantApp && selectedBranch?.logoUrl ? (
              <>
                <img
                  src={getFullImageUrl(selectedBranch.logoUrl)}
                  alt={selectedBranch.name}
                  className="w-8 h-8 rounded-xl object-cover border border-slate-200 shadow-2xs"
                />
                <span className="font-black text-xs sm:text-sm text-slate-900 truncate max-w-[150px] sm:max-w-xs">
                  {selectedBranch.name}
                </span>
              </>
            ) : (
              <Logo size="sm" />
            )}
          </div>

          {/* Left: User & Orders Tools (All h-9 shrink-0 so nothing ever overlaps) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Group Cart Button (only shown inside branch view) */}
            {selectedBranch && (
              <button
                onClick={handleOpenGroupCartClick}
                className={`h-9 px-2 sm:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                  groupCartCode
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100'
                }`}
                title="مشاركة سلة جماعية مع أصدقائك"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">طلب جماعي</span>
                {groupCartCode && (
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse shrink-0" />
                )}
              </button>
            )}

            {/* Quick Cart Button (shown on home screen or desktop) */}
            {cart.length > 0 && !selectedBranch && (
              <button
                onClick={() => {
                  const b = branches.find(item => item.id === cart[0]?.branchId);
                  if (b) {
                    handleSelectBranch(b).then(() => setShowCartModal(true));
                  }
                }}
                className="relative h-9 px-2 sm:px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all active:scale-95 shrink-0"
                title="عرض سلة الطلبات"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">السلة</span>
                <span className="bg-white text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </button>
            )}

            {/* Header User & Auth Tools (Shown inside Branch view, or if SuperAdmin on home) */}
            {selectedBranch ? (
              user ? (
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {user.role === 'SUPERADMIN' && (
                    <button
                      onClick={() => {
                        window.location.href = '/admin';
                      }}
                      className="h-9 px-2 sm:px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                      title="فتح لوحة تحكم إدارة المنظومة"
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0 text-amber-300" />
                      <span className="hidden sm:inline">لوحة الإدارة</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowMyOrdersModal(true)}
                    className="h-9 px-2 sm:px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shrink-0 cursor-pointer"
                    title="طلباتي السابقة والحالية"
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>طلباتي</span>
                  </button>

                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="h-9 px-2 sm:px-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="حسابي والمحفظة ونقاط الولاء"
                  >
                    <User className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="hidden sm:inline max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
                    <span className="flex bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-lg text-[10px] font-black items-center gap-0.5 leading-none shrink-0">
                      <span>★</span>
                      <span>{user.loyaltyPoints ?? 0}</span>
                    </span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="h-9 px-2 sm:px-2.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 rounded-xl flex items-center justify-center gap-1 text-xs font-bold transition-colors shrink-0 cursor-pointer"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">خروج</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="h-9 px-2.5 sm:px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center transition-all shrink-0 cursor-pointer"
                >
                  دخول / حساب
                </button>
              )
            ) : (
              /* في الصفحة الرئيسية: إخفاء أزرار تسجيل الدخول، وإظهار لوحة الإدارة فقط للمسؤولين */
              user?.role === 'SUPERADMIN' ? (
                <button
                  onClick={() => {
                    window.location.href = '/admin';
                  }}
                  className="h-9 px-2.5 sm:px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                  title="فتح لوحة تحكم إدارة المنظومة"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-300" />
                  <span>لوحة الإدارة</span>
                </button>
              ) : null
            )}
          </div>
        </div>
      </header>

      {/* Active Group Cart Persistent Banner */}
      {groupCartCode && user && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white px-3 sm:px-4 py-2.5 shadow-md w-full">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <Users className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                أنت الآن في <strong>السلة الجماعية ({groupCartCode})</strong> — أي وجبة تضيفها من المنيو ستنزل في طلبك!
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowGroupCartModal(true)}
                className="px-2.5 py-1 bg-white text-purple-800 hover:bg-purple-50 rounded-lg font-black transition-all whitespace-nowrap"
              >
                فتح السلة
              </button>
              <button
                onClick={() => handleActiveGroupCodeChange(null)}
                className="px-2 py-1 bg-black/25 hover:bg-black/40 text-white rounded-lg font-bold transition-all whitespace-nowrap"
              >
                مغادرة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 max-w-3xl w-full mx-auto overflow-x-hidden ${
        selectedBranch
          ? 'pt-1.5 px-3 pb-3 sm:pt-2 sm:px-4 sm:pb-4'
          : 'p-3 sm:p-4'
      }`}>
        {selectedBranch ? (
          <BranchMenu
            branch={selectedBranch}
            categories={branchCategories}
            cart={cart}
            user={user}
            onBack={handleReturnHome}
            onSelectItem={(item) => {
              const currentY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
              savedItemScrollYRef.current = currentY;
              savedItemIdRef.current = item?.id || null;
              try {
                sessionStorage.setItem('unifood_last_item_scroll_y', String(currentY));
                if (item?.id) {
                  sessionStorage.setItem('unifood_last_item_id', String(item.id));
                }
              } catch (_e) {}
              setCustomizingItem(item);
            }}
            onOpenCart={() => setShowCartModal(true)}
            onTrackOrder={(order) => setTrackingOrder(order)}
            onQuickReorder={handleReorder}
            onRequireAuth={() => setShowAuthModal(true)}
            onLogout={handleLogout}
            onOpenMyOrders={() => setShowMyOrdersModal(true)}
            onOpenProfile={() => setShowProfileModal(true)}
          />
        ) : (requestedBranchKey || isDedicatedRestaurantApp) ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500 py-16 animate-fadeIn">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-600">جاري فتح قائمة المطعم...</span>
          </div>
        ) : (
          <LandingPage
            branches={branches}
            onSelectBranch={handleSelectBranch}
            user={user}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenMyOrders={() => setShowMyOrdersModal(true)}
            onOpenProfile={() => setShowProfileModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      {customizingItem && (
        <ItemCustomizeModal
          item={customizingItem}
          onAddToCart={handleAddToCart}
          onClose={() => {
            setCustomizingItem(null);
            restoreItemScroll();
          }}
        />
      )}

      {showCartModal && selectedBranch && (
        <CartCheckoutModal
          cart={cart}
          branch={selectedBranch}
          user={user}
          groupCartDetails={groupCartDetailsForCheckout}
          onUpdateCart={setCart}
          onRequireAuth={() => setShowAuthModal(true)}
          onOrderSuccess={(createdOrder) => {
            setTrackingOrder(createdOrder);
            window.dispatchEvent(new CustomEvent('order_created', { detail: createdOrder }));
            setGroupCartDetailsForCheckout(null);
            handleActiveGroupCodeChange(null);
            try {
              localStorage.setItem('unifood_last_order', JSON.stringify(createdOrder));
              const saved = localStorage.getItem('customer_user');
              if (saved) setUser(JSON.parse(saved));
            } catch (_e) {}
          }}
          onClose={() => {
            setShowCartModal(false);
            setGroupCartDetailsForCheckout(null);
          }}
        />
      )}

      {showGroupCartModal && user && (
        <GroupCartModal
          branchId={selectedBranch?.id || branches[0]?.id || ''}
          branchName={selectedBranch?.name || branches[0]?.name || 'المطعم'}
          branches={branches}
          user={user}
          initialCode={groupCartCode}
          onClose={() => {
            setShowGroupCartModal(false);
          }}
          onActiveCodeChange={(code) => handleActiveGroupCodeChange(code)}
          onBrowseBranchMenu={(targetBranchId) => {
            setShowGroupCartModal(false);
            const target = branches.find((b: any) => b.id === targetBranchId) || selectedBranch || branches[0];
            if (target) {
              handleSelectBranch(target);
            }
          }}
          onCheckoutGroupCart={async (groupData) => {
            let target = branches.find((b: any) => b.id === groupData.branchId) || selectedBranch;
            if (!target || target.id !== groupData.branchId) {
              try {
                const menuRes = await api.getBranchMenu(groupData.branchId);
                if (menuRes?.branch) {
                  target = menuRes.branch;
                  setSelectedBranch(menuRes.branch);
                  setBranchCategories(menuRes.categories || []);
                }
              } catch {}
            } else {
              setSelectedBranch(target);
            }
            setCart(groupData.items);
            setGroupCartDetailsForCheckout(groupData.groupCartDetails);
            setShowGroupCartModal(false);
            setShowCartModal(true);
          }}
        />
      )}

      {showProfileModal && user && (
        <ProfileModal
          user={user}
          socket={socketRef.current}
          onUpdateUser={(updated) => setUser(updated)}
          onClose={() => setShowProfileModal(false)}
          onLogout={handleLogout}
        />
      )}

      {trackingOrder && (
        <OrderTrackingModal
          order={trackingOrder}
          onOrderUpdated={(updatedOrder) => {
            setTrackingOrder(updatedOrder);
            window.dispatchEvent(new CustomEvent('order_status_updated', { detail: updatedOrder }));
            try {
              const saved = localStorage.getItem('customer_user');
              if (saved) setUser(JSON.parse(saved));
            } catch (_e) {}
            if (updatedOrder.status === 'REJECTED') {
              api.getMe().then(res => {
                if (res?.user) {
                  localStorage.setItem('customer_user', JSON.stringify(res.user));
                  setUser(res.user);
                }
              }).catch(() => {});
            }
          }}
          onClose={() => setTrackingOrder(null)}
        />
      )}

      {showMyOrdersModal && (
        <MyOrdersModal
          onSelectOrderToTrack={(o) => setTrackingOrder(o)}
          onReorder={handleReorder}
          onClose={() => setShowMyOrdersModal(false)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onSuccess={(u) => {
            setUser(u);
            if (pendingOpenGroupCart) {
              setPendingOpenGroupCart(false);
              setShowGroupCartModal(true);
            }
          }}
          onClose={() => {
            setShowAuthModal(false);
            setPendingOpenGroupCart(false);
          }}
        />
      )}

      {/* Orbiting Restaurant Logos & Food Rain Mobile Splash Screen */}
      {showSplash && (
        <SplashScreen
          branches={branches}
          isReady={!loading || branches.length > 0}
          onFinish={() => setShowSplash(false)}
        />
      )}

      {/* Exit App Confirmation Dialog */}
      {showExitAppDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-scaleUp border border-slate-100 text-center overscroll-contain">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <LogOut className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-slate-900 text-base">
                {selectedBranch ? `الخروج من تطبيق ${selectedBranch.name}` : 'الخروج من تطبيق UniFood'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {selectedBranch
                  ? `هل أنت متأكد من رغبتك في إغلاق تطبيق ${selectedBranch.name} والخروج الآن؟`
                  : 'هل أنت متأكد من رغبتك في إغلاق التطبيق والخروج الآن؟'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitAppDialog(false);
                  try {
                    window.history.pushState({ uniFoodStep: 1 }, '');
                  } catch {}
                }}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                البقاء في التطبيق
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>نعم، إغلاق</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
