import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { requestPushPermission } from '../services/notifications';
import {
  formatAddressWithCoordinates,
  cleanAddressText,
  getNearestLocationName,
  extractCoordinatesFromAddress,
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
  'الدور الأرضي',
  'الدور الأول',
  'الدور الثاني',
  'أمام الكافتيريا',
  'اتصل بي عند الوصول',
];

const ORDER_NOTE_CHIPS = [
  'بدون بصل',
  'زيادة كاتشب',
  'زيادة تومية',
  'الأكل سخن جداً',
  'اتصل عند الوصول',
];

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
  const isBranchBusy =
    branch.operationalStatus === 'BUSY' &&
    branch.closedUntil &&
    new Date() < new Date(branch.closedUntil);
  const isBranchFullyClosed = branch.operationalStatus === 'CLOSED';
  const isBranchClosed = isBranchFullyClosed || isBranchBusy || isBranchClosedByHours;

  useEffect(() => {
    if (isBranchClosed && isScheduled) {
      setIsScheduled(false);
    }
  }, [isBranchClosed, isScheduled]);

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

  // دالة التقاط الـ GPS (سواء تلقائياً بالخلفية عند كتابة عنوان أو يدوياً بالزر)
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

            setAddressTitle((prevTitle) => {
              if (!prevTitle.trim() || prevTitle === 'موقعي الحالي' || prevTitle === 'مكان التوصيل' || overwriteWrittenText) {
                return place.title;
              }
              return prevTitle;
            });

            setAddressText((prevText) => {
              const cleanPrev = cleanAddressText(prevText);
              const nextDetails =
                overwriteWrittenText ||
                !cleanPrev ||
                cleanPrev === 'موقعي الحالي بالحرم الجامعي' ||
                cleanPrev === 'موقعي الحالي'
                  ? place.details || place.title
                  : cleanPrev;
              return formatAddressWithCoordinates(nextDetails, lat, lng);
            });

            setGpsStatusMessage(`تم ربط موقعك بالـ GPS (${place.title})`);
          } catch (_) {
            setAddressText((prevText) => {
              const cleanPrev = cleanAddressText(prevText) || 'موقعي الحالي';
              return formatAddressWithCoordinates(cleanPrev, lat, lng);
            });
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
                  setError('يرجى السماح بصلاحية الموقع (GPS) من المتصفح أو الهاتف لربط عنوانك المكتوب بموقعك على الخريطة.');
                } else {
                  setError('تعذر التقاط إشارة الـ GPS حالياً، يرجى التأكد من تفعيل الموقع في هاتفك والمحاولة مرة أخرى.');
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

  // التقاط الـ GPS تلقائياً عند فتح نافذة السلة للتوصيل حتى لو العميل يكتب العنوان يدوياً
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
            if (def && !addressText) {
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

  // إذا تم التقاط إحداثيات الـ GPS وكان المستخدم قد كتب نصاً بدون إحداثيات، نربط الإحداثيات بالنص المكتوب تلقائياً
  useEffect(() => {
    if (capturedCoords && addressText.trim() && !addressText.includes('[GPS:')) {
      setAddressText(formatAddressWithCoordinates(addressText, capturedCoords.lat, capturedCoords.lng));
    }
  }, [capturedCoords, addressText]);

  const handleDeleteSavedAddress = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      setDeletingAddressId(id);
      await api.deleteAddress(id);
      const remaining = savedAddresses.filter((a) => a.id !== id);
      setSavedAddresses(remaining);
      if (selectedAddressId === id) {
        setSelectedAddressId(null);
        setIsWritingNewAddress(true);
        if (capturedCoords) {
          setAddressTitle(detectedPlaceLabel || 'موقعي الحالي');
          setAddressText(formatAddressWithCoordinates(detectedPlaceLabel || '', capturedCoords.lat, capturedCoords.lng));
        } else {
          setAddressTitle('');
          setAddressText('');
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

  // Promo Code
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    discountType: string;
    value: number;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Payment Proof (Vodafone Cash / InstaPay)
  const [paymentSenderPhone, setPaymentSenderPhone] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate dynamic delivery fee
  let deliveryFee = 0;
  let deliveryZoneName = '';
  if (orderType === 'DELIVERY') {
    if (hasZones) {
      const selectedZone =
        branch.deliveryZones.find((z: any) => z.id === selectedZoneId) || branch.deliveryZones[0];
      deliveryFee = selectedZone ? selectedZone.fee : 0;
      deliveryZoneName = selectedZone ? selectedZone.name : '';
    } else {
      deliveryFee = branch.deliveryFee || 0;
    }
  }

  const discount = appliedPromo ? appliedPromo.discount : 0;
  const preWalletTotal = Math.max(0, subtotal + deliveryFee - discount);
  const walletDiscount =
    useWallet && walletBalance > 0 ? Math.min(preWalletTotal, walletBalance) : 0;
  const total = Math.max(0, preWalletTotal - walletDiscount);
  const pointsToEarn = Math.max(1, Math.floor(subtotal / 10));

  const isPhoneValid = /^01[0125][0-9]{8}$/.test(customerPhone.trim());
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
    if (!promoCodeInput.trim()) return;
    setPromoError(null);
    try {
      setPromoLoading(true);
      const res = await api.validatePromoCode(
        promoCodeInput.trim().toUpperCase(),
        subtotal,
        branch?.id
      );
      if (res.valid || res.success) {
        setAppliedPromo({
          code: res.code,
          discount: res.discount,
          discountType: res.discountType,
          value: res.value,
        });
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
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError(null);
    localStorage.removeItem('unifood_auto_promo');
  };

  // Auto-apply Flash Deal coupon if student tapped one on Home screen
  useEffect(() => {
    const autoCode = localStorage.getItem('unifood_auto_promo');
    if (autoCode && !appliedPromo && subtotal > 0) {
      const normalized = autoCode.trim().toUpperCase();
      setPromoCodeInput(normalized);
      api
        .validatePromoCode(normalized, subtotal, branch?.id)
        .then((res) => {
          if (res.valid || res.success) {
            setAppliedPromo({
              code: res.code,
              discount: res.discount,
              discountType: res.discountType,
              value: res.value,
            });
            setPromoError(null);
            localStorage.removeItem('unifood_auto_promo');
          }
        })
        .catch(() => {});
    }
  }, [subtotal, branch?.id]);

  // Upload Payment Proof Screenshot
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProof(true);
      const res = await api.uploadImage(file);
      if (res.url) {
        setPaymentProofUrl(res.url);
      }
    } catch (err: any) {
      setError(err.message || 'فشل رفع لقطة شاشة التحويل');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleWrittenAddressChange = (newWrittenText: string) => {
    setSelectedAddressId(null);
    const coords = capturedCoords || extractCoordinatesFromAddress(addressText);
    if (coords) {
      setAddressText(formatAddressWithCoordinates(newWrittenText, coords.lat, coords.lng));
    } else {
      setAddressText(newWrittenText);
      // بمجرد أن يبدأ العميل بكتابة عنوانه، نسحب الـ GPS تلقائياً إذا لم يكن مسحوباً بعد
      if (!detectingGps) {
        acquireGpsLocation({ silent: true, overwriteWrittenText: false });
      }
    }
  };

  const handleAppendAddressChip = (chip: string) => {
    const currentClean = cleanAddressText(addressText);
    const updatedClean = currentClean
      ? currentClean.includes(chip)
        ? currentClean
        : `${currentClean} - ${chip}`
      : chip;
    handleWrittenAddressChange(updatedClean);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      onRequireAuth();
      return;
    }

    const finalPhone = (customerPhone.trim() || user.phone || '').trim();
    if (!/^01[0125][0-9]{8}$/.test(finalPhone)) {
      setError(
        'يرجى إدخال رقم موبايل مصري صحيح للتواصل مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015'
      );
      return;
    }

    let finalDeliveryAddress = addressText.trim();

    if (orderType === 'DELIVERY') {
      if (!cleanAddressText(finalDeliveryAddress).trim()) {
        setError('يرجى كتابة تفاصيل عنوان التوصيل (اسم المبنى / الدور / العلامة المميزة)');
        return;
      }

      // التأكد من أخذ موقع العميل بالـ GPS حتى لو أدخل عنواناً مكتوباً يدوياً
      let coords = extractCoordinatesFromAddress(finalDeliveryAddress) || capturedCoords;
      if (!coords) {
        coords = await acquireGpsLocation({ silent: false, overwriteWrittenText: false });
      }

      if (!coords) {
        setError(
          'لازم يتم تحديد موقعك بالـ GPS بجانب العنوان المكتوب عشان الكابتن يوصلك على الخريطة بدقة. اضغط على زر (سحب موقعي بالـ GPS) أو فعّل الموقع في هاتفك.'
        );
        return;
      }

      const writtenPart = cleanAddressText(finalDeliveryAddress) || addressTitle.trim() || 'موقعي الحالي';
      const titlePrefix =
        addressTitle.trim() && !writtenPart.includes(addressTitle.trim())
          ? `${addressTitle.trim()} - ${writtenPart}`
          : writtenPart;
      finalDeliveryAddress = formatAddressWithCoordinates(titlePrefix, coords.lat, coords.lng);
      setAddressText(finalDeliveryAddress);
    }

    if (
      (paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') &&
      total > 0 &&
      !paymentSenderPhone.trim() &&
      !paymentProofUrl.trim()
    ) {
      setError(
        `يرجى كتابة رقم/حساب المحول منه أو إرفاق صورة إيصال التحويل لتأكيد الدفع عبر ${
          paymentMethod === 'VODAFONE_CASH' ? 'فودافون كاش' : 'إنستاباي'
        }`
      );
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

    if (isBranchClosedByHours) {
      setError(
        `عذراً، المطعم مغلق حالياً لانتهاء مواعيد العمل الرسمية (${formatTime12Arabic(
          branch.openingTime || '08:00'
        )} - ${formatTime12Arabic(branch.closingTime || '22:00')}).`
      );
      return;
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
        customerName: customerName.trim() || user.name,
        notes: notes.trim() || undefined,
        deliveryZoneName:
          orderType === 'DELIVERY'
            ? deliveryZoneName || addressTitle.trim() || detectedPlaceLabel || undefined
            : undefined,
        deliveryFee: orderType === 'DELIVERY' ? deliveryFee : 0,
        paymentSenderPhone: paymentSenderPhone.trim() || undefined,
        paymentProofUrl: paymentProofUrl.trim() || undefined,
        promoCode: appliedPromo ? appliedPromo.code : undefined,
        discount: appliedPromo ? appliedPromo.discount : undefined,
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

      if (saveAddressToProfile && orderType === 'DELIVERY' && finalDeliveryAddress && user) {
        const titleToSave =
          addressTitle.trim() ||
          detectedPlaceLabel ||
          cleanAddressText(finalDeliveryAddress).slice(0, 25) ||
          'عنواني';
        api.addAddress(titleToSave, finalDeliveryAddress, savedAddresses.length === 0).catch(() => {});
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
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
            className="p-1 rounded-lg hover:bg-rose-700 text-white/90 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-slate-50 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[93dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative border border-slate-200/80">
        {/* مقبض السحب للموبايل */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0 z-20" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm truncate">
                سلة الطلب - {branch.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>{cart.reduce((acc, i) => acc + i.quantity, 0)} أصناف</span>
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
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto modal-scroll flex-1 space-y-4">
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
                  isBranchClosed
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isBranchClosed ? 'الفرع مغلق حالياً' : 'متاح الآن'}
              </span>
            </div>

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

            {/* فوري أم حجز لبريك المحاضرات */}
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
                disabled={isBranchClosed}
                onClick={() => {
                  if (isBranchClosed) return;
                  setIsScheduled(true);
                }}
                className={`py-2 px-3 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 ${
                  isBranchClosed
                    ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                    : isScheduled
                    ? 'border-indigo-600 bg-indigo-600 text-white font-black shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 font-bold'
                }`}
              >
                <span className="text-xs">🕒 حجز لموعد البريك</span>
              </button>
            </div>

            {isScheduled && (
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2 animate-fadeIn">
                <span className="text-[11px] font-bold text-slate-700 block">
                  اختر موعد البريك أو وقت الاستلام المطلوب:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { val: '11:30', label: '11:30 ص' },
                    { val: '12:30', label: '12:30 م' },
                    { val: '13:30', label: '1:30 م' },
                    { val: '14:30', label: '2:30 م' },
                    { val: '15:30', label: '3:30 م' },
                  ].map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setScheduledTime(t.val)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scheduledTime === t.val
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500 font-bold">أو حدد وقتاً مخصصاً:</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 3. موقع وعنوان التوصيل + الـ GPS المدمج */}
          {orderType === 'DELIVERY' && (
            <section className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-indigo-100 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center">
                    3
                  </span>
                  <h4 className="text-xs font-black text-slate-900">
                    موقع التوصيل (GPS + العنوان بالتفصيل) *
                  </h4>
                </div>
                {currentAddressCoords ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>GPS متصل ✓</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                    بانتظار الـ GPS
                  </span>
                )}
              </div>

              {/* اختيار منطقة التوصيل إن كان الفرع يعتمد Zones */}
              {hasZones && (
                <div className="space-y-1.5 pb-2 border-b border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-600">
                    اختر منطقة التوصيل:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {branch.deliveryZones.map((zone: any) => (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => setSelectedZoneId(zone.id)}
                        className={`p-2 rounded-xl border text-right transition-all flex items-center justify-between text-xs ${
                          selectedZoneId === zone.id
                            ? 'border-indigo-600 bg-indigo-50/70 font-black text-indigo-950 ring-1 ring-indigo-300'
                            : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span className="truncate">{zone.name}</span>
                        <span className="font-mono text-indigo-600 font-bold shrink-0">
                          +{zone.fee} ج.م
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* العناوين المحفوظة مع إمكانية الحذف المباشر أو إضافة عنوان جديد */}
              {savedAddresses.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">
                      عناويني المحفوظة ({savedAddresses.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(null);
                        setIsWritingNewAddress(true);
                        if (capturedCoords) {
                          setAddressTitle(detectedPlaceLabel || '');
                          setAddressText(formatAddressWithCoordinates('', capturedCoords.lat, capturedCoords.lng));
                        } else {
                          setAddressTitle('');
                          setAddressText('');
                          acquireGpsLocation({ silent: false, overwriteWrittenText: false });
                        }
                      }}
                      className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>كتابة عنوان جديد</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {savedAddresses.map((addr) => {
                      const isSelected =
                        !isWritingNewAddress &&
                        (selectedAddressId === addr.id || addressText === addr.details);
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
                              // ربط العنوان المحفوظ القديم بإحداثيات الـ GPS الحالية تلقائياً
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
                              : 'bg-slate-50/80 text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
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
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-black shrink-0 ${
                                    isSelected
                                      ? 'bg-emerald-400/30 text-white'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  GPS
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-indigo-100' : 'text-slate-500'
                              }`}
                            >
                              {cleanAddressText(addr.details) || addr.details}
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

              {/* شريط الـ GPS الإلزامي المدمج مع العنوان المكتوب */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  currentAddressCoords
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-amber-50/70 border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        currentAddressCoords
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      <Navigation
                        className={`w-4 h-4 ${detectingGps ? 'animate-spin' : ''}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        {detectingGps
                          ? 'جاري التقاط موقعك عبر الـ GPS...'
                          : currentAddressCoords
                          ? gpsStatusMessage ||
                            `تم ربط موقعك بالـ GPS (${detectedPlaceLabel || 'موقعي الحالي'})`
                          : 'إحداثيات الـ GPS مطلوبة مع العنوان المكتوب'}
                      </span>
                      <span className="text-[10px] text-slate-600 block truncate">
                        {currentAddressCoords
                          ? 'سيظهر موقعك الدقيق على الخريطة لكابتن التوصيل بجانب وصفك المكتوب'
                          : 'اضغط على الزر لتثبيت موقعك على الخريطة مع العنوان المكتوب'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      acquireGpsLocation({ silent: false, overwriteWrittenText: false })
                    }
                    disabled={detectingGps}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all shrink-0 flex items-center gap-1 shadow-2xs active:scale-95 ${
                      currentAddressCoords
                        ? 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{currentAddressCoords ? 'تحديث GPS' : 'سحب موقعي (GPS)'}</span>
                  </button>
                </div>
              </div>

              {/* حقول كتابة العنوان (اسم المكان + التفاصيل المكتوبة) */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    اسم المكان أو المنطقة (مثال: هايبر، كلية الهندسة، سكن الطلبة):
                  </label>
                  <input
                    type="text"
                    placeholder="اكتب اسم المكان أو المعلم الرئيسي القريب منك..."
                    value={addressTitle}
                    onChange={(e) => {
                      setAddressTitle(e.target.value);
                      if (!capturedCoords && !detectingGps) {
                        acquireGpsLocation({ silent: true, overwriteWrittenText: false });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      تفاصيل العنوان المكتوب للكابتن (المبنى / الدور / المدرج / الشقة) *:
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold">
                      يرتبط تلقائياً بالـ GPS
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="اكتب تفاصيل مكانك (مثال: مبنى ب - الدور الثالث - مدرج 5 أو رقم العمارة والشقة)..."
                    value={cleanWrittenDetails}
                    onFocus={() => {
                      if (!capturedCoords && !detectingGps) {
                        acquireGpsLocation({ silent: true, overwriteWrittenText: false });
                      }
                    }}
                    onChange={(e) => handleWrittenAddressChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />

                  {/* أزرار سريعة لإضافة تفاصيل شائعة بنقرة واحدة */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {ADDRESS_QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAppendAddressChip(chip)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/80 text-[10px] font-bold transition-colors"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* حفظ العنوان في الحساب */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAddressToProfile}
                    onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="font-bold">حفظ هذا العنوان مع الـ GPS في عناويني المحفوظة</span>
                </label>
              </div>
            </section>
          )}

          {/* 4. بيانات المستلم للتواصل */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                  {orderType === 'DELIVERY' ? '4' : '3'}
                </span>
                <h4 className="text-xs font-black text-slate-800">بيانات المستلم للتواصل</h4>
              </div>
              {isPhoneValid && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  <span>رقم الهاتف صحيح</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  اسم المستلم
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="اسم الطالب أو المستلم"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  رقم الموبايل (11 رقماً) *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="tel"
                    maxLength={11}
                    placeholder="010XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) =>
                      setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))
                    }
                    className={`w-full pr-8 pl-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 ${
                      customerPhone.length > 0 && !isPhoneValid
                        ? 'border-rose-300 focus:ring-rose-500'
                        : 'border-slate-200 focus:ring-indigo-600'
                    }`}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 5. طريقة الدفع والخصومات */}
          <section className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                {orderType === 'DELIVERY' ? '5' : '4'}
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

            {/* إثبات التحويل في حالة فودافون كاش أو إنستاباي */}
            {(paymentMethod === 'VODAFONE_CASH' || paymentMethod === 'INSTAPAY') && (
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
                    رقم محفظتك أو حسابك الذي حولت منه:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 01012345678 أو اسم حسابك على إنستاباي"
                    value={paymentSenderPhone}
                    onChange={(e) => setPaymentSenderPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    صورة إيصال التحويل (Screenshot):
                  </label>
                  {paymentProofUrl ? (
                    <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-amber-200">
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
                          سيقوم الفرع بمراجعته وتأكيد الطلب
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentProofUrl('')}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center justify-center gap-2 p-2.5 bg-white hover:bg-amber-100/50 border border-dashed border-amber-300 rounded-xl text-xs font-bold text-amber-800 transition-all">
                      <Upload className="w-4 h-4 text-amber-600" />
                      <span>
                        {uploadingProof ? 'جاري رفع الإيصال...' : 'اضغط لرفع لقطة شاشة التحويل'}
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
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>
                      تم تطبيق الكوبون {appliedPromo.code} (خصم {appliedPromo.discount} ج.م)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-rose-600 hover:text-rose-700 font-bold text-xs"
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
                      placeholder="أدخل كود الخصم (مثال: UNI20)"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={promoLoading || !promoCodeInput.trim()}
                    onClick={handleApplyPromoCode}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                  >
                    {promoLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : 'تطبيق'}
                  </button>
                </div>
              )}
              {promoError && <p className="text-[11px] text-rose-600 font-bold">{promoError}</p>}
            </div>

            {/* المحفظة ونقاط الولاء */}
            {user && (
              <div className="p-3 rounded-2xl bg-gradient-to-l from-indigo-50/90 via-purple-50/70 to-amber-50/70 border border-indigo-200/70 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-xl">
                      <Wallet className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        المحفظة ونقاط الولاء الجامعية
                      </div>
                      <div className="text-[11px] text-slate-600">
                        رصيدك: <strong className="text-indigo-700">{walletBalance.toFixed(0)} ج.م</strong> •
                        نقاطك: <strong className="text-amber-600">{loyaltyPoints} نقطة</strong>
                      </div>
                    </div>
                  </div>

                  {loyaltyPoints > 0 && (
                    <button
                      type="button"
                      disabled={convertingPoints}
                      onClick={handleQuickConvertPoints}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black shadow-2xs transition-all shrink-0"
                    >
                      {convertingPoints
                        ? 'جاري التحويل...'
                        : `تحويل ${loyaltyPoints} نقطة لـ ${loyaltyPoints} ج.م`}
                    </button>
                  )}
                </div>

                {walletBalance > 0 && (
                  <label className="flex items-center justify-between p-2 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => setUseWallet(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>استخدام رصيد المحفظة للخصم من هذا الطلب</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 font-mono">
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
                  <span>خصم المحفظة الجامعية:</span>
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
                <span>يرجى تسجيل الدخول كطالب لتأكيد ومتابعة الطلب</span>
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
            disabled={loading || isBranchClosed}
            className={`w-full py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all flex items-center justify-between ${
              isBranchClosed
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-600/25'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>
                {loading
                  ? 'جاري إرسال الطلب وتثبيت الموقع...'
                  : isBranchClosed
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
    </div>
  );
};
