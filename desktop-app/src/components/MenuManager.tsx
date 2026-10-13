import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Check, 
  ToggleLeft, 
  ToggleRight, 
  Layers, 
  FolderPlus,
  X,
  Link2
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';

interface MenuManagerProps {
  categories: any[];
  modifierGroups: any[];
  onRefresh: () => void;
  branch?: any;
}

export const MenuManager: React.FC<MenuManagerProps> = ({ categories, modifierGroups, onRefresh, branch }) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  
  // Category Form Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  
  // Item Form Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemBasePrice, setItemBasePrice] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [itemSizes, setItemSizes] = useState<{ name: string; price: string }[]>([]);
  const [itemCombos, setItemCombos] = useState<
    { id: string; title: string; description: string; price: string; badge: string }[]
  >([]);
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>([]);

  // فتح نافذة إضافة صنف
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategoryId(categories.length > 0 ? categories[0].id : '');
    setItemDescription('');
    setItemBasePrice('');
    setItemImageUrl('');
    setItemSizes([]);
    setItemCombos([]);
    setSelectedModifierGroupIds([]);
    setShowItemModal(true);
  };

  // فتح نافذة تعديل صنف
  const handleOpenEditItem = (item: any) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategoryId(item.categoryId);
    setItemDescription(item.description || '');
    setItemBasePrice(item.basePrice.toString());
    setItemImageUrl(item.imageUrl || '');
    setItemSizes(item.sizes ? item.sizes.map((s: any) => ({ name: s.name, price: s.price.toString() })) : []);

    let parsedCombos: any[] = [];
    if (item.comboItems) {
      try {
        const raw = typeof item.comboItems === 'string' ? JSON.parse(item.comboItems) : item.comboItems;
        if (Array.isArray(raw)) {
          parsedCombos = raw.map((c: any, idx: number) => ({
            id: c.id || `combo-${idx}`,
            title: c.title || '',
            description: c.description || '',
            price: c.price !== undefined ? String(c.price) : '',
            badge: c.badge || '',
          }));
        }
      } catch (_e) {
        parsedCombos = [];
      }
    }
    setItemCombos(parsedCombos);

    const linkedIds = item.modifierGroupLinks ? item.modifierGroupLinks.map((link: any) => link.groupId) : [];
    setSelectedModifierGroupIds(linkedIds);
    setShowItemModal(true);
  };

  // رفع صورة للصنف
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await api.uploadImage(file);
      setItemImageUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  // حفظ قسم جديد
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    try {
      await api.createCategory(categoryName.trim());
      setCategoryName('');
      setShowCategoryModal(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة القسم');
    }
  };

  // حذف قسم
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف قسم "${name}" وجميع الأصناف التابعة له؟`)) return;
    try {
      await api.deleteCategory(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل حذف القسم');
    }
  };

  // حفظ صنف (إضافة أو تعديل)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCategoryId || !itemBasePrice) {
      alert('يرجى ملء الحقول المطلوبة (الاسم، القسم، السعر)');
      return;
    }

    try {
      const validCombos = itemCombos
        .filter(c => c.title.trim() && c.price !== '')
        .map((c, idx) => ({
          id: c.id || `combo-${Date.now()}-${idx}`,
          title: c.title.trim(),
          description: c.description.trim(),
          price: parseFloat(c.price) || 0,
          badge: c.badge.trim(),
        }));

      const payload: any = {
        categoryId: itemCategoryId,
        name: itemName.trim(),
        description: itemDescription.trim() || undefined,
        basePrice: parseFloat(itemBasePrice),
        imageUrl: itemImageUrl || undefined,
        comboItems: validCombos.length > 0 ? JSON.stringify(validCombos) : null,
        sizes: itemSizes.filter(s => s.name.trim() && s.price).map(s => ({
          name: s.name.trim(),
          price: parseFloat(s.price),
        })),
        modifierGroupIds: selectedModifierGroupIds,
      };

      if (editingItem) {
        await api.updateItem(editingItem.id, payload);
        // تحديث روابط الإضافات
        await api.linkModifiersToItem(editingItem.id, selectedModifierGroupIds);
      } else {
        await api.createItem(payload);
      }

      setShowItemModal(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الصنف');
    }
  };

  // تبديل حالة توفر الصنف (زر سريع: متوفر / غير متوفر / نفد لفترة)
  const handleToggleAvailability = async (item: any, durationMinutes?: number) => {
    try {
      await api.toggleItemAvailability(item.id, !item.isAvailable, durationMinutes);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة الصنف');
    }
  };

  // حذف صنف
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف صنف "${name}"؟`)) return;
    try {
      await api.deleteItem(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الصنف');
    }
  };

  // نسخ رابط الصنف المباشر
  const handleCopyItemLink = (item: any) => {
    const branchIdentifier = branch?.slug || branch?.id || '';
    const baseUrl = typeof window !== 'undefined' && window.location.origin.includes('onrender.com')
      ? window.location.origin
      : 'https://collage-project-5zby.onrender.com';
    const link = `${baseUrl}/?branch=${encodeURIComponent(branchIdentifier)}&item=${encodeURIComponent(item.id)}`;
    navigator.clipboard.writeText(link);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2500);
  };

  // تصفية الأصناف حسب القسم المختار
  const displayedCategories = activeCategoryId === 'ALL'
    ? categories
    : categories.filter(c => c.id === activeCategoryId);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 flex-1 min-w-0">
          <button
            onClick={() => setActiveCategoryId('ALL')}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center justify-center ${
              activeCategoryId === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            كافة الأقسام
          </button>
          {categories.map(cat => {
            const isActive = activeCategoryId === cat.id;
            return (
              <div
                key={cat.id}
                className={`h-9 flex items-center shrink-0 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <button
                  onClick={() => setActiveCategoryId(cat.id)}
                  className="h-full px-3 text-xs font-bold whitespace-nowrap flex items-center gap-1"
                >
                  <span>{cat.name}</span>
                  <span className={`text-[11px] ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    ({cat.items?.length || 0})
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className={`h-full pl-2.5 pr-1.5 flex items-center justify-center transition-colors border-r ${
                    isActive
                      ? 'border-indigo-500/50 text-indigo-200 hover:text-white'
                      : 'border-slate-200/80 text-slate-400 hover:text-rose-600'
                  }`}
                  title="حذف هذا القسم"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="h-9 flex items-center gap-1.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>إضافة قسم منيو</span>
          </button>
          <button
            onClick={handleOpenAddItem}
            className="h-9 flex items-center gap-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Categories & Items List */}
      {displayedCategories.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100">
          <Layers className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <h4 className="text-lg font-bold text-slate-700">المنيو فارغ حالياً</h4>
          <p className="text-sm">ابدأ بإضافة أول قسم وأول صنف في مطعمك!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {displayedCategories.map(cat => (
            <div key={cat.id} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  <span>{cat.name}</span>
                  <span className="text-xs text-slate-400 font-normal">({cat.items?.length || 0} أصناف)</span>
                </h3>
              </div>

              {/* Items Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border p-4 transition-all shadow-sm flex flex-col justify-between ${
                      item.isAvailable ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Item Top: Image + Info */}
                      <div className="flex gap-3 mb-3">
                        {item.imageUrl ? (
                          <img
                            src={getFullImageUrl(item.imageUrl)}
                            alt={item.name}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-black text-sm text-slate-900">{item.name}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>
                          <div className="text-sm font-black text-indigo-700 mt-1">
                            {item.basePrice} ج.م
                          </div>
                        </div>
                      </div>

                      {/* Sizes info */}
                      {item.sizes && item.sizes.length > 0 && (
                        <div className="mb-2 text-xs flex flex-wrap gap-1">
                          <span className="text-slate-400">الأحجام:</span>
                          {item.sizes.map((s: any) => (
                            <span key={s.id} className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold">
                              {s.name} ({s.price} ج.م)
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Linked Modifiers */}
                      {item.modifierGroupLinks && item.modifierGroupLinks.length > 0 && (
                        <div className="mb-3 text-[11px] flex flex-wrap gap-1">
                          <span className="text-slate-400">الإضافات:</span>
                          {item.modifierGroupLinks.map((link: any) => (
                            <span key={link.id} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">
                              {link.group?.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        {/* Availability Toggle */}
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                            item.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                          }`}
                          title="تبديل حالة التوفر"
                        >
                          {item.isAvailable ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-emerald-600" />
                              <span>متوفر</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-rose-600" />
                              <span>
                                {item.unavailableUntil
                                  ? `نفد مؤقتاً (يعود ${new Date(item.unavailableUntil).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })})`
                                  : 'غير متوفر (نفد)'}
                              </span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyItemLink(item)}
                            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                              copiedItemId === item.id
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                            }`}
                            title="نسخ رابط العرض / الصنف المباشر"
                          >
                            {copiedItemId === item.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Link2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            title="تعديل الصنف"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.isAvailable && (
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          <span className="text-[10px] font-bold text-slate-400">نفد لفترة:</span>
                          {[
                            { label: '30 د', mins: 30 },
                            { label: '1 س', mins: 60 },
                            { label: '2 س', mins: 120 },
                          ].map((p) => (
                            <button
                              key={p.mins}
                              type="button"
                              onClick={() => handleToggleAvailability(item, p.mins)}
                              className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Category */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-800 mb-4">إضافة قسم منيو جديد</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم القسم</label>
                <input
                  type="text"
                  placeholder="مثال: سندوتشات، مقبلات، مشروبات"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow"
                >
                  حفظ القسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Item */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="text-base font-black text-slate-800">
                {editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد إلى المنيو'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم الصنف *</label>
                  <input
                    type="text"
                    placeholder="مثال: برجر دبل تشيز"
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">القسم *</label>
                  <select
                    value={itemCategoryId}
                    onChange={e => setItemCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">الوصف</label>
                <textarea
                  rows={2}
                  placeholder="مكونات الصنف أو تفاصيل الوجبة..."
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">السعر الأساسي (ج.م) *</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="85"
                    value={itemBasePrice}
                    onChange={e => setItemBasePrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">صورة الصنف</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {uploadingImage && <span className="text-[11px] text-indigo-600 block mt-1">جاري الرفع...</span>}
                  {itemImageUrl && (
                    <div className="flex items-center gap-2 mt-2">
                      <img
                        src={getFullImageUrl(itemImageUrl)}
                        alt="معاينة"
                        className="w-10 h-10 rounded-lg object-cover border border-emerald-200"
                      />
                      <span className="text-[11px] text-emerald-600 font-bold">✓ تم رفع الصورة بنجاح</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sizes Section */}
              <div className="border border-slate-200 p-3 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">الأحجام المتاحة (اختياري)</label>
                  <button
                    type="button"
                    onClick={() => setItemSizes([...itemSizes, { name: '', price: '' }])}
                    className="text-[11px] text-indigo-600 hover:underline font-bold"
                  >
                    + إضافة حجم
                  </button>
                </div>
                {itemSizes.map((size, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="اسم الحجم (مثال: كبير)"
                      value={size.name}
                      onChange={e => {
                        const copy = [...itemSizes];
                        copy[sIdx].name = e.target.value;
                        setItemSizes(copy);
                      }}
                      className="flex-1 px-2.5 py-1.5 border rounded-lg text-xs"
                    />
                    <input
                      type="number"
                      placeholder="السعر"
                      value={size.price}
                      onChange={e => {
                        const copy = [...itemSizes];
                        copy[sIdx].price = e.target.value;
                        setItemSizes(copy);
                      }}
                      className="w-24 px-2.5 py-1.5 border rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setItemSizes(itemSizes.filter((_, i) => i !== sIdx))}
                      className="text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Combo / Upsell Offers Section */}
              <div className="border border-amber-200 p-3 rounded-xl bg-amber-50/40">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block">
                      🍟 عروض الكومبو والمكملات المقترحة عند طلب الصنف (اختياري)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      تحكم في العروض التي تظهر للطالب داخل نافذة طلب هذا الصنف (إذا تركتها فارغة لن يظهر أي عرض)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setItemCombos([
                          ...itemCombos,
                          {
                            id: `combo-${Date.now()}`,
                            title: '🍟 + 🥤 عرض كومبو التوفير الجامعي',
                            description: 'أضف بطاطس مقلية ذهبية وكانز بيبسي مثلج مع وجبتك',
                            price: '25',
                            badge: 'توفير 20%',
                          },
                        ])
                      }
                      className="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 py-1 rounded-lg font-bold transition-colors"
                    >
                      ⚡ قالب كومبو سريع
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setItemCombos([
                          ...itemCombos,
                          {
                            id: `combo-${Date.now()}`,
                            title: '',
                            description: '',
                            price: '',
                            badge: '',
                          },
                        ])
                      }
                      className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-bold transition-colors"
                    >
                      + إضافة عرض جديد
                    </button>
                  </div>
                </div>

                {itemCombos.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    لا توجد عروض مضافة لهذا الصنف حالياً. اضغط "+ إضافة عرض جديد" لإظهار عرض خاص للعميل عند اختيار الصنف.
                  </p>
                ) : (
                  <div className="space-y-2.5 mt-2">
                    {itemCombos.map((combo, cIdx) => (
                      <div
                        key={combo.id || cIdx}
                        className="p-2.5 bg-white border border-amber-200 rounded-xl space-y-2 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="اسم العرض (مثال: 🍟 + 🥤 عرض كومبو بطاطس وكانز)"
                            value={combo.title}
                            onChange={e => {
                              const copy = [...itemCombos];
                              copy[cIdx].title = e.target.value;
                              setItemCombos(copy);
                            }}
                            className="flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-bold"
                          />
                          <input
                            type="number"
                            placeholder="السعر (+ج.م)"
                            value={combo.price}
                            onChange={e => {
                              const copy = [...itemCombos];
                              copy[cIdx].price = e.target.value;
                              setItemCombos(copy);
                            }}
                            className="w-24 px-2.5 py-1.5 border rounded-lg text-xs font-bold text-amber-800"
                          />
                          <input
                            type="text"
                            placeholder="شارة (مثال: توفير 20%)"
                            value={combo.badge}
                            onChange={e => {
                              const copy = [...itemCombos];
                              copy[cIdx].badge = e.target.value;
                              setItemCombos(copy);
                            }}
                            className="w-28 px-2.5 py-1.5 border rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setItemCombos(itemCombos.filter((_, i) => i !== cIdx))}
                            className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"
                            title="حذف هذا العرض"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="وصف العرض للعميل (مثال: أضف بطاطس مقلية ذهبية وكانز بيبسي مثلج مع وجبتك)"
                          value={combo.description}
                          onChange={e => {
                            const copy = [...itemCombos];
                            copy[cIdx].description = e.target.value;
                            setItemCombos(copy);
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-slate-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linking Modifier Groups directly to the Item */}
              <div className="border border-slate-200 p-3 rounded-xl bg-slate-50">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  ربط مجموعات الإضافات بهذا الصنف:
                </label>
                {modifierGroups.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    لم تقم بإنشاء مجموعات إضافات بعد. يمكنك إنشاؤها من تبويب "أقسام الإضافات".
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {modifierGroups.map(group => {
                      const isChecked = selectedModifierGroupIds.includes(group.id);
                      return (
                        <label
                          key={group.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedModifierGroupIds([...selectedModifierGroupIds, group.id]);
                              } else {
                                setSelectedModifierGroupIds(selectedModifierGroupIds.filter(id => id !== group.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-0"
                          />
                          <span className="font-bold">{group.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
