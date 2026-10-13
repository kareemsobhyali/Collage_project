import React, { useEffect, useRef, useState } from 'react';
import { getFullImageUrl } from '../services/api';
import { Sparkles, UtensilsCrossed } from 'lucide-react';

interface SplashScreenProps {
  branches?: any[];
  onFinish?: () => void;
  isReady?: boolean;
}

// Fallback food items if fewer branches are registered
const DEFAULT_FALLBACK_BRANDS = [
  { name: 'برجر الحرم', emoji: '🍔', gradient: 'from-amber-500 to-red-500' },
  { name: 'بيتزا إيطالي', emoji: '🍕', gradient: 'from-orange-500 to-amber-500' },
  { name: 'شاورما ميكس', emoji: '🌯', gradient: 'from-emerald-500 to-teal-500' },
  { name: 'كافيه الحرم', emoji: '☕', gradient: 'from-indigo-500 to-purple-500' },
  { name: 'فرايد تشيكن', emoji: '🍗', gradient: 'from-red-500 to-pink-500' },
  { name: 'عصائر طازجة', emoji: '🥤', gradient: 'from-cyan-500 to-blue-500' },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  branches = [], 
  onFinish, 
  isReady = true 
}) => {
  const [fadingOut, setFadingOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Minimum duration: 2 seconds so user can enjoy the orbit & food rain
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isReady) {
        setFadingOut(true);
        setTimeout(() => {
          setVisible(false);
          onFinish?.();
        }, 550);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isReady, onFinish]);

  // 1. Food Rain Animation (Canvas-based 60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const foodEmojis = ['🍔', '🍕', '🌯', '🍟', '☕', '🥤', '🍩', '🍗', '🌮', '🧇', '🍰', '🍜'];
    const particleCount = width < 640 ? 18 : 26;

    interface FoodParticle {
      x: number;
      y: number;
      speed: number;
      size: number;
      emoji: string;
      wobble: number;
      wobbleSpeed: number;
      opacity: number;
      rotation: number;
      rotSpeed: number;
    }

    const particles: FoodParticle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      speed: 1.5 + Math.random() * 2.2,
      size: 18 + Math.random() * 12,
      emoji: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      opacity: 0.35 + Math.random() * 0.45,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speed;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotSpeed;

        const currentX = p.x + Math.sin(p.wobble) * 12;

        if (p.y > height + 40) {
          p.y = -40;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(currentX, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!visible) return null;

  // Prepare satellite items to orbit
  // Filter active branches with valid name
  const validBranches = branches.slice(0, 6);
  let orbitItems: Array<{ id: string; name: string; logoUrl?: string; emoji?: string; gradient?: string }> = [];

  if (validBranches.length >= 3) {
    orbitItems = validBranches.map((b) => ({
      id: b.id,
      name: b.name,
      logoUrl: b.logoUrl,
    }));
  } else {
    // Fill up to 5 or 6 with fallback brands so circle is balanced
    const combined = [...validBranches];
    let fallbackIdx = 0;
    while (combined.length < 5 && fallbackIdx < DEFAULT_FALLBACK_BRANDS.length) {
      combined.push(DEFAULT_FALLBACK_BRANDS[fallbackIdx++] as any);
    }
    orbitItems = combined.map((it, idx) => ({
      id: it.id || `fb-${idx}`,
      name: it.name,
      logoUrl: it.logoUrl,
      emoji: (it as any).emoji,
      gradient: (it as any).gradient,
    }));
  }

  // Radius of orbit in pixels
  const orbitRadius = window.innerWidth < 640 ? 112 : 135;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 sm:p-8 bg-[#0B0F19] text-white select-none overflow-hidden transition-all duration-550 ease-out ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      dir="rtl"
    >
      {/* 1. Canvas Layer: Falling Food Rain */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Welcome Pill */}
      <div className="pt-6 sm:pt-8 relative z-10 flex items-center gap-1.5 px-3.5 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-xs font-bold text-indigo-200 shadow-md">
        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        <span>مطاعم الحرم الجامعي متجمعة لك • UniFood</span>
      </div>

      {/* 2. Centerpiece: Orbiting Restaurant Logos Carousel */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto">
        {/* Orbit container */}
        <div 
          className="relative flex items-center justify-center"
          style={{ width: `${orbitRadius * 2 + 70}px`, height: `${orbitRadius * 2 + 70}px` }}
        >
          {/* Subtle Orbit Track Circle Line */}
          <div 
            className="absolute rounded-full border border-indigo-400/20 border-dashed pointer-events-none"
            style={{ width: `${orbitRadius * 2}px`, height: `${orbitRadius * 2}px` }}
          />

          {/* Center UniFood Logo Anchor */}
          <div className="relative z-20 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white p-2.5 shadow-2xl border-2 border-indigo-500/30 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/20 to-indigo-600/20 rounded-2xl pointer-events-none" />
            <img
              src="/logo.png"
              alt="UniFood Logo"
              className="w-full h-full object-cover rounded-2xl shadow-inner"
            />
          </div>

          {/* The Orbiting Satellite Badges Container */}
          <div className="absolute inset-0 animate-spin-orbit">
            {orbitItems.map((item, idx) => {
              const total = orbitItems.length;
              const angleDeg = idx * (360 / total);
              const angleRad = (angleDeg * Math.PI) / 180;
              const x = Math.cos(angleRad) * orbitRadius;
              const y = Math.sin(angleRad) * orbitRadius;

              return (
                <div
                  key={item.id}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  {/* Counter-rotating badge so logo stays upright and readable! */}
                  <div className="animate-counter-spin flex flex-col items-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-1 shadow-xl border border-white/40 flex items-center justify-center overflow-hidden transition-transform hover:scale-110">
                      {item.logoUrl ? (
                        <img
                          src={getFullImageUrl(item.logoUrl)}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => {
                            // If logo image fails, fallback to restaurant icon
                            (e.target as HTMLElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) {
                              parent.innerHTML = '<span class="text-xl">🍽️</span>';
                            }
                          }}
                        />
                      ) : (
                        <div className={`w-full h-full rounded-xl bg-gradient-to-br ${item.gradient || 'from-indigo-600 to-purple-600'} text-white flex items-center justify-center font-black text-lg`}>
                          {item.emoji || item.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    {/* Compact Restaurant Name Chip */}
                    <span className="mt-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[9px] font-black text-slate-200 border border-white/10 max-w-[58px] truncate leading-none shadow-xs">
                      {item.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Brand Typography */}
        <div className="mt-4 space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
            <span className="text-white">Uni</span>
            <span className="text-amber-400">Food</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-300/90 font-bold">
            كل مطاعم الحرم الجامعي في سلة واحدة 🎓🍔
          </p>
        </div>
      </div>

      {/* 3. Bottom Progress Bar & Indicator */}
      <div className="pb-6 sm:pb-8 relative z-10 flex flex-col items-center gap-2.5 w-full max-w-xs">
        <div className="w-44 sm:w-52 h-1.5 bg-white/15 rounded-full overflow-hidden p-0.5 shadow-inner">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-indigo-400 to-emerald-400 animate-splash-bar shadow-sm" />
        </div>
        <span className="text-[11px] font-bold text-indigo-200/70 tracking-wide flex items-center gap-1.5">
          <UtensilsCrossed className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
          <span>جاري تجهيز قائمة المطاعم...</span>
        </span>
      </div>
    </div>
  );
};
