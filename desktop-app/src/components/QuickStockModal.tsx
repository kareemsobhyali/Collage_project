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
  Sparkles
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

  const filteredItems = allItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredOptions = allOptions.filter((opt) =>
    opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.groupTitle && opt.groupTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">إدارة توفر الأصناف والإضافات</h3>
              <p className="text-xs text-slate-500">إيقاف الأصناف عند نفاد الكمية (نهائياً أو لفترة مؤقتة ويعود تلقائياً)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="flex items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('ITEMS')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all ${
                  activeTab === 'ITEMS'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>الأصناف والوجبات ({allItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('MODIFIERS')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all ${
                  activeTab === 'MODIFIERS'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>خيارات الإضافات والجبن ({allOptions.length})</span>
              </button>
            </div>

            {/* Out of Stock Counter */}
            <div className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              <span>
                {activeTab === 'ITEMS'
                  ? `${allItems.filter((i) => !i.isAvailable).length} صنف غير متاح حالياً`
                  : `${allOptions.filter((o) => !o.isAvailable).length} إضافة غير متاحة حالياً`}
              </span>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'ITEMS' ? 'ابحث باسم الوجبة أو القسم...' : 'ابحث باسم الإضافة أو المجموعة...'}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
          {activeTab === 'ITEMS' ? (
            filteredItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                لا توجد أصناف مطابقة للبحث
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                    item.isAvailable
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
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

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-800 text-xs">{item.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            item.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-600 text-white shadow-xs'
                          }`}
                        >
                          {item.isAvailable ? 'متوفر' : 'نفد'}
                        </span>
                        {!item.isAvailable && item.unavailableUntil && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ⏳ يعود تلقائياً {new Date(item.unavailableUntil).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono">{item.basePrice} ج.م</span>
                        {item.categoryName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">{item.categoryName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {item.isAvailable ? (
                      <>
                        <span className="text-[10px] font-bold text-slate-400 ml-1">نفد لفترة:</span>
                        {[
                          { label: '30 د', mins: 30 },
                          { label: '1 س', mins: 60 },
                          { label: '2 س', mins: 120 },
                          { label: '4 س', mins: 240 },
                        ].map((preset) => (
                          <button
                            key={preset.mins}
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => handleToggleItem(item, preset.mins)}
                            className="text-[11px] px-2.5 py-1.5 rounded-xl font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all"
                            title={`إيقاف لمدة ${preset.label} ثم يعود متاحاً تلقائياً`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleToggleItem(item)}
                          className="text-xs px-3 py-1.5 rounded-xl font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all"
                        >
                          نفد تماماً
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleToggleItem(item)}
                        className="text-xs px-4 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                      >
                        إعادة للتوفر الآن
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            filteredOptions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                لا توجد إضافات مطابقة للبحث
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                    opt.isAvailable
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleOption(opt)}
                      disabled={updatingId === opt.id}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                        opt.isAvailable
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      }`}
                    >
                      {opt.isAvailable ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-800 text-xs">{opt.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            opt.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-600 text-white shadow-xs'
                          }`}
                        >
                          {opt.isAvailable ? 'متوفر' : 'نفد'}
                        </span>
                        {!opt.isAvailable && opt.unavailableUntil && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ⏳ يعود تلقائياً {new Date(opt.unavailableUntil).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono">+{opt.price} ج.م</span>
                        {opt.groupTitle && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">{opt.groupTitle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {opt.isAvailable ? (
                      <>
                        <span className="text-[10px] font-bold text-slate-400 ml-1">نفد لفترة:</span>
                        {[
                          { label: '30 د', mins: 30 },
                          { label: '1 س', mins: 60 },
                          { label: '2 س', mins: 120 },
                          { label: '4 س', mins: 240 },
                        ].map((preset) => (
                          <button
                            key={preset.mins}
                            type="button"
                            disabled={updatingId === opt.id}
                            onClick={() => handleToggleOption(opt, preset.mins)}
                            className="text-[11px] px-2.5 py-1.5 rounded-xl font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all"
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={updatingId === opt.id}
                          onClick={() => handleToggleOption(opt)}
                          className="text-xs px-3 py-1.5 rounded-xl font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all"
                        >
                          نفد تماماً
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === opt.id}
                        onClick={() => handleToggleOption(opt)}
                        className="text-xs px-4 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                      >
                        إعادة للتوفر الآن
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-400">التغييرات تنعكس فوراً ومباشرة على شاشات طلب الطلاب.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
