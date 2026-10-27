import React, { useState, useRef } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { getDisplayAddress } from '../services/campusLocations';

interface LandingPageProps {
  branches: any[];
  onSelectBranch: (branch: any) => void;
  user?: any | null;
  onOpenAuth: () => void;
  onOpenMyOrders: () => void;
  onOpenProfile: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  branches = [],
  onSelectBranch,
  user,
  onOpenAuth,
  onOpenMyOrders,
  onOpenProfile,
}) => {
  const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollHorizontally = (direction: 'next' | 'prev') => {
    if (!scrollContainerRef.current) return;
    const amount = 340;
    // In RTL, next moves left (-amount), prev moves right (+amount)
    const scrollAmount = direction === 'next' ? -amount : amount;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black text-amber-300">
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

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={scrollToRestaurants}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-95 text-white text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Store className="w-4 h-4 text-indigo-200" />
              <span>استكشف المطاعم واطلب وجبتك</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenMyOrders}
                  className="px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>متابعة طلباتي</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>حسابي</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>دخول / إنشاء حساب</span>
              </button>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center border-t border-slate-800/80">
            <div className="p-2">
              <div className="text-base sm:text-lg font-black text-amber-400 font-mono">100%</div>
              <div className="text-[11px] text-slate-400 font-bold">روابط مباشرة مخصصة</div>
            </div>
            <div className="p-2">
              <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">~15-25 د</div>
              <div className="text-[11px] text-slate-400 font-bold">متوسط سرعة التجهيز</div>
            </div>
            <div className="p-2">
              <div className="text-base sm:text-lg font-black text-sky-400 font-mono">GPS حي</div>
              <div className="text-[11px] text-slate-400 font-bold">تتبع خط سير الكابتن</div>
            </div>
            <div className="p-2">
              <div className="text-base sm:text-lg font-black text-purple-400 font-mono">كاشير حراري</div>
              <div className="text-[11px] text-slate-400 font-bold">طباعة فورية بالمطبخ</div>
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
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900">رابط مباشر وواجهة مخصصة لكل مطعم</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              كل مطعم يمتلك واجهة ومنيو برابط إلكتروني خاص (مثل unifood.com/?branch=shawarma) يمكن للعميل فتحه مباشرة ومشاركته عبر واتساب دون تشتيت.
            </p>
          </div>

          {/* Card 2: Live GPS Tracking */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900">تتبع دقيق للطلب والكابتن بالـ GPS</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              متابعة حية لموقع كابتن التوصيل على الخريطة من لحظة استلام الوجبة بالمطعم وحتى وصولها إلى بابك، مع عد تنازلي لوقت الوصول الفعلي.
            </p>
          </div>

          {/* Card 3: Group Cart */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900">سلة تشاركية للطلب الجماعي</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              أنشئ سلة مشتركة وشارك كود السلة مع أصدقائك أو زملائك في العمل؛ يضيف كل فرد وجبته الخاصة وتصل في فاتورة موحدة وحساب مفصل لكل شخص.
            </p>
          </div>

          {/* Card 4: Wallet & Loyalty */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900">محفظة رقمية واسترداد نقدي (Cashback)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              اكسب نقاط ولاء ورصيداً نقدياً مع كل طلب ناجح، واستخدمه كخصم مباشر أو رصيد لشراء وجباتك التالية بكل سهولة وأمان.
            </p>
          </div>

          {/* Card 5: POS & Kitchen Thermal Printing */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Printer className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900">ربط فوري بطابعات المطبخ والكاشير</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              نظام سطح المكتب المخصص للمطاعم يتصل تلقائياً بطابعات الفواتير الحرارية ESC/POS لطباعة بونات التجهيز في المطبخ فور اعتماد الطلب.
            </p>
          </div>

          {/* Card 6: WhatsApp Notifications & OTP */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-2xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-slate-900">إشعارات وتأكيدات فورية عبر الواتساب</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              تفعيل تلقائي للحسابات عبر روابط سريعة (Magic Link) وإرسال بونات الفاتورة ورابط تتبع الكابتن المباشر إلى رقم واتساب العميل.
            </p>
          </div>
        </div>
      </section>

      {/* 3. PARTNER RESTAURANTS SECTION: قائمة المطاعم الشريكة بسكرول أفقي أنيق */}
      <section id="partner-restaurants-section" className="space-y-4 pt-2">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                المطاعم الشريكة بالمنظومة
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-black">
                {branches.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              تصفح المطاعم المتوفرة واطلب مباشرة من المنيو المخصص لكل مطعم
            </p>
          </div>

          {/* Previous / Next buttons for horizontal scrolling on desktop */}
          {branches.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollHorizontally('prev')}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="المطاعم السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollHorizontally('next')}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="المطاعم التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Horizontal Scroll Slider for Restaurants */}
        {branches.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
            <Store className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-700">لا توجد مطاعم مسجلة حالياً</p>
            <p className="text-xs text-slate-500">سيتم إضافة مطاعم جديدة في المنظومة قريباً.</p>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
          >
            {branches.map((branch) => {
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
                  onClick={() => onSelectBranch(branch)}
                  className="w-[280px] sm:w-[320px] shrink-0 snap-start bg-white rounded-3xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group cursor-pointer"
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
                          className="w-14 h-14 rounded-2xl object-cover bg-white border-2 border-white shadow-md p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-white shadow-md flex items-center justify-center text-indigo-600 font-bold shrink-0">
                          <Store className="w-7 h-7" />
                        </div>
                      )}

                      <div className="mt-2.5">
                        <h3 className="font-black text-base text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {branch.name}
                        </h3>
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
                      className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs group-hover:shadow-md cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>دخول لمنيو المطعم</span>
                      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
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
              );
            })}
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

      {/* 5. FOOTER: الحقوق والتواصل */}
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
