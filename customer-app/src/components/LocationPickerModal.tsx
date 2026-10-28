import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  Sparkles,
  Map as MapIcon,
  Compass,
  Sliders,
  ShieldAlert,
  CheckCircle2,
  Ban,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  Maximize2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  CAMPUS_LANDMARKS, 
  DEFAULT_CAMPUS_RESTAURANT_COORDS,
  type DirectionalCoverage,
  generateCoveragePolygonPoints,
  formatDistance
} from '../services/campusLocations';

export interface LocationPickerResult {
  lat: number;
  lng: number;
  address?: string;
  radiusMeters?: number;
  directions?: DirectionalCoverage;
  isDirectional?: boolean;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  title?: string;
  mode?: 'POINT' | 'ZONE';
  initialRadius?: number;
  initialDirections?: DirectionalCoverage;
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
  title,
  mode = 'POINT',
  initialRadius = 1500,
  initialDirections,
  onConfirm,
}) => {
  const isZoneMode = mode === 'ZONE';

  // Determine starting coordinates
  const defaultCoords = {
    lat: initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_CAMPUS_RESTAURANT_COORDS.lat,
    lng: initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_CAMPUS_RESTAURANT_COORDS.lng,
  };

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>(defaultCoords);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>(initialAddress);
  
  // Radius and Directional state
  const [radiusMeters, setRadiusMeters] = useState<number>(initialRadius || 1500);
  const [isDirectional, setIsDirectional] = useState<boolean>(Boolean(initialDirections));
  const [directions, setDirections] = useState<DirectionalCoverage>(() => {
    if (initialDirections) {
      return { ...initialDirections };
    }
    const r = initialRadius || 1500;
    return { north: r, east: r, south: r, west: r };
  });

  // Collapsible directional panel
  const [showDirectionControls, setShowDirectionControls] = useState<boolean>(true);

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
  const coverageLayerRef = useRef<L.Layer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal title fallback
  const modalTitle = title || (isZoneMode ? 'تحديد موقع ونطاق منطقة التوصيل على الخريطة' : 'تحديد موقع المطعم على الخريطة');

  // Reset coordinates and settings whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const initLat = initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_CAMPUS_RESTAURANT_COORDS.lat;
      const initLng = initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_CAMPUS_RESTAURANT_COORDS.lng;
      setSelectedCoords({ lat: initLat, lng: initLng });
      setSelectedPlaceName(initialAddress || '');
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);

      const r = initialRadius && initialRadius > 0 ? initialRadius : 1500;
      setRadiusMeters(r);
      if (initialDirections) {
        setIsDirectional(true);
        setDirections({ ...initialDirections });
      } else {
        setIsDirectional(false);
        setDirections({ north: r, east: r, south: r, west: r });
      }
    }
  }, [isOpen, initialLat, initialLng, initialAddress, initialRadius, initialDirections]);

  // Leaflet custom marker icon
  const createPinIcon = useCallback(() => {
    return L.divIcon({
      className: 'custom-location-picker-pin',
      html: `
        <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-full select-none cursor-grab active:cursor-grabbing">
          <div class="px-2.5 py-1 mb-1.5 ${isZoneMode ? 'bg-indigo-900/95 border-indigo-400 text-indigo-100' : 'bg-slate-900/95 border-slate-700 text-white'} font-bold text-[11px] rounded-lg shadow-xl border whitespace-nowrap flex items-center gap-1.5 animate-bounce">
            <span>${isZoneMode ? '🎯' : '🏪'}</span>
            <span>${isZoneMode ? 'مركز نطاق التوصيل' : 'موقع المطعم المختار'}</span>
          </div>
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full ${isZoneMode ? 'bg-indigo-500/30' : 'bg-cyan-500/30'} animate-ping"></div>
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr ${isZoneMode ? 'from-indigo-600 via-purple-600 to-pink-600' : 'from-cyan-600 via-indigo-600 to-purple-600'} border-2 border-white shadow-2xl flex items-center justify-center text-white text-lg">
              📍
            </div>
            <div class="absolute -bottom-1 w-2.5 h-2.5 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
          </div>
        </div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 56],
    });
  }, [isZoneMode]);

  // Initialize and tear down map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const initLat = selectedCoords.lat;
    const initLng = selectedCoords.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLng],
      zoom: isZoneMode ? 14 : 16,
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

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const updated = { lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) };
      setSelectedCoords(updated);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const updated = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
      marker.setLatLng(e.latlng);
      setSelectedCoords(updated);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        if (isZoneMode) {
          const initCircle = L.circle([initLat, initLng], { radius: initialRadius || 1500 });
          mapRef.current.fitBounds(initCircle.getBounds(), { padding: [40, 40], maxZoom: 16 });
        }
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
  }, [isOpen, isZoneMode, createPinIcon]);

  // Update coverage visual overlay on Leaflet whenever coords, radius, or directions change
  useEffect(() => {
    if (!mapRef.current || !isZoneMode) return;

    if (coverageLayerRef.current) {
      coverageLayerRef.current.remove();
      coverageLayerRef.current = null;
    }

    if (!isDirectional) {
      const circle = L.circle([selectedCoords.lat, selectedCoords.lng], {
        radius: radiusMeters,
        color: '#4f46e5',
        fillColor: '#6366f1',
        fillOpacity: 0.22,
        weight: 2.5,
      }).addTo(mapRef.current);
      coverageLayerRef.current = circle;
    } else {
      const points = generateCoveragePolygonPoints(
        selectedCoords.lat,
        selectedCoords.lng,
        radiusMeters,
        directions
      );
      const polygon = L.polygon(points, {
        color: '#4f46e5',
        fillColor: '#6366f1',
        fillOpacity: 0.26,
        weight: 2.5,
      }).addTo(mapRef.current);
      coverageLayerRef.current = polygon;
    }
  }, [isZoneMode, selectedCoords, radiusMeters, isDirectional, directions]);

  // Fit view bounds to zone coverage shape
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current || !isZoneMode) return;
    if (coverageLayerRef.current && (coverageLayerRef.current as any).getBounds) {
      const bounds = (coverageLayerRef.current as any).getBounds();
      mapRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
    }
  }, [isZoneMode]);

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
          secondary: 'معلم رئيسي معروف',
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
      mapRef.current.flyTo([sugg.lat, sugg.lng], isZoneMode ? 15 : 17, { duration: 1 });
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
          mapRef.current.flyTo([latitude, longitude], isZoneMode ? 15 : 17, { duration: 1 });
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
      mapRef.current.flyTo([campus.lat, campus.lng], isZoneMode ? 15 : 16, { duration: 0.8 });
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

  // Direction manipulation helpers
  const handleToggleDirection = (dir: keyof DirectionalCoverage) => {
    setDirections(prev => {
      const currentVal = prev[dir];
      // If currently 0 (disabled), restore to base radius
      // If currently active (>0), set to 0 (disabled)
      const nextVal = currentVal > 0 ? 0 : (radiusMeters || 1500);
      return { ...prev, [dir]: nextVal };
    });
  };

  const handleUpdateDirectionRadius = (dir: keyof DirectionalCoverage, val: number) => {
    const clamped = Math.max(0, Math.min(25000, Math.round(val)));
    setDirections(prev => ({ ...prev, [dir]: clamped }));
  };

  const handleSwitchToUniform = () => {
    setIsDirectional(false);
  };

  const handleSwitchToDirectional = () => {
    setIsDirectional(true);
    setDirections(prev => ({
      north: prev.north > 0 ? prev.north : radiusMeters,
      east: prev.east > 0 ? prev.east : radiusMeters,
      south: prev.south > 0 ? prev.south : radiusMeters,
      west: prev.west > 0 ? prev.west : radiusMeters,
    }));
  };

  // Confirm selection
  const handleConfirm = () => {
    onConfirm({
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      address: selectedPlaceName.trim() || undefined,
      radiusMeters: isZoneMode ? radiusMeters : undefined,
      directions: isZoneMode && isDirectional ? directions : undefined,
      isDirectional: isZoneMode ? isDirectional : undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div 
        className={`relative w-full ${isZoneMode ? 'max-w-3xl' : 'max-w-2xl'} bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col h-[94vh] sm:h-[720px] max-h-[96vh] overflow-hidden my-auto`}
        onClick={() => setShowSuggestions(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${isZoneMode ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-purple-50 border-purple-200 text-purple-600'} border flex items-center justify-center shrink-0`}>
              {isZoneMode ? <Compass className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">
                {modalTitle}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                {isZoneMode
                  ? 'حدد المركز وتعرف على شكل النطاق التفاعلي مع التحكم الكامل في الاتجاهات'
                  : 'انقر على الخريطة أو اسحب الدبوس لتحديد مكان المطعم بدقة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar with Autocomplete suggestions */}
        <div 
          className="p-2.5 sm:px-4 border-b border-slate-100 shrink-0 bg-white relative z-[1000]"
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
              placeholder="ابحث عن مكان، منطقة، حي، أو شارع (مع اقتراحات تلقائية فورية)..."
              className="w-full pr-10 pl-10 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 transition-all outline-none text-right"
            />
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-indigo-600 absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer"
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
                <span className="text-indigo-600">اختر لتوجيه الخريطة فوراً</span>
              </div>
              {suggestions.map((sugg) => (
                <button
                  key={sugg.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(sugg);
                  }}
                  className="w-full p-2.5 text-right hover:bg-indigo-50/70 active:bg-indigo-100 transition-colors flex items-start gap-2.5 group cursor-pointer"
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    sugg.isCampus
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                  }`}>
                    {sugg.isCampus ? <Building2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 truncate">
                        {sugg.name}
                      </span>
                      {sugg.isCampus && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          معلم رئيسي
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

        {/* Map Container Area */}
        <div className="relative w-full flex-1 min-h-[220px] bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Instructions & Status Helper */}
          <div className="absolute top-3 right-3 left-3 sm:left-auto sm:max-w-xs z-[400] pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-md text-[11px] font-bold text-slate-700 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>
                {isZoneMode 
                  ? 'الدائرة/المضلع يوضح نطاق التوصيل الفعلي' 
                  : 'انقر لنقل الدبوس أو اسحبه إلى المكان المطلوب'}
              </span>
            </div>
          </div>

          {/* Floating Action Controls on Map */}
          <div className="absolute bottom-4 right-3 z-[400] flex flex-col gap-2">
            {isZoneMode && (
              <button
                type="button"
                onClick={handleFitBounds}
                title="احتواء ومحاذاة النطاق بالكامل على الشاشة"
                className="p-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-indigo-600 rounded-2xl shadow-lg border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-black shrink-0 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">احتواء النطاق</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              title="موقعي الحالي بالـ GPS"
              className="p-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-cyan-600 rounded-2xl shadow-lg border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <Navigation className={`w-4 h-4 text-cyan-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">موقعي الحالي</span>
            </button>
            <button
              type="button"
              onClick={handleCenterCampus}
              title="العودة لمركز المدينة"
              className="p-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-purple-600 rounded-2xl shadow-lg border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">مركز المدينة</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-3 z-[400] flex flex-col gap-1.5 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden p-1">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm active:scale-95 cursor-pointer"
            >
              +
            </button>
            <div className="h-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm active:scale-95 cursor-pointer"
            >
              -
            </button>
          </div>
        </div>

        {/* ZONE COVERAGE & DIRECTIONAL CONTROLS PANEL */}
        {isZoneMode && (
          <div className="border-t border-slate-200 bg-slate-50/90 shrink-0 max-h-[36vh] overflow-y-auto p-3 sm:px-4 space-y-2.5 custom-scrollbar">
            {/* Mode Selector Tabs (Uniform Circle vs Directional Custom) */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={handleSwitchToUniform}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    !isDirectional
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>⭕ نطاق دائري متساوي (360°)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToDirectional}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    isDirectional
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>🧭 تخصيص الاتجاهات (توسيع / حظر)</span>
                </button>
              </div>

              {/* Radius Presets (Master Radius) */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap ml-1">النطاق الأساسي:</span>
                {[
                  { label: '500م', val: 500 },
                  { label: '1كم', val: 1000 },
                  { label: '1.5كم', val: 1500 },
                  { label: '2كم', val: 2000 },
                  { label: '3كم', val: 3000 },
                  { label: '5كم', val: 5000 },
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => {
                      setRadiusMeters(p.val);
                      if (!isDirectional) {
                        setDirections({ north: p.val, east: p.val, south: p.val, west: p.val });
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer shrink-0 ${
                      radiusMeters === p.val
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Directional Controls Grid */}
            {isDirectional && (
              <div className="bg-white rounded-2xl border border-indigo-100 p-2.5 sm:p-3 shadow-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>التحكم في نطاق كل اتجاه والتوصيل فيه بشكل مستقل:</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    (اضغط على الاتجاه لإيقاف التوصيل فيه أو تعديل مداه)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {/* NORTH ⬆️ */}
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    directions.north > 0 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-rose-50/70 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-900">⬆️ الشمال (North)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDirection('north')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                          directions.north > 0
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800'
                            : 'bg-rose-100 text-rose-800 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                      >
                        {directions.north > 0 ? 'متاح ✅' : 'مغلق 🚫'}
                      </button>
                    </div>
                    {directions.north > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min="300"
                          max="15000"
                          step="100"
                          value={directions.north}
                          onChange={e => handleUpdateDirectionRadius('north', Number(e.target.value))}
                          className="flex-1 accent-indigo-600 cursor-pointer h-1.5"
                        />
                        <span className="text-xs font-mono font-bold text-indigo-700 shrink-0 w-16 text-left">
                          {formatDistance(directions.north)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-rose-600">التوصيل محظور بهذا الاتجاه</p>
                    )}
                  </div>

                  {/* EAST ➡️ */}
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    directions.east > 0 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-rose-50/70 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-900">➡️ الشرق (East)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDirection('east')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                          directions.east > 0
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800'
                            : 'bg-rose-100 text-rose-800 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                      >
                        {directions.east > 0 ? 'متاح ✅' : 'مغلق 🚫'}
                      </button>
                    </div>
                    {directions.east > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min="300"
                          max="15000"
                          step="100"
                          value={directions.east}
                          onChange={e => handleUpdateDirectionRadius('east', Number(e.target.value))}
                          className="flex-1 accent-indigo-600 cursor-pointer h-1.5"
                        />
                        <span className="text-xs font-mono font-bold text-indigo-700 shrink-0 w-16 text-left">
                          {formatDistance(directions.east)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-rose-600">التوصيل محظور بهذا الاتجاه</p>
                    )}
                  </div>

                  {/* SOUTH ⬇️ */}
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    directions.south > 0 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-rose-50/70 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-900">⬇️ الجنوب (South)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDirection('south')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                          directions.south > 0
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800'
                            : 'bg-rose-100 text-rose-800 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                      >
                        {directions.south > 0 ? 'متاح ✅' : 'مغلق 🚫'}
                      </button>
                    </div>
                    {directions.south > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min="300"
                          max="15000"
                          step="100"
                          value={directions.south}
                          onChange={e => handleUpdateDirectionRadius('south', Number(e.target.value))}
                          className="flex-1 accent-indigo-600 cursor-pointer h-1.5"
                        />
                        <span className="text-xs font-mono font-bold text-indigo-700 shrink-0 w-16 text-left">
                          {formatDistance(directions.south)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-rose-600">التوصيل محظور بهذا الاتجاه</p>
                    )}
                  </div>

                  {/* WEST ⬅️ */}
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    directions.west > 0 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-rose-50/70 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-900">⬅️ الغرب (West)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDirection('west')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                          directions.west > 0
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-800'
                            : 'bg-rose-100 text-rose-800 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                      >
                        {directions.west > 0 ? 'متاح ✅' : 'مغلق 🚫'}
                      </button>
                    </div>
                    {directions.west > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min="300"
                          max="15000"
                          step="100"
                          value={directions.west}
                          onChange={e => handleUpdateDirectionRadius('west', Number(e.target.value))}
                          className="flex-1 accent-indigo-600 cursor-pointer h-1.5"
                        />
                        <span className="text-xs font-mono font-bold text-indigo-700 shrink-0 w-16 text-left">
                          {formatDistance(directions.west)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-rose-600">التوصيل محظور بهذا الاتجاه</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer / Selected Info & Actions */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${isZoneMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-cyan-50 border-cyan-200 text-cyan-700'} border flex items-center justify-center shrink-0`}>
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900 flex-wrap">
                <span className="text-slate-500 font-sans text-[11px]">المركز:</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                </span>
                {isZoneMode && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200 text-[10px] font-bold">
                    {isDirectional 
                      ? `مخصص: ⬆️${directions.north > 0 ? formatDistance(directions.north) : 'مغلق'} | ➡️${directions.east > 0 ? formatDistance(directions.east) : 'مغلق'} | ⬇️${directions.south > 0 ? formatDistance(directions.south) : 'مغلق'} | ⬅️${directions.west > 0 ? formatDistance(directions.west) : 'مغلق'}`
                      : `نصف القطر: ${formatDistance(radiusMeters)}`}
                  </span>
                )}
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
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`px-5 py-2.5 ${isZoneMode ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/25' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/25'} text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer`}
            >
              <Check className="w-4 h-4" />
              <span>{isZoneMode ? 'تثبيت هذا النطاق والموقع' : 'تثبيت هذا الموقع'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
