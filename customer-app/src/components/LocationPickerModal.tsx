import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, 
  Search, 
  MapPin, 
  Navigation, 
  Check, 
  Loader2, 
  Building2, 
  Crosshair, 
  Compass, 
  Sparkles,
  Map as MapIcon
} from 'lucide-react';
import { 
  CAMPUS_LANDMARKS, 
  DEFAULT_CAMPUS_RESTAURANT_COORDS, 
  type CampusLandmark 
} from '../services/campusLocations';

export interface LocationPickerResult {
  lat: number;
  lng: number;
  address?: string;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  title?: string;
  onConfirm: (result: LocationPickerResult) => void;
}

interface PlaceSuggestion {
  id: string;
  name: string;
  secondary?: string;
  lat: number;
  lng: number;
  isCampus?: boolean;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  initialAddress = '',
  title = 'تحديد موقع المطعم على الخريطة',
  onConfirm,
}) => {
  // Determine starting coordinates
  const defaultCoords = {
    lat: initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_CAMPUS_RESTAURANT_COORDS.lat,
    lng: initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_CAMPUS_RESTAURANT_COORDS.lng,
  };

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>(defaultCoords);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>(initialAddress);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset coordinates whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const initLat = initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_CAMPUS_RESTAURANT_COORDS.lat;
      const initLng = initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_CAMPUS_RESTAURANT_COORDS.lng;
      setSelectedCoords({ lat: initLat, lng: initLng });
      setSelectedPlaceName(initialAddress || '');
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen, initialLat, initialLng, initialAddress]);

  // Leaflet custom marker icon
  const createPinIcon = useCallback(() => {
    return L.divIcon({
      className: 'custom-location-picker-pin',
      html: `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-full select-none cursor-grab active:cursor-grabbing">
          <div class="px-2.5 py-1 mb-1.5 bg-slate-900/95 text-white font-bold text-[11px] rounded-lg shadow-xl border border-slate-700 whitespace-nowrap flex items-center gap-1.5 animate-bounce">
            <span>🏪</span>
            <span>موقع المطعم المختار</span>
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-cyan-500/30 animate-ping"></div>
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-lg">
              📍
            </div>
            <div class="absolute -bottom-1 w-2.5 h-2.5 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
          </div>
        </div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 56],
    });
  }, []);

  // Initialize and tear down map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Destroy existing instance if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const initLat = selectedCoords.lat;
    const initLng = selectedCoords.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    // High quality OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // Draggable marker
    const marker = L.marker([initLat, initLng], {
      icon: createPinIcon(),
      draggable: true,
    }).addTo(map);

    // Drag marker event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const updated = { lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) };
      setSelectedCoords(updated);
    });

    // Map click event
    map.on('click', (e: L.LeafletMouseEvent) => {
      const updated = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
      marker.setLatLng(e.latlng);
      setSelectedCoords(updated);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Force Leaflet recalculation after modal transition finishes
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 250);

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, createPinIcon]);

  // Autocomplete search handler
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const debounceTimer = setTimeout(async () => {
      try {
        const localMatches: PlaceSuggestion[] = CAMPUS_LANDMARKS.filter(lm =>
          lm.name.toLowerCase().includes(query.toLowerCase()) ||
          lm.code.toLowerCase().includes(query.toLowerCase())
        ).map(lm => ({
          id: `campus-${lm.id}`,
          name: lm.name,
          secondary: 'معلم رئيسي بالحرم الجامعي',
          lat: lm.lat,
          lng: lm.lng,
          isCampus: true,
        }));

        let nominatimMatches: PlaceSuggestion[] = [];
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=ar&countrycodes=eg&limit=6&addressdetails=1`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const data = await res.json();
            nominatimMatches = (data || []).map((item: any, idx: number) => {
              const parts = (item.display_name || '').split(',').map((s: string) => s.trim());
              const mainName = item.name || parts[0] || query;
              const secondary = parts.slice(1, 4).join(', ');
              return {
                id: `osm-${item.place_id || idx}`,
                name: mainName,
                secondary: secondary || item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                isCampus: false,
              };
            });
          }
        } catch (fetchErr: any) {
          if (fetchErr.name !== 'AbortError') {
            console.warn('Nominatim search request failed:', fetchErr);
          }
        }

        // Combine: Campus landmarks first, then external places
        const combined = [...localMatches, ...nominatimMatches];
        setSuggestions(combined);
        setShowSuggestions(combined.length > 0);
      } catch (_) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [searchQuery]);

  // Handle selecting a search suggestion
  const handleSelectSuggestion = (sugg: PlaceSuggestion) => {
    setSelectedCoords({ lat: sugg.lat, lng: sugg.lng });
    setSelectedPlaceName(sugg.name);
    setSearchQuery(sugg.name);
    setShowSuggestions(false);

    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo([sugg.lat, sugg.lng], 17, { duration: 1 });
      markerRef.current.setLatLng([sugg.lat, sugg.lng]);
    }
  };

  // Center on User GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('خدمة تحديد الموقع الجغرافي غير مدعومة في متصفحك');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const newCoords = { lat: Number(latitude.toFixed(6)), lng: Number(longitude.toFixed(6)) };
        setSelectedCoords(newCoords);

        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([latitude, longitude], 17, { duration: 1 });
          markerRef.current.setLatLng([latitude, longitude]);
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = 'تعذر التقاط موقعك الجغرافي الحالي';
        if (err.code === 1) msg = 'تم رفض الإذن للوصول للموقع، يرجى تفعيله من إعدادات المتصفح';
        else if (err.code === 2) msg = 'إشارة الـ GPS غير متوفرة حالياً';
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Center on University Campus
  const handleCenterCampus = () => {
    const campus = DEFAULT_CAMPUS_RESTAURANT_COORDS;
    setSelectedCoords(campus);
    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo([campus.lat, campus.lng], 16, { duration: 0.8 });
      markerRef.current.setLatLng([campus.lat, campus.lng]);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  // Confirm selection
  const handleConfirm = () => {
    onConfirm({
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      address: selectedPlaceName.trim() || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col h-[92vh] sm:h-[620px] max-h-[96vh] overflow-hidden my-auto"
        onClick={() => setShowSuggestions(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0">
              <MapIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                انقر على الخريطة أو اسحب الدبوس لتحديد مكان المطعم بدقة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar with Autocomplete suggestions */}
        <div 
          className="p-3 sm:px-4 border-b border-slate-100 shrink-0 bg-white relative z-[1000]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              dir="rtl"
              placeholder="ابحث عن مكان، كلية، شارع، أو عنوان بالاسم (مع اقتراحات تلقائية)..."
              className="w-full pr-10 pl-10 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 transition-all outline-none text-right"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs absolute left-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Dropdown floating OVER map */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-3 right-3 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-56 sm:max-h-64 overflow-y-auto divide-y divide-slate-100 z-[1001] animate-fadeIn custom-scrollbar">
              <div className="p-2 bg-slate-50/90 text-[10px] font-bold text-slate-500 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                <span>اقتراحات الأماكن ({suggestions.length})</span>
                <span className="text-purple-600">اختر لتوجيه الخريطة فوراً</span>
              </div>
              {suggestions.map((sugg) => (
                <button
                  key={sugg.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(sugg);
                  }}
                  className="w-full p-2.5 text-right hover:bg-purple-50/70 active:bg-purple-100 transition-colors flex items-start gap-2.5 group cursor-pointer"
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    sugg.isCampus
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700'
                  }`}>
                    {sugg.isCampus ? <Building2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-purple-700 truncate">
                        {sugg.name}
                      </span>
                      {sugg.isCampus && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          معلم جامعي
                        </span>
                      )}
                    </div>
                    {sugg.secondary && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {sugg.secondary}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Container Area - Flex dynamically with viewport */}
        <div className="relative w-full flex-1 min-h-[200px] bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Instructions Helper */}
          <div className="absolute top-3 right-3 left-3 sm:left-auto sm:max-w-xs z-[400] pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-md text-[11px] font-bold text-slate-700 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>انقر بأي مكان لنقل الدبوس أو اسحبه بيدك</span>
            </div>
          </div>

          {/* Quick Floating Action Controls on Map */}
          <div className="absolute bottom-4 right-3 z-[400] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              title="موقعي الحالي بالـ GPS"
              className="p-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-cyan-600 rounded-2xl shadow-lg border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 text-cyan-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">موقعي الحالي</span>
            </button>
            <button
              type="button"
              onClick={handleCenterCampus}
              title="العودة لمركز الحرم الجامعي"
              className="p-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-purple-600 rounded-2xl shadow-lg border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0"
            >
              <Building2 className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">الحرم الجامعي</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-3 z-[400] flex flex-col gap-1.5 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden p-1">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm active:scale-95"
            >
              +
            </button>
            <div className="h-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm active:scale-95"
            >
              -
            </button>
          </div>
        </div>

        {/* Footer / Selected Info & Actions */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900">
                <span className="text-slate-500 font-sans text-[11px]">الإحداثيات:</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                </span>
              </div>
              {selectedPlaceName && (
                <p className="text-[11px] text-slate-500 font-bold mt-0.5 truncate max-w-xs">
                  📍 {selectedPlaceName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/25 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>تثبيت هذا الموقع</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
