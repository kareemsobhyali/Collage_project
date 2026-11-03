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
  Users,
  Tag,
  Download,
  FileSpreadsheet,
  Sparkles,
  ExternalLink,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
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

export type SettingsTab = 'PROFILE' | 'PAYMENT' | 'MARKETING' | 'PRINTER' | 'HOURS' | 'BLOCKED';

export interface SpinWheelPrizeItem {
  id: string;
  label: string;
  type: 'COUPON' | 'POINTS' | 'FREE_ITEM' | 'FREE_DELIVERY' | 'BETTER_LUCK';
  discountType?: 'PERCENT' | 'FIXED';
  value: string | number;
  minOrder?: number;
  weight: number;
  icon: string;
  color?: string;
}

const DEFAULT_SPIN_PRIZES: SpinWheelPrizeItem[] = [
  { id: 'prize_1', label: '10 نقاط ولاء للمحفظة', type: 'POINTS', value: 10, weight: 25, icon: '🌟', color: '#6366f1' },
  { id: 'prize_2', label: 'خصم 10% على طلبك القادم', type: 'COUPON', discountType: 'PERCENT', value: 10, minOrder: 0, weight: 20, icon: '🏷️', color: '#f59e0b' },
  { id: 'prize_3', label: '5 نقاط ولاء للمحفظة', type: 'POINTS', value: 5, weight: 20, icon: '🎁', color: '#ec4899' },
  { id: 'prize_4', label: 'وجبة / صنف هدية (كانز بيبسي)', type: 'FREE_ITEM', value: 'كانز بيبسي هدية', weight: 15, icon: '🍔', color: '#10b981' },
  { id: 'prize_5', label: 'توصيل مجاني لطلبك القادم', type: 'FREE_DELIVERY', value: 100, weight: 10, icon: '🚚', color: '#06b6d4' },
  { id: 'prize_6', label: 'حظ أوفر في المرة القادمة', type: 'BETTER_LUCK', value: 0, weight: 10, icon: '🍀', color: '#8b5cf6' },
];

interface BranchProfileViewProps {
  branch: any;
  onUpdateBranch?: (updatedBranch: any) => void;
  onLockSettings?: () => void;
}

export const BranchProfileView: React.FC<BranchProfileViewProps> = ({ 
  branch, 
  onUpdateBranch,
  onLockSettings,
}) => {
  // 1. Branch Details States
  const [name, setName] = useState(branch?.name || '');
  const [phone, setPhone] = useState(branch?.phone || '');
  const [address, setAddress] = useState(cleanAddressText(branch?.address) || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(branch?.googleMapsUrl || '');
  const [deliveryZoneMode, setDeliveryZoneMode] = useState<'GPS_RADIUS' | 'MANUAL_ZONES'>(branch?.deliveryZoneMode || 'GPS_RADIUS');
  const [spinWheelEnabled, setSpinWheelEnabled] = useState<boolean>(branch?.spinWheelEnabled ?? true);
  const [spinWheelCouponDays, setSpinWheelCouponDays] = useState<string>(String(branch?.spinWheelCouponDays ?? 7));
  const [wheelPrizes, setWheelPrizes] = useState<SpinWheelPrizeItem[]>(() => {
    if (branch?.spinWheelPrizes) {
      try {
        const parsed = JSON.parse(branch.spinWheelPrizes);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_e) {}
    }
    return DEFAULT_SPIN_PRIZES;
  });
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

  // Free Delivery States
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState<boolean>(branch?.freeDeliveryEnabled ?? false);
  const [freeDeliveryMinAmount, setFreeDeliveryMinAmount] = useState<string>(String(branch?.freeDeliveryMinAmount ?? 200));
  const [freeDeliveryDays, setFreeDeliveryDays] = useState<string>(branch?.freeDeliveryDays || 'SUN,MON,TUE,WED,THU,FRI,SAT');
  const [freeDeliveryStartTime, setFreeDeliveryStartTime] = useState<string>(branch?.freeDeliveryStartTime || '');
  const [freeDeliveryEndTime, setFreeDeliveryEndTime] = useState<string>(branch?.freeDeliveryEndTime || '');
  const [freeDeliveryIncludesDeals, setFreeDeliveryIncludesDeals] = useState<boolean>(branch?.freeDeliveryIncludesDeals ?? true);

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

  // 5. Active Settings Sub-Tab & Marketing State
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('PROFILE');
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingSuccess, setMarketingSuccess] = useState(false);
  const [marketingError, setMarketingError] = useState<string | null>(null);

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
      setGoogleMapsUrl(branch.googleMapsUrl || '');
      setDeliveryZoneMode(branch.deliveryZoneMode || 'GPS_RADIUS');
      setSpinWheelEnabled(branch.spinWheelEnabled ?? true);
      setSpinWheelCouponDays(String(branch.spinWheelCouponDays ?? 7));
      if (branch.spinWheelPrizes) {
        try {
          const parsed = JSON.parse(branch.spinWheelPrizes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWheelPrizes(parsed);
          }
        } catch (_e) {}
      }
      setLogoUrl(branch.logoUrl || '');
      setLogoError(false);
      setDeliveryType(branch.deliveryType || 'FIXED');
      setDeliveryFee(String(branch.deliveryFee ?? 10));
      setAllowDelivery(branch.allowDelivery ?? true);
      setAllowPickup(branch.allowPickup ?? true);
      setFreeDeliveryEnabled(branch.freeDeliveryEnabled ?? false);
      setFreeDeliveryMinAmount(String(branch.freeDeliveryMinAmount ?? 200));
      setFreeDeliveryDays(branch.freeDeliveryDays || 'SUN,MON,TUE,WED,THU,FRI,SAT');
      setFreeDeliveryStartTime(branch.freeDeliveryStartTime || '');
      setFreeDeliveryEndTime(branch.freeDeliveryEndTime || '');
      setFreeDeliveryIncludesDeals(branch.freeDeliveryIncludesDeals ?? true);
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
      const createdZone = res?.zone || (res?.id ? res : null);
      if (createdZone) {
        setDeliveryZones(prev => [...prev, createdZone]);
        setNewZoneName('');
        setNewZoneFee('10');
        toast.success(`تمت إضافة منطقة التوصيل "${createdZone.name}"`);
      }
    } catch (err: any) {
      toast.error(err.message || 'فشل إضافة منطقة التوصيل');
    } finally {
      setAddingZone(false);
    }
  };

  // تحميل نموذج إكسيل لمناطق التوصيل
  const handleDownloadZoneTemplate = () => {
    try {
      const wsData = [
        { 'اسم المنطقة': 'مبنى كلية الهندسة', 'سعر التوصيل': 15 },
        { 'اسم المنطقة': 'المدينة الجامعية طلبة', 'سعر التوصيل': 20 },
        { 'اسم المنطقة': 'مجمع الكليات الطبية', 'سعر التوصيل': 10 },
        { 'اسم المنطقة': 'بوابة الجامعة 2', 'سعر التوصيل': 10 },
      ];
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'مناطق التوصيل');
      XLSX.writeFile(wb, 'نموذج_مناطق_التوصيل.xlsx');
      toast.success('تم تحميل نموذج إكسيل لمناطق التوصيل');
    } catch (err: any) {
      toast.error('فشل إنشاء ملف النموذج');
    }
  };

  // استيراد مناطق التوصيل من ملف إكسيل
  const handleImportZonesExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAddingZone(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (!rows || rows.length === 0) {
        toast.error('الملف فارغ أو لا يحتوي على صفوف صالحة');
        return;
      }

      const zonesToImport: { name: string; fee: number }[] = [];
      for (const r of rows) {
        const name = String(r['اسم المنطقة'] || r['المنطقة'] || r['name'] || r['Zone'] || r['اسم منطقة التوصيل'] || '').trim();
        const feeRaw = r['سعر التوصيل'] ?? r['الرسوم'] ?? r['fee'] ?? r['السعر'] ?? 10;
        const fee = parseFloat(feeRaw) || 0;
        if (name) {
          zonesToImport.push({ name, fee });
        }
      }

      if (zonesToImport.length === 0) {
        toast.error('لم يتم العثور على أعمدة (اسم المنطقة) و (سعر التوصيل) في الملف');
        return;
      }

      const res = await api.bulkAddDeliveryZones(zonesToImport, false);
      if (res.zones) {
        setDeliveryZones(res.zones);
        toast.success(`تم استيراد ${res.count || zonesToImport.length} منطقة توصيل بنجاح!`);
      }
    } catch (err: any) {
      console.error('Import zones error:', err);
      toast.error(err.message || 'حدث خطأ أثناء قراءة ملف الإكسيل');
    } finally {
      setAddingZone(false);
      if (e.target) e.target.value = '';
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

  // Spin Wheel Configuration Helpers
  const totalWeight = wheelPrizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

  const handleAddPrize = () => {
    const newId = `prize_${Date.now()}`;
    const colors = ['#6366f1', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#f97316'];
    const randomColor = colors[wheelPrizes.length % colors.length];
    setWheelPrizes(prev => [
      ...prev,
      {
        id: newId,
        label: 'جائزة جديدة',
        type: 'COUPON',
        discountType: 'PERCENT',
        value: 10,
        minOrder: 0,
        weight: 10,
        icon: '🎁',
        color: randomColor,
      }
    ]);
  };

  const handleRemovePrize = (index: number) => {
    if (wheelPrizes.length <= 2) {
      toast.error('يجب الإبقاء على جائزتين على الأقل في عجلة الحظ');
      return;
    }
    setWheelPrizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePrize = (index: number, updates: Partial<SpinWheelPrizeItem>) => {
    setWheelPrizes(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const handleAutoBalanceWeights = () => {
    if (wheelPrizes.length === 0) return;
    const equalWeight = Math.floor(100 / wheelPrizes.length);
    const remainder = 100 - (equalWeight * wheelPrizes.length);
    setWheelPrizes(prev => prev.map((item, idx) => ({
      ...item,
      weight: equalWeight + (idx === 0 ? remainder : 0)
    })));
    toast.success('تمت موازنة نسب الظهور بالتساوي ليصبح الإجمالي 100% ⚖️');
  };

  const handleResetDefaultPrizes = () => {
    setWheelPrizes(DEFAULT_SPIN_PRIZES);
    toast.success('تمت استعادة الجوائز الافتراضية');
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
        freeDeliveryEnabled,
        freeDeliveryMinAmount: parseFloat(freeDeliveryMinAmount) || 0,
        freeDeliveryDays,
        freeDeliveryStartTime: freeDeliveryStartTime.trim() || null,
        freeDeliveryEndTime: freeDeliveryEndTime.trim() || null,
        freeDeliveryIncludesDeals,
        googleMapsUrl: googleMapsUrl.trim() || null,
        deliveryZoneMode,
        spinWheelEnabled,
        spinWheelCouponDays: parseInt(spinWheelCouponDays, 10) || 7,
        spinWheelPrizes: JSON.stringify(wheelPrizes),
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

  // Handle Save Marketing Settings (Free Delivery & Wheel of Fortune)
  const handleSaveMarketing = async (e: React.FormEvent) => {
    e.preventDefault();
    setMarketingError(null);
    setMarketingSuccess(false);

    try {
      setMarketingLoading(true);
      const existingCoordsMatch = branch?.address?.match(/\[GPS:[0-9.-]+,[0-9.-]+\]/);
      let finalAddress = cleanAddressText(address).trim();
      if (existingCoordsMatch && finalAddress) {
        finalAddress = `${existingCoordsMatch[0]} ${finalAddress}`;
      } else if (!finalAddress && existingCoordsMatch) {
        finalAddress = existingCoordsMatch[0];
      }

      const res = await api.updateBranchDetails({
        name: name.trim() || branch?.name || 'الفرع',
        phone: phone.trim() || undefined,
        address: finalAddress || undefined,
        logoUrl: logoUrl.trim() || undefined,
        deliveryType,
        deliveryFee: parseFloat(deliveryFee) || 10,
        allowDelivery,
        allowPickup,
        freeDeliveryEnabled,
        freeDeliveryMinAmount: parseFloat(freeDeliveryMinAmount) || 0,
        freeDeliveryDays,
        freeDeliveryStartTime: freeDeliveryStartTime.trim() || null,
        freeDeliveryEndTime: freeDeliveryEndTime.trim() || null,
        freeDeliveryIncludesDeals,
        googleMapsUrl: googleMapsUrl.trim() || null,
        deliveryZoneMode,
        spinWheelEnabled,
        spinWheelCouponDays: parseInt(spinWheelCouponDays, 10) || 7,
        spinWheelPrizes: JSON.stringify(wheelPrizes),
      });

      if (res.branch) {
        setMarketingSuccess(true);
        if (onUpdateBranch) onUpdateBranch({ ...res.branch, deliveryZones });
        setTimeout(() => setMarketingSuccess(false), 3500);
      }
    } catch (err: any) {
      setMarketingError(err.message || 'فشل حفظ إعدادات العروض والمكافآت');
    } finally {
      setMarketingLoading(false);
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

  const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'PROFILE', label: 'بيانات الفرع والتوصيل', icon: Store },
    { id: 'PAYMENT', label: 'طرق الدفع والمحافظ', icon: CreditCard },
    { id: 'MARKETING', label: 'العروض والمكافآت', icon: Sparkles, badge: 'جديد' },
    { id: 'PRINTER', label: 'الطابعة الحرارية', icon: Printer },
    { id: 'HOURS', label: 'مواعيد العمل والبريك', icon: Clock },
    { id: 'BLOCKED', label: 'العملاء المحظورين', icon: UserX, badge: blockedCustomers.length > 0 ? String(blockedCustomers.length) : undefined },
  ];

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

          {onLockSettings && (
            <button
              type="button"
              onClick={onLockSettings}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title="قفل لوحة التحكمات والإعدادات فوراً"
            >
              <Lock className="w-4 h-4 text-amber-600" />
              <span>قفل اللوحة 🔒</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Navigation Bar */}
      <div className="bg-white rounded-3xl p-2 sm:p-2.5 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeSettingsTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Restaurant Operational Details Form */}
      {activeSettingsTab === 'PROFILE' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col">
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
                <label className="block text-xs font-bold text-slate-700 mb-1">موقع الفرع بالتحديد (نص العنوان)</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">رابط لوكيشن الفرع على خرائط جوجل (Google Maps Link)</label>
                <div className="relative">
                  <ExternalLink className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="url"
                    value={googleMapsUrl}
                    onChange={e => setGoogleMapsUrl(e.target.value)}
                    placeholder="مثال: https://maps.app.goo.gl/... أو https://goo.gl/maps/..."
                    className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">عند نقر العميل على عنوان الفرع في تطبيق العميل سيفتح هذا اللوكيشن على الخريطة مباشرة</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">أرقام هواتف الفرع (دعم أكثر من رقم)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="مثال: 01023231926 ، 01155554433"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">يمكنك إدخال أكثر من رقم مفصولاً بفاصلة (،) أو شرطة (/) لتظهر كأرقام متعددة للعميل</span>
              </div>

              {/* Delivery Zone Mode Choice */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700">نظام فحص نطاق التوصيل للفرع</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryZoneMode('GPS_RADIUS')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      deliveryZoneMode === 'GPS_RADIUS'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm ring-2 ring-indigo-200'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>نطاق جغرافي (GPS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryZoneMode('MANUAL_ZONES')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      deliveryZoneMode === 'MANUAL_ZONES'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm ring-2 ring-indigo-200'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>مناطق بالاسم فقط (يدوي)</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  {deliveryZoneMode === 'MANUAL_ZONES'
                    ? 'العميل يختار منطقته يدوياً من القائمة المحددة دون التقيد بإحداثيات GPS.'
                    : 'يتم احتساب المسافة الجغرافية بالكيلومترات ورفض أي طلب خارج نطاق التوصيل.'}
                </span>
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
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-black text-slate-800">مناطق وأحياء التوصيل وأسعارها ({deliveryZones.length})</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleDownloadZoneTemplate}
                            className="px-2.5 py-1 text-[11px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="تحميل نموذج ملف إكسيل جاهز للملء"
                          >
                            <Download className="w-3 h-3 text-slate-500" />
                            <span>نموذج Excel</span>
                          </button>
                          <label className="px-2.5 py-1 text-[11px] bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors">
                            <FileSpreadsheet className="w-3 h-3 text-indigo-600" />
                            <span>{addingZone ? 'جاري الاستيراد...' : 'رفع إكسيل'}</span>
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              disabled={addingZone}
                              onChange={handleImportZonesExcel}
                              className="hidden"
                            />
                          </label>
                        </div>
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
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {detailsLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>حفظ بيانات الفرع والتوصيل</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Payment Methods Management Form */}
        {activeSettingsTab === 'PAYMENT' && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col">
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
              {(() => {
                const isVodafoneLocked = p?.adminVodafoneAllowed === false || !vodafoneCashNumber || !vodafoneCashNumber.trim();
                return (
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
                              isVodafoneLocked
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : (vodafoneCashEnabled ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-500')
                            }`}>
                              {isVodafoneLocked ? 'مغلق بالإدارة' : (vodafoneCashEnabled ? 'مفعّل' : 'معطّل')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">تحويل المبلغ لمحفظة كاش المحددة</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={vodafoneCashEnabled}
                        disabled={isVodafoneLocked}
                        onClick={() => {
                          if (isVodafoneLocked) {
                            toast.error('تم إيقاف الخدمة من لوحة التحكم أو لم يتم اعتماد رقم المحفظة بعد');
                            return;
                          }
                          setVodafoneCashEnabled(!vodafoneCashEnabled);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isVodafoneLocked
                            ? 'opacity-40 cursor-not-allowed bg-slate-300'
                            : (vodafoneCashEnabled ? 'bg-rose-600 cursor-pointer' : 'bg-slate-200 cursor-pointer')
                        }`}
                        dir="ltr"
                        title={isVodafoneLocked ? 'تم إيقاف فودافون كاش من لوحة التحكم' : (vodafoneCashEnabled ? 'إيقاف استقبال فودافون كاش' : 'تفعيل استقبال فودافون كاش')}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                            vodafoneCashEnabled && !isVodafoneLocked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {isVodafoneLocked && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>مغلق من لوحة التحكم الرئيسية (لا يمكن التفعيل حتى تعتمدها الإدارة)</span>
                      </div>
                    )}

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
                );
              })()}

              {/* InstaPay */}
              {(() => {
                const isInstapayLocked = p?.adminInstapayAllowed === false || !instapayHandle || !instapayHandle.trim();
                return (
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
                              isInstapayLocked
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : (instapayEnabled ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-500')
                            }`}>
                              {isInstapayLocked ? 'مغلق بالإدارة' : (instapayEnabled ? 'مفعّل' : 'معطّل')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">تحويل فوري عبر عنوان IPA أو الحساب البنكي</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={instapayEnabled}
                        disabled={isInstapayLocked}
                        onClick={() => {
                          if (isInstapayLocked) {
                            toast.error('تم إيقاف الخدمة من لوحة التحكم أو لم يتم اعتماد معرف إنستاباي بعد');
                            return;
                          }
                          setInstapayEnabled(!instapayEnabled);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isInstapayLocked
                            ? 'opacity-40 cursor-not-allowed bg-slate-300'
                            : (instapayEnabled ? 'bg-indigo-600 cursor-pointer' : 'bg-slate-200 cursor-pointer')
                        }`}
                        dir="ltr"
                        title={isInstapayLocked ? 'تم إيقاف إنستاباي من لوحة التحكم' : (instapayEnabled ? 'إيقاف استقبال إنستاباي' : 'تفعيل استقبال إنستاباي')}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                            instapayEnabled && !isInstapayLocked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {isInstapayLocked && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>مغلق من لوحة التحكم الرئيسية (لا يمكن التفعيل حتى تعتمدها الإدارة)</span>
                      </div>
                    )}

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
                );
              })()}

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
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              {paymentLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ طرق الدفع</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Marketing & Customer Rewards (Free Delivery & Spin The Wheel) */}
      {activeSettingsTab === 'MARKETING' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">العروض والمكافآت والولاء</h3>
                  <p className="text-[11px] text-slate-400">إعدادات التوصيل المجاني للطلبات وعجلة الحظ التفاعلية لزيادة مبيعات وتفاعل العملاء</p>
                </div>
              </div>
            </div>

            {marketingError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{marketingError}</span>
              </div>
            )}

            {marketingSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>تم حفظ إعدادات العروض والمكافآت بنجاح!</span>
              </div>
            )}

            <form onSubmit={handleSaveMarketing} id="marketing-form" className="space-y-6">
              {/* إعدادات التوصيل المجاني (Free Delivery) */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 transition-all bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-white border-indigo-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">عرض التوصيل المجاني (Free Delivery)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">جديد ✨</span>
                      </div>
                      <p className="text-[11px] text-slate-500">توصيل مجاني للعملاء عند وصول قيمة أصنافهم للحد الأدنى</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={freeDeliveryEnabled}
                      onChange={e => setFreeDeliveryEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {freeDeliveryEnabled && (
                  <div className="mt-4 pt-4 border-t border-indigo-100 space-y-4">
                    {/* الحد الأدنى لقيمة الأصناف */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        الحد الأدنى لقيمة الأصناف (بدون التوصيل) للحصول على توصيل مجاني
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={freeDeliveryMinAmount}
                          onChange={e => setFreeDeliveryMinAmount(e.target.value)}
                          placeholder="مثال: 250"
                          className="w-full pl-12 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ج.م</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        * يتم الحساب على أسعار الوجبات والإضافات فقط، دون إضافة رسوم التوصيل أو احتساب الكوبونات.
                      </span>
                    </div>

                    {/* أيام التوفر */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        أيام سريان التوصيل المجاني
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'SAT', label: 'السبت' },
                          { key: 'SUN', label: 'الأحد' },
                          { key: 'MON', label: 'الإثنين' },
                          { key: 'TUE', label: 'الثلاثاء' },
                          { key: 'WED', label: 'الأربعاء' },
                          { key: 'THU', label: 'الخميس' },
                          { key: 'FRI', label: 'الجمعة' },
                        ].map(day => {
                          const isSelected = freeDeliveryDays.toUpperCase().includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => {
                                const parts = freeDeliveryDays.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                let nextParts: string[];
                                if (parts.includes(day.key)) {
                                  nextParts = parts.filter(p => p !== day.key);
                                } else {
                                  nextParts = [...parts, day.key];
                                }
                                setFreeDeliveryDays(nextParts.join(','));
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setFreeDeliveryDays('SUN,MON,TUE,WED,THU,FRI,SAT')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          طوال الأسبوع
                        </button>
                      </div>
                    </div>

                    {/* نافذة الساعات اليومية */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          أوقات التوصيل المجاني يومياً (اختياري)
                        </label>
                        {(freeDeliveryStartTime || freeDeliveryEndTime) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFreeDeliveryStartTime('');
                              setFreeDeliveryEndTime('');
                            }}
                            className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                          >
                            إلغاء التحديد (طوال ساعات العمل)
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">من الساعة</span>
                          <input
                            type="time"
                            value={freeDeliveryStartTime}
                            onChange={e => setFreeDeliveryStartTime(e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">إلى الساعة</span>
                          <input
                            type="time"
                            value={freeDeliveryEndTime}
                            onChange={e => setFreeDeliveryEndTime(e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        اتركها فارغة إذا كان التوصيل المجاني متاحاً طوال ساعات عمل المطعم.
                      </span>
                    </div>

                    {/* سريان العرض على قسم العروض */}
                    <label className="p-3.5 rounded-2xl border border-indigo-100 bg-white cursor-pointer transition-all flex items-center justify-between hover:border-indigo-300">
                      <div className="flex items-center gap-2.5">
                        <Tag className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            سريان التوصيل المجاني على قسم العروض
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            عند إيقاف هذا الخيار، إذا كان بسلة العميل صنف من العروض يدفع رسوم التوصيل العادية
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={freeDeliveryIncludesDeals}
                        onChange={e => setFreeDeliveryIncludesDeals(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* عجلة الحظ ومكافآت الطلبات (Spin The Wheel) */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-indigo-500/10 border border-amber-200/80 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 block">عجلة الحظ ومكافآت الطلبات 🎡 (Spin The Wheel)</span>
                      <span className="text-[11px] text-slate-500 block">منح العملاء فرصة تدوير العجلة بعد إتمام الطلب لكسب نقاط أو كوبونات خصم</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spinWheelEnabled}
                      onChange={e => setSpinWheelEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {spinWheelEnabled && (
                  <div className="space-y-4 pt-3 border-t border-amber-200/60 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">صلاحية كوبونات الخصم والجوائز الممنوحة من العجلة (بالأيام)</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={spinWheelCouponDays}
                        onChange={e => setSpinWheelCouponDays(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">تكون الكوبونات صالحة لهذا العميل فقط ومرتبطة بحسابه وتُحفظ تلقائياً في قاعدة البيانات.</span>
                    </div>

                    {/* محرر خيارات وجوائز العجلة التفاعلي */}
                    <div className="p-4 bg-white border border-amber-200 rounded-2xl space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">🎯 شرائح وجوائز العجلة ونسب ظهورها للعميل</span>
                          <span className="text-[11px] text-slate-500 block">حدد الأصناف، الخصومات، النقاط، ونسبة احتمالية ظهور كل اختيار</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                            totalWeight === 100 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            مجموع النسب: {totalWeight}% {totalWeight === 100 ? '✅' : '⚖️'}
                          </span>
                          <button
                            type="button"
                            onClick={handleAutoBalanceWeights}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="موازنة النسب بالتساوي ليصبح المجموع 100%"
                          >
                            موازنة 100% ⚖️
                          </button>
                          <button
                            type="button"
                            onClick={handleResetDefaultPrizes}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="استعادة الجوائز الافتراضية"
                          >
                            الافتراضي 🔄
                          </button>
                        </div>
                      </div>

                      {/* قائمة الجوائز */}
                      <div className="space-y-3">
                        {wheelPrizes.map((prize, idx) => (
                          <div key={prize.id || idx} className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all space-y-3 shadow-2xs">
                            {/* الصف الأول: الإيموجي + اسم الجائزة + رقم الشريحة وزر الحذف */}
                            <div className="flex items-center gap-2.5">
                              {/* إيموجي / أيقونة */}
                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                                <input
                                  type="text"
                                  value={prize.icon}
                                  onChange={e => handleUpdatePrize(idx, { icon: e.target.value })}
                                  className="w-full h-full text-center bg-transparent border-0 focus:ring-0 p-0 text-lg"
                                  title="تغيير الإيموجي"
                                />
                              </div>

                              {/* اسم الشريحة / الجائزة */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">اسم الجائزة (يظهر للعميل بالعجلة)</label>
                                  <span className="text-[10px] font-mono text-slate-400 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">شريحة #{idx + 1}</span>
                                </div>
                                <input
                                  type="text"
                                  value={prize.label}
                                  onChange={e => handleUpdatePrize(idx, { label: e.target.value })}
                                  placeholder="مثال: خصم 10% أو 10 نقاط ولاء..."
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                                />
                              </div>

                              {/* زر الحذف */}
                              <div className="shrink-0 self-end mb-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePrize(idx)}
                                  disabled={wheelPrizes.length <= 2}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="حذف هذا الاختيار"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* الصف الثاني: نوع الجائزة + القيمة والخصم + نسبة احتمالية الظهور */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2.5 border-t border-slate-200/70 items-end">
                              {/* نوع الجائزة */}
                              <div className="sm:col-span-5">
                                <label className="text-[11px] font-bold text-slate-500 block mb-1">نوع الجائزة</label>
                                <select
                                  value={prize.type}
                                  onChange={e => {
                                    const newType = e.target.value as any;
                                    let newLabel = prize.label;
                                    let newVal = prize.value;
                                    let icon = prize.icon;
                                    if (newType === 'POINTS') {
                                      newLabel = '10 نقاط ولاء';
                                      newVal = 10;
                                      icon = '🌟';
                                    } else if (newType === 'COUPON') {
                                      newLabel = 'خصم 10% على طلبك';
                                      newVal = 10;
                                      icon = '🏷️';
                                    } else if (newType === 'FREE_ITEM') {
                                      newLabel = 'كانز بيبسي هدية';
                                      newVal = 'كانز بيبسي هدية';
                                      icon = '🍔';
                                    } else if (newType === 'FREE_DELIVERY') {
                                      newLabel = 'توصيل مجاني لطلبك';
                                      newVal = 100;
                                      icon = '🚚';
                                    } else if (newType === 'BETTER_LUCK') {
                                      newLabel = 'حظ أوفر';
                                      newVal = 0;
                                      icon = '🍀';
                                    }
                                    handleUpdatePrize(idx, { type: newType, label: newLabel, value: newVal, icon });
                                  }}
                                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
                                >
                                  <option value="COUPON">🏷️ كوبون خصم</option>
                                  <option value="POINTS">🌟 نقاط ولاء</option>
                                  <option value="FREE_ITEM">🍔 وجبة / صنف هدية</option>
                                  <option value="FREE_DELIVERY">🚚 توصيل مجاني</option>
                                  <option value="BETTER_LUCK">🍀 حظ أوفر</option>
                                </select>
                              </div>

                              {/* تفاصيل القيمة بناءً على النوع */}
                              <div className="sm:col-span-4">
                                {prize.type === 'COUPON' && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-20 shrink-0">
                                      <label className="text-[11px] font-bold text-slate-500 block mb-1">النوع</label>
                                      <select
                                        value={prize.discountType || 'PERCENT'}
                                        onChange={e => handleUpdatePrize(idx, { discountType: e.target.value as any })}
                                        className="w-full px-1.5 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700"
                                      >
                                        <option value="PERCENT">نسبة %</option>
                                        <option value="FIXED">مبلغ ج.م</option>
                                      </select>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <label className="text-[11px] font-bold text-slate-500 block mb-1">الخصم</label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={prize.value}
                                        onChange={e => handleUpdatePrize(idx, { value: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                                      />
                                    </div>
                                  </div>
                                )}

                                {prize.type === 'POINTS' && (
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-500 block mb-1">عدد النقاط</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={prize.value}
                                      onChange={e => handleUpdatePrize(idx, { value: parseInt(e.target.value, 10) || 0 })}
                                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                                    />
                                  </div>
                                )}

                                {prize.type === 'FREE_ITEM' && (
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-500 block mb-1">اسم الصنف المهداة</label>
                                    <input
                                      type="text"
                                      value={String(prize.value || '')}
                                      onChange={e => handleUpdatePrize(idx, { value: e.target.value })}
                                      placeholder="مثال: كانز بيبسي هدية"
                                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                    />
                                  </div>
                                )}

                                {(prize.type === 'FREE_DELIVERY' || prize.type === 'BETTER_LUCK') && (
                                  <div>
                                    <label className="text-[11px] font-bold text-slate-400 block mb-1">القيمة</label>
                                    <div className="px-2.5 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-500 text-center">
                                      {prize.type === 'FREE_DELIVERY' ? 'توصيل مجاني 100%' : 'بدون مكافأة'}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* نسبة احتمالية الظهور % */}
                              <div className="sm:col-span-3">
                                <label className="text-[11px] font-bold text-slate-500 block mb-1">نسبة الظهور</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={prize.weight}
                                    onChange={e => handleUpdatePrize(idx, { weight: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                    className="w-full pl-6 pr-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-amber-700"
                                  />
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* زر إضافة جائزة جديدة */}
                      <div className="pt-2 flex justify-start">
                        <button
                          type="button"
                          onClick={handleAddPrize}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة اختيار / جائزة جديدة ➕</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              form="marketing-form"
              disabled={marketingLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              {marketingLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ إعدادات العروض والمكافآت</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Thermal Printer & POS Settings Card */}
      {activeSettingsTab === 'PRINTER' && (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
      )}

      {/* 5. Official Working Hours & Scheduled Orders Settings Card */}
      {activeSettingsTab === 'HOURS' && (
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
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              {hoursLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ مواعيد العمل والطلب المسبق</span>
            </button>
          </div>
        </form>
      </div>
      )}

      {/* 6. Blocked Customers Card */}
      {activeSettingsTab === 'BLOCKED' && (
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
      )}

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
