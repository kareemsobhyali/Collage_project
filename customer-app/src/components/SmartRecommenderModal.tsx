import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  RotateCcw, 
  ArrowLeft, 
  Utensils, 
  Check, 
  Flame, 
  Coffee, 
  Heart,
  ChevronRight,
  TrendingUp,
  Tag
} from 'lucide-react';
import { getFullImageUrl } from '../services/api';
import { getItemFallbackImage } from '../utils/foodImages';

interface SmartRecommenderModalProps {
  branch: any;
  categories: any[];
  onSelectItem: (item: any) => void;
  onClose: () => void;
}

type MoodType = 'CRISPY' | 'BURGER' | 'LIGHT' | 'SWEET' | 'DRINK' | 'ANY';
type BudgetType = 'LOW' | 'MED' | 'HIGH' | 'ANY';
type GroupType = 'SINGLE' | 'DUO' | 'GROUP';

export const SmartRecommenderModal: React.FC<SmartRecommenderModalProps> = ({
  branch,
  categories,
  onSelectItem,
  onClose,
}) => {
  const [selectedMood, setSelectedMood] = useState<MoodType>('ANY');
  const [selectedBudget, setSelectedBudget] = useState<BudgetType>('ANY');
  const [selectedGroup, setSelectedGroup] = useState<GroupType>('SINGLE');

  const [step, setStep] = useState<'QUESTIONS' | 'THINKING' | 'RESULT'>('QUESTIONS');
  const [recommendedItem, setRecommendedItem] = useState<any | null>(null);
  const [reasonText, setReasonText] = useState<string>('');
  const [seenItemIds, setSeenItemIds] = useState<string[]>([]);

  // تجميع كافة الأصناف المتاحة في المطعم
  const allAvailableItems = useMemo(() => {
    const list: any[] = [];
    (categories || []).forEach((cat) => {
      if (cat.isAvailable === false) return;
      (cat.items || []).forEach((it: any) => {
        if (it.isAvailable !== false) {
          list.push({ ...it, categoryName: cat.name });
        }
      });
    });
    return list;
  }, [categories]);

  // خوارزمية الترشيح الذكية بناءً على المود والميزانية
  const pickBestItem = (excludedIds: string[] = []) => {
    let pool = allAvailableItems.filter((it) => !excludedIds.includes(it.id));
    if (pool.length === 0) {
      pool = [...allAvailableItems];
      excludedIds = [];
    }

    if (pool.length === 0) return null;

    // 1. تصفية حسب الميزانية
    if (selectedBudget === 'LOW') {
      const lowPool = pool.filter((it) => it.basePrice <= 80);
      if (lowPool.length > 0) pool = lowPool;
    } else if (selectedBudget === 'MED') {
      const medPool = pool.filter((it) => it.basePrice > 80 && it.basePrice <= 150);
      if (medPool.length > 0) pool = medPool;
    } else if (selectedBudget === 'HIGH') {
      const highPool = pool.filter((it) => it.basePrice > 140);
      if (highPool.length > 0) pool = highPool;
    }

    // 2. تصفية وترجيح حسب المزاج (Mood)
    let moodKeywords: RegExp | null = null;
    if (selectedMood === 'CRISPY') {
      moodKeywords = /كرسبي|استربس|فراخ|دجاج|زنجر|بانية|شاورما فراخ|تندر/i;
    } else if (selectedMood === 'BURGER') {
      moodKeywords = /برجر|لحم|بيف|تشيز|شاورما لحم|كفتة|سجق|هوت دوج/i;
    } else if (selectedMood === 'LIGHT') {
      moodKeywords = /ساندوتش|بطاطس|خفيف|مقبلات|جبن|كلوب|رول|فاهيتا/i;
    } else if (selectedMood === 'SWEET') {
      moodKeywords = /وافل|كريب حلو|نوتيلا|لوتس|شوكولاتة|بان كيك|كيك|حلو/i;
    } else if (selectedMood === 'DRINK') {
      moodKeywords = /عصير|مشروب|كانز|بيبسي|سموزي|موهيتو|مياه|شاي|قهوة/i;
    }

    if (moodKeywords) {
      const moodMatches = pool.filter((it) =>
        moodKeywords!.test(`${it.name} ${it.description || ''} ${it.categoryName || ''}`)
      );
      if (moodMatches.length > 0) {
        pool = moodMatches;
      }
    }

    // 3. إذا كان الاختيار لشلة، نفضل الأصناف المجمعة أو ذات السعر المناسب
    if (selectedGroup === 'GROUP') {
      const groupPool = pool.filter((it) => /بوكس|وجبة|كومبو|عائلي|ميكس|شلة|توفير/i.test(`${it.name} ${it.description || ''}`));
      if (groupPool.length > 0) pool = groupPool;
    }

    // اختيار عشوائي من المجموعة الأنسب
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    // صياغة سبب الترشيح بأسلوب جذاب
    let reason = 'وجبة مميزة تناسب ذوقك وتعد من أكثر الأطباق طلباً في المطعم!';
    if (selectedMood === 'CRISPY') {
      reason = 'وجبة مقرمشة وساخنة مع تتبيلة مميزة لتشبع رغبتك بالكرسبي 🔥';
    } else if (selectedMood === 'BURGER') {
      reason = 'لحم مشوي طازج غني بالجبن والنكهات القوية التي لا تقاوم 🍔';
    } else if (selectedMood === 'SWEET') {
      reason = 'تحلية غنية بالشوكولاتة لتروق على نفسك وتعدل مزاجك تماماً 🍫🧇';
    } else if (selectedBudget === 'LOW') {
      reason = `اختيار اقتصادي ومشبع جداً على قد الميزانية (${chosen.basePrice} ج.م فقط) 🪙`;
    }

    return { chosen, reason, newExcluded: [...excludedIds, chosen.id] };
  };

  const handleStartRecommend = () => {
    setStep('THINKING');
    setTimeout(() => {
      const res = pickBestItem();
      if (res) {
        setRecommendedItem(res.chosen);
        setReasonText(res.reason);
        setSeenItemIds(res.newExcluded);
        setStep('RESULT');
      } else {
        setStep('QUESTIONS');
      }
    }, 1100);
  };

  const handleRollAgain = () => {
    setStep('THINKING');
    setTimeout(() => {
      const res = pickBestItem(seenItemIds);
      if (res) {
        setRecommendedItem(res.chosen);
        setReasonText(res.reason);
        setSeenItemIds(res.newExcluded);
        setStep('RESULT');
      }
    }, 800);
  };

  const MOOD_OPTIONS: { id: MoodType; label: string; icon: string; desc: string }[] = [
    { id: 'CRISPY', label: 'كرسبي ومقرمش', icon: '🍗', desc: 'استربس، بانيه، فراخ مقرمشة' },
    { id: 'BURGER', label: 'برجر ولحوم', icon: '🍔', desc: 'لحوم مشوية، بيف، جبن سايح' },
    { id: 'LIGHT', label: 'خفيف وسريع', icon: '🥪', desc: 'سندوتشات سريعة وسناكس' },
    { id: 'SWEET', label: 'حلو ومروق', icon: '🧇', desc: 'وافل، نوتيلا، تحلية' },
    { id: 'DRINK', label: 'منعش وبارد', icon: '🥤', desc: 'عصائر، موهيتو، مشروبات' },
    { id: 'ANY', label: 'أي حاجة على ذوقك', icon: '🎲', desc: 'فاجئني بأفضل اختيار' },
  ];

  const BUDGET_OPTIONS: { id: BudgetType; label: string; sub: string }[] = [
    { id: 'LOW', label: 'أقل من 80 ج.م', sub: 'اقتصادي 🪙' },
    { id: 'MED', label: '80 - 150 ج.م', sub: 'متوسط 💳' },
    { id: 'HIGH', label: '+150 ج.م', sub: 'دلع نفسك ⭐' },
    { id: 'ANY', label: 'الميزانية مفتوحة', sub: 'مش فارقة 💸' },
  ];

  const GROUP_OPTIONS: { id: GroupType; label: string; icon: string }[] = [
    { id: 'SINGLE', label: 'لوحدي', icon: '👤' },
    { id: 'DUO', label: 'شخصين', icon: '👥' },
    { id: 'GROUP', label: 'شلة وصحاب', icon: '👨‍👩‍👧‍👦' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-orange-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 text-xl">
              🎲
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>مش عارف تختار إيه؟</span>
                <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">الذكاء الذواقة ✨</span>
              </h3>
              <p className="text-[11px] text-slate-500">جاوب سؤاليْن واحنا هنرشحلك الأكلة المثالية لمزاجك وميزانيتك!</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {step === 'QUESTIONS' && (
            <div className="space-y-5 animate-fadeIn">
              {/* 1. اختيار المزاج */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] flex items-center justify-center font-bold">1</span>
                  <span>نفسك تاكل إيه دلوقتي؟ (المود والمزاج)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MOOD_OPTIONS.map((mood) => {
                    const isSelected = selectedMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={() => setSelectedMood(mood.id)}
                        className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/70 shadow-sm ring-2 ring-orange-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-2xl shrink-0">{mood.icon}</span>
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs font-black block truncate ${isSelected ? 'text-orange-950' : 'text-slate-800'}`}>
                            {mood.label}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate leading-tight mt-0.5">
                            {mood.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. تحديد الميزانية */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] flex items-center justify-center font-bold">2</span>
                  <span>الميزانية التقريبية للوجبة؟</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BUDGET_OPTIONS.map((b) => {
                    const isSelected = selectedBudget === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBudget(b.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500 text-white shadow-sm font-black'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold'
                        }`}
                      >
                        <span className="text-xs block leading-tight">{b.label}</span>
                        <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                          {b.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. عدد الأشخاص */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] flex items-center justify-center font-bold">3</span>
                  <span>الطلب لمين؟</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GROUP_OPTIONS.map((g) => {
                    const isSelected = selectedGroup === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGroup(g.id)}
                        className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-black ring-1 ring-indigo-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs'
                        }`}
                      >
                        <span>{g.icon}</span>
                        <span className="text-xs">{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'THINKING' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-fadeIn">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-4xl shadow-xl shadow-orange-500/30 animate-bounce">
                  🎲
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs animate-spin">
                  ✨
                </div>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">جاري فحص المنيو واستخراج أحسن وجبة...</h4>
                <p className="text-xs text-slate-500 mt-1">بنحلل الأصناف والأسعار الأكثر طلباً لمطابقة ذوقك وميزانيتك!</p>
              </div>
            </div>
          )}

          {step === 'RESULT' && recommendedItem && (
            <div className="space-y-4 animate-fadeIn">
              {/* شارة سبب الترشيح */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-white border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
                <span className="text-lg shrink-0">💡</span>
                <div className="min-w-0">
                  <span className="font-black block">ترشيحنا الذكي ليك:</span>
                  <p className="text-[11px] text-amber-900 font-medium leading-relaxed mt-0.5">
                    {reasonText}
                  </p>
                </div>
              </div>

              {/* بطاقة الصنف المرشح */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                <div className="relative w-full h-48 sm:h-56 bg-slate-200 overflow-hidden">
                  <img
                    src={recommendedItem.imageUrl ? getFullImageUrl(recommendedItem.imageUrl) : getItemFallbackImage(recommendedItem.name)}
                    alt={recommendedItem.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getItemFallbackImage(recommendedItem.name);
                    }}
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md text-white text-[11px] font-black flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>اختيار اليوم</span>
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-indigo-600 text-white px-3 py-1 rounded-xl text-sm font-black shadow-md font-mono">
                    {recommendedItem.basePrice} ج.م
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-black text-slate-900">{recommendedItem.name}</h4>
                    <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shrink-0 font-bold">
                      {recommendedItem.categoryName || 'منيو المطعم'}
                    </span>
                  </div>
                  {recommendedItem.description && (
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {recommendedItem.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center gap-2.5">
          {step === 'QUESTIONS' ? (
            <button
              type="button"
              onClick={handleStartRecommend}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-orange-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>اقترح لي الوجبة المثالية 🎲</span>
            </button>
          ) : step === 'RESULT' && recommendedItem ? (
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={handleRollAgain}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                title="تجربة حظ أخرى"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">اقتراح آخر</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectItem(recommendedItem);
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>طلب هذا الصنف ({recommendedItem.basePrice} ج.م)</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
