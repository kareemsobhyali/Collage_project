import React, { useEffect, useState } from 'react';
import { Sparkles, GraduationCap, Utensils, Coffee, Truck } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  isReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, isReady = true }) => {
  const [fadingOut, setFadingOut] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // عرض الأنيميشن لمدّة 1.3 ثانية لضمان ظهور المؤثرات بسلاسة وسرعة فائقة
    const timer = setTimeout(() => {
      if (isReady) {
        setFadingOut(true);
        setTimeout(() => {
          setVisible(false);
          onFinish?.();
        }, 500);
      }
    }, 1300);

    return () => clearTimeout(timer);
  }, [isReady, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 sm:p-8 bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white select-none overflow-hidden transition-all duration-500 ease-out ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      dir="rtl"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 -right-16 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -left-16 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Top Tag */}
      <div className="pt-6 sm:pt-8 relative z-10 flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[11px] font-bold text-indigo-200">
        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
        <span>تطبيق التوصيل الذكي للطلاب • UniFood</span>
      </div>

      {/* Center Branding Area with Floating Campus Food Chips */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto">
        {/* Floating Campus Bites */}
        <div className="absolute -top-12 -right-14 animate-float-1 hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs font-bold text-amber-300 shadow-lg">
          <span>🍔</span>
          <span>وجبات سريعة</span>
        </div>

        <div className="absolute -top-10 -left-16 animate-float-2 hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs font-bold text-indigo-200 shadow-lg">
          <span>🍕</span>
          <span>بيتزا الحرم</span>
        </div>

        <div className="absolute -bottom-8 -right-16 animate-float-2 hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs font-bold text-emerald-300 shadow-lg">
          <span>☕</span>
          <span>كافيهات وقهوة</span>
        </div>

        <div className="absolute -bottom-6 -left-18 animate-float-1 hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs font-bold text-purple-200 shadow-lg">
          <span>🎓</span>
          <span>توصيل للمباني</span>
        </div>

        {/* Outer Glowing Halo Ring */}
        <div className="relative mb-5">
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-amber-400 via-indigo-500 to-purple-500 opacity-60 blur-md animate-pulse-glow" />

          {/* Logo Tile */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white p-2 shadow-2xl border-2 border-white/40 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt="UniFood Logo"
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
            <span className="text-white">Uni</span>
            <span className="text-amber-400">Food</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 font-bold">
            يونيفود • مطاعم الحرم الجامعي
          </p>
        </div>

        {/* Motivational Slogan Pill */}
        <div className="mt-4 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-xs font-black text-amber-300 flex items-center gap-2 shadow-sm">
          <span>وجبتك المفضلة لباب قاعتك الجامعية</span>
          <span className="text-sm">🚀</span>
        </div>
      </div>

      {/* Bottom Loading Indicator */}
      <div className="pb-6 sm:pb-8 relative z-10 flex flex-col items-center gap-2.5 w-full max-w-xs">
        {/* Animated Progress Bar */}
        <div className="w-40 sm:w-48 h-1.5 bg-white/15 rounded-full overflow-hidden p-0.5">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-indigo-400 to-emerald-400 animate-splash-bar shadow-sm" />
        </div>
        <span className="text-[11px] font-bold text-indigo-300/80 tracking-wide">
          جاري فتح المنصة...
        </span>
      </div>
    </div>
  );
};
