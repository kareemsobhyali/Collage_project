import React, { useState, useMemo } from 'react';
import {
  Store,
  Sparkles,
  Users,
  Smartphone,
  MapPin,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  ShoppingBag,
  Truck,
  Wallet,
  Printer,
  MessageCircle,
  Download,
  Star,
  Search,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { getDisplayAddress } from '../services/campusLocations';
import { triggerInstallApp, isRunningInNativeApk } from '../services/notifications';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'OPEN' | 'DELIVERY'>('ALL');
  const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);

  // تصفية المطاعم حسب البحث والحالة
  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (branch.name && branch.name.toLowerCase().includes(q)) ||
        (branch.address && branch.address.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterType === 'OPEN') {
        return (
          branch.isActive !== false &&
          branch.operationalStatus !== 'CLOSED' &&
          isBranchOpenByHours(branch.openingTime, branch.closingTime, branch.isWithinWorkingHours)
        );
      }
      if (filterType === 'DELIVERY') {
        return branch.allowDelivery === true;
      }
      return true;
    });
  }, [branches, searchQuery, filterType]);

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

            {!isRunningInNativeApk() && (
              <button
                type="button"
                onClick={() => triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Student.apk')}
                className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 active:scale-95 text-xs sm:text-sm font-bold backdrop-blur-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-300" />
                <span>تحميل تطبيق الأندرويد</span>
              </button>
            )}

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

      {/* 3. PARTNER RESTAURANTS SECTION: قائمة المطاعم الشريكة والروابط المباشرة */}
      <section id="partner-restaurants-section" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-indigo-600" />
              <span>المطاعم الشريكة المسجلة في المنظومة</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              اختر مطعمك المفضل لفتح واجهته ومنيوه الخاص، أو انسخ رابطه المباشر لمشاركته.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مطعم أو وجبة..."
              className="w-full h-9 pr-9 pl-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'ALL'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            جميع المطاعم ({branches.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('OPEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'OPEN'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            المفتوحة الآن للطلب
          </button>

          <button
            type="button"
            onClick={() => setFilterType('DELIVERY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'DELIVERY'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            التوصيل متاح
          </button>
        </div>

        {/* Restaurants Grid */}
        {filteredBranches.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
            <Store className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-700">لم يتم العثور على مطاعم تطابق بحثك</p>
            <p className="text-xs text-slate-500">جرّب تغيير كلمات البحث أو استعراض جميع المطاعم.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredBranches.map((branch) => {
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
                  className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                >
                  <div>
                    {/* Top row: Logo, Name, Rating */}
                    <div className="flex items-start gap-3">
                      {branch.logoUrl ? (
                        <img
                          src={getFullImageUrl(branch.logoUrl)}
                          alt={branch.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0 bg-white p-0.5 shadow-2xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                          <Store className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-black text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {branch.name}
                          </h3>
                          <div className="flex items-center gap-0.5 text-xs font-black text-amber-500 shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span>{rating}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1 truncate">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{getDisplayAddress(branch.address, 'موقع المطعم')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Status & Prep time */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        <span className={isOpen ? 'text-emerald-700' : 'text-rose-600'}>
                          {isOpen ? 'مفتوح للطلب الآن' : 'مغلق حالياً'}
                        </span>
                      </div>

                      <div className="text-slate-500 font-mono text-[10px]">
                        {branch.estimatedPrepMins ? `~${branch.estimatedPrepMins}` : '~15-25 د'}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Direct Menu Button + Copy Direct Link Button */}
                  <div className="pt-1 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBranch(branch);
                      }}
                      className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>دخول لمنيو المطعم</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleCopyBranchLink(e, branch)}
                      title="نسخ الرابط المباشر لهذا المطعم"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-90 transition-all border border-slate-200/80 shrink-0"
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

      {/* 5. DOWNLOAD MOBILE & DESKTOP APPS: تحميل التطبيقات */}
      <section className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-indigo-800/80 shadow-xl space-y-6">
        <div className="text-center space-y-1.5 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 bg-white/10 px-3 py-1 rounded-full">
            <Smartphone className="w-3.5 h-3.5" />
            <span>تطبيقات UniFood المخصصة</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            حمّل تطبيقات المنظومة على هاتفك وحاسوبك
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            تطبيقات خفيفة وسريعة للأندرويد وسطح المكتب تضمن أعلى درجات التفاعل والتكامل.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Customer APK Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mb-2.5">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-white">تطبيق العملاء (APK)</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                طلب الوجبات السريع، السلة التشاركية، المحفظة الرقمية، وتتبع خط سير الكابتن لحظياً.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Student.apk')}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>تحميل تطبيق العميل</span>
            </button>
          </div>

          {/* Driver APK Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-2.5">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-white">تطبيق الكابتن (Driver APK)</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                استلام مهام التوصيل، الملاحة الذكية، وتأكيد التسليم برمز الـ PIN بأمان تام.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Driver.apk')}
              className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>تحميل تطبيق الكابتن</span>
            </button>
          </div>

          {/* Desktop POS Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between space-y-3">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 mb-2.5">
                <Printer className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-white">برنامج الكاشير (Desktop App)</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                إدارة طلبات المطعم الفورية وشاشات المطبخ والربط التلقائي بطابعات الفواتير الحرارية.
              </p>
            </div>
            <a
              href="/admin"
              className="w-full py-2 px-3 bg-white/15 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border border-white/20"
            >
              <ExternalLink className="w-4 h-4" />
              <span>لوحة تحكم المطاعم</span>
            </a>
          </div>
        </div>
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
