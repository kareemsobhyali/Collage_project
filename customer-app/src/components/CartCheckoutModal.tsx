import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Trash2,
  Truck,
  ShoppingBag,
  MapPin,
  Phone,
  User,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Tag,
  Upload,
  Image as ImageIcon,
  Check,
  RotateCw,
  Plus,
  Minus,
  Clock,
  Wallet,
  Gift,
  Navigation,
  Copy,
  Crosshair,
  MapPinOff,
  ChevronDown,
  PowerOff,
  Map as MapIcon,
  Home,
  Building2,
  Briefcase,
  GraduationCap,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours, sanitizePromoCodeValue } from '../services/api';
import { LocationPickerModal, type LocationPickerResult } from './LocationPickerModal';
import { requestPushPermission } from '../services/notifications';
import {
  formatAddressWithCoordinates,
  cleanAddressText,
  getDisplayAddress,
  getNearestLocationName,
  extractCoordinatesFromAddress,
  getStoredClientCoords,
  isBranchInDeliveryZone,
  cleanZoneName,
  extractZoneGeo,
  calculateDistanceMeters,
  isCustomerWithinZoneGeo,
  formatDistance,
} from '../services/campusLocations';

interface CartCheckoutModalProps {
  cart: any[];
  branch: any;
  user: any | null;
  groupCartDetails?: any;
  onUpdateCart: (newCart: any[]) => void;
  onRequireAuth: () => void;
  onOrderSuccess: (order: any) => void;
  onClose: () => void;
}

// تحويل أيام العمل الإنجليزية إلى نص عربي واضح وسهل القراءة
function formatWorkingDaysArabic(workingDays?: string | null): string {
  if (!workingDays) return 'يومياً';
  const daysMap: Record<string, string> = {
    SUN: 'الأحد',
    MON: 'الإثنين',
    TUE: 'الثلاثاء',
    WED: 'الأربعاء',
    THU: 'الخميس',
    FRI: 'الجمعة',
    SAT: 'السبت',
  };
  const codes = workingDays
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (codes.length >= 7 || codes.length === 0) return 'طوال أيام الأسبوع';
  return codes.map((c) => daysMap[c] || c).join('، ');
}

// تحويل الوقت 24 ساعة إلى 12 ساعة بالعربية (ص / م)
function formatTime12Arabic(time24?: string | null): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return time24;
  if (h === 0) return `12:${m} ص`;
  if (h === 12) return `12:${m} م`;
  if (h > 12) return `${h - 12}:${m} م`;
  return `${h}:${m} ص`;
}

const ADDRESS_QUICK_CHIPS = [
  'بجوار البوابة',
  'أمام الكافتيريا',
  'مدخل العمارة',
  'بجوار المسجد',
  'اتصل بي عند الوصول',
];

const SAVE_ADDRESS_PRESETS = [
  { id: 'المنزل', label: 'المنزل', emoji: '🏠' },
  { id: 'السكن', label: 'السكن', emoji: '🏢' },
  { id: 'العمل', label: 'العمل', emoji: '💼' },
  { id: 'الجامعة', label: 'الجامعة', emoji: '🎓' },
  { id: 'أخرى', label: 'اسم آخر', emoji: '📍' },
];

const ORDER_NOTE_CHIPS = [
  'بدون بصل',
  'زيادة كاتشب',
  'زيادة تومية',
  'الأكل سخن جداً',
  'اتصل عند الوصول',
];

export const checkIsTimeInBranchHours = (
  timeStr: string,
  openingTime?: string | null,
  closingTime?: string | null
): boolean => {
  if (!openingTime || !closingTime || !timeStr) return true;
  const targetParts = timeStr.split(':').map(Number);
  const openParts = openingTime.split(':').map(Number);
  const closeParts = closingTime.split(':').map(Number);
  if (targetParts.length < 2 || openParts.length < 2 || closeParts.length < 2) return true;
  if (isNaN(targetParts[0]) || isNaN(openParts[0]) || isNaN(closeParts[0])) return true;

  const targetMins = targetParts[0] * 60 + (targetParts[1] || 0);
  const openMins = openParts[0] * 60 + (openParts[1] || 0);
  const closeMins = closeParts[0] * 60 + (closeParts[1] || 0);

  if (openMins === closeMins) return true;

  if (closeMins > openMins) {
    return targetMins >= openMins && targetMins <= closeMins;
  } else {
    // فترة مسائية تمتد لما بعد منتصف الليل (مثلاً: 18:00 إلى 02:00)
    return targetMins >= openMins || targetMins <= closeMins;
  }
};

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  cart,
  branch,
  user,
  groupCartDetails,
  onUpdateCart,
  onRequireAuth,
  onOrderSuccess,
  onClose,
}) => {
  const [orderType, setOrderType] = useState<'DELIVERY' | 'PICKUP'>(
    branch.allowDelivery ? 'DELIVERY' : 'PICKUP'
  );

  // Scheduled order states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('12:30');

  // فحص حالة عمل الفرع بدقة (سواء مغلق مؤقتاً أو تماماً أو خارج مواعيد العمل الرسمية)
  const isBranchClosedByHours = !isBranchOpenByHours(
    branch.openingTime,
    branch.closingTime,
    branch.isWithinWorkingHours
  );
  const isBranchBusy = useMemo(() => {
    return (
      branch.operationalStatus === 'BUSY' &&
      !!branch.closedUntil &&
      Date.now() < new Date(branch.closedUntil).getTime()
    );
  }, [branch.operationalStatus, branch.closedUntil]);
  const isBranchFullyClosed = branch.operationalStatus === 'CLOSED';
  const isBranchOffline = branch.isOnline !== true;
  const isBranchClosed = branch.isActive === false || isBranchFullyClosed || isBranchBusy || isBranchClosedByHours || isBranchOffline;

  // مواعيد مقترحة للحجز المسبق تتوافق مع ساعات عمل الفرع
  const scheduledTimePresets = useMemo(() => {
    const allPresets = [
      { val: '10:00', label: '10:00 ص' },
      { val: '11:30', label: '11:30 ص' },
      { val: '12:30', label: '12:30 م' },
      { val: '13:30', label: '1:30 م' },
      { val: '14:30', label: '2:30 م' },
      { val: '15:30', label: '3:30 م' },
      { val: '17:00', label: '5:00 م' },
      { val: '18:30', label: '6:30 م' },
      { val: '20:00', label: '8:00 م' },
      { val: '21:30', label: '9:30 م' },
      { val: '23:00', label: '11:00 م' },
    ];
    if (!branch.openingTime || !branch.closingTime) return allPresets.slice(1, 6);
    const valid = allPresets.filter((p) =>
      checkIsTimeInBranchHours(p.val, branch.openingTime, branch.closingTime)
    );
    return valid.length > 0 ? valid.slice(0, 6) : allPresets.slice(1, 6);
  }, [branch.openingTime, branch.closingTime]);

  // هل التوقيت المختار يقع ضمن ساعات عمل المطعم؟
  const isScheduledTimeValid = useMemo(() => {
    if (!isScheduled) return true;
    return checkIsTimeInBranchHours(scheduledTime, branch.openingTime, branch.closingTime);
  }, [isScheduled, scheduledTime, branch.openingTime, branch.closingTime]);

  // إذا كان المطعم خارج مواعيد العمل الحالية، تفعيل وضع الحجز المسبق فقط إذا كان الفرع متصلاً وغير مغلق
  useEffect(() => {
    if (isBranchClosedByHours && !isBranchFullyClosed && !isBranchBusy && !isBranchOffline && branch.isActive !== false) {
      setIsScheduled(true);
    }
  }, [isBranchClosedByHours, isBranchFullyClosed, isBranchBusy, isBranchOffline, branch.isActive]);

  // إذا تم إغلاق الفرع أو انقطع الاتصال، إيقاف وضع الحجز المسبق
  useEffect(() => {
    if ((isBranchFullyClosed || isBranchOffline || branch.isActive === false) && isScheduled) {
      setIsScheduled(false);
    }
  }, [isBranchFullyClosed, isBranchOffline, branch.isActive, isScheduled]);

  // ضبط وقت الحجز المسبق الافتراضي ليكون ضمن ساعات عمل المطعم
  useEffect(() => {
    if (branch.openingTime && branch.closingTime) {
      if (!checkIsTimeInBranchHours(scheduledTime, branch.openingTime, branch.closingTime)) {
        if (scheduledTimePresets.length > 0) {
          setScheduledTime(scheduledTimePresets[0].val);
        } else {
          setScheduledTime(branch.openingTime);
        }
      }
    }
  }, [branch.openingTime, branch.closingTime, scheduledTimePresets]);

  const paymentConfig = branch.paymentConfig;

  const defaultPayment = paymentConfig?.cashEnabled
    ? 'CASH'
    : paymentConfig?.instapayEnabled
    ? 'INSTAPAY'
    : paymentConfig?.vodafoneCashEnabled
    ? 'VODAFONE_CASH'
    : paymentConfig?.cardEnabled
    ? 'CARD'
    : 'CASH';

  const [paymentMethod, setPaymentMethod] = useState<string>(defaultPayment);
  const [addressText, setAddressText] = useState('');
  const [addressTitle, setAddressTitle] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isWritingNewAddress, setIsWritingNewAddress] = useState(false);

  // حقول العنوان الجديد المقسمة بشكل واضح وسهل للعميل بدون أي تكرار
  const [streetArea, setStreetArea] = useState('');
  const [userEditedStreet, setUserEditedStreet] = useState(false);
  const [buildingNo, setBuildingNo] = useState('');
  const [floorNo, setFloorNo] = useState('');
  const [apartmentNo, setApartmentNo] = useState('');
  const [landmarkNote, setLandmarkNote] = useState('');
  const [selectedLandmarkChips, setSelectedLandmarkChips] = useState<string[]>([]);
  const [saveLabelPreset, setSaveLabelPreset] = useState<string>('المنزل');
  const [customSaveLabel, setCustomSaveLabel] = useState<string>('');
  const [isMapPickerOpen, setIsMapPickerOpen] = useState<boolean>(false);

  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);

  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(user?.walletBalance || 0);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(user?.loyaltyPoints || 0);
  const [convertingPoints, setConvertingPoints] = useState(false);

  // حالة الـ GPS المدمج مع العنوان المكتوب
  const [detectingGps, setDetectingGps] = useState(false);
  const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedPlaceLabel, setDetectedPlaceLabel] = useState<string | null>(null);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editingItemNoteIdx, setEditingItemNoteIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تجميع نص العنوان الجديد المقروء من الحقول المقسمة بشكل منظم وواضح للكابتن والفاتورة
  const composedNewAddressDetails = useMemo(() => {
    const parts: string[] = [];
    if (streetArea.trim()) parts.push(streetArea.trim());
    if (buildingNo.trim()) parts.push(`عمارة/مبنى ${buildingNo.trim()}`);
    if (floorNo.trim()) parts.push(`الدور ${floorNo.trim()}`);
    if (apartmentNo.trim()) parts.push(`شقة ${apartmentNo.trim()}`);
    if (landmarkNote.trim()) parts.push(landmarkNote.trim());
    if (selectedLandmarkChips.length > 0) {
      parts.push(selectedLandmarkChips.join(' - '));
    }
    return parts.join(' ، ');
  }, [streetArea, buildingNo, floorNo, apartmentNo, landmarkNote, selectedLandmarkChips]);

  const isUsingSavedAddress = Boolean(
    selectedAddressId &&
      !isWritingNewAddress &&
      savedAddresses.some((a) => a.id === selectedAddressId)
  );

  // مزامنة addressText تلقائياً عند كتابة عنوان جديد
  useEffect(() => {
    if (!isUsingSavedAddress) {
      if (capturedCoords) {
        setAddressText(formatAddressWithCoordinates(composedNewAddressDetails, capturedCoords.lat, capturedCoords.lng));
      } else {
        setAddressText(composedNewAddressDetails);
      }
    }
  }, [isUsingSavedAddress, composedNewAddressDetails, capturedCoords]);

  // فحص نطاق التوصيل الجغرافي للمطعم لموقع العميل الحالي (طلب المستخدم: منع الطلب إذا كان المطعم خارج الزون)
  const effectiveClientCoords = capturedCoords || extractCoordinatesFromAddress(addressText) || getStoredClientCoords();
  const deliveryZoneCheck = isBranchInDeliveryZone(branch, effectiveClientCoords);
  const isOutOfDeliveryZone = orderType === 'DELIVERY' && !!effectiveClientCoords && !deliveryZoneCheck.inZone;

  // دالة التقاط الـ GPS (سواء تلقائياً بالخلفية عند فتح السلة أو يدوياً بالزر)
  const acquireGpsLocation = useCallback(
    (options?: { silent?: boolean; overwriteWrittenText?: boolean }): Promise<{ lat: number; lng: number } | null> => {
      const silent = options?.silent ?? false;
      const overwriteWrittenText = options?.overwriteWrittenText ?? false;

      return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
          if (!silent) {
            setError('خاصية تحديد الموقع الجغرافي (GPS) غير مدعومة على هذا المتصفح.');
          }
          resolve(null);
          return;
        }

        setDetectingGps(true);
        if (!silent) setError(null);

        const onGeoSuccess = async (pos: GeolocationPosition) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCapturedCoords({ lat, lng });

          try {
            const place = await getNearestLocationName(lat, lng);
            setDetectedPlaceLabel(place.title);

            setStreetArea((prevStreet) => {
              if (!prevStreet.trim() || prevStreet === 'موقعي الحالي' || overwriteWrittenText) {
                return place.details && place.details !== 'تم تحديد موقعي عبر الـ GPS'
                  ? place.details
                  : place.title;
              }
              return prevStreet;
            });

            setAddressTitle((prevTitle) => {
              if (!prevTitle.trim() || prevTitle === 'موقعي الحالي' || prevTitle === 'مكان التوصيل' || overwriteWrittenText) {
                return place.title;
              }
              return prevTitle;
            });

            setGpsStatusMessage(`تم تحديد موقعك (${place.title})`);
          } catch (_) {
            setGpsStatusMessage('تم تثبيت إحداثيات موقعك بالـ GPS بنجاح');
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
                  setError('يرجى السماح بصلاحية الموقع (GPS) أو الضغط على (اختيار من الخريطة) لتحديد موقع التوصيل.');
                } else {
                  setError('تعذر التقاط إشارة الـ GPS حالياً، يمكنك تحديد موقعك بسهولة من زر (اختيار من الخريطة).');
                }
              }
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        };

        navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoFallback, {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 15000,
        });
      });
    },
    []
  );

  // تأكيد الموقع المختار يدوياً من الخريطة التفاعلية
  const handleMapLocationConfirm = useCallback(async (result: LocationPickerResult) => {
    const { lat, lng, address } = result;
    setCapturedCoords({ lat, lng });
    setIsMapPickerOpen(false);
    setError(null);

    if (address && address.trim()) {
      const cleanPicked = address.split(',').slice(0, 3).map((s) => s.trim()).join('، ');
      setDetectedPlaceLabel(cleanPicked);
      if (!isUsingSavedAddress) {
        setStreetArea(cleanPicked);
        setUserEditedStreet(false);
      } else {
        setAddressText((prev) => formatAddressWithCoordinates(cleanAddressText(prev), lat, lng));
      }
      setGpsStatusMessage(`تم تحديد الموقع من الخريطة (${cleanPicked})`);
    } else {
      try {
        const place = await getNearestLocationName(lat, lng);
        setDetectedPlaceLabel(place.title);
        if (!isUsingSavedAddress && !userEditedStreet) {
          setStreetArea(
            place.details && place.details !== 'تم تحديد موقعي عبر الـ GPS'
              ? place.details
              : place.title
          );
        } else if (isUsingSavedAddress) {
          setAddressText((prev) => formatAddressWithCoordinates(cleanAddressText(prev), lat, lng));
        }
      } catch (_) {}
    }
  }, [isUsingSavedAddress, userEditedStreet]);

  // التقاط الـ GPS تلقائياً عند فتح نافذة السلة للتوصيل
  useEffect(() => {
    if (orderType === 'DELIVERY' && !capturedCoords) {
      acquireGpsLocation({ silent: true, overwriteWrittenText: false });
    }
  }, [orderType, capturedCoords, acquireGpsLocation]);

  // تحديث بيانات المستخدم وعناوينه ومحفظته تلقائياً عند تسجيل الدخول
  useEffect(() => {
    if (user) {
      if (!customerPhone) setCustomerPhone(user.phone || '');
      if (!customerName) setCustomerName(user.name || '');
      setWalletBalance(user.walletBalance || 0);
      setLoyaltyPoints(user.loyaltyPoints || 0);

      api
        .getAddresses()
        .then((res) => {
          if (Array.isArray(res)) {
            setSavedAddresses(res);
            const def = res.find((a: any) => a.isDefault) || res[0];
            if (def && !selectedAddressId && !isWritingNewAddress) {
              const existingSavedCoords = extractCoordinatesFromAddress(def.details);
              if (existingSavedCoords) {
                setCapturedCoords(existingSavedCoords);
                setAddressText(def.details);
              } else if (capturedCoords) {
                setAddressText(formatAddressWithCoordinates(def.details, capturedCoords.lat, capturedCoords.lng));
              } else {
                setAddressText(def.details);
              }
              setAddressTitle(def.title);
              setSelectedAddressId(def.id);
              setIsWritingNewAddress(false);
            }
          }
        })
        .catch(() => {});

      api
        .getWallet()
        .then((w) => {
          if (w) {
            setWalletBalance(w.walletBalance ?? 0);
            setLoyaltyPoints(w.loyaltyPoints ?? 0);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // إذا تم التقاط إحداثيات الـ GPS وكان العنوان المحفوظ بدون إحداثيات، نربط الإحداثيات به تلقائياً
  useEffect(() => {
    if (isUsingSavedAddress && capturedCoords && addressText.trim() && !addressText.includes('[GPS:')) {
      setAddressText(formatAddressWithCoordinates(addressText, capturedCoords.lat, capturedCoords.lng));
    }
  }, [isUsingSavedAddress, capturedCoords, addressText]);

  const handleDeleteSavedAddress = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      setDeletingAddressId(id);
      await api.deleteAddress(id);
      const remaining = savedAddresses.filter((a) => a.id !== id);
      setSavedAddresses(remaining);
      if (selectedAddressId === id) {
        if (remaining.length > 0) {
          const nextAddr = remaining[0];
          setSelectedAddressId(nextAddr.id);
          setIsWritingNewAddress(false);
          setAddressTitle(nextAddr.title);
          const nextCoords = extractCoordinatesFromAddress(nextAddr.details);
          if (nextCoords) setCapturedCoords(nextCoords);
          setAddressText(nextAddr.details);
        } else {
          setSelectedAddressId(null);
          setIsWritingNewAddress(true);
          if (detectedPlaceLabel && !streetArea.trim()) {
            setStreetArea(detectedPlaceLabel);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'فشل حذف العنوان');
    } finally {
      setDeletingAddressId(null);
    }
  };

  const handleQuickConvertPoints = async () => {
    if (loyaltyPoints <= 0) return;
    try {
      setConvertingPoints(true);
      const res = await api.convertPointsToWallet();
      if (res.user) {
        setWalletBalance(res.user.walletBalance);
        setLoyaltyPoints(res.user.loyaltyPoints);
        setUseWallet(true);
        localStorage.setItem('customer_user', JSON.stringify(res.user));
      }
    } catch (e: any) {
      setError(e.message || 'فشل تحويل النقاط');
    } finally {
      setConvertingPoints(false);
    }
  };

  // Custom Delivery Zones
  const hasZones =
    branch.deliveryType === 'ZONES' && branch.deliveryZones && branch.deliveryZones.length > 0;
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    hasZones ? branch.deliveryZones[0].id : ''
  );
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [autoDetectedZoneName, setAutoDetectedZoneName] = useState<string | null>(null);

  const selectedZone = useMemo(() => {
    if (!hasZones) return null;
    return branch.deliveryZones.find((z: any) => z.id === selectedZoneId) || branch.deliveryZones[0];
  }, [hasZones, branch.deliveryZones, selectedZoneId]);

  // مطابقة منطقة التوصيل الأقرب تلقائياً عند تحديد موقع العميل بالـ GPS أو اكتشاف اسم المنطقة مع مراعاة النطاق والاتجاهات
  useEffect(() => {
    if (!hasZones || !capturedCoords || !branch.deliveryZones?.length) return;

    let bestZoneId: string | null = null;
    let minDistance = Infinity;

    for (const zone of branch.deliveryZones) {
      const geo = extractZoneGeo(zone.name);
      if (typeof geo.lat === 'number' && typeof geo.lng === 'number') {
        const coverage = isCustomerWithinZoneGeo(capturedCoords.lat, capturedCoords.lng, geo);
        if (coverage.isCovered && coverage.distanceMeters < minDistance) {
          minDistance = coverage.distanceMeters;
          bestZoneId = zone.id;
        }
      } else if (detectedPlaceLabel && geo.cleanName) {
        if (detectedPlaceLabel.includes(geo.cleanName) || geo.cleanName.includes(detectedPlaceLabel)) {
          if (!bestZoneId) bestZoneId = zone.id;
        }
      }
    }

    if (bestZoneId && bestZoneId !== selectedZoneId) {
      setSelectedZoneId(bestZoneId);
      const targetZone = branch.deliveryZones.find((z: any) => z.id === bestZoneId);
      if (targetZone) {
        setAutoDetectedZoneName(cleanZoneName(targetZone.name));
      }
    }
  }, [hasZones, capturedCoords, detectedPlaceLabel, branch.deliveryZones]);

  // Promo Code
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    discountType: string;
    value: number;
    minOrder?: number;
    isAutoApplied?: boolean;
    isPersonal?: boolean;
  } | null>(null);
  const [dismissedAutoPromo, setDismissedAutoPromo] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Payment Proof (Vodafone Cash / InstaPay)
  const [paymentSenderPhone, setPaymentSenderPhone] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate dynamic delivery fee
  let deliveryFee = 0;
  let deliveryZoneName = '';
  if (orderType === 'DELIVERY') {
    if (hasZones) {
      deliveryFee = selectedZone ? selectedZone.fee : 0;
      deliveryZoneName = selectedZone ? cleanZoneName(selectedZone.name) : '';
    } else {
      deliveryFee = branch.deliveryFee || 0;
    }
  }

  // حساب قيمة الخصم ديناميكياً عند تغير الأصناف أو الكميات في السلة
  const discount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.minOrder && subtotal < appliedPromo.minOrder) return 0;
    if (appliedPromo.discountType === 'PERCENT' || appliedPromo.discountType === 'PERCENTAGE') {
      return Math.round((subtotal * appliedPromo.value) / 100);
    }
    return Math.min(subtotal, appliedPromo.value);
  }, [appliedPromo, subtotal]);

  // إذا انخفض المجموع الفرعي عن الحد الأدنى للكوبون المطبق، يتم إلغاؤه تلقائياً حتى يعود المجموع للحد المطلوب
  useEffect(() => {
    if (appliedPromo && appliedPromo.minOrder && subtotal > 0 && subtotal < appliedPromo.minOrder) {
      setAppliedPromo(null);
    }
  }, [appliedPromo, subtotal]);

  const preWalletTotal = Math.max(0, subtotal + deliveryFee - discount);
  const walletDiscount =
    useWallet && walletBalance > 0 ? Math.min(preWalletTotal, walletBalance) : 0;
  const total = Math.max(0, preWalletTotal - walletDiscount);
  const pointsToEarn = Math.max(1, Math.floor(subtotal / 10));

  const isPhoneValid = /^01[0125][0-9]{8}$/.test(customerPhone.trim());
  const cleanEgyptianPhoneInput = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('0020')) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('20') && cleaned.length > 11) cleaned = cleaned.slice(2);
    return cleaned.slice(0, 11);
  };
  const isSenderPhoneValid = /^01[0125][0-9]{8}$/.test(paymentSenderPhone.trim());
  const currentAddressCoords = extractCoordinatesFromAddress(addressText) || capturedCoords;
  const cleanWrittenDetails = cleanAddressText(addressText);

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(label);
    setTimeout(() => {
      setCopiedField((prev) => (prev === label ? null : prev));
    }, 2500);
  };

  const handleRemoveItem = (index: number) => {
    const updated = cart.filter((_, idx) => idx !== index);
    onUpdateCart(updated);
    if (updated.length === 0) {
      onClose();
    }
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...cart];
    const item = updated[index];
    const unit = item.unitPrice || item.totalPrice / item.quantity;
    updated[index] = {
      ...item,
      quantity: newQty,
      totalPrice: unit * newQty,
    };
    onUpdateCart(updated);
  };

  const handleUpdateItemNote = (index: number, noteText: string) => {
    const updated = [...cart];
    updated[index] = {
      ...updated[index],
      notes: noteText,
    };
    onUpdateCart(updated);
  };

  // Validate and Apply Promo Code
  const handleApplyPromoCode = async () => {
    const cleanInput = sanitizePromoCodeValue(promoCodeInput);
    if (!cleanInput) {
      setPromoCodeInput('');
      return;
    }
    setPromoError(null);
    try {
      setPromoLoading(true);
      const res = await api.validatePromoCode(
        cleanInput,
        subtotal,
        branch?.id
      );
      if (res.valid || res.success) {
        setAppliedPromo({
          code: res.code,
          discount: res.discount,
          discountType: res.discountType,
          value: res.value,
          minOrder: res.minOrder || 0,
          isAutoApplied: false,
          isPersonal: Boolean(res.isPersonal),
        });
        setPromoCodeInput('');
        setPromoError(null);
      } else {
        setPromoError(res.error || 'كوبون الخصم غير صالح أو منتهي');
      }
    } catch (err: any) {
      setPromoError(err.message || 'كوبون الخصم غير صحيح أو منتهي');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setDismissedAutoPromo(true);
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError(null);
    localStorage.removeItem('unifood_auto_promo');
  };

  // تنظيف أي قيمة غير صالحة مثل "null" من localStorage فوراً، وتطبيق الكوبون المنسوخ أو الكوبون الافتراضي التلقائي (Auto-Apply)
  useEffect(() => {
    let isCancelled = false;

    const rawStored = localStorage.getItem('unifood_auto_promo');
    const cleanStored = sanitizePromoCodeValue(rawStored);
    if (rawStored !== null && !cleanStored) {
      localStorage.removeItem('unifood_auto_promo');
    }

    if (subtotal <= 0) return;

    const runAutoPromoFlow = async () => {
      // 1. إذا قام العميل بنسخ كوبون من شاشة العروض، نجرب تطبيقه أولاً دون ترك كلمة null أو كود خاطئ في الحقل
      if (cleanStored && !appliedPromo) {
        localStorage.removeItem('unifood_auto_promo');
        try {
          const res = await api.validatePromoCode(cleanStored, subtotal, branch?.id);
          if (!isCancelled && (res.valid || res.success)) {
            setAppliedPromo({
              code: res.code,
              discount: res.discount,
              discountType: res.discountType,
              value: res.value,
              minOrder: res.minOrder || 0,
              isAutoApplied: false,
              isPersonal: Boolean(res.isPersonal),
            });
            setPromoCodeInput('');
            setPromoError(null);
            return;
          }
        } catch {
          // في حال لم يكن الكوبون المنسوخ صالحاً لهذا الفرع أو مستخدماً من قبل، نترك الحقل فارغاً ونفحص الكوبون التلقائي
          if (!isCancelled) {
            setPromoCodeInput('');
          }
        }
      }

      // 2. فحص الكوبون الافتراضي التلقائي (Auto-Apply) مع مراعاة عدم تجاوز العدد المحدد أو الاستخدام لمرة واحدة للعميل
      if (dismissedAutoPromo) return;
      if (appliedPromo && !appliedPromo.isAutoApplied) return;

      try {
        const res = await api.getAutoEligiblePromo(branch?.id, subtotal);
        if (isCancelled) return;

        if (res?.promo && sanitizePromoCodeValue(res.promo.code)) {
          setAppliedPromo((prev) => {
            if (prev && !prev.isAutoApplied) return prev;
            return {
              code: res.promo.code,
              discount: res.promo.discount,
              discountType: res.promo.discountType,
              value: res.promo.value,
              minOrder: res.promo.minOrder || 0,
              isAutoApplied: true,
              isPersonal: Boolean(res.promo.isPersonal),
            };
          });
          setPromoError(null);
        } else if (appliedPromo?.isAutoApplied) {
          // إذا سجل العميل دخوله واتضح أنه استخدم هذا الكوبون التلقائي مسبقاً، نزيله فوراً
          setAppliedPromo(null);
        }
      } catch {
        // تجاهل الخطأ بصمت ليبقى حقل الكوبون نظيفاً وفارغاً
      }
    };

    runAutoPromoFlow();

    return () => {
      isCancelled = true;
    };
  }, [subtotal, branch?.id, user?.id, dismissedAutoPromo]);

  // Upload Payment Proof Screenshot
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProof(true);
      const res = await api.uploadImage(file);
      const proofUrl = res.fileUrl || res.url;
      if (proofUrl) {
        setPaymentProofUrl(proofUrl);
      }
    } catch (err: any) {
      setError(err.message || 'فشل رفع لقطة شاشة التحويل');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleToggleAddressChip = (chip: string) => {
    setSelectedLandmarkChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      onRequireAuth();
      return;
    }

    const finalPhone = (user.phone || customerPhone || '').trim();
    if (!/^01[0125][0-9]{8}$/.test(finalPhone)) {
      setError(
        'يرجى التأكد من تسجيل رقم هاتف مصري صحيح (11 رقماً) في حسابك لإتمام الطلب'
      );
      return;
    }

    let finalDeliveryAddress = isUsingSavedAddress
      ? addressText.trim()
      : composedNewAddressDetails.trim();

    if (orderType === 'DELIVERY') {
      if (!cleanAddressText(finalDeliveryAddress).trim()) {
        setError('يرجى كتابة اسم الشارع أو المنطقة أو رقم المبنى لسهولة وصول الكابتن إليك.');
        return;
      }

      // التأكد من أخذ موقع العميل بالـ GPS أو الخريطة حتى لو أدخل عنواناً مكتوباً يدوياً
      let coords = extractCoordinatesFromAddress(addressText) || capturedCoords;
      if (!coords) {
        coords = await acquireGpsLocation({ silent: false, overwriteWrittenText: false });
      }

      if (!coords) {
        setError(
          'يرجى تحديد موقعك على الخريطة أو تفعيل الـ GPS لتوجيه الكابتن بدقة (يمكنك الضغط على زر اختيار من الخريطة).'
        );
        return;
      }

      // التحقق من نطاق التوصيل الجغرافي للمطعم (طلب المستخدم: منع الطلب إذا كان المطعم خارج الزون)
      const zoneCheck = isBranchInDeliveryZone(branch, coords);
      if (!zoneCheck.inZone) {
        setError(
          `عذراً، موقع التوصيل يقع خارج نطاق التوصيل المحدد لهذا المطعم (${zoneCheck.distKm.toFixed(1)} كم • الحد الأقصى للنطاق: ${zoneCheck.radiusKm} كم). لا يمكن إتمام طلب التوصيل.`
        );
        return;
      }

      if (isUsingSavedAddress) {
        const savedObj = savedAddresses.find((a) => a.id === selectedAddressId);
        const writtenPart = cleanAddressText(addressText) || savedObj?.title || 'موقعي الحالي';
        const titlePrefix =
          savedObj?.title && !writtenPart.includes(savedObj.title)
            ? `${savedObj.title} - ${writtenPart}`
            : writtenPart;
        finalDeliveryAddress = formatAddressWithCoordinates(titlePrefix, coords.lat, coords.lng);
      } else {
        const cleanComposed = composedNewAddressDetails.trim() || detectedPlaceLabel || 'موقعي الحالي';
        finalDeliveryAddress = formatAddressWithCoordinates(cleanComposed, coords.lat, coords.lng);
      }
      setAddressText(finalDeliveryAddress);
    }

    const requirePaymentProof = paymentConfig?.requirePaymentProof !== false;

    if (requirePaymentProof && (paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') && total > 0) {
      if (paymentMethod === 'VODAFONE_CASH') {
        const cleanSender = paymentSenderPhone.trim();
        if (!cleanSender) {
          setError('يرجى إدخال رقم محفظة فودافون كاش التي قمت بالتحويل منها.');
          return;
        }
        if (!/^01[0125][0-9]{8}$/.test(cleanSender)) {
          setError('يرجى إدخال رقم محفظة مصري صحيح مكون من 11 رقماً ويبدأ بـ (010, 011, 012, 015).');
          return;
        }
        if (!paymentProofUrl.trim()) {
          setError('يرجى رفع صورة إيصال التحويل (Screenshot) لتأكيد دفع المحفظة.');
          return;
        }
      } else if (paymentMethod === 'INSTAPAY') {
        if (!paymentSenderPhone.trim()) {
          setError('يرجى كتابة اسم حسابك أو رقمك على إنستاباي الذي قمت بالتحويل منه.');
          return;
        }
        if (!paymentProofUrl.trim()) {
          setError('يرجى رفع صورة إيصال التحويل (Screenshot) لتأكيد دفع إنستاباي.');
          return;
        }
      }
    } else if (!requirePaymentProof && paymentMethod === 'VODAFONE_CASH' && paymentSenderPhone.trim()) {
      if (!/^01[0125][0-9]{8}$/.test(paymentSenderPhone.trim())) {
        setError('رقم المحفظة الذي أدخلته غير صحيح. يرجى إدخال 11 رقماً يبدأ بـ (010, 011, 012, 015) أو مسح الحقل.');
        return;
      }
    }

    if (isBranchOffline) {
      setError(`عذراً، سيستم استقبال الطلبات في مطعم "${branch.name}" غير متصل حالياً (انقطاع في الإنترنت أو التطبيق غير مفتوح). لا يمكن إرسال الطلب حتى يعود اتصال المطعم.`);
      return;
    }

    if (isBranchFullyClosed) {
      setError('عذراً، هذا المطعم مغلق حالياً ولا يستقبل أي طلبات فورية أو حجز مسبق.');
      return;
    }

    if (isBranchBusy) {
      const remainingMinutes = Math.ceil(
        (new Date(branch.closedUntil).getTime() - Date.now()) / (60 * 1000)
      );
      setError(
        `عذراً، المطعم مغلق مؤقتاً لضغط الطلبات أو التجهيز (${remainingMinutes} دقيقة متبقية).`
      );
      return;
    }

    if (isScheduled) {
      if (!isScheduledTimeValid) {
        setError(
          `المطعم غير متاح في وقت الحجز المختار (${scheduledTime}). مواعيد العمل الرسمية: من ${branch.openingTime || '08:00'} إلى ${branch.closingTime || '22:00'}. يرجى اختيار موعد آخر ضمن ساعات العمل.`
        );
        return;
      }
    } else {
      if (isBranchClosedByHours) {
        setError(
          `عذراً، المطعم مغلق حالياً خارج مواعيد العمل الرسمية (${branch.openingTime || '08:00'} - ${branch.closingTime || '22:00'}). يمكنك اختيار "حجز لوقت لاحق" لطلب وجبتك مسبقاً.`
        );
        return;
      }
    }

    try {
      setLoading(true);
      requestPushPermission().catch(() => {});

      const res = await api.createOrder({
        branchId: branch.id,
        orderType,
        paymentMethod,
        addressText: orderType === 'DELIVERY' ? finalDeliveryAddress : 'استلام من الفرع',
        customerPhone: finalPhone,
        customerName: (user.name || customerName || 'عميل').trim(),
        notes: notes.trim() || undefined,
        deliveryZoneName:
          orderType === 'DELIVERY'
            ? deliveryZoneName ||
              (!isUsingSavedAddress ? streetArea.trim() : addressTitle.trim()) ||
              detectedPlaceLabel ||
              undefined
            : undefined,
        deliveryFee: orderType === 'DELIVERY' ? deliveryFee : 0,
        paymentSenderPhone: paymentSenderPhone.trim() || undefined,
        paymentProofUrl: paymentProofUrl.trim() || undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        discount: appliedPromo ? discount : undefined,
        useWallet,
        isScheduled,
        scheduledFor:
          isScheduled && scheduledTime
            ? (() => {
                const [hours, minutes] = scheduledTime.split(':').map(Number);
                const d = new Date();
                d.setHours(hours, minutes, 0, 0);
                if (d.getTime() < Date.now()) {
                  d.setDate(d.getDate() + 1);
                }
                return d.toISOString();
              })()
            : undefined,
        groupCartDetails: groupCartDetails
          ? typeof groupCartDetails === 'object'
            ? JSON.stringify(groupCartDetails)
            : String(groupCartDetails)
          : undefined,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          sizeName: item.sizeName,
          sizePrice: item.sizePrice,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers,
          notes: item.notes,
        })),
      });

      if (res.user) {
        localStorage.setItem('customer_user', JSON.stringify(res.user));
      }

      if (saveAddressToProfile && !isUsingSavedAddress && orderType === 'DELIVERY' && finalDeliveryAddress && user) {
        const chosenPresetLabel =
          saveLabelPreset === 'أخرى'
            ? customSaveLabel.trim() || streetArea.trim().slice(0, 25) || detectedPlaceLabel || 'عنواني'
            : saveLabelPreset;
        api.addAddress(chosenPresetLabel, finalDeliveryAddress, savedAddresses.length === 0).catch(() => {});
      }

      onOrderSuccess(res.order);
      onUpdateCart([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden"
      dir="rtl"
    >
      {/* إشعار الخطأ العائم في أعلى الشاشة */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[92%] max-w-md bg-rose-600 text-white p-3.5 rounded-2xl shadow-2xl border border-rose-400 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-black leading-relaxed">
            <AlertCircle className="w-5 h-5 shrink-0 text-white" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 rounded-lg hover:bg-rose-700 text-white/90 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="w-full h-full flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto bg-slate-50 sm:border-x sm:border-slate-200/90 shadow-sm relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-white shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
              title="رجوع للمنيو"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm sm:text-base truncate">
                إتمام الطلب - {branch.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>{cart.reduce((acc, i) => acc + i.quantity, 0)} أصناف في السلة</span>
                {branch.openingTime && branch.closingTime && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatTime12Arabic(branch.openingTime)} -{' '}
                        {formatTime12Arabic(branch.closingTime)} (
                        {formatWorkingDaysArabic(branch.workingDays)})
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0 cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto modal-scroll flex-1 space-y-4 pb-36 sm:pb-32">
          {/* 1. قائمة الأصناف المختارة */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                  1
                </span>
                <h4 className="text-xs font-black text-slate-800">
                  الأصناف المحددة ({cart.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>إضافة أصناف أخرى</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {cart.map((item, idx) => (
                <div key={idx} className="py-2.5 first:pt-1 last:pb-0 text-xs space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap font-black text-slate-900">
                        <span>{item.itemName}</span>
                        {item.sizeName && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold">
                            {item.sizeName}
                          </span>
                        )}
                      </div>

                      {item.selectedModifiers?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.selectedModifiers.map((m: any, mIdx: number) => (
                            <span
                              key={mIdx}
                              className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium"
                            >
                              + {m.optionName} ({m.price} ج.م)
                            </span>
                          ))}
                        </div>
                      )}

                      {/* ملاحظة الصنف أو زر إضافتها */}
                      {editingItemNoteIdx === idx ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                            placeholder="مثال: بدون مخلل، كاتشب زيادة..."
                            autoFocus
                            className="flex-1 px-2.5 py-1 bg-amber-50/60 border border-amber-300 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingItemNoteIdx(null)}
                            className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-bold"
                          >
                            تم
                          </button>
                        </div>
                      ) : item.notes ? (
                        <button
                          type="button"
                          onClick={() => setEditingItemNoteIdx(idx)}
                          className="mt-1 text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 font-bold inline-flex items-center gap-1 hover:bg-amber-100"
                        >
                          <span>📝 {item.notes}</span>
                          <span className="text-[9px] text-amber-600 underline">(تعديل)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingItemNoteIdx(idx)}
                          className="mt-1 text-[10px] text-slate-400 hover:text-indigo-600 font-bold inline-flex items-center gap-1"
                        >
                          <span>+ إضافة ملاحظة على هذا الصنف</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-black text-xs text-slate-900 w-6 text-center font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-black text-indigo-700 min-w-[52px] text-left font-mono text-xs">
                        {item.totalPrice} ج.م
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. طريقة وتوقيت الاستلام */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                  2
                </span>
                <h4 className="text-xs font-black text-slate-800">طريقة وتوقيت الاستلام</h4>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isBranchOffline
                    ? 'bg-slate-800 text-rose-300 border border-slate-700'
                    : isBranchClosed
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isBranchOffline ? 'غير متصل (مغلق)' : isBranchClosed ? 'الفرع مغلق حالياً' : 'متاح الآن'}
              </span>
            </div>

            {isBranchOffline && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-850 font-bold">
                <PowerOff className="w-4 h-4 text-rose-600 shrink-0" />
                <span>سيستم استقبال الطلبات لدى المطعم غير متصل بالإنترنت حالياً (مغلق مؤقتاً). لا يمكن استقبال طلبات جديدة الآن.</span>
              </div>
            )}

            {/* توصيل أو استلام من الفرع */}
            <div className="grid grid-cols-2 gap-2">
              {branch.allowDelivery && (
                <button
                  type="button"
                  onClick={() => setOrderType('DELIVERY')}
                  className={`p-2.5 rounded-2xl border text-center transition-all flex items-center gap-2.5 ${
                    orderType === 'DELIVERY'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-black shadow-2xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      orderType === 'DELIVERY'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="text-right min-w-0">
                    <span className="text-xs block truncate">توصيل لمكانك</span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {hasZones ? 'حسب المنطقة' : `الرسوم: ${branch.deliveryFee || 0} ج.م`}
                    </span>
                  </div>
                </button>
              )}

              {branch.allowPickup && (
                <button
                  type="button"
                  onClick={() => setOrderType('PICKUP')}
                  className={`p-2.5 rounded-2xl border text-center transition-all flex items-center gap-2.5 ${
                    orderType === 'PICKUP'
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-black shadow-2xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      orderType === 'PICKUP'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="text-right min-w-0">
                    <span className="text-xs block truncate">استلام من الفرع</span>
                    <span className="text-[10px] text-emerald-600 font-bold block truncate">
                      بدون رسوم توصيل
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* فوري أم حجز لوقت لاحق */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                disabled={isBranchClosed}
                onClick={() => setIsScheduled(false)}
                className={`py-2 px-3 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 ${
                  isBranchClosed
                    ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                    : !isScheduled
                    ? 'border-indigo-600 bg-indigo-600 text-white font-black shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                }`}
              >
                <span className="text-xs">⚡ طلب فوري (الآن)</span>
              </button>

              <button
                type="button"
                disabled={isBranchFullyClosed}
                onClick={() => {
                  if (isBranchFullyClosed) return;
                  setIsScheduled(true);
                }}
                className={`py-2 px-3 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 ${
                  isBranchFullyClosed
                    ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                    : isScheduled
                    ? 'border-indigo-600 bg-indigo-600 text-white font-black shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                }`}
              >
                <span className="text-xs">🕒 حجز لوقت لاحق</span>
              </button>
            </div>

            {isScheduled && (
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2.5 animate-fadeIn">
                <span className="text-[11px] font-bold text-slate-700 block">
                  اختر وقت الاستلام المطلوب (حجز مسبق):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {scheduledTimePresets.map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setScheduledTime(t.val)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        scheduledTime === t.val
                          ? 'bg-indigo-600 text-white shadow-xs font-black'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] text-slate-500 font-bold shrink-0">أو حدد وقتاً مخصصاً:</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                {!isScheduledTimeValid && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      ⚠️ المطعم غير متاح في هذا التوقيت ({scheduledTime}). مواعيد العمل الرسمية: من{' '}
                      <strong>{branch.openingTime || '08:00'}</strong> إلى <strong>{branch.closingTime || '22:00'}</strong>. يرجى اختيار موعد آخر.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. موقع وعنوان التوصيل المطور (واضح وسهل بدون تكرار) */}
          {orderType === 'DELIVERY' && (
            <section className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-indigo-100 shadow-2xs space-y-3.5">
              {/* رأس القسم */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    عنوان وموقع التوصيل *
                  </h4>
                </div>
                {currentAddressCoords ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>الموقع محدد</span>
                    <Check className="w-3 h-3 text-emerald-600 inline -mr-0.5" />
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                    يرجى تحديد الموقع
                  </span>
                )}
              </div>

              {/* اختيار منطقة التوصيل إن كان الفرع يعتمد Zones */}
              {hasZones && (
                <div className="space-y-1.5 pb-2.5 border-b border-slate-100">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>منطقة التوصيل لحساب الرسوم:</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsZoneModalOpen(true)}
                    className="w-full bg-slate-50 hover:bg-slate-100/90 border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-right flex items-center justify-between transition-all cursor-pointer shadow-2xs group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {cleanZoneName(selectedZone?.name) || 'اختر منطقة التوصيل...'}
                      </span>
                      {selectedZone && (
                        <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shrink-0">
                          (+{selectedZone.fee} ج.م)
                        </span>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                  </button>

                  {autoDetectedZoneName && (
                    <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl animate-fadeIn">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>تم اختيار منطقة ({autoDetectedZoneName}) تلقائياً حسب موقعك</span>
                    </div>
                  )}
                </div>
              )}

              {/* تحذير في حال كان موقع العميل خارج نطاق التوصيل للمطعم */}
              {isOutOfDeliveryZone && (
                <div className="p-3 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs font-bold animate-fadeIn">
                  <MapPinOff className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-rose-700">موقعك خارج نطاق التوصيل لهذا المطعم 📍</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-200/70 text-rose-900">
                        المسافة: {deliveryZoneCheck.distKm.toFixed(1)} كم / أقصى نطاق: {deliveryZoneCheck.radiusKm} كم
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-600 font-normal mt-0.5 leading-relaxed">
                      يمكنك تعديل موقع التوصيل من الخريطة أو التبديل إلى "استلام من الفرع".
                    </p>
                  </div>
                </div>
              )}

              {/* أزرار اختيار العناوين المحفوظة أو إضافة عنوان جديد */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700">
                      اختر من عناوينك المحفوظة:
                    </span>
                    {!isWritingNewAddress ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(null);
                          setIsWritingNewAddress(true);
                          if (!streetArea.trim() && detectedPlaceLabel) {
                            setStreetArea(detectedPlaceLabel);
                          } else if (!capturedCoords) {
                            acquireGpsLocation({ silent: false, overwriteWrittenText: true });
                          }
                        }}
                        className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>عنوان جديد</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const firstSaved = savedAddresses[0];
                          if (firstSaved) {
                            setIsWritingNewAddress(false);
                            setSelectedAddressId(firstSaved.id);
                            setAddressTitle(firstSaved.title);
                            const savedCoords = extractCoordinatesFromAddress(firstSaved.details);
                            if (savedCoords) setCapturedCoords(savedCoords);
                            setAddressText(firstSaved.details);
                          }
                        }}
                        className="text-[11px] font-bold text-slate-600 hover:text-indigo-700 underline cursor-pointer"
                      >
                        الرجوع للعناوين المحفوظة
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {savedAddresses.map((addr) => {
                      const isSelected = !isWritingNewAddress && selectedAddressId === addr.id;
                      const hasGpsTag = Boolean(extractCoordinatesFromAddress(addr.details));

                      return (
                        <div
                          key={addr.id}
                          onClick={() => {
                            setIsWritingNewAddress(false);
                            setSelectedAddressId(addr.id);
                            setAddressTitle(addr.title);
                            const savedCoords = extractCoordinatesFromAddress(addr.details);
                            if (savedCoords) {
                              setCapturedCoords(savedCoords);
                              setAddressText(addr.details);
                            } else if (capturedCoords) {
                              setAddressText(
                                formatAddressWithCoordinates(
                                  addr.details,
                                  capturedCoords.lat,
                                  capturedCoords.lng
                                )
                              );
                            } else {
                              setAddressText(addr.details);
                              acquireGpsLocation({ silent: true, overwriteWrittenText: false });
                            }
                          }}
                          className={`p-2.5 rounded-2xl text-right border transition-all cursor-pointer flex items-start justify-between gap-2 text-xs ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                              : 'bg-slate-50/90 text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <MapPin
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isSelected ? 'text-amber-300' : 'text-indigo-600'
                                }`}
                              />
                              <span className="font-black text-xs truncate">{addr.title}</span>
                              {hasGpsTag && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                                    isSelected
                                      ? 'bg-emerald-400/30 text-white'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  خريطة ✓
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-indigo-100' : 'text-slate-500'
                              }`}
                            >
                              {getDisplayAddress(addr.details, addr.title || 'العنوان المسجل')}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={deletingAddressId === addr.id}
                            onClick={(e) => handleDeleteSavedAddress(e, addr.id)}
                            className={`p-1 rounded-lg transition-colors shrink-0 ${
                              isSelected
                                ? 'text-indigo-200 hover:text-white hover:bg-white/15'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title="حذف هذا العنوان المحفوظ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* الحالة (أ): عند اختيار عنوان محفوظ جاهز — بطاقة ملخص نظيفة وواضحة بدون حقول مكررة مربكة */}
              {isUsingSavedAddress ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-emerald-800">
                          سيتم التوصيل إلى ({addressTitle || 'عنوانك المحفوظ'}):
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed mt-0.5 break-words">
                          {getDisplayAddress(addressText, addressTitle || 'العنوان المختار')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/70">
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="flex-1 min-w-[130px] py-1.5 px-2.5 rounded-xl bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MapIcon className="w-3.5 h-3.5 text-emerald-700" />
                      <span>تعديل الدبوس من الخريطة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(null);
                        setIsWritingNewAddress(true);
                        if (!streetArea.trim() && detectedPlaceLabel) {
                          setStreetArea(detectedPlaceLabel);
                        }
                      }}
                      className="py-1.5 px-3 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>عنوان آخر</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* الحالة (ب): إدخال عنوان توصيل جديد — خطوتان واضحتان بدون أي تكرار */
                <div className="space-y-3 animate-fadeIn">
                  {/* الخطوة 1: بطاقة تحديد الموقع الجغرافي (GPS أو اختيار من الخريطة التفاعلية) */}
                  <div
                    className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                      currentAddressCoords
                        ? 'bg-emerald-50/75 border-emerald-200'
                        : 'bg-amber-50/85 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          currentAddressCoords
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        <Navigation
                          className={`w-4 h-4 ${detectingGps ? 'animate-spin' : ''}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 leading-tight">
                          {detectingGps
                            ? 'جاري تحديد موقعك الحالي...'
                            : currentAddressCoords
                            ? 'تم تحديد موقعك على الخريطة بنجاح ✓'
                            : 'خطوة 1: حدد موقعك على الخريطة للكابتن'}
                        </div>
                        <div className="text-[11px] text-slate-600 font-bold leading-snug mt-0.5 truncate">
                          {currentAddressCoords
                            ? detectedPlaceLabel
                              ? `📍 بالقرب من: ${detectedPlaceLabel}`
                              : gpsStatusMessage || 'تم ربط إحداثيات التوصيل بدقة'
                            : 'اختر موقعك الحالي بالـ GPS أو حدد الدبوس من الخريطة'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={detectingGps}
                        onClick={() => {
                          setUserEditedStreet(false);
                          acquireGpsLocation({ silent: false, overwriteWrittenText: true });
                        }}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer ${
                          currentAddressCoords
                            ? 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Crosshair className={`w-3.5 h-3.5 shrink-0 ${detectingGps ? 'animate-spin' : ''}`} />
                        <span>{detectingGps ? 'جاري التحديد...' : 'موقعي الحالي'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="py-2 px-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <MapIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>اختيار من الخريطة</span>
                      </button>
                    </div>
                  </div>

                  {/* الخطوة 2: تفاصيل المكان مقسمة بوضوح وسهولة تامة بدون تكرار */}
                  <div className="space-y-2.5 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
                    {/* اسم الشارع أو المنطقة (خانة واحدة واضحة مع زر مسح سريع) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-black text-slate-800">
                          الشارع / المنطقة <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-bold">
                          يمكنك تعديله بحرية
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="مثال: الشيخ زايد، المجاورة 3، شارع النزهة..."
                          value={streetArea}
                          onFocus={() => {
                            if (!capturedCoords && !detectingGps) {
                              acquireGpsLocation({ silent: true, overwriteWrittenText: false });
                            }
                          }}
                          onChange={(e) => {
                            setStreetArea(e.target.value);
                            setUserEditedStreet(true);
                            if (error) setError(null);
                          }}
                          className="w-full pr-3 pl-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          required
                        />
                        {streetArea && (
                          <button
                            type="button"
                            onClick={() => {
                              setStreetArea('');
                              setUserEditedStreet(true);
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                            title="مسح النص لكتابة اسم شارع آخر"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* خانات العمارة - الدور - الشقة (جنباً إلى جنب لتسهيل الإدخال في ثانية) */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          العمارة / المبنى
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: 12"
                          value={buildingNo}
                          onChange={(e) => setBuildingNo(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          الدور
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: 3"
                          value={floorNo}
                          onChange={(e) => setFloorNo(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          الشقة / الغرفة
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: 5"
                          value={apartmentNo}
                          onChange={(e) => setApartmentNo(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    {/* علامة مميزة أو توجيه للكابتن */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        علامة مميزة للكابتن (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: أمام صيدلية، البوابة الجانبية، عمارة سوبر ماركت..."
                        value={landmarkNote}
                        onChange={(e) => setLandmarkNote(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />

                      {/* اختصارات سريعة قابلة للتحديد والإلغاء بلمسة واحدة */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ADDRESS_QUICK_CHIPS.map((chip) => {
                          const isChipActive = selectedLandmarkChips.includes(chip);
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => handleToggleAddressChip(chip)}
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                isChipActive
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200'
                              }`}
                            >
                              {isChipActive ? <Check className="w-2.5 h-2.5" /> : <span>+</span>}
                              <span>{chip}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* معاينة مريحة لما سيصل للكابتن */}
                    {composedNewAddressDetails.trim() && (
                      <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-950 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-black text-indigo-700">العنوان للكابتن: </span>
                          <span className="font-bold break-words">{composedNewAddressDetails}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* حفظ العنوان في الحساب مع تسمية سريعة (المنزل / السكن / العمل / الجامعة) */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveAddressToProfile}
                        onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-bold">حفظ هذا العنوان في عناويني لطلباتك القادمة</span>
                    </label>

                    {saveAddressToProfile && (
                      <div className="pr-6 space-y-2 animate-fadeIn">
                        <div className="flex flex-wrap gap-1.5">
                          {SAVE_ADDRESS_PRESETS.map((preset) => {
                            const active = saveLabelPreset === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => setSaveLabelPreset(preset.id)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                                  active
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                                }`}
                              >
                                <span>{preset.emoji}</span>
                                <span>{preset.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        {saveLabelPreset === 'أخرى' && (
                          <input
                            type="text"
                            placeholder="اكتب اسماً مميزاً للعنوان (مثال: بيت جدي، النادي...)"
                            value={customSaveLabel}
                            onChange={(e) => setCustomSaveLabel(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 3 أو 4. طريقة الدفع والخصومات */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                {orderType === 'DELIVERY' ? '4' : '3'}
              </span>
              <h4 className="text-xs font-black text-slate-800">طريقة الدفع</h4>
            </div>

            <div className="space-y-2">
              {paymentConfig?.cashEnabled && (
                <label
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment"
                      value="CASH"
                      checked={paymentMethod === 'CASH'}
                      onChange={() => setPaymentMethod('CASH')}
                      className="text-indigo-600"
                    />
                    <span>💵 الدفع نقداً عند الاستلام (كاش)</span>
                  </div>
                </label>
              )}

              {paymentConfig?.vodafoneCashEnabled && (
                <div
                  onClick={() => setPaymentMethod('VODAFONE_CASH')}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all space-y-2 ${
                    paymentMethod === 'VODAFONE_CASH'
                      ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        value="VODAFONE_CASH"
                        checked={paymentMethod === 'VODAFONE_CASH'}
                        onChange={() => setPaymentMethod('VODAFONE_CASH')}
                        className="text-indigo-600"
                      />
                      <span>📱 فودافون كاش ومحافظ إلكترونية</span>
                    </div>
                  </div>

                  {paymentConfig.vodafoneCashNumber && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-indigo-100"
                    >
                      <div className="text-[11px] text-slate-700">
                        <span>رقم التحويل: </span>
                        <strong className="font-mono text-indigo-700">
                          {paymentConfig.vodafoneCashNumber}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(paymentConfig.vodafoneCashNumber, 'vodafone')
                        }
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center gap-1 transition-colors"
                      >
                        {copiedField === 'vodafone' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ الرقم</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {paymentConfig?.instapayEnabled && (
                <div
                  onClick={() => setPaymentMethod('INSTAPAY')}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all space-y-2 ${
                    paymentMethod === 'INSTAPAY'
                      ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment"
                        value="INSTAPAY"
                        checked={paymentMethod === 'INSTAPAY'}
                        onChange={() => setPaymentMethod('INSTAPAY')}
                        className="text-indigo-600"
                      />
                      <span>⚡ إنستاباي (InstaPay)</span>
                    </div>
                  </div>

                  {paymentConfig.instapayHandle && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-indigo-100"
                    >
                      <div className="text-[11px] text-slate-700 truncate">
                        <span>معرف التحويل: </span>
                        <strong className="font-mono text-indigo-700">
                          {paymentConfig.instapayHandle}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(paymentConfig.instapayHandle, 'instapay')}
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center gap-1 transition-colors shrink-0"
                      >
                        {copiedField === 'instapay' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ المعرف</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {paymentConfig?.cardEnabled && (
                <label
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                    paymentMethod === 'CARD'
                      ? 'border-indigo-600 bg-indigo-50/60 font-black text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment"
                      value="CARD"
                      checked={paymentMethod === 'CARD'}
                      onChange={() => setPaymentMethod('CARD')}
                      className="text-indigo-600"
                    />
                    <span>💳 بطاقة بنكية (فيزا / ماستركارد)</span>
                  </div>
                </label>
              )}
            </div>

            {/* في حال تفعيل خيار الدفع والتحويل عند استلام الطلب مع الكابتن */}
            {paymentConfig?.requirePaymentProof === false && (paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') && (
              <div className="p-3.5 bg-indigo-50/90 rounded-2xl border border-indigo-200/90 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl text-base shrink-0">🛵</span>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950">
                      الدفع والتحويل عند استلام الطلب مع الكابتن
                    </h4>
                    <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">
                      يمكنك نسخ {paymentMethod === 'VODAFONE_CASH' ? 'رقم المحفظة' : 'معرف إنستاباي'} الموضح أعلاه، والتحويل المباشر بمبلغ <strong className="font-mono text-indigo-950 font-black">({total} ج.م)</strong> فور وصول كابتن التوصيل إلى بابك دون الحاجة لرفع إيصال الآن.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* إثبات التحويل الإلزامي في حالة فودافون كاش أو إنستاباي عند إلزام إرفاق الإيصال */}
            {paymentConfig?.requirePaymentProof !== false && (paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') && (
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-black text-amber-950">
                      بيانات تأكيد التحويل ({total} ج.م)
                    </h4>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    {paymentMethod === 'VODAFONE_CASH'
                      ? 'رقم المحفظة التي تم التحويل منها (مطلوب) *'
                      : 'اسم حسابك أو رقمك على إنستاباي (مطلوب) *'}
                  </label>
                  <input
                    type={paymentMethod === 'VODAFONE_CASH' ? 'tel' : 'text'}
                    placeholder={
                      paymentMethod === 'VODAFONE_CASH'
                        ? 'رقم مصري مكون من 11 رقماً (مثال: 01012345678)'
                        : 'مثال: username@instapay أو 01012345678'
                    }
                    value={paymentSenderPhone}
                    onChange={(e) => {
                      if (paymentMethod === 'VODAFONE_CASH') {
                        const clean = cleanEgyptianPhoneInput(e.target.value);
                        setPaymentSenderPhone(clean);
                      } else {
                        setPaymentSenderPhone(e.target.value);
                      }
                      if (error) setError(null);
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 transition-colors ${
                      paymentMethod === 'VODAFONE_CASH' && paymentSenderPhone
                        ? isSenderPhoneValid
                          ? 'border-emerald-400 focus:ring-emerald-500 text-emerald-950'
                          : 'border-rose-400 focus:ring-rose-500 text-rose-950'
                        : 'border-amber-200 focus:ring-amber-500'
                    }`}
                  />
                  {paymentMethod === 'VODAFONE_CASH' && paymentSenderPhone && (
                    <div className="mt-1 text-[10px] font-bold">
                      {isSenderPhoneValid ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          ✓ رقم محفظة مصري صحيح
                        </span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1">
                          ⚠ يجب أن يكون رقماً مصرياً مكوناً من 11 رقماً ويبدأ بـ (010, 011, 012, 015)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-amber-900">
                      صورة إيصال التحويل (Screenshot) *
                    </label>
                    <span className="text-[10px] font-black text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-md">
                      مطلوب إرفاقها
                    </span>
                  </div>
                  {paymentProofUrl ? (
                    <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-emerald-300 ring-1 ring-emerald-500/20">
                      <img
                        src={getFullImageUrl(paymentProofUrl)}
                        alt="إيصال التحويل"
                        className="w-11 h-11 rounded-lg object-cover border"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-emerald-700 block">
                          تم إرفاق الإيصال بنجاح ✓
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          سيقوم المطعم بمراجعته وتأكيد الطلب
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentProofUrl('')}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center justify-center gap-2 p-3 bg-white hover:bg-amber-100/50 border border-dashed border-amber-300 hover:border-amber-400 rounded-xl text-xs font-bold text-amber-800 transition-all">
                      <Upload className="w-4 h-4 text-amber-600" />
                      <span>
                        {uploadingProof ? 'جاري رفع الإيصال...' : 'اضغط لرفع لقطة شاشة التحويل (إجباري)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingProof}
                        onChange={handleProofUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* كوبون الخصم */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600">
                كوبون الخصم (Promo Code)
              </label>
              {appliedPromo ? (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-black min-w-0">
                    {appliedPromo.isAutoApplied ? (
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate">
                      {appliedPromo.isPersonal
                        ? `🎁 تم تطبيق كوبونك الخاص (${appliedPromo.code})`
                        : appliedPromo.isAutoApplied
                        ? `⚡ تم تطبيق الخصم التلقائي (${appliedPromo.code})`
                        : `تم تطبيق الكوبون (${appliedPromo.code})`}{' '}
                      — خصم {discount} ج.م
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-rose-600 hover:text-rose-700 font-bold text-xs shrink-0 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="أدخل كود الخصم (اختياري)"
                      value={/^(null|undefined)$/i.test(promoCodeInput.trim()) ? '' : promoCodeInput}
                      onChange={(e) => {
                        const rawVal = e.target.value.toUpperCase();
                        setPromoCodeInput(/^(NULL|UNDEFINED)$/i.test(rawVal.trim()) ? '' : rawVal);
                        if (promoError) setPromoError(null);
                      }}
                      className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={promoLoading || !sanitizePromoCodeValue(promoCodeInput)}
                    onClick={handleApplyPromoCode}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {promoLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : 'تطبيق'}
                  </button>
                </div>
              )}
              {promoError && <p className="text-[11px] text-rose-600 font-bold">{promoError}</p>}
            </div>

            {/* المحفظة ونقاط الولاء */}
            {user && (
              <div className="p-3 rounded-2xl bg-gradient-to-l from-indigo-50/90 via-purple-50/70 to-amber-50/70 border border-indigo-200/70 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-xl shrink-0">
                      <Wallet className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900">
                        المحفظة ونقاط الولاء
                      </div>
                      <div className="text-[11px] text-slate-600 font-bold truncate">
                        رصيدك: <strong className="text-indigo-700 font-mono">{walletBalance.toFixed(0)} ج.م</strong> •
                        نقاطك: <strong className="text-amber-600 font-mono">{loyaltyPoints} نقطة</strong>
                      </div>
                    </div>
                  </div>

                  {loyaltyPoints > 0 && (
                    <button
                      type="button"
                      disabled={convertingPoints}
                      onClick={handleQuickConvertPoints}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-[10px] font-black shadow-2xs transition-all shrink-0 cursor-pointer"
                    >
                      {convertingPoints
                        ? 'جاري التحويل...'
                        : `تحويل ${loyaltyPoints} نقطة لـ ${loyaltyPoints} ج.م`}
                    </button>
                  )}
                </div>

                {walletBalance > 0 && (
                  <label className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 min-w-0">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => setUseWallet(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                      />
                      <span className="truncate">استخدام رصيد المحفظة للخصم</span>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 font-mono shrink-0">
                      -{Math.min(preWalletTotal, walletBalance).toFixed(0)} ج.م
                    </span>
                  </label>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-indigo-800 font-bold bg-white/70 px-2.5 py-1 rounded-xl border border-indigo-100/80">
                  <Gift className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    ستكسب <strong>+{pointsToEarn} نقطة ولاء</strong> فور إتمام هذا الطلب
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* 6. ملاحظات إضافية للفرع + ملخص الفاتورة */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                ملاحظات إضافية للفرع أو الكابتن
              </label>
              <input
                type="text"
                placeholder="مثال: بدون بصل، زيادة كاتشب، اتصل عند الوصول..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ORDER_NOTE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setNotes((prev) =>
                        prev ? (prev.includes(chip) ? prev : `${prev} - ${chip}`) : chip
                      )
                    }
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/80 text-[10px] font-bold transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* ملخص الحساب */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-bold font-mono">{subtotal} ج.م</span>
              </div>
              {orderType === 'DELIVERY' && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    رسوم التوصيل{deliveryZoneName ? ` (${deliveryZoneName})` : ''}:
                  </span>
                  <span className="font-bold font-mono">{deliveryFee} ج.م</span>
                </div>
              )}
              {appliedPromo && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم الكوبون ({appliedPromo.code}):</span>
                  <span className="font-mono">-{discount} ج.م</span>
                </div>
              )}
              {walletDiscount > 0 && (
                <div className="flex justify-between text-indigo-600 font-bold">
                  <span>خصم المحفظة:</span>
                  <span className="font-mono">-{walletDiscount} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>الإجمالي المطلوب سداده:</span>
                <span className="text-indigo-700 font-mono text-base">{total} ج.م</span>
              </div>
            </div>
          </section>
        </div>

        {/* الشريط السفلي الثابت لتأكيد الطلب */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white pb-safe space-y-2 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {!user && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>يرجى تسجيل الدخول لتأكيد ومتابعة الطلب</span>
              </div>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shadow-2xs transition-colors shrink-0"
              >
                دخول الحساب
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={
              loading ||
              branch.isActive === false ||
              isBranchFullyClosed ||
              isBranchOffline ||
              isBranchBusy ||
              (isScheduled ? !isScheduledTimeValid : isBranchClosed) ||
              isOutOfDeliveryZone
            }
            className={`w-full py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all flex items-center justify-between ${
              loading ||
              branch.isActive === false ||
              isBranchFullyClosed ||
              isBranchOffline ||
              isBranchBusy ||
              (isScheduled ? !isScheduledTimeValid : isBranchClosed) ||
              isOutOfDeliveryZone
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-600/25 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>
                {loading
                  ? 'جاري إرسال الطلب وتثبيت الموقع...'
                  : isOutOfDeliveryZone
                  ? 'المطعم خارج نطاق التوصيل'
                  : branch.isActive === false
                  ? 'المطعم موقوف حالياً'
                  : isBranchOffline
                  ? 'المطعم غير متصل بالإنترنت حالياً'
                  : isBranchFullyClosed
                  ? 'المطعم مغلق حالياً'
                  : isBranchBusy
                  ? 'المطعم في فترة استراحة وتجهيز'
                  : isScheduled && !isScheduledTimeValid
                  ? 'المطعم مغلق في هذا التوقيت - اختر موعداً متاحاً'
                  : !isScheduled && isBranchClosed
                  ? 'المطعم مغلق حالياً'
                  : !user
                  ? 'تسجيل الدخول لإتمام الطلب'
                  : 'تأكيد الطلب الآن'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2.5 py-1 rounded-xl font-mono text-xs sm:text-sm">
                {total} ج.م
              </span>
              <ArrowLeft className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* نافذة اختيار المنطقة المنبثقة للعميل - مطابقة لتصميم السكرين 4 */}
      {isZoneModalOpen && hasZones && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
          onClick={() => setIsZoneModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-slideUp select-none border border-slate-100 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">اختر منطقة التوصيل</h3>
                <p className="text-[11px] text-slate-500 font-bold">حدد منطقتك لحساب رسوم التوصيل بدقة</p>
              </div>
              <button
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Radio Items List - Exactly like Screenshot 4 */}
            <div className="space-y-2 overflow-y-auto py-1 flex-1">
              {branch.deliveryZones.map((zone: any) => {
                const isSelected = selectedZoneId === zone.id;
                const geo = extractZoneGeo(zone.name);
                const cleanName = geo.cleanName;
                const coverage = (capturedCoords && geo.lat && geo.lng)
                  ? isCustomerWithinZoneGeo(capturedCoords.lat, capturedCoords.lng, geo)
                  : null;

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => {
                      setSelectedZoneId(zone.id);
                      setIsZoneModalOpen(false);
                    }}
                    className={`w-full p-4 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Radio Circle - Blue circle when checked (matching screenshot 4) */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-white'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm sm:text-base font-bold ${
                              isSelected ? 'text-indigo-950 font-black' : 'text-slate-800'
                            }`}
                          >
                            {cleanName}
                          </span>
                          {coverage && (
                            coverage.isCovered ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ضمن نطاقك ({formatDistance(coverage.distanceMeters)})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {coverage.reason || 'خارج النطاق'}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-sm font-black text-indigo-700 shrink-0 mr-2">
                      (+{zone.fee} ج.م)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* نافذة الخريطة التفاعلية لتحديد موقع التوصيل بدقة */}
      <LocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialLat={currentAddressCoords?.lat}
        initialLng={currentAddressCoords?.lng}
        initialAddress={streetArea || detectedPlaceLabel || ''}
        title="حدد موقع استلام طلبك على الخريطة"
        pinLabel="موقع استلام طلبك"
        confirmText="تأكيد موقع التوصيل"
        mode="POINT"
        onConfirm={handleMapLocationConfirm}
      />
    </div>
  );
};
