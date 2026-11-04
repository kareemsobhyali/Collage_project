import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Sparkles, Check, Copy, Gift, ArrowLeft, Trophy } from 'lucide-react';
import { api } from '../services/api';

interface SpinTheWheelModalProps {
  order: any;
  onClose: () => void;
  onRewardClaimed?: (prize: any, updatedUser: any) => void;
}

interface WheelSegment {
  id: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  textColor: string;
}

const DEFAULT_SEGMENTS: WheelSegment[] = [
  { id: 'POINTS_10', label: '10 نقاط', sub: 'في محفظتك', icon: '🎁', color: '#6366f1', textColor: '#ffffff' }, // Indigo
  { id: 'DISCOUNT_10', label: 'خصم 10%', sub: 'على طلبك', icon: '🏷️', color: '#f59e0b', textColor: '#ffffff' }, // Amber
  { id: 'POINTS_5', label: '5 نقاط', sub: 'في محفظتك', icon: '🌟', color: '#ec4899', textColor: '#ffffff' }, // Pink
  { id: 'DISCOUNT_15', label: 'خصم 15%', sub: 'على طلبك', icon: '🔥', color: '#10b981', textColor: '#ffffff' }, // Emerald
  { id: 'POINTS_20', label: '20 نقطة', sub: 'في محفظتك', icon: '💎', color: '#8b5cf6', textColor: '#ffffff' }, // Purple
  { id: 'FREE_DELIVERY', label: 'توصيل مجاني', sub: 'للطلب القادم', icon: '🚚', color: '#06b6d4', textColor: '#ffffff' }, // Cyan
];

export const SpinTheWheelModal: React.FC<SpinTheWheelModalProps> = ({
  order,
  onClose,
  onRewardClaimed,
}) => {
  const segments = useMemo<WheelSegment[]>(() => {
    if (order.branch?.spinWheelPrizes) {
      try {
        const parsed = JSON.parse(order.branch.spinWheelPrizes);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const colors = ['#6366f1', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#84cc16'];
          return parsed.map((p: any, idx: number) => ({
            id: p.id || `prize_${idx}`,
            label: p.label || 'جائزة',
            sub: p.type === 'POINTS' ? `${p.value || p.amount || ''} نقطة` : (p.type === 'FREE_ITEM' ? 'هدية مجانية' : (p.type === 'BETTER_LUCK' ? 'حظ أوفر' : (p.type === 'COUPON' ? (p.discountType === 'FIXED' ? `${p.value} ج.م` : `${p.value || p.percent || ''}%`) : ''))),
            icon: p.icon || (p.type === 'POINTS' ? '🌟' : (p.type === 'FREE_ITEM' ? '🍔' : (p.type === 'BETTER_LUCK' ? '🍀' : '🎁'))),
            color: p.color || colors[idx % colors.length],
            textColor: '#ffffff',
          }));
        }
      } catch (_e) {}
    }
    return DEFAULT_SEGMENTS;
  }, [order.branch?.spinWheelPrizes]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [wonPrize, setWonPrize] = useState<any | null>(() => {
    if (order.wheelReward) {
      try {
        return typeof order.wheelReward === 'string' ? JSON.parse(order.wheelReward) : order.wheelReward;
      } catch (_e) {
        return null;
      }
    }
    return null;
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // تشغيل تأثير الكونفيتي عند الفوز
  useEffect(() => {
    if (!wonPrize) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: {
      x: number;
      y: number;
      r: number;
      d: number;
      color: string;
      tilt: number;
      tiltAngleIncremental: number;
      tiltAngle: number;
    }[] = [];

    const colors = ['#f59e0b', '#ec4899', '#6366f1', '#10b981', '#3b82f6', '#fbbf24'];
    for (let i = 0; i < 75; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 45 + 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngleIncremental: Math.random() * 0.07 + 0.05,
        tiltAngle: 0,
      });
    }

    let start = Date.now();
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();

        if (p.y > canvas.height) {
          p.x = Math.random() * canvas.width;
          p.y = -20;
        }
      }

      if (Date.now() - start < 6000) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [wonPrize]);

  const handleSpin = async () => {
    if (isSpinning || wonPrize) return;
    setErrorMessage(null);
    setIsSpinning(true);

    try {
      const res = await api.spinWheel(order.id);
      const prize = res.prize;

      // العثور على شريحة العجلة المطابقة للجائزة
      const targetIndex = segments.findIndex((s) => s.id === prize.id);
      const safeIndex = targetIndex >= 0 ? targetIndex : 0;

      // حساب زاوية التوقف الدقيقة عند المؤشر العلوي (12 o'clock)
      // كل شريحة تمثل 360 / segments.length درجة
      const segmentAngle = 360 / segments.length;
      // الزاوية المركزية للشريحة المطلوبة
      const targetCenterAngle = safeIndex * segmentAngle + segmentAngle / 2;
      // لكي تقع هذه الشريحة عند أعلى نقطة (المؤشر عند 270 درجة أو 0 مع دوران عكسي):
      const extraSpins = 360 * 6; // 6 لفات كاملة للمتعة
      const finalAngle = extraSpins + (360 - targetCenterAngle);

      setRotationDegrees(finalAngle);

      // انتهاء الدوران بعد 4.4 ثواني
      setTimeout(() => {
        setIsSpinning(false);
        setWonPrize(prize);
        if (onRewardClaimed) {
          onRewardClaimed(prize, res.user);
        }
      }, 4500);
    } catch (err: any) {
      setIsSpinning(false);
      setErrorMessage(err.message || 'تعذر تدوير العجلة حالياً');
    }
  };

  const numSegments = segments.length;
  const anglePerSegment = 360 / numSegments;
  const radius = 130;
  const center = 150;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fadeIn">
      {/* Canvas للكونفيتي المتطاير */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="pointer-events-none fixed inset-0 z-60"
      />

      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative text-white flex flex-col items-center p-5 text-center">
        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* الهيدر الاحتفالي */}
        <div className="mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>عجلة الحظ الذهبية 🎡</span>
          </div>
          <h3 className="text-lg font-black text-white">
            {wonPrize ? 'مبروك جائزتك الرائعة! 🎉' : 'لف العجلة واكسب جائزتك! 🎁'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {wonPrize
              ? (order.status === 'REJECTED' || wonPrize.status === 'CANCELLED')
                ? 'تم إلغاء المكافأة لعدم اكتمال الطلب'
                : (order.status === 'COMPLETED' || wonPrize.isPendingDelivery === false || wonPrize.status === 'AWARDED')
                ? 'تم تفعيل المكافأة وإيداعها بحسابك بنجاح 🎉'
                : 'تم حفظ جائزتك، وسيتم تفعيلها بحسابك فور اكتمال الطلب 🚚'
              : `شكراً لطلبك من مطعم ${order.branch?.name || ''}، ليك لفة حظ مجانية!`}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* عجلة الحظ الدائرية SVG */}
        <div className="relative my-4 select-none">
          {/* مؤشر السهم العلوي */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1.5 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]" />

          {/* الإطار الخارجي المضيء */}
          <div className="w-[280px] h-[280px] rounded-full p-2.5 bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.35)] relative flex items-center justify-center">
            {/* الدائرة الدوارة */}
            <div
              className="w-full h-full rounded-full overflow-hidden relative shadow-inner"
              style={{
                transform: `rotate(${rotationDegrees}deg)`,
                transition: isSpinning ? 'transform 4.5s cubic-bezier(0.12, 0.88, 0.2, 1)' : 'none',
              }}
            >
              <svg viewBox="0 0 300 300" className="w-full h-full">
                {segments.map((seg, idx) => {
                  const startAngle = idx * anglePerSegment;
                  const endAngle = startAngle + anglePerSegment;
                  const x1 = center + radius * Math.cos((Math.PI * (startAngle - 90)) / 180);
                  const y1 = center + radius * Math.sin((Math.PI * (startAngle - 90)) / 180);
                  const x2 = center + radius * Math.cos((Math.PI * (endAngle - 90)) / 180);
                  const y2 = center + radius * Math.sin((Math.PI * (endAngle - 90)) / 180);

                  const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
                  const textAngle = startAngle + anglePerSegment / 2;

                  return (
                    <g key={seg.id}>
                      <path d={pathData} fill={seg.color} stroke="#1e293b" strokeWidth="2" />
                      <g transform={`rotate(${textAngle}, ${center}, ${center})`}>
                        <text
                          x={center}
                          y={center - 70}
                          fill={seg.textColor}
                          fontSize="13"
                          fontWeight="900"
                          textAnchor="middle"
                          transform={`rotate(90, ${center}, ${center - 70})`}
                        >
                          {seg.icon} {seg.label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* الزر الدائري المركزي */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <button
                type="button"
                disabled={isSpinning || Boolean(wonPrize)}
                onClick={handleSpin}
                className={`w-16 h-16 rounded-full font-black text-xs shadow-xl flex flex-col items-center justify-center transition-transform active:scale-95 border-3 border-amber-300 ${
                  isSpinning || wonPrize
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-90'
                    : 'bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 cursor-pointer animate-pulse hover:scale-105'
                }`}
              >
                <span className="text-base leading-none">🎡</span>
                <span className="text-[10px] font-black leading-tight mt-0.5">
                  {isSpinning ? 'يلف...' : wonPrize ? 'تم الفوز' : 'لِف الآن!'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* كارت النتيجة عند الفوز */}
        {wonPrize && (
          <div className="w-full mt-2 p-3.5 rounded-2xl bg-slate-800/90 border border-amber-500/40 text-right space-y-2.5 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
                {wonPrize.icon || '🎁'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs text-amber-300 font-bold block">الجائزة التي حصلت عليها:</span>
                <span className="text-sm font-black text-white block truncate">{wonPrize.label}</span>
              </div>
            </div>

            {/* Status notice */}
            {order.status === 'REJECTED' || wonPrize.status === 'CANCELLED' ? (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
                ❌ تم إلغاء هذه المكافأة نظراً لإلغاء هذا الطلب قبل استلامه.
              </div>
            ) : (order.status !== 'COMPLETED' && wonPrize.isPendingDelivery !== false && wonPrize.status !== 'AWARDED') ? (
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                <span className="text-base shrink-0 animate-pulse">⏳</span>
                <span>
                  تم تسجيل جائزتك بنجاح! سيتم إيداعها وتفعيلها في حسابك تلقائياً فور استلام واكتمال الطلب بنجاح.
                </span>
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
                <span>✓ تم تفعيل الجائزة بنجاح في حسابك!</span>
              </div>
            )}

            {wonPrize.type === 'POINTS' && (
              <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                ✨ قيمة الجائزة: <strong className="text-amber-400 font-black">{wonPrize.value || wonPrize.amount || 10} نقطة ولاء</strong>، يمكنك تحويلها لرصيد نقدي في طلباتك القادمة بعد اكتمال الطلب!
              </p>
            )}

            {wonPrize.type === 'FREE_ITEM' && wonPrize.couponCode && (
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-amber-500/30">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                  <span>🍔</span>
                  <span>وجبتك / هديتك المجانية لطلبك القادم:</span>
                </div>
                <div className="text-xs font-black text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  {wonPrize.value || wonPrize.label}
                </div>
                <span className="text-[10px] text-slate-400 block font-bold mt-1">كود استلام الهدية الخاص بك:</span>
                <div className="flex items-center justify-between gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="font-mono text-sm font-black text-amber-400 tracking-wider">
                    {wonPrize.couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(wonPrize.couponCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="نسخ الكود"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  * استخدم الكود في خانة الكوبون بطلبك القادم للحصول على هديتك مجاناً.
                </span>
              </div>
            )}

            {(wonPrize.type === 'COUPON' || wonPrize.type === 'FREE_DELIVERY') && wonPrize.couponCode && (
              <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-bold">كود خصمك المخصص لطلبك القادم:</span>
                <div className="flex items-center justify-between gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="font-mono text-sm font-black text-amber-400 tracking-wider">
                    {wonPrize.couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(wonPrize.couponCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="نسخ الكود"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  * صالح للاستخدام لمرة واحدة ومربوط بحسابك فقط.
                </span>
              </div>
            )}

            {wonPrize.type === 'BETTER_LUCK' && (
              <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                🍀 حظ أوفر في المرات القادمة! نتمنى لك يوماً سعيداً ووجبة شهية وممتعة دائماً مع يوني فود.
              </p>
            )}
          </div>
        )}

        {/* الأزرار السفلية */}
        <div className="w-full mt-4 flex items-center gap-2">
          {wonPrize ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>متابعة حالة طلبي 🚀</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSpinning}
              onClick={handleSpin}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSpinning ? 'جاري تدوير العجلة...' : 'تدوير العجلة الآن 🎡'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
