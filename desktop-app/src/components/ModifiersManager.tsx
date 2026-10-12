import React, { useState } from 'react';
import { Plus, Trash2, Edit, Check, X, ToggleLeft, ToggleRight, Sliders } from 'lucide-react';
import { api } from '../services/api';

interface ModifiersManagerProps {
  modifierGroups: any[];
  onRefresh: () => void;
}

export const ModifiersManager: React.FC<ModifiersManagerProps> = ({ modifierGroups, onRefresh }) => {
  // New Group Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [minSelection, setMinSelection] = useState('0');
  const [maxSelection, setMaxSelection] = useState('1');

  // New Option Modal
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [optionName, setOptionName] = useState('');
  const [optionPrice, setOptionPrice] = useState('');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;

    try {
      await api.createModifierGroup({
        title: groupTitle.trim(),
        isRequired,
        minSelection: parseInt(minSelection) || 0,
        maxSelection: parseInt(maxSelection) || 1,
      });

      setGroupTitle('');
      setIsRequired(false);
      setMinSelection('0');
      setMaxSelection('1');
      setShowGroupModal(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل إنشاء مجموعة الإضافات');
    }
  };

  const handleDeleteGroup = async (id: string, title: string) => {
    if (!confirm(`هل أنت متأكد من حذف مجموعة "${title}"؟`)) return;
    try {
      await api.deleteModifierGroup(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل حذف المجموعة');
    }
  };

  const handleCreateOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroupId || !optionName.trim()) return;

    try {
      await api.addModifierOption(targetGroupId, {
        name: optionName.trim(),
        price: parseFloat(optionPrice) || 0,
      });

      setOptionName('');
      setOptionPrice('');
      setShowOptionModal(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة خيار الإضافة');
    }
  };

  const handleToggleOption = async (option: any) => {
    try {
      await api.updateModifierOption(option.id, {
        isAvailable: !option.isAvailable,
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة الإضافة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-black text-slate-800">أقسام ومجموعات الإضافات (Modifiers)</h3>
          <p className="text-xs text-slate-500">
            أنشئ خيارات وإضافات الأصناف (مثل: الصوصات، أنواع الجبن، الإضافات الجانبية) واربطها بالصنف
          </p>
        </div>
        <button
          onClick={() => setShowGroupModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء قسم إضافات جديد</span>
        </button>
      </div>

      {/* Groups Grid */}
      {modifierGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100">
          <Sliders className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <h4 className="text-lg font-bold text-slate-700">لا توجد أقسام إضافات بعد</h4>
          <p className="text-sm">أنشئ أول قسم إضافات مثل "إضافات صوص" أو "إضافات جبن"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modifierGroups.map(group => (
            <div
              key={group.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{group.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        group.isRequired ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {group.isRequired ? 'إجباري الاختيار' : 'اختياري'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        الحد الأقصى: {group.maxSelection}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(group.id, group.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Options List */}
                <div className="space-y-2 mb-4">
                  <div className="text-[11px] font-bold text-slate-400">الخيارات المتاحة ({group.options?.length || 0}):</div>
                  {group.options?.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-2 bg-slate-50 rounded-lg">
                      لم يتم إضافة أصناف داخل هذا القسم بعد
                    </div>
                  ) : (
                    group.options?.map((opt: any) => (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs border ${
                          opt.isAvailable ? 'bg-slate-50 border-slate-100' : 'bg-rose-50/50 border-rose-100 opacity-70'
                        }`}
                      >
                        <span className="font-bold text-slate-800">{opt.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-700 font-black">+{opt.price} ج.م</span>
                          <button
                            onClick={() => handleToggleOption(opt)}
                            className="p-0.5 text-slate-400 hover:text-slate-600"
                            title={opt.isAvailable ? 'متوفر' : 'غير متوفر'}
                          >
                            {opt.isAvailable ? (
                              <ToggleRight className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-rose-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Option inside this Group */}
              <button
                onClick={() => {
                  setTargetGroupId(group.id);
                  setOptionName('');
                  setOptionPrice('');
                  setShowOptionModal(true);
                }}
                className="w-full py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-dashed border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خيار داخل هذا القسم</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Modifier Group */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-800 mb-4">إنشاء قسم إضافات جديد</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">عنوان القسم *</label>
                <input
                  type="text"
                  placeholder="مثال: إضافات صوص، إضافات جبن"
                  value={groupTitle}
                  onChange={e => setGroupTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reqCheckbox"
                  checked={isRequired}
                  onChange={e => setIsRequired(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="reqCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  اختيار إجباري (يجب على العميل الاختيار)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الحد الأدنى</label>
                  <input
                    type="number"
                    min="0"
                    value={minSelection}
                    onChange={e => setMinSelection(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الحد الأقصى</label>
                  <input
                    type="number"
                    min="1"
                    value={maxSelection}
                    onChange={e => setMaxSelection(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow"
                >
                  إنشاء القسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Option */}
      {showOptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-800 mb-4">إضافة خيار جديد</h3>
            <form onSubmit={handleCreateOption} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الإضافة *</label>
                <input
                  type="text"
                  placeholder="مثال: صوص باربيكيو، موتزاريلا إضافية"
                  value={optionName}
                  onChange={e => setOptionName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">السعر الإضافي (ج.م)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0 للمجاني أو 15"
                  value={optionPrice}
                  onChange={e => setOptionPrice(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowOptionModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow"
                >
                  إضافة الخيار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
