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
  Truck
} from 'lucide-react';
import { API_BASE_URL, api, getFullImageUrl } from '../services/api';
import { Logo } from './Logo';

export const AdminPage: React.FC = () => {
  const [adminUser, setAdminUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('customer_user');
    const token = localStorage.getItem('customer_token');
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
  const [activeTab, setActiveTab] = useState<'BRANCHES' | 'ORDERS' | 'STUDENTS' | 'ANALYTICS' | 'BANNERS' | 'PROMOS'>('BRANCHES');

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

  // Edit Promo Form
  const [editPromoCode, setEditPromoCode] = useState('');
  const [editPromoType, setEditPromoType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [editPromoValue, setEditPromoValue] = useState('15');
  const [editPromoMinOrder, setEditPromoMinOrder] = useState('50');
  const [editPromoMaxUses, setEditPromoMaxUses] = useState('');
  const [editPromoOncePerUser, setEditPromoOncePerUser] = useState(false);
  const [editPromoActive, setEditPromoActive] = useState(true);

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
  const [savingStudentWallet, setSavingStudentWallet] = useState(false);

  // Add Branch Form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [uploadingNewLogo, setUploadingNewLogo] = useState(false);
  const [newDeliveryFee, setNewDeliveryFee] = useState('10');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Edit Branch Form
  const [editName, setEditName] = useState('');
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

  const token = localStorage.getItem('customer_token');

  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('customer_token')}`,
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
      });
      if (res.promoCode) {
        setPromos([res.promoCode, ...promos]);
        setShowAddPromoModal(false);
        setNewPromoCode('');
        setNewPromoValue('15');
        setNewPromoMinOrder('50');
        setNewPromoMaxUses('');
        setNewPromoOncePerUser(false);
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
  };

  const handleSaveStudentWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentWallet) return;
    try {
      setSavingStudentWallet(true);
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

      localStorage.setItem('customer_token', data.token);
      localStorage.setItem('customer_user', JSON.stringify(data.user));
      setAdminUser(data.user);
    } catch (err: any) {
      setLoginError(err.message || 'بيانات دخول الأدمن غير صحيحة');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
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
          phone: editPhone.trim() || null,
          address: editAddress.trim() || null,
          logoUrl: editLogoUrl.trim() || null,
          deliveryFee: parseFloat(editDeliveryFee) || 10,
          allowDelivery: editAllowDelivery,
          allowPickup: editAllowPickup,
        }),
      });
      if (!res.ok) throw new Error('فشل تحديث بيانات الفرع');
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
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-8 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <Logo size="sm" lightText />
            <div className="hidden sm:block h-6 w-px bg-slate-800"></div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                لوحة الإدارة المركزية
              </span>
              <span className="text-xs text-slate-400">
                مرحباً، <span className="font-bold text-white">{adminUser.name}</span>
              </span>
            </div>
          </div>

          {/* Action Tools & Close/Return */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700"
              title="تحديث البيانات"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {/* زر العودة المباشر لمتجر الطلاب */}
            <button
              onClick={handleReturnToStudentStore}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95"
              title="إغلاق والرجوع لشاشة الطلاب"
            >
              <Store className="w-4 h-4 text-white" />
              <span>العودة لمتجر الطلاب</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors border border-transparent hover:border-rose-900/50"
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
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('BRANCHES')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'BRANCHES'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>الفروع والمطاعم ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'ORDERS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>مراقبة طلبات الحرم الجامعي ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('STUDENTS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'STUDENTS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>دليل الطلاب ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${
              activeTab === 'ANALYTICS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>التقارير والإحصائيات المالية</span>
          </button>

          <button
            onClick={() => setActiveTab('BANNERS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${
              activeTab === 'BANNERS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>الإعلانات والبانرات ({banners.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PROMOS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${
              activeTab === 'PROMOS'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>كوبونات الخصم ({promos.length})</span>
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
                  <label className="block text-xs font-bold text-slate-300 mb-1">رابط أو مطعم محدد (اختياري)</label>
                  <input
                    type="text"
                    value={newBannerLink}
                    onChange={e => setNewBannerLink(e.target.value)}
                    placeholder="رابط صفحة أو مطعم"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
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
                  <label className="block text-xs font-bold text-slate-300 mb-1">رابط أو مطعم محدد (اختياري)</label>
                  <input
                    type="text"
                    value={editBannerLink}
                    onChange={e => setEditBannerLink(e.target.value)}
                    placeholder="رابط صفحة أو مطعم"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
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

    </div>
  );
};
