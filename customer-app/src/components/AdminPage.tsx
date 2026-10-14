import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Phone, 
  User,
  ArrowLeft, 
  Store, 
  ArrowRight, 
  AlertCircle,
  Plus, 
  Power, 
  Key, 
  CreditCard, 
  Settings, 
  TrendingUp, 
  CheckCircle, 
  X, 
  Save, 
  RotateCw,
  MapPin,
  Trash2,
  Edit2,
  ShoppingBag,
  Users,
  DollarSign,
  Filter,
  Search,
  Clock,
  Eye,
  Check,
  Building,
  Smartphone,
  Info,
  Upload,
  Image as ImageIcon,
  Tag,
  Timer,
  ChefHat,
  Truck,
  Share2,
  Link as LinkIcon,
  MessageSquare,
  RefreshCw,
  Gift,
  Sparkles,
  Send
} from 'lucide-react';


import { API_BASE_URL, api, getFullImageUrl } from '../services/api';
import { Logo } from './Logo';

export const AdminPage: React.FC = () => {
  const [adminUser, setAdminUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('admin_user');
    const token = localStorage.getItem('admin_token');
    if (saved && token) {
      try {
        const u = JSON.parse(saved);
        if (u.role === 'SUPERADMIN') return u;
      } catch (e) {}
    }
    return null;
  });

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<'BRANCHES' | 'ORDERS' | 'STUDENTS' | 'ANALYTICS' | 'BANNERS' | 'PROMOS' | 'WHATSAPP' | 'SETTINGS'>('BRANCHES');
  const [whatsAppStatus, setWhatsAppStatus] = useState<any | null>(null);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);

  // System Settings & Loyalty states
  const [loyaltySettings, setLoyaltySettings] = useState<{
    enabled: boolean;
    pointsPerPound: number;
    pointsRedemptionRate: number;
    minPointsToRedeem: number;
    welcomePoints: number;
  }>({
    enabled: true,
    pointsPerPound: 1,
    pointsRedemptionRate: 0.05,
    minPointsToRedeem: 50,
    welcomePoints: 0,
  });
  const [loadingLoyaltySettings, setLoadingLoyaltySettings] = useState(false);
  const [savingLoyaltySettings, setSavingLoyaltySettings] = useState(false);
  const [loyaltySaveSuccess, setLoyaltySaveSuccess] = useState(false);

  // SuperAdmin Change Password states
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  // WhatsApp Alert Settings states
  const [whatsAppAlertSettings, setWhatsAppAlertSettings] = useState<{
    cancellationAlertPhones: string;
    cancellationAlertEnabled: boolean;
    unacceptedAlertPhones: string;
    unacceptedAlertEnabled: boolean;
    unacceptedDelayMinutes: number;
    dailyReportPhones: string;
    dailyReportEnabled: boolean;
  }>({
    cancellationAlertPhones: '',
    cancellationAlertEnabled: true,
    unacceptedAlertPhones: '',
    unacceptedAlertEnabled: true,
    unacceptedDelayMinutes: 5,
    dailyReportPhones: '',
    dailyReportEnabled: true,
  });
  const [loadingWhatsAppAlerts, setLoadingWhatsAppAlerts] = useState(false);
  const [savingWhatsAppAlerts, setSavingWhatsAppAlerts] = useState(false);
  const [whatsAppAlertsSaveSuccess, setWhatsAppAlertsSaveSuccess] = useState(false);
  const [testingShiftReport, setTestingShiftReport] = useState(false);
  const [shiftReportTestMsg, setShiftReportTestMsg] = useState<string | null>(null);

  // Factory Reset states (حالة الصفر)
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
  const [factoryResetPassword, setFactoryResetPassword] = useState('');
  const [factoryResetLoading, setFactoryResetLoading] = useState(false);
  const [factoryResetError, setFactoryResetError] = useState<string | null>(null);
  const [factoryResetSuccess, setFactoryResetSuccess] = useState<string | null>(null);




  // Data states
  const [branches, setBranches] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Banners & Promos Form Modals
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any | null>(null);

  // New Banner Form
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerSubtitle, setNewBannerSubtitle] = useState('');
  const [newBannerBadge, setNewBannerBadge] = useState('عرض خاص ⚡');
  const [newBannerImageUrl, setNewBannerImageUrl] = useState('');
  const [newBannerLink, setNewBannerLink] = useState('');
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);

  // Edit Banner Form
  const [editBannerTitle, setEditBannerTitle] = useState('');
  const [editBannerSubtitle, setEditBannerSubtitle] = useState('');
  const [editBannerBadge, setEditBannerBadge] = useState('');
  const [editBannerImageUrl, setEditBannerImageUrl] = useState('');
  const [editBannerLink, setEditBannerLink] = useState('');
  const [editBannerActive, setEditBannerActive] = useState(true);
  const [uploadingEditBannerImage, setUploadingEditBannerImage] = useState(false);

  // New Promo Form
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [newPromoValue, setNewPromoValue] = useState('15');
  const [newPromoMinOrder, setNewPromoMinOrder] = useState('50');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('');
  const [newPromoOncePerUser, setNewPromoOncePerUser] = useState(false);
  const [newPromoScope, setNewPromoScope] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [newPromoBranchIds, setNewPromoBranchIds] = useState<string[]>([]);

  // Edit Promo Form
  const [editPromoCode, setEditPromoCode] = useState('');
  const [editPromoType, setEditPromoType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [editPromoValue, setEditPromoValue] = useState('15');
  const [editPromoMinOrder, setEditPromoMinOrder] = useState('50');
  const [editPromoMaxUses, setEditPromoMaxUses] = useState('');
  const [editPromoOncePerUser, setEditPromoOncePerUser] = useState(false);
  const [editPromoActive, setEditPromoActive] = useState(true);
  const [editPromoScope, setEditPromoScope] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [editPromoBranchIds, setEditPromoBranchIds] = useState<string[]>([]);

  // Filters & Search
  const [branchSearch, setBranchSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderBranchFilter, setOrderBranchFilter] = useState('ALL');
  const [studentSearch, setStudentSearch] = useState('');

  // Modals
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [editingPaymentBranch, setEditingPaymentBranch] = useState<any | null>(null);
  const [editingCredentialsBranch, setEditingCredentialsBranch] = useState<any | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [editingStudentWallet, setEditingStudentWallet] = useState<any | null>(null);
  const [editStudentBalance, setEditStudentBalance] = useState('0');
  const [editStudentPoints, setEditStudentPoints] = useState('0');
  const [editStudentNotes, setEditStudentNotes] = useState('');
  const [editStudentBlocked, setEditStudentBlocked] = useState(false);
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [savingStudentWallet, setSavingStudentWallet] = useState(false);

  // Add Branch Form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [uploadingNewLogo, setUploadingNewLogo] = useState(false);
  const [newDeliveryFee, setNewDeliveryFee] = useState('10');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Edit Branch Form
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [uploadingEditLogo, setUploadingEditLogo] = useState(false);
  const [editDeliveryFee, setEditDeliveryFee] = useState('10');
  const [editAllowDelivery, setEditAllowDelivery] = useState(true);
  const [editAllowPickup, setEditAllowPickup] = useState(true);

  // Payment Form
  const [cashEnabled, setCashEnabled] = useState(true);
  const [vodafoneCashEnabled, setVodafoneCashEnabled] = useState(false);
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState('');
  const [instapayEnabled, setInstapayEnabled] = useState(false);
  const [instapayHandle, setInstapayHandle] = useState('');
  const [cardEnabled, setCardEnabled] = useState(false);

  // Credentials Form
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');

  const token = localStorage.getItem('admin_token');

  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
  });

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    if (!token && !adminUser) return;
    try {
      setLoading(true);
      const [statsRes, branchesRes, ordersRes, studentsRes, bannersRes, promosRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/stats`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/branches`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/orders?limit=100`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/users`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/banners`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/promo-codes`, { headers: getAdminHeaders() }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (branchesRes.ok) setBranches(await branchesRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (bannersRes.ok) setBanners(await bannersRes.json());
      if (promosRes.ok) setPromos(await promosRes.json());
    } catch (err) {
      console.error('Fetch dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      setLoadingWhatsApp(true);
      const data = await api.getWhatsAppStatus();
      setWhatsAppStatus(data);
    } catch (err: any) {
      console.warn('WhatsApp status error:', err);
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في فصل جلسة الواتساب الحالية؟ سيطلب منك مسح رمز QR جديد للربط.')) return;
    try {
      setLoadingWhatsApp(true);
      await api.disconnectWhatsApp();
      setTimeout(fetchWhatsAppStatus, 1500);
    } catch (err: any) {
      alert(err.message || 'فشل فصل الجلسة');
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  const fetchWhatsAppAlertSettings = async () => {
    try {
      setLoadingWhatsAppAlerts(true);
      const data = await api.getWhatsAppAlertSettings();
      if (data) {
        setWhatsAppAlertSettings(data);
      }
    } catch (err: any) {
      console.error('فشل جلب إعدادات تنبيهات الواتساب:', err);
    } finally {
      setLoadingWhatsAppAlerts(false);
    }
  };

  const handleSaveWhatsAppAlertSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingWhatsAppAlerts(true);
      setWhatsAppAlertsSaveSuccess(false);
      await api.updateWhatsAppAlertSettings(whatsAppAlertSettings);
      setWhatsAppAlertsSaveSuccess(true);
      setTimeout(() => setWhatsAppAlertsSaveSuccess(false), 3500);
    } catch (err: any) {
      setSavingWhatsAppAlerts(false);
    }
  };

  const handleTestSendShiftReport = async (branchId: string = 'ALL') => {
    try {
      setTestingShiftReport(true);
      setShiftReportTestMsg(null);
      const res = await api.sendShiftReportNow(branchId);
      setShiftReportTestMsg(res.message || 'تم إرسال التقرير المالي للشيفت بنجاح عبر الواتساب ✅');
      setTimeout(() => setShiftReportTestMsg(null), 6000);
    } catch (err: any) {
      alert(err.message || 'فشل إرسال التقرير المالي للشيفت');
    } finally {
      setTestingShiftReport(false);
    }
  };

  const handleExecuteFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFactoryResetError(null);
    setFactoryResetSuccess(null);

    if (!factoryResetPassword) {
      setFactoryResetError('يرجى إدخال كلمة مرور الإدارة لتأكيد التصفير');
      return;
    }

    try {
      setFactoryResetLoading(true);
      const res = await api.factoryReset(factoryResetPassword);
      setFactoryResetSuccess(res.message || 'تم تصفير المشروع بنجاح وإعادته إلى حالة الصفر ✅');
      setFactoryResetPassword('');
      // تحديث بيانات الداشبورد فوراً لعكس حالة الصفر
      fetchDashboardData();
      setTimeout(() => {
        setShowFactoryResetModal(false);
        setFactoryResetSuccess(null);
      }, 4000);
    } catch (err: any) {
      setFactoryResetError(err.message || 'فشل تنفيذ عملية تصفير المشروع');
    } finally {
      setFactoryResetLoading(false);
    }
  };


  useEffect(() => {
    if (activeTab === 'WHATSAPP') {
      fetchWhatsAppStatus();
      fetchWhatsAppAlertSettings();
      const interval = setInterval(fetchWhatsAppStatus, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);


  // System Settings & Loyalty Handlers
  const fetchLoyaltySettings = async () => {
    try {
      setLoadingLoyaltySettings(true);
      const data = await api.getLoyaltySettings();
      if (data && data.settings) {
        setLoyaltySettings(data.settings);
      }
    } catch (err: any) {
      console.error('فشل جلب إعدادات النقاط:', err);
    } finally {
      setLoadingLoyaltySettings(false);
    }
  };

  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingLoyaltySettings(true);
      setLoyaltySaveSuccess(false);
      await api.updateLoyaltySettings(loyaltySettings);
      setLoyaltySaveSuccess(true);
      setTimeout(() => setLoyaltySaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'فشل حفظ إعدادات نظام النقاط');
    } finally {
      setSavingLoyaltySettings(false);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    if (!currentAdminPassword) {
      setPasswordChangeError('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (newAdminPassword.length < 6) {
      setPasswordChangeError('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordChangeError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    try {
      setPasswordChangeLoading(true);
      const res = await api.changeAdminPassword(currentAdminPassword, newAdminPassword);
      setPasswordChangeSuccess(res.message || 'تم تحديث كلمة مرور الإدارة بنجاح');
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setTimeout(() => setPasswordChangeSuccess(null), 4000);
    } catch (err: any) {
      setPasswordChangeError(err.message || 'فشل تغيير كلمة المرور');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'SETTINGS') {
      fetchLoyaltySettings();
    }
  }, [activeTab]);


  // Banner Handlers
  const handleUploadBannerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingBannerImage(true);
      const res = await api.uploadImage(file);
      if (res.url) {
        setNewBannerImageUrl(res.url);
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع صورة الإعلان');
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleUploadEditBannerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingEditBannerImage(true);
      const res = await api.uploadImage(file);
      if (res.url) {
        setEditBannerImageUrl(res.url);
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع صورة الإعلان');
    } finally {
      setUploadingEditBannerImage(false);
    }
  };

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBannerTitle.trim()) return;
    try {
      const res = await api.createAdminBanner({
        title: newBannerTitle.trim(),
        subtitle: newBannerSubtitle.trim() || undefined,
        badgeText: newBannerBadge.trim() || undefined,
        imageUrl: newBannerImageUrl.trim() || undefined,
        linkUrl: newBannerLink.trim() || undefined,
      });
      if (res.banner) {
        setBanners([res.banner, ...banners]);
        setShowAddBannerModal(false);
        setNewBannerTitle('');
        setNewBannerSubtitle('');
        setNewBannerImageUrl('');
        setNewBannerLink('');
      }
    } catch (err: any) {
      alert(err.message || 'فشل إضافة البانر');
    }
  };

  const handleOpenEditBanner = (banner: any) => {
    setEditingBanner(banner);
    setEditBannerTitle(banner.title || '');
    setEditBannerSubtitle(banner.subtitle || '');
    setEditBannerBadge(banner.badgeText || '');
    setEditBannerImageUrl(banner.imageUrl || '');
    setEditBannerLink(banner.linkUrl || '');
    setEditBannerActive(banner.isActive !== false);
  };

  const handleSaveEditBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner || !editBannerTitle.trim()) return;
    try {
      const res = await api.updateAdminBanner(editingBanner.id, {
        title: editBannerTitle.trim(),
        subtitle: editBannerSubtitle.trim(),
        badgeText: editBannerBadge.trim(),
        imageUrl: editBannerImageUrl.trim(),
        linkUrl: editBannerLink.trim(),
        isActive: editBannerActive,
      });
      if (res.banner) {
        setBanners(banners.map(b => b.id === editingBanner.id ? res.banner : b));
        setEditingBanner(null);
      }
    } catch (err: any) {
      alert(err.message || 'فشل حفظ تعديلات البانر');
    }
  };

  const handleToggleBanner = async (bannerId: string, currentStatus: boolean) => {
    try {
      await api.updateAdminBanner(bannerId, { isActive: !currentStatus });
      setBanners(banners.map(b => b.id === bannerId ? { ...b, isActive: !currentStatus } : b));
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة البانر');
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
    try {
      await api.deleteAdminBanner(bannerId);
      setBanners(banners.filter(b => b.id !== bannerId));
    } catch (err: any) {
      alert(err.message || 'فشل حذف البانر');
    }
  };

  // Promo Code Handlers
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode.trim()) return;
    try {
      const res = await api.createAdminPromoCode({
        code: newPromoCode.trim().toUpperCase(),
        discountType: newPromoType,
        value: parseFloat(newPromoValue) || 10,
        minOrder: parseFloat(newPromoMinOrder) || 0,
        maxUses: newPromoMaxUses.trim() ? parseInt(newPromoMaxUses) : null,
        oncePerUser: newPromoOncePerUser,
        applicableBranchIds: newPromoScope === 'SPECIFIC' && newPromoBranchIds.length > 0 ? newPromoBranchIds : null,
      });
      if (res.promoCode) {
        setPromos([res.promoCode, ...promos]);
        setShowAddPromoModal(false);
        setNewPromoCode('');
        setNewPromoValue('15');
        setNewPromoMinOrder('50');
        setNewPromoMaxUses('');
        setNewPromoOncePerUser(false);
        setNewPromoScope('ALL');
        setNewPromoBranchIds([]);
      }
    } catch (err: any) {
      alert(err.message || 'فشل إنشاء كود الخصم');
    }
  };

  const handleOpenEditPromo = (promo: any) => {
    setEditingPromo(promo);
    setEditPromoCode(promo.code || '');
    setEditPromoType(promo.discountType === 'PERCENT' || promo.discountType === 'PERCENTAGE' ? 'PERCENT' : 'FIXED');
    setEditPromoValue(String(promo.value ?? 15));
    setEditPromoMinOrder(String(promo.minOrder ?? 0));
    setEditPromoMaxUses(promo.maxUses ? String(promo.maxUses) : '');
    setEditPromoOncePerUser(Boolean(promo.oncePerUser));
    setEditPromoActive(promo.isActive !== false);

    let parsedBranchIds: string[] = [];
    if (promo.applicableBranchIds) {
      try {
        const parsed = JSON.parse(promo.applicableBranchIds);
        if (Array.isArray(parsed)) parsedBranchIds = parsed;
      } catch {
        parsedBranchIds = promo.applicableBranchIds.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    if (parsedBranchIds.length > 0) {
      setEditPromoScope('SPECIFIC');
      setEditPromoBranchIds(parsedBranchIds);
    } else {
      setEditPromoScope('ALL');
      setEditPromoBranchIds([]);
    }
  };

  const handleSaveEditPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo || !editPromoCode.trim()) return;
    try {
      const res = await api.updateAdminPromoCode(editingPromo.id, {
        code: editPromoCode.trim().toUpperCase(),
        discountType: editPromoType,
        value: parseFloat(editPromoValue) || 10,
        minOrder: parseFloat(editPromoMinOrder) || 0,
        maxUses: editPromoMaxUses.trim() ? parseInt(editPromoMaxUses) : null,
        oncePerUser: editPromoOncePerUser,
        isActive: editPromoActive,
        applicableBranchIds: editPromoScope === 'SPECIFIC' ? editPromoBranchIds : null,
      });
      if (res.promoCode) {
        setPromos(promos.map(p => p.id === editingPromo.id ? res.promoCode : p));
        setEditingPromo(null);
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث بيانات الكوبون');
    }
  };

  const handleTogglePromoStatus = async (promoId: string, currentStatus: boolean) => {
    try {
      const res = await api.updateAdminPromoCode(promoId, { isActive: !currentStatus });
      if (res.promoCode) {
        setPromos(promos.map(p => p.id === promoId ? res.promoCode : p));
      }
    } catch (err: any) {
      alert(err.message || 'فشل تغيير حالة الكوبون');
    }
  };

  const handleDeletePromo = async (promoId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
    try {
      await api.deleteAdminPromoCode(promoId);
      setPromos(promos.filter(p => p.id !== promoId));
    } catch (err: any) {
      alert(err.message || 'فشل حذف الكوبون');
    }
  };

  // Student Wallet, Loyalty Points, Notes & Account Block Handlers
  const handleOpenStudentWallet = (student: any) => {
    setEditingStudentWallet(student);
    setEditStudentBalance(String(student.walletBalance ?? 0));
    setEditStudentPoints(String(student.loyaltyPoints ?? 0));
    setEditStudentNotes(student.restaurantNotes || '');
    setEditStudentBlocked(Boolean(student.isBlocked));
    setEditStudentPassword('');
  };

  const handleSaveStudentWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentWallet) return;
    try {
      setSavingStudentWallet(true);

      if (editStudentPassword.trim()) {
        await api.adminResetUserPassword(editingStudentWallet.id, editStudentPassword.trim());
      }

      const res = await api.updateAdminUserWallet(editingStudentWallet.id, {
        walletBalance: Math.max(0, parseFloat(editStudentBalance) || 0),
        loyaltyPoints: Math.max(0, parseInt(editStudentPoints) || 0),
        restaurantNotes: editStudentNotes.trim(),
        isBlocked: editStudentBlocked,
      });
      if (res.user) {
        setStudents(students.map(s => s.id === editingStudentWallet.id ? { ...s, ...res.user } : s));
        setEditingStudentWallet(null);
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث بيانات الطالب');
    } finally {
      setSavingStudentWallet(false);
    }
  };

  useEffect(() => {
    if (adminUser) {
      fetchDashboardData();
    }
  }, [adminUser]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: phone.trim(),
          phone: phone.trim(), 
          password: password.trim() 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      setAdminUser(data.user);
    } catch (err: any) {
      setLoginError(err.message || 'بيانات دخول الأدمن غير صحيحة');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdminUser(null);
  };

  const handleReturnToStudentStore = () => {
    window.location.href = '/';
  };

  // Branch Operations
  const handleToggleStatus = async (branchId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/branches/${branchId}/status`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) throw new Error('فشل تحديث الحالة');
      setBranches(branches.map(b => b.id === branchId ? { ...b, isActive: !currentStatus } : b));
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'خطأ في تحديث حالة الفرع');
    }
  };

  const handleUploadNewLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingNewLogo(true);
      const res = await api.uploadImage(file);
      if (res.url) setNewLogoUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'فشل رفع لوجو الفرع');
    } finally {
      setUploadingNewLogo(false);
    }
  };

  const handleUploadEditLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingEditLogo(true);
      const res = await api.uploadImage(file);
      if (res.url) setEditLogoUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'فشل رفع لوجو الفرع');
    } finally {
      setUploadingEditLogo(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/branches`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim() || undefined,
          phone: newPhone.trim() || undefined,
          logoUrl: newLogoUrl.trim() || undefined,
          address: newAddress.trim() || undefined,
          deliveryFee: parseFloat(newDeliveryFee) || 10,
          username: newUsername.trim() || undefined,
          password: newPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة الفرع');

      setNewName('');
      setNewSlug('');
      setNewPhone('');
      setNewAddress('');
      setNewLogoUrl('');
      setNewUsername('');
      setNewPassword('');
      setShowAddBranchModal(false);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة الفرع');
    }
  };

  const handleOpenEditBranch = (branch: any) => {
    setEditingBranch(branch);
    setEditName(branch.name || '');
    setEditSlug(branch.slug || '');
    setEditPhone(branch.phone || '');
    setEditAddress(branch.address || '');
    setEditLogoUrl(branch.logoUrl || '');
    setEditDeliveryFee(String(branch.deliveryFee ?? 10));
    setEditAllowDelivery(branch.allowDelivery ?? true);
    setEditAllowPickup(branch.allowPickup ?? true);
  };

  const handleSaveEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch || !editName.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/branches/${editingBranch.id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim() || null,
          phone: editPhone.trim() || null,
          address: editAddress.trim() || null,
          logoUrl: editLogoUrl.trim() || null,
          deliveryFee: parseFloat(editDeliveryFee) || 10,
          allowDelivery: editAllowDelivery,
          allowPickup: editAllowPickup,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث بيانات الفرع');
      setEditingBranch(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'خطأ في تحديث بيانات الفرع');
    }
  };

  const handleDeleteBranch = async (branch: any) => {
    if (!window.confirm(`هل أنت متأكد تماماً من رغبتك في حذف فرع "${branch.name}"؟\nسيتم مسح كافة أصنافه وإعداداته.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/branches/${branch.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حذف الفرع');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'خطأ في حذف الفرع');
    }
  };

  const handleOpenPaymentSettings = (branch: any) => {
    setEditingPaymentBranch(branch);
    const p = branch.paymentConfig;
    setCashEnabled(p?.cashEnabled ?? true);
    setVodafoneCashEnabled(p?.vodafoneCashEnabled ?? false);
    setVodafoneCashNumber(p?.vodafoneCashNumber ?? '');
    setInstapayEnabled(p?.instapayEnabled ?? false);
    setInstapayHandle(p?.instapayHandle ?? '');
    setCardEnabled(p?.cardEnabled ?? false);
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentBranch) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/branches/${editingPaymentBranch.id}/payment-methods`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          cashEnabled,
          vodafoneCashEnabled,
          vodafoneCashNumber: vodafoneCashNumber.trim() || null,
          instapayEnabled,
          instapayHandle: instapayHandle.trim() || null,
          cardEnabled,
        }),
      });
      if (!res.ok) throw new Error('فشل حفظ طرق الدفع');
      setEditingPaymentBranch(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'خطأ في حفظ إعدادات الدفع');
    }
  };

  const handleOpenCredentials = (branch: any) => {
    setEditingCredentialsBranch(branch);
    const existingUser = branch.users && branch.users[0];
    setCredUsername(existingUser?.username || '');
    setCredPassword('');
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredentialsBranch || !credUsername.trim() || !credPassword.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/branches/${editingCredentialsBranch.id}/credentials`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          username: credUsername.trim(),
          password: credPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تعيين بيانات الدخول');

      setEditingCredentialsBranch(null);
      fetchDashboardData();
      alert('تم تحديث بيانات دخول الفرع بنجاح');
    } catch (err: any) {
      alert(err.message || 'خطأ أثناء تحديث بيانات الدخول');
    }
  };

  const handleAdminUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('فشل تحديث حالة الطلب');
      fetchDashboardData();
      if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails({ ...selectedOrderDetails, status: newStatus });
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في تحديث الطلب');
    }
  };

  // Filtered lists
  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
    (b.address && b.address.toLowerCase().includes(branchSearch.toLowerCase()))
  );

  const filteredOrders = orders.filter(o => {
    const matchesStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
    const matchesBranch = orderBranchFilter === 'ALL' || o.branchId === orderBranchFilter;
    return matchesStatus && matchesBranch;
  });

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.phone.includes(studentSearch)
  );

  // If not logged in, show Full-Screen Admin Login
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-purple-600 selection:text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <Logo size="lg" lightText />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/80 border border-purple-800/60 rounded-full text-purple-300 text-xs font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة الإدارة المركزية (Super Admin)</span>
            </div>
            <p className="text-xs text-slate-400">
              تسجيل دخول مدير المنظومة لإدارة الفروع، الطلبات، وطرق الدفع
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="admin"
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-800/70 border border-slate-700 text-white rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-800/70 border border-slate-700 text-white rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{loginLoading ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={handleReturnToStudentStore}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لشاشة متجر الطلاب</span>
            </button>
            <span className="text-[11px] text-slate-600 font-mono">UniFood v1.0</span>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in Full-Screen Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* 1. Top Enterprise Header Bar */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-8 py-2.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" lightText />
            <div className="hidden md:block h-6 w-px bg-slate-800 shrink-0"></div>
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60 whitespace-nowrap shrink-0">
                لوحة الإدارة المركزية
              </span>
              <span className="text-xs text-slate-400 truncate">
                مرحباً، <span className="font-bold text-white">{adminUser.name}</span>
              </span>
            </div>
          </div>

          {/* Action Tools & Close/Return */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="h-9 flex items-center gap-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 whitespace-nowrap shrink-0"
              title="تحديث البيانات"
            >
              <RotateCw className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {/* زر العودة المباشر لمتجر الطلاب */}
            <button
              onClick={handleReturnToStudentStore}
              className="h-9 flex items-center gap-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95 whitespace-nowrap shrink-0"
              title="إغلاق والرجوع لشاشة الطلاب"
            >
              <Store className="w-4 h-4 text-white shrink-0" />
              <span>متجر الطلاب</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors border border-slate-800 hover:border-rose-900/50 shrink-0"
              title="تسجيل الخروج"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* 2. Top Analytics Metric Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">الفروع النشطة</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-400">{stats.activeBranches}</span>
                <span className="text-xs text-slate-500 font-mono">/ {stats.totalBranches}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">إجمالي الطلبات</span>
              <span className="text-2xl font-black text-indigo-400">{stats.totalOrders}</span>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">طلبات قيد التنفيذ</span>
              <span className="text-2xl font-black text-amber-400 animate-pulse">{stats.pendingOrders ?? 0}</span>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">المبيعات المكتملة</span>
              <span className="text-2xl font-black text-purple-400">{stats.totalSales} <span className="text-xs">ج.م</span></span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">الطلاب المسجلين</span>
              <span className="text-2xl font-black text-sky-400">{stats.totalStudents ?? students.length}</span>
            </div>
          </div>
        )}

        {/* 3. Navigation Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('BRANCHES')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'BRANCHES'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Building className="w-4 h-4 shrink-0" />
            <span>الفروع والمطاعم ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'ORDERS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>مراقبة طلبات الحرم الجامعي ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('STUDENTS')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'STUDENTS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>دليل الطلاب ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'ANALYTICS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>التقارير والإحصائيات المالية</span>
          </button>

          <button
            onClick={() => setActiveTab('BANNERS')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'BANNERS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            <span>الإعلانات والبانرات ({banners.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PROMOS')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'PROMOS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span>كوبونات الخصم ({promos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('WHATSAPP')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'WHATSAPP'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>بوت الواتساب و OTP</span>
            {whatsAppStatus?.isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`h-10 flex items-center gap-2 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'SETTINGS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0 text-purple-400" />
            <span>إعدادات النظام والأمان</span>
          </button>
        </div>


        {/* 4. Tab 1: Branches Management */}
        {activeTab === 'BRANCHES' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ابحث باسم المطعم أو موقعه بالجامعة..."
                  value={branchSearch}
                  onChange={e => setBranchSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                onClick={() => setShowAddBranchModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة فرع مطعم جديد</span>
              </button>
            </div>

            {/* Branches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBranches.map(branch => {
                const user = branch.users && branch.users[0];
                const payment = branch.paymentConfig;

                return (
                  <div
                    key={branch.id}
                    className={`p-5 rounded-2xl border transition-all bg-slate-900/60 ${
                      branch.isActive 
                        ? 'border-slate-800 hover:border-slate-700' 
                        : 'border-rose-950/40 bg-slate-950/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        {branch.logoUrl ? (
                          <img
                            src={getFullImageUrl(branch.logoUrl)}
                            alt={branch.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shrink-0">
                            <Store className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-base text-white">{branch.name}</h3>
                            {branch.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                نشط
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                                معطل
                              </span>
                            )}
                            {branch.slug && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-800" dir="ltr">
                                ?branch={branch.slug}
                              </span>
                            )}
                          </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          {branch.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>{branch.address}</span>
                            </span>
                          )}
                          {branch.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{branch.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                      {/* Quick Toggle Switch */}
                      <button
                        onClick={() => handleToggleStatus(branch.id, branch.isActive)}
                        className={`p-2 rounded-xl transition-all ${
                          branch.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 border border-emerald-800'
                            : 'bg-rose-950/60 text-rose-400 hover:bg-rose-900 border border-rose-800'
                        }`}
                        title={branch.isActive ? 'إيقاف الفرع مؤقتاً' : 'تفعيل الفرع'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 rounded-xl text-xs mb-3 font-mono border border-slate-900">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">رسوم التوصيل:</span>
                        <span className="font-bold text-slate-200">{branch.deliveryFee} ج.م</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">يوزر الديسكتوب:</span>
                        <span className="font-bold text-purple-400">{user?.username || 'غير معين'}</span>
                      </div>
                    </div>

                    {/* Payment methods badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4">
                      <span className="text-[10px] text-slate-500 font-bold ml-1">طرق الدفع:</span>
                      {payment?.cashEnabled && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-800 text-slate-300 font-bold">
                          كاش
                        </span>
                      )}
                      {payment?.vodafoneCashEnabled && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] bg-rose-950 text-rose-300 font-bold border border-rose-900">
                          فودافون كاش
                        </span>
                      )}
                      {payment?.instapayEnabled && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] bg-indigo-950 text-indigo-300 font-bold border border-indigo-900">
                          إنستاباي
                        </span>
                      )}
                      {payment?.cardEnabled && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] bg-emerald-950 text-emerald-300 font-bold border border-emerald-900">
                          فيزا/بطاقة
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditBranch(branch)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors"
                          title="تعديل بيانات الفرع"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleOpenPaymentSettings(branch)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors"
                          title="تخصيص طرق الدفع"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          <span>طرق الدفع</span>
                        </button>

                        <button
                          onClick={() => handleOpenCredentials(branch)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors"
                          title="تغيير يوزر وباسورد الديسكتوب"
                        >
                          <Key className="w-3.5 h-3.5 text-purple-400" />
                          <span>دخول الديسكتوب</span>
                        </button>

                        <button
                          onClick={() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                            const link = `${origin}/?branch=${branch.slug || branch.id}`;
                            navigator.clipboard.writeText(link);
                            alert(`تم نسخ رابط الطلب المباشر لمطعم (${branch.name}) بنجاح:\n${link}`);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-800/80 rounded-lg text-xs font-bold transition-colors"
                          title="نسخ الرابط المباشر للمطعم لمشاركته على السوشيال ميديا أو وضعه في بانر"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>رابط مباشر</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteBranch(branch)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="حذف الفرع"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Tab 2: Live Orders Board */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-bold ml-1">تصفية حسب الحالة:</span>
                {['ALL', 'PENDING', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      orderStatusFilter === st
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'ALL' && 'الكل'}
                    {st === 'PENDING' && 'جديدة'}
                    {st === 'PREPARING' && 'قيد التحضير'}
                    {st === 'READY' && 'جاهزة'}
                    {st === 'COMPLETED' && 'مكتملة'}
                    {st === 'REJECTED' && 'ملغية/مرفوضة'}
                  </button>
                ))}
              </div>

              {/* Branch Filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">الفرع:</span>
                <select
                  value={orderBranchFilter}
                  onChange={e => setOrderBranchFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">جميع فروع الجامعة</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Orders Feed */}
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h4 className="text-sm font-bold text-slate-400">لا توجد طلبات تطابق الفلترة المحددة</h4>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(order => {
                  const statusColors: any = {
                    PENDING: 'bg-amber-950 text-amber-300 border-amber-800',
                    ACCEPTED: 'bg-blue-950 text-blue-300 border-blue-800',
                    PREPARING: 'bg-indigo-950 text-indigo-300 border-indigo-800',
                    READY: 'bg-purple-950 text-purple-300 border-purple-800',
                    COMPLETED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
                    REJECTED: 'bg-rose-950 text-rose-300 border-rose-800',
                  };

                  const statusLabels: any = {
                    PENDING: 'طلب جديد',
                    ACCEPTED: 'مقبول',
                    PREPARING: 'جاري التحضير',
                    READY: 'جاهز للتسليم',
                    COMPLETED: 'تم التسليم',
                    REJECTED: 'مرفوض/ملغي',
                  };

                  return (
                    <div
                      key={order.id}
                      className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-white text-base">#{order.orderNumber}</span>
                          <span className="text-xs font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-900">
                            {order.branch?.name}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[order.status] || 'bg-slate-800 text-slate-300'}`}>
                            {statusLabels[order.status] || order.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="font-bold text-slate-200">{order.customerName}</span>
                          <span className="font-mono text-slate-400">{order.customerPhone}</span>
                          {order.addressText && (
                            <span className="text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                              📍 {order.addressText}
                            </span>
                          )}
                          <span className="text-slate-500 font-mono">
                            {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                            <Timer className="w-3 h-3 text-amber-400" />
                            <span>
                              {order.completedAt
                                ? `استغرق ${Math.max(0, Math.round((new Date(order.completedAt).getTime() - new Date(order.createdAt).getTime()) / 60000))} د`
                                : `منذ ${Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000))} د`}
                            </span>
                          </span>
                        </div>

                        {/* Items preview */}
                        <div className="text-xs text-slate-400 font-mono">
                          {order.items?.map((it: any) => `${it.quantity}x ${it.itemName}${it.sizeName ? ` (${it.sizeName})` : ''}`).join(' • ')}
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                        <div className="text-left">
                          <span className="text-base font-black text-white font-mono">{order.total} ج.م</span>
                          <span className="block text-[10px] text-slate-500">
                            {order.paymentMethod === 'CASH' && 'كاش'}
                            {order.paymentMethod === 'VODAFONE_CASH' && 'فودافون كاش'}
                            {order.paymentMethod === 'INSTAPAY' && 'إنستاباي'}
                            {order.paymentMethod === 'CARD' && 'فيزا'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {order.status === 'PENDING' && (
                            <button
                              onClick={() => handleAdminUpdateOrderStatus(order.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold rounded-lg border border-rose-800"
                            >
                              إلغاء الطلب
                            </button>
                          )}
                          {order.status === 'READY' && (
                            <button
                              onClick={() => handleAdminUpdateOrderStatus(order.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-800"
                            >
                              تسليم الطلب
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedOrderDetails(order)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                            title="تفاصيل الطلب الكاملة"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. Tab 3: Registered Students */}
        {activeTab === 'STUDENTS' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              <input
                type="text"
                placeholder="ابحث باسم الطالب أو رقم الهاتف..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStudents.map(student => (
                <div
                  key={student.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                    student.isBlocked
                      ? 'bg-rose-950/20 border-rose-900/60'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center font-black border border-purple-800 shrink-0">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-white text-sm">{student.name}</h4>
                          {student.isBlocked && (
                            <span className="text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded-full">
                              🚫 موقوف
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-slate-400 block">{student.phone}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                            المحفظة: {(student.walletBalance ?? 0).toFixed(0)} ج.م
                          </span>
                          <span className="text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
                            ★ {student.loyaltyPoints ?? 0} نقطة
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenStudentWallet(student)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-700/70 rounded-xl text-[10px] font-black transition-all active:scale-95"
                        title="إدارة المحفظة والملاحظات وحالة الحساب"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>إدارة الحساب</span>
                      </button>
                      <div className="text-center px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-900 font-mono w-full">
                        <span className="text-[10px] text-purple-400 font-black">{student._count?.orders ?? 0} </span>
                        <span className="text-[9px] text-slate-500 font-sans">طلبات</span>
                      </div>
                    </div>
                  </div>

                  {student.restaurantNotes && (
                    <div className="p-2 bg-purple-950/40 border border-purple-800/50 rounded-xl text-[11px] text-purple-200">
                      <span className="font-black text-purple-400">📌 ملاحظة: </span>
                      <span>{student.restaurantNotes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Tab 4: Analytics & Financial breakdown */}
        {activeTab === 'ANALYTICS' && (
          <div className="space-y-6">
            {/* Kitchen & Delivery Timings SLA Analytics */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-black text-sm text-white flex items-center gap-2">
                  <Timer className="w-4 h-4 text-amber-400" />
                  <span>مؤشرات سرعة إنجاز الطلبات والمطابخ (Kitchen & Delivery SLAs)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">متوسطات الأداء في الحرم الجامعي</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* سرعة قبول المطعم */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>سرعة قبول الطلب</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono text-white">
                      {stats?.timingStats?.avgAcceptanceMins ?? 0}
                    </span>
                    <span className="text-[11px] text-slate-400">دقيقة</span>
                  </div>
                  <p className="text-[10px] text-slate-500">متوسط استجابة المطعم لبدء التنفيذ</p>
                </div>

                {/* سرعة التجهيز والطهي */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>وقت تجهيز الوجبة</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono text-white">
                      {stats?.timingStats?.avgPrepMins ?? 0}
                    </span>
                    <span className="text-[11px] text-slate-400">دقيقة</span>
                  </div>
                  <p className="text-[10px] text-slate-500">متوسط وقت الطهي والإعداد بالمطبخ</p>
                </div>

                {/* سرعة التوصيل */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold">
                    <Truck className="w-3.5 h-3.5" />
                    <span>وقت التوصيل / التسليم</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono text-white">
                      {stats?.timingStats?.avgDeliveryMins ?? 0}
                    </span>
                    <span className="text-[11px] text-slate-400">دقيقة</span>
                  </div>
                  <p className="text-[10px] text-slate-500">متوسط وقت التوصيل لمباني الجامعة</p>
                </div>

                {/* إجمالي دورة الطلب */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>دورة الطلب الكاملة</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono text-white">
                      {stats?.timingStats?.avgTotalMins ?? 0}
                    </span>
                    <span className="text-[11px] text-slate-400">دقيقة</span>
                  </div>
                  <p className="text-[10px] text-slate-500">من إرسال الطالب حتى الاستلام</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Methods Breakdown */}
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
                <h4 className="font-black text-sm text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>توزيع المبيعات المكتملة حسب طرق الدفع</span>
                </h4>
                <div className="space-y-3">
                  {stats?.paymentMethods && stats.paymentMethods.length > 0 ? (
                    stats.paymentMethods.map((pm: any) => {
                      const methodNames: any = {
                        CASH: 'كاش عند الاستلام',
                        VODAFONE_CASH: 'فودافون كاش',
                        INSTAPAY: 'إنستاباي',
                        CARD: 'بطاقات دفع',
                      };
                      return (
                        <div key={pm.paymentMethod} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                          <span className="font-bold text-xs text-slate-300">
                            {methodNames[pm.paymentMethod] || pm.paymentMethod}
                          </span>
                          <div className="text-left font-mono">
                            <span className="font-black text-sm text-white">{pm._sum.total || 0} ج.م</span>
                            <span className="block text-[10px] text-slate-500">({pm._count.id} طلب)</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد عمليات مكتملة حتى الآن لتحليل طرق الدفع</p>
                  )}
                </div>
              </div>

              {/* Top Branches Performance */}
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
                <h4 className="font-black text-sm text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>الفروع الأكثر طلباً في الحرم الجامعي</span>
                </h4>
                <div className="space-y-3">
                  {stats?.branchPerformance && stats.branchPerformance.length > 0 ? (
                    stats.branchPerformance.map((bp: any, idx: number) => (
                      <div key={bp.id} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-950 text-purple-300 text-xs font-black flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-200">{bp.name}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-purple-400">
                          {bp._count.orders} طلب
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد بيانات متاحة حالياً</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. Tab 5: Banners Management */}
        {activeTab === 'BANNERS' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">الإعلانات والبانرات الترويجية</h3>
                <p className="text-xs text-slate-400">تظهر في الصفحة الرئيسية لمتجر الطلاب للترويج للعروض والشراكات</p>
              </div>

              <button
                onClick={() => setShowAddBannerModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة بانر إعلاني جديد</span>
              </button>
            </div>

            {banners.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30 text-purple-400" />
                <p className="text-xs font-bold text-slate-300">لا توجد إعلانات نشطة حالياً</p>
                <p className="text-[11px] text-slate-500 mt-1">اضغط على زر إضافة بانر لإنشاء أول إعلان يظهر للطلاب</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {banners.map((b) => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
                    <div>
                      {b.imageUrl ? (
                        <div className="h-36 w-full overflow-hidden bg-slate-950 relative">
                          <img
                            src={getFullImageUrl(b.imageUrl)}
                            alt={b.title}
                            className="w-full h-full object-cover"
                          />
                          {b.badgeText && (
                            <span className="absolute top-2 right-2 text-[10px] font-black bg-purple-600/90 text-white px-2.5 py-0.5 rounded-full shadow">
                              {b.badgeText}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-28 w-full bg-gradient-to-r from-purple-900 to-indigo-900 flex items-center justify-center p-4 relative">
                          {b.badgeText && (
                            <span className="absolute top-2 right-2 text-[10px] font-black bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                              {b.badgeText}
                            </span>
                          )}
                          <span className="text-2xl font-black text-white/50">UniFood Ads</span>
                        </div>
                      )}

                      <div className="p-4 space-y-1">
                        <h4 className="font-black text-sm text-white">{b.title}</h4>
                        {b.subtitle && <p className="text-xs text-slate-400">{b.subtitle}</p>}
                        {b.linkUrl && (
                          <p className="text-[10px] text-purple-400 font-mono truncate pt-1" dir="ltr">
                            🔗 {b.linkUrl}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleBanner(b.id, b.isActive)}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${
                          b.isActive
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {b.isActive ? 'مفعل ويظهر للطلاب' : 'معطل ومخفي'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditBanner(b)}
                          className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-950/50 rounded-lg transition-colors"
                          title="تعديل البانر"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(b.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="حذف البانر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 8. Tab 6: Promo Codes Management */}
        {activeTab === 'PROMOS' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">كوبونات وأكواد الخصم</h3>
                <p className="text-xs text-slate-400">إنشاء وتعديل أكواد الخصم مع تحديد الحد الأقصى لعدد مرات الاستخدام</p>
              </div>

              <button
                onClick={() => setShowAddPromoModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء كوبون جديد</span>
              </button>
            </div>

            {promos.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                <Tag className="w-12 h-12 mx-auto mb-2 opacity-30 text-purple-400" />
                <p className="text-xs font-bold text-slate-300">لا توجد كوبونات خصم حالياً</p>
                <p className="text-[11px] text-slate-500 mt-1">اضغط على زر إنشاء كوبون جديد لإنشاء كود خصم للطلاب</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {promos.map((p) => {
                  const isExhausted = p.maxUses && (p.usedCount || 0) >= p.maxUses;
                  return (
                    <div key={p.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start justify-between shadow-lg gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-base text-purple-300 tracking-wider bg-purple-950/80 px-2.5 py-0.5 rounded-lg border border-purple-800/60">
                            {p.code}
                          </span>
                          <button
                            onClick={() => handleTogglePromoStatus(p.id, p.isActive !== false)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                              p.isActive !== false && !isExhausted
                                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                                : 'text-rose-300 bg-rose-950/60 border-rose-800'
                            }`}
                          >
                            {isExhausted ? 'مكتمل العدد' : p.isActive !== false ? 'نشط' : 'معطل'}
                          </button>
                          {p.oncePerUser && (
                            <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full font-bold">
                              مرة واحدة للطالب
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 font-bold">
                          قيمة الخصم: {p.value} {p.discountType === 'PERCENT' || p.discountType === 'PERCENTAGE' ? '%' : 'ج.م'}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                          <span>
                            الاستخدام: <strong className="text-white">{p.usedCount ?? 0}</strong> / {p.maxUses ? p.maxUses : '∞ غير محدود'}
                          </span>
                          {p.minOrder > 0 && (
                            <span>• حد أدنى: {p.minOrder} ج.م</span>
                          )}
                        </div>

                        {(() => {
                          let branchNames: string[] = [];
                          if (p.applicableBranchIds) {
                            try {
                              const ids: string[] = typeof p.applicableBranchIds === 'string' ? JSON.parse(p.applicableBranchIds) : p.applicableBranchIds;
                              if (Array.isArray(ids) && ids.length > 0) {
                                branchNames = ids.map((id: string) => branches.find(b => b.id === id)?.name || id);
                              }
                            } catch {
                              branchNames = String(p.applicableBranchIds).split(',').map(s => s.trim()).filter(Boolean);
                            }
                          }
                          if (branchNames.length > 0) {
                            return (
                              <div className="flex items-center gap-1.5 text-[11px] text-purple-300 bg-purple-950/40 border border-purple-800/50 px-2 py-0.5 rounded-lg w-fit mt-1">
                                <span>🏪</span>
                                <span className="font-medium">مخصص لـ: {branchNames.join('، ')}</span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-lg w-fit mt-1">
                              <span>🌐</span>
                              <span className="font-medium">متاح لكافة الفروع والمطاعم</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditPromo(p)}
                          className="p-2 text-slate-400 hover:text-purple-300 hover:bg-purple-950/50 rounded-xl transition-colors"
                          title="تعديل الكوبون"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePromo(p.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
                          title="حذف الكوبون"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 7. Tab 6: WhatsApp Bot & Self-Hosted OTP */}
        {activeTab === 'WHATSAPP' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <span>بوابة واتساب الذاتية (Self-Hosted WhatsApp Gateway)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    إرسال أكواد التحقق (OTP) لاستعادة كلمات المرور وإشعارات الطلبات تلقائياً ومجاناً 100% عبر رقمك الخاص
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchWhatsAppStatus}
                  disabled={loadingWhatsApp}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWhatsApp ? 'animate-spin' : ''}`} />
                  <span>تحديث الحالة</span>
                </button>
              </div>

              {whatsAppStatus?.isConnected ? (
                <div className="space-y-5">
                  <div className="p-5 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                        ✅
                      </div>
                      <div>
                        <span className="text-sm font-black text-emerald-300 block">
                          الواتساب متصل ويعمل بنجاح!
                        </span>
                        <span className="text-xs text-slate-300 font-mono block mt-0.5">
                          الرقم النشط: {whatsAppStatus.botPhoneNumber || 'متصل'}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          الخادم جاهز لإرسال أكواد استعادة كلمة المرور وإشعارات الطلبات للطلاب تلقائياً.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnectWhatsApp}
                      className="px-4 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-black transition-all shrink-0"
                    >
                      فصل الجلسة / تغيير الرقم 🔌
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                      <span className="text-xs font-black text-slate-300 block mb-1">🔐 أكواد التحقق (OTP)</span>
                      <p className="text-[11px] text-slate-400">
                        ترسل أكواد استعادة كلمة المرور المكونة من 6 أرقام فوراً لأي طالب يطلبها.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                      <span className="text-xs font-black text-slate-300 block mb-1">⚡ تكلفة تشغيل 0 جنيه</span>
                      <p className="text-[11px] text-slate-400">
                        لا توجد أي رسوم أو اشتراكات لشركات وسيطة؛ الرسائل تخرج مباشرة عبر شريحتك الخاصة.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                      <span className="text-xs font-black text-slate-300 block mb-1">🛡️ حماية الحسابات</span>
                      <p className="text-[11px] text-slate-400">
                        تأكيد هوية الطالب بأنه صاحب الرقم الفعلي المسجل في المنظومة.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-center max-w-lg mx-auto py-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 text-xs font-black mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>بانتظار مسح رمز QR من هاتفك لربط الخدمة</span>
                  </div>

                  {whatsAppStatus?.qrCode ? (
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl border-4 border-emerald-500/30">
                        <img
                          src={whatsAppStatus.qrCode}
                          alt="WhatsApp QR Code"
                          className="w-56 h-56 mx-auto object-contain"
                        />
                      </div>

                      <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-right text-xs text-slate-300 space-y-2">
                        <span className="font-black text-emerald-400 block text-sm">خطوات الربط في 10 ثوانٍ:</span>
                        <p>1. افتح تطبيق واتساب على الهاتف الذي يحمل الشريحة المخصصة للإشعارات.</p>
                        <p>2. اضغط على القائمة (الثلاث نقاط أو الإعدادات) ➔ <strong>الأجهزة المرتبطة (Linked Devices)</strong>.</p>
                        <p>3. اضغط على <strong>ربط جهاز (Link a Device)</strong> ووجه الكاميرا لمسح الرمز أعلاه.</p>
                        <p className="text-[10px] text-slate-400">بمجرد المسح، سيتصل السيرفر فوراً ويبقى نشطاً دون الحاجة لتكرار هذه الخطوة.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-slate-400">جاري إنشاء رمز الاستجابة السريعة (QR Code)...</p>
                      <button
                        type="button"
                        onClick={fetchWhatsAppStatus}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                      >
                        تحديث الرمز
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Alerts Configuration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span>تنبيهات وإشعارات الواتساب للمشرفين والإدارة</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    إرسال رسائل واتساب تلقائية لأرقام الهواتف المحددة عند كنسلة أي مطعم لطلب، أو عند تأخر قبول أي طلب عن 5 دقائق
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 shrink-0 self-start sm:self-auto">
                  تنبيهات لحظية ⚡
                </span>
              </div>

              <form onSubmit={handleSaveWhatsAppAlertSettings} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Alert 1: Restaurant Order Cancellation */}
                  <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
                          🚨
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-200">إشعار عند كنسلة/إلغاء الطلب من المطعم</h4>
                          <span className="text-[10px] text-slate-400">تنبيه فوري عند رفض أي مطعم لطلب طالب</span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whatsAppAlertSettings.cancellationAlertEnabled}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, cancellationAlertEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        أرقام هواتف المشرفين لاستقبال تنبيه الإلغاء
                      </label>
                      <input
                        type="text"
                        value={whatsAppAlertSettings.cancellationAlertPhones}
                        onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, cancellationAlertPhones: e.target.value })}
                        placeholder="مثال: 01012345678, 01123456789"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors font-mono"
                      />
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        يمكنك كتابة رقم واحد أو عدة أرقام مفصولة بفاصلة (، أو ,). ستصلهم رسالة فورا تفيد بأن (المطعم كذا كنسل الطلب رقم كذا بقيمة كذا).
                      </p>
                    </div>
                  </div>

                  {/* Alert 2: Unaccepted / Delayed Orders (5+ minutes) */}
                  <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                          ⏳
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-200">إنذار عند تأخر قبول الطلب عن 5 دقائق</h4>
                          <span className="text-[10px] text-slate-400">تنبيه المشرفين إذا تأخر المطعم في الرد</span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whatsAppAlertSettings.unacceptedAlertEnabled}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, unacceptedAlertEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          أرقام هواتف المشرفين لمتابعة التأخر
                        </label>
                        <input
                          type="text"
                          value={whatsAppAlertSettings.unacceptedAlertPhones}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, unacceptedAlertPhones: e.target.value })}
                          placeholder="مثال: 01012345678, 01123456789"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          الحد الزمني (دقائق)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={whatsAppAlertSettings.unacceptedDelayMinutes}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, unacceptedDelayMinutes: parseInt(e.target.value) || 5 })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-center font-mono"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      يقوم السيرفر بفحص دوري تلقائي؛ في حال مرور المدة دون قبول الطلب من شاشة المطعم، يُرسل إنذار عاجل للأرقام أعلاه للتدخل السريع.
                    </p>
                  </div>

                  {/* 3. Shift Closing Daily Financial Report (التقرير المالي اليومي لإغلاق الشيفت) */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-200 block">
                            إرسال التقرير المالي اليومي آلياً عند إغلاق الشيفت
                          </span>
                          <span className="text-[10px] text-slate-400">
                            يُرسل في موعد إغلاق كل مطعم المحدد في لوحة الفروع
                          </span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whatsAppAlertSettings.dailyReportEnabled}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, dailyReportEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        أرقام هواتف استقبال التقرير المالي اليومي عبر الواتساب
                      </label>
                      <input
                        type="text"
                        value={whatsAppAlertSettings.dailyReportPhones}
                        onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, dailyReportPhones: e.target.value })}
                        placeholder="أدخل الأرقام مفصولة بفواصل (مثال: 01012345678, 01123456789)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        يتضمن التقرير: إجمالي المبيعات، رسوم التوصيل، المبالغ المحصلة كاش والمحافظ، عدد الطلبات المكتملة والملغاة، وقائمة بأعلى الوجبات مبيعاً.
                      </p>

                      <button
                        type="button"
                        onClick={() => handleTestSendShiftReport('ALL')}
                        disabled={testingShiftReport || !whatsAppAlertSettings.dailyReportPhones}
                        className="px-4 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-40"
                      >
                        {testingShiftReport ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>جاري الإرسال...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>إرسال تقرير الشيفت الآن (تجربة)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {shiftReportTestMsg && (
                      <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{shiftReportTestMsg}</span>
                      </div>
                    )}
                  </div>
                </div>


                {whatsAppAlertsSaveSuccess && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تم حفظ وتحديث إعدادات تنبيهات وأرقام الواتساب بنجاح!</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingWhatsAppAlerts || loadingWhatsAppAlerts}
                    className="px-6 h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {savingWhatsAppAlerts ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ إعدادات التنبيهات</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* 4.8 Tab: System & Security Settings */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6">
            {/* Header info banner */}
            <div className="bg-gradient-to-r from-purple-900/40 via-slate-900 to-indigo-900/40 border border-purple-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    إعدادات النظام وأمان المنظومة
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    التحكم في نظام نقاط الولاء والمكافآت، وتغيير كلمة مرور حساب الإدارة الرئيسية (SuperAdmin)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Card 1: Loyalty Points Settings */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">نظام نقاط الولاء والمكافآت</h4>
                      <p className="text-[11px] text-slate-400">إدارة تفعيل النقاط ونسب التحويل والاستبدال</p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                    loyaltySettings.enabled 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {loyaltySettings.enabled ? '● النظام مفعّل' : '○ النظام معطّل'}
                  </span>
                </div>

                <form onSubmit={handleSaveLoyaltySettings} className="space-y-5">
                  {/* Master Toggle */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-200 block">تشغيل نظام النقاط للطلاب</span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        عند الإلغاء، لن يتمكن الطلاب من جمع أو استبدال أي نقاط في التطبيق
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loyaltySettings.enabled}
                        onChange={(e) => setLoyaltySettings({ ...loyaltySettings, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Settings Inputs */}
                  <div className="space-y-4">
                    {/* Points Redemption Rate */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        سعر استبدال النقطة بالجنيه (EGP لكل نقطة)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          value={loyaltySettings.pointsRedemptionRate}
                          onChange={(e) => setLoyaltySettings({ ...loyaltySettings, pointsRedemptionRate: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                          required
                        />
                        <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-mono">ج.م / نقطة</span>
                      </div>
                      <div className="mt-2 p-2.5 bg-purple-950/40 border border-purple-800/40 rounded-xl text-[11px] text-purple-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>
                          مثال عملي: كل <strong>100 نقطة</strong> تعادل حالياً <strong>{(100 * loyaltySettings.pointsRedemptionRate).toFixed(1)} جنيه</strong> في محفظة الطالب.
                        </span>
                      </div>
                    </div>

                    {/* Min Points to Redeem */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        الحد الأدنى للنقاط المطلوب للاستبدال
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={loyaltySettings.minPointsToRedeem}
                        onChange={(e) => setLoyaltySettings({ ...loyaltySettings, minPointsToRedeem: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        أقل رصيد نقاط يجب أن يمتلكه الطالب حتى يتاح له زر تحويل النقاط لرصيد بالمحفظة (مثلاً 50 أو 100).
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Points per pound spent */}
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          النقاط المكتسبة لكل جنيه مصروف
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={loyaltySettings.pointsPerPound}
                          onChange={(e) => setLoyaltySettings({ ...loyaltySettings, pointsPerPound: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                          required
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">
                          كم نقطة يكسب الطالب عن كل 1 جنيه يدفعه بالطلب.
                        </span>
                      </div>

                      {/* Welcome Points */}
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          نقاط ترحيبية عند التسجيل
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={loyaltySettings.welcomePoints}
                          onChange={(e) => setLoyaltySettings({ ...loyaltySettings, welcomePoints: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                          required
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">
                          هدية ترحيبية فورية في حساب الطالب الجديد (0 لإلغائها).
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fraud prevention callout */}
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                      <strong>أمان النقاط مفعل برمجياً:</strong> يتم احتساب وإضافة النقاط إلى حساب الطالب فقط وفور تحويل حالة الطلب إلى <strong>(تم التسليم بنجاح / COMPLETED)</strong>، مما يمنع نهائياً أي تحايل عبر إنشاء طلبات وهمية أو ملغاة.
                    </p>
                  </div>

                  {loyaltySaveSuccess && (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>تم حفظ إعدادات نظام النقاط بنجاح ويسري مفعولها الآن!</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingLoyaltySettings || loadingLoyaltySettings}
                    className="w-full h-11 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
                  >
                    {savingLoyaltySettings ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ إعدادات النقاط</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Card 2: Change Admin Password */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">تغيير كلمة مرور الإدارة (SuperAdmin)</h4>
                    <p className="text-[11px] text-slate-400">تحديث كلمة السر للدخول إلى لوحة التحكم الرئيسية</p>
                  </div>
                </div>

                <form onSubmit={handleChangeAdminPassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      كلمة المرور الحالية
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={currentAdminPassword}
                        onChange={(e) => setCurrentAdminPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الحالية للتحقق"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                      <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="كلمة مرور جديدة (6 خانات على الأقل)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                        minLength={6}
                      />
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={confirmAdminPassword}
                        onChange={(e) => setConfirmAdminPassword(e.target.value)}
                        placeholder="أعد إدخال كلمة المرور الجديدة"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                        minLength={6}
                      />
                      <Check className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  {passwordChangeError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{passwordChangeError}</span>
                    </div>
                  )}

                  {passwordChangeSuccess && (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{passwordChangeSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordChangeLoading}
                      className="w-full h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {passwordChangeLoading ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>جاري التحديث...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-purple-400" />
                          <span>تحديث كلمة مرور الإدارة</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <span className="text-xs font-black text-slate-300 block">💡 نصائح أمنية</span>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li>استخدم مزيجاً من الحروف والأرقام لزيادة قوة كلمة المرور.</li>
                    <li>لا تشارك كلمة المرور مع مدراء الفروع؛ لكل فرع حسابه المستقل.</li>
                    <li>يتم تشفير كلمة المرور فوراً باستخدام تقنية Bcrypt مع Salt عالي الأمان.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Card 3: Factory Reset to Zero State (حالة الصفر) */}
            <div className="bg-rose-950/20 border border-rose-900/50 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-900/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>إعادة ضبط المصنع وتصفير بيانات التشغيل (حالة الصفر)</span>
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-black rounded-md border border-rose-500/30">
                        إجراء حساس ومحمي 🔒
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      حذف كافة الطلبات التجريبية وحسابات وسلات الطلاب لبدء التشغيل الفعلي من نقطة الصفر
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFactoryResetPassword('');
                    setFactoryResetError(null);
                    setFactoryResetSuccess(null);
                    setShowFactoryResetModal(true);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تصفير المشروع بحالة الصفر</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <span className="font-bold text-rose-300 block">🗑️ البيانات التي سيتم حذفها وتصفيرها:</span>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li>كافة الطلبات المسجلة بجميع حالاتها وعناصرها وسجلاتها.</li>
                    <li>كافة السلات الجماعية (سلة الشلة) المشتركة.</li>
                    <li>حسابات الطلاب التجريبية مع أرصدة المحافظ ونقاط الولاء والعناوين.</li>
                    <li>تصفير عداد استخدام كوبونات الخصم لتبدأ من 0.</li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <span className="font-bold text-emerald-300 block">🛡️ البيانات المحفوظة والآمنة التي لن تتأثر:</span>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li>حساب الإدارة الرئيسية (SuperAdmin) وكلمة المرور.</li>
                    <li>فروع المطاعم وبيانات الدخول الخاصة بها وإعدادات الدفع والتوصيل.</li>
                    <li>قوائم الطعام (المنيو) والأصناف والأسعار والإضافات والصور الثابتة.</li>
                    <li>البانرات الإعلانية وكوبونات الخصم وإعدادات المنظومة والواتساب.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 8. MODALS SECTION */}

      {/* A. Add Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-black text-base text-white">إضافة فرع مطعم جديد بالجامعة</h3>
              <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              {/* لوجو المطعم */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {newLogoUrl ? (
                    <img
                      src={getFullImageUrl(newLogoUrl)}
                      alt="لوجو"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">لوجو المطعم</span>
                    <span className="text-[10px] text-slate-400">صورة واضحة تظهر للطلاب في القائمة</span>
                  </div>
                </div>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingNewLogo ? 'جاري الرفع...' : (newLogoUrl ? 'تغيير' : 'رفع لوجو')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingNewLogo}
                    onChange={handleUploadNewLogo}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المطعم / الفرع *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="مثال: شاورما الجامعة"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  معرف الرابط المباشر للمطعم (Slug / Endpoint)
                </label>
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="text-xs font-mono text-purple-400 select-none" dir="ltr">?branch=</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="مثال: shawarma-elreem"
                    className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">يسمح بمشاركة رابط مباشر للمطعم عبر واتساب أو فيسبوك أو QR Code</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">موقع المبنى بالجامعة</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    placeholder="مجمع الكليات النظرية"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم هاتف الفرع</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رسوم التوصيل لمباني الكليات (ج.م)</label>
                <input
                  type="number"
                  value={newDeliveryFee}
                  onChange={e => setNewDeliveryFee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl space-y-3">
                <span className="text-[11px] font-bold text-purple-300 block">بيانات دخول تطبيق الديسكتوب للكاشير:</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="اسم المستخدم"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  إنشاء الفرع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. Edit Branch Details Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-black text-base text-white">تعديل بيانات: {editingBranch.name}</h3>
              <button onClick={() => setEditingBranch(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBranch} className="space-y-4">
              {/* لوجو المطعم */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {editLogoUrl ? (
                    <img
                      src={getFullImageUrl(editLogoUrl)}
                      alt="لوجو"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">لوجو المطعم</span>
                    <span className="text-[10px] text-slate-400">تحديث شعار الفرع</span>
                  </div>
                </div>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingEditLogo ? 'جاري الرفع...' : (editLogoUrl ? 'تغيير' : 'رفع لوجو')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingEditLogo}
                    onChange={handleUploadEditLogo}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المطعم *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  معرف الرابط المباشر للمطعم (Slug / Endpoint)
                </label>
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="text-xs font-mono text-purple-400 select-none" dir="ltr">?branch=</span>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="مثال: shawarma-elreem"
                    className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">يسمح بمشاركة رابط مباشر للمطعم عبر واتساب أو فيسبوك أو QR Code</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">موقع المبنى بالحرم الجامعي</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رسوم التوصيل (ج.م)</label>
                <input
                  type="number"
                  value={editDeliveryFee}
                  onChange={e => setEditDeliveryFee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAllowDelivery}
                    onChange={e => setEditAllowDelivery(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  <span className="text-xs font-bold text-slate-300">إتاحة التوصيل لمباني الجامعة</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAllowPickup}
                    onChange={e => setEditAllowPickup(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  <span className="text-xs font-bold text-slate-300">إتاحة الاستلام من الفرع</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. Payment Config Modal */}
      {editingPaymentBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-black text-base text-white">طرق الدفع: {editingPaymentBranch.name}</h3>
              <button onClick={() => setEditingPaymentBranch(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentSettings} className="space-y-4">
              {/* Cash */}
              <div className="p-3 bg-slate-800/70 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-white block">الدفع كاش عند الاستلام</span>
                  <span className="text-[11px] text-slate-400">يقوم الطالب بالدفع نقداً لمندوب المطعم أو الكاشير</span>
                </div>
                <input
                  type="checkbox"
                  checked={cashEnabled}
                  onChange={e => setCashEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
              </div>

              {/* Vodafone Cash */}
              <div className="p-3 bg-slate-800/70 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-rose-300">فودافون كاش ومحافظ الهاتف</span>
                  <input
                    type="checkbox"
                    checked={vodafoneCashEnabled}
                    onChange={e => setVodafoneCashEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600"
                  />
                </div>
                {vodafoneCashEnabled && (
                  <input
                    type="tel"
                    value={vodafoneCashNumber}
                    onChange={e => setVodafoneCashNumber(e.target.value)}
                    placeholder="رقم محفظة كاش الخاصة بالمطعم (مثال: 01012345678)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                )}
              </div>

              {/* InstaPay */}
              <div className="p-3 bg-slate-800/70 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-300">إنستاباي (InstaPay)</span>
                  <input
                    type="checkbox"
                    checked={instapayEnabled}
                    onChange={e => setInstapayEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                </div>
                {instapayEnabled && (
                  <input
                    type="text"
                    value={instapayHandle}
                    onChange={e => setInstapayHandle(e.target.value)}
                    placeholder="معرف إنستاباي للمطعم (مثال: restaurant@instapay)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                )}
              </div>

              {/* Card */}
              <div className="p-3 bg-slate-800/70 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-emerald-300 block">بطاقات بنكية أونلاين (Visa / MasterCard)</span>
                  <span className="text-[11px] text-slate-400">بوابة الدفع الإلكتروني</span>
                </div>
                <input
                  type="checkbox"
                  checked={cardEnabled}
                  onChange={e => setCardEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPaymentBranch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black"
                >
                  حفظ طرق الدفع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* D. Desktop Credentials Modal */}
      {editingCredentialsBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-black text-base text-white">حساب الديسكتوب: {editingCredentialsBranch.name}</h3>
              <button onClick={() => setEditingCredentialsBranch(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم للفرع</label>
                <input
                  type="text"
                  required
                  value={credUsername}
                  onChange={e => setCredUsername(e.target.value)}
                  placeholder="مثال: burger_branch"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  value={credPassword}
                  onChange={e => setCredPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور جديدة"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCredentialsBranch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  تحديث البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E. Order Details Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">تفاصيل الطلب #{selectedOrderDetails.orderNumber}</h3>
                <span className="text-xs text-purple-400 bg-purple-950 px-2 py-0.5 rounded-md">
                  {selectedOrderDetails.branch?.name}
                </span>
              </div>
              <button onClick={() => setSelectedOrderDetails(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student & Location */}
            <div className="p-3 bg-slate-950 rounded-xl space-y-1 text-xs border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">الطالب:</span>
                <span className="font-bold text-white">{selectedOrderDetails.customerName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">الهاتف:</span>
                <span className="text-slate-200">{selectedOrderDetails.customerPhone}</span>
              </div>
              {selectedOrderDetails.addressText && (
                <div className="flex justify-between">
                  <span className="text-slate-400">المكان بالجامعة:</span>
                  <span className="text-amber-300 font-bold">{selectedOrderDetails.addressText}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">طريقة الدفع:</span>
                <span className="font-bold text-slate-200">{selectedOrderDetails.paymentMethod}</span>
              </div>
            </div>

            {/* Stage Timings Breakdown in Admin Details Modal */}
            <div className="p-3 bg-slate-950 rounded-xl space-y-2 text-xs border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                <span className="flex items-center gap-1 text-purple-300">
                  <Timer className="w-3.5 h-3.5" />
                  <span>سجل توقيت مراحل الطلب</span>
                </span>
                {selectedOrderDetails.completedAt && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    إجمالي: {Math.max(0, Math.round((new Date(selectedOrderDetails.completedAt).getTime() - new Date(selectedOrderDetails.createdAt).getTime()) / 60000))} دقيقة
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-slate-900 rounded-lg space-y-0.5">
                  <span className="text-slate-500 block">وقت إنشاء الطلب:</span>
                  <span className="font-mono text-white font-bold">
                    {new Date(selectedOrderDetails.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg space-y-0.5">
                  <span className="text-slate-500 block">وقت قبول المطعم:</span>
                  <span className="font-mono text-white font-bold">
                    {selectedOrderDetails.acceptedAt
                      ? new Date(selectedOrderDetails.acceptedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      : 'بانتظار القبول'}
                  </span>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg space-y-0.5">
                  <span className="text-slate-500 block">وقت الجاهزية / خروج:</span>
                  <span className="font-mono text-white font-bold">
                    {selectedOrderDetails.readyAt
                      ? new Date(selectedOrderDetails.readyAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      : 'قيد التحضير'}
                  </span>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg space-y-0.5">
                  <span className="text-slate-500 block">وقت التسليم النهائي:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {selectedOrderDetails.completedAt
                      ? new Date(selectedOrderDetails.completedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      : 'لم يكتمل بعد'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 block">الأصناف المطلوبة:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedOrderDetails.items?.map((it: any) => (
                  <div key={it.id} className="p-2.5 bg-slate-800/60 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-black text-white">{it.quantity}x {it.itemName}</span>
                      {it.sizeName && <span className="text-purple-300 mr-1 font-mono">({it.sizeName})</span>}
                    </div>
                    <span className="font-mono font-bold text-slate-200">{it.totalPrice} ج.م</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl flex justify-between items-center font-mono">
              <span className="text-xs font-sans text-purple-200">الإجمالي الكلي:</span>
              <span className="text-lg font-black text-white">{selectedOrderDetails.total} ج.م</span>
            </div>

            <button
              onClick={() => setSelectedOrderDetails(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* D. Add Banner Modal */}
      {showAddBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">إضافة بانر إعلاني جديد</h3>
              </div>
              <button onClick={() => setShowAddBannerModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBanner} className="space-y-4">
              {/* صورة الإعلان */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {newBannerImageUrl ? (
                    <img
                      src={getFullImageUrl(newBannerImageUrl)}
                      alt="معاينة"
                      className="w-16 h-12 rounded-lg object-cover border border-slate-700 bg-slate-800"
                    />
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">صورة البانر</span>
                    <span className="text-[10px] text-slate-400">بانر عريض جذاب (اختياري)</span>
                  </div>
                </div>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingBannerImage ? 'جاري الرفع...' : (newBannerImageUrl ? 'تغيير الصورة' : 'رفع صورة')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingBannerImage}
                    onChange={handleUploadBannerImage}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">عنوان الإعلان الرئيسي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خصم 20% على جميع وجبات البرجر اليوم!"
                  value={newBannerTitle}
                  onChange={e => setNewBannerTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الوصف الفرعي (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: اطلب الآن واستلم في أقل من 15 دقيقة داخل كليتك"
                  value={newBannerSubtitle}
                  onChange={e => setNewBannerSubtitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نص الشارة العلوية (Badge)</label>
                  <input
                    type="text"
                    value={newBannerBadge}
                    onChange={e => setNewBannerBadge(e.target.value)}
                    placeholder="مثال: عرض خاص ⚡"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رابط التوجيه أو المطعم (اختياري)</label>
                  <input
                    type="text"
                    value={newBannerLink}
                    onChange={e => setNewBannerLink(e.target.value)}
                    placeholder="مثال: ?branch=shawarma&item=item_id"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    يمكنك وضع رابط مباشر لمطعم أو صنف محدد ليفتح شاشة الطلب مباشرة عند النقر!
                  </p>
                  {branches.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-400 ml-1">ربط سريع بمطعم:</span>
                      {branches.slice(0, 5).map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setNewBannerLink(`?branch=${b.slug || b.id}`)}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-purple-900/50 text-purple-300 border border-slate-700 transition-colors"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBannerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  حفظ ونشر الإعلان
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* D2. Edit Banner Modal */}
      {editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">تعديل البانر الإعلاني</h3>
              </div>
              <button onClick={() => setEditingBanner(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBanner} className="space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {editBannerImageUrl ? (
                    <img
                      src={getFullImageUrl(editBannerImageUrl)}
                      alt="معاينة"
                      className="w-16 h-12 rounded-lg object-cover border border-slate-700 bg-slate-800"
                    />
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">صورة البانر</span>
                    <span className="text-[10px] text-slate-400">تحديث صورة الإعلان</span>
                  </div>
                </div>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingEditBannerImage ? 'جاري الرفع...' : 'تغيير الصورة'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingEditBannerImage}
                    onChange={handleUploadEditBannerImage}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">عنوان الإعلان الرئيسي *</label>
                <input
                  type="text"
                  required
                  value={editBannerTitle}
                  onChange={e => setEditBannerTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الوصف الفرعي (اختياري)</label>
                <input
                  type="text"
                  value={editBannerSubtitle}
                  onChange={e => setEditBannerSubtitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نص الشارة العلوية (Badge)</label>
                  <input
                    type="text"
                    value={editBannerBadge}
                    onChange={e => setEditBannerBadge(e.target.value)}
                    placeholder="مثال: عرض خاص ⚡"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رابط التوجيه أو المطعم (اختياري)</label>
                  <input
                    type="text"
                    value={editBannerLink}
                    onChange={e => setEditBannerLink(e.target.value)}
                    placeholder="مثال: ?branch=shawarma&item=item_id"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    يمكنك وضع رابط مباشر لمطعم أو صنف محدد ليفتح شاشة الطلب مباشرة عند النقر!
                  </p>
                  {branches.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-400 ml-1">ربط سريع بمطعم:</span>
                      {branches.slice(0, 5).map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setEditBannerLink(`?branch=${b.slug || b.id}`)}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-purple-900/50 text-purple-300 border border-slate-700 transition-colors"
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editBannerActive}
                  onChange={e => setEditBannerActive(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <span className="text-xs font-bold text-slate-200">مفعل ويظهر للطلاب في الصفحة الرئيسية</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E. Add Promo Code Modal */}
      {showAddPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">إنشاء كوبون خصم جديد</h3>
              </div>
              <button onClick={() => setShowAddPromoModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كود الكوبون (رمز الخصم) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: UNI20 أو STUDENT15"
                  value={newPromoCode}
                  onChange={e => setNewPromoCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 uppercase font-mono font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع الخصم</label>
                  <select
                    value={newPromoType}
                    onChange={e => setNewPromoType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="FIXED">مبلغ ثابت (ج.م)</option>
                    <option value="PERCENT">نسبة مئوية (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">قيمة الخصم *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={newPromoValue}
                    onChange={e => setNewPromoValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الحد الأدنى للطلب (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPromoMinOrder}
                    onChange={e => setNewPromoMinOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">أقصى عدد مرات الاستخدام</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="غير محدود (∞)"
                    value={newPromoMaxUses}
                    onChange={e => setNewPromoMaxUses(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPromoOncePerUser}
                  onChange={e => setNewPromoOncePerUser(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">متاح للاستخدام مرة واحدة فقط لكل طالب</span>
                  <span className="text-[10px] text-slate-400">يمنع نفس الطالب من استخدام الكوبون أكثر من مرة</span>
                </div>
              </label>

              {/* Branch Applicability Scope */}
              <div className="p-3 bg-slate-800/80 rounded-xl space-y-2 border border-slate-700/60">
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  نطاق صلاحية الكوبون (الفروع والمطاعم)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPromoScope('ALL');
                      setNewPromoBranchIds([]);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                      newPromoScope === 'ALL'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>🌐</span>
                    <span>كافة الفروع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPromoScope('SPECIFIC')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                      newPromoScope === 'SPECIFIC'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>🏪</span>
                    <span>فروع محددة</span>
                  </button>
                </div>

                {newPromoScope === 'SPECIFIC' && (
                  <div className="pt-2 border-t border-slate-700/60 mt-2 space-y-1.5">
                    <p className="text-[11px] text-slate-400 font-bold mb-1">اختر الفروع التي يعمل بها الكوبون:</p>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {branches.map(b => {
                        const isChecked = newPromoBranchIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors border ${
                              isChecked
                                ? 'bg-purple-950/50 border-purple-800 text-purple-200 font-bold'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewPromoBranchIds(prev => [...prev, b.id]);
                                } else {
                                  setNewPromoBranchIds(prev => prev.filter(id => id !== b.id));
                                }
                              }}
                              className="rounded text-purple-600 focus:ring-0"
                            />
                            <span>{b.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {newPromoBranchIds.length === 0 && (
                      <p className="text-[10px] text-amber-400 font-bold">⚠️ يرجى تحديد فرع واحد على الأقل، أو اختيار "كافة الفروع"</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPromoModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  إنشاء الكوبون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E2. Edit Promo Code Modal */}
      {editingPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">تعديل كوبون الخصم: {editingPromo.code}</h3>
              </div>
              <button onClick={() => setEditingPromo(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPromo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كود الكوبون (رمز الخصم) *</label>
                <input
                  type="text"
                  required
                  value={editPromoCode}
                  onChange={e => setEditPromoCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 uppercase font-mono font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع الخصم</label>
                  <select
                    value={editPromoType}
                    onChange={e => setEditPromoType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="FIXED">مبلغ ثابت (ج.م)</option>
                    <option value="PERCENT">نسبة مئوية (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">قيمة الخصم *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={editPromoValue}
                    onChange={e => setEditPromoValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الحد الأدنى للطلب (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPromoMinOrder}
                    onChange={e => setEditPromoMinOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">أقصى عدد مرات الاستخدام</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="غير محدود (∞)"
                    value={editPromoMaxUses}
                    onChange={e => setEditPromoMaxUses(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPromoOncePerUser}
                  onChange={e => setEditPromoOncePerUser(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">متاح للاستخدام مرة واحدة فقط لكل طالب</span>
                  <span className="text-[10px] text-slate-400">يمنع نفس الطالب من استخدام الكوبون أكثر من مرة</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPromoActive}
                  onChange={e => setEditPromoActive(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <span className="text-xs font-bold text-slate-200">تفعيل الكوبون للطلاب</span>
              </label>

              {/* Branch Applicability Scope */}
              <div className="p-3 bg-slate-800/80 rounded-xl space-y-2 border border-slate-700/60">
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  نطاق صلاحية الكوبون (الفروع والمطاعم)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPromoScope('ALL');
                      setEditPromoBranchIds([]);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                      editPromoScope === 'ALL'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>🌐</span>
                    <span>كافة الفروع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPromoScope('SPECIFIC')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                      editPromoScope === 'SPECIFIC'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>🏪</span>
                    <span>فروع محددة</span>
                  </button>
                </div>

                {editPromoScope === 'SPECIFIC' && (
                  <div className="pt-2 border-t border-slate-700/60 mt-2 space-y-1.5">
                    <p className="text-[11px] text-slate-400 font-bold mb-1">اختر الفروع التي يعمل بها الكوبون:</p>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {branches.map(b => {
                        const isChecked = editPromoBranchIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors border ${
                              isChecked
                                ? 'bg-purple-950/50 border-purple-800 text-purple-200 font-bold'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditPromoBranchIds(prev => [...prev, b.id]);
                                } else {
                                  setEditPromoBranchIds(prev => prev.filter(id => id !== b.id));
                                }
                              }}
                              className="rounded text-purple-600 focus:ring-0"
                            />
                            <span>{b.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {editPromoBranchIds.length === 0 && (
                      <p className="text-[10px] text-amber-400 font-bold">⚠️ يرجى تحديد فرع واحد على الأقل، أو اختيار "كافة الفروع"</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPromo(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* F. Student Wallet & Loyalty Points Top-Up Modal */}
      {editingStudentWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-black text-sm text-white">شحن محفظة الطالب: {editingStudentWallet.name}</h3>
                  <span className="text-[11px] text-slate-400 font-mono block">{editingStudentWallet.phone}</span>
                </div>
              </div>
              <button onClick={() => setEditingStudentWallet(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentWallet} className="space-y-4">
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-emerald-300">رصيد المحفظة النقدية (ج.م)</label>
                  <span className="text-[10px] text-slate-500">يُخصم مباشرة عند الدفع</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={editStudentBalance}
                  onChange={e => setEditStudentBalance(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-500 font-mono font-black"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 ml-1">شحن سريع:</span>
                  {[10, 20, 50, 100].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setEditStudentBalance(String((parseFloat(editStudentBalance) || 0) + amt))}
                      className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/70 rounded-lg text-[10px] font-black font-mono transition-all active:scale-95"
                    >
                      +{amt} ج.م
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-amber-300">نقاط الولاء الجامعية (★ نقطة)</label>
                  <span className="text-[10px] text-slate-500">كل 1 نقطة = 1 ج.م</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={editStudentPoints}
                  onChange={e => setEditStudentPoints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-amber-500 font-mono font-black"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 ml-1">إهداء نقاط:</span>
                  {[10, 25, 50].map(pts => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setEditStudentPoints(String((parseInt(editStudentPoints) || 0) + pts))}
                      className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/70 rounded-lg text-[10px] font-black font-mono transition-all active:scale-95"
                    >
                      +{pts} ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <label className="block text-xs font-black text-purple-300">
                  📌 ملاحظات مسجلة على رقم الطالب (تظهر للكاشير عند الطلب)
                </label>
                <textarea
                  rows={2}
                  placeholder="أضف ملاحظة حول الطالب أو سجل طلباته السابقة..."
                  value={editStudentNotes}
                  onChange={e => setEditStudentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-purple-300">
                    🔑 تعيين كلمة مرور جديدة للطالب (اختياري)
                  </label>
                  <span className="text-[10px] text-slate-500">في حال نسيان الباسورد</span>
                </div>
                <input
                  type="text"
                  placeholder="اتركه فارغاً إذا كنت لا ترغب بتغيير كلمة المرور"
                  value={editStudentPassword}
                  onChange={e => setEditStudentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <label className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                editStudentBlocked
                  ? 'bg-rose-950/50 border-rose-800 text-rose-200'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={editStudentBlocked}
                  onChange={e => setEditStudentBlocked(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-black text-rose-400 block">🚫 إيقاف وحظر هذا الحساب من الطلب</span>
                  <span className="text-[10px] text-slate-400 block">يمنع هذا الرقم من إرسال أي طلبات جديدة</span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudentWallet(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingStudentWallet}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  {savingStudentWallet ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* G. Factory Reset Confirmation Modal (حالة الصفر) */}
      {showFactoryResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-rose-800/80 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">تصفير النظام وإعادته لحالة الصفر</h3>
                  <span className="text-[11px] text-rose-400 font-bold block">تحذير أمني: هذا الإجراء لا يمكن التراجع عنه</span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!factoryResetLoading) {
                    setShowFactoryResetModal(false);
                    setFactoryResetError(null);
                  }
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-2xl space-y-2 text-xs">
              <p className="text-rose-200 leading-relaxed font-semibold">
                ⚠️ سيتم حذف جميع الطلبات التجريبية وسلات الشلة وحسابات الطلاب.
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                ستبقى فروع المطاعم والمنيو وأسعار الوجبات وحساب الإدارة الرئيسية محفوظاً بالكامل دون أي مساس.
              </p>
            </div>

            <form onSubmit={handleExecuteFactoryReset} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1.5">
                  أدخل كلمة مرور الإدارة (SuperAdmin) للتأكيد:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={factoryResetPassword}
                    onChange={(e) => setFactoryResetPassword(e.target.value)}
                    placeholder="كلمة مرور الإدارة الحالية..."
                    required
                    disabled={factoryResetLoading}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                </div>
              </div>

              {factoryResetError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{factoryResetError}</span>
                </div>
              )}

              {factoryResetSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{factoryResetSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={factoryResetLoading}
                  onClick={() => setShowFactoryResetModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  disabled={factoryResetLoading || !factoryResetPassword}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-rose-600/30 disabled:opacity-40"
                >
                  {factoryResetLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>جاري التصفير والحذف...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>تأكيد تصفير البيانات الآن</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

