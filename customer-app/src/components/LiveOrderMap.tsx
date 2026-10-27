import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Navigation, 
  MapPin, 
  Store, 
  Crosshair, 
  ZoomIn, 
  Phone, 
  MessageCircle, 
  Clock, 
  Gauge, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  calculateDistanceMeters, 
  calculateEtaMinutes, 
  formatDistance, 
  DEFAULT_CAMPUS_RESTAURANT_COORDS 
} from '../services/campusLocations';

interface LiveOrderMapProps {
  orderId: string;
  driverName?: string;
  driverPhone?: string;
  restaurantName?: string;
  orderStatus: string;
  studentCoords: { lat: number; lng: number };
  initialDriverCoords?: { lat: number; lng: number } | null;
  restaurantCoords?: { lat: number; lng: number } | null;
  liveDriverCoords?: { lat: number; lng: number } | null;
  pickupPin?: string | null;
}

export const LiveOrderMap: React.FC<LiveOrderMapProps> = ({
  driverName = 'كابتن التوصيل',
  driverPhone,
  restaurantName = 'المطعم',
  orderStatus,
  studentCoords,
  initialDriverCoords,
  restaurantCoords = DEFAULT_CAMPUS_RESTAURANT_COORDS,
  liveDriverCoords,
  pickupPin
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const studentMarkerRef = useRef<L.Marker | null>(null);
  const restaurantMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Current driver location
  const currentDriverPos = liveDriverCoords || initialDriverCoords || restaurantCoords || DEFAULT_CAMPUS_RESTAURANT_COORDS;
  const [distanceMeters, setDistanceMeters] = useState<number>(() => {
    return calculateDistanceMeters(
      currentDriverPos.lat,
      currentDriverPos.lng,
      studentCoords.lat,
      studentCoords.lng
    );
  });

  const [etaMinutes, setEtaMinutes] = useState<number>(() => {
    return calculateEtaMinutes(distanceMeters);
  });

  // 1. تهيئة الخريطة مرة واحدة
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // مركز الخريطة بين موقع العميل وموقع الطيار/المطعم
    const midLat = (studentCoords.lat + currentDriverPos.lat) / 2;
    const midLng = (studentCoords.lng + currentDriverPos.lng) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [midLat, midLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // استخدام بلاطات OpenStreetMap المجانية 100% بدون أي مفاتيح API أو علامات مائية
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    // أيقونة المطعم المخصصة
    const restaurantIcon = L.divIcon({
      className: 'custom-restaurant-icon',
      html: `
        <div class="relative flex flex-col items-center group -translate-x-1/2 -translate-y-1/2">
          <div class="px-2 py-0.5 mb-1 bg-slate-900/90 text-amber-300 font-bold text-[10px] rounded-md shadow-md border border-amber-400/40 whitespace-nowrap">
            ${restaurantName}
          </div>
          <div class="w-9 h-9 rounded-2xl bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-base">
            🏪
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    // أيقونة العميل / نقطة التسليم
    const studentIcon = L.divIcon({
      className: 'custom-student-icon',
      html: `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
          <div class="px-2 py-0.5 mb-1 bg-purple-950/90 text-purple-200 font-bold text-[10px] rounded-md shadow-md border border-purple-400/40 whitespace-nowrap">
            موقع التسليم
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full bg-purple-500/40 animate-ping"></div>
            <div class="w-8 h-8 rounded-2xl bg-purple-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-sm">
              📍
            </div>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    // أيقونة الطيار الحية
    const driverIcon = L.divIcon({
      className: 'custom-driver-icon',
      html: `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
          <div class="px-2 py-0.5 mb-1 bg-emerald-950/90 text-emerald-300 font-bold text-[10px] rounded-md shadow-md border border-emerald-400/40 whitespace-nowrap flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>${driverName}</span>
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-11 h-11 rounded-full bg-emerald-500/30 animate-pulse"></div>
            <div class="w-10 h-10 rounded-2xl bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-lg">
              🛵
            </div>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // إضافة العلامات للخريطة
    const restCoord = restaurantCoords || DEFAULT_CAMPUS_RESTAURANT_COORDS;
    restaurantMarkerRef.current = L.marker([restCoord.lat, restCoord.lng], { icon: restaurantIcon }).addTo(map);
    studentMarkerRef.current = L.marker([studentCoords.lat, studentCoords.lng], { icon: studentIcon }).addTo(map);
    driverMarkerRef.current = L.marker([currentDriverPos.lat, currentDriverPos.lng], { icon: driverIcon }).addTo(map);

    // خط المسار بين الطيار وموقع العميل
    polylineRef.current = L.polyline(
      [
        [currentDriverPos.lat, currentDriverPos.lng],
        [studentCoords.lat, studentCoords.lng],
      ],
      {
        color: '#10b981',
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.85,
      }
    ).addTo(map);

    // ضبط الرؤية لتشمل العلامات كلها
    const group = L.featureGroup([
      restaurantMarkerRef.current,
      studentMarkerRef.current,
      driverMarkerRef.current,
    ]);
    map.fitBounds(group.getBounds().pad(0.2));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. تحديث موقع الطيار الحي عند وصول إحداثيات جديدة عبر السوكيت
  useEffect(() => {
    if (!liveDriverCoords) return;

    const newDist = calculateDistanceMeters(
      liveDriverCoords.lat,
      liveDriverCoords.lng,
      studentCoords.lat,
      studentCoords.lng
    );
    setDistanceMeters(newDist);
    setEtaMinutes(calculateEtaMinutes(newDist));

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([liveDriverCoords.lat, liveDriverCoords.lng]);
    }

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([
        [liveDriverCoords.lat, liveDriverCoords.lng],
        [studentCoords.lat, studentCoords.lng],
      ]);
    }
  }, [liveDriverCoords?.lat, liveDriverCoords?.lng, studentCoords.lat, studentCoords.lng]);

  // 3. تحديث موقع العميل الفعلي في حال قراءة الـ GPS اللحظي لجهازه
  useEffect(() => {
    if (studentMarkerRef.current && studentCoords) {
      studentMarkerRef.current.setLatLng([studentCoords.lat, studentCoords.lng]);
    }
    const driverPos = liveDriverCoords || initialDriverCoords || restaurantCoords || DEFAULT_CAMPUS_RESTAURANT_COORDS;
    const newDist = calculateDistanceMeters(driverPos.lat, driverPos.lng, studentCoords.lat, studentCoords.lng);
    setDistanceMeters(newDist);
    setEtaMinutes(calculateEtaMinutes(newDist));

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([
        [driverPos.lat, driverPos.lng],
        [studentCoords.lat, studentCoords.lng],
      ]);
    }
  }, [studentCoords.lat, studentCoords.lng]);

  // 4. تحديث موقع المطعم في حال تعديله من شاشة الإعدادات
  useEffect(() => {
    if (restaurantMarkerRef.current && restaurantCoords) {
      restaurantMarkerRef.current.setLatLng([restaurantCoords.lat, restaurantCoords.lng]);
    }
  }, [restaurantCoords?.lat, restaurantCoords?.lng]);

  // التركيز على موقع الطيار
  const handleCenterOnDriver = () => {
    if (!mapRef.current) return;
    const pos = liveDriverCoords || initialDriverCoords || currentDriverPos;
    mapRef.current.setView([pos.lat, pos.lng], 17, { animate: true });
  };

  // إظهار المسار كاملاً
  const handleFitAll = () => {
    if (!mapRef.current || !studentMarkerRef.current || !driverMarkerRef.current) return;
    const bounds = L.latLngBounds([
      driverMarkerRef.current.getLatLng(),
      studentMarkerRef.current.getLatLng(),
    ]);
    mapRef.current.fitBounds(bounds.pad(0.35), { animate: true });
  };

  const isDelivered = orderStatus === 'COMPLETED';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-xl">
      {/* 1. مساحة الخريطة التفاعلية */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-64 sm:h-72 z-0 relative focus:outline-none" 
      />

      {/* 2. شريط الحالة العلوي الطافي */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 pointer-events-auto">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveDriverCoords ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${liveDriverCoords ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-[11px] font-black text-white">
            {liveDriverCoords ? 'تتبع GPS حي ومباشر' : 'الكابتن يستعد في المطعم 🛵'}
          </span>
        </div>

        {/* أزرار التحكم بالخريطة */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleCenterOnDriver}
            title="التركيز على الطيار"
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-lg flex items-center justify-center transition-all active:scale-95"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFitAll}
            title="عرض المسار بالكامل"
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 shadow-lg flex items-center justify-center transition-all active:scale-95"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. بطاقة المعلومات والإحصائيات السفلية */}
      <div className="p-3.5 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          {/* المسافة */}
          <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">المسافة المتبقية</span>
              <span className="text-xs font-black text-white">{isDelivered ? 'تم الوصول' : formatDistance(distanceMeters)}</span>
            </div>
          </div>

          {/* الوقت المتوقع */}
          <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">الوقت التقديري</span>
              <span className="text-xs font-black text-indigo-300">
                {isDelivered ? 'وصل بنجاح ⚡' : `${etaMinutes} دقيقة تقريباً`}
              </span>
            </div>
          </div>
        </div>

        {/* بيانات الطيار ورمز الاستلام */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">
              🛵
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">{driverName}</span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>في طريقه لتسليم طلبك</span>
              </span>
            </div>
          </div>

          {/* أزرار الاتصال السريع */}
          <div className="flex items-center gap-1.5 shrink-0">
            {driverPhone && (
              <>
                <a
                  href={`tel:${driverPhone}`}
                  className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                  title="اتصال بالطيار"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>اتصال</span>
                </a>
                <a
                  href={`https://wa.me/2${driverPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('السلام عليكم، بخصوص طلب UniFood للتوصيل')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/30 active:scale-95"
                  title="واتساب"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* رمز أمان الاستلام (PIN) */}
        {pickupPin && (
          <div className="p-2 bg-purple-950/40 border border-purple-800/50 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-purple-300 font-bold">رمز أمان الاستلام (PIN):</span>
              <span className="text-[10px] text-slate-400">(أعطه للطيار عند الاستلام)</span>
            </div>
            <div className="px-3 py-1 bg-purple-600 text-white rounded-lg font-mono font-black text-sm tracking-widest shadow-sm">
              {pickupPin}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
