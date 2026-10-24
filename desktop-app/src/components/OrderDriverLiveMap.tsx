import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Navigation, 
  MapPin, 
  Store, 
  Crosshair, 
  Clock, 
  Phone, 
  MessageCircle, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle,
  X,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { 
  extractCoordinatesFromAddress, 
  calculateDistanceMeters, 
  calculateEtaMinutes, 
  formatDistance, 
  cleanAddressText,
  getDisplayAddress,
  DEFAULT_CAMPUS_RESTAURANT_COORDS 
} from '../utils/address';

interface OrderDriverLiveMapProps {
  order: any;
  branch: any;
  liveDriverCoords?: { lat: number; lng: number } | null;
  onRefreshLocation?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

const cleanDriverName = (name?: string | null): string => {
  if (!name) return 'كابتن التوصيل';
  return name.replace(/\s*\(طيار عام\)\s*/g, '').trim() || name;
};

export const OrderDriverLiveMap: React.FC<OrderDriverLiveMapProps> = ({
  order,
  branch,
  liveDriverCoords,
  onRefreshLocation,
  onClose,
  isModal = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const restaurantMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // مرحلة الطلب: هل استلم الطيار الطلب من الفرع وخرج للعميل؟
  const isPickedUp = Boolean(order?.driverPickedUpAt) || order?.status === 'READY';
  const driver = order?.driver;

  // 1. إحداثيات المطعم (الفرع)
  const restaurantCoords = useMemo(() => {
    let lat = typeof branch?.latitude === 'number' && !isNaN(branch.latitude) ? branch.latitude : null;
    let lng = typeof branch?.longitude === 'number' && !isNaN(branch.longitude) ? branch.longitude : null;
    if (lat === null || lng === null) {
      const fromAddr = extractCoordinatesFromAddress(branch?.address);
      if (fromAddr) {
        lat = fromAddr.lat;
        lng = fromAddr.lng;
      } else {
        lat = DEFAULT_CAMPUS_RESTAURANT_COORDS.lat;
        lng = DEFAULT_CAMPUS_RESTAURANT_COORDS.lng;
      }
    }
    return { lat, lng };
  }, [branch]);

  // 2. إحداثيات العميل
  const customerCoords = useMemo(() => {
    const fromAddr = extractCoordinatesFromAddress(order?.addressText);
    if (fromAddr) return fromAddr;
    // إحداثيات افتراضية قريبة بالحرم الجامعي
    return { lat: restaurantCoords.lat + 0.0035, lng: restaurantCoords.lng + 0.0025 };
  }, [order?.addressText, restaurantCoords]);

  // 3. إحداثيات الطيار الحالية
  const driverPos = useMemo(() => {
    if (liveDriverCoords && typeof liveDriverCoords.lat === 'number' && typeof liveDriverCoords.lng === 'number') {
      return liveDriverCoords;
    }
    // في حال لم يرسل الطيار إحداثيات بعد، نفترض موقعه عند المطعم أو قريباً منه
    if (isPickedUp) {
      return { lat: restaurantCoords.lat + 0.001, lng: restaurantCoords.lng + 0.0008 };
    }
    return { lat: restaurantCoords.lat - 0.0018, lng: restaurantCoords.lng - 0.0015 };
  }, [liveDriverCoords, restaurantCoords, isPickedUp]);

  // 4. الوجهة المستهدفة للطيار حالياً:
  // قبل الاستلام: المطعم (عندي)
  // بعد الاستلام: مكان العميل
  const targetCoords = isPickedUp ? customerCoords : restaurantCoords;
  const targetLabel = isPickedUp ? 'مكان تسليم العميل' : 'موقع المطعم (الفرع)';

  // حساب المسافة والوقت المتبقي
  const distanceMeters = useMemo(() => {
    return calculateDistanceMeters(driverPos.lat, driverPos.lng, targetCoords.lat, targetCoords.lng);
  }, [driverPos, targetCoords]);

  const etaMinutes = useMemo(() => {
    return calculateEtaMinutes(distanceMeters);
  }, [distanceMeters]);

  // تهيئة وتحديث خريطة Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [driverPos.lat, driverPos.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;
    }

    const map = mapRef.current;

    // أيقونة الطيار (سكوتر دليفري متحرك مع نبض حي)
    const driverIcon = L.divIcon({
      className: 'custom-driver-marker',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -50%);">
          <div style="position:relative;">
            <div style="width:44px;height:44px;border-radius:16px;background:linear-gradient(135deg, #4f46e5, #7c3aed);border:3px solid #ffffff;box-shadow:0 8px 24px rgba(79,70,229,0.5);display:flex;align-items:center;justify-content:center;font-size:22px;color:#ffffff;">
              🛵
            </div>
            <span style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:9999px;background-color:#10b981;border:2px solid #ffffff;box-shadow:0 0 8px rgba(16,185,129,0.8);"></span>
          </div>
          <div style="margin-top:4px;padding:2px 8px;border-radius:8px;background:rgba(15,23,42,0.92);color:#ffffff;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);">
            كابتن: ${cleanDriverName(driver?.name)}
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
      driverMarkerRef.current.setIcon(driverIcon);
    }

    // أيقونة المطعم (الفرع)
    const restaurantIcon = L.divIcon({
      className: 'custom-restaurant-marker',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -50%);">
          <div style="width:38px;height:38px;border-radius:14px;background:linear-gradient(135deg, #f59e0b, #d97706);border:3px solid #ffffff;box-shadow:0 6px 18px rgba(217,119,6,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;color:#ffffff;">
            🏪
          </div>
          <div style="margin-top:4px;padding:2px 6px;border-radius:6px;background:rgba(15,23,42,0.9);color:#fcd34d;font-size:10px;font-weight:800;white-space:nowrap;border:1px solid rgba(245,158,11,0.4);">
            ${branch?.name || 'مطعمك (الفرع)'}
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    if (!restaurantMarkerRef.current) {
      restaurantMarkerRef.current = L.marker([restaurantCoords.lat, restaurantCoords.lng], { icon: restaurantIcon }).addTo(map);
    } else {
      restaurantMarkerRef.current.setLatLng([restaurantCoords.lat, restaurantCoords.lng]);
    }

    // أيقونة مكان تسليم العميل
    const customerIcon = L.divIcon({
      className: 'custom-customer-marker',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -50%);">
          <div style="width:38px;height:38px;border-radius:14px;background:linear-gradient(135deg, #e11d48, #be123c);border:3px solid #ffffff;box-shadow:0 6px 18px rgba(225,29,72,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;color:#ffffff;">
            📍
          </div>
          <div style="margin-top:4px;padding:2px 6px;border-radius:6px;background:rgba(15,23,42,0.9);color:#fecdd3;font-size:10px;font-weight:800;white-space:nowrap;border:1px solid rgba(225,29,72,0.4);">
            ${order?.customerName || 'مكان العميل'}
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    if (!customerMarkerRef.current) {
      customerMarkerRef.current = L.marker([customerCoords.lat, customerCoords.lng], { icon: customerIcon }).addTo(map);
    } else {
      customerMarkerRef.current.setLatLng([customerCoords.lat, customerCoords.lng]);
    }

    // رسم مسار الخط الحي (Polyline)
    const routePoints: L.LatLngExpression[] = isPickedUp
      ? [[driverPos.lat, driverPos.lng], [customerCoords.lat, customerCoords.lng]]
      : [[driverPos.lat, driverPos.lng], [restaurantCoords.lat, restaurantCoords.lng]];

    if (!polylineRef.current) {
      polylineRef.current = L.polyline(routePoints, {
        color: isPickedUp ? '#10b981' : '#4f46e5',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.85
      }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(routePoints);
      polylineRef.current.setStyle({
        color: isPickedUp ? '#10b981' : '#4f46e5'
      });
    }

    // ضبط حدود الخريطة لتشمل الطيار والوجهة المستهدفة
    try {
      const bounds = L.latLngBounds([
        [driverPos.lat, driverPos.lng],
        [targetCoords.lat, targetCoords.lng]
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: true });
    } catch (_) {}

  }, [driverPos, restaurantCoords, customerCoords, isPickedUp, driver?.name, branch?.name, order?.customerName]);

  const handleCenterOnDriver = () => {
    if (mapRef.current) {
      mapRef.current.setView([driverPos.lat, driverPos.lng], 17, { animate: true });
    }
  };

  const handleFitEntireRoute = () => {
    if (mapRef.current) {
      const bounds = L.latLngBounds([
        [driverPos.lat, driverPos.lng],
        [restaurantCoords.lat, restaurantCoords.lng],
        [customerCoords.lat, customerCoords.lng]
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17, animate: true });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (onRefreshLocation) {
      onRefreshLocation();
    }
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col transition-all ${
      isFullscreen ? 'fixed inset-3 sm:inset-6 z-50 shadow-2xl border-indigo-400' : 'w-full'
    }`}>
      {/* 1. Header Bar: Stage Info, Status Indicator, and Controls */}
      <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 font-black shadow-md ${
            isPickedUp
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30'
              : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/30'
          }`}>
            {isPickedUp ? '🚀' : '🛵'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs sm:text-sm text-white">
                {isPickedUp
                  ? 'الطيار استلم الطلب وفي طريقه للعميل'
                  : 'الطيار في طريقه للمطعم للاستلام'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isPickedUp ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40' : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
              }`}>
                طلب #{order?.orderNumber}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5 flex-wrap">
              <span>الكابتن: <strong className="text-white">{cleanDriverName(driver?.name)}</strong></span>
              {driver?.phone && (
                <span className="text-slate-400 font-mono" dir="ltr">({driver.phone})</span>
              )}
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                تتبع GPS حي 🛰️
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors active:scale-95"
            title="تحديث موقع الطيار"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors active:scale-95 hidden sm:flex items-center justify-center"
            title={isFullscreen ? 'تصغير الخريطة' : 'تكبير ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors active:scale-95"
              title="إغلاق الخريطة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Real-Time ETA & Distance Metric Cards (المسافة والوقت المتبقي) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200/90 shrink-0">
        {/* Card 1: Estimated Arrival Time (الوقت المتبقي) */}
        <div className={`p-2.5 rounded-2xl border flex items-center gap-2.5 shadow-2xs ${
          isPickedUp ? 'bg-emerald-50 border-emerald-200/90 text-emerald-950' : 'bg-indigo-50 border-indigo-200/90 text-indigo-950'
        }`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isPickedUp ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold block opacity-75">
              {isPickedUp ? 'وقت الوصول للعميل:' : 'وقت الوصول عندك:'}
            </span>
            <span className="text-sm sm:text-base font-black font-mono leading-none block mt-0.5">
              ~{etaMinutes} دقيقة
            </span>
          </div>
        </div>

        {/* Card 2: Remaining Distance (المسافة المتبقية) */}
        <div className="p-2.5 rounded-2xl bg-white border border-slate-200 flex items-center gap-2.5 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 block">
              {isPickedUp ? 'المسافة المتبقية للعميل:' : 'المسافة المتبقية للمطعم:'}
            </span>
            <span className="text-sm sm:text-base font-black text-slate-900 font-mono leading-none block mt-0.5">
              {formatDistance(distanceMeters)}
            </span>
          </div>
        </div>

        {/* Card 3: Destination Target / Contact Driver */}
        <div className="col-span-2 sm:col-span-1 p-2.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block">الوجهة المستهدفة:</span>
            <span className="text-xs font-black text-slate-800 truncate block mt-0.5" title={targetLabel}>
              {targetLabel}
            </span>
          </div>

          {driver?.phone && (
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`tel:${driver.phone}`}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                title="اتصال هاتفي بالطيار"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">اتصال</span>
              </a>
              <a
                href={`https://wa.me/${driver.phone.replace(/[^0-9]/g, '').startsWith('0') ? `20${driver.phone.replace(/[^0-9]/g, '').slice(1)}` : driver.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors"
                title="مراسلة واتساب"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 3. Interactive Leaflet Map Container */}
      <div className="relative w-full flex-1 min-h-[280px] sm:min-h-[360px] bg-slate-100">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

        {/* Floating Quick Action Buttons on Map */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleCenterOnDriver}
            className="px-3 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-xl text-xs font-bold shadow-lg border border-slate-200/90 backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5"
            title="تركيز الكاميرا على موقع الكابتن الحالي"
          >
            <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
            <span>مكان الطيار</span>
          </button>

          <button
            type="button"
            onClick={handleFitEntireRoute}
            className="px-3 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-xl text-xs font-bold shadow-lg border border-slate-200/90 backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5"
            title="عرض المسار بالكامل بين الطيار والوجهة"
          >
            <Navigation className="w-3.5 h-3.5 text-indigo-600" />
            <span>عرض المسار كاملاً</span>
          </button>
        </div>

        {/* Legend Overlay at Top Left of Map */}
        <div className="absolute top-3 left-3 z-20 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-700 shadow-md flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <span>الطيار</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>المطعم</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>العميل</span>
          </span>
        </div>
      </div>

      {/* 4. Footer Information & Delivery Details Bar */}
      <div className="p-3 bg-white border-t border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 text-slate-700 min-w-0">
          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="truncate">
            <strong>عنوان العميل:</strong> {getDisplayAddress(order?.addressText, 'داخل الحرم الجامعي')}
          </span>
        </div>

        {order?.pickupPin && (
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-xl font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>رمز استلام العميل (PIN): <strong className="font-mono text-sm tracking-widest">{order.pickupPin}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
