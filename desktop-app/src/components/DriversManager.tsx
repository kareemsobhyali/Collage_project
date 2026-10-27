import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Edit3, 
  User, 
  Phone, 
  Lock, 
  Check, 
  X, 
  AlertCircle, 
  RotateCw,
  Power,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

interface DriversManagerProps {
  onClose?: () => void;
}

export const DriversManager: React.FC<DriversManagerProps> = ({ onClose }) => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDeleteDriver, setConfirmDeleteDriver] = useState<{ id: string; name: string } | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDrivers();
      setDrivers(data || []);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل قائمة الطيارين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const resetForm = () => {
    setName('');
    setPhone('');
    setUsername('');
    setPassword('');
    setEditingId(null);
    setIsAdding(false);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !username.trim()) {
      setFormError('يرجى تعبئة كافة الحقول المطلوبة');
      return;
    }

    if (!editingId && !password) {
      setFormError('يرجى إدخال كلمة المرور للطيار');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      if (editingId) {
        const updateData: any = { name: name.trim(), phone: phone.trim(), username: username.trim() };
        if (password) updateData.password = password;
        await api.updateDriver(editingId, updateData);
        setSuccessMessage('تم تحديث بيانات الطيار بنجاح');
      } else {
        await api.createDriver({
          name: name.trim(),
          phone: phone.trim(),
          username: username.trim(),
          password,
        });
        setSuccessMessage('تمت إضافة الطيار بنجاح');
      }

      resetForm();
      fetchDrivers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'فشل حفظ بيانات الطيار');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (driver: any) => {
    if (driver.isGeneralDriver) {
      setFormError('لا يمكن تعديل حالة الطيار العام من فرع منفرد (تتم إدارته عبر لوحة الإدارة العامة)');
      return;
    }
    try {
      await api.updateDriver(driver.id, { isActive: !driver.isActive });
      fetchDrivers();
    } catch (err: any) {
      setFormError(err.message || 'فشل تغيير حالة الطيار');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteDriver) return;
    const { id } = confirmDeleteDriver;
    setConfirmDeleteDriver(null);
    try {
      await api.deleteDriver(id);
      setSuccessMessage('تم حذف الطيار بنجاح');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchDrivers();
    } catch (err: any) {
      setFormError(err.message || 'فشل حذف الطيار');
    }
  };

  const startEdit = (driver: any) => {
    if (driver.isGeneralDriver) {
      setFormError('لا يمكن تعديل بيانات الطيار العام من فرع منفرد');
      return;
    }
    setEditingId(driver.id);
    setName(driver.name);
    setPhone(driver.phone);
    setUsername(driver.username);
    setPassword('');
    setIsAdding(true);
    setFormError(null);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 truncate">فريق كباتن التوصيل (الطيارين)</h2>
            <p className="text-xs text-slate-500">إدارة حسابات الطيارين وإسناد طلبات التوصيل لهم</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {!isAdding && (
            <button
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="h-9 flex items-center gap-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>إضافة كابتن توصيل جديد</span>
            </button>
          )}

          <button
            onClick={fetchDrivers}
            className="w-9 h-9 flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors shrink-0"
            title="تحديث"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Add / Edit Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-black text-sm text-slate-800">
              {editingId ? 'تعديل بيانات الطيار' : 'تسجيل كابتن توصيل جديد'}
            </h3>
            <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600">
              إلغاء
            </button>
          </div>

          {formError && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1">اسم الكابتن *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">رقم الهاتف *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">اسم المستخدم للدخول (Username) *</label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ahmed_driver"
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">
                كلمة المرور {editingId ? '(اتركها فارغة للإبقاء)' : '*'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  required={!editingId}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
            >
              {submitting ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة الطيار'}
            </button>
          </div>
        </form>
      )}

      {/* Drivers List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          <RotateCw className="w-6 h-6 mx-auto animate-spin mb-2" />
          <span>جاري تحميل بيانات كباتن التوصيل...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchDrivers} className="underline text-indigo-600">إعادة المحاولة</button>
        </div>
      ) : drivers.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-2">
          <Truck className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">لم تقم بإضافة أي طيارين بعد</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            أضف طياري الدليفري الخاصين بمطعمك لتمكينهم من تسجيل الدخول واستلام ومتابعة طلبات التوصيل.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className={`p-4 rounded-2xl border transition-all ${
                driver.isActive
                  ? 'bg-white border-slate-200 shadow-xs hover:shadow-md'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    driver.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {driver.name.substring(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-black text-slate-800 text-sm truncate">{driver.name}</h4>
                      {driver.isGeneralDriver && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 whitespace-nowrap">
                          طيار عام
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 block truncate">@{driver.username}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  driver.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {driver.isActive ? 'نشط ومتاح' : 'معطل'}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shrink-0" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{driver.phone}</span>
                </div>

                {driver.isGeneralDriver ? (
                  <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200 flex items-center gap-1 shrink-0" title="كابتن توصيل معتمد مشترك بين المطاعم ويتم التحكم في حسابه من لوحة تحكم الإدارة">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>كابتن معتمد</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(driver)}
                      className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
                        driver.isActive
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                      title={driver.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => startEdit(driver)}
                      className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                      title="تعديل"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setConfirmDeleteDriver({ id: driver.id, name: driver.name })}
                      className="p-1.5 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Driver Custom Confirmation Modal */}
      {confirmDeleteDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md shadow-rose-500/20">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">تأكيد حذف كابتن التوصيل</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف الطيار <span className="font-black text-slate-800">"{confirmDeleteDriver.name}"</span> من قائمة طياري فرعك؟
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDriver(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md shadow-rose-600/25 transition-all active:scale-95"
              >
                نعم، تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
