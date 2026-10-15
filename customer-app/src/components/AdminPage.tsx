import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Phone, 
  User,
  ArrowLeft, 
  Store, 
  ArrowRight, 
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus, 
  Power, 
  LogOut,
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
  Send,
  MoreHorizontal,
  Star,
  ChevronDown,
  Award,
  ThumbsUp,
  Volume2,
  VolumeX,
  Music,
  BellRing,
  Calendar,
  FileSpreadsheet,
  Download,
  Wallet,
  Coins
} from 'lucide-react';


import { API_BASE_URL, api, getFullImageUrl } from '../services/api';
import { isRunningInNativeApk, triggerInstallApp } from '../services/notifications';
import { Logo } from './Logo';
const QUICK_ADMIN_CANCEL_REASONS = [
  'المطعم مغلق حالياً',
  'نفاد الكمية في المطعم',
  'العميل طلب إلغاء الطلب',
  'عدم توفر كابتن توصيل متاح',
  'العنوان غير مدعوم أو خارج نطاق الحرم',
  'تأخر تحضير الطلب في المطعم',
];

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
  const [activeTab, setActiveTab] = useState<'BRANCHES' | 'ORDERS' | 'FINANCE' | 'DRIVERS' | 'REVIEWS' | 'STUDENTS' | 'ANALYTICS' | 'BANNERS' | 'PROMOS' | 'WHATSAPP' | 'SETTINGS'>('BRANCHES');
  const [whatsAppStatus, setWhatsAppStatus] = useState<any | null>(null);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsContainerRef.current) return;
    // In RTL, scrollBy direction depends on browser implementation, so we can support both
    const amount = direction === 'left' ? -260 : 260;
    tabsContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

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

  // Notification Sound Customization Settings
  const [soundSettings, setSoundSettings] = useState<{
    enabled: boolean;
    soundUrl: string;
    soundName: string;
    volume: number;
  }>({
    enabled: true,
    soundUrl: '',
    soundName: 'النغمة الافتراضية للنظام (Synthetic Chime)',
    volume: 1.0,
  });
  const [loadingSoundSettings, setLoadingSoundSettings] = useState(false);
  const [savingSoundSettings, setSavingSoundSettings] = useState(false);
  const [soundSaveSuccess, setSoundSaveSuccess] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // WhatsApp Alert Settings states
  const [whatsAppAlertSettings, setWhatsAppAlertSettings] = useState<{
    cancellationAlertPhones: string;
    cancellationAlertEnabled: boolean;
    unacceptedAlertPhones: string;
    unacceptedAlertEnabled: boolean;
    unacceptedDelayMinutes: number;
    driverUnacceptedAlertEnabled: boolean;
    driverUnacceptedDelayMinutes: number;
    dailyReportPhones: string;
    dailyReportEnabled: boolean;
  }>({
    cancellationAlertPhones: '',
    cancellationAlertEnabled: true,
    unacceptedAlertPhones: '',
    unacceptedAlertEnabled: true,
    unacceptedDelayMinutes: 5,
    driverUnacceptedAlertEnabled: true,
    driverUnacceptedDelayMinutes: 3,
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
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsStats, setReviewsStats] = useState<any>({
    totalReviews: 0,
    withTextCount: 0,
    averageRating: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewBranchFilter, setReviewBranchFilter] = useState('ALL');
  const [reviewRatingFilter, setReviewRatingFilter] = useState('ALL');
  const [reviewOnlyWithText, setReviewOnlyWithText] = useState(false);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const [expandedReviewOrderId, setExpandedReviewOrderId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
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

  // Delivery Drivers Management States
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverScopeFilter, setDriverScopeFilter] = useState<'ALL' | 'GENERAL' | 'SPECIFIC' | 'INACTIVE'>('ALL');
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);

  // Driver Form States
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverUsername, setDriverUsername] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [driverIsAllBranches, setDriverIsAllBranches] = useState(true);
  const [driverSelectedBranchIds, setDriverSelectedBranchIds] = useState<string[]>([]);
  const [driverIsActive, setDriverIsActive] = useState(true);
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverFormError, setDriverFormError] = useState<string | null>(null);
  const [togglingDriverId, setTogglingDriverId] = useState<string | null>(null);
  const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null);

  // Modals
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [editingPaymentBranch, setEditingPaymentBranch] = useState<any | null>(null);
  const [editingCredentialsBranch, setEditingCredentialsBranch] = useState<any | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [adminCancellingOrder, setAdminCancellingOrder] = useState<any | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState<string>('');
  const [adminConfirmDialog, setAdminConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Finance & Shifts Accounting States
  const [financeBranchFilter, setFinanceBranchFilter] = useState<string>('ALL');
  const [financeShiftMode, setFinanceShiftMode] = useState<'SHIFT' | 'CUSTOM'>('SHIFT');
  const [financeShiftDate, setFinanceShiftDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [financeStartDate, setFinanceStartDate] = useState<string>(() => {
    const today = new Date();
    const dStr = today.toISOString().split('T')[0];
    return `${dStr}T00:00`;
  });
  const [financeEndDate, setFinanceEndDate] = useState<string>(() => {
    const today = new Date();
    const dStr = today.toISOString().split('T')[0];
    return `${dStr}T23:59`;
  });
  const [financeReportData, setFinanceReportData] = useState<any | null>(null);
  const [financeLoading, setFinanceLoading] = useState<boolean>(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financeSubTab, setFinanceSubTab] = useState<'OVERVIEW' | 'SHIFTS' | 'DRIVERS' | 'ORDERS'>('OVERVIEW');
  const [selectedDriverOrdersModal, setSelectedDriverOrdersModal] = useState<any | null>(null);

  const [editingStudentWallet, setEditingStudentWallet] = useState<any | null>(null);
  const [editStudentBalance, setEditStudentBalance] = useState('0');
  const [editStudentPoints, setEditStudentPoints] = useState('0');
  const [editStudentNotes, setEditStudentNotes] = useState('');
  const [editStudentBlocked, setEditStudentBlocked] = useState(false);
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [savingStudentWallet, setSavingStudentWallet] = useState(false);

  // Custom Dark Branch Selector Modals (مظهر داكن مخصص يمنع النوافذ البيضاء الافتراضية للنظام)
  const [showOrderBranchSelectModal, setShowOrderBranchSelectModal] = useState(false);
  const [showFinanceBranchSelectModal, setShowFinanceBranchSelectModal] = useState(false);
  const [financeShowExactHours, setFinanceShowExactHours] = useState(false);

  const [showAdminExitDialog, setShowAdminExitDialog] = useState(false);

  // قفل تمرير الشاشة الخلفية تلقائياً عند فتح أي نافذة منبثقة في لوحة الإدارة (Scroll Lock)
  const isAnyAdminModalOpen = Boolean(
    showAddBranchModal ||
    editingBranch ||
    editingPaymentBranch ||
    editingCredentialsBranch ||
    editingStudentWallet ||
    selectedDriverOrdersModal ||
    showMobileMoreMenu ||
    showOrderBranchSelectModal ||
    showFinanceBranchSelectModal ||
    selectedOrderDetails ||
    adminCancellingOrder ||
    adminConfirmDialog ||
    showFactoryResetModal ||
    showAddBannerModal ||
    editingBanner ||
    showAddPromoModal ||
    editingPromo ||
    showAddDriverModal ||
    editingDriver ||
    showAdminExitDialog
  );

  useEffect(() => {
    if (isAnyAdminModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'contain';
      document.documentElement.style.overscrollBehavior = 'contain';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isAnyAdminModalOpen]);

  // إدارة زر الرجوع في الهاتف للوحة الإدارة (Android Back Button Handling)
  const isHandlingAdminPopstateRef = useRef(false);
  const adminHistoryDepthRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.history.replaceState({ uniFoodAdminRoot: true }, '');
      window.history.pushState({ uniFoodAdminStep: 1 }, '');
      adminHistoryDepthRef.current = 1;
    } catch (_e) {}
  }, []);

  const adminNavCount = [
    activeTab !== 'BRANCHES',
    Boolean(showAdminExitDialog),
    Boolean(selectedOrderDetails),
    Boolean(selectedDriverOrdersModal),
    Boolean(showAddBranchModal),
    Boolean(editingBranch),
    Boolean(editingPaymentBranch),
    Boolean(editingCredentialsBranch),
    Boolean(editingStudentWallet),
    Boolean(showOrderBranchSelectModal),
    Boolean(showFinanceBranchSelectModal),
    Boolean(showMobileMoreMenu),
    Boolean(adminCancellingOrder),
    Boolean(adminConfirmDialog),
    Boolean(showFactoryResetModal),
    Boolean(showAddBannerModal),
    Boolean(editingBanner),
    Boolean(showAddPromoModal),
    Boolean(editingPromo),
    Boolean(showAddDriverModal),
    Boolean(editingDriver)
  ].filter(Boolean).length;

  const prevAdminNavCountRef = useRef(0);

  useEffect(() => {
    if (isHandlingAdminPopstateRef.current) return;
    if (adminNavCount > prevAdminNavCountRef.current) {
      try {
        window.history.pushState({ uniFoodAdminStep: adminHistoryDepthRef.current + 1 }, '');
        adminHistoryDepthRef.current += 1;
      } catch (_e) {}
    }
    prevAdminNavCountRef.current = adminNavCount;
  }, [adminNavCount]);

  useEffect(() => {
    const handleAdminPopState = () => {
      isHandlingAdminPopstateRef.current = true;
      adminHistoryDepthRef.current = Math.max(0, adminHistoryDepthRef.current - 1);

      // أولاً: إذا كانت نافذة تأكيد الخروج مفتوحة
      if (showAdminExitDialog) {
        setShowAdminExitDialog(false);
      }
      // ثانياً: إغلاق النوافذ المنبثقة
      else if (selectedOrderDetails) setSelectedOrderDetails(null);
      else if (selectedDriverOrdersModal) setSelectedDriverOrdersModal(null);
      else if (showOrderBranchSelectModal) setShowOrderBranchSelectModal(false);
      else if (showFinanceBranchSelectModal) setShowFinanceBranchSelectModal(false);
      else if (showMobileMoreMenu) setShowMobileMoreMenu(false);
      else if (editingPaymentBranch) setEditingPaymentBranch(null);
      else if (editingCredentialsBranch) setEditingCredentialsBranch(null);
      else if (editingStudentWallet) setEditingStudentWallet(null);
      else if (editingBranch) setEditingBranch(null);
      else if (showAddBranchModal) setShowAddBranchModal(false);
      else if (adminCancellingOrder) setAdminCancellingOrder(null);
      else if (adminConfirmDialog) setAdminConfirmDialog(null);
      else if (showFactoryResetModal) setShowFactoryResetModal(false);
      else if (editingBanner) setEditingBanner(null);
      else if (showAddBannerModal) setShowAddBannerModal(false);
      else if (editingPromo) setEditingPromo(null);
      else if (showAddPromoModal) setShowAddPromoModal(false);
      else if (editingDriver) setEditingDriver(null);
      else if (showAddDriverModal) setShowAddDriverModal(false);
      // ثالثاً: إذا كان في تبويب غير الفروع -> الرجوع لتبويب الفروع الرئيسي
      else if (activeTab !== 'BRANCHES') {
        setActiveTab('BRANCHES');
      }
      // رابعاً: في الشاشة الرئيسية للإدارة -> إظهار تأكيد الخروج
      else {
        try {
          window.history.pushState({ uniFoodAdminStep: 1 }, '');
          adminHistoryDepthRef.current = 1;
        } catch (_e) {}
        setShowAdminExitDialog(true);
      }

      setTimeout(() => {
        isHandlingAdminPopstateRef.current = false;
        prevAdminNavCountRef.current = [
          activeTab !== 'BRANCHES',
          Boolean(showAdminExitDialog),
          Boolean(selectedOrderDetails),
          Boolean(selectedDriverOrdersModal),
          Boolean(showAddBranchModal),
          Boolean(editingBranch),
          Boolean(editingPaymentBranch),
          Boolean(editingCredentialsBranch),
          Boolean(editingStudentWallet),
          Boolean(showOrderBranchSelectModal),
          Boolean(showFinanceBranchSelectModal),
          Boolean(showMobileMoreMenu),
          Boolean(adminCancellingOrder),
          Boolean(adminConfirmDialog),
          Boolean(showFactoryResetModal),
          Boolean(showAddBannerModal),
          Boolean(editingBanner),
          Boolean(showAddPromoModal),
          Boolean(editingPromo),
          Boolean(showAddDriverModal),
          Boolean(editingDriver)
        ].filter(Boolean).length;
      }, 50);
    };

    window.addEventListener('popstate', handleAdminPopState);
    return () => window.removeEventListener('popstate', handleAdminPopState);
  }, [
    showAdminExitDialog,
    selectedOrderDetails,
    selectedDriverOrdersModal,
    showOrderBranchSelectModal,
    showFinanceBranchSelectModal,
    showMobileMoreMenu,
    editingPaymentBranch,
    editingCredentialsBranch,
    editingStudentWallet,
    editingBranch,
    showAddBranchModal,
    adminCancellingOrder,
    adminConfirmDialog,
    showFactoryResetModal,
    editingBanner,
    showAddBannerModal,
    editingPromo,
    showAddPromoModal,
    editingDriver,
    showAddDriverModal,
    activeTab
  ]);

  // Mock Data Seeding States
  const [seedingMockData, setSeedingMockData] = useState(false);
  const [seedMockSuccess, setSeedMockSuccess] = useState<string | null>(null);
  const [seedMockError, setSeedMockError] = useState<string | null>(null);

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
  const [editOpeningTime, setEditOpeningTime] = useState('08:00');
  const [editClosingTime, setEditClosingTime] = useState('22:00');
  const [editWorkingDays, setEditWorkingDays] = useState('SUN,MON,TUE,WED,THU,FRI,SAT');
  const [editOperationalStatus, setEditOperationalStatus] = useState('OPEN');

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
      const [statsRes, branchesRes, ordersRes, studentsRes, bannersRes, promosRes, reviewsRes, driversRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/stats`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/branches`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/orders?limit=100`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/users`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/banners`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/promo-codes`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/reviews`, { headers: getAdminHeaders() }),
        fetch(`${API_BASE_URL}/admin/drivers`, { headers: getAdminHeaders() }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (branchesRes.ok) setBranches(await branchesRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (bannersRes.ok) setBanners(await bannersRes.json());
      if (promosRes.ok) setPromos(await promosRes.json());
      if (reviewsRes && reviewsRes.ok) {
        const revData = await reviewsRes.json();
        setReviews(revData.reviews || []);
        if (revData.stats) setReviewsStats(revData.stats);
      }
      if (driversRes && driversRes.ok) {
        setDrivers(await driversRes.json());
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriversData = async () => {
    try {
      setDriversLoading(true);
      const data = await api.getAdminDrivers();
      setDrivers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Fetch drivers error:', err);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleOpenAddDriver = () => {
    setEditingDriver(null);
    setDriverName('');
    setDriverPhone('');
    setDriverUsername('');
    setDriverPassword('');
    setDriverIsAllBranches(true);
    setDriverSelectedBranchIds(branches.map(b => b.id));
    setDriverIsActive(true);
    setDriverFormError(null);
    setShowAddDriverModal(true);
  };

  const handleOpenEditDriver = (driver: any) => {
    setEditingDriver(driver);
    setDriverName(driver.name || '');
    setDriverPhone(driver.phone || '');
    setDriverUsername(driver.username || '');
    setDriverPassword('');
    setDriverIsAllBranches(Boolean(driver.isAllBranches));
    const currentBranchIds = Array.isArray(driver.branchIds) && driver.branchIds.length > 0
      ? driver.branchIds
      : (driver.primaryBranch?.id ? [driver.primaryBranch.id] : branches.map(b => b.id));
    setDriverSelectedBranchIds(currentBranchIds);
    setDriverIsActive(Boolean(driver.isActive));
    setDriverFormError(null);
    setShowAddDriverModal(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriverFormError(null);

    if (!driverName.trim() || !driverPhone.trim() || !driverUsername.trim()) {
      setDriverFormError('يرجى كتابة الاسم ورقم الهاتف واسم المستخدم');
      return;
    }

    if (!editingDriver && !driverPassword.trim()) {
      setDriverFormError('يرجى تحديد كلمة مرور لكابتن التوصيل الجديد');
      return;
    }

    if (!driverIsAllBranches && driverSelectedBranchIds.length === 0) {
      setDriverFormError('يرجى اختيار مطعم أو فرع واحد على الأقل، أو تحديد "جميع المطاعم"');
      return;
    }

    try {
      setSavingDriver(true);
      if (editingDriver) {
        await api.updateAdminDriver(editingDriver.id, {
          name: driverName.trim(),
          phone: driverPhone.trim(),
          username: driverUsername.trim(),
          password: driverPassword.trim() || undefined,
          isAllBranches: driverIsAllBranches,
          branchIds: driverIsAllBranches ? [] : driverSelectedBranchIds,
          isActive: driverIsActive,
        });
      } else {
        await api.createAdminDriver({
          name: driverName.trim(),
          phone: driverPhone.trim(),
          username: driverUsername.trim(),
          password: driverPassword.trim(),
          isAllBranches: driverIsAllBranches,
          branchIds: driverIsAllBranches ? [] : driverSelectedBranchIds,
          primaryBranchId: driverSelectedBranchIds[0] || (branches[0]?.id),
        });
      }

      setShowAddDriverModal(false);
      setEditingDriver(null);
      await fetchDriversData();
    } catch (err: any) {
      setDriverFormError(err.message || 'حدث خطأ أثناء حفظ بيانات الطيار');
    } finally {
      setSavingDriver(false);
    }
  };

  const handleToggleDriverActive = async (driverId: string) => {
    try {
      setTogglingDriverId(driverId);
      const res = await api.toggleAdminDriverActive(driverId);
      setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, isActive: res.isActive } : d));
    } catch (err: any) {
      alert(err.message || 'فشل تغيير حالة الطيار');
    } finally {
      setTogglingDriverId(null);
    }
  };

  const handleDeleteDriver = (driverId: string, driverName: string) => {
    setAdminConfirmDialog({
      isOpen: true,
      title: 'حذف كابتن التوصيل',
      message: `هل أنت متأكد من رغبتك في حذف كابتن التوصيل (${driverName})؟ سيتم إلغاء حسابه نهائياً من النظام.`,
      confirmText: 'نعم، حذف الكابتن',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
        try {
          setDeletingDriverId(driverId);
          await api.deleteAdminDriver(driverId);
          setDrivers(prev => prev.filter(d => d.id !== driverId));
        } catch (err: any) {
          alert(err.message || 'فشل حذف كابتن التوصيل');
        } finally {
          setDeletingDriverId(null);
        }
      },
    });
  };

  const fetchReviewsData = async () => {
    try {
      setReviewsLoading(true);
      const data = await api.getAdminReviews({
        branchId: reviewBranchFilter,
        rating: reviewRatingFilter,
        hasText: reviewOnlyWithText,
      });
      setReviews(data.reviews || []);
      if (data.stats) setReviewsStats(data.stats);
    } catch (err) {
      console.error('Fetch reviews error:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleDeleteReview = (orderId: string) => {
    setAdminConfirmDialog({
      isOpen: true,
      title: 'حذف تقييم العميل',
      message: 'هل أنت متأكد من حذف هذا التقييم؟ سيتم إزالة النجوم والتعليق من سجل الطلب نهائياً.',
      confirmText: 'نعم، حذف التقييم',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
        try {
          setDeletingReviewId(orderId);
          await api.deleteAdminReview(orderId);
          setReviews(prev => prev.filter(r => r.id !== orderId));
          setReviewsStats((prev: any) => ({
            ...prev,
            totalReviews: Math.max(0, (prev.totalReviews || 1) - 1),
          }));
        } catch (err: any) {
          alert(err.message || 'فشل حذف التقييم');
        } finally {
          setDeletingReviewId(null);
        }
      },
    });
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

  const handleDisconnectWhatsApp = () => {
    setAdminConfirmDialog({
      isOpen: true,
      title: 'فصل جلسة الواتساب',
      message: 'هل أنت متأكد من رغبتك في فصل جلسة الواتساب الحالية؟ سيتوقف إرسال الرسائل حتى تقوم بمسح رمز QR جديد للربط.',
      confirmText: 'نعم، فصل الجلسة',
      cancelText: 'إبقاء الجلسة',
      isDanger: true,
      onConfirm: async () => {
        try {
          setLoadingWhatsApp(true);
          await api.disconnectWhatsApp();
          setTimeout(fetchWhatsAppStatus, 1500);
        } catch (err: any) {
          alert(err.message || 'فشل فصل الجلسة');
        } finally {
          setLoadingWhatsApp(false);
        }
      },
    });
  };

  const fetchWhatsAppAlertSettings = async () => {
    try {
      setLoadingWhatsAppAlerts(true);
      const data = await api.getWhatsAppAlertSettings();
      if (data) {
        setWhatsAppAlertSettings(prev => ({
          ...prev,
          ...data,
          driverUnacceptedAlertEnabled: data.driverUnacceptedAlertEnabled !== undefined ? data.driverUnacceptedAlertEnabled : true,
          driverUnacceptedDelayMinutes: data.driverUnacceptedDelayMinutes !== undefined ? data.driverUnacceptedDelayMinutes : 3,
        }));
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
      let targetPhone = whatsAppAlertSettings.dailyReportPhones?.trim();
      if (!targetPhone) {
        setShiftReportTestMsg('⚠️ يرجى إدخال رقم هاتف الواتساب في الحقل المخصص أعلاه أولاً');
        setTimeout(() => setShiftReportTestMsg(null), 5000);
        return;
      }

      setTestingShiftReport(true);
      setShiftReportTestMsg(null);

      // تمرير رقم الهاتف مباشرة حتى يعمل الإرسال فوراً دون اشتراط حفظ الإعدادات مسبقاً
      const res = await api.sendShiftReportNow(branchId, targetPhone);
      setShiftReportTestMsg(res.message || 'تم إرسال التقرير المالي للشيفت بنجاح عبر الواتساب ✅');
      setTimeout(() => setShiftReportTestMsg(null), 8000);
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

  const handleTriggerSeedMockData = async () => {
    if (!window.confirm("هل تريد حقن وتوليد البيانات التجريبية الشاملة؟\n\nسيتم توليد:\n- 4 مطاعم جامعية واقعية\n- منيو كامل بالأصناف والأحجام والصور والإضافات\n- 4 بانرات عروض تفاعلية\n- كوبونات خصم عامة ولكل مطعم\n- 3 كباتن توصيل وحسابات طلاب\n- طلبات حية ومكتملة لتغذية تقارير المالية والورديات فوراً.")) {
      return;
    }
    setSeedMockError(null);
    setSeedMockSuccess(null);
    try {
      setSeedingMockData(true);
      const res = await api.seedMockData();
      setSeedMockSuccess(res.message || "تم حقن البيانات التجريبية الشاملة بنجاح! 🚀");
      fetchDashboardData();
      setTimeout(() => {
        setSeedMockSuccess(null);
      }, 7000);
    } catch (err: any) {
      setSeedMockError(err.message || "فشل حقن البيانات التجريبية");
    } finally {
      setSeedingMockData(false);
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

  useEffect(() => {
    if (activeTab === 'REVIEWS') {
      fetchReviewsData();
    }
    if (activeTab === 'DRIVERS') {
      fetchDriversData();
    }
    if (activeTab === 'FINANCE') {
      fetchFinanceReport();
    }
  }, [activeTab]);

  // Finance & Shifts Handlers
  const fetchFinanceReport = async () => {
    try {
      setFinanceLoading(true);
      setFinanceError(null);

      let sDate = financeStartDate;
      let eDate = financeEndDate;
      if (!financeShowExactHours) {
        const sOnly = financeStartDate.split('T')[0];
        const eOnly = financeEndDate.split('T')[0];
        sDate = `${sOnly}T00:00:00`;
        eDate = `${eOnly}T23:59:59`;
      }

      const data = await api.getFinanceReport({
        branchId: financeBranchFilter,
        shiftMode: 'CUSTOM',
        startDate: sDate,
        endDate: eDate,
      });
      setFinanceReportData(data);
    } catch (err: any) {
      console.error('Fetch finance report error:', err);
      setFinanceError(err.message || 'فشل جلب التقرير المالي وحسابات الشيفتات');
    } finally {
      setFinanceLoading(false);
    }
  };

  // Helper to generate direct server download URL for Mobile and Desktop
  const getBackendExportUrl = (exportType: 'shifts' | 'drivers' | 'orders') => {
    const token = localStorage.getItem('admin_token') || '';
    let sDate = financeStartDate;
    let eDate = financeEndDate;
    if (!financeShowExactHours) {
      const sOnly = financeStartDate.split('T')[0];
      const eOnly = financeEndDate.split('T')[0];
      sDate = `${sOnly}T00:00:00`;
      eDate = `${eOnly}T23:59:59`;
    }
    const params = new URLSearchParams({
      type: exportType,
      branchId: financeBranchFilter || 'ALL',
      shiftMode: 'CUSTOM',
      startDate: sDate,
      endDate: eDate,
      token,
    });
    return `${API_BASE_URL}/admin/finance/export-excel?${params.toString()}`;
  };

  // Helper to trigger Excel CSV download with UTF-8 BOM for perfect Arabic display on Desktop & Mobile
  const downloadCsv = async (filename: string, rows: (string | number)[][], exportType?: 'shifts' | 'drivers' | 'orders') => {
    try {
      const csvContent = rows
        .map(row =>
          row
            .map(val => {
              const str = String(val ?? '').replace(/"/g, '""');
              return `"${str}"`;
            })
            .join(',')
        )
        .join('\r\n');

      const bom = '\uFEFF';
      const fullContent = bom + csvContent;
      const fullFilename = `${filename}.csv`;

      // 1. Mobile First: Web Share API allows saving directly to Files / Google Drive / Excel / WhatsApp on Android & iOS
      const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      if (isMobile && typeof navigator !== 'undefined' && (navigator as any).share) {
        try {
          const file = new File([fullContent], fullFilename, { type: 'text/csv;charset=utf-8' });
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
            await (navigator as any).share({
              files: [file],
              title: filename,
            });
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return; // User simply closed share sheet
          console.warn('Navigator share error, falling back to blob/direct download:', shareErr);
        }
      }

      // 2. Direct Blob Download (Standard on Desktop Chrome/Firefox/Edge)
      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fullFilename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 10000);

      // 3. Optional direct server URL fallback if exportType provided
      if (exportType && isMobile) {
        const serverDownloadUrl = getBackendExportUrl(exportType);
        setTimeout(() => {
          try {
            window.open(serverDownloadUrl, '_blank');
          } catch (_) {}
        }, 600);
      }
    } catch (err: any) {
      console.error('Download CSV error:', err);
      alert('تعذر تحميل الملف: ' + (err.message || err));
    }
  };

  // 1. Export Shifts & Branch Sales
  const exportShiftsToExcel = () => {
    if (!financeReportData?.branchBreakdown) return;
    const rows: (string | number)[][] = [
      ['تقرير مبيعات وشيفتات فروع UniFood'],
      ['الفترة من', financeReportData.timeframe?.start ? new Date(financeReportData.timeframe.start).toLocaleString('ar-EG') : '', 'إلى', financeReportData.timeframe?.end ? new Date(financeReportData.timeframe.end).toLocaleString('ar-EG') : ''],
      ['نظام الفلترة', financeReportData.timeframe?.shiftMode === 'SHIFT' ? 'شيفت يومي للفرع' : 'فترة مخصصة بالوقت'],
      [],
      [
        'اسم المطعم / الفرع',
        'وقت الفتح',
        'وقت الإغلاق',
        'إجمالي المبيعات (ج.م)',
        'صافي مبيعات الوجبات (ج.م)',
        'رسوم التوصيل (ج.م)',
        'المحصل كاش (ج.م)',
        'المحصل إلكتروني / محافظ (ج.م)',
        'الطلبات المكتملة',
        'الطلبات الملغاة',
        'إجمالي الطلبات'
      ]
    ];

    financeReportData.branchBreakdown.forEach((b: any) => {
      rows.push([
        b.branchName,
        b.openingTime || '08:00',
        b.closingTime || '22:00',
        Number(b.grossSales || 0).toFixed(2),
        Number(b.foodNet || 0).toFixed(2),
        Number(b.deliveryFees || 0).toFixed(2),
        Number(b.cashSales || 0).toFixed(2),
        Number(b.electronicSales || 0).toFixed(2),
        b.completedCount || 0,
        b.rejectedCount || 0,
        b.totalOrders || 0
      ]);
    });

    // Add totals row
    rows.push([]);
    rows.push([
      'الإجمالي الكلي لكافة الفروع',
      '-',
      '-',
      Number(financeReportData.summary?.totalGrossSales || 0).toFixed(2),
      Number(financeReportData.summary?.totalFoodNet || 0).toFixed(2),
      Number(financeReportData.summary?.totalDeliveryFees || 0).toFixed(2),
      Number(financeReportData.paymentBreakdown?.CASH?.total || 0).toFixed(2),
      Number((financeReportData.summary?.totalGrossSales || 0) - (financeReportData.paymentBreakdown?.CASH?.total || 0)).toFixed(2),
      financeReportData.summary?.completedOrdersCount || 0,
      financeReportData.summary?.rejectedOrdersCount || 0,
      financeReportData.summary?.totalOrdersCount || 0
    ]);

    const dateTag = new Date().toISOString().split('T')[0];
    downloadCsv(`تقرير_شيفتات_ومبيعات_الفروع_${dateTag}`, rows, 'shifts');
  };

  // 2. Export Delivery Drivers Settlements
  const exportDriversToExcel = () => {
    if (!financeReportData?.driversBreakdown) return;
    const rows: (string | number)[][] = [
      ['كشف حسابات وتصفية كباتن التوصيل (الطيارين) - UniFood'],
      ['الفترة من', financeReportData.timeframe?.start ? new Date(financeReportData.timeframe.start).toLocaleString('ar-EG') : '', 'إلى', financeReportData.timeframe?.end ? new Date(financeReportData.timeframe.end).toLocaleString('ar-EG') : ''],
      [],
      [
        'اسم كابتن التوصيل',
        'رقم الهاتف',
        'اسم المستخدم',
        'عدد الطلبات المسلمة بنجاح',
        'إجمالي مبالغ الطلبات (ج.م)',
        'الكاش المحصل في يد الطيار (ج.م)',
        'مبالغ الدفع الإلكتروني (ج.م)',
        'إجمالي رسوم التوصيل المستحقة للطيار (أجرة التوصيل)',
        'صافي الحساب (الكاش المطلوب تسليمه للإدارة)'
      ]
    ];

    financeReportData.driversBreakdown.forEach((d: any) => {
      rows.push([
        d.driverName,
        d.driverPhone,
        d.driverUsername,
        d.deliveredOrdersCount,
        Number(d.totalOrdersValue || 0).toFixed(2),
        Number(d.cashCollectedInHand || 0).toFixed(2),
        Number(d.electronicOrdersValue || 0).toFixed(2),
        Number(d.totalDeliveryFeesEarned || 0).toFixed(2),
        Number(d.netCashToDeliver || 0).toFixed(2)
      ]);
    });

    const dateTag = new Date().toISOString().split('T')[0];
    downloadCsv(`كشف_حساب_الطيارين_والتوصيل_${dateTag}`, rows, 'drivers');
  };

  // 3. Export All Orders Detail
  const exportAllOrdersToExcel = () => {
    if (!financeReportData?.orders) return;
    const rows: (string | number)[][] = [
      ['سجل كافة طلبات الفترة - UniFood'],
      ['الفترة من', financeReportData.timeframe?.start ? new Date(financeReportData.timeframe.start).toLocaleString('ar-EG') : '', 'إلى', financeReportData.timeframe?.end ? new Date(financeReportData.timeframe.end).toLocaleString('ar-EG') : ''],
      [],
      [
        'رقم الطلب',
        'المطعم / الفرع',
        'اسم العميل',
        'رقم الهاتف',
        'مكان ومبنى التسليم',
        'طريقة الدفع',
        'قيمة الوجبات (ج.م)',
        'رسوم التوصيل (ج.م)',
        'الخصم (ج.م)',
        'الإجمالي الكلي (ج.م)',
        'حالة الطلب',
        'كابتن التوصيل',
        'وقت إنشاء الطلب',
        'وقت التسليم'
      ]
    ];

    financeReportData.orders.forEach((o: any) => {
      const pmMap: any = {
        CASH: 'كاش',
        VODAFONE_CASH: 'فودافون كاش',
        INSTAPAY: 'إنستاباي',
        CARD: 'فيزا'
      };
      const stMap: any = {
        COMPLETED: 'مكتمل',
        REJECTED: 'ملغي/مرفوض',
        PENDING: 'جديد بانتظار الموافقة',
        ACCEPTED: 'مقبول',
        PREPARING: 'قيد التجهيز',
        READY: 'جاهز للاستلام'
      };

      rows.push([
        `#${o.orderNumber}`,
        o.branchName,
        o.customerName,
        o.customerPhone,
        o.addressText || o.deliveryZoneName || '',
        pmMap[o.paymentMethod] || o.paymentMethod,
        Number(o.subtotal || 0).toFixed(2),
        Number(o.deliveryFee || 0).toFixed(2),
        Number(o.discount || 0).toFixed(2),
        Number(o.total || 0).toFixed(2),
        stMap[o.status] || o.status,
        o.driverName || 'غير مسند',
        new Date(o.createdAt).toLocaleString('ar-EG'),
        o.completedAt ? new Date(o.completedAt).toLocaleString('ar-EG') : '-'
      ]);
    });

    const dateTag = new Date().toISOString().split('T')[0];
    downloadCsv(`سجل_طلبات_الفترة_${dateTag}`, rows, 'orders');
  };


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

  const fetchSoundSettings = async () => {
    try {
      setLoadingSoundSettings(true);
      const data = await api.getAdminSoundSettings();
      if (data) {
        setSoundSettings({
          enabled: data.enabled ?? true,
          soundUrl: data.soundUrl || '',
          soundName: data.soundName || 'النغمة الافتراضية للنظام',
          volume: data.volume ?? 1.0,
        });
      }
    } catch (err) {
      console.error('Fetch sound settings error:', err);
    } finally {
      setLoadingSoundSettings(false);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAudio(true);
      setAudioUploadError(null);
      const res = await api.uploadAudio(file);
      if (res.fileUrl) {
        setSoundSettings(prev => ({
          ...prev,
          soundUrl: res.fileUrl,
          soundName: file.name,
        }));
      }
    } catch (err: any) {
      setAudioUploadError(err.message || 'فشل رفع الملف الصوتي');
    } finally {
      setUploadingAudio(false);
      e.target.value = '';
    }
  };

  const handlePlaySoundPreview = () => {
    try {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
        setIsPlayingPreview(false);
        return;
      }

      if (soundSettings.soundUrl) {
        const fullUrl = soundSettings.soundUrl.startsWith('http')
          ? soundSettings.soundUrl
          : `${API_BASE_URL.replace('/api', '')}${soundSettings.soundUrl.startsWith('/') ? '' : '/'}${soundSettings.soundUrl}`;
        const audio = new Audio(fullUrl);
        audio.volume = soundSettings.volume;
        audioPreviewRef.current = audio;
        setIsPlayingPreview(true);
        audio.play().catch(() => setIsPlayingPreview(false));
        audio.onended = () => {
          setIsPlayingPreview(false);
          audioPreviewRef.current = null;
        };
      } else {
        // نغمة تخليقية افتراضية للاستماع
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
        gain.gain.setValueAtTime(0.8 * soundSettings.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.35);
      }
    } catch (_e) {
      setIsPlayingPreview(false);
    }
  };

  const handleSaveSoundSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSoundSettings(true);
      await api.updateAdminSoundSettings(soundSettings);
      setSoundSaveSuccess(true);
      setTimeout(() => setSoundSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'فشل حفظ إعدادات الصوت');
    } finally {
      setSavingSoundSettings(false);
    }
  };

  const handleResetSoundSettings = () => {
    setAdminConfirmDialog({
      isOpen: true,
      title: 'استعادة النغمة الافتراضية',
      message: 'هل أنت متأكد من رغبتك في استعادة نغمة النظام الصوتية الافتراضية؟',
      confirmText: 'استعادة الافتراضية',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        try {
          setSavingSoundSettings(true);
          const res = await api.resetAdminSoundSettings();
          if (res.settings) {
            setSoundSettings(res.settings);
          }
          setSoundSaveSuccess(true);
          setTimeout(() => setSoundSaveSuccess(false), 3500);
        } catch (err: any) {
          alert(err.message || 'فشل استعادة النغمة الافتراضية');
        } finally {
          setSavingSoundSettings(false);
        }
      },
    });
  };

  useEffect(() => {
    if (activeTab === 'SETTINGS') {
      fetchLoyaltySettings();
      fetchSoundSettings();
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

  const handleDeleteBanner = (bannerId: string) => {
    setAdminConfirmDialog({
      isOpen: true,
      title: 'حذف الإعلان',
      message: 'هل أنت متأكد من حذف هذا الإعلان نهائياً؟',
      confirmText: 'نعم، حذف الإعلان',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteAdminBanner(bannerId);
          setBanners(banners.filter(b => b.id !== bannerId));
        } catch (err: any) {
          alert(err.message || 'فشل حذف البانر');
        }
      },
    });
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
    setEditOpeningTime(branch.openingTime || '08:00');
    setEditClosingTime(branch.closingTime || '22:00');
    setEditWorkingDays(branch.workingDays || 'SUN,MON,TUE,WED,THU,FRI,SAT');
    setEditOperationalStatus(branch.operationalStatus || 'OPEN');
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
          openingTime: editOpeningTime.trim() || '08:00',
          closingTime: editClosingTime.trim() || '22:00',
          workingDays: editWorkingDays.trim() || 'SUN,MON,TUE,WED,THU,FRI,SAT',
          operationalStatus: editOperationalStatus,
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

  const handleDeleteBranch = (branch: any) => {
    setAdminConfirmDialog({
      isOpen: true,
      title: 'حذف الفرع نهائياً',
      message: `هل أنت متأكد تماماً من رغبتك في حذف فرع "${branch.name}"؟\nسيتم مسح كافة أصنافه وإعداداته نهائياً من المنظومة.`,
      confirmText: 'نعم، حذف الفرع بالكامل',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
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
      },
    });
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

  const handleAdminUpdateOrderStatus = async (orderId: string, newStatus: string, reason?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({ status: newStatus, reason }),
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

  const filteredReviews = reviews.filter((r) => {
    if (reviewBranchFilter !== 'ALL' && r.branchId !== reviewBranchFilter) return false;
    if (reviewRatingFilter === '5' && r.rating !== 5) return false;
    if (reviewRatingFilter === '4' && r.rating !== 4) return false;
    if (reviewRatingFilter === '3' && r.rating !== 3) return false;
    if (reviewRatingFilter === '2' && r.rating !== 2) return false;
    if (reviewRatingFilter === '1' && r.rating !== 1) return false;
    if (reviewRatingFilter === 'LOW' && (r.rating || 0) > 3) return false;
    if (reviewOnlyWithText && (!r.review || !r.review.trim())) return false;
    if (reviewSearchQuery.trim()) {
      const q = reviewSearchQuery.trim().toLowerCase();
      const matchName = (r.customerName || r.user?.name || '').toLowerCase().includes(q);
      const matchPhone = (r.customerPhone || r.user?.phone || '').includes(q);
      const matchOrderNum = String(r.orderNumber || '').includes(q);
      const matchReview = (r.review || '').toLowerCase().includes(q);
      const matchBranch = (r.branch?.name || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchOrderNum && !matchReview && !matchBranch) return false;
    }
    return true;
  });

  const filteredDrivers = drivers.filter(d => {
    const matchesSearch =
      (d.name || '').toLowerCase().includes(driverSearch.toLowerCase()) ||
      (d.phone || '').includes(driverSearch) ||
      (d.username || '').toLowerCase().includes(driverSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (driverScopeFilter === 'GENERAL') return d.isAllBranches;
    if (driverScopeFilter === 'SPECIFIC') return !d.isAllBranches;
    if (driverScopeFilter === 'INACTIVE') return !d.isActive;
    return true;
  });

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
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-8 py-2 sm:py-2.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="h-8 sm:h-9 flex items-center gap-1.5 px-2.5 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 whitespace-nowrap shrink-0"
              title="تحديث البيانات"
            >
              <RotateCw className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {/* زر العودة المباشر لمتجر الطلاب */}
            <button
              onClick={handleReturnToStudentStore}
              className="h-8 sm:h-9 flex items-center gap-1.5 px-3 sm:px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95 whitespace-nowrap shrink-0"
              title="إغلاق والرجوع لشاشة الطلاب"
            >
              <Store className="w-4 h-4 text-white shrink-0" />
              <span className="hidden sm:inline">متجر الطلاب</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors border border-slate-800 hover:border-rose-900/50 shrink-0"
              title="تسجيل الخروج"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-24 sm:pb-8">
        
        {/* 2. Top Analytics Metric Cards (Only shown on Branches tab) */}
        {activeTab === 'BRANCHES' && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-4">
            <div className="p-3 sm:p-4 bg-slate-900/70 border border-slate-800 rounded-xl sm:rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 text-slate-400 mb-1">
                <span className="text-[11px] font-bold">الفروع النشطة</span>
                <Building className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-400">{stats.activeBranches}</span>
                <span className="text-xs text-slate-500 font-mono">/ {stats.totalBranches}</span>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-slate-900/70 border border-slate-800 rounded-xl sm:rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 text-slate-400 mb-1">
                <span className="text-[11px] font-bold">إجمالي الطلبات</span>
                <ShoppingBag className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-indigo-400">{stats.totalOrders}</span>
            </div>

            <div className="p-3 sm:p-4 bg-slate-900/70 border border-slate-800 rounded-xl sm:rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 text-slate-400 mb-1">
                <span className="text-[11px] font-bold">قيد التنفيذ</span>
                <Clock className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-amber-400 animate-pulse">{stats.pendingOrders ?? 0}</span>
            </div>

            <div className="p-3 sm:p-4 bg-slate-900/70 border border-slate-800 rounded-xl sm:rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 text-slate-400 mb-1">
                <span className="text-[11px] font-bold">المبيعات</span>
                <TrendingUp className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-purple-400">{stats.totalSales} <span className="text-xs font-normal">ج.م</span></span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 sm:p-4 bg-slate-900/70 border border-slate-800 rounded-xl sm:rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 text-slate-400 mb-1">
                <span className="text-[11px] font-bold">الطلاب المسجلين</span>
                <Users className="w-3.5 h-3.5 text-sky-400/80 shrink-0" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-sky-400">{stats.totalStudents ?? students.length}</span>
            </div>
          </div>
        )}

        {/* 3. Navigation Tabs Bar */}
        <div className="hidden sm:block border-b border-slate-800 pb-2">
          {/* Scroll Navigation Buttons for Desktop / Tablet */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 shadow-sm transition-all active:scale-95"
              title="تمرير لليمين"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div 
              ref={tabsContainerRef}
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar pb-1.5 flex-1 scroll-smooth"
            >
              <button
                onClick={() => setActiveTab('BRANCHES')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'BRANCHES'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Building className="w-4 h-4 shrink-0" />
                <span>الفروع والمطاعم</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'BRANCHES' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {branches.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ORDERS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'ORDERS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>مراقبة طلبات الحرم</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'ORDERS' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {orders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('FINANCE')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'FINANCE'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Coins className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>المالية والشيفتات</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'FINANCE' ? 'bg-emerald-800/80 text-white' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  جديد
                </span>
              </button>

              <button
                onClick={() => setActiveTab('DRIVERS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'DRIVERS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>كباتن التوصيل (الطيارين)</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'DRIVERS' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {drivers.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('REVIEWS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'REVIEWS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Star className="w-4 h-4 shrink-0 text-amber-400 fill-amber-400" />
                <span>تقييمات وآراء العملاء</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'REVIEWS' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {reviews.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('STUDENTS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'STUDENTS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>دليل الطلاب</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'STUDENTS' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {students.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ANALYTICS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'ANALYTICS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>التقارير المالية</span>
              </button>

              <button
                onClick={() => setActiveTab('BANNERS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'BANNERS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>الإعلانات والبانرات</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'BANNERS' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {banners.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('PROMOS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'PROMOS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Tag className="w-4 h-4 shrink-0" />
                <span>كوبونات الخصم</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${activeTab === 'PROMOS' ? 'bg-purple-800/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {promos.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('WHATSAPP')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'WHATSAPP'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>بوت الواتساب و OTP</span>
                {whatsAppStatus?.isConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('SETTINGS')}
                className={`h-9 sm:h-10 flex items-center gap-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'SETTINGS'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0 text-purple-400" />
                <span>إعدادات النظام والأمان</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 shadow-sm transition-all active:scale-95"
              title="تمرير لليسار"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
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
                    className={`p-4 sm:p-5 rounded-2xl border transition-all bg-slate-900/70 shadow-sm ${
                      branch.isActive 
                        ? 'border-slate-800 hover:border-slate-700' 
                        : 'border-rose-950/40 bg-slate-950/40 opacity-80'
                    }`}
                  >
                    {/* Header: Logo + Info + Actions */}
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      {/* Right Side: Logo & Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {branch.logoUrl ? (
                          <img
                            src={getFullImageUrl(branch.logoUrl)}
                            alt={branch.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-800 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shrink-0">
                            <Store className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {/* Branch Title & Status Badge */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-black text-base text-white leading-tight">
                              {branch.name}
                            </h3>
                            {branch.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                                نشط
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                                معطل
                              </span>
                            )}
                          </div>

                          {/* Slug pill - on its own clean line */}
                          {branch.slug && (
                            <div className="mb-1.5">
                              <span 
                                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-950/70 text-purple-300 border border-purple-800/80 whitespace-nowrap"
                                dir="ltr"
                              >
                                ?branch={branch.slug}
                              </span>
                            </div>
                          )}

                          {/* Address and Phone */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            {branch.address && (
                              <span className="flex items-center gap-1 min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate max-w-[200px]">{branch.address}</span>
                              </span>
                            )}
                            {branch.phone && (
                              <a 
                                href={`tel:${branch.phone}`} 
                                className="flex items-center gap-1 font-mono hover:text-purple-300 transition-colors shrink-0"
                              >
                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                <span>{branch.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Left Side: Header Controls (Toggle Active + Delete) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleStatus(branch.id, branch.isActive)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            branch.isActive
                              ? 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 border border-emerald-800'
                              : 'bg-rose-950/60 text-rose-400 hover:bg-rose-900 border border-rose-800'
                          }`}
                          title={branch.isActive ? 'إيقاف الفرع مؤقتاً' : 'تفعيل الفرع'}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteBranch(branch)}
                          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl border border-transparent hover:border-rose-900 transition-colors"
                          title="حذف الفرع"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Meta info grid */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 bg-slate-950/60 rounded-xl text-xs mb-3 font-mono border border-slate-900">
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                        <span className="text-slate-500 block text-[10px] font-sans mb-0.5">رسوم التوصيل:</span>
                        <span className="font-bold text-slate-200">{branch.deliveryFee} ج.م</span>
                      </div>
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                        <span className="text-slate-500 block text-[10px] font-sans mb-0.5">يوزر الديسكتوب:</span>
                        <span className="font-bold text-purple-400 truncate block">{user?.username || 'غير معين'}</span>
                      </div>
                    </div>

                    {/* Payment methods badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3.5 bg-slate-950/40 p-2 rounded-xl border border-slate-900/60">
                      <span className="text-[10px] text-slate-500 font-bold ml-1 shrink-0">طرق الدفع:</span>
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
                      {!payment?.cashEnabled && !payment?.vodafoneCashEnabled && !payment?.instapayEnabled && !payment?.cardEnabled && (
                        <span className="text-[10px] text-slate-600 italic">لم تحدد بعد</span>
                      )}
                    </div>

                    {/* Action buttons (Clean responsive grid) */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => handleOpenEditBranch(branch)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                          title="تعديل بيانات الفرع"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleOpenPaymentSettings(branch)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                          title="تخصيص طرق الدفع"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>طرق الدفع</span>
                        </button>

                        <button
                          onClick={() => handleOpenCredentials(branch)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                          title="تغيير يوزر وباسورد الديسكتوب"
                        >
                          <Key className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span>دخول الديسكتوب</span>
                        </button>

                        <button
                          onClick={() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                            const link = `${origin}/?branch=${branch.slug || branch.id}`;
                            navigator.clipboard.writeText(link);
                            alert(`تم نسخ رابط الطلب المباشر لمطعم (${branch.name}) بنجاح:\n${link}`);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-800/80 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                          title="نسخ الرابط المباشر للمطعم لمشاركته على السوشيال ميديا أو وضعه في بانر"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0" />
                          <span>رابط مباشر</span>
                        </button>
                      </div>
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
                <span className="text-xs text-slate-400 font-bold ml-1 shrink-0">الحالة:</span>
                {['ALL', 'PENDING', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      orderStatusFilter === st
                        ? 'bg-purple-600 text-white shadow-sm'
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

              {/* Branch Filter Button */}
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <span className="text-xs text-slate-400 font-bold shrink-0">الفرع:</span>
                <button
                  type="button"
                  onClick={() => setShowOrderBranchSelectModal(true)}
                  className="flex items-center justify-between gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-purple-500 text-white text-xs font-bold rounded-xl px-3 py-2 transition-all shadow-sm max-w-[210px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Store className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">
                      {orderBranchFilter === 'ALL'
                        ? 'جميع فروع الجامعة'
                        : branches.find(b => b.id === orderBranchFilter)?.name || 'الفرع المحدد'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
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
                      className="p-3.5 sm:p-4 bg-slate-900/70 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
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

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400">
                          <span className="font-bold text-slate-200">{order.customerName}</span>
                          <a 
                            href={`tel:${order.customerPhone}`}
                            className="font-mono text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                          >
                            📞 {order.customerPhone}
                          </a>
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
                              onClick={() => {
                                setAdminCancellingOrder(order);
                                setAdminCancelReason('المطعم مغلق حالياً');
                              }}
                              className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold rounded-lg border border-rose-800 transition-colors"
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

        {/* Tab: Finance & Shifts Accounting (قسم المالية وحسابات الشيفتات) */}
        {activeTab === 'FINANCE' && (
          <div className="space-y-6">
            {/* 1. Header Bar with Title and Quick Excel Exports */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">
                      قسم الإدارة المالية وحسابات الشيفتات
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      محاسبة وإكسل
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    حساب مبيعات الفروع من موعد الفتح للإغلاق، ومتابعة عهدة كباتن التوصيل وأجرة التوصيل وصافي التوريد للإدارة
                  </p>
                </div>
              </div>

              {/* Action Buttons: Refresh & Excel Exports */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchFinanceReport}
                  disabled={financeLoading}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                  title="تحديث البيانات المحاسبية"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${financeLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>تحديث</span>
                </button>

                {/* Export Dropdown / Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={exportShiftsToExcel}
                    disabled={financeLoading || !financeReportData?.branchBreakdown?.length}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-40"
                    title="تصدير مبيعات وشيفتات الفروع لملف إكسل"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>شيفتات الفروع (Excel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportDriversToExcel}
                    disabled={financeLoading || !financeReportData?.driversBreakdown?.length}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-300 border border-indigo-700/60 rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-40"
                    title="تصدير كشف حساب وتصفية كباتن التوصيل لملف إكسل"
                  >
                    <Truck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>حساب الطيارين (Excel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportAllOrdersToExcel}
                    disabled={financeLoading || !financeReportData?.orders?.length}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800/80 text-purple-300 border border-purple-700/60 rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-40"
                    title="تصدير كافة طلبات الفترة لملف إكسل"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span>سجل الطلبات (Excel)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Filter & Shift Control Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              {/* Row 1: Branch Selection & Quick Presets */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                {/* Branch Selection Custom Button */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">المطعم / الفرع:</span>
                  <button
                    type="button"
                    onClick={() => setShowFinanceBranchSelectModal(true)}
                    className="flex items-center justify-between gap-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500 text-white text-xs font-bold rounded-xl px-3 py-2 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {financeBranchFilter === 'ALL'
                          ? `جميع الفروع والمطاعم (${branches.length})`
                          : branches.find((b) => b.id === financeBranchFilter)?.name || 'الفرع المحدد'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setFinanceStartDate(`${today}T00:00`);
                      setFinanceEndDate(`${today}T23:59`);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      const yest = d.toISOString().split('T')[0];
                      setFinanceStartDate(`${yest}T00:00`);
                      setFinanceEndDate(`${yest}T23:59`);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    أمس
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 7);
                      const past7 = d.toISOString().split('T')[0];
                      const today = new Date().toISOString().split('T')[0];
                      setFinanceStartDate(`${past7}T00:00`);
                      setFinanceEndDate(`${today}T23:59`);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    آخر 7 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                      const today = now.toISOString().split('T')[0];
                      setFinanceStartDate(`${firstDay}T00:00`);
                      setFinanceEndDate(`${today}T23:59`);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    هذا الشهر
                  </button>
                </div>
              </div>

              {/* Row 2: Date Range Inputs ("من ... إلى ...") */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* From Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">من تاريخ:</span>
                    <input
                      type={financeShowExactHours ? 'datetime-local' : 'date'}
                      value={financeShowExactHours ? financeStartDate : financeStartDate.split('T')[0]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFinanceStartDate(financeShowExactHours ? val : `${val}T00:00`);
                      }}
                      className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* To Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">إلى تاريخ:</span>
                    <input
                      type={financeShowExactHours ? 'datetime-local' : 'date'}
                      value={financeShowExactHours ? financeEndDate : financeEndDate.split('T')[0]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFinanceEndDate(financeShowExactHours ? val : `${val}T23:59`);
                      }}
                      className="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* Exact Hours Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 font-bold hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={financeShowExactHours}
                      onChange={(e) => setFinanceShowExactHours(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <span>تحديد الساعات بدقة (بالوقت والدقائق) ⏱️</span>
                  </label>
                </div>

                {/* Apply Button */}
                <button
                  type="button"
                  onClick={fetchFinanceReport}
                  disabled={financeLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <Filter className="w-4 h-4" />
                  <span>تطبيق الفلتر وعرض الحسابات</span>
                </button>
              </div>

              {/* Timeframe Confirmation Notice */}
              {financeReportData?.timeframe && (
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">● الفترة النشطة المعتمدة:</span>
                    <span>
                      من{' '}
                      <strong className="text-white">
                        {new Date(financeReportData.timeframe.start).toLocaleString('ar-EG')}
                      </strong>{' '}
                      إلى{' '}
                      <strong className="text-white">
                        {new Date(financeReportData.timeframe.end).toLocaleString('ar-EG')}
                      </strong>
                    </span>
                  </div>
                  <span className="text-slate-500 font-mono">
                    {financeReportData.timeframe.shiftMode === 'SHIFT' ? 'نظام الشيفت اليومي' : 'فترة مخصصة بالوقت'}
                  </span>
                </div>
              )}
            </div>

            {/* Error Message if any */}
            {financeError && (
              <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{financeError}</span>
              </div>
            )}

            {/* 3. Subtabs Bar */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => setFinanceSubTab('OVERVIEW')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  financeSubTab === 'OVERVIEW'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>نظرة عامة وطرق الدفع</span>
              </button>

              <button
                type="button"
                onClick={() => setFinanceSubTab('SHIFTS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  financeSubTab === 'SHIFTS'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>مبيعات وشيفتات الفروع</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {financeReportData?.branchBreakdown?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFinanceSubTab('DRIVERS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  financeSubTab === 'DRIVERS'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>حساب وتصفية الطيارين (الكباتن)</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 font-mono">
                  {financeReportData?.driversBreakdown?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFinanceSubTab('ORDERS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  financeSubTab === 'ORDERS'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>سجل الطلبات المفصل</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-950 text-purple-300 font-mono">
                  {financeReportData?.orders?.length || 0}
                </span>
              </button>
            </div>

            {/* 4. Subtab Content */}
            {financeLoading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-400 font-bold">جاري تحميل وتجميع الحسابات المالية والشيفتات...</p>
              </div>
            ) : !financeReportData ? (
              <div className="py-16 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
                <Coins className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-300">لم يتم جلب أي بيانات حتى الآن</p>
                <p className="text-xs text-slate-500 mt-1">اضغط على زر "تطبيق الفلتر وعرض الحسابات" بالأعلى</p>
              </div>
            ) : (
              <>
                {/* SUBTAB 1: OVERVIEW */}
                {financeSubTab === 'OVERVIEW' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Hero KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* 1. Total Gross Sales */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-800/60 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-400">إجمالي المبيعات الكلية</span>
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Coins className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">
                          {Number(financeReportData.summary?.totalGrossSales || 0).toFixed(2)}
                          <span className="text-xs font-bold text-emerald-400 mr-1.5">ج.م</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                          <span>الطلبات المكتملة:</span>
                          <strong className="text-emerald-300 font-mono font-bold">
                            {financeReportData.summary?.completedOrdersCount || 0} طلب
                          </strong>
                        </div>
                      </div>

                      {/* 2. Total Food Net */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-900 border border-purple-800/60 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-purple-400">صافي مبيعات الوجبات (للمطاعم)</span>
                          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                            <Store className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">
                          {Number(financeReportData.summary?.totalFoodNet || 0).toFixed(2)}
                          <span className="text-xs font-bold text-purple-400 mr-1.5">ج.م</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                          <span>إيراد المطاعم باستثناء التوصيل</span>
                        </div>
                      </div>

                      {/* 3. Total Delivery Fees */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-800/60 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-indigo-400">إجمالي رسوم التوصيل</span>
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <Truck className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">
                          {Number(financeReportData.summary?.totalDeliveryFees || 0).toFixed(2)}
                          <span className="text-xs font-bold text-indigo-400 mr-1.5">ج.م</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                          <span>مستحقات خدمة دليفري الحرم</span>
                        </div>
                      </div>

                      {/* 4. Cash Collected in Hand */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border border-amber-800/60 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-amber-400">الكاش المحصل يدوياً</span>
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                            <Wallet className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">
                          {Number(financeReportData.paymentBreakdown?.CASH?.total || 0).toFixed(2)}
                          <span className="text-xs font-bold text-amber-400 mr-1.5">ج.م</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                          <span>مقابل إلكتروني:</span>
                          <strong className="text-sky-300 font-mono font-bold">
                            {(
                              Number(financeReportData.summary?.totalGrossSales || 0) -
                              Number(financeReportData.paymentBreakdown?.CASH?.total || 0)
                            ).toFixed(2)}{' '}
                            ج.م
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Metrics Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-[11px] text-slate-500 block">إجمالي الخصومات والكوبونات:</span>
                        <span className="text-sm font-bold text-rose-400 font-mono">
                          {Number(financeReportData.summary?.totalDiscounts || 0).toFixed(2)} ج.م
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">الطلبات الملغاة / المرفوضة:</span>
                        <span className="text-sm font-bold text-rose-400 font-mono">
                          {financeReportData.summary?.rejectedOrdersCount || 0} طلب (خسارة{' '}
                          {Number(financeReportData.summary?.rejectedLostSales || 0).toFixed(0)} ج.م)
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">إجمالي طلبات الفترة:</span>
                        <span className="text-sm font-bold text-white font-mono">
                          {financeReportData.summary?.totalOrdersCount || 0} طلب
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">نسبة إنجاز الطلبات بنجاح:</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          {financeReportData.summary?.totalOrdersCount > 0
                            ? (
                                (Number(financeReportData.summary?.completedOrdersCount || 0) /
                                  Number(financeReportData.summary?.totalOrdersCount)) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>

                    {/* Payment Methods Breakdown */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span>تفصيل التحصيل حسب طريقة الدفع</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Cash */}
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-400">نقداً (كاش مع الطيار)</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {financeReportData.paymentBreakdown?.CASH?.count || 0} طلب
                            </span>
                          </div>
                          <div className="text-xl font-black text-white font-mono">
                            {Number(financeReportData.paymentBreakdown?.CASH?.total || 0).toFixed(2)}{' '}
                            <span className="text-xs text-slate-400 font-sans">ج.م</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between">
                            <span>رسوم التوصيل المضمنة:</span>
                            <span className="font-mono text-slate-300">
                              {Number(financeReportData.paymentBreakdown?.CASH?.deliveryFees || 0).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>

                        {/* Vodafone Cash */}
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-400">فودافون كاش</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {financeReportData.paymentBreakdown?.VODAFONE_CASH?.count || 0} طلب
                            </span>
                          </div>
                          <div className="text-xl font-black text-white font-mono">
                            {Number(financeReportData.paymentBreakdown?.VODAFONE_CASH?.total || 0).toFixed(2)}{' '}
                            <span className="text-xs text-slate-400 font-sans">ج.م</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between">
                            <span>رسوم التوصيل المضمنة:</span>
                            <span className="font-mono text-slate-300">
                              {Number(financeReportData.paymentBreakdown?.VODAFONE_CASH?.deliveryFees || 0).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>

                        {/* InstaPay */}
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-400">إنستاباي (InstaPay)</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {financeReportData.paymentBreakdown?.INSTAPAY?.count || 0} طلب
                            </span>
                          </div>
                          <div className="text-xl font-black text-white font-mono">
                            {Number(financeReportData.paymentBreakdown?.INSTAPAY?.total || 0).toFixed(2)}{' '}
                            <span className="text-xs text-slate-400 font-sans">ج.م</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between">
                            <span>رسوم التوصيل المضمنة:</span>
                            <span className="font-mono text-slate-300">
                              {Number(financeReportData.paymentBreakdown?.INSTAPAY?.deliveryFees || 0).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>

                        {/* Card */}
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-sky-400">فيزا / بطاقة إلكترونية</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {financeReportData.paymentBreakdown?.CARD?.count || 0} طلب
                            </span>
                          </div>
                          <div className="text-xl font-black text-white font-mono">
                            {Number(financeReportData.paymentBreakdown?.CARD?.total || 0).toFixed(2)}{' '}
                            <span className="text-xs text-slate-400 font-sans">ج.م</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between">
                            <span>رسوم التوصيل المضمنة:</span>
                            <span className="font-mono text-slate-300">
                              {Number(financeReportData.paymentBreakdown?.CARD?.deliveryFees || 0).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Selling Meals in this Period */}
                    {financeReportData.topItems && financeReportData.topItems.length > 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <ChefHat className="w-4 h-4 text-purple-400" />
                          <span>أعلى الوجبات طلباً ومبيعاً خلال هذه الفترة</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {financeReportData.topItems.map((item: any, idx: number) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <span className="font-black text-white block">{item.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    تم بيع <strong className="text-emerald-400 font-mono">{item.qty}</strong> وجبة
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-white text-xs">
                                {Number(item.revenue || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: SHIFTS */}
                {financeSubTab === 'SHIFTS' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div>
                        <h4 className="text-sm font-black text-white">تقرير شيفتات ومبيعات الفروع</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          تجميع مبيعات كل فرع منفصلاً مع مواعيد الفتح والإغلاق، الكاش المحصل، والمبالغ الإلكترونية
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={exportShiftsToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>تصدير تقرير الشيفتات للإكسل</span>
                      </button>
                    </div>

                    {/* Branches Shifts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {financeReportData.branchBreakdown?.map((b: any) => (
                        <div
                          key={b.branchId}
                          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-base shrink-0">
                                <Store className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-black text-base text-white">{b.branchName}</h3>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>
                                    الشيفت الرسمي: {b.openingTime || '08:00'} ص إلى {b.closingTime || '22:00'} م
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setFinanceBranchFilter(b.branchId);
                                setFinanceShiftMode('SHIFT');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                              title="تخصيص الفلتر لهذا الفرع فقط"
                            >
                              عزل الفرع
                            </button>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/70 rounded-xl text-xs font-mono border border-slate-800/80">
                            <div>
                              <span className="text-[10px] text-slate-500 font-sans block">إجمالي المبيعات:</span>
                              <span className="font-bold text-emerald-400 text-sm">
                                {Number(b.grossSales || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-sans block">صافي الوجبات:</span>
                              <span className="font-bold text-purple-400 text-sm">
                                {Number(b.foodNet || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-sans block">رسوم التوصيل:</span>
                              <span className="font-bold text-indigo-400">
                                {Number(b.deliveryFees || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-sans block">كاش / إلكتروني:</span>
                              <span className="text-slate-300 font-bold">
                                {Number(b.cashSales || 0).toFixed(0)} / {Number(b.electronicSales || 0).toFixed(0)} ج.م
                              </span>
                            </div>
                          </div>

                          {/* Footer Order Counts */}
                          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                            <span>
                              الطلبات المكتملة:{' '}
                              <strong className="text-emerald-400 font-mono">{b.completedCount || 0}</strong>
                            </span>
                            <span>
                              الطلبات الملغاة:{' '}
                              <strong className="text-rose-400 font-mono">{b.rejectedCount || 0}</strong>
                            </span>
                            <span>
                              الإجمالي: <strong className="text-white font-mono">{b.totalOrders || 0}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUBTAB 3: DRIVERS */}
                {financeSubTab === 'DRIVERS' && (
                  <div className="space-y-4 animate-fadeIn">
                    {/* Hero Settlement Ledger */}
                    <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/70 border border-indigo-700/50 rounded-2xl p-5 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <Truck className="w-5 h-5 text-indigo-400" />
                            <h4 className="text-base font-black text-white">
                              كشف حسابات وتصفية عهدة كباتن التوصيل (الطيارين)
                            </h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            حساب كل طيار: عدد الطلبات المسلمة، الكاش المحصل بيده من الزبائن، أجرة التوصيل المستحقة، وصافي النقد المطلوب توريده للإدارة
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={exportDriversToExcel}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>تصدير كشف حساب الطيارين للإكسل</span>
                        </button>
                      </div>

                      {/* Cumulative Driver Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-bold">إجمالي الكباتن النشطين:</span>
                          <span className="text-xl font-black text-white font-mono">
                            {financeReportData.driversBreakdown?.length || 0} طيار
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block font-bold">الكاش في يد الطيارين:</span>
                          <span className="text-xl font-black text-amber-400 font-mono">
                            {financeReportData.driversBreakdown
                              ?.reduce((sum: number, d: any) => sum + (d.cashCollectedInHand || 0), 0)
                              .toFixed(2)}{' '}
                            ج.م
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block font-bold">إجمالي أجرة التوصيل المستحقة:</span>
                          <span className="text-xl font-black text-indigo-400 font-mono">
                            {financeReportData.driversBreakdown
                              ?.reduce((sum: number, d: any) => sum + (d.totalDeliveryFeesEarned || 0), 0)
                              .toFixed(2)}{' '}
                            ج.م
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block font-bold">صافي التوريد المطلوب للخزينة:</span>
                          <span className="text-xl font-black text-emerald-400 font-mono">
                            {financeReportData.driversBreakdown
                              ?.reduce((sum: number, d: any) => sum + (d.netCashToDeliver || 0), 0)
                              .toFixed(2)}{' '}
                            ج.م
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Drivers Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                      {financeReportData.driversBreakdown?.map((d: any) => (
                        <div
                          key={d.driverId}
                          className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5 shadow-md hover:border-slate-700/80 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-base shrink-0">
                                <Truck className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-black text-sm sm:text-base text-white leading-tight truncate">
                                    {d.driverName}
                                  </h3>
                                  {d.isActive ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                                      نشط
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                                      معطل
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono">
                                  {d.driverPhone && (
                                    <a
                                      href={`tel:${d.driverPhone}`}
                                      className="flex items-center gap-1 hover:text-indigo-300 transition-colors shrink-0"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                                      <span>{d.driverPhone}</span>
                                    </a>
                                  )}
                                  {d.driverUsername && (
                                    <span
                                      className="px-1.5 py-0.2 rounded-md bg-slate-800/80 text-slate-300 text-[10px] border border-slate-700/60 shrink-0"
                                      dir="ltr"
                                    >
                                      @{d.driverUsername}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedDriverOrdersModal(d)}
                              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shrink-0 shadow-sm"
                              title="عرض تفاصيل طلبات هذا الكابتن"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>الطلبات ({d.deliveredOrdersCount || 0})</span>
                            </button>
                          </div>

                          {/* Driver Financial Breakdown */}
                          <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 bg-slate-950/80 rounded-xl text-xs font-mono border border-slate-800/80">
                            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                              <span className="text-[10px] text-slate-500 font-sans block mb-0.5">الطلبات المسلمة:</span>
                              <span className="font-bold text-white text-sm">
                                {d.deliveredOrdersCount || 0} طلب
                              </span>
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                              <span className="text-[10px] text-slate-500 font-sans block mb-0.5">إجمالي قيمة الطلبات:</span>
                              <span className="font-bold text-slate-200 text-sm">
                                {Number(d.totalOrdersValue || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                              <span className="text-[10px] text-slate-500 font-sans block mb-0.5">الكاش في يد الكابتن:</span>
                              <span className="font-bold text-amber-400 text-sm">
                                {Number(d.cashCollectedInHand || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                              <span className="text-[10px] text-slate-500 font-sans block mb-0.5">أجرة التوصيل المستحقة:</span>
                              <span className="font-bold text-indigo-400 text-sm">
                                {Number(d.totalDeliveryFeesEarned || 0).toFixed(2)} ج.م
                              </span>
                            </div>
                          </div>

                          {/* Settlement Verdict Card */}
                          <div
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                              d.netCashToDeliver > 0
                                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                                : d.netCashToDeliver < 0
                                ? 'bg-sky-950/60 border-sky-800/80 text-sky-300'
                                : 'bg-slate-950/80 border-slate-800 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Wallet className="w-4 h-4 shrink-0" />
                              <span className="truncate">
                                {d.netCashToDeliver > 0
                                  ? 'المطلوب توريده للإدارة:'
                                  : d.netCashToDeliver < 0
                                  ? 'مستحق للكابتن طرف الإدارة:'
                                  : 'الحساب مصفى تماماً:'}
                              </span>
                            </div>
                            <span className="text-sm sm:text-base font-black font-mono shrink-0">
                              {Math.abs(Number(d.netCashToDeliver || 0)).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUBTAB 4: ORDERS */}
                {financeSubTab === 'ORDERS' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div>
                        <h4 className="text-sm font-black text-white">سجل كافة طلبات الفترة</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          عرض تفصيلي لـ {financeReportData.orders?.length || 0} طلب خلال الفترة المحددة مع إمكانية التصدير للإكسل
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={exportAllOrdersToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>تصدير السجل الكامل للإكسل</span>
                      </button>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                            <tr>
                              <th className="py-3 px-4">رقم الطلب</th>
                              <th className="py-3 px-4">الفرع</th>
                              <th className="py-3 px-4">العميل والموقع</th>
                              <th className="py-3 px-4">طريقة الدفع</th>
                              <th className="py-3 px-4">الوجبات</th>
                              <th className="py-3 px-4">التوصيل</th>
                              <th className="py-3 px-4">الإجمالي</th>
                              <th className="py-3 px-4">الحالة</th>
                              <th className="py-3 px-4">الطيار</th>
                              <th className="py-3 px-4">التاريخ والوقت</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {financeReportData.orders?.map((ord: any) => (
                              <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-purple-400">
                                  #{ord.orderNumber}
                                </td>
                                <td className="py-3 px-4 font-bold text-white">{ord.branchName}</td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-white">{ord.customerName}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {ord.addressText || ord.deliveryZoneName || ord.customerPhone}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      ord.paymentMethod === 'CASH'
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                        : ord.paymentMethod === 'VODAFONE_CASH'
                                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                        : ord.paymentMethod === 'INSTAPAY'
                                        ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                                        : 'bg-sky-950 text-sky-400 border border-sky-800'
                                    }`}
                                  >
                                    {ord.paymentMethod === 'CASH' && 'كاش'}
                                    {ord.paymentMethod === 'VODAFONE_CASH' && 'فودافون كاش'}
                                    {ord.paymentMethod === 'INSTAPAY' && 'إنستاباي'}
                                    {ord.paymentMethod === 'CARD' && 'فيزا'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-300">
                                  {Number(ord.subtotal || 0).toFixed(2)}
                                </td>
                                <td className="py-3 px-4 font-mono text-indigo-400">
                                  {Number(ord.deliveryFee || 0).toFixed(2)}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                                  {Number(ord.total || 0).toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      ord.status === 'COMPLETED'
                                        ? 'bg-emerald-950 text-emerald-400'
                                        : ord.status === 'REJECTED'
                                        ? 'bg-rose-950 text-rose-400'
                                        : 'bg-amber-950 text-amber-400'
                                    }`}
                                  >
                                    {ord.status === 'COMPLETED'
                                      ? 'مكتمل'
                                      : ord.status === 'REJECTED'
                                      ? 'ملغي'
                                      : 'قيد التنفيذ'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-bold">
                                  {ord.driverName || <span className="text-slate-500 font-normal">بدون طيار</span>}
                                </td>
                                <td className="py-3 px-4 text-[10px] text-slate-400 font-mono">
                                  {new Date(ord.createdAt).toLocaleTimeString('ar-EG', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  - {new Date(ord.createdAt).toLocaleDateString('ar-EG')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Customer Reviews & Ratings */}
        {activeTab === 'REVIEWS' && (
          <div className="space-y-6">
            {/* Header with Title and Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>تقييمات وآراء العملاء</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                      {reviews.length} تقييم
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    متابعة آراء وملاحظات الطلاب على الطلبات والوجبات، والتعامل السريع مع ملاحظات الفروع
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reviewsLoading}
                  onClick={fetchReviewsData}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  title="تحديث قائمة التقييمات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reviewsLoading ? 'animate-spin text-purple-400' : ''}`} />
                  <span>تحديث</span>
                </button>
              </div>
            </div>

            {/* Summary Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Average Rating */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                  <span>متوسط التقييم العام</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {reviewsStats.averageRating || (reviews.length > 0 ? (reviews.reduce((a: number, b: any) => a + (b.rating || 0), 0) / reviews.length).toFixed(1) : '5.0')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/ 5.0</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const avg = reviewsStats.averageRating || (reviews.length > 0 ? (reviews.reduce((a: number, b: any) => a + (b.rating || 0), 0) / reviews.length) : 5);
                    return (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${s <= Math.round(avg) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
                      />
                    );
                  })}
                  <span className="text-[10px] text-amber-400 font-bold mr-1">
                    {(reviewsStats.averageRating || 5) >= 4.5 ? 'ممتاز جداً 🌟' : (reviewsStats.averageRating || 5) >= 3.5 ? 'جيد جداً 👍' : 'متوسط ⚠️'}
                  </span>
                </div>
              </div>

              {/* Card 2: Total Reviews */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                  <span>إجمالي التقييمات</span>
                  <Star className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {reviewsStats.totalReviews || reviews.length}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">
                  طلب تم تقييمه من قِبل الطلاب
                </span>
              </div>

              {/* Card 3: Reviews with Written Feedback */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                  <span>آراء وملاحظات مكتوبة</span>
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  {reviews.filter((r: any) => r.review && r.review.trim()).length}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">
                  تحتوي على تعليق نصي مفصل
                </span>
              </div>

              {/* Card 4: Positive Satisfaction Rate */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
                  <span>نسبة الرضا العالي</span>
                  <ThumbsUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
                  {reviews.length > 0
                    ? `${Math.round((reviews.filter((r: any) => (r.rating || 0) >= 4).length / reviews.length) * 100)}%`
                    : '100%'}
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${reviews.length > 0 ? (reviews.filter((r: any) => (r.rating || 0) >= 4).length / reviews.length) * 100 : 100}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Star Distribution Breakdown */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800/60">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  <span>توزيع النجوم (اضغط على أي تقييم للفلترة السريعة):</span>
                </span>
                {reviewRatingFilter !== 'ALL' && (
                  <button
                    onClick={() => setReviewRatingFilter('ALL')}
                    className="text-[11px] text-purple-400 hover:text-purple-300 underline"
                  >
                    إلغاء فلترة النجوم
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviews.filter((r: any) => r.rating === stars).length;
                  const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                  const isSelected = reviewRatingFilter === String(stars);

                  return (
                    <button
                      key={stars}
                      type="button"
                      onClick={() => setReviewRatingFilter(isSelected ? 'ALL' : String(stars))}
                      className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-purple-950/80 border-purple-500 ring-1 ring-purple-400/30'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-xs text-white">{stars}</span>
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            stars >= 4 ? 'bg-amber-400' : stars === 3 ? 'bg-amber-600' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Query */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ابحث باسم العميل، الهاتف، رقم الطلب، أو كلمات في الرأي..."
                  value={reviewSearchQuery}
                  onChange={e => setReviewSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Branch Filter */}
              <div className="w-full md:w-52">
                <select
                  value={reviewBranchFilter}
                  onChange={e => setReviewBranchFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">جميع المطاعم والفروع ({branches.length})</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Rating Filter */}
              <div className="w-full md:w-44">
                <select
                  value={reviewRatingFilter}
                  onChange={e => setReviewRatingFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">جميع النجوم (الكل)</option>
                  <option value="5">⭐⭐⭐⭐⭐ 5 نجوم (ممتاز)</option>
                  <option value="4">⭐⭐⭐⭐ 4 نجوم (جيد جداً)</option>
                  <option value="3">⭐⭐⭐ 3 نجوم (متوسط)</option>
                  <option value="2">⭐⭐ 2 نجوم (غير راضٍ)</option>
                  <option value="1">⭐ 1 نجمة (سيئ)</option>
                  <option value="LOW">⚠️ تقييمات منخفضة (1-3 نجوم)</option>
                </select>
              </div>

              {/* Only With Written Text Toggle */}
              <button
                type="button"
                onClick={() => setReviewOnlyWithText(prev => !prev)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                  reviewOnlyWithText
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>تعليقات مكتوبة فقط</span>
              </button>
            </div>

            {/* Results count & Active filters reset */}
            {(reviewBranchFilter !== 'ALL' || reviewRatingFilter !== 'ALL' || reviewOnlyWithText || reviewSearchQuery.trim()) && (
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 px-3 py-2 rounded-xl border border-slate-800/40">
                <span>
                  تم العثور على <strong className="text-white font-mono">{filteredReviews.length}</strong> تقييم مطابق للفلترة
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReviewBranchFilter('ALL');
                    setReviewRatingFilter('ALL');
                    setReviewOnlyWithText(false);
                    setReviewSearchQuery('');
                  }}
                  className="text-purple-400 hover:text-purple-300 font-bold"
                >
                  إعادة ضبط الفلاتر ↺
                </button>
              </div>
            )}

            {/* Reviews Grid */}
            {filteredReviews.length === 0 ? (
              <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-amber-400/60">
                  <Star className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">لا توجد تقييمات مطابقة</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  لم يتم العثور على أي تقييمات تطابق معايير البحث والفلترة المحددة حالياً.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredReviews.map((review: any) => {
                  const ratingNum = review.rating || 5;
                  const isExpanded = expandedReviewOrderId === review.id;
                  const customerName = review.customerName || review.user?.name || 'طالب';
                  const customerPhone = review.customerPhone || review.user?.phone || '';
                  const branchName = review.branch?.name || 'المطعم';

                  return (
                    <div
                      key={review.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all shadow-sm space-y-3.5 flex flex-col justify-between"
                    >
                      {/* Section 1: Customer Profile & Rating Bar */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-800/70 pb-3">
                        {/* Customer Info */}
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/50 text-purple-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {customerName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{customerName}</span>
                              {review.user?.isBlocked && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                                  محظور 🚫
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-slate-400 block">{customerPhone}</span>
                            
                            {/* Customer Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {review.user?.walletBalance !== undefined && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                                  محفظة: {Number(review.user.walletBalance).toFixed(2)} ج.م
                                </span>
                              )}
                              {(review.user?.loyaltyPoints !== undefined || review.pointsEarned > 0) && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/40">
                                  نقاط: {review.user?.loyaltyPoints ?? review.pointsEarned} 🪙
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rating Display */}
                        <div className="flex flex-col items-end shrink-0 text-left">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= ratingNum ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                                }`}
                              />
                            ))}
                            <span className="font-mono font-black text-xs text-white mr-1">
                              {ratingNum}/5
                            </span>
                          </div>

                          <span
                            className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              ratingNum === 5
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                                : ratingNum === 4
                                ? 'bg-teal-950/80 text-teal-400 border-teal-800/60'
                                : ratingNum === 3
                                ? 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                                : ratingNum === 2
                                ? 'bg-orange-950/80 text-orange-400 border-orange-800/60'
                                : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                            }`}
                          >
                            {ratingNum === 5
                              ? 'ممتاز جداً 🌟'
                              : ratingNum === 4
                              ? 'جيد جداً 👍'
                              : ratingNum === 3
                              ? 'متوسط 😐'
                              : ratingNum === 2
                              ? 'غير راضٍ 👎'
                              : 'تجربة سيئة ⚠️'}
                          </span>

                          <span className="text-[10px] text-slate-500 font-mono mt-1">
                            {new Date(review.createdAt).toLocaleDateString('ar-EG', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Section 2: Review Text (الي كتبوه) */}
                      {review.review && review.review.trim() ? (
                        <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3.5 space-y-1 relative">
                          <div className="flex items-center gap-1.5 text-purple-300 text-[11px] font-bold">
                            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                            <span>رأي وتعليق العميل:</span>
                          </div>
                          <p className="text-slate-100 text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-wrap pr-1">
                            "{review.review.trim()}"
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl px-3 py-2 text-slate-400 text-[11px] flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>قيّم العميل الطلب بالنجوم فقط بدون كتابة تعليق نصي إضافي.</span>
                        </div>
                      )}

                      {/* Section 3: Evaluated Order Details (الاوردر الي اتقييم) */}
                      <div className="bg-slate-950/70 border border-slate-800/70 rounded-xl p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-purple-400 font-mono">
                              #{review.orderNumber}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-black text-white">{branchName}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {review.orderType === 'DELIVERY' ? '🛵 توصيل للحرم' : '🛍️ استلام من الفرع'}
                                {review.deliveryZoneName ? ` • ${review.deliveryZoneName}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="text-left">
                            <span className="text-xs font-mono font-black text-emerald-400 block">
                              {Number(review.total).toFixed(2)} ج.م
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {review.paymentMethod === 'CASH' && 'نقداً عند الاستلام'}
                              {review.paymentMethod === 'VODAFONE_CASH' && 'فودافون كاش'}
                              {review.paymentMethod === 'INSTAPAY' && 'انستاباي'}
                              {review.paymentMethod === 'CARD' && 'فيزا / بطاقة'}
                            </span>
                          </div>
                        </div>

                        {/* Campus Delivery Address */}
                        {review.addressText && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{review.addressText}</span>
                          </div>
                        )}

                        {/* Collapsible Order Items */}
                        <div>
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setExpandedReviewOrderId(isExpanded ? null : review.id)}
                              className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                            >
                              <span>أصناف الوجبة ({review.items?.length || 0} صنف)</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetails(review)}
                              className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1"
                              title="عرض تفاصيل الطلب الكاملة في نافذة منبثقة"
                            >
                              <Eye className="w-3 h-3" />
                              <span>تفاصيل كاملة</span>
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-800/60">
                              {review.items?.map((it: any) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between text-xs bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/40"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-purple-950 text-purple-300 font-mono text-[10px] flex items-center justify-center font-bold">
                                      {it.quantity}x
                                    </span>
                                    <span className="font-bold text-slate-200">{it.itemName}</span>
                                    {it.sizeName && (
                                      <span className="text-[10px] text-slate-400">({it.sizeName})</span>
                                    )}
                                  </div>
                                  <span className="font-mono text-slate-300 text-[11px]">
                                    {Number(it.totalPrice).toFixed(2)} ج.م
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 4: Actions Bar (تواصل واتساب، اتصال، فتح الملف، حذف التقييم) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* WhatsApp Customer Button */}
                          <a
                            href={`https://wa.me/20${customerPhone.replace(/^0+/, '')}?text=${encodeURIComponent(
                              `مرحباً أستاذ ${customerName}، تتواصل معك إدارة منصة طلبات الحرم بخصوص تقييمك (${ratingNum}/5 نجوم) للطلب رقم #${review.orderNumber} من مطعم ${branchName}...`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>تواصل واتساب</span>
                          </a>

                          {/* Call Button */}
                          <a
                            href={`tel:${customerPhone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>اتصال</span>
                          </a>

                          {/* Edit Student / Wallet button */}
                          <button
                            type="button"
                            onClick={() => {
                              const st = review.user || {
                                id: review.userId,
                                name: customerName,
                                phone: customerPhone,
                                walletBalance: 0,
                                loyaltyPoints: 0,
                                restaurantNotes: '',
                                isBlocked: false
                              };
                              handleOpenStudentWallet(st);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 rounded-xl text-xs font-bold transition-all"
                          >
                            <User className="w-3.5 h-3.5 text-purple-400" />
                            <span>ملف الطالب</span>
                          </button>
                        </div>

                        {/* Delete Review Button */}
                        <button
                          type="button"
                          disabled={deletingReviewId === review.id}
                          onClick={() => handleDeleteReview(review.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                          title="حذف هذا التقييم من سجل الطلب"
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

        {/* DRIVERS: Delivery Fleet Management (إدارة كباتن التوصيل والربط مع المطاعم) */}
        {activeTab === 'DRIVERS' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">إجمالي كباتن التوصيل</span>
                  <span className="text-xl font-black text-white">{drivers.length}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">الكباتن النشطون</span>
                  <span className="text-xl font-black text-emerald-400">
                    {drivers.filter(d => d.isActive).length}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">طيارون عامون لكل المطاعم</span>
                  <span className="text-xl font-black text-purple-400">
                    {drivers.filter(d => d.isAllBranches).length}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">إجمالي طلبات التوصيل</span>
                  <span className="text-xl font-black text-amber-400">
                    {drivers.reduce((acc, d) => acc + (d._count?.orders || 0), 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Toolbar: Search, Filters & Add Driver Button */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="ابحث باسم الطيار، رقم الهاتف، أو اسم الدخول..."
                    value={driverSearch}
                    onChange={e => setDriverSearch(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => setDriverScopeFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      driverScopeFilter === 'ALL'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل ({drivers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverScopeFilter('GENERAL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      driverScopeFilter === 'GENERAL'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🌐 طيار عام ({drivers.filter(d => d.isAllBranches).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverScopeFilter('SPECIFIC')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      driverScopeFilter === 'SPECIFIC'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🏪 مطاعم محددة ({drivers.filter(d => !d.isAllBranches).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverScopeFilter('INACTIVE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      driverScopeFilter === 'INACTIVE'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🚫 معطل ({drivers.filter(d => !d.isActive).length})
                  </button>
                </div>
              </div>

              {/* Add Driver Button */}
              <button
                type="button"
                onClick={handleOpenAddDriver}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة كابتن توصيل جديد</span>
              </button>
            </div>

            {/* Drivers List / Cards */}
            {driversLoading ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <RotateCw className="w-8 h-8 mx-auto animate-spin text-purple-400" />
                <p className="text-xs font-bold">جاري تحميل بيانات أسطول التوصيل...</p>
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
                <Truck className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="text-sm font-black text-slate-300">لا يوجد كباتن توصيل مطابقين</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  لم يتم العثور على أي كباتن توصيل تطابق معايير البحث أو التصفية الحالية.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddDriver}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول كابتن توصيل الآن</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDrivers.map(driver => (
                  <div
                    key={driver.id}
                    className={`bg-slate-900/70 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all space-y-4 hover:shadow-xl ${
                      driver.isActive
                        ? 'border-slate-800 hover:border-slate-700'
                        : 'border-rose-950/40 bg-slate-950/40 opacity-75'
                    }`}
                  >
                    {/* Top Identity */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-inner ${
                            driver.isAllBranches
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/80'
                          }`}>
                            <Truck className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-white truncate">{driver.name}</h4>
                              <button
                                type="button"
                                disabled={togglingDriverId === driver.id}
                                onClick={() => handleToggleDriverActive(driver.id)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                  driver.isActive
                                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900'
                                    : 'bg-rose-950 text-rose-400 border-rose-800 hover:bg-rose-900'
                                }`}
                              >
                                {togglingDriverId === driver.id ? '...' : (driver.isActive ? 'نشط' : 'معطل')}
                              </button>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 block truncate" dir="ltr">
                              @{driver.username}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Phone & Contact info */}
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${driver.phone}`}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono transition-colors"
                          title="اتصال هاتفي"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{driver.phone}</span>
                        </a>
                        <a
                          href={`https://wa.me/20${driver.phone.replace(/^0+/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-emerald-950/70 border border-emerald-800 text-emerald-400 hover:bg-emerald-900 rounded-lg text-xs transition-colors"
                          title="محادثة واتساب"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* Scope Badge (نطاق العمل: عام لكل المطاعم أو مطاعم محددة) */}
                      <div className="pt-2 border-t border-slate-800/70 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          نطاق استلام الطلبات:
                        </span>
                        {driver.isAllBranches ? (
                          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/50 text-purple-200 text-xs font-bold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                            <span>🌐 طيار عام لجميع المطاعم والفروع</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                              <Store className="w-3.5 h-3.5 text-indigo-400" />
                              <span>مطاعم محددة ({driver.servedBranches?.length || 0}):</span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                              {driver.servedBranches && driver.servedBranches.length > 0 ? (
                                driver.servedBranches.map((b: any) => (
                                  <span
                                    key={b.id}
                                    className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1"
                                  >
                                    <span>🏪</span>
                                    <span>{b.name}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-500">لا يوجد فروع مخصصة</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                        <span>إجمالي الطلبات المنجزة:</span>
                        <span className="font-mono font-black text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-900/50">
                          {driver._count?.orders ?? 0} طلب
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditDriver(driver)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>تعديل النطاق والبيانات</span>
                      </button>

                      <button
                        type="button"
                        disabled={deletingDriverId === driver.id}
                        onClick={() => handleDeleteDriver(driver.id, driver.name)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-900/50"
                        title="حذف الكابتن نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
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
                        <a href={`tel:${student.phone}`} className="font-mono text-xs text-purple-400 hover:text-purple-300 hover:underline block">
                          📞 {student.phone}
                        </a>
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
            {/* Top Toolbar for Financial Reports */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>التقارير المالية ومؤشرات الحرم الجامعي</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  إحصائيات تفصيلية لحجم المبيعات وطرق الدفع وسرعة توصيل المطاعم
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestSendShiftReport('ALL')}
                  disabled={testingShiftReport}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                  title="إرسال التقرير المالي الشامل لكافة فروع اليوم إلى الواتساب"
                >
                  {testingShiftReport ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري إرسال التقرير...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>إرسال التقرير المالي للواتساب 📲</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {shiftReportTestMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{shiftReportTestMsg}</span>
              </div>
            )}

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

                  {/* 3. Driver Unaccepted Order Alert (تنبيه الطيار في حال تأخر قبول الطلب) */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-200 block">
                            تنبيه كابتن التوصيل (الطيار) بالواتساب عند عدم قبول الأوردر
                          </span>
                          <span className="text-[10px] text-slate-400">
                            إرسال رسالة واتساب تلقائية للطيار بتفاصيل الأوردر والمطعم والعنوان في حال تأخر قبوله
                          </span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whatsAppAlertSettings.driverUnacceptedAlertEnabled}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, driverUnacceptedAlertEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1.5">
                          مهلة انتظار قبول الطيار قبل إرسال الواتساب (بالدقائق)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={whatsAppAlertSettings.driverUnacceptedDelayMinutes}
                          onChange={(e) => setWhatsAppAlertSettings({ ...whatsAppAlertSettings, driverUnacceptedDelayMinutes: parseInt(e.target.value) || 3 })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors text-center font-mono"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          عند تعيين طيار للطلب، إذا لم يقم بالضغط على &quot;قبول الطلب&quot; في تطبيق الطيار خلال المهلة المحددة، يقوم السيرفر بإرسال رسالة واتساب إلى رقم هاتف الطيار تلقائياً مع تفاصيل الأوردر واسم المطعم وعنوان التوصيل.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4. Shift Closing Daily Financial Report (التقرير المالي اليومي لإغلاق الشيفت) */}
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
                        disabled={testingShiftReport}
                        className="px-4 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 active:scale-95 shadow-md"
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

            {/* Card 3: Notification Sound Customization */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>التحكم في صوت نغمة الإشعارات والتنبيهات</span>
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black rounded-md border border-indigo-500/30">
                        بث لحظي للـ POS وبوابات الطيارين 🔔
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      رفع نغمة تنبيه مخصصة (MP3, WAV, OGG) تُعزف فورياً عند وصول أي أوردر جديد لكابتن التوصيل أو مطبخ الفرع
                    </p>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                  soundSettings.enabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {soundSettings.enabled ? '● صوت الإشعارات مفعّل' : '○ صوت الإشعارات مكتوم'}
                </span>
              </div>

              <form onSubmit={handleSaveSoundSettings} className="space-y-5">
                {/* Master Audio Toggle */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-200 block">تشغيل نغمة الإشعارات الصوتية</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      عند الإلغاء، ستصل الأوردرات بصمت دون تشغيل أي تنبيه صوتي في المنظومة
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundSettings.enabled}
                      onChange={(e) => setSoundSettings({ ...soundSettings, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Sound Source & Uploader */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Active Sound File Card */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">النغمة المعتمدة حالياً:</span>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">
                            {soundSettings.soundName || 'النغمة الافتراضية للنظام'}
                          </p>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {soundSettings.soundUrl ? '🎵 ملف صوتي مخصص مرفوع' : '🔔 نغمة رنين إلكترونية افتراضية'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handlePlaySoundPreview}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isPlayingPreview ? 'إيقاف الاستماع' : 'استماع وتجربة النغمة'}</span>
                      </button>

                      {soundSettings.soundUrl && (
                        <button
                          type="button"
                          onClick={handleResetSoundSettings}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                        >
                          استعادة النغمة الافتراضية
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload Custom Audio File */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">رفع نغمة صوت جديدة من اختيارك:</span>
                      <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/50 group">
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                          onChange={handleAudioFileUpload}
                          className="hidden"
                          disabled={uploadingAudio}
                        />
                        {uploadingAudio ? (
                          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold py-2">
                            <RotateCw className="w-5 h-5 animate-spin" />
                            <span>جاري رفع وتأمين الملف الصوتي في السيرفر...</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors mb-1.5" />
                            <span className="text-xs font-black text-slate-200 group-hover:text-white">
                              اضغط هنا لاختيار ملف صوتي
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1">
                              يدعم جميع الصيغ (MP3, WAV, OGG, M4A) بحد أقصى 10 ميجابايت
                            </span>
                          </>
                        )}
                      </label>
                    </div>

                    {audioUploadError && (
                      <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{audioUploadError}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                      <span>مستوى شدة صوت الرنين والتنبيه:</span>
                    </label>
                    <span className="font-mono font-black text-indigo-400">
                      {Math.round(soundSettings.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={soundSettings.volume}
                    onChange={(e) => setSoundSettings({ ...soundSettings, volume: parseFloat(e.target.value) || 1.0 })}
                    className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {soundSaveSuccess && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تم حفظ صوت التنبيه بنجاح وبثه لجميع الشاشات ونقاط البيع وبوابات الطيارين! ✅</span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingSoundSettings || loadingSoundSettings}
                    className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {savingSoundSettings ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ والبث...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ وتطبيق نغمة الإشعارات فوراً</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Card: Android Admin App (APK) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>تطبيق لوحة التحكم للأندرويد (Admin Android APK)</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-md border border-emerald-500/30">
                        متاح الآن 📲
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      تطبيق أندرويد مستقل ومباشر للوحة الإدارة لمتابعة الطلبات، إدارة الفروع، وتلقي الإشعارات الفورية
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Admin.apk');
                  }}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 shrink-0"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>تحميل وتثبيت التطبيق (APK)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-slate-200 block">🚀 تشغيل سريع وتلقائي</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    يفتح شاشة الإدارة المركزية فوراً بدون الحاجة لكتابة روابط أو البحث في المتصفح.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-slate-200 block">📦 حزمة مخصصة (com.unifood.admin)</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    يعمل بجانب تطبيق الطلاب وتطبيق الطيارين على نفس الهاتف بدون أي تعارض.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-slate-200 block">🔔 دعم التنبيهات والإشعارات</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    استقبال إشعارات فورية بالطلبات الجديدة والتنبيهات الحساسة للمطاعم على الهاتف.
                  </p>
                </div>
              </div>
            </div>

            {/* Card: Mock Data Seeding (حقن وتوليد البيانات التجريبية الشاملة) */}
            <div className="bg-slate-900 border border-indigo-800/60 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>حقن وتوليد البيانات التجريبية الشاملة (Mock Data)</span>
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black rounded-md border border-indigo-500/30">
                        موصى به للاختبار 🚀
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      توليد 4 مطاعم كاملة بالمنيو والأصناف، 4 بانرات تفاعلية، كوبونات عامة وخاصة، كباتن توصيل، وحسابات طلاب وطلبات لتغذية تقارير المالية
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={seedingMockData}
                  onClick={handleTriggerSeedMockData}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 shrink-0 disabled:opacity-50"
                >
                  {seedingMockData ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>جاري حقن البيانات...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>حقن البيانات التجريبية الآن</span>
                    </>
                  )}
                </button>
              </div>

              {seedMockSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{seedMockSuccess}</span>
                </div>
              )}

              {seedMockError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{seedMockError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-300 block">🍔 4 مطاعم ومنيو كامل</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    برجر فاكتوري، شاورما الحرم (ورديات ليلية)، سبيشيالتي كافيه، رويال بيتزا مع صور وأحجام وإضافات.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-purple-300 block">🖼️ 4 بانرات عروض تفاعلية</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    بانرات إعلانية تفتح المطاعم والعروض مباشرة بنقرة واحدة داخل تطبيق الطلاب.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-amber-300 block">🎟️ كوبونات عامة وخاصة</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    كوبونات عامة (CAMPUS20, WELCOME50) وكوبونات محددة لمطاعم معينة (BURGER15, CAFE10, SHAWARMA10).
                  </p>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="font-bold text-emerald-300 block">🛵 3 كباتن وطلبات تقارير</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    طيارين عامين ومخصصين، وحسابات طلاب وطلبات جاهزة ومكتملة لعرض تقارير المالية والورديات فوراً.
                  </p>
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

      {/* Mobile Bottom Navigation Bar */}
      <nav 
        aria-label="التنقل السريع في لوحة الإدارة"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-xl px-2 py-1.5 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.6)]"
      >
        <div className="grid grid-cols-5 gap-1 items-center max-w-lg mx-auto">
          {/* 1. Branches */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('BRANCHES');
              setShowMobileMoreMenu(false);
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
              activeTab === 'BRANCHES' && !showMobileMoreMenu
                ? 'text-purple-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Building className="w-5 h-5 mb-0.5" />
              {branches.length > 0 && (
                <span className="absolute -top-1 -right-2 text-[9px] font-mono font-bold px-1 py-0.2 bg-slate-800 text-slate-300 rounded-full border border-slate-700 leading-none">
                  {branches.length}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">الفروع</span>
            {activeTab === 'BRANCHES' && !showMobileMoreMenu && (
              <span className="w-1 h-1 rounded-full bg-purple-500 mt-0.5 animate-pulse" />
            )}
          </button>

          {/* 2. Orders */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('ORDERS');
              setShowMobileMoreMenu(false);
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
              activeTab === 'ORDERS' && !showMobileMoreMenu
                ? 'text-purple-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 mb-0.5" />
              {(stats?.pendingOrders ?? 0) > 0 && (
                <span className="absolute -top-1 -right-2 text-[9px] font-mono font-black px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full animate-bounce shadow-sm shadow-amber-500/50 leading-none">
                  {stats?.pendingOrders}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">الطلبات</span>
            {activeTab === 'ORDERS' && !showMobileMoreMenu && (
              <span className="w-1 h-1 rounded-full bg-purple-500 mt-0.5 animate-pulse" />
            )}
          </button>

          {/* 3. Students */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('STUDENTS');
              setShowMobileMoreMenu(false);
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
              activeTab === 'STUDENTS' && !showMobileMoreMenu
                ? 'text-purple-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5 mb-0.5" />
              {students.length > 0 && (
                <span className="absolute -top-1 -right-2 text-[9px] font-mono font-bold px-1 py-0.2 bg-slate-800 text-slate-300 rounded-full border border-slate-700 leading-none">
                  {students.length}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">الطلاب</span>
            {activeTab === 'STUDENTS' && !showMobileMoreMenu && (
              <span className="w-1 h-1 rounded-full bg-purple-500 mt-0.5 animate-pulse" />
            )}
          </button>

          {/* 4. Finance */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('FINANCE');
              setShowMobileMoreMenu(false);
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
              activeTab === 'FINANCE' && !showMobileMoreMenu
                ? 'text-emerald-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Coins className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">المالية</span>
            {activeTab === 'FINANCE' && !showMobileMoreMenu && (
              <span className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5 animate-pulse" />
            )}
          </button>

          {/* 5. More / المزيد */}
          <button
            type="button"
            onClick={() => setShowMobileMoreMenu(prev => !prev)}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
              showMobileMoreMenu || ['BANNERS', 'PROMOS', 'WHATSAPP', 'SETTINGS', 'REVIEWS', 'DRIVERS', 'ANALYTICS'].includes(activeTab)
                ? 'text-purple-400 font-black'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <MoreHorizontal className="w-5 h-5 mb-0.5" />
              {whatsAppStatus?.isConnected && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-slate-900" />
              )}
            </div>
            <span className="text-[10px] leading-tight">المزيد</span>
            {(showMobileMoreMenu || ['BANNERS', 'PROMOS', 'WHATSAPP', 'SETTINGS', 'REVIEWS', 'DRIVERS', 'ANALYTICS'].includes(activeTab)) && (
              <span className="w-1 h-1 rounded-full bg-purple-500 mt-0.5 animate-pulse" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile "المزيد" Bottom Sheet Drawer */}
      {showMobileMoreMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setShowMobileMoreMenu(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fadeIn" 
          />

          {/* Sheet */}
          <div className="relative z-10 bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-safe space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar animate-slideUp shadow-2xl">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>أقسام الإدارة والخدمات الإضافية</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileMoreMenu(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Grid for Secondary Tabs */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* ANALYTICS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ANALYTICS');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'ANALYTICS'
                    ? 'bg-purple-950/70 border-purple-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 font-bold">إحصاءات</span>
                </div>
                <div>
                  <span className="text-xs font-black block text-white">التقارير والمخططات</span>
                  <span className="text-[10px] text-slate-400 block">رسوم بيانية للأداء التاريخي</span>
                </div>
              </button>

              {/* DRIVERS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('DRIVERS');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'DRIVERS'
                    ? 'bg-purple-950/70 border-purple-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {drivers.length}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-black block text-white">كباتن التوصيل (الطيارين)</span>
                  <span className="text-[10px] text-slate-400 block">إدارة الطيارين ونطاق المطاعم</span>
                </div>
              </button>
              {/* REVIEWS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('REVIEWS');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'REVIEWS'
                    ? 'bg-purple-950/70 border-purple-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {reviews.length}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-black block text-white">تقييمات وآراء العملاء</span>
                  <span className="text-[10px] text-slate-400 block">آراء وملاحظات الطلبات</span>
                </div>
              </button>

              {/* BANNERS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('BANNERS');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'BANNERS'
                    ? 'bg-purple-950/70 border-purple-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {banners.length}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-black block text-white">البانرات والإعلانات</span>
                  <span className="text-[10px] text-slate-400 block">واجهة متجر الطلاب</span>
                </div>
              </button>

              {/* PROMOS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('PROMOS');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'PROMOS'
                    ? 'bg-purple-950/70 border-purple-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {promos.length}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-black block text-white">كوبونات الخصم</span>
                  <span className="text-[10px] text-slate-400 block">خصومات الفروع والعامة</span>
                </div>
              </button>

              {/* WHATSAPP */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('WHATSAPP');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'WHATSAPP'
                    ? 'bg-emerald-950/70 border-emerald-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${whatsAppStatus?.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
                </div>
                <div>
                  <span className="text-xs font-black block text-white">بوت الواتساب و OTP</span>
                  <span className="text-[10px] text-slate-400 block">
                    {whatsAppStatus?.isConnected ? 'متصل بنجاح ✅' : 'بانتظار المسح ⚠️'}
                  </span>
                </div>
              </button>

              {/* SETTINGS */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('SETTINGS');
                  setShowMobileMoreMenu(false);
                }}
                className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  activeTab === 'SETTINGS'
                    ? 'bg-purple-950/70 border-purple-600 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-purple-400 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-purple-400 font-mono">سيرفر</span>
                </div>
                <div>
                  <span className="text-xs font-black block text-white">إعدادات النظام والأمان</span>
                  <span className="text-[10px] text-slate-400 block">التنبيهات وتصفير المنظومة</span>
                </div>
              </button>
            </div>

            {/* Quick Install Admin APK banner for mobile browser */}
            {!isRunningInNativeApk() && (
              <button
                type="button"
                onClick={() => {
                  triggerInstallApp('https://github.com/kareemsobhyali/Collage_project/releases/download/latest-apk/UniFood-Admin.apk');
                }}
                className="w-full p-3 bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-700/60 rounded-2xl flex items-center justify-between gap-3 text-white transition-all active:scale-98 shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-base shrink-0">
                    📲
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black block">تحميل تطبيق الإدارة (APK)</span>
                    <span className="text-[10px] text-purple-300 block">تثبيت لوحة التحكم كتطبيق أندرويد مستقل</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-purple-600 hover:bg-purple-500 rounded-xl shrink-0">تثبيت</span>
              </button>
            )}

            {/* Quick Actions Row */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  fetchDashboardData();
                }}
                disabled={loading}
                className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
                <span>تحديث البيانات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  handleReturnToStudentStore();
                }}
                className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Store className="w-4 h-4" />
                <span>متجر الطلاب</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-xl transition-colors hover:bg-rose-900 shrink-0"
                title="تسجيل الخروج"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODALS SECTION */}

      {/* A. Add Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="font-black text-base text-white">إضافة فرع مطعم جديد بالجامعة</h3>
              <button 
                onClick={() => setShowAddBranchModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="font-black text-base text-white">تعديل بيانات: {editingBranch.name}</h3>
              <button 
                onClick={() => setEditingBranch(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBranch} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">وقت بدء العمل (فتح المطعم)</label>
                  <input
                    type="time"
                    value={editOpeningTime}
                    onChange={e => setEditOpeningTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">وقت إغلاق العمل اليومي</label>
                  <input
                    type="time"
                    value={editClosingTime}
                    onChange={e => setEditClosingTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">أيام العمل المتاحة</label>
                <input
                  type="text"
                  value={editWorkingDays}
                  onChange={e => setEditWorkingDays(e.target.value)}
                  placeholder="SUN,MON,TUE,WED,THU,FRI,SAT"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500 font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-500 mt-1">الأيام مفصولة بفواصل (SUN, MON, TUE, WED, THU, FRI, SAT)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">حالة التشغيل اللحظية</label>
                <select
                  value={editOperationalStatus}
                  onChange={e => setEditOperationalStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="OPEN">مفتوح للطلب (OPEN)</option>
                  <option value="BUSY">مغلق مؤقتاً / ضغط طلبات (BUSY)</option>
                  <option value="CLOSED">مغلق تماماً (CLOSED)</option>
                </select>
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="font-black text-base text-white">طرق الدفع: {editingPaymentBranch.name}</h3>
              <button 
                onClick={() => setEditingPaymentBranch(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentSettings} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPaymentBranch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <h3 className="font-black text-base text-white">حساب الديسكتوب: {editingCredentialsBranch.name}</h3>
              <button 
                onClick={() => setEditingCredentialsBranch(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingCredentialsBranch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">إضافة بانر إعلاني جديد</h3>
              </div>
              <button 
                onClick={() => setShowAddBannerModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBanner} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddBannerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">تعديل البانر الإعلاني</h3>
              </div>
              <button 
                onClick={() => setEditingBanner(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBanner} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">إنشاء كوبون خصم جديد</h3>
              </div>
              <button 
                onClick={() => setShowAddPromoModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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

                <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer border border-slate-700/50 hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={newPromoOncePerUser}
                    onChange={e => setNewPromoOncePerUser(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0 w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">متاح للاستخدام مرة واحدة فقط لكل طالب</span>
                    <span className="text-[10px] text-slate-400">يمنع نفس الطالب من استخدام الكوبون أكثر من مرة</span>
                  </div>
                </label>

                {/* Branch Applicability Scope */}
                <div className="p-3.5 bg-slate-800/80 rounded-xl space-y-2.5 border border-slate-700/60">
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
                      <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 custom-scrollbar">
                        {branches.map(b => {
                          const isChecked = newPromoBranchIds.includes(b.id);
                          return (
                            <label
                              key={b.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors border ${
                                isChecked
                                  ? 'bg-purple-950/60 border-purple-700 text-purple-200 font-bold'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Store className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span>{b.name}</span>
                              </div>
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
                                className="rounded text-purple-600 focus:ring-0 w-4 h-4 accent-purple-600 cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                      {newPromoBranchIds.length === 0 && (
                        <p className="text-[10px] text-amber-400 font-bold mt-1">⚠️ يرجى تحديد فرع واحد على الأقل، أو اختيار "كافة الفروع"</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddPromoModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-base text-white">تعديل كوبون الخصم: {editingPromo.code}</h3>
              </div>
              <button 
                onClick={() => setEditingPromo(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPromo} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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

                <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer border border-slate-700/50 hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={editPromoOncePerUser}
                    onChange={e => setEditPromoOncePerUser(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0 w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">متاح للاستخدام مرة واحدة فقط لكل طالب</span>
                    <span className="text-[10px] text-slate-400">يمنع نفس الطالب من استخدام الكوبون أكثر من مرة</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-xl cursor-pointer border border-slate-700/50 hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={editPromoActive}
                    onChange={e => setEditPromoActive(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0 w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-200">تفعيل الكوبون للطلاب</span>
                </label>

                {/* Branch Applicability Scope */}
                <div className="p-3.5 bg-slate-800/80 rounded-xl space-y-2.5 border border-slate-700/60">
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
                      <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 custom-scrollbar">
                        {branches.map(b => {
                          const isChecked = editPromoBranchIds.includes(b.id);
                          return (
                            <label
                              key={b.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors border ${
                                isChecked
                                  ? 'bg-purple-950/60 border-purple-700 text-purple-200 font-bold'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Store className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span>{b.name}</span>
                              </div>
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
                                className="rounded text-purple-600 focus:ring-0 w-4 h-4 accent-purple-600 cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                      {editPromoBranchIds.length === 0 && (
                        <p className="text-[10px] text-amber-400 font-bold mt-1">⚠️ يرجى تحديد فرع واحد على الأقل، أو اختيار "كافة الفروع"</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPromo(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-black text-sm text-white">شحن محفظة الطالب: {editingStudentWallet.name}</h3>
                  <span className="text-[11px] text-slate-400 font-mono block">{editingStudentWallet.phone}</span>
                </div>
              </div>
              <button 
                onClick={() => setEditingStudentWallet(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentWallet} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingStudentWallet(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingStudentWallet}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-rose-800/80 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
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
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteFactoryReset} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-2xl space-y-2 text-xs">
                  <p className="text-rose-200 leading-relaxed font-semibold">
                    ⚠️ سيتم حذف جميع الطلبات التجريبية وسلات الشلة وحسابات الطلاب.
                  </p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    ستبقى فروع المطاعم والمنيو وأسعار الوجبات وحساب الإدارة الرئيسية محفوظاً بالكامل دون أي مساس.
                  </p>
                </div>

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
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
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

      {/* H. Add / Edit Delivery Driver Modal */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg my-auto flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">
                    {editingDriver ? 'تعديل بيانات ونطاق كابتن التوصيل' : 'إضافة كابتن توصيل (طيار) جديد'}
                  </h3>
                  <span className="text-[11px] text-slate-400 block">
                    تحديد نطاق عمل الطيار (عام لجميع المطاعم أو مطاعم محددة)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDriverModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
                {driverFormError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{driverFormError}</span>
                  </div>
                )}

                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">اسم الكابتن الكامل *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد محمود"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">رقم الهاتف *</label>
                    <input
                      type="tel"
                      required
                      placeholder="01xxxxxxxxx"
                      value={driverPhone}
                      onChange={e => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Username & Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">اسم المستخدم للدخول (Username) *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: ahmed_driver"
                      value={driverUsername}
                      onChange={e => setDriverUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      {editingDriver ? 'كلمة المرور (اتركه فارغاً للإبقاء)' : 'كلمة المرور *'}
                    </label>
                    <input
                      type="password"
                      required={!editingDriver}
                      placeholder={editingDriver ? '••••••••' : 'كلمة مرور الدخول'}
                      value={driverPassword}
                      onChange={e => setDriverPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Driver Scope Selector (نطاق العمل واستقبال الطلبات) */}
                <div className="pt-2 space-y-2.5">
                  <label className="block text-xs font-black text-slate-200">
                    نطاق استقبال طلبات المطاعم:
                  </label>

                  {/* Scope Option 1: General Driver (All Branches) */}
                  <div
                    onClick={() => setDriverIsAllBranches(true)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      driverIsAllBranches
                        ? 'bg-purple-950/60 border-purple-600 ring-1 ring-purple-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="driver_scope"
                        checked={driverIsAllBranches}
                        onChange={() => setDriverIsAllBranches(true)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <span className="font-black text-white text-xs block">
                          🌐 استقبال طلبات جميع المطاعم والفروع (طيار عام للمنظومة)
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                          يستقبل الطلبات من كافة مطاعم الحرم الجامعي، ويظهر اسمه في قائمة التعيين لدى جميع كاشيرات الفروع ونقاط البيع.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scope Option 2: Specific Branches */}
                  <div
                    onClick={() => setDriverIsAllBranches(false)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      !driverIsAllBranches
                        ? 'bg-purple-950/60 border-purple-600 ring-1 ring-purple-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="driver_scope"
                        checked={!driverIsAllBranches}
                        onChange={() => setDriverIsAllBranches(false)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <span className="font-black text-white text-xs block">
                          🏪 مطاعم وفروع محددة فقط
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                          يستقبل الطلبات ويظهر فقط لكاشيرات المطاعم المختارة بالأسفل.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Branch Checkboxes if specific branches chosen */}
                  {!driverIsAllBranches && (
                    <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-300">حدد المطاعم المصرح بها ({driverSelectedBranchIds.length} محددة):</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDriverSelectedBranchIds(branches.map(b => b.id))}
                            className="text-purple-400 hover:underline"
                          >
                            تحديد الكل
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={() => setDriverSelectedBranchIds([])}
                            className="text-slate-400 hover:underline"
                          >
                            إلغاء التحديد
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {branches.map(branch => {
                          const isChecked = driverSelectedBranchIds.includes(branch.id);
                          return (
                            <label
                              key={branch.id}
                              className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-purple-950/40 border-purple-800 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setDriverSelectedBranchIds([...driverSelectedBranchIds, branch.id]);
                                  } else {
                                    setDriverSelectedBranchIds(driverSelectedBranchIds.filter(id => id !== branch.id));
                                  }
                                }}
                                className="rounded text-purple-600 focus:ring-0"
                              />
                              <span className="font-bold text-xs truncate">{branch.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Checkbox if editing */}
                {editingDriver && (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={driverIsActive}
                      onChange={e => setDriverIsActive(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-slate-200 block">تفعيل حساب كابتن التوصيل</span>
                      <span className="text-[10px] text-slate-500 block">عند التعطيل، لن يستطيع الطيار تسجيل الدخول أو استقبال أي طلبات</span>
                    </div>
                  </label>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingDriver}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/30 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingDriver ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingDriver ? 'حفظ التعديلات' : 'إضافة الكابتن الآن'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Order Cancellation Dialog */}
      {adminCancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    إلغاء الطلب #{adminCancellingOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {adminCancellingOrder.branch?.name ? `مطعم: ${adminCancellingOrder.branch.name}` : ''}
                    {adminCancellingOrder.customerName ? ` • العميل: ${adminCancellingOrder.customerName}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAdminCancellingOrder(null);
                  setAdminCancelReason('');
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                اختر سبب الإلغاء السريع أو اكتب سبباً مخصصاً:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ADMIN_CANCEL_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setAdminCancelReason(reason)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      adminCancelReason === reason
                        ? 'bg-rose-600 text-white border-rose-500 font-bold shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={adminCancelReason}
                onChange={(e) => setAdminCancelReason(e.target.value)}
                placeholder="اكتب سبب إلغاء هذا الطلب هنا..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors mt-2"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAdminCancellingOrder(null);
                  setAdminCancelReason('');
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = adminCancelReason.trim() || 'تم الإلغاء بواسطة الإدارة';
                  handleAdminUpdateOrderStatus(adminCancellingOrder.id, 'REJECTED', finalReason);
                  setAdminCancellingOrder(null);
                  setAdminCancelReason('');
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/30 active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>تأكيد إلغاء الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Custom Confirmation Modal */}
      {adminConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                adminConfirmDialog.isDanger 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              }`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">
                  {adminConfirmDialog.title}
                </h3>
                <span className="text-[10px] text-slate-400 font-bold block">
                  لوحة الإدارة المركزية
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium whitespace-pre-line">
              {adminConfirmDialog.message}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAdminConfirmDialog(null)}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors"
              >
                {adminConfirmDialog.cancelText || 'تراجع'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = adminConfirmDialog.onConfirm;
                  setAdminConfirmDialog(null);
                  action();
                }}
                className={`py-2.5 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                  adminConfirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                }`}
              >
                <span>{adminConfirmDialog.confirmText || 'تأكيد'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Driver Orders Breakdown Modal (كشف تفاصيل طلبات الطيار) */}
      {selectedDriverOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    سجل طلبات كابتن التوصيل: {selectedDriverOrdersModal.driverName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedDriverOrdersModal.driverPhone}</span>
                    <span className="text-slate-600">|</span>
                    <span>@{selectedDriverOrdersModal.driverUsername}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDriverOrdersModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-sans block">الطلبات المسلمة:</span>
                <span className="text-base font-black text-white">
                  {selectedDriverOrdersModal.deliveredOrdersCount || 0} طلب
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-sans block">الكاش في اليد:</span>
                <span className="text-base font-black text-amber-400">
                  {Number(selectedDriverOrdersModal.cashCollectedInHand || 0).toFixed(2)} ج.م
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-sans block">أجرة التوصيل المستحقة:</span>
                <span className="text-base font-black text-indigo-400">
                  {Number(selectedDriverOrdersModal.totalDeliveryFeesEarned || 0).toFixed(2)} ج.م
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-sans block">صافي التوريد للإدارة:</span>
                <span
                  className={`text-base font-black ${
                    selectedDriverOrdersModal.netCashToDeliver > 0 ? 'text-emerald-400' : 'text-slate-300'
                  }`}
                >
                  {Number(selectedDriverOrdersModal.netCashToDeliver || 0).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Orders List */}
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
              {!selectedDriverOrdersModal.orders || selectedDriverOrdersModal.orders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  لا توجد طلبات مسجلة لهذا الكابتن خلال الفترة المحددة
                </div>
              ) : (
                selectedDriverOrdersModal.orders.map((ord: any) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-mono font-bold shrink-0">
                        #{ord.orderNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white">{ord.branchName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              ord.paymentMethod === 'CASH'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                            }`}
                          >
                            {ord.paymentMethod === 'CASH' ? 'كاش في اليد' : 'دفع إلكتروني'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          العميل: <strong className="text-slate-200">{ord.customerName}</strong>
                          {ord.customerPhone && (
                            <span className="font-mono text-slate-500 mr-2">({ord.customerPhone})</span>
                          )}
                          {ord.deliveryZoneName && (
                            <span className="text-slate-400 mr-2">📍 {ord.deliveryZoneName}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">أجرة التوصيل:</span>
                        <span className="text-indigo-400 font-bold">{Number(ord.deliveryFee || 0).toFixed(2)} ج.م</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">إجمالي الطلب:</span>
                        <span className="text-emerald-400 font-black text-sm">{Number(ord.total || 0).toFixed(2)} ج.م</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {ord.completedAt
                          ? new Date(ord.completedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                          : new Date(ord.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-4 border-t border-slate-800 bg-slate-950/60">
              <button
                type="button"
                onClick={() => setSelectedDriverOrdersModal(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. Custom Dark Branch Selector Modal for Orders */}
      {showOrderBranchSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[85vh] shadow-2xl overflow-hidden overscroll-contain">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">تصفية الطلبات حسب الفرع</h3>
                  <p className="text-[11px] text-slate-400">اختر الفرع لعرض طلباته فقط</p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderBranchSelectModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar overscroll-contain">
              <button
                type="button"
                onClick={() => {
                  setOrderBranchFilter('ALL');
                  setShowOrderBranchSelectModal(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-right ${
                  orderBranchFilter === 'ALL'
                    ? 'bg-purple-950/60 border-purple-600/80 text-white shadow-sm ring-1 ring-purple-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    orderBranchFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-black text-xs sm:text-sm block">جميع فروع الجامعة</span>
                    <span className="text-[10px] text-slate-400">عرض الطلبات من كافة المطاعم ({branches.length} فروع)</span>
                  </div>
                </div>
                {orderBranchFilter === 'ALL' && (
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0 mr-2">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {branches.map((b) => {
                const isSelected = orderBranchFilter === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setOrderBranchFilter(b.id);
                      setShowOrderBranchSelectModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-right ${
                      isSelected
                        ? 'bg-purple-950/60 border-purple-600/80 text-white shadow-sm ring-1 ring-purple-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {b.logoUrl ? (
                        <img
                          src={getFullImageUrl(b.logoUrl)}
                          alt={b.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-800"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm text-white truncate">{b.name}</span>
                          {b.isActive ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                              نشط
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                              معطل
                            </span>
                          )}
                        </div>
                        {b.address && (
                          <span className="text-[10px] text-slate-400 block truncate mt-0.5">{b.address}</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0 mr-2">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* H. Custom Dark Branch Selector Modal for Financials */}
      {showFinanceBranchSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto flex flex-col max-h-[85vh] shadow-2xl overflow-hidden overscroll-contain">
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">تصفية الحسابات حسب المطعم</h3>
                  <p className="text-[11px] text-slate-400">اختر الفرع لحساب مبيعاته وشيفتاته</p>
                </div>
              </div>
              <button
                onClick={() => setShowFinanceBranchSelectModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar overscroll-contain">
              <button
                type="button"
                onClick={() => {
                  setFinanceBranchFilter('ALL');
                  setShowFinanceBranchSelectModal(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-right ${
                  financeBranchFilter === 'ALL'
                    ? 'bg-emerald-950/60 border-emerald-600/80 text-white shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    financeBranchFilter === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-black text-xs sm:text-sm block">جميع الفروع والمطاعم</span>
                    <span className="text-[10px] text-slate-400">حسابات مجمعة لكافة فروع الحرم ({branches.length} فروع)</span>
                  </div>
                </div>
                {financeBranchFilter === 'ALL' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 mr-2">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {branches.map((b) => {
                const isSelected = financeBranchFilter === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setFinanceBranchFilter(b.id);
                      setShowFinanceBranchSelectModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-right ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-600/80 text-white shadow-sm ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {b.logoUrl ? (
                        <img
                          src={getFullImageUrl(b.logoUrl)}
                          alt={b.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-800"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm text-white truncate">{b.name}</span>
                          {b.isActive ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                              نشط
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                              معطل
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                          {b.openingTime && b.closingTime ? `مواعيد العمل: ${b.openingTime} - ${b.closingTime}` : b.address}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 mr-2">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Admin Exit Confirmation Dialog */}
      {showAdminExitDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn overscroll-contain" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-scaleUp text-center overscroll-contain">
            <div className="w-14 h-14 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <LogOut className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-white text-base">
                الخروج من لوحة الإدارة
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                هل تريد مغادرة لوحة التحكم أو تسجيل الخروج؟
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAdminExitDialog(false)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors border border-slate-700/60"
              >
                البقاء في اللوحة
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdminExitDialog(false);
                  handleLogout();
                }}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/20 transition-all active:scale-95"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

