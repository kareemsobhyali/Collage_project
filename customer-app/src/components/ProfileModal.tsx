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
  Navigation
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
  extractCoordinatesFromAddress
} from '../services/campusLocations';

interface ProfileModalProps {
  user: any;
  onUpdateUser: (updatedUser: any) => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onUpdateUser,
  onClose,
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

  // تحميل العناوين والبيانات المالية للمحفظة
  const loadProfileData = async () => {
    try {
      setLoadingAddresses(true);
      const [addrData, walletData] = await Promise.all([
        api.getAddresses().catch(() => []),
        api.getWallet().catch(() => null),
      ]);
      setAddresses(Array.isArray(addrData) ? addrData : []);
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
        <div className="p-5 overflow-y-auto modal-scroll flex-1 space-y-5">
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
                        {cleanAddressText(addr.details) || addr.details}
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex items-center justify-end pb-safe">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
