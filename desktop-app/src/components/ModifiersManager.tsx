import React, { useState } from 'react';
import { Plus, Trash2, Edit, Check, X, ToggleLeft, ToggleRight, Sliders, Tag, AlertCircle, Layers } from 'lucide-react';
import { api } from '../services/api';
import { toast } from '../utils/toast';
import { ConfirmModal } from './ConfirmModal';
import { useLockBodyScroll } from '../utils/scrollLock';

interface ModifiersManagerProps {
  modifierGroups: any[];
  onRefresh: () => void;
}

export const ModifiersManager: React.FC<ModifiersManagerProps> = ({ modifierGroups, onRefresh }) => {
  // Group Modal (Create or Edit)
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [minSelection, setMinSelection] = useState('0');
  const [maxSelection, setMaxSelection] = useState('1');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);

  // Option Modal (Create or Edit)
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [optionName, setOptionName] = useState('');
  const [optionPrice, setOptionPrice] = useState('');
  const [optionError, setOptionError] = useState<string | null>(null);
  const [submittingOption, setSubmittingOption] = useState(false);

  // Delete Group State
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{ id: string; title: string } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Delete Option State
  const [confirmDeleteOption, setConfirmDeleteOption] = useState<{ id: string; name: string } | null>(null);
  const [deletingOption, setDeletingOption] = useState(false);

  // Lock background scroll when any modal is active
  useLockBodyScroll(showGroupModal || showOptionModal || !!confirmDeleteGroup || !!confirmDeleteOption);

  const handleOpenCreateGroup = () => {
    setEditingGroupId(null);
    setGroupTitle('');
    setIsRequired(false);
    setMinSelection('0');
    setMaxSelection('1');
    setGroupError(null);
    setShowGroupModal(true);
  };

  const handleStartEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setGroupTitle(group.title);
    setIsRequired(group.isRequired || false);
    setMinSelection(String(group.minSelection ?? 0));
    setMaxSelection(String(group.maxSelection ?? 1));
    setGroupError(null);
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) {
      setGroupError('يرجى كتابة عنوان أو اسم القسم الإضافي');
      return;
    }

    try {
      setSubmittingGroup(true);
      setGroupError(null);

      const payload = {
        title: groupTitle.trim(),
        isRequired,
        minSelection: parseInt(minSelection, 10) || 0,
        maxSelection: parseInt(maxSelection, 10) || 1,
      };

      if (editingGroupId) {
        await api.updateModifierGroup(editingGroupId, payload);
        toast.success(`تم تحديث قسم "${groupTitle.trim()}" بنجاح`);
      } else {
        await api.createModifierGroup(payload);
        toast.success(`تم إنشاء قسم "${groupTitle.trim()}" بنجاح`);
      }

      setShowGroupModal(false);
      setEditingGroupId(null);
      setGroupTitle('');
      onRefresh();
    } catch (err: any) {
      setGroupError(err.message || 'فشل حفظ مجموعة الإضافات');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = (id: string, title: string) => {
    setConfirmDeleteGroup({ id, title });
  };

  const handleExecuteDeleteGroup = async () => {
    if (!confirmDeleteGroup) return;
    try {
      setDeletingGroup(true);
      await api.deleteModifierGroup(confirmDeleteGroup.id);
      toast.success(`تم حذف مجموعة "${confirmDeleteGroup.title}" بنجاح`);
      setConfirmDeleteGroup(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف المجموعة');
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleOpenCreateOption = (groupId: string) => {
    setEditingOptionId(null);
    setTargetGroupId(groupId);
    setOptionName('');
    setOptionPrice('');
    setOptionError(null);
    setShowOptionModal(true);
  };

  const handleStartEditOption = (opt: any, groupId: string) => {
    setEditingOptionId(opt.id);
    setTargetGroupId(groupId);
    setOptionName(opt.name);
    setOptionPrice(String(opt.price ?? 0));
    setOptionError(null);
    setShowOptionModal(true);
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optionName.trim()) {
      setOptionError('يرجى كتابة اسم الإضافة أو الخيار');
      return;
    }

    try {
      setSubmittingOption(true);
      setOptionError(null);

      const parsedPrice = parseFloat(optionPrice) || 0;

      if (editingOptionId) {
        await api.updateModifierOption(editingOptionId, {
          name: optionName.trim(),
          price: parsedPrice,
        });
        toast.success(`تم تحديث خيار "${optionName.trim()}" بنجاح`);
      } else {
        if (!targetGroupId) return;
        await api.addModifierOption(targetGroupId, {
          name: optionName.trim(),
          price: parsedPrice,
        });
        toast.success(`تمت إضافة الخيار "${optionName.trim()}" بنجاح`);
      }

      setShowOptionModal(false);
      setEditingOptionId(null);
      setOptionName('');
      setOptionPrice('');
      onRefresh();
    } catch (err: any) {
      setOptionError(err.message || 'فشل حفظ خيار الإضافة');
    } finally {
      setSubmittingOption(false);
    }
  };

  const handleExecuteDeleteOption = async () => {
    if (!confirmDeleteOption) return;
    try {
      setDeletingOption(true);
      await api.deleteModifierOption(confirmDeleteOption.id);
      toast.success(`تم حذف خيار "${confirmDeleteOption.name}" بنجاح`);
      setConfirmDeleteOption(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف خيار الإضافة');
    } finally {
      setDeletingOption(false);
    }
  };

  const handleToggleOption = async (option: any) => {
    try {
      await api.updateModifierOption(option.id, {
        isAvailable: !option.isAvailable,
      });
      toast.info(option.isAvailable ? `تم إيقاف تفعيل "${option.name}"` : `تم تفعيل "${option.name}"`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'فشل تعديل حالة الإضافة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-800">أقسام ومجموعات الإضافات (Modifiers)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            أنشئ وعدّل خيارات وإضافات الأصناف (مثل: الصوصات، أنواع الجبن، الإضافات الجانبية) واربطها بالصنف
          </p>
        </div>
        <button
          onClick={handleOpenCreateGroup}
          className="h-9 flex items-center gap-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4 shrink-0" />
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEditGroup(group)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                      title="تعديل اسم وشروط القسم"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="حذف القسم"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-indigo-700 font-black ml-1">+{opt.price} ج.م</span>
                          <button
                            onClick={() => handleToggleOption(opt)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            title={opt.isAvailable ? 'متوفر' : 'غير متوفر'}
                          >
                            {opt.isAvailable ? (
                              <ToggleRight className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-rose-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleStartEditOption(opt, group.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="تعديل خيار الإضافة"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteOption({ id: opt.id, name: opt.name })}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف خيار الإضافة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Option inside this Group */}
              <button
                onClick={() => handleOpenCreateOption(group.id)}
                className="w-full py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-dashed border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خيار داخل هذا القسم</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create or Edit Modifier Group */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">
                    {editingGroupId ? 'تعديل قسم الإضافات' : 'إنشاء قسم إضافات جديد'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingGroupId ? 'تعديل الاسم والحد الأدنى والأقصى للاختيار' : 'تحديد اسم المجموعة وشروط الاختيار'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroupId(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} noValidate className="space-y-4">
              {groupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{groupError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان أو اسم القسم *</label>
                <input
                  type="text"
                  placeholder="مثال: إضافات صوص، إضافات جبن"
                  value={groupTitle}
                  onChange={e => {
                    setGroupTitle(e.target.value);
                    if (groupError) setGroupError(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer" onClick={() => setIsRequired(!isRequired)}>
                <input
                  type="checkbox"
                  id="reqCheckbox"
                  checked={isRequired}
                  onChange={e => setIsRequired(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <label htmlFor="reqCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  اختيار إجباري (يجب على العميل الاختيار)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأدنى</label>
                  <input
                    type="number"
                    min="0"
                    value={minSelection}
                    onChange={e => setMinSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى</label>
                  <input
                    type="number"
                    min="1"
                    value={maxSelection}
                    onChange={e => setMaxSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupModal(false);
                    setEditingGroupId(null);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingGroup}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 text-center"
                >
                  {submittingGroup
                    ? (editingGroupId ? 'جاري الحفظ...' : 'جاري الإنشاء...')
                    : (editingGroupId ? 'حفظ التعديلات' : 'إنشاء القسم')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Option */}
      {showOptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">
                    {editingOptionId ? 'تعديل خيار الإضافة' : 'إضافة خيار جديد'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingOptionId ? 'تعديل اسم أو سعر الإضافة المحددة' : 'إضافة صوص أو نكهة أو مكون إضافي'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOptionModal(false);
                  setEditingOptionId(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOption} noValidate className="space-y-4">
              {optionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{optionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الإضافة *</label>
                <input
                  type="text"
                  placeholder="مثال: صوص باربيكيو، موتزاريلا إضافية"
                  value={optionName}
                  onChange={e => {
                    setOptionName(e.target.value);
                    if (optionError) setOptionError(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السعر الإضافي (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0 للمجاني أو 15"
                  value={optionPrice}
                  onChange={e => setOptionPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionModal(false);
                    setEditingOptionId(null);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingOption}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 text-center"
                >
                  {submittingOption
                    ? (editingOptionId ? 'جاري التعديل...' : 'جاري الإضافة...')
                    : (editingOptionId ? 'حفظ التعديلات' : 'إضافة الخيار')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* تأكيد حذف قسم الإضافات */}
      <ConfirmModal
        isOpen={!!confirmDeleteGroup}
        title="حذف قسم إضافات"
        message={`هل أنت متأكد من حذف قسم "${confirmDeleteGroup?.title}"؟ سيتم حذف جميع الخيارات المرتبطة به وفك ارتباطه بكافة الأصناف.`}
        confirmText="نعم، احذف القسم"
        cancelText="إلغاء"
        variant="danger"
        loading={deletingGroup}
        onConfirm={handleExecuteDeleteGroup}
        onClose={() => !deletingGroup && setConfirmDeleteGroup(null)}
      />

      {/* تأكيد حذف خيار الإضافة */}
      <ConfirmModal
        isOpen={!!confirmDeleteOption}
        title="حذف خيار الإضافة"
        message={`هل أنت متأكد من حذف خيار "${confirmDeleteOption?.name}" من هذا القسم نهائياً؟`}
        confirmText="نعم، احذف الخيار"
        cancelText="إلغاء"
        variant="danger"
        loading={deletingOption}
        onConfirm={handleExecuteDeleteOption}
        onClose={() => !deletingOption && setConfirmDeleteOption(null)}
      />
    </div>
  );
};
