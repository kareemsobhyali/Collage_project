import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Store, 
  ShoppingBag, 
  UtensilsCrossed, 
  Sliders, 
  Truck, 
  LogOut, 
  Volume2, 
  VolumeX, 
  RotateCw,
  Clock, 
  AlertTriangle, 
  LifeBuoy, 
  Lock, 
  Key, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Check, 
  Filter, 
  Search, 
  Sparkles, 
  Share2, 
  Copy, 
  ExternalLink, 
  Printer, 
  AlertCircle, 
  ChevronDown, 
  Calendar, 
  FileSpreadsheet, 
  CreditCard,
  Gift,
  ArrowUpDown,
  Tag,
  User,
  Power,
  LayoutDashboard,
  Flame,
  Award,
  Users,
  Star,
  UserCheck,
  UserX,
  Ban,
  MessageSquare
} from 'lucide-react';
import { API_BASE_URL, api, getFullImageUrl, isBranchOpenByHours } from '../services/api';
import { Logo } from './Logo';

export interface BranchPortalProps {
  onLogout?: () => void;
  onClose?: () => void;
}

export const BranchPortal: React.FC<BranchPortalProps> = ({ onLogout, onClose }) => {
  // Authentication & Branch Profile State
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('branch_token') || localStorage.getItem('admin_token') || null;
  });

  const [branch, setBranch] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('branch_info') || localStorage.getItem('admin_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed.branchId && !parsed.name && parsed.branchName) {
        return { ...parsed, name: parsed.branchName, logoUrl: parsed.branchLogo };
      }
      return parsed.branch || (parsed.role === 'BRANCH_MANAGER' ? parsed : null);
    } catch {
      return null;
    }
  });

  // Login Form State (When not authenticated)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Navigation Tab
  type BranchPortalTab = 'OVERVIEW' | 'ORDERS' | 'DEALS' | 'WHEEL' | 'CUSTOMERS' | 'REVIEWS' | 'MENU' | 'MODIFIERS' | 'DELIVERY' | 'SUPPORT' | 'SETTINGS' | 'FINANCE';
  const [activeTab, setActiveTab] = useState<BranchPortalTab>('OVERVIEW');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Flash Deals State
  const [flashDeals, setFlashDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);
  const [dealTitle, setDealTitle] = useState('');
  const [dealSubtitle, setDealSubtitle] = useState('');
  const [dealType, setDealType] = useState('COMBO');
  const [dealMenuItemId, setDealMenuItemId] = useState('');
  const [dealOriginalPrice, setDealOriginalPrice] = useState('');
  const [dealDiscountPrice, setDealDiscountPrice] = useState('');
  const [dealBadgeText, setDealBadgeText] = useState('عرض خاص 🔥');
  const [dealMaxQuantity, setDealMaxQuantity] = useState('');
  const [dealIsUnlimited, setDealIsUnlimited] = useState(true);
  const [dealExpiresAt, setDealExpiresAt] = useState('');
  const [savingDeal, setSavingDeal] = useState(false);

  // Spin Wheel State
  const [spinWheelEnabled, setSpinWheelEnabled] = useState(true);
  const [spinWheelCouponDays, setSpinWheelCouponDays] = useState(7);
  const [spinWheelPrizes, setSpinWheelPrizes] = useState<any[]>([]);
  const [savingWheel, setSavingWheel] = useState(false);

  // Customers State
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<'ALL' | 'BLOCKED' | 'VIP'>('ALL');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerForCrm, setSelectedCustomerForCrm] = useState<any | null>(null);
  const [crmNotes, setCrmNotes] = useState('');
  const [crmIsBlocked, setCrmIsBlocked] = useState(false);
  const [savingCrm, setSavingCrm] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsSummary, setReviewsSummary] = useState<any>({ averageRating: 5.0, totalReviews: 0, ratingDistribution: {} });

  // Data States
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED'>('PENDING');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState(false);

  // Cancellation Modal with Compensation
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('نفاد الكمية المطلوبة');
  const [sendCompensation, setSendCompensation] = useState(false);
  const [compensationPercent, setCompensationPercent] = useState('15');

  // Assign Driver Modal
  const [assigningOrder, setAssigningOrder] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Propose Custom Add-on / Bill Adjustment Modal
  const [proposingAddonOrder, setProposingAddonOrder] = useState<any | null>(null);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonNote, setAddonNote] = useState('');
  const [submittingAddon, setSubmittingAddon] = useState(false);

  // Menu State
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIsDeals, setNewCategoryIsDeals] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Item Form Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemIsDeal, setItemIsDeal] = useState(false);
  const [itemOriginalPrice, setItemOriginalPrice] = useState('');
  const [itemSizes, setItemSizes] = useState<{ name: string; price: number }[]>([]);
  const [savingItem, setSavingItem] = useState(false);

  // Modifiers State
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [showModifierGroupModal, setShowModifierGroupModal] = useState(false);
  const [editingModifierGroup, setEditingModifierGroup] = useState<any | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupIsRequired, setGroupIsRequired] = useState(false);
  const [groupMinSelection, setGroupMinSelection] = useState('0');
  const [groupMaxSelection, setGroupMaxSelection] = useState('1');
  const [groupOptions, setGroupOptions] = useState<{ id?: string; name: string; price: number }[]>([]);
  const [savingModifierGroup, setSavingModifierGroup] = useState(false);

  // Delivery & Drivers State
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneFee, setNewZoneFee] = useState('15');
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverUsername, setNewDriverUsername] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);

  // Financial Stats
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sound & Live Alert State
  const [isMuted, setIsMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Settings Save Feedback
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editDeliveryFee, setEditDeliveryFee] = useState('10');
  const [editMinOrder, setEditMinOrder] = useState('0');
  const [editPickupEnabled, setEditPickupEnabled] = useState(true);
  const [editFreeDeliveryEnabled, setEditFreeDeliveryEnabled] = useState(false);
  const [editFreeDeliveryMinOrder, setEditFreeDeliveryMinOrder] = useState('200');
  const [editOpeningTime, setEditOpeningTime] = useState('10:00');
  const [editClosingTime, setEditClosingTime] = useState('02:00');
  const [editReceiptHeader, setEditReceiptHeader] = useState('');
  const [editReceiptFooter, setEditReceiptFooter] = useState('');
  const [editCashEnabled, setEditCashEnabled] = useState(true);
  const [editVodafoneCashEnabled, setEditVodafoneCashEnabled] = useState(false);
  const [editVodafoneCashNumber, setEditVodafoneCashNumber] = useState('');
  const [editInstapayEnabled, setEditInstapayEnabled] = useState(false);
  const [editInstapayUsername, setEditInstapayUsername] = useState('');
  const [editRequirePaymentProof, setEditRequirePaymentProof] = useState(true);

  // Play audio chime for incoming new orders
  const playSoundAlert = useCallback(() => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.2); // D6
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (_e) {}
  }, [isMuted]);

  // Load Branch Profile & Core Data
  const loadBranchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [profData, ordersData, menuData, modData, zonesData, driversData] = await Promise.all([
        api.getBranchProfile().catch(() => null),
        api.getBranchOrders().catch(() => []),
        api.getBranchMenuManagement().catch(() => ({ categories: [] })),
        api.getBranchModifierGroups().catch(() => []),
        api.getBranchDeliveryZones().catch(() => []),
        api.getBranchDrivers().catch(() => []),
      ]);

      if (profData?.branch) {
        const b = profData.branch;
        setBranch(b);
        localStorage.setItem('branch_info', JSON.stringify(b));
        setEditName(b.name || '');
        setEditPhone(b.phone || '');
        setEditAddress(b.address || '');
        setEditCuisine(b.cuisine || '');
        setEditDeliveryFee(String(b.deliveryFee ?? 10));
        setEditMinOrder(String(b.minOrderPrice ?? 0));
        setEditPickupEnabled(b.pickupEnabled !== false);
        setEditFreeDeliveryEnabled(Boolean(b.freeDeliveryEnabled));
        setEditFreeDeliveryMinOrder(String(b.freeDeliveryMinOrder ?? 200));
        setEditOpeningTime(b.openingTime || '10:00');
        setEditClosingTime(b.closingTime || '02:00');
        setEditReceiptHeader(b.receiptHeader || b.name || '');
        setEditReceiptFooter(b.receiptFooter || 'شكراً لطلبكم من مطعمنا • نتشرف دائماً بخدمتكم');

        if (b.paymentConfig) {
          setEditCashEnabled(b.paymentConfig.cashEnabled !== false);
          setEditVodafoneCashEnabled(Boolean(b.paymentConfig.vodafoneCashEnabled));
          setEditVodafoneCashNumber(b.paymentConfig.vodafoneCashNumber || '');
          setEditInstapayEnabled(Boolean(b.paymentConfig.instapayEnabled));
          setEditInstapayUsername(b.paymentConfig.instapayUsername || '');
          setEditRequirePaymentProof(b.paymentConfig.requirePaymentProof !== false);
        }

        // إعدادات عجلة الحظ
        setSpinWheelEnabled(b.spinWheelEnabled !== false);
        setSpinWheelCouponDays(b.spinWheelCouponDays || 7);
        let parsedPrizes = [];
        try {
          if (b.spinWheelPrizes) {
            parsedPrizes = typeof b.spinWheelPrizes === 'string' ? JSON.parse(b.spinWheelPrizes) : b.spinWheelPrizes;
          }
        } catch (_e) {}
        if (!Array.isArray(parsedPrizes) || parsedPrizes.length === 0) {
          parsedPrizes = [
            { id: '1', label: 'خصم 10%', type: 'COUPON', value: 10, discountType: 'PERCENT', icon: '🏷️', color: '#f59e0b' },
            { id: '2', label: '10 نقاط', type: 'POINTS', value: 10, icon: '🌟', color: '#6366f1' },
            { id: '3', label: 'توصيل مجاني', type: 'FREE_DELIVERY', value: 0, icon: '🚚', color: '#06b6d4' },
            { id: '4', label: 'خصم 15%', type: 'COUPON', value: 15, discountType: 'PERCENT', icon: '🔥', color: '#10b981' },
            { id: '5', label: 'وجبة هدية', type: 'FREE_ITEM', value: 0, icon: '🍔', color: '#ec4899' },
            { id: '6', label: 'حظ أوفر', type: 'BETTER_LUCK', value: 0, icon: '🍀', color: '#8b5cf6' },
          ];
        }
        setSpinWheelPrizes(parsedPrizes);
      }

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setCategories(Array.isArray(menuData?.categories) ? menuData.categories : []);
      setModifierGroups(Array.isArray(modData) ? modData : []);
      setDeliveryZones(Array.isArray(zonesData) ? zonesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
    } catch (err: any) {
      console.error('Error loading branch portal data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load Financial Stats
  const loadBranchStats = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingStats(true);
      const res = await api.getBranchStats();
      if (res?.stats) {
        setStats(res.stats);
      }
    } catch (_err) {
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  // Load Flash Deals
  const loadBranchFlashDeals = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingDeals(true);
      const res = await api.getBranchFlashDeals();
      setFlashDeals(res?.deals || []);
    } catch (_err) {
    } finally {
      setLoadingDeals(false);
    }
  }, [token]);

  // Load Customers
  const loadBranchCustomers = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingCustomers(true);
      const res = await api.getBranchCustomers();
      setCustomers(res?.customers || []);
    } catch (_err) {
    } finally {
      setLoadingCustomers(false);
    }
  }, [token]);

  // Load Reviews
  const loadBranchReviews = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingReviews(true);
      const res = await api.getBranchReviews();
      setReviews(res?.reviews || []);
      setReviewsSummary({
        averageRating: res?.averageRating ?? 5.0,
        totalReviews: res?.totalReviews ?? 0,
        ratingDistribution: res?.ratingDistribution ?? {},
      });
    } catch (_err) {
    } finally {
      setLoadingReviews(false);
    }
  }, [token]);

  // Load Support Tickets
  const loadBranchTickets = useCallback(async () => {
    if (!token) return;
    try {
      const tickets = await api.getBranchSupportTickets();
      setSupportTickets(Array.isArray(tickets) ? tickets : []);
    } catch (_e) {}
  }, [token]);

  useEffect(() => {
    if (token) {
      loadBranchData();
      loadBranchStats();
      loadBranchFlashDeals();
      loadBranchCustomers();
      loadBranchReviews();
    }
  }, [token, loadBranchData, loadBranchStats, loadBranchFlashDeals, loadBranchCustomers, loadBranchReviews]);

  useEffect(() => {
    if (activeTab === 'FINANCE' || activeTab === 'OVERVIEW') {
      loadBranchStats();
    } else if (activeTab === 'DEALS') {
      loadBranchFlashDeals();
    } else if (activeTab === 'CUSTOMERS') {
      loadBranchCustomers();
    } else if (activeTab === 'REVIEWS' || activeTab === 'SUPPORT') {
      loadBranchReviews();
      loadBranchTickets();
    }
  }, [activeTab, loadBranchStats, loadBranchFlashDeals, loadBranchCustomers, loadBranchReviews, loadBranchTickets]);

  // Setup Real-time Socket.IO Connection for Branch
  useEffect(() => {
    if (!token || !branch?.id) return;
    const socketHost = API_BASE_URL.replace('/api', '');
    const socket = io(socketHost, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_branch_room', branch.id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Handle New Incoming Order
    socket.on('branch_new_order', (newOrder: any) => {
      if (!newOrder) return;
      playSoundAlert();
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
    });

    // Handle Order Status Updates
    socket.on('order_status_updated', (updatedOrder: any) => {
      if (!updatedOrder) return;
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
    });

    return () => {
      socket.disconnect();
    };
  }, [token, branch?.id, playSoundAlert]);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    try {
      setLoginLoading(true);
      const res = await api.branchLogin(loginUsername.trim(), loginPassword.trim());
      if (res?.token) {
        setToken(res.token);
        localStorage.setItem('branch_token', res.token);
        if (res.branch) {
          setBranch(res.branch);
          localStorage.setItem('branch_info', JSON.stringify(res.branch));
        }
      }
    } catch (err: any) {
      setLoginError(err.message || 'فشل تسجيل الدخول، تأكد من بيانات دخول المطعم');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('branch_token');
    localStorage.removeItem('branch_info');
    setToken(null);
    setBranch(null);
    if (onLogout) onLogout();
  };

  // Toggle Restaurant Open / Busy / Closed Status
  const handleToggleOperationalStatus = async (newStatus: 'OPEN' | 'BUSY' | 'CLOSED') => {
    try {
      const res = await api.updateBranchOperationalStatus(newStatus);
      if (res?.branch) {
        setBranch(res.branch);
        localStorage.setItem('branch_info', JSON.stringify(res.branch));
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة المطعم');
    }
  };

  // Copy Direct Branch Link
  const handleCopyStoreLink = () => {
    if (!branch) return;
    const key = branch.slug || branch.id;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://unifood.store';
    const directUrl = `${origin}/${key}`;
    navigator.clipboard.writeText(directUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Flash Deals Handlers
  const handleOpenAddDealModal = () => {
    setEditingDeal(null);
    setDealTitle('');
    setDealSubtitle('');
    setDealType('COMBO');
    setDealMenuItemId('');
    setDealOriginalPrice('');
    setDealDiscountPrice('');
    setDealBadgeText('عرض خاص 🔥');
    setDealMaxQuantity('');
    setDealIsUnlimited(true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setDealExpiresAt(tomorrow.toISOString().split('T')[0]);
    setShowDealModal(true);
  };

  const handleOpenEditDealModal = (deal: any) => {
    setEditingDeal(deal);
    setDealTitle(deal.title || '');
    setDealSubtitle(deal.subtitle || '');
    setDealType(deal.dealType || 'COMBO');
    setDealMenuItemId(deal.menuItemId || '');
    setDealOriginalPrice(deal.originalPrice ? String(deal.originalPrice) : '');
    setDealDiscountPrice(deal.discountPrice ? String(deal.discountPrice) : '');
    setDealBadgeText(deal.badgeText || 'عرض خاص 🔥');
    setDealMaxQuantity(deal.maxQuantity ? String(deal.maxQuantity) : '');
    setDealIsUnlimited(deal.isUnlimited !== false);
    setDealExpiresAt(deal.expiresAt ? new Date(deal.expiresAt).toISOString().split('T')[0] : '');
    setShowDealModal(true);
  };

  const handleSaveDeal = async () => {
    if (!dealTitle.trim()) {
      alert('عنوان العرض مطلوب');
      return;
    }
    try {
      setSavingDeal(true);
      const payload: any = {
        title: dealTitle.trim(),
        subtitle: dealSubtitle.trim() || null,
        dealType,
        menuItemId: dealMenuItemId || null,
        originalPrice: dealOriginalPrice ? parseFloat(dealOriginalPrice) : null,
        discountPrice: dealDiscountPrice ? parseFloat(dealDiscountPrice) : null,
        badgeText: dealBadgeText.trim() || 'عرض خاص 🔥',
        isUnlimited: dealIsUnlimited,
        maxQuantity: dealIsUnlimited ? null : (parseInt(dealMaxQuantity, 10) || null),
        expiresAt: dealExpiresAt ? new Date(dealExpiresAt).toISOString() : undefined,
      };

      if (editingDeal) {
        await api.updateBranchFlashDeal(editingDeal.id, payload);
        alert('تم تعديل العرض بنجاح! 🎉');
      } else {
        await api.createBranchFlashDeal(payload);
        alert('تم إنشاء العرض بنجاح! 🔥');
      }
      setShowDealModal(false);
      loadBranchFlashDeals();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ العرض');
    } finally {
      setSavingDeal(false);
    }
  };

  const handleToggleDeal = async (dealId: string) => {
    try {
      await api.toggleBranchFlashDeal(dealId);
      loadBranchFlashDeals();
    } catch (err: any) {
      alert(err.message || 'فشل تغيير حالة العرض');
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض نهائياً؟')) return;
    try {
      await api.deleteBranchFlashDeal(dealId);
      loadBranchFlashDeals();
    } catch (err: any) {
      alert(err.message || 'فشل حذف العرض');
    }
  };

  // Spin Wheel Handler
  const handleSaveSpinWheel = async () => {
    if (!branch?.id) return;
    try {
      setSavingWheel(true);
      const res = await api.updateBranchDetails({
        name: branch.name,
        spinWheelEnabled,
        spinWheelCouponDays,
        spinWheelPrizes: JSON.stringify(spinWheelPrizes),
      });
      if (res?.branch) {
        setBranch(res.branch);
        localStorage.setItem('branch_info', JSON.stringify(res.branch));
      }
      alert('تم حفظ إعدادات وجوائز عجلة الحظ بنجاح! 🎡');
    } catch (err: any) {
      alert(err.message || 'فشل حفظ إعدادات عجلة الحظ');
    } finally {
      setSavingWheel(false);
    }
  };

  // Customers CRM Handlers
  const handleOpenCustomerCrmModal = (customer: any) => {
    setSelectedCustomerForCrm(customer);
    setCrmNotes(customer.notes || '');
    setCrmIsBlocked(Boolean(customer.isBlocked));
  };

  const handleSaveCustomerCrm = async () => {
    if (!selectedCustomerForCrm?.userId) {
      alert('لا يمكن حظر عميل مسجل كضيف بدون حساب');
      return;
    }
    try {
      setSavingCrm(true);
      await api.updateBranchCustomerCrm(selectedCustomerForCrm.userId, {
        isBlocked: crmIsBlocked,
        restaurantNotes: crmNotes.trim(),
      });
      alert(crmIsBlocked ? 'تم حظر هذا العميل من الطلب من مطعمك 🚫' : 'تم تحديث ملاحظات وبيانات العميل بنجاح');
      setSelectedCustomerForCrm(null);
      loadBranchCustomers();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث بيانات العميل');
    } finally {
      setSavingCrm(false);
    }
  };

  const handleUnblockCustomer = async (userId: string) => {
    if (!window.confirm('هل أنت متأكد من فك الحظر عن هذا العميل والسماح له بالطلب مجدداً؟')) return;
    try {
      await api.unblockBranchCustomer(userId);
      alert('تم فك الحظر عن العميل بنجاح ✅');
      loadBranchCustomers();
    } catch (err: any) {
      alert(err.message || 'فشل فك الحظر');
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, extraData?: any) => {
    try {
      setOrderActionLoading(true);
      const res = await api.updateBranchOrderStatus(orderId, newStatus, extraData);
      if (res?.order) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...res.order } : o));
        if (selectedOrderDetails?.id === orderId) {
          setSelectedOrderDetails({ ...selectedOrderDetails, ...res.order });
        }
      }
      setCancellingOrder(null);
      setAssigningOrder(null);
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة الطلب');
    } finally {
      setOrderActionLoading(false);
    }
  };

  // Confirm Order Cancellation with Reason & Compensation Promo
  const handleConfirmCancelOrder = async () => {
    if (!cancellingOrder) return;
    await handleUpdateOrderStatus(cancellingOrder.id, 'REJECTED', {
      cancellationReason: cancelReason,
      sendCompensation,
      compensationDiscountPercent: sendCompensation ? parseInt(compensationPercent, 10) : 0,
    });
  };

  // Confirm Driver Assignment
  const handleConfirmAssignDriver = async () => {
    if (!assigningOrder) return;
    try {
      setOrderActionLoading(true);
      const res = await api.assignBranchDriver(assigningOrder.id, selectedDriverId || null);
      if (res?.order) {
        setOrders(prev => prev.map(o => o.id === assigningOrder.id ? { ...o, ...res.order } : o));
      }
      setAssigningOrder(null);
    } catch (err: any) {
      alert(err.message || 'فشل تعيين الكابتن');
    } finally {
      setOrderActionLoading(false);
    }
  };

  // إرسال اقتراح إضافة خاصة / تعديل الفاتورة للعميل
  const handleSendAddonProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposingAddonOrder) return;
    if (!addonName.trim()) {
      alert('يرجى كتابة اسم الإضافة أو الصنف المطلوب');
      return;
    }
    const numPrice = Number(addonPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      alert('يرجى تحديد سعر صحيح للإضافة (مثلاً 20 ج.م)');
      return;
    }

    try {
      setSubmittingAddon(true);
      await api.proposeOrderAddon(proposingAddonOrder.id, {
        name: addonName.trim(),
        price: numPrice,
        note: addonNote.trim() || undefined,
      });

      alert(`تم إرسال اقتراح إضافة (${addonName.trim()}) بسعر ${numPrice} ج.م للعميل بنجاح! 🚀\nسيظهر للعميل إشعار فوري بخياري القبول والرفض وتعديل الفاتورة.`);
      setProposingAddonOrder(null);
      setAddonName('');
      setAddonPrice('');
      setAddonNote('');
      await loadBranchData();
    } catch (err: any) {
      alert(err.message || 'فشل إرسال اقتراح الإضافة للعميل');
    } finally {
      setSubmittingAddon(false);
    }
  };

  // Toggle Item In-Stock / Out-of-Stock
  const handleToggleItemStock = async (itemId: string, currentAvail: boolean) => {
    try {
      const res = await api.toggleBranchItemAvailability(itemId, !currentAvail);
      if (res?.item) {
        setCategories(prev =>
          prev.map(cat => ({
            ...cat,
            items: cat.items?.map((it: any) => it.id === itemId ? { ...it, isAvailable: !currentAvail } : it),
          }))
        );
      }
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة توفر الصنف');
    }
  };

  // Save Item (Create or Update)
  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCategoryId) {
      alert('الرجاء كتابة اسم الوجبة واختيار القسم');
      return;
    }
    try {
      setSavingItem(true);
      const payload = {
        name: itemName.trim(),
        description: itemDesc.trim(),
        basePrice: parseFloat(itemPrice) || 0,
        imageUrl: itemImageUrl.trim(),
        categoryId: itemCategoryId,
        isDeal: itemIsDeal,
        originalPrice: itemIsDeal ? (parseFloat(itemOriginalPrice) || null) : null,
        sizes: itemSizes.filter(s => s.name.trim() && s.price >= 0),
      };

      if (editingItem) {
        await api.updateBranchItem(editingItem.id, payload);
      } else {
        await api.createBranchItem(payload);
      }
      setShowItemModal(false);
      setEditingItem(null);
      await loadBranchData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الوجبة');
    } finally {
      setSavingItem(false);
    }
  };

  // Save Category
  const handleSaveCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      if (editingCategory) {
        await api.updateBranchCategory(editingCategory.id, newCategoryName.trim(), editingCategory.displayOrder || 0, newCategoryIsDeals);
      } else {
        await api.createBranchCategory(newCategoryName.trim(), categories.length, newCategoryIsDeals);
      }
      setShowAddCategoryModal(false);
      setEditingCategory(null);
      setNewCategoryName('');
      await loadBranchData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ القسم');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catId: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف قسم "${name}" وجميع الأصناف التابعة له؟`)) return;
    try {
      await api.deleteBranchCategory(catId);
      setCategories(prev => prev.filter(c => c.id !== catId));
    } catch (err: any) {
      alert(err.message || 'فشل حذف القسم');
    }
  };

  // Save Modifier Group
  const handleSaveModifierGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    try {
      setSavingModifierGroup(true);
      const payload = {
        title: groupTitle.trim(),
        isRequired: groupIsRequired,
        minSelection: parseInt(groupMinSelection, 10) || 0,
        maxSelection: parseInt(groupMaxSelection, 10) || 1,
        options: groupOptions.filter(o => o.name.trim()),
      };

      if (editingModifierGroup) {
        await api.updateBranchModifierGroup(editingModifierGroup.id, payload);
      } else {
        await api.createBranchModifierGroup(payload);
      }
      setShowModifierGroupModal(false);
      setEditingModifierGroup(null);
      await loadBranchData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ قسم الإضافات');
    } finally {
      setSavingModifierGroup(false);
    }
  };

  // Save Branch Profile & Payment Settings
  const handleSaveBranchSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setProfileSaveSuccess(false);

      await Promise.all([
        api.updateBranchDetails({
          name: editName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
          cuisine: editCuisine.trim(),
          deliveryFee: parseFloat(editDeliveryFee) || 0,
          minOrderPrice: parseFloat(editMinOrder) || 0,
          pickupEnabled: editPickupEnabled,
          freeDeliveryEnabled: editFreeDeliveryEnabled,
          freeDeliveryMinOrder: parseFloat(editFreeDeliveryMinOrder) || 0,
          receiptHeader: editReceiptHeader.trim(),
          receiptFooter: editReceiptFooter.trim(),
        }),
        api.updateBranchWorkingHours({
          openingTime: editOpeningTime,
          closingTime: editClosingTime,
        }),
        api.updateBranchPaymentMethods({
          cashEnabled: editCashEnabled,
          vodafoneCashEnabled: editVodafoneCashEnabled,
          vodafoneCashNumber: editVodafoneCashNumber.trim(),
          instapayEnabled: editInstapayEnabled,
          instapayUsername: editInstapayUsername.trim(),
          requirePaymentProof: editRequirePaymentProof,
        }),
      ]);

      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3500);
      await loadBranchData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ بيانات وإعدادات المطعم');
    } finally {
      setSavingProfile(false);
    }
  };

  // Add Delivery Zone
  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      const res = await api.addBranchDeliveryZone(newZoneName.trim(), parseFloat(newZoneFee) || 0);
      if (res?.zone) {
        setDeliveryZones(prev => [...prev, res.zone]);
        setShowAddZoneModal(false);
        setNewZoneName('');
      }
    } catch (err: any) {
      alert(err.message || 'فشل إضافة منطقة التوصيل');
    }
  };

  // Delete Delivery Zone
  const handleDeleteZone = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المنطقة؟')) return;
    try {
      await api.deleteBranchDeliveryZone(id);
      setDeliveryZones(prev => prev.filter(z => z.id !== id));
    } catch (err: any) {
      alert(err.message || 'فشل حذف المنطقة');
    }
  };

  // Add Driver
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverPhone.trim() || !newDriverUsername.trim() || !newDriverPassword.trim()) {
      alert('الرجاء إكمال جميع بيانات الكابتن');
      return;
    }
    try {
      setSavingDriver(true);
      const res = await api.createBranchDriver({
        name: newDriverName.trim(),
        phone: newDriverPhone.trim(),
        username: newDriverUsername.trim(),
        password: newDriverPassword.trim(),
      });
      if (res?.driver) {
        setDrivers(prev => [...prev, res.driver]);
        setShowAddDriverModal(false);
        setNewDriverName('');
        setNewDriverPhone('');
        setNewDriverUsername('');
        setNewDriverPassword('');
      }
    } catch (err: any) {
      alert(err.message || 'فشل إضافة كابتن التوصيل');
    } finally {
      setSavingDriver(false);
    }
  };

  // Reply to Support Ticket
  const handleUpdateTicket = async (status: 'OPEN' | 'RESOLVED') => {
    if (!selectedTicket) return;
    try {
      setUpdatingTicket(true);
      const res = await api.updateBranchSupportTicket(selectedTicket.id, {
        status,
        branchNotes: ticketReplyText.trim(),
      });
      if (res?.ticket) {
        setSupportTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...res.ticket } : t));
        setSelectedTicket(null);
        setTicketReplyText('');
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث الشكوى');
    } finally {
      setUpdatingTicket(false);
    }
  };

  // If not authenticated, render Restaurant Manager Login View
  if (!token || !branch) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-600/30 text-white">
              <Store className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">لوحة تحكم مدير المطعم</h2>
              <p className="text-xs text-slate-400 mt-1">خاصة بالمطاعم المشتركة لإدارة الطلبات والمنيو والتوصيل</p>
            </div>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم مستخدم المطعم (Username)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثلاً: divado_waffle"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة مرور مدير المطعم</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loginLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>دخول لوحة تحكم المطعم</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <a href="/" className="hover:text-purple-400 transition-colors">
              ← العودة للرئيسية
            </a>
            <a href="/admin" className="hover:text-purple-400 transition-colors">
              لوحة الإدارة المركزية (Admin)
            </a>
          </div>

          <div className="text-center text-[11px] text-slate-500">
            🔒 منصة UniFood • الصلاحيات محددة فقط بمطعمك لحماية الخصوصية
          </div>
        </div>
      </div>
    );
  }

  // Filtered Orders
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
  const activeOrdersCount = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
  const filteredOrders = orders.filter(o => {
    if (ordersFilter === 'ALL') return true;
    if (ordersFilter === 'PENDING') return o.status === 'PENDING';
    if (ordersFilter === 'PREPARING') return o.status === 'ACCEPTED' || o.status === 'PREPARING' || o.status === 'READY';
    if (ordersFilter === 'OUT_FOR_DELIVERY') return o.status === 'OUT_FOR_DELIVERY';
    if (ordersFilter === 'COMPLETED') return o.status === 'COMPLETED';
    if (ordersFilter === 'CANCELLED') return o.status === 'CANCELLED' || o.status === 'REJECTED';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* Restaurant Brand Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            {branch.logoUrl ? (
              <img
                src={getFullImageUrl(branch.logoUrl)}
                alt={branch.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black shrink-0">
                <Store className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-base font-black text-slate-900 truncate">
                  {branch.name}
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                  مدير المطعم
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className={`inline-flex items-center gap-1 ${socketConnected ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  {socketConnected ? 'متصل لحظياً' : 'غير متصل'}
                </span>
                <span>•</span>
                <span className={branch.isOpen !== false ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                  {branch.isOpen !== false ? 'المطعم مفتوح' : 'المطعم مغلق'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Open/Close Toggle */}
            <button
              type="button"
              onClick={() => handleToggleOperationalStatus(branch.isOpen !== false ? 'CLOSED' : 'OPEN')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                branch.isOpen !== false
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{branch.isOpen !== false ? 'متاح للطلبات' : 'مغلق حالياً'}</span>
            </button>

            {/* Direct Store Link */}
            <button
              type="button"
              onClick={handleCopyStoreLink}
              title="نسخ رابط تطبيق المطعم المباشر"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copiedLink ? 'تم النسخ!' : 'رابط المتجر'}</span>
            </button>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'تفعيل صوت التنبيهات' : 'كتم صوت التنبيهات'}
              className={`p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                isMuted ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="تسجيل الخروج من لوحة المطعم"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-100 py-1">
          {[
            { id: 'OVERVIEW', label: 'لوحة الإدارة', icon: LayoutDashboard },
            { id: 'ORDERS', label: 'سجل الطلبات', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
            { id: 'DEALS', label: 'العروض والتخفيضات', icon: Flame, badge: flashDeals.filter(d => d.isActive).length || null },
            { id: 'WHEEL', label: 'عجلة الحظ والجوائز', icon: Award },
            { id: 'CUSTOMERS', label: 'العملاء والمحظورون', icon: Users, badge: customers.filter(c => c.isBlocked).length > 0 ? `${customers.filter(c => c.isBlocked).length} محظور` : null },
            { id: 'REVIEWS', label: 'التقييمات والشكاوى', icon: Star, badge: supportTickets.filter(t => t.status === 'OPEN').length || null },
            { id: 'MENU', label: 'المنيو والأصناف', icon: UtensilsCrossed },
            { id: 'MODIFIERS', label: 'أقسام الإضافات', icon: Sliders },
            { id: 'DELIVERY', label: 'التوصيل والكباتن', icon: Truck },
            { id: 'FINANCE', label: 'التقارير والمبيعات', icon: TrendingUp },
            { id: 'SETTINGS', label: 'بيانات وإعدادات الفرع', icon: Store },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-3 sm:px-4 text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 w-full pb-20 sm:pb-8">
        {/* ======================================================== */}
        {/* TAB 0: OVERVIEW & STORE MANAGEMENT (لوحة الإدارة والتحكم) */}
        {/* ======================================================== */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* 1. Header Executive Banner */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden border border-purple-500/20">
              <div className="absolute -left-12 -top-12 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {branch?.logoUrl ? (
                      <img src={getFullImageUrl(branch.logoUrl)} alt={branch.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Store className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-black">{branch?.name || 'لوحة تحكم المتجر'}</h1>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                        branch?.operationalStatus === 'OPEN' || branch?.isOpen !== false ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        branch?.operationalStatus === 'BUSY' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}>
                        {branch?.operationalStatus === 'OPEN' || branch?.isOpen !== false ? '🟢 متاح لاستقبال الطلبات' :
                         branch?.operationalStatus === 'BUSY' ? '🟡 في وضع ضغط عمل' : '🔴 المتجر مغلق حالياً'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-purple-200 mt-1 flex-wrap">
                      <span>رابط المتجر المباشر:</span>
                      <a
                        href={`/${branch?.slug || branch?.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-white font-bold underline hover:text-purple-300 flex items-center gap-1"
                      >
                        <span>unifood.store/{branch?.slug || branch?.id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Instant Operational Status Switcher */}
                <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-[11px] text-white/60 font-bold px-2 hidden sm:inline">الحالة التشغيلية:</span>
                  <button
                    type="button"
                    onClick={() => handleToggleOperationalStatus('OPEN')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      (branch?.operationalStatus === 'OPEN' || branch?.isOpen !== false) && branch?.operationalStatus !== 'BUSY'
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    مفتوح
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleOperationalStatus('BUSY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      branch?.operationalStatus === 'BUSY'
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    مشغول
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleOperationalStatus('CLOSED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      branch?.operationalStatus === 'CLOSED' || branch?.isOpen === false
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    مغلق
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold">إجمالي المبيعات</span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
                  {stats?.totalRevenue ?? 0} <span className="text-xs font-normal">ج.م</span>
                </div>
                <span className="text-[11px] text-slate-500 block">اليوم: {stats?.todayRevenue ?? 0} ج.م</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold">الطلبات المكتملة</span>
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-purple-700">
                  {stats?.completedOrdersCount ?? 0} <span className="text-xs font-normal">طلب</span>
                </div>
                <span className="text-[11px] text-slate-500 block">اليوم: {stats?.todayCompletedCount ?? 0} مكتمل</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold">الطلبات الملغاة</span>
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-rose-600">
                  {stats?.cancelledOrdersCount ?? 0} <span className="text-xs font-normal">طلب</span>
                </div>
                <span className="text-[11px] text-rose-500 font-bold block">نسبة الإلغاء: {stats?.cancellationRate ?? 0}%</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold">التقييم العام</span>
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-500">
                  {stats?.averageRating ?? 5.0} <span className="text-xs font-normal">/ 5</span>
                </div>
                <span className="text-[11px] text-slate-500 block">{stats?.totalReviewsCount ?? 0} تقييم مسجل</span>
              </div>
            </div>

            {/* 3. Executive Control Cards Grid (8 Core Management Pillars) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span>خصائص وأقسام إدارة المتجر</span>
                </h3>
                <span className="text-xs text-slate-500">تحكم كامل ومباشر في جميع وظائف المطعم</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Deals & Offers */}
                <div
                  onClick={() => setActiveTab('DEALS')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-purple-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <Flame className="w-6 h-6 text-purple-600" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                      {flashDeals.filter(d => d.isActive).length} عرض نشط
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-purple-700 transition-colors">
                      العروض والتخفيضات (Flash Deals)
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      إنشاء وتعديل العروض الترويجية وخصومات البريك وتحديد الكميات وصلاحية كل عرض.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-purple-700 flex items-center gap-1">
                    <span>إدارة العروض الآن</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 2. Spin The Wheel */}
                <div
                  onClick={() => setActiveTab('WHEEL')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <Award className="w-6 h-6 text-amber-600" />
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${spinWheelEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {spinWheelEnabled ? 'مفعلة بالمتجر' : 'متوقفة'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                      عجلة الحظ ومكافآت المتجر
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      تحديد نسب الجوائز والخصومات والوجبات الهدية وصلاحية الكوبونات التي يربحها العميل.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-amber-700 flex items-center gap-1">
                    <span>تعديل جوائز العجلة</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 3. Orders History & Statuses */}
                <div
                  onClick={() => setActiveTab('ORDERS')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <ShoppingBag className="w-6 h-6 text-blue-600" />
                    </div>
                    {pendingOrdersCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                        {pendingOrdersCount} طلب جديد
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                        {orders.length} طلب إجمالي
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                      سجل الطلبات والتحكم فيها
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      استعراض الطلبات الناجحة، الملغاة وأسبابها، والطلبات الجارية وتفاصيل الفاتورة والعميل.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-blue-700 flex items-center gap-1">
                    <span>فتح سجل الأوردرات</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 4. Blocked & CRM Customers */}
                <div
                  onClick={() => setActiveTab('CUSTOMERS')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-rose-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-rose-600" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                      {customers.filter(c => c.isBlocked).length} محظور
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-rose-700 transition-colors">
                      العملاء والعملاء المحظورون
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      سجل العملاء وإجمالي مشترياتهم، حظر العملاء المسيئين، وكتابة ملاحظات CRM خاصة بالفرع.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-rose-700 flex items-center gap-1">
                    <span>إدارة العملاء والحظر</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 5. Reviews & Complaints */}
                <div
                  onClick={() => setActiveTab('REVIEWS')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <Star className="w-6 h-6 text-amber-500" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {reviews.length} تقييم
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                      التقييمات وشكاوى العملاء
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      متابعة آراء العملاء في الوجبات، التقييمات بالنجوم، وحل أي بلاغ أو شكوى دعم فني.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-amber-700 flex items-center gap-1">
                    <span>عرض التقييمات والشكاوى</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 6. Menu & Items */}
                <div
                  onClick={() => setActiveTab('MENU')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <UtensilsCrossed className="w-6 h-6 text-emerald-600" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                      {categories.reduce((acc, c) => acc + (c.items?.length || 0), 0)} صنف
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                      المنيو والأقسام والأصناف
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      إضافة وتعديل الوجبات والأسعار، وإيقاف أو تشغيل أي صنف فوراً عند نفاد الكمية.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <span>تعديل المنيو والأصناف</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 7. Finance & Sales */}
                <div
                  onClick={() => setActiveTab('FINANCE')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-indigo-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-6 h-6 text-indigo-600" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                      تقارير مالية
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                      التقارير والمبيعات والأرباح
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      تحليل المبيعات اليومية والشهرية، الإيرادات النقدية والإلكترونية، ومتوسط قيمة الفاتورة.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-indigo-700 flex items-center gap-1">
                    <span>فتح التقارير المالية</span>
                    <span>←</span>
                  </div>
                </div>

                {/* 8. Store Settings */}
                <div
                  onClick={() => setActiveTab('SETTINGS')}
                  className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl group-hover:scale-110 transition-transform">
                      <Store className="w-6 h-6 text-slate-700" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-800">
                      إعدادات الفرع
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-slate-700 transition-colors">
                      بيانات وإعدادات الفرع
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      اللوجو، اسم المطعم، الهاتف، مواعيد العمل، رسوم التوصيل، ومناطق التوصيل وطرق الدفع.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>تعديل بيانات المتجر</span>
                    <span>←</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: ORDERS (الطلبات المباشرة)                         */}
        {/* ======================================================== */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'PENDING', label: 'طلبات جديدة', count: pendingOrdersCount, alert: pendingOrdersCount > 0 },
                  { id: 'PREPARING', label: 'قيد التجهيز والتسليم', count: orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length },
                  { id: 'OUT_FOR_DELIVERY', label: 'مع الطيار', count: orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length },
                  { id: 'COMPLETED', label: 'مكتملة', count: orders.filter(o => o.status === 'COMPLETED').length },
                  { id: 'CANCELLED', label: 'ملغاة', count: orders.filter(o => ['CANCELLED', 'REJECTED'].includes(o.status)).length },
                  { id: 'ALL', label: 'الكل', count: orders.length },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrdersFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      ordersFilter === f.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      ordersFilter === f.id ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={loadBranchData}
                className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors shrink-0"
                title="تحديث الطلبات"
              >
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-800">لا توجد طلبات في هذا القسم حالياً</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  عند قيام أي عميل بطلب وجبات من مطعمك، ستظهر هنا فوراً مع تنبيه صوتي مباشر.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredOrders.map(order => {
                  const isPending = order.status === 'PENDING';
                  const isAccepted = order.status === 'ACCEPTED' || order.status === 'PREPARING';
                  const isReady = order.status === 'READY';
                  const isOut = order.status === 'OUT_FOR_DELIVERY';
                  const isCompleted = order.status === 'COMPLETED';
                  const isCancelled = order.status === 'CANCELLED' || order.status === 'REJECTED';

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-3xl border transition-all p-4 space-y-3 shadow-2xs relative overflow-hidden ${
                        isPending ? 'border-amber-300 ring-2 ring-amber-400/30 bg-amber-50/20' : 'border-slate-200'
                      }`}
                    >
                      {/* Order Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                            #{order.orderNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                          isPending ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse' :
                          isAccepted ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          isReady ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                          isOut ? 'bg-purple-50 text-purple-800 border-purple-200' :
                          isCompleted ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {isPending ? '⏳ طلب جديد' :
                           isAccepted ? '🍳 قيد التجهيز' :
                           isReady ? '📦 جاهز للتسليم' :
                           isOut ? '🛵 مع الطيار' :
                           isCompleted ? '✅ مكتمل ومسلّم' : '❌ ملغي'}
                        </span>
                      </div>

                      {/* Customer & Address Details */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-900 font-black">
                          <span>{order.customerName || 'عميل'}</span>
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md font-mono flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{order.customerPhone}</span>
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{order.deliveryAddress || 'استلام من المطعم'}</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-slate-800">
                            <span className="font-bold">
                              {item.quantity}× {item.menuItem?.name || item.name}
                              {item.sizeName && <span className="text-[10px] text-slate-500 font-normal"> ({item.sizeName})</span>}
                            </span>
                            <span className="font-mono text-slate-600">{(item.unitPrice * item.quantity).toFixed(0)} ج.م</span>
                          </div>
                        ))}
                      </div>

                      {/* Customer Notes */}
                      {order.notes && (
                        <div className="p-2.5 bg-amber-50/90 text-amber-900 rounded-2xl text-xs border border-amber-200/80 space-y-1">
                          <div className="flex items-center gap-1.5 font-black text-amber-800 text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>ملاحظات العميل على الطلب:</span>
                          </div>
                          <p className="text-[11px] leading-relaxed font-bold pr-4 bg-white/70 p-1.5 rounded-xl border border-amber-200/50">
                            "{order.notes}"
                          </p>
                        </div>
                      )}

                      {/* Custom Add-on Proposal Status */}
                      {(() => {
                        let proposal: any = null;
                        if (order.customAddonProposal) {
                          try { proposal = JSON.parse(order.customAddonProposal); } catch {}
                        }
                        if (!proposal) return null;
                        const isPropPending = proposal.status === 'PENDING';
                        const isPropAccepted = proposal.status === 'ACCEPTED';
                        const isPropRejected = proposal.status === 'REJECTED';

                        return (
                          <div className={`p-2.5 rounded-2xl text-xs border space-y-1.5 ${
                            isPropPending ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950 animate-pulse' :
                            isPropAccepted ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' :
                            'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            <div className="flex items-center justify-between font-black text-[11px]">
                              <span className="flex items-center gap-1">
                                {isPropPending && '⏳ اقتراح إضافة معلق:'}
                                {isPropAccepted && '✅ وافق العميل وتمت الإضافة للفاتورة:'}
                                {isPropRejected && '❌ رفض العميل اقتراح الإضافة:'}
                              </span>
                              <span className="font-mono font-black text-purple-700 bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                                +{proposal.price} ج.م
                              </span>
                            </div>
                            <div className="font-black text-xs text-slate-900 pr-1">
                              {proposal.name}
                            </div>
                            {proposal.note && (
                              <div className="text-[10px] text-slate-600 pr-1">
                                ملاحظة للعميل: "{proposal.note}"
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 font-medium">
                              {isPropPending && 'في انتظار رد العميل (قبول / رفض) من شاشة التتبع...'}
                              {isPropAccepted && 'تم تحديث الإجمالي وإدراج الصنف في الفاتورة بنجاح'}
                              {isPropRejected && 'تم الرفض، ويتم تحضير الطلب الأصلي كما هو دون زيادة'}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Button to propose custom add-on / adjust bill */}
                      {(isPending || isAccepted || isReady) && (
                        <button
                          type="button"
                          onClick={() => {
                            setProposingAddonOrder(order);
                            setAddonName(order.notes ? order.notes.slice(0, 45) : '');
                            setAddonPrice('');
                            setAddonNote('');
                          }}
                          className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                          title="اقتراح إضافة صنف خاص أو تعديل الحساب بناءً على طلب العميل"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>اقتراح إضافة خاصة / تعديل الفاتورة ➕</span>
                        </button>
                      )}

                      {/* Total & Payment Method */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                        <span className="text-slate-500">
                          {order.paymentMethod === 'VODAFONE_CASH' ? 'فودافون كاش 📱' :
                           order.paymentMethod === 'INSTAPAY' ? 'انستاباي 💳' : 'كاش عند الاستلام 💵'}
                        </span>
                        <div className="text-sm font-black font-mono text-slate-900">
                          {order.total} <span className="text-xs font-normal">ج.م</span>
                        </div>
                      </div>

                      {/* Cancellation Reason if Cancelled */}
                      {(order.status === 'CANCELLED' || order.status === 'REJECTED') && order.cancelReason && (
                        <div className="p-2 bg-rose-50 text-rose-800 rounded-xl text-[11px] font-bold border border-rose-200 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>سبب الإلغاء: {order.cancelReason}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-1">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(order.id, 'ACCEPTED')}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>قبول وتجهيز</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancellingOrder(order)}
                              className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </>
                        )}

                        {isAccepted && (
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <span>تم التجهيز (جاهز للتسليم) 🍳</span>
                          </button>
                        )}

                        {isReady && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningOrder(order);
                              setSelectedDriverId(order.driverId || '');
                            }}
                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>{order.driver ? `تغيير الطيار (${order.driver.name})` : 'تعيين طيار 🛵'}</span>
                          </button>
                        )}

                        {isOut && (
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order.id, 'COMPLETED')}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تأكيد التسليم بنجاح</span>
                          </button>
                        )}

                        {/* View Details Modal Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedOrderDetails(order)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                          title="تفاصيل الطلب الكاملة"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MENU & ITEMS (المنيو والأصناف)                     */}
        {/* ======================================================== */}
        {activeTab === 'MENU' && (
          <div className="space-y-4">
            {/* Menu Header Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-2xl">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">إدارة منيو المطعم</h3>
                  <p className="text-[11px] text-slate-500">إضافة وتعديل الأصناف، الأسعار، وحالة التوفر بالمطعم</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setNewCategoryName('');
                    setNewCategoryIsDeals(false);
                    setShowAddCategoryModal(true);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة قسم</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setItemName('');
                    setItemDesc('');
                    setItemPrice('');
                    setItemImageUrl('');
                    setItemCategoryId(categories[0]?.id || '');
                    setItemIsDeal(false);
                    setItemOriginalPrice('');
                    setItemSizes([]);
                    setShowItemModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة صنف جديد</span>
                </button>
              </div>
            </div>

            {/* Categories Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategoryFilter === 'ALL'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                جميع الأصناف
              </button>
              {categories.map(cat => (
                <div key={cat.id} className="relative group shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      selectedCategoryFilter === cat.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] opacity-70">({cat.items?.length || 0})</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {categories
                .filter(cat => selectedCategoryFilter === 'ALL' || cat.id === selectedCategoryFilter)
                .flatMap(cat => (cat.items || []).map((item: any) => ({ ...item, categoryName: cat.name })))
                .map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-200 p-3.5 space-y-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      {item.imageUrl ? (
                        <img
                          src={getFullImageUrl(item.imageUrl)}
                          alt={item.name}
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="w-7 h-7" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-black text-slate-900 truncate">{item.name}</h4>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md truncate">
                            {item.categoryName}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black font-mono text-purple-700">
                            {item.basePrice} <span className="text-xs font-normal">ج.م</span>
                          </span>
                          {item.isDeal && item.originalPrice && (
                            <span className="text-xs text-slate-400 line-through font-mono">
                              {item.originalPrice} ج.م
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock Toggle & Edit Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleItemStock(item.id, item.isAvailable !== false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          item.isAvailable !== false
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${item.isAvailable !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span>{item.isAvailable !== false ? 'متوفر بالمطعم' : 'غير متوفر (نفد)'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setItemName(item.name || '');
                            setItemDesc(item.description || '');
                            setItemPrice(String(item.basePrice ?? ''));
                            setItemImageUrl(item.imageUrl || '');
                            setItemCategoryId(item.categoryId || '');
                            setItemIsDeal(Boolean(item.isDeal));
                            setItemOriginalPrice(String(item.originalPrice ?? ''));
                            setItemSizes(item.sizes || []);
                            setShowItemModal(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل الصنف"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف وجبة "${item.name}"؟`)) {
                              await api.deleteBranchItem(item.id);
                              await loadBranchData();
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف الصنف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: MODIFIERS (أقسام الإضافات والخيارات)                */}
        {/* ======================================================== */}
        {activeTab === 'MODIFIERS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-2xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">أقسام إضافات وخيارات الوجبات</h3>
                  <p className="text-[11px] text-slate-500">مثل إضافات الصوصات، الجبن، الخبز، أو الأحجام الإضافية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingModifierGroup(null);
                  setGroupTitle('');
                  setGroupIsRequired(false);
                  setGroupMinSelection('0');
                  setGroupMaxSelection('1');
                  setGroupOptions([{ name: '', price: 0 }]);
                  setShowModifierGroupModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة قسم إضافات</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {modifierGroups.map(group => (
                <div key={group.id} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{group.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        group.isRequired ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {group.isRequired ? 'إلزامي للعميل' : 'اختياري'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModifierGroup(group);
                          setGroupTitle(group.title || '');
                          setGroupIsRequired(Boolean(group.isRequired));
                          setGroupMinSelection(String(group.minSelection ?? 0));
                          setGroupMaxSelection(String(group.maxSelection ?? 1));
                          setGroupOptions(group.options || []);
                          setShowModifierGroupModal(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`حذف قسم الإضافات "${group.title}"؟`)) {
                            await api.deleteBranchModifierGroup(group.id);
                            await loadBranchData();
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                    {(group.options || []).map((opt: any) => (
                      <div key={opt.id} className="flex items-center justify-between text-slate-800">
                        <span>{opt.name}</span>
                        <span className="font-mono text-slate-600">+{opt.price} ج.م</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: DELIVERY & CAPTAINS (التوصيل والكباتن)            */}
        {/* ======================================================== */}
        {activeTab === 'DELIVERY' && (
          <div className="space-y-6">
            {/* Delivery Zones */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-2xl">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">مناطق ورسوم التوصيل للفرع</h3>
                    <p className="text-[11px] text-slate-500">حدد أسعار ورسوم التوصيل لمختلف المناطق والأحياء</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddZoneModal(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة منطقة</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {deliveryZones.map(zone => (
                  <div key={zone.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900">{zone.name}</div>
                      <div className="text-xs font-mono text-purple-700 font-bold">{zone.fee} ج.م رسوم</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteZone(zone.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Captains / Drivers */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-2xl">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">كباتن التوصيل (الطيارين) التابعين للمطعم</h3>
                    <p className="text-[11px] text-slate-500">حسابات الطيارين لتسليم وتتبع الطلبات</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة كابتن توصيل</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {drivers.map(driver => (
                  <div key={driver.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {driver.name?.charAt(0) || 'ط'}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900">{driver.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{driver.phone}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        driver.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {driver.isActive ? 'نشط' : 'معطل'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: FLASH DEALS (العروض والتخفيضات)                      */}
        {/* ======================================================== */}
        {activeTab === 'DEALS' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-2xl">
                  <Flame className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">إدارة العروض والتخفيضات (Flash Deals)</h3>
                  <p className="text-[11px] text-slate-500">العروض الترويجية والخصومات المخصصة لمطعمك فقط</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadBranchFlashDeals}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="تحديث"
                >
                  <RotateCw className={`w-4 h-4 ${loadingDeals ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddDealModal}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة عرض جديد</span>
                </button>
              </div>
            </div>

            {flashDeals.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
                <Flame className="w-10 h-10 text-purple-300 mx-auto" />
                <h4 className="text-sm font-black text-slate-800">لا توجد عروض حالياً</h4>
                <p className="text-xs text-slate-500">قم بإنشاء أول عرض ترويجي لجذب مزيد من الطلبات لمطعمك!</p>
                <button
                  type="button"
                  onClick={handleOpenAddDealModal}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء عرض الآن</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {flashDeals.map(deal => (
                  <div key={deal.id} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 shadow-2xs flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                          {deal.badgeText || 'عرض خاص 🔥'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleDeal(deal.id)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            deal.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {deal.isActive ? '● نشط' : '○ متوقف'}
                        </button>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">{deal.title}</h4>
                      {deal.subtitle && <p className="text-xs text-slate-500">{deal.subtitle}</p>}
                      <div className="flex items-baseline gap-2">
                        {deal.discountPrice !== null && deal.discountPrice !== undefined ? (
                          <>
                            <span className="text-base font-black font-mono text-purple-700">{deal.discountPrice} ج.م</span>
                            {deal.originalPrice && (
                              <span className="text-xs font-mono text-slate-400 line-through">{deal.originalPrice} ج.م</span>
                            )}
                            {deal.discountPercent && (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                وفر {deal.discountPercent}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm font-black font-mono text-slate-700">{deal.originalPrice} ج.م</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>الكمية: {deal.isUnlimited ? 'غير محدودة' : `${deal.maxQuantity || 0} وجبة`}</span>
                        <span>مباع: {deal.soldQuantity || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditDealModal(deal)}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDeal(deal.id)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: SPIN WHEEL (عجلة الحظ وجوائز المتجر)                 */}
        {/* ======================================================== */}
        {activeTab === 'WHEEL' && (
          <div className="space-y-5">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-2xl">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">عجلة الحظ ومكافآت المتجر (Gamification)</h3>
                  <p className="text-[11px] text-slate-500">تحفيز عملاء مطعمك بالهدايا والخصومات بعد إتمام كل طلب</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveSpinWheel}
                disabled={savingWheel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{savingWheel ? 'جاري الحفظ...' : 'حفظ الإعدادات والجوائز'}</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-black text-slate-900">تفعيل عجلة الحظ لهذا المطعم</h4>
                  <p className="text-[11px] text-slate-500">تظهر للعميل فور اكتمال طلبه لربح جائزة تشجيعية</p>
                </div>
                <input
                  type="checkbox"
                  checked={spinWheelEnabled}
                  onChange={e => setSpinWheelEnabled(e.target.checked)}
                  className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مدة صلاحية كوبون الجائزة (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={spinWheelCouponDays}
                  onChange={e => setSpinWheelCouponDays(parseInt(e.target.value) || 7)}
                  className="w-full sm:w-60 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">مثال: 7 أيام لاستخدام الكوبون قبل انتهاء صلاحيته</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-800">قائمة جوائز وقطاعات العجلة ({spinWheelPrizes.length} جوائز)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = String(Date.now());
                      setSpinWheelPrizes(prev => [...prev, { id: newId, label: 'خصم جديد', type: 'COUPON', value: 10, discountType: 'PERCENT', icon: '🎁', color: '#6366f1' }]);
                    }}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة جائزة</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {spinWheelPrizes.map((prize, idx) => (
                    <div key={prize.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 relative">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-lg">{prize.icon || '🎁'}</span>
                        <input
                          type="text"
                          value={prize.label || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setSpinWheelPrizes(prev => prev.map((p, i) => i === idx ? { ...p, label: val } : p));
                          }}
                          placeholder="اسم الجائزة"
                          className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setSpinWheelPrizes(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                          title="حذف الجائزة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">النوع</label>
                          <select
                            value={prize.type || 'COUPON'}
                            onChange={e => {
                              const val = e.target.value;
                              setSpinWheelPrizes(prev => prev.map((p, i) => i === idx ? { ...p, type: val } : p));
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold"
                          >
                            <option value="COUPON">كوبون خصم</option>
                            <option value="POINTS">نقاط محفظة</option>
                            <option value="FREE_DELIVERY">توصيل مجاني</option>
                            <option value="FREE_ITEM">وجبة هدية</option>
                            <option value="BETTER_LUCK">حظ أوفر</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">القيمة / النسبة</label>
                          <input
                            type="number"
                            value={prize.value ?? 10}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setSpinWheelPrizes(prev => prev.map((p, i) => i === idx ? { ...p, value: val } : p));
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: CUSTOMERS & BLACKLIST (العملاء والمحظورون)           */}
        {/* ======================================================== */}
        {activeTab === 'CUSTOMERS' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-2xl">
                  <Users className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">عملاء المطعم والعملاء المحظورون</h3>
                  <p className="text-[11px] text-slate-500">متابعة سجل مشتريات كل عميل، حظر المسيئين، وتدوين ملاحظات CRM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="بحث باسم أو هاتف العميل..."
                    className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadBranchCustomers}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="تحديث"
                >
                  <RotateCw className={`w-4 h-4 ${loadingCustomers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomerFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  customerFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                جميع العملاء ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerFilter('BLOCKED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  customerFilter === 'BLOCKED' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                المحظورون فقط ({customers.filter(c => c.isBlocked).length})
              </button>
            </div>

            {/* Customers List */}
            {customers.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-black text-slate-800">لا يوجد عملاء مسجلون حالياً</h4>
                <p className="text-xs text-slate-500">سيظهر هنا جميع العملاء الذين يطلبون من مطعمك مع سجل طلباتهم.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {customers
                  .filter(c => {
                    if (customerFilter === 'BLOCKED') return c.isBlocked;
                    if (!customerSearch.trim()) return true;
                    const q = customerSearch.toLowerCase();
                    return (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q));
                  })
                  .map(c => (
                    <div key={c.userId || c.phone} className={`bg-white rounded-3xl border p-4 space-y-3 shadow-2xs flex flex-col justify-between ${c.isBlocked ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'}`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                              {c.name ? c.name[0] : 'ع'}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{c.name || 'عميل'}</h4>
                              <a href={`tel:${c.phone}`} className="text-[11px] font-mono text-purple-700 hover:underline">{c.phone}</a>
                            </div>
                          </div>
                          {c.isBlocked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                              🚫 محظور
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              نشط
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-2xl text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">الطلبات</span>
                            <span className="font-bold text-slate-800 font-mono">{c.totalOrders}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-600 block">ناجحة</span>
                            <span className="font-bold text-emerald-700 font-mono">{c.completedOrders}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-500 block">ملغاة</span>
                            <span className="font-bold text-rose-600 font-mono">{c.cancelledOrders}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500">إجمالي الإنفاق:</span>
                          <span className="font-bold font-mono text-emerald-700">{c.totalSpent} ج.م</span>
                        </div>

                        {c.notes && (
                          <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] leading-relaxed">
                            <span className="font-bold block text-[10px] text-amber-700">ملاحظات الفرع:</span>
                            {c.notes}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCustomerCrmModal(c)}
                          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {c.isBlocked ? 'تعديل الحظر والملاحظات' : 'حظر / كتابة ملاحظة'}
                        </button>
                        {c.isBlocked && c.userId && (
                          <button
                            type="button"
                            onClick={() => handleUnblockCustomer(c.userId)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            title="فك الحظر"
                          >
                            فك الحظر
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: REVIEWS & SUPPORT (التقييمات وشكاوى العملاء)         */}
        {/* ======================================================== */}
        {(activeTab === 'REVIEWS' || activeTab === 'SUPPORT') && (
          <div className="space-y-6">
            {/* Reviews Summary Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-2xl">
                    <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تقييمات وآراء العملاء بالمتجر</h3>
                    <p className="text-[11px] text-slate-500">رأي وتقييم العملاء في الوجبات والتوصيل وجودة الخدمة</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { loadBranchReviews(); loadBranchTickets(); }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="تحديث"
                >
                  <RotateCw className={`w-4 h-4 ${loadingReviews ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div className="flex flex-col items-center justify-center p-3 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <div className="text-3xl font-black font-mono text-amber-600">
                    {reviewsSummary.averageRating}
                  </div>
                  <div className="flex items-center gap-1 my-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} className={`w-4 h-4 ${star <= Math.round(reviewsSummary.averageRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500">من إجمالي {reviewsSummary.totalReviews} تقييم</span>
                </div>

                <div className="sm:col-span-2 space-y-1.5 justify-center flex flex-col">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = reviewsSummary.ratingDistribution?.[stars] || 0;
                    const pct = reviewsSummary.totalReviews > 0 ? (count / reviewsSummary.totalReviews) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-12 font-bold text-slate-600 font-mono flex items-center gap-1">
                          <span>{stars}</span>
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 font-mono text-[11px] text-slate-400 text-left">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-900">أحدث تقييمات العملاء</h4>
              {reviews.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
                  <Star className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-black text-slate-800">لا توجد تقييمات بعد</h4>
                  <p className="text-xs text-slate-500">ستظهر هنا التقييمات فور قيام العملاء بتقييم طلباتهم بعد الاستلام.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reviews.map(rev => (
                    <div key={rev.id} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{rev.customerName || 'عميل'}</span>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-3.5 h-3.5 ${s <= (rev.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      {rev.review ? (
                        <p className="p-2.5 bg-slate-50 rounded-xl text-slate-700 text-xs leading-relaxed">
                          "{rev.review}"
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">تقييم بالنجوم فقط بدون تعليق</p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>{new Date(rev.createdAt).toLocaleDateString('ar-EG')}</span>
                        <span className="font-mono">فاتورة: {rev.total} ج.م</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Support Tickets Section */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <LifeBuoy className="w-4 h-4 text-rose-600" />
                  <span>شكاوى واستفسارات العملاء المفتوحة</span>
                </h4>
                <span className="text-[11px] text-slate-500">{supportTickets.length} بلاغ</span>
              </div>

              {supportTickets.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">لا توجد أي شكاوى مفتوحة حالياً ✅</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {supportTickets.map(ticket => (
                    <div key={ticket.id} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-700 font-mono">
                          طلب #{ticket.orderNumber}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ticket.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {ticket.status === 'RESOLVED' ? 'تم الحل' : 'قيد المراجعة'}
                        </span>
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-slate-900">{ticket.customerName || 'عميل'} ({ticket.customerPhone})</div>
                        <div className="p-2.5 bg-slate-50 rounded-xl text-slate-700 leading-relaxed text-[11px]">
                          {ticket.description || ticket.message}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setTicketReplyText(ticket.branchNotes || '');
                        }}
                        className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-black transition-colors cursor-pointer"
                      >
                        الرد وحل الشكوى
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: SETTINGS & PROFILE (بيانات الفرع والدفع)          */}
        {/* ======================================================== */}
        {activeTab === 'SETTINGS' && (
          <form onSubmit={handleSaveBranchSettings} className="space-y-6">
            {profileSaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-black flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم حفظ وتحديث بيانات وإعدادات المطعم بنجاح! 🎉</span>
              </div>
            )}

            {/* General Info */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-600" />
                <span>بيانات المطعم الأساسية</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المطعم *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">هاتف المطعم / الكاشير *</label>
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">عنوان المطعم</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع المأكولات / التصنيف</label>
                  <input
                    type="text"
                    value={editCuisine}
                    onChange={e => setEditCuisine(e.target.value)}
                    placeholder="مثلاً: وافل وكريب وحلويات"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>مواعيد العمل اليومية</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ساعة الفتح يومياً</label>
                  <input
                    type="time"
                    value={editOpeningTime}
                    onChange={e => setEditOpeningTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ساعة الإغلاق يومياً</label>
                  <input
                    type="time"
                    value={editClosingTime}
                    onChange={e => setEditClosingTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>طرق الدفع الإلكتروني واستلام الأموال</span>
              </h3>
              <div className="space-y-3 text-xs">
                {/* Cash */}
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                  <span className="font-bold text-slate-900">الدفع كاش عند الاستلام (Cash on Delivery)</span>
                  <input
                    type="checkbox"
                    checked={editCashEnabled}
                    onChange={e => setEditCashEnabled(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                </label>

                {/* Vodafone Cash */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-900">محفظة فودافون كاش (Vodafone Cash)</span>
                    <input
                      type="checkbox"
                      checked={editVodafoneCashEnabled}
                      onChange={e => setEditVodafoneCashEnabled(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                  </label>
                  {editVodafoneCashEnabled && (
                    <input
                      type="text"
                      placeholder="رقم محفظة فودافون كاش للتحويل"
                      value={editVodafoneCashNumber}
                      onChange={e => setEditVodafoneCashNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs"
                    />
                  )}
                </div>

                {/* Instapay */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-900">تحويل انستاباي (InstaPay)</span>
                    <input
                      type="checkbox"
                      checked={editInstapayEnabled}
                      onChange={e => setEditInstapayEnabled(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                  </label>
                  {editInstapayEnabled && (
                    <input
                      type="text"
                      placeholder="اسم المستخدم أو رابط حساب انستاباي (IPA / Username)"
                      value={editInstapayUsername}
                      onChange={e => setEditInstapayUsername(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs"
                    />
                  )}
                </div>

                {/* Require receipt proof */}
                <label className="flex items-center justify-between p-3 bg-purple-50/50 rounded-2xl border border-purple-200 cursor-pointer">
                  <span className="font-bold text-purple-900">إلزام العميل برفع صورة إيصال التحويل عند الدفع بالمحفظة/انستاباي</span>
                  <input
                    type="checkbox"
                    checked={editRequirePaymentProof}
                    onChange={e => setEditRequirePaymentProof(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Receipt & Bill Settings */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-purple-600" />
                <span>تخصيص البون وفاتورة الاستلام المطبوعة</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المطعم في أعلى البون</label>
                  <input
                    type="text"
                    value={editReceiptHeader}
                    onChange={e => setEditReceiptHeader(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رسالة أسفل البون</label>
                  <input
                    type="text"
                    value={editReceiptFooter}
                    onChange={e => setEditReceiptFooter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>جاري حفظ الإعدادات...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>حفظ إعدادات وتعديلات المطعم</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 7: FINANCE & REPORTS (المالية والمبيعات)              */}
        {/* ======================================================== */}
        {activeTab === 'FINANCE' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تقرير المبيعات وأرباح المطعم</h3>
                  <p className="text-[11px] text-slate-500">إحصائيات مالية دقيقة خاصة بمطعمك فقط</p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadBranchStats}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Financial Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">مبيعات اليوم</span>
                <div className="text-lg sm:text-2xl font-black font-mono text-emerald-600">
                  {stats?.todayRevenue ?? 0} <span className="text-xs font-normal">ج.م</span>
                </div>
                <span className="text-[10px] text-slate-500 block">{stats?.todayCompletedCount ?? 0} طلب مكتمل اليوم</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">مبيعات هذا الشهر</span>
                <div className="text-lg sm:text-2xl font-black font-mono text-purple-700">
                  {stats?.monthRevenue ?? 0} <span className="text-xs font-normal">ج.م</span>
                </div>
                <span className="text-[10px] text-slate-500 block">إجمالي مبيعات الشهر</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">إجمالي المبيعات الكلية</span>
                <div className="text-lg sm:text-2xl font-black font-mono text-slate-900">
                  {stats?.totalRevenue ?? 0} <span className="text-xs font-normal">ج.م</span>
                </div>
                <span className="text-[10px] text-slate-500 block">{stats?.completedOrdersCount ?? 0} طلب إجمالي</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">متوسط قيمة الطلب</span>
                <div className="text-lg sm:text-2xl font-black font-mono text-indigo-600">
                  {stats?.averageOrderValue ?? 0} <span className="text-xs font-normal">ج.م</span>
                </div>
                <span className="text-[10px] text-slate-500 block">لكل طلب مكتمل</span>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            {stats?.paymentBreakdown && stats.paymentBreakdown.length > 0 && (
              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-900">توزيع المبيعات حسب طريقة الدفع</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {stats.paymentBreakdown.map((pb: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">
                          {pb.method === 'VODAFONE_CASH' ? 'فودافون كاش 📱' :
                           pb.method === 'INSTAPAY' ? 'انستاباي 💳' : 'كاش عند الاستلام 💵'}
                        </span>
                        <span className="text-[11px] text-slate-400">{pb.count} طلب</span>
                      </div>
                      <div className="text-sm font-black font-mono text-slate-900">
                        {pb.total} ج.م
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODALS SECTION                                           */}
      {/* ======================================================== */}

      {/* 0. Custom Add-on Proposal Modal */}
      {proposingAddonOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    اقتراح إضافة خاصة للطلب #{proposingAddonOrder.orderNumber}
                  </h3>
                  <p className="text-[11px] text-slate-400">إرسال عرض إضافة صنف أو تعديل الحساب للعميل</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProposingAddonOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {proposingAddonOrder.notes && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-black text-[11px] text-amber-800">ملاحظة العميل على الطلب:</span>
                <p className="text-[11px] font-bold">"{proposingAddonOrder.notes}"</p>
              </div>
            )}

            <form onSubmit={handleSendAddonProposal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم الإضافة / الصنف المطلوب *</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: صوص شيدر إضافي أو كانز بيبسي مثلج"
                  value={addonName}
                  onChange={e => setAddonName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">السعر الإضافي بالجنيه (ج.م) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    placeholder="مثلاً: 20"
                    value={addonPrice}
                    onChange={e => setAddonPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-12 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ملاحظة توضيحية للعميل (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثلاً: بناءً على طلبكم في الملاحظات، وفرنا الإضافة المطلوبة"
                  value={addonNote}
                  onChange={e => setAddonNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200/80 text-[11px] text-purple-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span>إجمالي الطلب الحالي:</span>
                  <span className="font-mono font-bold">{proposingAddonOrder.total} ج.م</span>
                </div>
                <div className="flex items-center justify-between font-black text-purple-700">
                  <span>الإجمالي الجديد في حال موافقة العميل:</span>
                  <span className="font-mono">{((proposingAddonOrder.total || 0) + (Number(addonPrice) || 0)).toFixed(0)} ج.م</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setProposingAddonOrder(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingAddon || !addonName.trim() || !addonPrice}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-black transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{submittingAddon ? 'جاري الإرسال...' : 'إرسال الاقتراح للعميل'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Cancellation with Compensation Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">إلغاء الطلب #{cancellingOrder.orderNumber}</h3>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">سبب الإلغاء (يصل للعميل في الإشعار) *</label>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="المطعم مغلق حالياً">المطعم مغلق حالياً</option>
                  <option value="نفاد الكمية المطلوبة">نفاد الكمية المطلوبة</option>
                  <option value="العميل طلب إلغاء الطلب">العميل طلب إلغاء الطلب</option>
                  <option value="عدم توفر كابتن توصيل">عدم توفر كابتن توصيل</option>
                  <option value="العنوان خارج نطاق التوصيل">العنوان خارج نطاق التوصيل</option>
                </select>
              </div>

              {/* Compensation Promo Option */}
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                  <input
                    type="checkbox"
                    checked={sendCompensation}
                    onChange={e => setSendCompensation(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>إرسال كود خصم تعويضي للعميل لإرضائه 🎁</span>
                </label>
                {sendCompensation && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-purple-700">نسبة الخصم:</span>
                    <select
                      value={compensationPercent}
                      onChange={e => setCompensationPercent(e.target.value)}
                      className="bg-white border border-purple-300 rounded-xl px-2.5 py-1 text-purple-900 font-bold"
                    >
                      <option value="10">خصم 10%</option>
                      <option value="15">خصم 15%</option>
                      <option value="20">خصم 20%</option>
                      <option value="25">خصم 25%</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={orderActionLoading}
                onClick={handleConfirmCancelOrder}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
              >
                {orderActionLoading ? 'جاري الإلغاء...' : 'تأكيد إلغاء الطلب'}
              </button>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Assign Driver Modal */}
      {assigningOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">تعيين كابتن للطلب #{assigningOrder.orderNumber}</h3>
              <button type="button" onClick={() => setAssigningOrder(null)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {drivers.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  لا يوجد طيارين مضافين لهذا الفرع. يمكنك إضافة كباتن من تبويب «التوصيل والكباتن».
                </div>
              ) : (
                drivers.map(d => (
                  <label
                    key={d.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedDriverId === d.id ? 'bg-purple-50 border-purple-500' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="driver"
                        checked={selectedDriverId === d.id}
                        onChange={() => setSelectedDriverId(d.id)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <div>
                        <div className="text-xs font-black text-slate-900">{d.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{d.phone}</div>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={orderActionLoading || !selectedDriverId}
                onClick={handleConfirmAssignDriver}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
              >
                تأكيد تعيين الكابتن
              </button>
              <button
                type="button"
                onClick={() => setAssigningOrder(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add / Edit Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveItemSubmit}
            className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">
                {editingItem ? `تعديل وجبة "${editingItem.name}"` : 'إضافة صنف / وجبة جديدة'}
              </h3>
              <button type="button" onClick={() => setShowItemModal(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم الوجبة / الصنف *</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: كريب شاورما دجاج سوبر"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">القسم التابع له *</label>
                  <select
                    required
                    value={itemCategoryId}
                    onChange={e => setItemCategoryId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  >
                    <option value="">اختر القسم...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">السعر الأساسي (ج.م) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={itemPrice}
                    onChange={e => setItemPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">وصف الوجبة والمكونات</label>
                <textarea
                  rows={2}
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  placeholder="قطع الدجاج المتبلة مع الجبن والموتزاريلا والصوص الخاص..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">رابط صورة الوجبة (Image URL)</label>
                <input
                  type="text"
                  placeholder="https://... أو /uploads/..."
                  value={itemImageUrl}
                  onChange={e => setItemImageUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
              </div>

              {/* Deal Tag */}
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
                  <input
                    type="checkbox"
                    checked={itemIsDeal}
                    onChange={e => setItemIsDeal(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span>تمييز كعرض ترويجي / تخفيض (Deal)</span>
                </label>
                {itemIsDeal && (
                  <div>
                    <label className="block text-[11px] text-purple-700 font-bold mb-1">السعر قبل الخصم (لإظهاره مشطوباً)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={itemOriginalPrice}
                      onChange={e => setItemOriginalPrice(e.target.value)}
                      placeholder="مثلاً: 120"
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-1.5 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingItem}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingItem ? 'جاري الحفظ...' : 'حفظ الوجبة'}
              </button>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Order Details Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  تفاصيل الطلب #{selectedOrderDetails.orderNumber}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {new Date(selectedOrderDetails.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
              <button type="button" onClick={() => setSelectedOrderDetails(null)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>اسم العميل: {selectedOrderDetails.customerName}</span>
                <a href={`tel:${selectedOrderDetails.customerPhone}`} className="text-purple-700 font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{selectedOrderDetails.customerPhone}</span>
                </a>
              </div>
              <div className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>العنوان: {selectedOrderDetails.deliveryAddress}</span>
              </div>
              {selectedOrderDetails.notes && (
                <div className="p-2 bg-amber-50 text-amber-900 rounded-xl text-[11px] border border-amber-200">
                  ملاحظات العميل: {selectedOrderDetails.notes}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800">الوجبات المطلوبة:</h4>
              <div className="space-y-1.5">
                {selectedOrderDetails.items?.map((it: any, i: number) => (
                  <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-black text-slate-900">
                        {it.quantity}× {it.menuItem?.name || it.name}
                        {it.sizeName && <span className="text-slate-500 font-normal"> ({it.sizeName})</span>}
                      </div>
                      {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                        <div className="text-[11px] text-purple-700 mt-0.5">
                          إضافات: {it.selectedModifiers.map((m: any) => `${m.optionName || m.name} (+${m.price} ج.م)`).join('، ')}
                        </div>
                      )}
                    </div>
                    <div className="font-mono font-black text-slate-900">
                      {(it.unitPrice * it.quantity).toFixed(0)} ج.م
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="p-3 bg-slate-100 rounded-2xl space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>سعر الوجبات:</span>
                <span className="font-mono">{selectedOrderDetails.subtotal} ج.م</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>رسوم التوصيل:</span>
                <span className="font-mono">{selectedOrderDetails.deliveryFee} ج.م</span>
              </div>
              <div className="flex items-center justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
                <span>الإجمالي:</span>
                <span className="font-mono text-purple-700">{selectedOrderDetails.total} ج.م</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة البون والفاتورة</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Flash Deal Modal (Add / Edit Deal) */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-purple-600" />
                <span>{editingDeal ? 'تعديل عرض ترويجي' : 'إضافة عرض فلاش ترويجي جديد'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDealModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleSaveDeal();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-bold mb-1">عنوان العرض *</label>
                <input
                  type="text"
                  required
                  value={dealTitle}
                  onChange={e => setDealTitle(e.target.value)}
                  placeholder="مثال: كومبو وجبة البريك السوبر 🔥"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">وصف العرض / تفاصيل الوجبة</label>
                <input
                  type="text"
                  value={dealSubtitle}
                  onChange={e => setDealSubtitle(e.target.value)}
                  placeholder="ساندوتش + بطاطس + كانز بيبسي هدية"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">السعر الأصلي (قبل الخصم)</label>
                  <input
                    type="number"
                    value={dealOriginalPrice}
                    onChange={e => setDealOriginalPrice(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">السعر المخفض (بعد الخصم) *</label>
                  <input
                    type="number"
                    required
                    value={dealDiscountPrice}
                    onChange={e => setDealDiscountPrice(e.target.value)}
                    placeholder="85"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-purple-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">شارة العرض (Badge Text)</label>
                  <input
                    type="text"
                    value={dealBadgeText}
                    onChange={e => setDealBadgeText(e.target.value)}
                    placeholder="عرض خاص 🔥"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ انتهاء العرض</label>
                  <input
                    type="date"
                    value={dealExpiresAt}
                    onChange={e => setDealExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">كمية غير محدودة</span>
                  <span className="text-[10px] text-slate-400">العرض متاح طوال فترة الصلاحية بدون حد أقصى للكميات</span>
                </div>
                <input
                  type="checkbox"
                  checked={dealIsUnlimited}
                  onChange={e => setDealIsUnlimited(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </div>

              {!dealIsUnlimited && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الكمية المتاحة للعرض</label>
                  <input
                    type="number"
                    min="1"
                    value={dealMaxQuantity}
                    onChange={e => setDealMaxQuantity(e.target.value)}
                    placeholder="50"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingDeal}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingDeal ? 'جاري الحفظ...' : (editingDeal ? 'تحديث العرض' : 'نشر العرض الآن 🔥')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDealModal(false)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Customer CRM & Block Modal */}
      {selectedCustomerForCrm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-rose-600" />
                <span>إدارة وملاحظات العميل: {selectedCustomerForCrm.name || selectedCustomerForCrm.phone}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCustomerForCrm(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>الاسم: {selectedCustomerForCrm.name || 'عميل بدون اسم'}</span>
                  <span className="font-mono text-purple-700">{selectedCustomerForCrm.phone}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  إجمالي الطلبات: {selectedCustomerForCrm.totalOrders} • إجمالي الإنفاق: {selectedCustomerForCrm.totalSpent} ج.م
                </div>
              </div>

              {/* Block Toggle */}
              <div className={`p-3 rounded-2xl border transition-colors flex items-center justify-between ${
                crmIsBlocked ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-100 text-slate-800'
              }`}>
                <div>
                  <span className="font-black block text-xs">حظر هذا العميل من الطلب من مطعمك</span>
                  <span className="text-[10px] text-slate-500">لن يتمكن من تقديم طلبات جديدة لدى هذا الفرع تحديداً</span>
                </div>
                <input
                  type="checkbox"
                  checked={crmIsBlocked}
                  onChange={e => setCrmIsBlocked(e.target.checked)}
                  className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ملاحظات المطعم حول هذا العميل (CRM Notes)
                </label>
                <textarea
                  rows={3}
                  value={crmNotes}
                  onChange={e => setCrmNotes(e.target.value)}
                  placeholder="مثال: العميل يرفض الاستلام بشكل متكرر، أو عميل مميز يفضل البطاطس مقرمشة..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">هذه الملاحظات خاصة بإدارة مطعمك ولا يراها العميل</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveCustomerCrm}
                  disabled={savingCrm}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer text-white ${
                    crmIsBlocked ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{savingCrm ? 'جاري الحفظ...' : (crmIsBlocked ? 'حفظ وحظر العميل 🚫' : 'حفظ التعديلات')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForCrm(null)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
