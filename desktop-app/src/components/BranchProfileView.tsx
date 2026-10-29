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
  Copy,
  Lock,
  Receipt,
  UserX,
  Unlock,
  Search,
  Users
} from 'lucide-react';
import { api, getFullImageUrl, getPublicWebUrl } from '../services/api';
import { toast } from '../utils/toast';
import { cleanAddressText, getDisplayAddress, cleanZoneName } from '../utils/address';
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
  const [address, setAddress] = useState(cleanAddressText(branch?.address) || '');
  const [logoUrl, setLogoUrl] = useState(branch?.logoUrl || '');
  const [logoError, setLogoError] = useState(false);
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
  const [requirePaymentProof, setRequirePaymentProof] = useState<boolean>(p?.requirePaymentProof ?? true);
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

  // 4. Blocked Customers State
  interface BlockedCustomerItem {
    id: string;
    userId: string;
    name: string;
    phone: string;
    notes?: string | null;
    blockedAt: string;
    orderCount: number;
  }
  const [blockedCustomers, setBlockedCustomers] = useState<BlockedCustomerItem[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [blockedSearchQuery, setBlockedSearchQuery] = useState('');
  const [confirmUnblockUser, setConfirmUnblockUser] = useState<BlockedCustomerItem | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  const fetchBlockedCustomers = async () => {
    try {
      setLoadingBlocked(true);
      const data = await api.getBlockedCustomers();
      setBlockedCustomers(data || []);
    } catch (err: any) {
      console.error('Failed to fetch blocked customers:', err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    fetchBlockedCustomers();
  }, []);

  const handleExecuteUnblock = async () => {
    if (!confirmUnblockUser) return;
    try {
      setUnblockingUserId(confirmUnblockUser.userId);
      await api.unblockCustomer(confirmUnblockUser.userId);
      toast.success(`تم إلغاء الحظر عن العميل "${confirmUnblockUser.name}" بنجاح! يمكنه الطلب من الفرع الآن.`);
      setBlockedCustomers(prev => prev.filter(c => c.userId !== confirmUnblockUser.userId));
      setConfirmUnblockUser(null);
    } catch (err: any) {
      toast.error(err.message || 'فشل إلغاء حظر العميل');
    } finally {
      setUnblockingUserId(null);
    }
  };

  // Delivery Zone Delete State
  const [confirmDeleteZone, setConfirmDeleteZone] = useState<{ id: string; name: string } | null>(null);
  const [deletingZone, setDeletingZone] = useState(false);

  // Sync state if branch prop changes
  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setPhone(branch.phone || '');
      setAddress(cleanAddressText(branch.address) || '');
      setLogoUrl(branch.logoUrl || '');
      setLogoError(false);
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
      setRequirePaymentProof(payment?.requirePaymentProof ?? true);
    }
  }, [branch]);

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const res = await api.uploadImage(file);
      const targetUrl = res.fileUrl || res.url;
      if (targetUrl) {
        setLogoUrl(targetUrl);
        setLogoError(false);
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
      // الحفاظ على إحداثيات GPS إن وجدت مسبقاً دون إظهارها في حقل التعديل
      const existingCoordsMatch = branch?.address?.match(/\[GPS:[0-9.-]+,[0-9.-]+\]/);
      let finalAddress = cleanAddressText(address).trim();
      if (existingCoordsMatch && finalAddress) {
        finalAddress = `${existingCoordsMatch[0]} ${finalAddress}`;
      } else if (!finalAddress && existingCoordsMatch) {
        finalAddress = existingCoordsMatch[0];
      }

      const res = await api.updateBranchDetails({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: finalAddress || undefined,
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

    try {
      setPaymentLoading(true);
      const res = await api.updateBranchPaymentMethods({
        cashEnabled: true, // الدفع كاش إجباري دائم في كل المطاعم
        vodafoneCashEnabled,
        instapayEnabled,
        cardEnabled,
        requirePaymentProof,
      });

      if (res.branch) {
        setPaymentSuccess(true);
        if (onUpdateBranch) onUpdateBranch(res.branch);
        setTimeout(() => setPaymentSuccess(false), 3500);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'فشل تحديث طرق الدفع');
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
          {logoUrl && !logoError ? (
            <img 
              src={getFullImageUrl(logoUrl)} 
              alt={branch?.name} 
              onError={() => setLogoError(true)}
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
              <span>{getDisplayAddress(branch?.address, 'عنوان الفرع')}</span>
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
              const url = `${getPublicWebUrl()}/?branch=${encodeURIComponent(identifier)}`;
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
                  {logoUrl && !logoError ? (
                    <img 
                      src={getFullImageUrl(logoUrl)} 
                      alt="لوجو المطعم" 
                      onError={() => setLogoError(true)}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 bg-white" 
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <span className="block text-xs font-black text-slate-900">لوجو المطعم</span>
                    <span className="text-[11px] text-slate-500">يظهر للعملاء كشعار رسمي لفرعك</span>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">موقع الفرع بالتحديد</label>
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
                  <label className="block text-xs font-bold text-slate-700">نظام تسعير التوصيل للعملاء</label>
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
                        <span className="text-xs font-black text-slate-800">مناطق وأحياء التوصيل وأسعارها ({deliveryZones.length})</span>
                      </div>

                      {/* Existing Zones List */}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {deliveryZones.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-2.5">لا توجد مناطق مضافة بعد. أضف المناطق أدناه.</p>
                        ) : (
                          deliveryZones.map(zone => (
                            <div key={zone.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs gap-3 shadow-2xs hover:border-slate-300 transition-all">
                              <span className="font-bold text-slate-800 truncate min-w-0 flex-1" title={cleanZoneName(zone.name)}>
                                {cleanZoneName(zone.name)}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-black text-indigo-600 font-mono px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs whitespace-nowrap">
                                  {zone.fee} ج.م
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteZone(zone.id, cleanZoneName(zone.name))}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
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
                      <div className="flex items-center gap-2 pt-2.5 border-t border-slate-200">
                        <input
                          type="text"
                          placeholder="اسم المنطقة (مثال: مبنى طب أسنان)"
                          value={newZoneName}
                          onChange={e => setNewZoneName(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        />
                        <div className="relative w-20 shrink-0">
                          <input
                            type="number"
                            placeholder="السعر"
                            min="0"
                            value={newZoneFee}
                            onChange={e => setNewZoneFee(e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={addingZone || !newZoneName.trim()}
                          onClick={handleAddZone}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0 flex items-center justify-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                          title="إضافة منطقة جديدة"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">إضافة</span>
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
              {/* Cash - إجباري دائم */}
              <div className="p-4 rounded-2xl border border-emerald-200/90 bg-emerald-50/25 transition-all shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xl shrink-0">💵</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">الدفع نقداً (كاش عند الاستلام)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200/70 inline-flex items-center gap-1 shadow-2xs">
                          <Lock className="w-2.5 h-2.5" />
                          <span>إجباري دائم</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        الدفع كاش متاح دائماً وإجباري لجميع المطاعم ولا يمكن إيقافه
                      </span>
                    </div>
                  </div>
                  <div
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed opacity-85 rounded-full border-2 border-transparent bg-emerald-600 transition-colors"
                    dir="ltr"
                    title="الدفع كاش إجباري دائم في النظام"
                  >
                    <span className="inline-block h-5 w-5 transform translate-x-5 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Vodafone Cash */}
              <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                vodafoneCashEnabled ? 'border-rose-200 bg-rose-50/20 shadow-2xs' : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 block truncate">فودافون كاش ومحافظ الهاتف</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          vodafoneCashEnabled ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {vodafoneCashEnabled ? 'مفعّل' : 'معطّل'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">تحويل المبلغ لمحفظة كاش المحددة</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={vodafoneCashEnabled}
                    onClick={() => setVodafoneCashEnabled(!vodafoneCashEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      vodafoneCashEnabled ? 'bg-rose-600' : 'bg-slate-200'
                    }`}
                    dir="ltr"
                    title={vodafoneCashEnabled ? 'إيقاف استقبال فودافون كاش' : 'تفعيل استقبال فودافون كاش'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        vodafoneCashEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* رقم المحفظة للقراءة فقط */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>رقم محفظة كاش الخاصة بالمطعم:</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">يتم ضبطه وتعديله من الإدارة</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-xs font-mono font-black text-slate-900 tracking-wider">
                      {vodafoneCashNumber || 'لم يُحدد رقم محفظة من الإدارة بعد'}
                    </span>
                    {vodafoneCashNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(vodafoneCashNumber);
                          toast.success('تم نسخ رقم المحفظة');
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors"
                        title="نسخ الرقم"
                      >
                        <Copy className="w-3 h-3" />
                        <span>نسخ</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* InstaPay */}
              <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                instapayEnabled ? 'border-indigo-200 bg-indigo-50/20 shadow-2xs' : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 block truncate">إنستاباي (InstaPay)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          instapayEnabled ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {instapayEnabled ? 'مفعّل' : 'معطّل'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">تحويل فوري عبر عنوان IPA أو الحساب البنكي</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={instapayEnabled}
                    onClick={() => setInstapayEnabled(!instapayEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      instapayEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                    dir="ltr"
                    title={instapayEnabled ? 'إيقاف استقبال إنستاباي' : 'تفعيل استقبال إنستاباي'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        instapayEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* معرف إنستاباي للقراءة فقط */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>معرف إنستاباي IPA الخاص بالمطعم:</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">يتم ضبطه وتعديله من الإدارة</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-xs font-mono font-black text-slate-900 tracking-wider">
                      {instapayHandle || 'لم يُحدد عنوان إنستاباي من الإدارة بعد'}
                    </span>
                    {instapayHandle && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(instapayHandle);
                          toast.success('تم نسخ معرف إنستاباي');
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                        title="نسخ المعرف"
                      >
                        <Copy className="w-3 h-3" />
                        <span>نسخ</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                cardEnabled ? 'border-sky-200 bg-sky-50/20 shadow-2xs' : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 block truncate">الدفع ببطاقات فيزا / ماستركارد</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cardEnabled ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {cardEnabled ? 'مفعّل' : 'معطّل'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">بوابة الدفع الإلكتروني المباشر</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cardEnabled}
                    onClick={() => setCardEnabled(!cardEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      cardEnabled ? 'bg-sky-600' : 'bg-slate-200'
                    }`}
                    dir="ltr"
                    title={cardEnabled ? 'إيقاف الدفع بالبطاقات' : 'تفعيل الدفع بالبطاقات'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        cardEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* تحصيل المحافظ الإلكترونية وإنستاباي (إلزام إيصال مسبق أم تحويل عند الاستلام) */}
              {(vodafoneCashEnabled || instapayEnabled) && (
                <div className="p-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-amber-50/30 space-y-3 shadow-2xs transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-slate-900 block">
                          طريقة تحصيل المحافظ الإلكترونية وإنستاباي
                        </span>
                        <span className="text-[11px] text-slate-600 block leading-tight mt-0.5">
                          {requirePaymentProof
                            ? 'إلزام العميل بإرفاق صورة إيصال التحويل ورقم المحفظة مسبقاً أثناء الطلب'
                            : 'الدفع عند الاستلام مع الطيار (يتم عرض رقم المحفظة/إنستاباي للعميل ويتم التحويل عند وصول الطيار)'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={requirePaymentProof}
                      onClick={() => setRequirePaymentProof(!requirePaymentProof)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        requirePaymentProof ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                      dir="ltr"
                      title={requirePaymentProof ? 'تغيير إلى: الدفع عند الاستلام' : 'تغيير إلى: إلزام إرفاق الإيصال'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                          requirePaymentProof ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-indigo-100/80 flex items-center gap-2 text-[11px] flex-wrap">
                    <span className="font-bold text-slate-700">الحالة المختارة:</span>
                    {requirePaymentProof ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                        🔒 إلزامي إرفاق سكرين شوت الإيصال ورقم المحفظة قبل تأكيد الطلب
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        🛵 مسموح بالدفع والتحويل عند وصول كابتن التوصيل للعميل
                      </span>
                    )}
                  </div>
                </div>
              )}
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
          <div className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
            autoPrintEnabled ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900">الطباعة التلقائية للبون</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">موصى بها</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                طباعة بون المطبخ مباشرة وبشكل فوري عند الضغط على "قبول وبدء التجهيز"
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoPrintEnabled}
              onClick={() => handleToggleAutoPrint(!autoPrintEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                autoPrintEnabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
              dir="ltr"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  autoPrintEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
              <p className="text-xs text-slate-400">تحديد أوقات عمل الفرع التي تظهر للعملاء ومهلة تجهيز الطلبات المحجوزة</p>
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

      {/* 5. Blocked Customers Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">العملاء المحظورون من الطلب</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  {blockedCustomers.length} {blockedCustomers.length === 1 ? 'عميل محظور' : 'عملاء محظورين'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                قائمة العملاء الموقوفين عن إرسال طلبات جديدة لمطعمك مع إمكانية رفع الحظر عنهم فوراً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchBlockedCustomers}
            disabled={loadingBlocked}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto shadow-2xs"
            title="تحديث قائمة المحظورين"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${loadingBlocked ? 'animate-spin' : ''}`} />
            <span>تحديث القائمة</span>
          </button>
        </div>

        {/* Search input when there are items */}
        {blockedCustomers.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={blockedSearchQuery}
              onChange={e => setBlockedSearchQuery(e.target.value)}
              placeholder="البحث باسم العميل أو رقم الهاتف..."
              className="w-full pr-10 pl-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        )}

        {/* Content list or Empty State */}
        {loadingBlocked && blockedCustomers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>جاري استرجاع قائمة العملاء المحظورين...</span>
          </div>
        ) : blockedCustomers.length === 0 ? (
          <div className="p-8 sm:p-10 bg-emerald-50/40 border border-emerald-200/70 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-black text-emerald-950">سجل الحظر نظيف تماماً!</h4>
            <p className="text-[11px] text-emerald-800 max-w-md mx-auto leading-relaxed">
              لا يوجد أي عميل محظور في فرعك حالياً. عندما تقوم بحظر أي عميل من شاشة تفاصيل الطلبات، سيظهر هنا مع إمكانية فك الحظر عنه في أي وقت.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedCustomers
              .filter(c => {
                if (!blockedSearchQuery.trim()) return true;
                const q = blockedSearchQuery.trim().toLowerCase();
                return (
                  c.name?.toLowerCase().includes(q) ||
                  c.phone?.toLowerCase().includes(q) ||
                  c.notes?.toLowerCase().includes(q)
                );
              })
              .map((customer) => (
                <div
                  key={customer.userId}
                  className="p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 hover:bg-rose-50/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-black text-sm border border-rose-200">
                      {customer.name ? customer.name.slice(0, 1) : <UserX className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs text-slate-900">{customer.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          🚫 محظور
                        </span>
                        {customer.orderCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            {customer.orderCount} طلبات سابقة
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span dir="ltr">{customer.phone}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(customer.phone);
                              toast.success('تم نسخ رقم الهاتف');
                            }}
                            className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="نسخ الرقم"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span>•</span>
                        <span className="text-[10px] text-slate-400">
                          تاريخ الحظر: {new Date(customer.blockedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {customer.notes ? (
                        <div className="text-[11px] text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/70 inline-block font-bold">
                          <span className="text-amber-700 ml-1">سبب الحظر / الملاحظة:</span>
                          <span>{customer.notes}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block">
                          لا توجد ملاحظة إضافية مسجلة
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmUnblockUser(customer)}
                    disabled={unblockingUserId === customer.userId}
                    className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-300 hover:border-emerald-400 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 shrink-0 self-end sm:self-center"
                    title="فك الحظر عن هذا العميل"
                  >
                    {unblockingUserId === customer.userId ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>إلغاء الحظر 🔓</span>
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* تأكيد فك الحظر عن العميل */}
      <ConfirmModal
        isOpen={!!confirmUnblockUser}
        title="إلغاء الحظر عن العميل"
        message={`هل أنت متأكد من رغبتك في إلغاء الحظر عن العميل "${confirmUnblockUser?.name}" (${confirmUnblockUser?.phone})؟ سيتمكن من إرسال طلبات جديدة لمطعمك فوراً.`}
        confirmText="نعم، إلغاء الحظر"
        cancelText="تراجع"
        variant="primary"
        loading={!!unblockingUserId}
        onConfirm={handleExecuteUnblock}
        onClose={() => !unblockingUserId && setConfirmUnblockUser(null)}
      />

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
