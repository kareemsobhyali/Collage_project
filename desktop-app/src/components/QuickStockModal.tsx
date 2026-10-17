import React, { useState } from 'react';
import { 
  X, 
  Search, 
  UtensilsCrossed, 
  Sliders, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from '../utils/toast';
import { useLockBodyScroll } from '../utils/scrollLock';

interface QuickStockModalProps {
  categories: any[];
  modifierGroups: any[];
  onClose: () => void;
  onRefreshMenu: () => void;
}

export const QuickStockModal: React.FC<QuickStockModalProps> = ({
  categories,
  modifierGroups,
  onClose,
  onRefreshMenu,
}) => {
  useLockBodyScroll(true);
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'MODIFIERS'>('ITEMS');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyUnavailable, setShowOnlyUnavailable] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Flatten all items across categories with categoryName
  const allItems: any[] = [];
  categories.forEach((cat) => {
    (cat.items || []).forEach((item: any) => {
      allItems.push({ ...item, categoryName: cat.name });
    });
  });

  // Flatten all modifier options across groups with groupTitle
  const allOptions: any[] = [];
  modifierGroups.forEach((grp) => {
    (grp.options || []).forEach((opt: any) => {
      allOptions.push({ ...opt, groupTitle: grp.title });
    });
  });

  const filteredItems = allItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (showOnlyUnavailable) return !item.isAvailable;
    return true;
  });

  const filteredOptions = allOptions.filter((opt) => {
    const matchesSearch =
      opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opt.groupTitle && opt.groupTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (showOnlyUnavailable) return !opt.isAvailable;
    return true;
  });

  const handleToggleItem = async (item: any, durationMinutes?: number) => {
    try {
      setUpdatingId(item.id);
      await api.quickToggleStock({
        type: 'item',
        id: item.id,
        isAvailable: !item.isAvailable,
        durationMinutes,
      });
      if (durationMinutes) {
        toast.info(`تم ضبط نفاد مؤقت للصنف "${item.name}" لمدة ${durationMinutes} دقيقة`);
      } else if (item.isAvailable) {
        toast.warning(`تم تعيين صنف "${item.name}" كغير متوفر`);
      } else {
        toast.success(`تم تفعيل توفر صنف "${item.name}"`);
      }
      onRefreshMenu();
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث حالة الصنف');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleOption = async (option: any, durationMinutes?: number) => {
    try {
      setUpdatingId(option.id);
      await api.quickToggleStock({
        type: 'modifier',
        id: option.id,
        isAvailable: !option.isAvailable,
        durationMinutes,
      });
      if (durationMinutes) {
        toast.info(`تم ضبط نفاد مؤقت للإضافة "${option.name}" لمدة ${durationMinutes} دقيقة`);
      } else if (option.isAvailable) {
        toast.warning(`تم تعيين إضافة "${option.name}" كغير متوفر`);
      } else {
        toast.success(`تم تفعيل توفر إضافة "${option.name}"`);
      }
      onRefreshMenu();
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث حالة الإضافة');
    } finally {
      setUpdatingId(null);
    }
  };

  const unavailableItemsCount = allItems.filter((i) => !i.isAvailable).length;
  const unavailableOptionsCount = allOptions.filter((o) => !o.isAvailable).length;
  const currentOutCount = activeTab === 'ITEMS' ? unavailableItemsCount : unavailableOptionsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-800 text-sm sm:text-base truncate">إدارة توفر الأصناف والإضافات</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">إيقاف الأصناف عند نفاد الكمية (نهائياً أو لفترة مؤقتة)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 space-y-2.5 bg-white shrink-0">
          {/* Main Tabs (50 / 50 on mobile) */}
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('ITEMS');
                setShowOnlyUnavailable(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all ${
                activeTab === 'ITEMS'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">الوجبات والأصناف ({allItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('MODIFIERS');
                setShowOnlyUnavailable(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all ${
                activeTab === 'MODIFIERS'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">خيارات الإضافات ({allOptions.length})</span>
            </button>
          </div>

          {/* Search + Quick Out-of-Stock Filter chip */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'ITEMS' ? 'ابحث باسم الوجبة أو القسم...' : 'ابحث باسم الإضافة أو المجموعة...'}
                className="w-full pr-10 pl-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {currentOutCount > 0 && (
              <button
                type="button"
                onClick={() => setShowOnlyUnavailable(!showOnlyUnavailable)}
                className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border whitespace-nowrap active:scale-95 ${
                  showOnlyUnavailable
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
                title={showOnlyUnavailable ? 'اضغط لإلغاء الفلتر وعرض الجميع' : 'اضغط لعرض غير المتاح فقط'}
              >
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{currentOutCount} غير متاح</span>
                {showOnlyUnavailable && <span className="text-[10px] bg-white/20 px-1 rounded-sm">مفلتر</span>}
              </button>
            )}
          </div>
        </div>

        {/* Content List */}
        <div className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-2.5 min-h-0">
          {activeTab === 'ITEMS' ? (
            filteredItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <UtensilsCrossed className="w-10 h-10 mx-auto opacity-30" />
                <p className="font-bold">لا توجد أصناف مطابقة للبحث أو الفلتر</p>
                {showOnlyUnavailable && (
                  <button
                    type="button"
                    onClick={() => setShowOnlyUnavailable(false)}
                    className="text-indigo-600 font-bold hover:underline text-xs"
                  >
                    عرض كافة الأصناف
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                    item.isAvailable
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  {/* Top: Check button + Item Info */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item)}
                        disabled={updatingId === item.id}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                          item.isAvailable
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        }`}
                        title={item.isAvailable ? 'اضغط للإيقاف (نفد)' : 'اضغط للتشغيل (متوفر)'}
                      >
                        {item.isAvailable ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-xs truncate">{item.name}</h4>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                              item.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-600 text-white shadow-xs'
                            }`}
                          >
                            {item.isAvailable ? 'متوفر' : 'غير متوفر'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-bold text-indigo-700">{item.basePrice} ج.م</span>
                          {item.categoryName && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 truncate">{item.categoryName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!item.isAvailable && (
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleToggleItem(item)}
                        className="text-xs px-3.5 py-1.5 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all shrink-0 active:scale-95 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>إعادة للتوفر</span>
                      </button>
                    )}
                  </div>

                  {/* Unavailable Until badge if scheduled */}
                  {!item.isAvailable && item.unavailableUntil && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>يعود للتوفر تلقائياً الساعة {new Date(item.unavailableUntil).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}

                  {/* Actions when Available */}
                  {item.isAvailable && (
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap ml-1">نفاد مؤقت:</span>
                        {[
                          { label: '30 د', mins: 30 },
                          { label: '1 س', mins: 60 },
                          { label: '2 س', mins: 120 },
                        ].map((preset) => (
                          <button
                            key={preset.mins}
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => handleToggleItem(item, preset.mins)}
                            className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all whitespace-nowrap"
                            title={`إيقاف مؤقت لمدة ${preset.label} ثم يعود تلقائياً`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleToggleItem(item)}
                        className="text-[11px] px-3 py-1 rounded-lg font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all whitespace-nowrap shrink-0"
                      >
                        نفد كلياً
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            filteredOptions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <Sliders className="w-10 h-10 mx-auto opacity-30" />
                <p className="font-bold">لا توجد إضافات مطابقة للبحث أو الفلتر</p>
                {showOnlyUnavailable && (
                  <button
                    type="button"
                    onClick={() => setShowOnlyUnavailable(false)}
                    className="text-indigo-600 font-bold hover:underline text-xs"
                  >
                    عرض كافة الإضافات
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                    opt.isAvailable
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  {/* Top: Check button + Option Info */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleOption(opt)}
                        disabled={updatingId === opt.id}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                          opt.isAvailable
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        }`}
                        title={opt.isAvailable ? 'اضغط للإيقاف (نفد)' : 'اضغط للتشغيل (متوفر)'}
                      >
                        {opt.isAvailable ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-xs truncate">{opt.name}</h4>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                              opt.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-600 text-white shadow-xs'
                            }`}
                          >
                            {opt.isAvailable ? 'متوفر' : 'غير متوفر'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-bold text-indigo-700">+{opt.price} ج.م</span>
                          {opt.groupTitle && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 truncate">{opt.groupTitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!opt.isAvailable && (
                      <button
                        type="button"
                        disabled={updatingId === opt.id}
                        onClick={() => handleToggleOption(opt)}
                        className="text-xs px-3.5 py-1.5 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all shrink-0 active:scale-95 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>إعادة للتوفر</span>
                      </button>
                    )}
                  </div>

                  {/* Unavailable Until badge if scheduled */}
                  {!opt.isAvailable && opt.unavailableUntil && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>يعود للتوفر تلقائياً الساعة {new Date(opt.unavailableUntil).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}

                  {/* Actions when Available */}
                  {opt.isAvailable && (
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap ml-1">نفاد مؤقت:</span>
                        {[
                          { label: '30 د', mins: 30 },
                          { label: '1 س', mins: 60 },
                          { label: '2 س', mins: 120 },
                        ].map((preset) => (
                          <button
                            key={preset.mins}
                            type="button"
                            disabled={updatingId === opt.id}
                            onClick={() => handleToggleOption(opt, preset.mins)}
                            className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all whitespace-nowrap"
                            title={`إيقاف مؤقت لمدة ${preset.label} ثم يعود تلقائياً`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={updatingId === opt.id}
                        onClick={() => handleToggleOption(opt)}
                        className="text-[11px] px-3 py-1 rounded-lg font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all whitespace-nowrap shrink-0"
                      >
                        نفد كلياً
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs shrink-0">
          <span className="text-[11px] text-slate-400 leading-tight">
            التغييرات تنعكس فوراً ومباشرة على شاشات طلب الطلاب.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-all shrink-0 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
