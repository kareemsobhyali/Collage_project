import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Store, 
  User, 
  ShoppingBag, 
  Clock, 
  LogOut, 
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Sparkles,
  Smartphone,
  X,
  CheckCircle2
} from 'lucide-react';
import { api, API_BASE_URL } from './services/api';
import { registerServiceWorker, isRunningInNativeApk, triggerInstallApp } from './services/notifications';
import { BranchList } from './components/BranchList';
import { BranchMenu } from './components/BranchMenu';
import { AuthModal } from './components/AuthModal';
import { ItemCustomizeModal } from './components/ItemCustomizeModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { MyOrdersModal } from './components/MyOrdersModal';
import { ProfileModal } from './components/ProfileModal';
import { AdminPage } from './components/AdminPage';
import { DriverPortal } from './components/DriverPortal';
import { GroupCartModal } from './components/GroupCartModal';
import { Logo } from './components/Logo';
import { SplashScreen } from './components/SplashScreen';

export function App() {
  const isMobileAppExperience = typeof window !== 'undefined' && (
    isRunningInNativeApk() ||
    window.location.search.includes('splash') ||
    window.location.search.includes('app')
  );
  const [showSplash, setShowSplash] = useState(isMobileAppExperience);
  const [branches, setBranches] = useState<any[]>([]);
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
      const saved = localStorage.getItem('customer_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // منع تسرب حساب المدير العام (SUPERADMIN) إلى واجهة الطلاب نهائياً
      if (parsed.role === 'SUPERADMIN' || parsed.phone === 'admin') {
        localStorage.removeItem('customer_user');
        localStorage.removeItem('customer_token');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [branchCategories, setBranchCategories] = useState<any[]>([]);
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
    // Clear any previous documentElement lock to ensure smooth scrolling
    if (document.documentElement.style.overflow) {
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    }

    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isAnyModalOpen]);

  // إدارة زر الرجوع في الهاتف (Android Back Button & In-App Navigation)
  const isHandlingPopstateRef = useRef(false);
  const historyDepthRef = useRef(0);

  // تهيئة حارس الرجوع الأولي لمنع الخروج المفاجئ
  useEffect(() => {
    if (typeof window === 'undefined' || isAdminRoute || showDriverPortal) return;
    try {
      window.history.replaceState({ uniFoodRoot: true, depth: 0 }, '');
      window.history.pushState({ uniFoodStep: 1, depth: 1 }, '');
      historyDepthRef.current = 1;
    } catch (_e) {}
  }, [isAdminRoute, showDriverPortal]);

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
    if (isAdminRoute || showDriverPortal) return;
    const handlePopState = () => {
      isHandlingPopstateRef.current = true;
      historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);

      // أولاً: إذا كانت نافذة الخروج مفتوحة، أغلقها
      if (showExitAppDialog) {
        setShowExitAppDialog(false);
      }
      // ثانياً: إغلاق النوافذ المنبثقة بترتيب أسبقيتها (الأحدث فالأقدم)
      else if (customizingItem) {
        setCustomizingItem(null);
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
      // ثالثاً: إذا كان المستخدم داخل منيو فرع، الرجوع لشاشة الفروع الرئيسية
      else if (selectedBranch) {
        setSelectedBranch(null);
      }
      // رابعاً: إذا كان في الشاشة الرئيسية ولا توجد أي شاشة فرعية -> إظهار تأكيد الخروج
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
    showExitAppDialog,
    customizingItem,
    showCartModal,
    showGroupCartModal,
    showProfileModal,
    trackingOrder,
    showMyOrdersModal,
    showAuthModal,
    selectedBranch
  ]);

  const handleConfirmExit = () => {
    setShowExitAppDialog(false);
    if (typeof window !== 'undefined') {
      if ((window.navigator as any)?.app?.exitApp) {
        (window.navigator as any).app.exitApp();
        return;
      }
      try {
        window.close();
      } catch (_e) {}
      try {
        window.history.go(-10);
      } catch (_e) {}
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

  // إذا دخل الطالب برابط دعوة لسلة الشلة: يفتح السلة إن كان مسجلاً، أو يطلب تسجيل الدخول أولاً
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

  // عند اختيار فرع، جلب المنيو الخاص به مع إمكانية فتح صنف/عرض محدد تلقائياً
  const handleSelectBranch = async (branch: any, autoOpenItemId?: string | null) => {
    try {
      setLoading(true);
      const data = await api.getBranchMenu(branch.id);
      setSelectedBranch(data.branch);
      setBranchCategories(data.categories || []);
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

      // فحص إذا كان الرابط يحتوي على معرّف مباشر لمطعم (Slug أو ID) أو صنف/عرض
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const branchParam = params.get('branch') || params.get('r');
        const itemParam = params.get('item') || params.get('offer');

        if (branchParam) {
          const normalized = branchParam.trim().toLowerCase();
          const target = loadedBranches.find(
            (b: any) =>
              b.id === branchParam ||
              (b.slug && b.slug.toLowerCase() === normalized)
          );
          if (target) {
            handleSelectBranch(target, itemParam);
          } else {
            // محاولة جلب الفرع مباشرة من الـ Backend عبر الـ slug أو الـ id
            api.getBranchMenu(branchParam)
              .then((menuData) => {
                if (menuData && menuData.branch) {
                  setSelectedBranch(menuData.branch);
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

  useEffect(() => {
    if (isAdminRoute) return;
    loadBranches();
    registerServiceWorker();

    const socketHost = API_BASE_URL.replace('/api', '');
    const token = localStorage.getItem('customer_token');
    const socket = io(socketHost, {
      auth: { token: token || '' },
    });

    if (token) {
      api.getMe().then((res: any) => {
        const fresh = res?.user || res;
        if (fresh && fresh.id) {
          localStorage.setItem('customer_user', JSON.stringify(fresh));
          setUser(fresh);
          socket.emit('join_user', fresh.id);
        }
      }).catch(() => {});
    }

    // 1. تحديث حالة وتفاصيل الفرع لحظياً (مواعيد العمل، الإغلاق/الفتح، الرسوم، طرق الدفع)
    socket.on('branch_status_updated', (data: any) => {
      setBranches(prev => prev.map(b => {
        if (b.id === data.branchId) {
          const { branchId, ...rest } = data;
          return {
            ...b,
            ...rest,
            paymentConfig: rest.paymentConfig ? { ...b.paymentConfig, ...rest.paymentConfig } : b.paymentConfig,
          };
        }
        return b;
      }));

      setSelectedBranch((prev: any) => {
        if (prev && prev.id === data.branchId) {
          if (data.isDeleted) {
            return null;
          }
          const { branchId, ...rest } = data;
          return {
            ...prev,
            ...rest,
            paymentConfig: rest.paymentConfig ? { ...prev.paymentConfig, ...rest.paymentConfig } : prev.paymentConfig,
          };
        }
        return prev;
      });
    });

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
      const { branchId, type, id, isAvailable, unavailableUntil } = data;
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
    });

    // 6. تحديث رصيد المحفظة ونقاط الولاء أو حظر الحساب للطالب فورياً
    socket.on('user_profile_updated', (data: any) => {
      setUser((prevUser: any) => {
        if (!prevUser) return prevUser;
        if (data.userId && data.userId !== prevUser.id && data.id !== prevUser.id) return prevUser;
        const merged = { ...prevUser, ...data };
        localStorage.setItem('customer_user', JSON.stringify(merged));
        return merged;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAdminRoute]);

  if (isAdminRoute) {
    return <AdminPage />;
  }

  if (showDriverPortal) {
    return (
      <>
        <DriverPortal onClose={() => setShowDriverPortal(false)} />
        {showSplash && (
          <SplashScreen
            branches={branches}
            isReady={true}
            onFinish={() => setShowSplash(false)}
          />
        )}
      </>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
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

  const handleAddToCart = async (itemToAdd: any) => {
    // إذا كان الطالب مشتركاً حالياً في "سلة الشلة"، نضيف الصنف مباشرة لكيسه في سلة الشلة!
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
        alert(err.message || 'فشل إضافة الصنف لسلة الشلة');
      }
    }
    setCart([...cart, { ...itemToAdd, branchId: selectedBranch.id }]);
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
      {/* إشعار التفعيل السريع لحساب الطالب */}
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
          {/* Right: Logo */}
          <div
            onClick={() => setSelectedBranch(null)}
            className="cursor-pointer shrink-0"
          >
            <Logo size="sm" />
          </div>

          {/* Left: User & Orders Tools (All h-9 shrink-0 so nothing ever overlaps) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Direct Student App Install / APK Button (hidden inside APK) */}
            {!isRunningInNativeApk() && (
              <button
                type="button"
                onClick={() => triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Student.apk')}
                className="h-9 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                title="تثبيت تطبيق الطلاب للأندرويد"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">تثبيت التطبيق</span>
              </button>
            )}

            {/* Group Cart Button */}
            <button
              onClick={handleOpenGroupCartClick}
              className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                groupCartCode
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100'
              }`}
              title="مشاركة سلة جماعية مع أصحابك (سلة الشلة)"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>سلة الشلة</span>
              {groupCartCode && (
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse shrink-0" />
              )}
            </button>

            {/* Quick Cart Button (shown on home screen or desktop) */}
            {cart.length > 0 && !selectedBranch && (
              <button
                onClick={() => {
                  const b = branches.find(item => item.id === cart[0]?.branchId);
                  if (b) {
                    handleSelectBranch(b).then(() => setShowCartModal(true));
                  }
                }}
                className="relative h-9 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 shrink-0"
                title="عرض سلة الطلبات"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">السلة</span>
                <span className="bg-white text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowMyOrdersModal(true)}
                  className="h-9 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                  title="طلباتي السابقة والحالية"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">طلباتي</span>
                </button>

                <button
                  onClick={() => setShowProfileModal(true)}
                  className="h-9 px-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="حسابي والمحفظة الجامعية ونقاط الولاء"
                >
                  <User className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="hidden sm:inline max-w-[90px] truncate">{user.name.split(' ')[0]}</span>
                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-0.5 leading-none shrink-0">
                    <span>★</span>
                    <span>{user.loyaltyPoints ?? 0}</span>
                  </span>
                </button>

                <button
                  onClick={handleLogout}
                  className="h-9 w-9 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 rounded-xl flex items-center justify-center transition-colors shrink-0"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-sm flex items-center justify-center transition-all shrink-0"
              >
                دخول / حساب
              </button>
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
                أنت الآن في <strong>سلة الشلة ({groupCartCode})</strong> — أي وجبة تضيفها من المنيو ستنزل في كيسك!
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
      <main className="flex-1 p-3 sm:p-4 max-w-3xl w-full mx-auto overflow-x-hidden">
        {selectedBranch ? (
          <BranchMenu
            branch={selectedBranch}
            categories={branchCategories}
            cart={cart}
            onBack={() => setSelectedBranch(null)}
            onSelectItem={(item) => setCustomizingItem(item)}
            onOpenCart={() => setShowCartModal(true)}
          />
        ) : (
          <BranchList
            branches={branches}
            onSelectBranch={handleSelectBranch}
          />
        )}
      </main>

      {/* Modals */}
      {customizingItem && (
        <ItemCustomizeModal
          item={customizingItem}
          onAddToCart={handleAddToCart}
          onClose={() => setCustomizingItem(null)}
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
            setGroupCartDetailsForCheckout(null);
            handleActiveGroupCodeChange(null);
            try {
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
          branchName={selectedBranch?.name || branches[0]?.name || 'مطعم الجامعة'}
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
          onUpdateUser={(updated) => setUser(updated)}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {trackingOrder && (
        <OrderTrackingModal
          order={trackingOrder}
          onOrderUpdated={(updatedOrder) => {
            setTrackingOrder(updatedOrder);
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
                الخروج من تطبيق UniFood
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                هل أنت متأكد من رغبتك في إغلاق التطبيق والخروج الآن؟
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowExitAppDialog(false)}
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
