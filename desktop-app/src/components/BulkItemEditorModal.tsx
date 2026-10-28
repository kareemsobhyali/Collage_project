import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  Layers,
  UtensilsCrossed,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';
import { toast } from '../utils/toast';
import { useLockBodyScroll } from '../utils/scrollLock';

interface SizeDraft {
  name: string;
  price: string | number;
}

interface ItemDraft {
  id: string;
  name: string;
  categoryId: string;
  basePrice: string | number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
  sizes: SizeDraft[];
  _isDirty?: boolean;
}

interface BulkItemEditorModalProps {
  categories: any[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkItemEditorModal: React.FC<BulkItemEditorModalProps> = ({
  categories,
  isOpen,
  onClose,
  onSuccess,
}) => {
  useLockBodyScroll(isOpen);

  // تحضير مسودة البيانات الأصلية لكافة الأصناف عبر كافة الأقسام
  const initialDrafts = useMemo<Record<string, ItemDraft>>(() => {
    const map: Record<string, ItemDraft> = {};
    categories.forEach((cat) => {
      (cat.items || []).forEach((it: any) => {
        map[it.id] = {
          id: it.id,
          name: it.name || '',
          categoryId: it.categoryId || cat.id,
          basePrice: it.basePrice !== undefined ? String(it.basePrice) : '0',
          description: it.description || '',
          imageUrl: it.imageUrl || '',
          isAvailable: it.isAvailable !== false,
          sizes: (it.sizes || []).map((s: any) => ({
            name: s.name || '',
            price: s.price !== undefined ? String(s.price) : '0',
          })),
          _isDirty: false,
        };
      });
    });
    return map;
  }, [categories, isOpen]);

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(initialDrafts);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [showOnlyDirty, setShowOnlyDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // إعادة ضبط المسودات عند فتح النافذة
  React.useEffect(() => {
    if (isOpen) {
      setDrafts(initialDrafts);
      setSearchQuery('');
      setSelectedCategoryFilter('ALL');
      setShowOnlyDirty(false);
    }
  }, [isOpen, initialDrafts]);

  if (!isOpen) return null;

  // عدد الأصناف المعدلة
  const dirtyItemIds = Object.keys(drafts).filter((id) => drafts[id]._isDirty);
  const dirtyCount = dirtyItemIds.length;

  // تعديل حقل معين لصنف
  const handleFieldChange = (id: string, field: keyof ItemDraft, value: any) => {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
          _isDirty: true,
        },
      };
    });
  };

  // تعديل حجم معين للصنف
  const handleSizeChange = (itemId: string, sizeIdx: number, field: 'name' | 'price', val: string) => {
    setDrafts((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const newSizes = [...current.sizes];
      newSizes[sizeIdx] = {
        ...newSizes[sizeIdx],
        [field]: val,
      };
      return {
        ...prev,
        [itemId]: {
          ...current,
          sizes: newSizes,
          _isDirty: true,
        },
      };
    });
  };

  // إضافة حجم جديد للصنف
  const handleAddSize = (itemId: string) => {
    setDrafts((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: {
          ...current,
          sizes: [...current.sizes, { name: 'حجم جديد', price: String(current.basePrice || '0') }],
          _isDirty: true,
        },
      };
    });
  };

  // حذف حجم من الصنف
  const handleRemoveSize = (itemId: string, sizeIdx: number) => {
    setDrafts((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const newSizes = current.sizes.filter((_, idx) => idx !== sizeIdx);
      return {
        ...prev,
        [itemId]: {
          ...current,
          sizes: newSizes,
          _isDirty: true,
        },
      };
    });
  };

  // التراجع عن كافة التعديلات واستعادة المنيو الأصلي
  const handleResetAll = () => {
    if (dirtyCount > 0) {
      if (!window.confirm('هل أنت متأكد من إلغاء كافة التعديلات غير المحفوظة والعودة للبيانات الأصلية؟')) {
        return;
      }
    }
    setDrafts(initialDrafts);
    toast.info('تم التراجع عن التعديلات');
  };

  // إغلاق النافذة مع التحقق من وجود تعديلات غير محفوظة
  const handleSafeClose = () => {
    if (dirtyCount > 0) {
      if (!window.confirm(`لديك ${dirtyCount} أصناف تم تعديلها ولم تحفظها بعد.\nهل تريد الخروج وإلغاء هذه التعديلات؟`)) {
        return;
      }
    }
    onClose();
  };

  // حفظ كافة التعديلات دفعة واحدة على السيرفر
  const handleSaveAll = async () => {
    if (dirtyCount === 0) {
      toast.info('لم تقم بأي تعديلات لحفظها');
      return;
    }

    try {
      setSaving(true);
      const itemsToUpdate = dirtyItemIds.map((id) => {
        const item = drafts[id];
        return {
          id: item.id,
          name: item.name,
          categoryId: item.categoryId,
          basePrice: parseFloat(String(item.basePrice)) || 0,
          description: item.description,
          imageUrl: item.imageUrl,
          isAvailable: item.isAvailable,
          sizes: item.sizes.map((s) => ({
            name: s.name,
            price: parseFloat(String(s.price)) || 0,
          })),
        };
      });

      const res = await api.bulkUpdateItems(itemsToUpdate);
      toast.success(`تم حفظ تعديلات ${res.updatedCount || itemsToUpdate.length} صنف بنجاح تام! 🎉`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ التعديلات الجماعية');
    } finally {
      setSaving(false);
    }
  };

  // تصفية الأصناف المعروضة
  const itemsList = Object.values(drafts);
  const filteredItems = itemsList.filter((item) => {
    if (selectedCategoryFilter !== 'ALL' && item.categoryId !== selectedCategoryFilter) {
      return false;
    }
    if (showOnlyDirty && !item._isDirty) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cat = categories.find((c) => c.id === item.categoryId);
      const catName = (cat?.name || '').toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchCat = catName.includes(q);
      return matchName || matchDesc || matchCat;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  تعديل أصناف المنيو بشكل كامل ومجمّع
                </h3>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                  تعديل سريع
                </span>
                {dirtyCount > 0 && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full border border-emerald-300 animate-pulse">
                    {dirtyCount} صنف تم تعديله
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                عدّل الأسماء، الأسعار، الأقسام، الأحجام، والتوفر لكافة الأصناف مباشرة بدون فتح كل صنف بشكل منفرد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                disabled={saving}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="إلغاء التعديلات والعودة للبيانات الأصلية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تراجع</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || dirtyCount === 0}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md ${
                dirtyCount === 0 || saving
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-emerald-600/20'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات ({dirtyCount})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSafeClose}
              disabled={saving}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع بالاسم أو الوصف أو القسم..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Category Filter Dropdown / Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">كافة الأقسام ({itemsList.length} صنف)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.items?.length || 0})
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyDirty}
                onChange={(e) => setShowOnlyDirty(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
              <span>المعدلة فقط ({dirtyCount})</span>
            </label>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-5 custom-scrollbar bg-slate-50/40">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-200">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="font-bold text-sm text-slate-700">لا توجد أصناف تطابق البحث</p>
              <p className="text-xs text-slate-400 mt-1">جرّب تغيير عبارة البحث أو اختيار قسم آخر</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <table className="min-w-[950px] w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200 font-black">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 w-48">القسم</th>
                    <th className="p-3 min-w-[180px]">اسم الصنف</th>
                    <th className="p-3 w-32">السعر الأساسي</th>
                    <th className="p-3 min-w-[240px]">الأحجام والأسعار (صغير، وسط، كبير...)</th>
                    <th className="p-3 w-28 text-center">الحالة</th>
                    <th className="p-3 min-w-[200px]">الوصف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredItems.map((item, idx) => {
                    const isDirty = Boolean(item._isDirty);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isDirty ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Index & Dirty Indicator */}
                        <td className="p-3 text-center text-slate-400 font-mono text-[11px] align-top pt-4">
                          <div className="flex flex-col items-center gap-1">
                            <span>{idx + 1}</span>
                            {isDirty && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" title="تم تعديله" />
                            )}
                          </div>
                        </td>

                        {/* Category Selector */}
                        <td className="p-2.5 align-top">
                          <select
                            value={item.categoryId}
                            onChange={(e) => handleFieldChange(item.id, 'categoryId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Item Name */}
                        <td className="p-2.5 align-top">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          />
                        </td>

                        {/* Base Price */}
                        <td className="p-2.5 align-top">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={item.basePrice}
                              onChange={(e) => handleFieldChange(item.id, 'basePrice', e.target.value)}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-emerald-600 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans pointer-events-none">
                              ج.م
                            </span>
                          </div>
                        </td>

                        {/* Sizes Editor */}
                        <td className="p-2.5 align-top">
                          <div className="space-y-1.5">
                            {item.sizes.map((s, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={s.name}
                                  placeholder="اسم الحجم"
                                  onChange={(e) => handleSizeChange(item.id, sIdx, 'name', e.target.value)}
                                  className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-800 focus:bg-white"
                                />
                                <div className="relative w-20">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={s.price}
                                    placeholder="السعر"
                                    onChange={(e) => handleSizeChange(item.id, sIdx, 'price', e.target.value)}
                                    className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono font-bold text-emerald-600 focus:bg-white"
                                  />
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
                                    ج.م
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSize(item.id, sIdx)}
                                  className="w-6 h-6 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                  title="حذف هذا الحجم"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => handleAddSize(item.id)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة حجم (صغير/كبير)</span>
                            </button>
                          </div>
                        </td>

                        {/* Availability Toggle */}
                        <td className="p-2.5 align-top text-center">
                          <button
                            type="button"
                            onClick={() => handleFieldChange(item.id, 'isAvailable', !item.isAvailable)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer ${
                              item.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {item.isAvailable ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>متوفر</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5 text-rose-600" />
                                <span>غير متوفر</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Description */}
                        <td className="p-2.5 align-top">
                          <input
                            type="text"
                            value={item.description}
                            placeholder="وصف الصنف ومكوناته..."
                            onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>إجمالي الأصناف: <strong className="text-slate-800">{itemsList.length}</strong></span>
            <span>•</span>
            <span>المعروض حالياً: <strong className="text-slate-800">{filteredItems.length}</strong></span>
            {dirtyCount > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                  ⚠️ لديك {dirtyCount} صنف تم تعديلهم ولم يُحفظوا بعد
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSafeClose}
              disabled={saving}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                تراجع عن التعديلات
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || dirtyCount === 0}
              className={`flex-2 sm:flex-initial px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md ${
                dirtyCount === 0 || saving
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-emerald-600/30'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ كافة التعديلات ({dirtyCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
