import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowUpDown,
  GripVertical,
  Layers,
  UtensilsCrossed,
  Save,
  RotateCcw,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';
import { toast } from '../utils/toast';
import { useLockBodyScroll } from '../utils/scrollLock';

interface MenuReorderModalProps {
  categories: any[];
  isOpen: boolean;
  initialTab?: 'CATEGORIES' | 'ITEMS';
  initialCategoryId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const MenuReorderModal: React.FC<MenuReorderModalProps> = ({
  categories,
  isOpen,
  initialTab = 'CATEGORIES',
  initialCategoryId,
  onClose,
  onSuccess,
}) => {
  useLockBodyScroll(isOpen);

  const [activeTab, setActiveTab] = useState<'CATEGORIES' | 'ITEMS'>(initialTab);
  const [orderedCategories, setOrderedCategories] = useState<any[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, any[]>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drag & Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const resetFromProps = () => {
    const catsCopy = (categories || []).map((c) => ({ ...c }));
    const itemsMap: Record<string, any[]> = {};
    catsCopy.forEach((c) => {
      itemsMap[c.id] = Array.isArray(c.items) ? [...c.items] : [];
    });
    setOrderedCategories(catsCopy);
    setItemsByCategory(itemsMap);
    const defaultCatId =
      initialCategoryId && catsCopy.some((c) => c.id === initialCategoryId)
        ? initialCategoryId
        : catsCopy[0]?.id || '';
    setSelectedCategoryId(defaultCatId);
    setHasChanges(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      resetFromProps();
    }
  }, [isOpen, categories, initialTab, initialCategoryId]);

  if (!isOpen) return null;

  const moveArrayItem = <T,>(arr: T[], fromIdx: number, toIdx: number): T[] => {
    if (fromIdx < 0 || fromIdx >= arr.length) return arr;
    const clampedTo = Math.max(0, Math.min(arr.length - 1, toIdx));
    if (fromIdx === clampedTo) return arr;
    const copy = [...arr];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(clampedTo, 0, moved);
    return copy;
  };

  const handleMoveCategory = (fromIdx: number, toIdx: number) => {
    setOrderedCategories((prev) => {
      const next = moveArrayItem(prev, fromIdx, toIdx);
      if (next !== prev) setHasChanges(true);
      return next;
    });
  };

  const handleMoveItem = (catId: string, fromIdx: number, toIdx: number) => {
    setItemsByCategory((prev) => {
      const list = prev[catId] || [];
      const nextList = moveArrayItem(list, fromIdx, toIdx);
      if (nextList !== list) setHasChanges(true);
      return { ...prev, [catId]: nextList };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const categoryIds = orderedCategories.map((c) => c.id);
      const itemOrderPayload: Record<string, string[]> = {};
      Object.entries(itemsByCategory).forEach(([catId, list]) => {
        itemOrderPayload[catId] = (list || []).map((it) => it.id);
      });

      await api.reorderMenu({
        categoryIds,
        itemsByCategory: itemOrderPayload,
      });

      toast.success('تم حفظ ترتيب الأقسام والأصناف وتحديث عرض المنيو بنجاح');
      setHasChanges(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ الترتيب');
    } finally {
      setSaving(false);
    }
  };

  const currentItems = selectedCategoryId ? itemsByCategory[selectedCategoryId] || [] : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0">
              <ArrowUpDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">ترتيب عرض الأقسام والأصناف</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                رتّب ظهور الأقسام والأصناف للعملاء بالسحب أو الأسهم أو كتابة رقم الترتيب مباشرة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('CATEGORIES');
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              activeTab === 'CATEGORIES'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>ترتيب الأقسام ({orderedCategories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ITEMS');
              setDraggedIndex(null);
              setDragOverIndex(null);
              if (!selectedCategoryId && orderedCategories[0]) {
                setSelectedCategoryId(orderedCategories[0].id);
              }
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              activeTab === 'ITEMS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 shrink-0" />
            <span>ترتيب الأصناف داخل الأقسام</span>
          </button>
        </div>

        {/* Category Selector Pills when in ITEMS tab */}
        {activeTab === 'ITEMS' && orderedCategories.length > 0 && (
          <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {orderedCategories.map((cat, idx) => {
              const isSelected = selectedCategoryId === cat.id;
              const count = (itemsByCategory[cat.id] || []).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-mono opacity-70">#{idx + 1}</span>
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Body List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-slate-50/50">
          {activeTab === 'CATEGORIES' ? (
            orderedCategories.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-bold">
                لا توجد أقسام مضافة حالياً في المنيو.
              </div>
            ) : (
              orderedCategories.map((cat, idx) => {
                const itemCount = (itemsByCategory[cat.id] || []).length;
                const isDragOver = dragOverIndex === idx && draggedIndex !== idx;
                return (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => setDraggedIndex(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverIndex !== idx) setDragOverIndex(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex !== null && draggedIndex !== idx) {
                        handleMoveCategory(draggedIndex, idx);
                      }
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`bg-white rounded-2xl p-3 border transition-all flex items-center justify-between gap-2.5 select-none ${
                      isDragOver
                        ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/30'
                        : 'border-slate-200 shadow-sm hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0"
                        title="اسحب لتغيير الترتيب"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Direct position input */}
                      <input
                        type="number"
                        min={1}
                        max={orderedCategories.length}
                        value={idx + 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            handleMoveCategory(idx, val - 1);
                          }
                        }}
                        className="w-11 h-8 rounded-lg border border-slate-200 bg-slate-50 text-center font-mono text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
                        title="رقم ترتيب ظهور القسم"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {cat.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-bold">
                          {itemCount} صنف داخل القسم
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setActiveTab('ITEMS');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-colors hidden sm:inline-flex items-center gap-1"
                        title="ترتيب الأصناف داخل هذا القسم"
                      >
                        <UtensilsCrossed className="w-3 h-3" />
                        <span>أصنافه</span>
                      </button>

                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, 0)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                        title="نقل إلى أول القائمة (#1)"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, idx - 1)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                        title="تقديم للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedCategories.length - 1}
                        onClick={() => handleMoveCategory(idx, idx + 1)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                        title="تأخير للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : currentItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              لا توجد أصناف في هذا القسم حالياً.
            </div>
          ) : (
            currentItems.map((item, idx) => {
              const isDragOver = dragOverIndex === idx && draggedIndex !== idx;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== idx && selectedCategoryId) {
                      handleMoveItem(selectedCategoryId, draggedIndex, idx);
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`bg-white rounded-2xl p-2.5 sm:p-3 border transition-all flex items-center justify-between gap-2.5 select-none ${
                    isDragOver
                      ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/30'
                      : 'border-slate-200 shadow-sm hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0"
                      title="اسحب لتغيير الترتيب"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <input
                      type="number"
                      min={1}
                      max={currentItems.length}
                      value={idx + 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && selectedCategoryId) {
                          handleMoveItem(selectedCategoryId, idx, val - 1);
                        }
                      }}
                      className="w-11 h-8 rounded-lg border border-slate-200 bg-slate-50 text-center font-mono text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
                      title="رقم ترتيب ظهور الصنف داخل القسم"
                    />

                    {item.imageUrl ? (
                      <img
                        src={getFullImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {item.name}
                        </span>
                        {item.isAvailable === false && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold shrink-0">
                            غير متوفر
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-indigo-700 font-mono">
                        {item.basePrice} ج.م
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => selectedCategoryId && handleMoveItem(selectedCategoryId, idx, 0)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                      title="نقل إلى أول القسم (#1)"
                    >
                      <ArrowUpToLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => selectedCategoryId && handleMoveItem(selectedCategoryId, idx, idx - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                      title="تقديم للأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentItems.length - 1}
                      onClick={() => selectedCategoryId && handleMoveItem(selectedCategoryId, idx, idx + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                      title="تأخير للأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            disabled={!hasChanges || saving}
            onClick={resetFromProps}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة للأصل</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-60 flex items-center gap-1.5 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'جاري الحفظ...' : 'حفظ الترتيب'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
