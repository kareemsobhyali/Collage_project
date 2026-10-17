import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Crosshair,
  ZoomIn,
  Clock,
  Gauge,
  Store,
  MapPin,
} from 'lucide-react';
import {
  calculateDistanceMeters,
  calculateEtaMinutes,
  formatDistance,
} from '../services/campusLocations';
import { openExternalLink } from '../services/notifications';

interface DriverRouteMapProps {
  mode: 'TO_RESTAURANT' | 'TO_CUSTOMER';
  driverCoords: { lat: number; lng: number };
  targetCoords: { lat: number; lng: number };
  targetTitle: string;
  targetSubtitle?: string;
  driverName?: string;
  hasLiveGps?: boolean;
  onRefreshGps?: () => void;
  compact?: boolean;
}

const escapeHtml = (val: unknown): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const DriverRouteMap: React.FC<DriverRouteMapProps> = ({
  mode,
  driverCoords,
  targetCoords,
  targetTitle,
  targetSubtitle,
  driverName = 'موقعك الحالي',
  hasLiveGps = false,
  onRefreshGps,
  compact = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const isToRestaurant = mode === 'TO_RESTAURANT';

  const distanceMeters = calculateDistanceMeters(
    driverCoords.lat,
    driverCoords.lng,
    targetCoords.lat,
    targetCoords.lng
  );
  const etaMinutes = calculateEtaMinutes(distanceMeters);

  // Initialize map and update when mode changes
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const midLat = (driverCoords.lat + targetCoords.lat) / 2;
    const midLng = (driverCoords.lng + targetCoords.lng) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [midLat, midLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    const safeDriverName = escapeHtml(driverName);
    const safeTargetTitle = escapeHtml(targetTitle);

    const driverIcon = L.divIcon({
      className: 'custom-driver-self-icon',
      html: `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
          <div class="px-2 py-0.5 mb-1 bg-slate-900/95 text-emerald-300 font-bold text-[10px] rounded-md shadow-md border border-emerald-400/50 whitespace-nowrap flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>${safeDriverName}</span>
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-emerald-500/30 animate-pulse"></div>
            <div class="w-9 h-9 rounded-2xl bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-base">
              🛵
            </div>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const targetIcon = L.divIcon({
      className: 'custom-driver-target-icon',
      html: isToRestaurant
        ? `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
          <div class="px-2 py-0.5 mb-1 bg-amber-950/95 text-amber-200 font-bold text-[10px] rounded-md shadow-md border border-amber-400/50 whitespace-nowrap">
            🏪 ${safeTargetTitle}
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-amber-500/35 animate-ping"></div>
            <div class="w-9 h-9 rounded-2xl bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-base">
              🏪
            </div>
          </div>
        </div>
      `
        : `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
          <div class="px-2 py-0.5 mb-1 bg-purple-950/95 text-purple-200 font-bold text-[10px] rounded-md shadow-md border border-purple-400/50 whitespace-nowrap">
            📍 ${safeTargetTitle}
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-purple-500/35 animate-ping"></div>
            <div class="w-9 h-9 rounded-2xl bg-purple-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-base">
              📍
            </div>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    driverMarkerRef.current = L.marker([driverCoords.lat, driverCoords.lng], {
      icon: driverIcon,
    }).addTo(map);

    targetMarkerRef.current = L.marker([targetCoords.lat, targetCoords.lng], {
      icon: targetIcon,
    }).addTo(map);

    polylineRef.current = L.polyline(
      [
        [driverCoords.lat, driverCoords.lng],
        [targetCoords.lat, targetCoords.lng],
      ],
      {
        color: isToRestaurant ? '#f59e0b' : '#10b981',
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.9,
      }
    ).addTo(map);

    const bounds = L.latLngBounds([
      [driverCoords.lat, driverCoords.lng],
      [targetCoords.lat, targetCoords.lng],
    ]);
    map.fitBounds(bounds.pad(0.32));

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mode, targetTitle]);

  // Update positions dynamically when coordinates change
  useEffect(() => {
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([driverCoords.lat, driverCoords.lng]);
    }
    if (targetMarkerRef.current) {
      targetMarkerRef.current.setLatLng([targetCoords.lat, targetCoords.lng]);
    }
    if (polylineRef.current) {
      polylineRef.current.setLatLngs([
        [driverCoords.lat, driverCoords.lng],
        [targetCoords.lat, targetCoords.lng],
      ]);
    }
  }, [driverCoords.lat, driverCoords.lng, targetCoords.lat, targetCoords.lng]);

  const handleCenterOnDriver = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mapRef.current) return;
    mapRef.current.setView([driverCoords.lat, driverCoords.lng], 17, { animate: true });
  };

  const handleFitRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mapRef.current) return;
    const bounds = L.latLngBounds([
      [driverCoords.lat, driverCoords.lng],
      [targetCoords.lat, targetCoords.lng],
    ]);
    mapRef.current.fitBounds(bounds.pad(0.32), { animate: true });
  };

  const handleOpenGoogleMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    openExternalLink(
      `https://www.google.com/maps/dir/?api=1&origin=${driverCoords.lat},${driverCoords.lng}&destination=${targetCoords.lat},${targetCoords.lng}&travelmode=two-wheeler`
    );
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`rounded-2xl overflow-hidden border shadow-md transition-all ${
        isToRestaurant
          ? 'border-amber-400/80 bg-slate-900'
          : 'border-emerald-500/80 bg-slate-900'
      }`}
    >
      {/* Top Banner showing current stage */}
      <div
        className={`px-3 py-2 flex items-center justify-between gap-2 text-white ${
          isToRestaurant
            ? 'bg-gradient-to-r from-amber-600 to-orange-600'
            : 'bg-gradient-to-r from-emerald-600 to-teal-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isToRestaurant ? (
            <Store className="w-4 h-4 shrink-0 text-amber-100" />
          ) : (
            <MapPin className="w-4 h-4 shrink-0 text-emerald-100" />
          )}
          <div className="min-w-0">
            <span className="text-[11px] font-black block truncate">
              {isToRestaurant
                ? `المسار إلى المطعم: ${targetTitle}`
                : `المسار إلى العميل: ${targetTitle}`}
            </span>
            {targetSubtitle && (
              <span className="text-[10px] text-white/85 block truncate">
                {targetSubtitle}
              </span>
            )}
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-black/25 text-[10px] font-black shrink-0">
          {isToRestaurant ? 'مرحلة الاستلام 🏪' : 'مرحلة التسليم 🛵'}
        </span>
      </div>

      {/* Interactive Map Canvas */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className={`w-full ${compact ? 'h-44' : 'h-56 sm:h-64'} z-0 relative focus:outline-none`}
        />

        {/* Floating Controls */}
        <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1 shadow-md flex items-center gap-1.5 pointer-events-auto">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  hasLiveGps ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  hasLiveGps ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-[10px] font-bold text-white">
              {hasLiveGps ? 'GPS متصل 🛰️' : 'تحديد تلقائي'}
            </span>
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            {onRefreshGps && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshGps();
                }}
                title="تحديث موقعي الحالي"
                className="px-2 h-7 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-md flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>موقعي</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCenterOnDriver}
              title="التركيز على موقعك"
              className="w-7 h-7 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700/80 shadow-md flex items-center justify-center transition-all active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitRoute}
              title="إظهار المسار بالكامل"
              className="w-7 h-7 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-md flex items-center justify-center transition-all active:scale-95"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Stats Bar: Remaining Distance & ETA + Google Maps Trigger */}
      <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isToRestaurant
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-medium truncate">
                {isToRestaurant ? 'فاضل للمطعم' : 'فاضل للعميل'}
              </span>
              <span className="text-xs font-black text-white block truncate">
                {formatDistance(distanceMeters)}
              </span>
            </div>
          </div>

          <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-medium truncate">
                الوقت المتبقي
              </span>
              <span className="text-xs font-black text-indigo-300 block truncate">
                {etaMinutes} دقيقة تقريباً
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenGoogleMaps}
          className={`w-full py-2 px-3 rounded-xl text-[11px] font-black text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
            isToRestaurant
              ? 'bg-amber-600 hover:bg-amber-500'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>
            {isToRestaurant
              ? 'بدء الملاحة إلى المطعم عبر Google Maps 🗺️'
              : 'بدء الملاحة إلى العميل عبر Google Maps 🗺️'}
          </span>
        </button>
      </div>
    </div>
  );
};
