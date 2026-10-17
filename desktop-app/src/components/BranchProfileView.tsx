import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Phone, 
  MapPin, 
  DollarSign, 
  CreditCard, 
  ShieldCheck,
  Save,
  CheckCircle,
  Truck,
  ShoppingBag,
  RotateCw,
  AlertCircle,
  Check,
  Smartphone,
  Zap,
  Info,
  Upload,
  Image as ImageIcon,
  Printer,
  Plus,
  Trash2,
  Settings2,
  Clock,
  Calendar,
  Link2,
  Copy
} from 'lucide-react';
import { api, getFullImageUrl } from '../services/api';
import { toast } from '../utils/toast';
import { ConfirmModal } from './ConfirmModal';
import { 
  getAutoPrintEnabled, 
  setAutoPrintEnabled, 
  getPreferredPrinter, 
  setPreferredPrinter, 
  printTestReceipt 
} from '../services/printer';

interface BranchProfileViewProps {
  branch: any;
  onUpdateBranch?: (updatedBranch: any) => void;
}

export const BranchProfileView: React.FC<BranchProfileViewProps> = ({ 
  branch, 
  onUpdateBranch 
}) => {
  // 1. Branch Details States
  const [name, setName] = useState(branch?.name || '');
  const [phone, setPhone] = useState(branch?.phone || '');
  const [address, setAddress] = useState(branch?.address || '');
  const [logoUrl, setLogoUrl] = useState(branch?.logoUrl || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'FIXED' | 'ZONES'>(branch?.deliveryType || 'FIXED');
  const [deliveryFee, setDeliveryFee] = useState<string>(String(branch?.deliveryFee ?? 10));
  const [allowDelivery, setAllowDelivery] = useState<boolean>(branch?.allowDelivery ?? true);
  const [allowPickup, setAllowPickup] = useState<boolean>(branch?.allowPickup ?? true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [copiedBranchLink, setCopiedBranchLink] = useState(false);

  // Delivery Zones Management
  const [deliveryZones, setDeliveryZones] = useState<any[]>(branch?.deliveryZones || []);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneFee, setNewZoneFee] = useState('10');
  const [addingZone, setAddingZone] = useState(false);

  // Thermal Printer Settings
  const [autoPrintEnabled, setAutoPrintState] = useState<boolean>(getAutoPrintEnabled());
  const [printerName, setPrinterNameState] = useState<string>(getPreferredPrinter());
  const [testingPrint, setTestingPrint] = useState(false);
  const [printTestSuccess, setPrintTestSuccess] = useState(false);

  // 2. Payment Methods States
  const p = branch?.paymentConfig;
  const [cashEnabled, setCashEnabled] = useState<boolean>(p?.cashEnabled ?? true);
  const [vodafoneCashEnabled, setVodafoneCashEnabled] = useState<boolean>(p?.vodafoneCashEnabled ?? false);
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState<string>(p?.vodafoneCashNumber || '');
  const [instapayEnabled, setInstapayEnabled] = useState<boolean>(p?.instapayEnabled ?? false);
  const [instapayHandle, setInstapayHandle] = useState<string>(p?.instapayHandle || '');
  const [cardEnabled, setCardEnabled] = useState<boolean>(p?.cardEnabled ?? false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 3. Working Hours & Scheduled Orders States
  const [openingTime, setOpeningTime] = useState<string>(branch?.openingTime || '09:00');
  const [closingTime, setClosingTime] = useState<string>(branch?.closingTime || '23:00');
  const [workingDays, setWorkingDays] = useState<string>(branch?.workingDays || 'السبت - الخميس');
  const [scheduledLeadMins, setScheduledLeadMins] = useState<string>(String(branch?.scheduledLeadMins ?? 20));
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Delivery Zone Delete State
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<{ id: string; name: string } | null>(null);
  const [deletingZone, setDeletingZone] = useState(false);

  // Sync state if branch prop changes
  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setPhone(branch.phone || '');
      setAddress(branch.address || '');
      setLogoUrl(branch.logoUrl || '');
      setDeliveryType(branch.deliveryType || 'FIXED');
      setDeliveryFee(String(branch.deliveryFee ?? 10));
      setAllowDelivery(branch.allowDelivery ?? true);
      setAllowPickup(branch.allowPickup ?? true);
      setDeliveryZones(branch.deliveryZones || []);
      setOpeningTime(branch.openingTime || '09:00');
      setClosingTime(branch.closingTime || '23:00');
      setWorkingDays(branch.workingDays || 'السبت - الخميس');
      setScheduledLeadMins(String(branch.scheduledLeadMins ?? 20));

      const payment = branch.paymentConfig;
      setCashEnabled(payment?.cashEnabled ?? true);
      setVodafoneCashEnabled(payment?.vodafoneCashEnabled ?? false);
      setVodafoneCashNumber(payment?.vodafoneCashNumber || '');
      setInstapayEnabled(payment?.instapayEnabled ?? false);
      setInstapayHandle(payment?.instapayHandle || '');
      setCardEnabled(payment?.cardEnabled ?? false);
    }
  }, [branch]);

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const res = await api.uploadImage(file);
      if (res.url) {
        setLogoUrl(res.url);
        toast.success('تم رفع لوجو المطعم بنجاح');
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل رفع لوجو المطعم');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Adding Delivery Zone
  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;

    try {
      setAddingZone(true);
      const res = await api.addDeliveryZone(newZoneName.trim(), parseFloat(newZoneFee) || 0);
      if (res.zone) {
        setDeliveryZones([...deliveryZones, res.zone]);
        setNewZoneName('');
        setNewZoneFee('10');
        toast.success(`تمت إضافة منطقة التوصيل "${res.zone.name}"`);
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل إضافة منطقة التوصيل');
    } finally {
      setAddingZone(false);
    }
  };

  // Handle Deleting Delivery Zone
  const handleDeleteZone = (zoneId: string, zoneName: string) => {
    setConfirmDeleteZone({ id: zoneId, name: zoneName });
  };

  const handleExecuteDeleteZone = async () => {
    if (!confirmDeleteZone) return;
    try {
      setDeletingZone(true);
      await api.deleteDeliveryZone(confirmDeleteZone.id);
      setDeliveryZones(deliveryZones.filter(z => z.id !== confirmDeleteZone.id));
      toast.success(`تم حذف منطقة "${confirmDeleteZone.name}" بنجاح`);
      setConfirmDeleteZone(null);
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف منطقة التوصيل');
    } finally {
      setDeletingZone(false);
    }
  };

  // Handle Printer Settings
  const handleToggleAutoPrint = (checked: boolean) => {
    setAutoPrintState(checked);
    setAutoPrintEnabled(checked);
  };

  const handlePrinterNameChange = (val: string) => {
    setPrinterNameState(val);
    setPreferredPrinter(val);
  };

  const handleTestPrintReceipt = async () => {
    try {
      setTestingPrint(true);
      setPrintTestSuccess(false);
      await printTestReceipt(name || 'مطعم يونيفود');
      setPrintTestSuccess(true);
      setTimeout(() => setPrintTestSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setTestingPrint(false);
    }
  };

  // Handle Save Branch Details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError(null);
    setDetailsSuccess(false);

    if (!name.trim()) {
      setDetailsError('اسم المطعم مطلوب ولا يمكن تركه فارغاً');
      return;
    }

    try {
      setDetailsLoading(true);
      const res = await api.updateBranchDetails({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        deliveryType,
        deliveryFee: parseFloat(deliveryFee) || 10,
        allowDelivery,
        allowPickup,
      });

      if (res.branch) {
        setDetailsSuccess(true);
        if (onUpdateBranch) onUpdateBranch({ ...res.branch, deliveryZones });
        setTimeout(() => setDetailsSuccess(false), 3500);
      }
    } catch (err: any) {
      setDetailsError(err.message || 'فشل حفظ بيانات المطعم');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Handle Save Payment Methods
  const handleSavePaymentMethods = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentSuccess(false);

    if (vodafoneCashEnabled && !vodafoneCashNumber.trim()) {
      setPaymentError('يرجى إدخال رقم محفظة فودافون كاش ليستقبل عليه الطلاب التحويلات');
      return;
    }

    if (instapayEnabled && !instapayHandle.trim()) {
      setPaymentError('يرجى إدخال معرف إنستاباي (IPA Handle) للمطعم');
      return;
    }

    try {
      setPaymentLoading(true);
      const res = await api.updateBranchPaymentMethods({
        cashEnabled,
        vodafoneCashEnabled,
        vodafoneCashNumber: vodafoneCashNumber.trim() || undefined,
        instapayEnabled,
        instapayHandle: instapayHandle.trim() || undefined,
        cardEnabled,
      });

      if (res.branch) {
        setPaymentSuccess(true);
        if (onUpdateBranch) onUpdateBranch(res.branch);
        setTimeout(() => setPaymentSuccess(false), 3500);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'فشل حفظ طرق الدفع');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle Save Working Hours & Scheduled Order Settings
  const handleSaveWorkingHours = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setHoursLoading(true);
      setHoursError(null);
      setHoursSuccess(false);

      await Promise.all([
        api.updateWorkingHours({ openingTime, closingTime, workingDays }),
        api.updateScheduledLeadMins(parseInt(scheduledLeadMins) || 20),
      ]);

      setHoursSuccess(true);
      if (onUpdateBranch) {
        onUpdateBranch({
          ...branch,
          openingTime,
          closingTime,
          workingDays,
          scheduledLeadMins: parseInt(scheduledLeadMins) || 20,
        });
      }
      setTimeout(() => setHoursSuccess(false), 3500);
    } catch (err: any) {
      setHoursError(err.message || 'فشل حفظ مواعيد العمل');
    } finally {
      setHoursLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img 
              src={getFullImageUrl(logoUrl)} 
              alt={branch?.name} 
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" 
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <Store className="w-8 h-8" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">{branch?.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                branch?.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {branch?.isActive ? 'نشط في المنظومة' : 'موقوف إدارياً'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>{branch?.address || 'داخل الحرم الجامعي'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 text-xs text-slate-600">
            <span className="text-[10px] text-slate-400 block font-bold">حالة الاستقبال:</span>
            <span className="font-black text-slate-900 text-xs">
              {branch?.operationalStatus === 'OPEN' && '🟢 مفتوح'}
              {branch?.operationalStatus === 'BUSY' && '🟡 مغلق مؤقتاً'}
              {branch?.operationalStatus === 'CLOSED' && '🔴 مغلق'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const identifier = branch?.slug || branch?.id || '';
              const url = `https://collage-project-5zby.onrender.com/?branch=${encodeURIComponent(identifier)}`;
              navigator.clipboard.writeText(url);
              setCopiedBranchLink(true);
              setTimeout(() => setCopiedBranchLink(false), 2500);
            }}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
            title="نسخ رابط المطعم المباشر للمشاركة"
          >
            {copiedBranchLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">تم نسخ الرابط!</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-indigo-600" />
                <span>نسخ رابط المطعم 🔗</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Restaurant Operational Details Form */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">بيانات المطعم والتشغيل</h3>
                  <p className="text-[11px] text-slate-400">تعديل اسم الفرع والموقع ورسوم التوصيل</p>
                </div>
              </div>
            </div>

            {detailsError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{detailsError}</span>
              </div>
            )}

            {detailsSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>تم حفظ وتحديث بيانات المطعم بنجاح!</span>
              </div>
            )}

            <form onSubmit={handleSaveDetails} id="details-form" className="space-y-4">
              {/* شعار المطعم / اللوجو */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img 
                      src={getFullImageUrl(logoUrl)} 
                      alt="لوجو المطعم" 
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-white" 
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <span className="block text-xs font-black text-slate-900">لوجو المطعم</span>
                    <span className="text-[11px] text-slate-500">يظهر للطلاب كشعار رسمي لفرعك</span>
                  </div>
                </div>

                <div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingLogo ? 'جاري الرفع...' : (logoUrl ? 'تغيير الشعار' : 'رفع لوجو')}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      disabled={uploadingLogo} 
                      onChange={handleLogoUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المطعم / الفرع *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: كابتن برجر"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موقع الفرع في الحرم الجامعي</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="مثال: مجمع الكليات الطبية - بجوار مبنى ج"
                    className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف الفرع</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

                {/* Delivery Mode Choice */}
                <div className="space-y-3 pt-1">
                  <label className="block text-xs font-bold text-slate-700">نظام تسعير التوصيل للطلاب</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('FIXED')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === 'FIXED'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm ring-2 ring-indigo-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                      <span>سعر موحد ثابت</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('ZONES')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === 'ZONES'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm ring-2 ring-indigo-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>مناطق توصيل مخصصة</span>
                    </button>
                  </div>

                  {deliveryType === 'FIXED' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">قيمة رسوم التوصيل الثابتة (ج.م)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={deliveryFee}
                        onChange={e => setDeliveryFee(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">مناطق الحرم الجامعي وأسعارها ({deliveryZones.length})</span>
                      </div>

                      {/* Existing Zones List */}
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {deliveryZones.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-2">لا توجد مناطق مضافة بعد. أضف المناطق أدناه.</p>
                        ) : (
                          deliveryZones.map(zone => (
                            <div key={zone.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs">
                              <span className="font-bold text-slate-800">{zone.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-indigo-600 font-mono">{zone.fee} ج.م</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteZone(zone.id, zone.name)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="حذف المنطقة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Zone mini-form */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        <input
                          type="text"
                          placeholder="اسم المنطقة (مثال: مبنى طب أسنان)"
                          value={newZoneName}
                          onChange={e => setNewZoneName(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <input
                          type="number"
                          placeholder="السعر"
                          min="0"
                          value={newZoneFee}
                          onChange={e => setNewZoneFee(e.target.value)}
                          className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                        />
                        <button
                          type="button"
                          disabled={addingZone || !newZoneName.trim()}
                          onClick={handleAddZone}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery and Pickup toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    allowDelivery ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Truck className={`w-4 h-4 ${allowDelivery ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-slate-800">التوصيل للمباني</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowDelivery}
                      onChange={e => setAllowDelivery(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                  </label>

                  <label className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    allowPickup ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className={`w-4 h-4 ${allowPickup ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold text-slate-800">الاستلام من الفرع</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowPickup}
                      onChange={e => setAllowPickup(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                  </label>
                </div>
              </form>
            </div>

          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              form="details-form"
              disabled={detailsLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
            >
              {detailsLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ بيانات المطعم</span>
            </button>
          </div>
        </div>

        {/* 2. Payment Methods Management Form */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">طرق الدفع المفعلة للفرع</h3>
                  <p className="text-[11px] text-slate-400">تفعيل أو إيقاف طرق الدفع وكتابة أرقام المحافظ</p>
                </div>
              </div>
            </div>

            {paymentError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{paymentError}</span>
              </div>
            )}

            {paymentSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>تم تحديث طرق الدفع الخاصة بالفرع بنجاح!</span>
              </div>
            )}

            <form onSubmit={handleSavePaymentMethods} id="payment-form" className="space-y-3.5">
              {/* Cash */}
              <div className={`p-4 rounded-2xl border-2 transition-all ${
                cashEnabled ? 'border-emerald-500/80 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">💵</span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">الدفع نقداً (كاش عند الاستلام)</span>
                      <span className="text-[11px] text-slate-500">يدفع الطالب للكاشير أو المندوب عند استلام الوجبة</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashEnabled}
                      onChange={e => setCashEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Vodafone Cash */}
              <div className={`p-4 rounded-2xl border-2 transition-all space-y-2.5 ${
                vodafoneCashEnabled ? 'border-rose-500/80 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-5 h-5 text-rose-600" />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">فودافون كاش ومحافظ الهاتف</span>
                      <span className="text-[11px] text-slate-500">تحويل المبلغ لمحفظة المطعم المحددة</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vodafoneCashEnabled}
                      onChange={e => setVodafoneCashEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>

                {vodafoneCashEnabled && (
                  <div className="pt-1 animate-fadeIn">
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      رقم محفظة كاش الخاصة بالمطعم (يظهر للطلاب أثناء الطلب):
                    </label>
                    <input
                      type="tel"
                      required={vodafoneCashEnabled}
                      value={vodafoneCashNumber}
                      onChange={e => setVodafoneCashNumber(e.target.value)}
                      placeholder="مثال: 01012345678"
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-mono font-bold text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* InstaPay */}
              <div className={`p-4 rounded-2xl border-2 transition-all space-y-2.5 ${
                instapayEnabled ? 'border-indigo-500/80 bg-indigo-50/30' : 'border-slate-200 bg-slate-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-5 h-5 text-indigo-600" />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">إنستاباي (InstaPay)</span>
                      <span className="text-[11px] text-slate-500">تحويل فوري عبر الحساب البنكي أو عنوان الدفع اللحظي</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={instapayEnabled}
                      onChange={e => setInstapayEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {instapayEnabled && (
                  <div className="pt-1 animate-fadeIn">
                    <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                      معرف إنستاباي IPA للمطعم (مثال: restaurant@instapay):
                    </label>
                    <input
                      type="text"
                      required={instapayEnabled}
                      value={instapayHandle}
                      onChange={e => setInstapayHandle(e.target.value)}
                      placeholder="restaurant@instapay"
                      className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Card */}
              <div className={`p-4 rounded-2xl border-2 transition-all ${
                cardEnabled ? 'border-sky-500/80 bg-sky-50/30' : 'border-slate-200 bg-slate-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-5 h-5 text-sky-600" />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">الدفع ببطاقات فيزا / ماستركارد</span>
                      <span className="text-[11px] text-slate-500">بوابة الدفع الإلكتروني المباشر</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardEnabled}
                      onChange={e => setCardEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
            </form>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              form="payment-form"
              disabled={paymentLoading}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95 flex items-center gap-2"
            >
              {paymentLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ طرق الدفع</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. Thermal Printer & POS Settings Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">إعدادات الطابعة الحرارية وطباعة البونات (Thermal POS)</h3>
              <p className="text-xs text-slate-400">تحكم في الطباعة التلقائية فور قبول الطلبات واختبر جاهزية الطابعة</p>
            </div>
          </div>

          <button
            type="button"
            disabled={testingPrint}
            onClick={handleTestPrintReceipt}
            className="px-4 py-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 self-start sm:self-auto shadow-sm"
          >
            <Printer className={`w-4 h-4 ${testingPrint ? 'animate-bounce text-indigo-600' : ''}`} />
            <span>{testingPrint ? 'جاري إرسال أمر الطباعة...' : 'طباعة بون تجريبي (Test)'}</span>
          </button>
        </div>

        {printTestSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>تم إرسال بون التجربة بنجاح إلى أمر طباعة الجهاز!</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auto-print toggle */}
          <div className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
            autoPrintEnabled ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900">الطباعة التلقائية للبون</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">موصى بها</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                طباعة بون المطبخ مباشرة وبشكل فوري عند الضغط على "قبول وبدء التجهيز"
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 mr-3">
              <input
                type="checkbox"
                checked={autoPrintEnabled}
                onChange={e => handleToggleAutoPrint(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Printer Selection / Name */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/50 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              طابعة البونات الحرارية (80mm / 58mm):
            </label>
            <input
              type="text"
              value={printerName}
              onChange={e => handlePrinterNameChange(e.target.value)}
              placeholder="مثال: Xprinter XP-80C أو Default Thermal Printer"
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <span className="text-[10px] text-slate-400 block">
              💡 البرنامج يستخدم حوار الطباعة المباشر لنظام Windows أو الطابعة المحددة افتراضياً.
            </span>
          </div>
        </div>
      </div>

      {/* 4. Official Working Hours & Scheduled Orders Settings Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">مواعيد العمل الرسمية والطلب المسبق (بريك المحاضرات)</h3>
              <p className="text-xs text-slate-400">تحديد أوقات عمل الفرع التي تظهر للطلاب ومهلة تجهيز الطلبات المحجوزة</p>
            </div>
          </div>
        </div>

        {hoursError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{hoursError}</span>
          </div>
        )}

        {hoursSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ مواعيد العمل وإعدادات الطلب المسبق بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSaveWorkingHours} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Opening Time */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">موعد بدء العمل اليومي (الفتح):</label>
              <input
                type="time"
                value={openingTime}
                onChange={e => setOpeningTime(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                required
              />
            </div>

            {/* Closing Time */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">موعد انتهاء العمل اليومي (الإغلاق):</label>
              <input
                type="time"
                value={closingTime}
                onChange={e => setClosingTime(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                required
              />
            </div>

            {/* Working Days */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">أيام العمل الأسبوعية:</label>
              <input
                type="text"
                value={workingDays}
                onChange={e => setWorkingDays(e.target.value)}
                placeholder="مثال: السبت - الخميس"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                required
              />
            </div>

            {/* Scheduled Lead Time in minutes */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">مهلة التجهيز قبل موعد الحجز (بالدقائق):</label>
              <input
                type="number"
                min="5"
                max="120"
                value={scheduledLeadMins}
                onChange={e => setScheduledLeadMins(e.target.value)}
                placeholder="20"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                required
              />
              <span className="text-[10px] text-slate-400 block">
                تظهر الطلبات المحجوزة للمطبخ قبل موعد الاستلام بهذه المهلة.
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={hoursLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
            >
              {hoursLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ مواعيد العمل والطلب المسبق</span>
            </button>
          </div>
        </form>
      </div>

      {/* تأكيد حذف منطقة التوصيل */}
      <ConfirmModal
        isOpen={!!confirmDeleteZone}
        title="حذف منطقة توصيل"
        message={`هل أنت متأكد من حذف منطقة التوصيل "${confirmDeleteZone?.name}"؟`}
        confirmText="نعم، احذف المنطقة"
        cancelText="إلغاء"
        variant="danger"
        loading={deletingZone}
        onConfirm={handleExecuteDeleteZone}
        onClose={() => !deletingZone && setConfirmDeleteZone(null)}
      />
    </div>
  );
};
