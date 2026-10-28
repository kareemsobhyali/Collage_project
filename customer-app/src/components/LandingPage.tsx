import React, { useState, useRef, useEffect } from 'react';
import {
  Store,
  Sparkles,
  Users,
  MapPin,
  Clock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ShoppingBag,
  Truck,
  Wallet,
  Printer,
  MessageCircle,
  Star,
  CheckCircle2,
  ExternalLink,
  PhoneCall
} from 'lucide-react';
import { api, getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { getDisplayAddress } from '../services/campusLocations';

interface LandingPageProps {
  branches: any[];
  onSelectBranch: (branch: any) => void;
  user?: any | null;
  onOpenAuth?: () => void;
  onOpenMyOrders?: () => void;
  onOpenProfile?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  branches = [],
  onSelectBranch,
}) => {
  const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // إعدادات قنوات التواصل الديناميكية المحملة من لوحة الإدارة
  const [contactSettings, setContactSettings] = useState({
    whatsappEnabled: true,
    whatsappPhone: '201000000000',
    whatsappMessage: 'مرحباً، أرغب في تسجيل مطعمي بالمنظومة والاستفسار عن تفاصيل الاشتراك',
    facebookEnabled: true,
    facebookUrl: 'https://facebook.com',
    phoneEnabled: true,
    phoneNumber: '+201000000000',
  });

  useEffect(() => {
    api.getPublicContactChannels()
      .then((data) => {
        if (data) setContactSettings(data);
      })
      .catch(() => {});
  }, []);

  // التأكد من استقرار الشاشة في أعلى شاشة البداية (Hero) عند فتح الصفحة أو تحديثها
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, []);

  // تحديث المطعم المختار تلقائياً إذا تغيرت القائمة
  useEffect(() => {
    if (branches.length > 0 && activeIndex >= branches.length) {
      setActiveIndex(0);
    }
  }, [branches.length, activeIndex]);

  const scrollToCard = (index: number) => {
    if (index < 0 || index >= branches.length) return;
    setActiveIndex(index);
    const targetCard = cardRefs.current[index];
    const container = scrollContainerRef.current;
    if (targetCard && container) {
      const cardRect = targetCard.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;
      const diff = cardCenter - containerCenter;
      // تمرير شريط المطاعم أفقياً فقط دون تحريك شاشة المتصفح رأسياً
      container.scrollBy({ left: diff, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    const nextIdx = Math.max(0, activeIndex - 1);
    scrollToCard(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = Math.min(branches.length - 1, activeIndex + 1);
    scrollToCard(nextIdx);
  };

  // رصد المطعم الأوسط بعد استقرار السحب لمنع أي تقطيع أثناء حركة الإصبع
  const handleScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestIdx = 0;
      let minDistance = Infinity;

      cardRefs.current.forEach((card, idx) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const dist = Math.abs(containerCenter - cardCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      setActiveIndex(closestIdx);
    }, 120);
  };

  const handleCopyBranchLink = (e: React.MouseEvent, branch: any) => {
    e.stopPropagation();
    const branchKey = branch.slug || branch.id;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/?branch=${encodeURIComponent(branchKey)}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedBranchId(branch.id);
      setTimeout(() => setCopiedBranchId(null), 2500);
    }
  };

  const scrollToRestaurants = () => {
    const el = document.getElementById('partner-restaurants-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToContact = () => {
    const el = document.getElementById('partner-contact-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-10 pb-20 w-full animate-fadeIn select-none">
      {/* Toast الإشعار بنسخ رابط المطعم */}
      {copiedBranchId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-black animate-bounce border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>تم نسخ رابط المطعم المباشر بنجاح! يمكنك مشاركته مع زبائنك 📋✨</span>
        </div>
      )}

      {/* 1. HERO SECTION: التعريف بمنظومة UniFood */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl">
        {/* Glow ambient background accents */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>المنظومة السحابية المتكاملة لطلب وتوصيل وجبات الطعام</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-snug">
            كل مطعم يمتلك واجهته ورابطه المستقل مع{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-300">
              UniFood
            </span>
          </h1>

          <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto font-medium">
            منظومة رقمية فائقة السرعة تُمكن كل مطعم من إدارة منيو مباشر، واستقبال الطلبات فوراً مع تتبع حي بالكيلومتر عبر الـ GPS، سلة طلب جماعي تشاركية، وربط تلقائي بطابعات الكاشير والمطابخ.
          </p>

          {/* Action CTAs: بدون أي أزرار تسجيل دخول في الصفحة الرئيسية */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={scrollToRestaurants}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-95 text-white text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Store className="w-4 h-4 text-indigo-200" />
              <span>شركاؤنا</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={scrollToContact}
              className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 active:scale-95 text-xs sm:text-sm font-bold backdrop-blur-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>سجّل مطعمك كشريك معنا</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center border-t border-slate-800/80">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-base sm:text-xl font-black text-amber-400 font-mono">100%</div>
              <div className="text-[11px] text-slate-300 font-bold mt-0.5">روابط مباشرة مخصصة</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-base sm:text-xl font-black text-emerald-400 font-mono">~15-25 د</div>
              <div className="text-[11px] text-slate-300 font-bold mt-0.5">متوسط سرعة التجهيز</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-base sm:text-xl font-black text-sky-400 font-mono">GPS حي</div>
              <div className="text-[11px] text-slate-300 font-bold mt-0.5">تتبع خط سير الكابتن</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-base sm:text-xl font-black text-purple-400 font-mono">كاشير حراري</div>
              <div className="text-[11px] text-slate-300 font-bold mt-0.5">طباعة فورية بالمطبخ</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SYSTEM FEATURES & ADVANTAGES: مميزات منظومة UniFood */}
      <section className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1.5">
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            الحلول التقنية المتطورة
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            مميزات فريدة مصممة لتجربة طلب وتوصيل استثنائية
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            تجمع منظومة UniFood بين مرونة الويب وسرعة تطبيقات الأندرويد واستقرار أنظمة سطح المكتب.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: Direct Branch Links */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">رابط مباشر وواجهة مخصصة لكل مطعم</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              كل مطعم يمتلك واجهة ومنيو برابط إلكتروني خاص (مثل unifood.store/r/shawarma) يمكن للعميل فتحه مباشرة ومشاركته عبر واتساب دون تشتيت.
            </p>
          </div>

          {/* Card 2: Live GPS Tracking */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-rose-300 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs group-hover:scale-105 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900 group-hover:text-rose-600 transition-colors">تتبع دقيق للطلب والكابتن بالـ GPS</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              متابعة حية لموقع كابتن التوصيل على الخريطة من لحظة استلام الوجبة بالمطعم وحتى وصولها إلى بابك، مع عد تنازلي لوقت الوصول الفعلي.
            </p>
          </div>

          {/* Card 3: Group Cart */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-purple-300 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900 group-hover:text-purple-600 transition-colors">سلة تشاركية للطلب الجماعي</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              أنشئ سلة مشتركة وشارك كود السلة مع أصدقائك أو زملائك في العمل؛ يضيف كل فرد وجبته الخاصة وتصل في فاتورة موحدة وحساب مفصل لكل شخص.
            </p>
          </div>

          {/* Card 4: Wallet & Loyalty */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900 group-hover:text-amber-600 transition-colors">محفظة رقمية واسترداد نقدي (Cashback)</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              اكسب نقاط ولاء ورصيداً نقدياً مع كل طلب ناجح، واستخدمه كخصم مباشر أو رصيد لشراء وجباتك التالية بكل سهولة وأمان.
            </p>
          </div>

          {/* Card 5: POS & Kitchen Thermal Printing */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs group-hover:scale-105 transition-transform">
              <Printer className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors">ربط فوري بطابعات المطبخ والكاشير</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              نظام سطح المكتب المخصص للمطاعم يتصل تلقائياً بطابعات الفواتير الحرارية ESC/POS لطباعة بونات التجهيز في المطبخ فور اعتماد الطلب.
            </p>
          </div>

          {/* Card 6: WhatsApp Notifications & OTP */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-teal-300 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 group">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-2xs group-hover:scale-105 transition-transform">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900 group-hover:text-teal-600 transition-colors">إشعارات وتأكيدات فورية عبر الواتساب</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              تفعيل تلقائي للحسابات عبر روابط سريعة (Magic Link) وإرسال بونات الفاتورة ورابط تتبع الكابتن المباشر إلى رقم واتساب العميل.
            </p>
          </div>
        </div>
      </section>

      {/* 3. PARTNER RESTAURANTS SECTION: عرض تفاعلي ثلاثي الأبعاد مع إبراز المطعم الأوسط وضبابية خفيفة للجانبين */}
      <section id="partner-restaurants-section" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                شركاؤنا في المنظومة
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold whitespace-nowrap">
                {branches.length} {branches.length === 1 ? 'مطعم' : branches.length === 2 ? 'مطعمين' : branches.length <= 10 ? 'مطاعم' : 'مطعم'}
              </span>
            </div>

            {/* Previous / Next buttons on mobile (compact) */}
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 sm:hidden shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={activeIndex === 0}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all shadow-2xs active:scale-95 ${
                    activeIndex === 0
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-600 cursor-pointer'
                  }`}
                  title="المطعم السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={activeIndex === branches.length - 1}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all shadow-2xs active:scale-95 ${
                    activeIndex === branches.length - 1
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-600 cursor-pointer'
                  }`}
                  title="المطعم التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Desktop/Tablet text & buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <p className="text-xs text-slate-500 font-medium">
              اسحب للتنقل بين شركائنا واضغط على أي مطعم لفتح واجهته ومنيوه الخاص فوراً
            </p>
            {branches.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={activeIndex === 0}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-2xs active:scale-95 ${
                    activeIndex === 0
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-600 cursor-pointer'
                  }`}
                  title="المطعم السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={activeIndex === branches.length - 1}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-2xs active:scale-95 ${
                    activeIndex === branches.length - 1
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-700 hover:text-indigo-600 cursor-pointer'
                  }`}
                  title="المطعم التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Subtitle on mobile */}
          <p className="sm:hidden text-[11px] text-slate-500 font-medium -mt-1">
            اسحب يميناً ويساراً للتنقل بين المطاعم واضغط للدخول
          </p>
        </div>

        {/* CoverFlow / 3D Slider: المطعم المعروض بارز في المنتصف بمحاذاة تامة وثبات كامل */}
        {branches.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
            <Store className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-700">لا توجد مطاعم مسجلة حالياً</p>
            <p className="text-xs text-slate-500">سيتم إضافة مطاعم جديدة في المنظومة قريباً.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex items-center gap-3 sm:gap-6 overflow-x-auto py-6 scroll-smooth snap-x snap-mandatory no-scrollbar"
              style={{
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                paddingLeft: 'max(20px, calc(50vw - 155px))',
                paddingRight: 'max(20px, calc(50vw - 155px))',
              }}
            >
              {branches.map((branch, idx) => {
                const isActive = idx === activeIndex;
                const isOpen =
                  branch.isActive !== false &&
                  branch.operationalStatus !== 'CLOSED' &&
                  isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours);

                const branchReviews: any[] = Array.isArray(branch.reviews) ? branch.reviews : [];
                const rating =
                  branch.avgRating ||
                  (branchReviews.length > 0
                    ? Number((branchReviews.reduce((acc: number, r: any) => acc + (r.rating || 5), 0) / branchReviews.length).toFixed(1))
                    : 5.0);

                return (
                  <div
                    key={branch.id}
                    ref={(el) => {
                      cardRefs.current[idx] = el;
                    }}
                    onClick={() => {
                      if (isActive) {
                        onSelectBranch(branch);
                      } else {
                        scrollToCard(idx);
                      }
                    }}
                    className="w-[82vw] max-w-[310px] sm:w-[320px] shrink-0 snap-center py-3 flex items-center justify-center cursor-pointer select-none"
                    style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always' }}
                  >
                    {/* الكارد الداخلي: التأثير البصري والتكبير والضبابية مطبق هنا للحفاظ على ثبات محاذاة الاسكرول */}
                    <div
                      className={`w-full rounded-3xl transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden relative ${
                        isActive
                          ? 'scale-100 z-30 opacity-100 filter-none shadow-2xl shadow-indigo-600/25 border-2 border-indigo-500 ring-4 ring-indigo-500/15 bg-white'
                          : 'scale-95 z-10 opacity-75 hover:opacity-100 filter blur-[0.6px] hover:blur-0 shadow-md border border-slate-200/90 bg-white/95'
                      }`}
                    >
                      {/* Top Banner with Badges */}
                      <div>
                        <div className="h-24 sm:h-28 relative bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 flex items-start justify-between p-3 overflow-hidden">
                          {/* Ambient background glow */}
                          <div className="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />
                          <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-amber-500/15 rounded-full blur-xl pointer-events-none" />

                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black backdrop-blur-md shadow-xs z-10 ${
                              isOpen
                                ? 'bg-emerald-500/90 text-white'
                                : 'bg-slate-900/80 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOpen ? 'bg-white animate-pulse' : 'bg-rose-400'
                              }`}
                            />
                            <span>{isOpen ? 'مفتوح للطلب' : 'مغلق حالياً'}</span>
                          </span>

                          {/* Rating Badge */}
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-800 text-xs font-black shadow-xs z-10">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span className="font-mono">{rating}</span>
                          </div>
                        </div>

                        {/* Logo & Info */}
                        <div className="px-4 -mt-7 relative z-10">
                          {branch.logoUrl ? (
                            <img
                              src={getFullImageUrl(branch.logoUrl)}
                              alt={branch.name}
                              className={`w-14 h-14 rounded-2xl object-cover bg-white border-2 shadow-md p-0.5 shrink-0 transition-all ${
                                isActive ? 'border-indigo-500 scale-105 ring-4 ring-indigo-500/20 shadow-indigo-500/10' : 'border-white'
                              }`}
                            />
                          ) : (
                            <div className={`w-14 h-14 rounded-2xl bg-indigo-50 border-2 shadow-md flex items-center justify-center text-indigo-600 font-bold shrink-0 transition-all ${
                              isActive ? 'border-indigo-500 scale-105 ring-4 ring-indigo-500/20 shadow-indigo-500/10' : 'border-white'
                            }`}>
                              <Store className="w-7 h-7" />
                            </div>
                          )}

                          <div className="mt-2.5">
                            <div className="flex items-center gap-1.5">
                              <h3 className={`font-black text-base truncate transition-colors ${
                                isActive ? 'text-indigo-600' : 'text-slate-900'
                              }`}>
                                {branch.name}
                              </h3>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black shrink-0 border border-indigo-100">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                  <span>محدد</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="truncate">{getDisplayAddress(branch.address, 'موقع المطعم')}</span>
                            </div>
                          </div>

                          {/* Info Chips (Prep Time & Delivery) */}
                          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-100 truncate">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">
                                {branch.estimatedPrepMins ? `~${branch.estimatedPrepMins} د` : '~15-25 د'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-100 truncate">
                              <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">
                                {branch.allowDelivery
                                  ? (typeof branch.deliveryFee === 'number' && branch.deliveryFee > 0
                                      ? `${branch.deliveryFee} ج.م`
                                      : 'توصيل متاح')
                                  : 'استلام فقط'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 pt-3 flex items-center gap-2 border-t border-slate-100 mt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBranch(branch);
                          }}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/20 active:scale-95'
                              : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>دخول للمنيو</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleCopyBranchLink(e, branch)}
                          title="نسخ الرابط المباشر لهذا المطعم"
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-90 transition-all border border-slate-200/80 shrink-0 cursor-pointer"
                        >
                          {copiedBranchId === branch.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Carousel Bottom Dots */}
            {branches.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {branches.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => scrollToCard(dotIdx)}
                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                      dotIdx === activeIndex
                        ? 'w-7 h-2 bg-indigo-600 shadow-xs'
                        : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    title={`المطعم ${dotIdx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. HOW IT WORKS: كيف يعمل النظام في 3 خطوات */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            بساطة وسرعة
          </span>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            كيف تطلب وجبتك في 3 خطوات بسيطة؟
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-sm">
              1
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">افتح رابط مطعمك المفضل</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              ادخل عبر رابط المطعم المباشر أو تصفح قائمة المطاعم الشريكة لتجد المنيو والأسعار محدثة لحظياً.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-sm">
              2
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">حدد وجباتك وخصص إضافاتك</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              اختر الأحجام والإضافات الخاصة بوجبتك، أو شارك السلة مع أصدقائك في طلب جماعي موحد.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-sm">
              3
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">تتبع الكابتن واستلم وجبتك</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              تابع خط سير كابتن التوصيل على الخريطة مباشرة عبر الـ GPS واستلم وجبتك طازجة وساخنة.
            </p>
          </div>
        </div>
      </section>

      {/* 5. PARTNER REGISTRATION & CONTACT SECTION: سجّل مطعمك معنا (تتحكم بها لوحة الإدارة) */}
      <section
        id="partner-contact-section"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8"
      >
        {/* Glow ambient background accents */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-xs font-black text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>انضم كشريك لمنظومة UniFood</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-snug">
            هل تمتلك مطعماً أو براند طعام؟{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-300">
              سجّل معنا اليوم!
            </span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            امتلك واجهة إلكترونية ومنيو برابط مخصص لمطعمك، واستقبل طلبات زبائنك أونلاين مع إدارة الكاشير والربط التلقائي بطابعات المطبخ وتتبع الكباتن بالـ GPS بدون أي تعقيد.
          </p>
        </div>

        {/* 3 Value Highlights */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-1 backdrop-blur-xs">
            <div className="text-emerald-400 font-black text-sm">⚡ تشغيل فوري خلال 24 ساعة</div>
            <p className="text-[11px] text-slate-400">إدخال المنيو والأسعار وتفعيل رابط مطعمك فورياً.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-1 backdrop-blur-xs">
            <div className="text-sky-400 font-black text-sm">🖨️ ربط بطابعات المطبخ والكاشير</div>
            <p className="text-[11px] text-slate-400">طباعة بونات الطلبات تلقائياً فور وصولها دون تأخير.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-1 backdrop-blur-xs">
            <div className="text-amber-400 font-black text-sm">🛵 إدارة وتتبع الكباتن بالـ GPS</div>
            <p className="text-[11px] text-slate-400">تطبيق مخصص لكباتن التوصيل وتتبع لحظي على الخريطة.</p>
          </div>
        </div>

        {/* Contact Channels Grid (تتحكم بها لوحة تحكم الإدارة ديناميكياً) */}
        {(contactSettings.whatsappEnabled || contactSettings.facebookEnabled || contactSettings.phoneEnabled) ? (
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* 1. WHATSAPP CONTACT CARD */}
            {contactSettings.whatsappEnabled && (
              <a
                href={`https://wa.me/${contactSettings.whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent(contactSettings.whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gradient-to-b from-emerald-950/60 to-slate-900/90 hover:from-emerald-900/80 hover:to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-3xl p-5 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-1 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-inner">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                    تواصل مباشر عبر واتساب
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    تحدث مع فريق مبيعات وتسجيل المطاعم مباشرة واستفسر عن تفاصيل الاشتراك والتفعيل.
                  </p>
                </div>
                <div className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm">
                  <span>محادثة واتساب سريعة</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>
            )}

            {/* 2. FACEBOOK PAGE CARD */}
            {contactSettings.facebookEnabled && (
              <a
                href={contactSettings.facebookUrl.startsWith('http') ? contactSettings.facebookUrl : `https://${contactSettings.facebookUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-gradient-to-b from-blue-950/60 to-slate-900/90 hover:from-blue-900/80 hover:to-slate-900 border border-blue-500/30 hover:border-blue-400 rounded-3xl p-5 transition-all duration-300 shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-inner">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-blue-300 transition-colors">
                    صفحتنا على فيسبوك
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    تابع أحدث المطاعم المنضمة وتحديثات المنظومة وتواصل معنا مباشرة عبر الماسنجر.
                  </p>
                </div>
                <div className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm">
                  <span>زيارة صفحة فيسبوك</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>
            )}

            {/* 3. DIRECT PHONE / CALL CARD */}
            {contactSettings.phoneEnabled && (
              <a
                href={`tel:${contactSettings.phoneNumber}`}
                className="group bg-gradient-to-b from-indigo-950/60 to-slate-900/90 hover:from-indigo-900/80 hover:to-slate-900 border border-indigo-500/30 hover:border-indigo-400 rounded-3xl p-5 transition-all duration-300 shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-1 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-400/40 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-inner">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-white group-hover:text-indigo-300 transition-colors">
                    اتصال هاتفي مباشر
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    تواصل صوتياً مع إدارة العمليات لترتيب موعد لتهيئة المنظومة وربط مطعمك فوراً.
                  </p>
                </div>
                <div className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm">
                  <span>اتصل بنا الآن</span>
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
              </a>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            يمكنك تفعيل قنوات التواصل وتعديل أرقامها من خلال لوحة تحكم الإدارة (SuperAdmin).
          </div>
        )}
      </section>

      {/* 6. FOOTER: الحقوق والتواصل */}
      <footer className="text-center pt-6 border-t border-slate-200/80 space-y-2">
        <p className="text-xs font-bold text-slate-600">
          منظومة UniFood لخدمات الطعام والتوصيل الذكي © 2026 — جميع الحقوق محفوظة
        </p>
        <p className="text-[11px] text-slate-400 font-medium">
          تم تصميم المنظومة بأحدث المعايير البرمجية لتوفير أعلى مستويات السرعة والموثوقية.
        </p>
      </footer>
    </div>
  );
};
