import React, { useEffect, useRef, useState, useMemo } from 'react';
import { getFullImageUrl } from '../services/api';
import { Sparkles, UtensilsCrossed, CheckCircle2, Store } from 'lucide-react';

interface SplashScreenProps {
  branches?: any[];
  onFinish?: () => void;
  isReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  branches = [], 
  onFinish, 
  isReady = true 
}) => {
  const [fadingOut, setFadingOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const [loadingStage, setLoadingStage] = useState<0 | 1 | 2>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dynamic progress text progression
  useEffect(() => {
    const stage1Timer = setTimeout(() => setLoadingStage(1), 850);
    const stage2Timer = setTimeout(() => setLoadingStage(2), 1750);
    return () => {
      clearTimeout(stage1Timer);
      clearTimeout(stage2Timer);
    };
  }, []);

  // Duration timing: 2.3 seconds of smooth orbit & cosmic animation, then smooth fade
  useEffect(() => {
    const minTimer = setTimeout(() => {
      setFadingOut(true);
      const finishTimer = setTimeout(() => {
        setVisible(false);
        onFinish?.();
      }, 650);
      return () => clearTimeout(finishTimer);
    }, 2300);

    return () => clearTimeout(minTimer);
  }, [onFinish]);

  // 1. Food Rain & Star Dust Cosmic Feast Animation (Canvas-based 60fps)
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
    const particleCount = width < 640 ? 16 : 24;

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

    interface StarParticle {
      x: number;
      y: number;
      size: number;
      opacity: number;
      pulseSpeed: number;
      pulse: number;
    }

    const particles: FoodParticle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      speed: 1.1 + Math.random() * 1.9,
      size: 16 + Math.random() * 11,
      emoji: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.015 + Math.random() * 0.025,
      opacity: 0.25 + Math.random() * 0.4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
    }));

    const stars: StarParticle[] = Array.from({ length: 32 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.6,
      pulseSpeed: 0.02 + Math.random() * 0.035,
      pulse: Math.random() * Math.PI,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render ambient twinkling star dust
      stars.forEach((s) => {
        s.pulse += s.pulseSpeed;
        const currentOpacity = s.opacity * (0.55 + 0.45 * Math.sin(s.pulse));
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render floating appetizing food emojis
      particles.forEach((p) => {
        p.y += p.speed;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotSpeed;

        const currentX = p.x + Math.sin(p.wobble) * 14;

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

  // Filter only real active branches - NO DUMMY/FAKE DATA!
  const realBranches = useMemo(() => {
    if (!Array.isArray(branches)) return [];
    return branches.filter((b) => b && b.name && String(b.name).trim().length > 0).slice(0, 6);
  }, [branches]);

  if (!visible) return null;

  const hasRealBranches = realBranches.length > 0;

  // Calibrated orbit radius for phones and larger screens
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const orbitRadius = isMobile ? 126 : 148;
  const orbitContainerSize = orbitRadius * 2 + (isMobile ? 80 : 96);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 sm:p-8 bg-[#070B14] text-white select-none overflow-hidden transition-all duration-700 ease-out ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      dir="rtl"
    >
      {/* 1. Canvas Layer: Cosmic Feasting Particles & Falling Food Rain */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-88 h-88 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Welcome Pill */}
      <div className="pt-4 sm:pt-6 relative z-10 flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/15 text-xs font-bold text-indigo-100 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        <span>مطاعم الحرم الجامعي متجمعة لك • UniFood</span>
      </div>

      {/* 2. Centerpiece: Orbiting Restaurant Logos Carousel */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto">
        {/* Orbit container */}
        <div 
          className="relative flex items-center justify-center"
          style={{ width: `${orbitContainerSize}px`, height: `${orbitContainerSize}px` }}
        >
          {/* Outer Orbit Track Line (Subtle dashed border) */}
          <div 
            className="absolute rounded-full border border-indigo-400/25 border-dashed pointer-events-none"
            style={{ width: `${orbitRadius * 2}px`, height: `${orbitRadius * 2}px` }}
          />

          {/* Inner Decorative Halo Ring */}
          <div 
            className="absolute rounded-full border border-amber-400/15 pointer-events-none"
            style={{ width: `${orbitRadius * 2 - 36}px`, height: `${orbitRadius * 2 - 36}px` }}
          />

          {/* Center UniFood Logo Anchor with Dual Radar Pulse & Breathing Glow */}
          <div className="relative z-20 flex items-center justify-center">
            {/* Concentric Pulsing Radar Aura */}
            <div className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-amber-400/35 bg-amber-400/5 animate-radar-scan-pulse pointer-events-none" />
            <div className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border border-indigo-400/20 bg-indigo-500/5 animate-radar-scan-pulse [animation-delay:1.4s] pointer-events-none" />

            {/* Central UniFood Glassmorphic Card */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white p-2 shadow-2xl border-2 border-indigo-400/30 flex items-center justify-center overflow-hidden animate-hub-breathing">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/20 via-transparent to-indigo-600/20 rounded-2xl pointer-events-none" />
              <img
                src="/logo.png"
                alt="UniFood Logo"
                className="w-full h-full object-cover rounded-2xl shadow-inner"
              />
            </div>
          </div>

          {/* Case A: Real Branches Loaded -> Orbiting Satellite Badges */}
          {hasRealBranches ? (
            <div className="absolute inset-0 animate-spin-orbit">
              {realBranches.map((item, idx) => {
                const total = realBranches.length;
                const angleDeg = idx * (360 / total);
                const angleRad = (angleDeg * Math.PI) / 180;
                const x = Math.cos(angleRad) * orbitRadius;
                const y = Math.sin(angleRad) * orbitRadius;

                return (
                  <div
                    key={item.id || idx}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    }}
                  >
                    {/* Counter-rotating badge so logo and full restaurant name stay upright! */}
                    <div 
                      className="animate-counter-spin flex flex-col items-center animate-satellite-bloom group cursor-pointer"
                      style={{ animationDelay: `${idx * 110}ms` }}
                    >
                      {/* Glassmorphic Logo Card */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] border border-white/60 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:border-amber-400">
                        {item.logoUrl ? (
                          <img
                            src={getFullImageUrl(item.logoUrl)}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-xl"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<span class="text-xl">🍽️</span>';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-amber-500 text-white flex items-center justify-center font-black text-base shadow-inner">
                            {item.name ? item.name.charAt(0) : <Store className="w-5 h-5 text-white" />}
                          </div>
                        )}
                      </div>

                      {/* FULL Restaurant Name Badge (No truncation!) */}
                      <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/20 text-white font-black text-[10px] sm:text-[11px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] whitespace-nowrap flex items-center gap-1.5 tracking-tight transition-transform group-hover:scale-105">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span>{item.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Case B: Branches Not Loaded Yet -> Sleek Radar Beacon Lights (Zero fake data!) */
            <div className="absolute inset-0 animate-spin-orbit">
              {[0, 90, 180, 270].map((deg, i) => {
                const rad = (deg * Math.PI) / 180;
                const x = Math.cos(rad) * orbitRadius;
                const y = Math.sin(rad) * orbitRadius;
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2"
                    style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  >
                    <div className="w-4 h-4 rounded-full bg-amber-400/30 border border-amber-300/80 flex items-center justify-center animate-ping">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Brand Typography */}
        <div className="mt-5 space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
            <span className="text-white">Uni</span>
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">Food</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/90 font-bold">
            كل مطاعم الحرم الجامعي في سلة واحدة 🎓🍔
          </p>
        </div>
      </div>

      {/* 3. Bottom Progress Bar & Dynamic Indicator */}
      <div className="pb-4 sm:pb-6 relative z-10 flex flex-col items-center gap-2.5 w-full max-w-xs">
        {/* Glowing Progress Bar */}
        <div className="w-48 sm:w-56 h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5 backdrop-blur-md shadow-inner border border-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-indigo-400 to-emerald-400 animate-splash-bar shadow-[0_0_14px_rgba(245,158,11,0.6)]" />
        </div>

        {/* Dynamic Status Text */}
        <div className="text-[11px] sm:text-xs font-bold text-indigo-100/90 tracking-wide flex items-center gap-1.5 min-h-[22px] transition-all duration-300">
          {loadingStage === 0 && (
            <>
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span>جاري تجهيز قائمة المطاعم...</span>
            </>
          )}
          {loadingStage === 1 && (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
              <span>تحميل العروض وقوائم الطعام...</span>
            </>
          )}
          {loadingStage === 2 && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
              <span className="text-emerald-300 font-extrabold">مرحباً بك في UniFood ✨</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
