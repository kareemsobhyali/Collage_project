import React, { useState, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Phone, 
  GraduationCap, 
  AlertCircle,
  Edit2,
  Wallet,
  Sparkles,
  ArrowLeftRight,
  Bell,
  BellRing,
  Gift,
  Navigation,
  Headphones,
  LifeBuoy,
  ShieldAlert,
  MessageCircle,
  MessageSquarePlus,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Receipt
} from 'lucide-react';
import { api } from '../services/api';
import { 
  getNotificationPermissionState, 
  requestPushPermission, 
  sendWebNotification 
} from '../services/notifications';
import { 
  getNearestLocationName, 
  formatAddressWithCoordinates, 
  cleanAddressText,
  getDisplayAddress,
  extractCoordinatesFromAddress
} from '../services/campusLocations';

const SUPPORT_CATEGORIES = [
  { id: 'ORDER_ISSUE', label: 'مشكلة في طلب سابق', desc: 'تأخر في الاستلام، نقص في الوجبة، أو طلب غير صحيح', icon: '🛍️' },
  { id: 'PAYMENT_ISSUE', label: 'الدفع أو المحفظة', desc: 'خصم خاطئ، رصيد المحفظة، أو استرداد المبلغ', icon: '💳' },
  { id: 'TECH_ISSUE', label: 'عطل تقني في التطبيق', desc: 'مشكلة فنية، شاشة لا تستجيب، أو تعليق في النظام', icon: '⚙️' },
  { id: 'GENERAL', label: 'استفسار عام ومساعدة', desc: 'سؤال حول الخدمة، مواعيد العمل، أو شروط التوصيل', icon: '❓' },
  { id: 'SUGGESTION', label: 'اقتراح وتطوير', desc: 'فكرة أو ميزة ترغب في إضافتها لتطوير التطبيق', icon: '💡' },
] as const;

interface ProfileModalProps {
  user: any;
  onUpdateUser: (updatedUser: any) => void;
  onClose: () => void;
  onLogout?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onUpdateUser,
  onClose,
  onLogout,
}) => {
  const [name, setName] = useState(user.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // Wallet & Loyalty Points State
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(user.loyaltyPoints || 0);
  const [walletBalance, setWalletBalance] = useState<number>(user.walletBalance || 0);
  const [rewardHistory, setRewardHistory] = useState<any[]>([]);
  const [convertingPoints, setConvertingPoints] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);

  // Push Notification State
  const [notifPermission, setNotifPermission] = useState<string>(getNotificationPermissionState());

  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [capturedGps, setCapturedGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsSuccessMsg, setGpsSuccessMsg] = useState<string | null>(null);

  // Support Ticket State
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportCategory, setSupportCategory] = useState<'GENERAL' | 'ORDER_ISSUE' | 'PAYMENT_ISSUE' | 'TECH_ISSUE' | 'SUGGESTION'>('GENERAL');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportOrderNumber, setSupportOrderNumber] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportSuccessMsg, setSupportSuccessMsg] = useState<string | null>(null);
  const [supportErrorMsg, setSupportErrorMsg] = useState<string | null>(null);
  const [supportWhatsappData, setSupportWhatsappData] = useState<{ whatsappPhone: string; whatsappUrl: string }>({
    whatsappPhone: '01016629986',
    whatsappUrl: 'https://wa.me/201016629986',
  });

  // Customer Orders for Support Modal Combobox
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const [manualOrderInputMode, setManualOrderInputMode] = useState(false);

  // Fetch customer orders when ORDER_ISSUE is selected
  useEffect(() => {
    if (showSupportModal && supportCategory === 'ORDER_ISSUE' && customerOrders.length === 0 && !loadingCustomerOrders) {
      setLoadingCustomerOrders(true);
      api.getMyOrders()
        .then((orders) => {
          if (Array.isArray(orders)) {
            setCustomerOrders(orders);
          }
        })
        .catch((err) => {
          console.error('Failed to load orders for support combobox:', err);
        })
        .finally(() => {
          setLoadingCustomerOrders(false);
        });
    }
  }, [showSupportModal, supportCategory]);

  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order);
    setSupportOrderNumber(String(order.orderNumber));
    setIsOrderDropdownOpen(false);
    setManualOrderInputMode(false);
    if (!supportSubject.trim() || supportSubject.startsWith('مشكلة في طلب')) {
      const branchName = order.branch?.name ? ` (${order.branch.name})` : '';
      setSupportSubject(`مشكلة في طلب #${order.orderNumber}${branchName}`);
    }
  };

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Disable background scrolling when ProfileModal opens, restore when it closes
  useEffect(() => {
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) {
      setSupportErrorMsg('يرجى كتابة عنوان المشكلة وتفاصيل الرسالة.');
      return;
    }
    try {
      setSendingSupport(true);
      setSupportErrorMsg(null);
      const res = await api.submitSupportTicket({
        category: supportCategory,
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
        orderNumber: supportOrderNumber.trim() || undefined,
      });
      setSupportSuccessMsg(res.message || 'تم إرسال بلاغك لإدارة المنظومة بنجاح!');
      setSupportSubject('');
      setSupportMessage('');
      setSupportOrderNumber('');
      setSelectedOrder(null);
      setIsOrderDropdownOpen(false);
      setManualOrderInputMode(false);
      setTimeout(() => {
        setShowSupportModal(false);
        setSupportSuccessMsg(null);
      }, 2200);
    } catch (err: any) {
      setSupportErrorMsg(err.message || 'فشل إرسال رسالة الدعم');
    } finally {
      setSendingSupport(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      setDeleteAccountError(null);
      await api.deleteAccount();
      alert('تم حذف حسابك وعناوينك بنجاح.');
      if (onLogout) {
        onLogout();
      } else {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
        window.location.reload();
      }
      onClose();
    } catch (err: any) {
      setDeleteAccountError(err.message || 'فشل حذف الحساب');
    } finally {
      setDeletingAccount(false);
    }
  };

  // تحميل العناوين والبيانات المالية للمحفظة
  const loadProfileData = async () => {
    try {
      setLoadingAddresses(true);
      const [addrData, walletData, supportData] = await Promise.all([
        api.getAddresses().catch(() => []),
        api.getWallet().catch(() => null),
        api.getPublicSupportContact().catch(() => null),
      ]);
      setAddresses(Array.isArray(addrData) ? addrData : []);
      if (supportData?.whatsappUrl) {
        setSupportWhatsappData({
          whatsappPhone: supportData.whatsappPhone || '01016629986',
          whatsappUrl: supportData.whatsappUrl,
        });
      }
      if (walletData) {
        setLoyaltyPoints(walletData.loyaltyPoints ?? 0);
        setWalletBalance(walletData.walletBalance ?? 0);
        setRewardHistory(walletData.history || []);
        const mergedUser = {
          ...user,
          loyaltyPoints: walletData.loyaltyPoints ?? 0,
          walletBalance: walletData.walletBalance ?? 0,
        };
        onUpdateUser(mergedUser);
        localStorage.setItem('customer_user', JSON.stringify(mergedUser));
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const handleConvertPoints = async () => {
    if (loyaltyPoints <= 0) return;
    try {
      setConvertingPoints(true);
      setError(null);
      setWalletMessage(null);
      const res = await api.convertPointsToWallet();
      if (res.user) {
        setLoyaltyPoints(res.user.loyaltyPoints);
        setWalletBalance(res.user.walletBalance);
        onUpdateUser(res.user);
        localStorage.setItem('customer_user', JSON.stringify(res.user));
        setWalletMessage(res.message || 'تم تحويل النقاط إلى رصيد محفظة بنجاح!');
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحويل النقاط');
    } finally {
      setConvertingPoints(false);
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPushPermission();
    setNotifPermission(getNotificationPermissionState());
    if (granted) {
      sendWebNotification(
        '🔔 تم تفعيل إشعارات UniFood!',
        'ستصلك تنبيهات فورية بحالة طلبك وكود الاستلام حتى لو كان المتصفح في الخلفية.',
        '/'
      );
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    try {
      setSavingName(true);
      setError(null);
      const res = await api.updateProfile(name.trim());
      if (res.user) {
        onUpdateUser(res.user);
        localStorage.setItem('customer_user', JSON.stringify(res.user));
        setIsEditingName(false);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحديث الاسم');
    } finally {
      setSavingName(false);
    }
  };

  const handleDetectGpsLocation = (options?: { silent?: boolean }): Promise<{ lat: number; lng: number } | null> => {
    const silent = options?.silent ?? false;
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        if (!silent) {
          setError('خاصية تحديد الموقع الجغرافي غير مدعومة على هذا الجهاز أو المتصفح.');
        }
        resolve(null);
        return;
      }

      setDetectingGps(true);
      if (!silent) setGpsSuccessMsg(null);

      const onGeoSuccess = async (pos: GeolocationPosition) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCapturedGps({ lat, lng });
        try {
          const place = await getNearestLocationName(lat, lng);
          setNewTitle((prev) => (prev.trim() ? prev : place.title));
          setNewDetails((prev) => {
            const cleanPrev = cleanAddressText(prev);
            return formatAddressWithCoordinates(cleanPrev || place.details || place.title, lat, lng);
          });
          setGpsSuccessMsg(`✓ تم ربط موقعك بالـ GPS تلقائياً [${place.title}] مع العنوان المكتوب`);
        } catch (_) {
          setNewTitle((prev) => (prev.trim() ? prev : 'موقعي الحالي'));
          setNewDetails((prev) => {
            const cleanPrev = cleanAddressText(prev);
            return formatAddressWithCoordinates(cleanPrev || 'موقعي الحالي عبر الـ GPS', lat, lng);
          });
          setGpsSuccessMsg('✓ تم ربط موقعك عبر الـ GPS مع العنوان المكتوب');
        } finally {
          setDetectingGps(false);
          resolve({ lat, lng });
        }
      };

      const onGeoFallback = (initialErr?: GeolocationPositionError) => {
        navigator.geolocation.getCurrentPosition(
          onGeoSuccess,
          (fallbackErr) => {
            setDetectingGps(false);
            const errCode = fallbackErr?.code || initialErr?.code;
            if (!silent) {
              if (errCode === 1) {
                setError('تم رفض إذن الوصول للموقع. يُرجى تفعيل صلاحية الـ GPS لربط العنوان المكتوب بالخريطة.');
              } else {
                setError('تعذر تحديد إشارة الـ GPS اللحظية. يرجى التأكد من تفعيل الـ GPS في هاتفك.');
              }
            }
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      };

      navigator.geolocation.getCurrentPosition(
        onGeoSuccess,
        onGeoFallback,
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
      );
    });
  };

  useEffect(() => {
    if (showAddAddress && !capturedGps) {
      handleDetectGpsLocation({ silent: true });
    }
  }, [showAddAddress]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !cleanAddressText(newDetails).trim()) return;

    try {
      setSavingAddress(true);
      setError(null);

      let coords = extractCoordinatesFromAddress(newDetails) || capturedGps;
      if (!coords) {
        coords = await handleDetectGpsLocation({ silent: false });
      }
      if (!coords) {
        setError('لازم يتم التقاط موقعك بالـ GPS بجانب العنوان المكتوب حتى يظهر مكانك للكابتن على الخريطة.');
        setSavingAddress(false);
        return;
      }

      const finalDetailsWithGps = formatAddressWithCoordinates(
        cleanAddressText(newDetails) || newTitle.trim(),
        coords.lat,
        coords.lng
      );

      const created = await api.addAddress(newTitle.trim(), finalDetailsWithGps, isDefault);
      setAddresses(prev => [created, ...prev]);
      setNewTitle('');
      setNewDetails('');
      setIsDefault(false);
      setShowAddAddress(false);
      setGpsSuccessMsg(null);
    } catch (err: any) {
      setError(err.message || 'فشل حفظ العنوان');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.deleteAddress(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'فشل حذف العنوان');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0 z-20" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm">حسابي والمحفظة الجامعية</h3>
              <p className="text-[11px] text-slate-500">نقاط الولاء، رصيد المحفظة، وعناوين التوصيل</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className={`p-5 modal-scroll flex-1 space-y-5 ${showSupportModal || showDeleteConfirm ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'}`}>
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {walletMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{walletMessage}</span>
            </div>
          )}

          {/* Student Wallet & Loyalty Points Card */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white p-4 shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
                  <Wallet className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">محفظة ومكافآت UniFood</h4>
                  <p className="text-[10px] text-indigo-200">1 نقطة ولاء لكل 10 ج.م • كل نقطة = 1 ج.م رصيد</p>
                </div>
              </div>
              <span className="text-[10px] bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Gift className="w-3 h-3" />
                <span>كاش باك 10%</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/15">
                <span className="text-[10px] text-indigo-200 block">رصيد المحفظة النقدي</span>
                <div className="text-xl font-black text-white mt-0.5">
                  {walletBalance.toFixed(0)} <span className="text-xs font-normal">ج.م</span>
                </div>
                <span className="text-[10px] text-emerald-300 font-bold">متاح للخصم الفوري</span>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/15">
                <span className="text-[10px] text-indigo-200 block">نقاط الولاء الحالية</span>
                <div className="text-xl font-black text-amber-300 mt-0.5 flex items-center gap-1">
                  <span>{loyaltyPoints}</span>
                  <span className="text-xs font-normal text-white">نقطة</span>
                </div>
                <span className="text-[10px] text-amber-200 font-bold">تساوي {loyaltyPoints} ج.م</span>
              </div>
            </div>

            <button
              onClick={handleConvertPoints}
              disabled={convertingPoints || loyaltyPoints <= 0}
              className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm ${
                loyaltyPoints > 0
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer active:scale-98'
                  : 'bg-white/10 text-indigo-200 cursor-not-allowed'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>
                {convertingPoints
                  ? 'جاري التحويل...'
                  : loyaltyPoints > 0
                  ? `تحويل ${loyaltyPoints} نقطة إلى ${loyaltyPoints} ج.م في المحفظة`
                  : 'اطلب الآن لاكتساب نقاط ولاء جديدة'}
              </span>
            </button>

            {rewardHistory.length > 0 && (
              <div className="pt-2 border-t border-white/15 space-y-1.5 max-h-28 overflow-y-auto no-scrollbar">
                <div className="text-[10px] font-bold text-indigo-200">آخر حركات المكافآت:</div>
                {rewardHistory.slice(0, 4).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-[11px] bg-white/5 px-2.5 py-1.5 rounded-xl">
                    <span className="text-indigo-100 truncate">
                      طلب #{item.orderNumber} ({item.branch?.name || 'مطعم'})
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.pointsEarned > 0 && (
                        <span className="text-amber-300 font-bold">+{item.pointsEarned} نقطة</span>
                      )}
                      {item.walletDiscount > 0 && (
                        <span className="text-rose-300 font-bold">-{item.walletDiscount} ج.م محفظة</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Info & Web Push Notification Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">الاسم:</span>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="p-1 bg-indigo-600 text-white rounded-lg text-xs"
                      title="حفظ"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setName(user.name);
                        setIsEditingName(false);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900 text-xs">{user.name}</span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-100 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                <span>طالب جامعي</span>
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{user.phone}</span>
              </div>

              {notifPermission === 'granted' ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                  <BellRing className="w-3 h-3" />
                  <span>إشعارات الخلفية مفعلة</span>
                </span>
              ) : notifPermission !== 'unsupported' ? (
                <button
                  onClick={handleEnableNotifications}
                  className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                  <Bell className="w-3 h-3" />
                  <span>تفعيل إشعارات الهاتف</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Saved Addresses Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-800">
                  عناويني الجامعية المحفوظة ({addresses.length})
                </h4>
              </div>
              <button
                onClick={() => setShowAddAddress(!showAddAddress)}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddAddress ? 'إلغاء' : 'إضافة عنوان'}</span>
              </button>
            </div>

            {/* Add Address Form */}
            {showAddAddress && (
              <form onSubmit={handleAddAddress} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3 animate-fadeIn">
                <div className="text-xs font-bold text-indigo-900">إضافة عنوان جديد:</div>

                {/* زر سحب الموقع المباشر وتسميته تلقائياً */}
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleDetectGpsLocation({ silent: false })}
                    disabled={detectingGps}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99] disabled:opacity-50 bg-gradient-to-r from-emerald-500/10 via-teal-500/15 to-emerald-500/10 border-emerald-500/40 text-emerald-800 hover:bg-emerald-100"
                  >
                    <Navigation className={`w-3.5 h-3.5 text-emerald-600 shrink-0 ${detectingGps ? 'animate-spin' : 'animate-pulse'}`} />
                    <span>{detectingGps ? 'جاري سحب موقعك وتحديد أقرب مكان...' : '📍 سحب موقعي الحالي (GPS)'}</span>
                  </button>

                  {gpsSuccessMsg && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-bold flex items-center gap-1.5 animate-fadeIn">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                      <span className="truncate">{gpsSuccessMsg}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    تسمية العنوان (اسم أقرب مكان أو كليتك)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: سكن الطلبة، هايبر وان، كلية الهندسة..."
                    value={newTitle}
                    onChange={e => {
                      setNewTitle(e.target.value);
                      if (!capturedGps && !detectingGps) {
                        handleDetectGpsLocation({ silent: true });
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      تفاصيل وموقع المكان بالتحديد
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold">
                      {capturedGps || newDetails.includes('[GPS:') ? '✓ مرتبط بالـ GPS' : 'يرتبط بالـ GPS تلقائياً'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="المبنى، الدور، رقم الغرفة أو تفاصيل إضافية (مثال: مبنى ب - الدور الثالث - مدرج 302)"
                    value={cleanAddressText(newDetails) || newDetails}
                    onFocus={() => {
                      if (!capturedGps && !detectingGps) {
                        handleDetectGpsLocation({ silent: true });
                      }
                    }}
                    onChange={e => {
                      const text = e.target.value;
                      const existingGps = newDetails.match(/\[GPS:[0-9.-]+,[0-9.-]+\]/);
                      if (existingGps) {
                        setNewDetails(`${existingGps[0]} ${text}`);
                      } else if (capturedGps) {
                        setNewDetails(formatAddressWithCoordinates(text, capturedGps.lat, capturedGps.lng));
                      } else {
                        setNewDetails(text);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={e => setIsDefault(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>تعيين كعنوان رئيسي مفضل</span>
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAddress(false);
                      setGpsSuccessMsg(null);
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    {savingAddress ? 'جاري الحفظ...' : 'حفظ العنوان'}
                  </button>
                </div>
              </form>
            )}

            {/* Address List */}
            {loadingAddresses ? (
              <div className="text-center py-6 text-xs text-slate-400">جاري تحميل العناوين...</div>
            ) : addresses.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-bold">لا توجد عناوين محفوظة حتى الآن</p>
                <p className="text-[11px] text-slate-400">أضف مكان وجودك في الكلية أو السكن لتحديده بنقرة واحدة عند الطلب</p>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map(addr => (
                  <div
                    key={addr.id}
                    className="p-3.5 bg-slate-50 hover:bg-indigo-50/30 rounded-2xl border border-slate-200 transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900">{addr.title}</span>
                        {addr.details?.includes('[GPS:') && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-black flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                            <span>GPS</span>
                          </span>
                        )}
                        {addr.isDefault && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                            افتراضي
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {getDisplayAddress(addr.details, addr.title || 'العنوان المسجل')}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors shrink-0"
                      title="حذف العنوان"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Help & Support Center Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50 border border-indigo-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">مركز المساعدة والدعم الفني</h4>
                  <p className="text-[10px] text-slate-500">واجهتك مشكلة أو لديك استفسار؟ فريق الإدارة في خدمتك</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSupportErrorMsg(null);
                  setSupportSuccessMsg(null);
                  setShowSupportModal(true);
                }}
                className="w-full py-2.5 px-3 bg-white hover:bg-indigo-50/60 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
              >
                <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
                <span>إرسال بلاغ أو مشكلة للإدارة</span>
              </button>

              <a
                href={supportWhatsappData.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
              >
                <MessageCircle className="w-4 h-4" />
                <span>محادثة واتساب مباشرة للدعم</span>
              </a>
            </div>
          </div>

          {/* Account Security & Deletion Section */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-rose-950">الأمان وإدارة الحساب</h4>
                  <p className="text-[10px] text-rose-700">حذف الحساب نهائياً وإلغاء تفعيل البيانات</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              إذا كنت ترغب في حذف حسابك نهائياً من المنظومة، سيتم تفريغ عناوينك المحفوظة ورصيدك فوراً وإلغاء تسجيل الدخول.
            </p>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2 px-3 border border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف حسابي نهائياً</span>
            </button>
          </div>
        </div>

        {/* Support Ticket Modal Dialog */}
        {showSupportModal && (
          <div 
            className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSupportModal(false);
            }}
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) e.preventDefault();
            }}
          >
            <div 
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile drag handle */}
              <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

              {/* Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">إرسال بلاغ أو مشكلة للإدارة</h4>
                    <p className="text-[10px] text-slate-500 font-medium">فريق الدعم في خدمتك وحل المشكلة فوراً</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content - Scrollable */}
              <form onSubmit={handleSubmitSupport} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-4 space-y-3.5 overflow-y-auto modal-scroll flex-1">
                  {/* WhatsApp Fast Track Banner */}
                  <a
                    href={supportWhatsappData.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <span>تحتاج رداً فورياً ومباشراً؟</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">واتساب</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 font-medium mt-0.5 leading-snug">
                          تحدث مع مشرف الدعم لحل المشكلة فوراً على {supportWhatsappData.whatsappPhone}
                        </p>
                      </div>
                    </div>
                    <span className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-xl shrink-0 shadow-xs active:scale-95">
                      محادثة
                    </span>
                  </a>

                  <div className="relative flex items-center justify-center my-0.5">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[10px] font-bold text-slate-400 shrink-0">أو سجّل تذكرة داخل المنظومة</span>
                  </div>

                  {supportErrorMsg && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{supportErrorMsg}</span>
                    </div>
                  )}

                  {supportSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{supportSuccessMsg}</span>
                    </div>
                  )}

                  {/* Fully Visible Category Selection - No Truncation */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-2">
                      اختر نوع المشكلة / الموضوع:
                    </label>
                    <div className="space-y-2">
                      {SUPPORT_CATEGORIES.map((cat) => {
                        const isSelected = supportCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSupportCategory(cat.id as any)}
                            className={`w-full p-2.5 sm:p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-98 ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs'
                                : 'bg-slate-50 border-slate-200/90 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xl shrink-0">{cat.icon}</span>
                              <div className="text-right">
                                <div className={`text-xs font-black ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                                  {cat.label}
                                </div>
                                <div className={`text-[11px] leading-relaxed mt-0.5 ${isSelected ? 'text-indigo-700 font-bold' : 'text-slate-500'}`}>
                                  {cat.desc}
                                </div>
                              </div>
                            </div>

                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                              isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject input */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                      عنوان البلاغ أو المشكلة <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: خصم خاطئ من المحفظة، تأخر استلام طلب..."
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:text-slate-400"
                      required
                    />
                  </div>

                  {/* Combobox for Order Selection */}
                  {supportCategory === 'ORDER_ISSUE' && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black text-slate-700">
                          الطلب المراد تقديم البلاغ عنه:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setManualOrderInputMode(!manualOrderInputMode);
                            setIsOrderDropdownOpen(false);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                        >
                          {manualOrderInputMode ? '← اختيار من طلباتي السابقة' : 'كتابة رقم الطلب يدوياً؟'}
                        </button>
                      </div>

                      {manualOrderInputMode ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="اكتب رقم الطلب هنا (مثال: 1042)..."
                            value={supportOrderNumber}
                            onChange={(e) => {
                              setSupportOrderNumber(e.target.value);
                              setSelectedOrder(null);
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:font-sans placeholder:text-slate-400"
                          />
                          <p className="text-[10px] text-slate-400">
                            يمكنك كتابة رقم الطلب يدوياً إذا كان الطلب مسجلاً برقم آخر أو حساب مختلف.
                          </p>
                        </div>
                      ) : loadingCustomerOrders ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 flex items-center justify-center gap-2 animate-pulse">
                          <Receipt className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>جاري تحميل قائمة طلباتك السابقة...</span>
                        </div>
                      ) : customerOrders.length === 0 ? (
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <p className="font-bold text-[11px]">لم يتم العثور على طلبات سابقة مسجلة بحسابك.</p>
                          </div>
                          <input
                            type="text"
                            placeholder="اكتب رقم الطلب يدوياً (مثال: 1042)..."
                            value={supportOrderNumber}
                            onChange={(e) => setSupportOrderNumber(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Combobox Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIsOrderDropdownOpen(!isOrderDropdownOpen)}
                            className={`w-full p-2.5 sm:p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                              selectedOrder
                                ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/20 shadow-xs'
                                : isOrderDropdownOpen
                                ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                selectedOrder ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                              }`}>
                                <Receipt className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1 text-right">
                                {selectedOrder ? (
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-indigo-950 font-mono">
                                        طلب #{selectedOrder.orderNumber}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-500 truncate">
                                        • {selectedOrder.branch?.name || 'مطعم جامعي'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-indigo-700 font-bold truncate mt-0.5">
                                      {selectedOrder.total} ج.م • {new Date(selectedOrder.createdAt).toLocaleDateString('ar-EG')}
                                      {selectedOrder.items && selectedOrder.items.length > 0 && (
                                        <span className="text-slate-500 font-normal mr-1">
                                          ({selectedOrder.items.map((it: any) => it.itemName).slice(0, 2).join('، ')}
                                          {selectedOrder.items.length > 2 ? '...' : ''})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs font-bold text-slate-700">
                                      اضغط لاختيار الطلب من قائمتك...
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      لديك {customerOrders.length} طلب سابق متاح للاختيار
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {selectedOrder && (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(null);
                                    setSupportOrderNumber('');
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                  title="إلغاء التحديد"
                                >
                                  <X className="w-4 h-4" />
                                </span>
                              )}
                              <div className="p-1 text-slate-400">
                                {isOrderDropdownOpen ? (
                                  <ChevronUp className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Dropdown Menu */}
                          {isOrderDropdownOpen && (
                            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden animate-fadeIn max-h-56 overflow-y-auto modal-scroll p-1.5 space-y-1">
                              <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 flex items-center justify-between">
                                <span>اختر الطلب الذي واجهتك مشكلة به ({customerOrders.length} طلب):</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsOrderDropdownOpen(false);
                                    setManualOrderInputMode(true);
                                  }}
                                  className="text-indigo-600 hover:underline font-bold cursor-pointer"
                                >
                                  كتابة يدوي
                                </button>
                              </div>

                              {customerOrders.map((order: any) => {
                                const isCurrent = selectedOrder?.id === order.id || supportOrderNumber === String(order.orderNumber);
                                const orderDate = new Date(order.createdAt).toLocaleDateString('ar-EG', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: 'numeric',
                                });
                                const statusText = 
                                  order.status === 'COMPLETED' ? 'مكتمل' :
                                  order.status === 'REJECTED' ? 'ملغي' :
                                  order.status === 'READY' ? 'جاهز' :
                                  order.status === 'PREPARING' ? 'قيد التحضير' : 'قيد المعالجة';
                                const statusClass =
                                  order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  order.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200';

                                return (
                                  <button
                                    key={order.id}
                                    type="button"
                                    onClick={() => handleSelectOrder(order)}
                                    className={`w-full p-2 rounded-xl text-right transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                      isCurrent
                                        ? 'bg-indigo-50/90 border border-indigo-400 font-bold'
                                        : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-black ${
                                        isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        #{order.orderNumber}
                                      </div>
                                      <div className="min-w-0 text-right">
                                        <div className="text-xs font-black text-slate-900 truncate">
                                          {order.branch?.name || 'مطعم جامعي'}
                                          <span className="text-[10px] font-normal text-slate-400 mr-2">
                                            {orderDate}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 truncate">
                                          {order.items?.map((it: any) => `${it.quantity}x ${it.itemName}`).join('، ') || `${order.total} ج.م`}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs font-black text-slate-900 font-mono">
                                        {order.total} ج.م
                                      </span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${statusClass}`}>
                                        {statusText}
                                      </span>
                                      {isCurrent && (
                                        <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message textarea */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                      تفاصيل المشكلة <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="اشرح المشكلة بالتفصيل حتى يتمكن المشرف من حلها سريعاً..."
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:text-slate-400 resize-none"
                      required
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center gap-2.5 shrink-0 pb-safe">
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(false)}
                    className="flex-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={sendingSupport}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/25 active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingSupport ? 'جاري الإرسال...' : 'إرسال للإدارة'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Account Confirmation Dialog */}
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deletingAccount) setShowDeleteConfirm(false);
            }}
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) e.preventDefault();
            }}
          >
            <div 
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-rose-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h4 className="text-sm font-black text-slate-900">هل أنت متأكد من حذف حسابك؟</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  سيؤدي هذا الإجراء إلى حذف جميع عناوينك المسجلة، نقاط الولاء، ورصيدك في المحفظة نهائياً. لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
                </p>
              </div>

              {deleteAccountError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteAccountError}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleConfirmDeleteAccount}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/25 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingAccount ? 'جاري الحذف...' : 'نعم، حذف الحساب'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!showSupportModal && !showDeleteConfirm && (
          <div className="p-4 border-t bg-slate-50 flex items-center justify-end pb-safe">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
