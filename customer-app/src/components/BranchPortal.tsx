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
  Power
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
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'MENU' | 'MODIFIERS' | 'DELIVERY' | 'SUPPORT' | 'SETTINGS' | 'FINANCE'>('ORDERS');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    }
  }, [token, loadBranchData]);

  useEffect(() => {
    if (activeTab === 'FINANCE') {
      loadBranchStats();
    } else if (activeTab === 'SUPPORT') {
      loadBranchTickets();
    }
  }, [activeTab, loadBranchStats, loadBranchTickets]);

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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-100">
          {[
            { id: 'ORDERS', label: 'الطلبات المباشرة', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
            { id: 'MENU', label: 'إدارة المنيو والأصناف', icon: UtensilsCrossed },
            { id: 'MODIFIERS', label: 'أقسام الإضافات', icon: Sliders },
            { id: 'DELIVERY', label: 'التوصيل والكباتن', icon: Truck },
            { id: 'SUPPORT', label: 'شكاوى العملاء', icon: LifeBuoy, badge: supportTickets.filter(t => t.status === 'OPEN').length || null },
            { id: 'SETTINGS', label: 'بيانات الفرع والدفع', icon: Store },
            { id: 'FINANCE', label: 'المالية والمبيعات', icon: TrendingUp },
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
        {/* TAB 5: CUSTOMER SUPPORT (شكاوى وبلاغات العملاء)           */}
        {/* ======================================================== */}
        {activeTab === 'SUPPORT' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-2xl">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">شكاوى واستفسارات عملاء المطعم</h3>
                  <p className="text-[11px] text-slate-500">البلاغات والاستفسارات الخاصة بطلبات هذا المطعم فقط</p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadBranchTickets}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {supportTickets.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-black text-slate-800">لا توجد شكاوى أو بلاغات مفتوحة</h4>
                <p className="text-xs text-slate-500">جميع طلبات عملائك مكتملة ومرضية بدون أي بلاغات.</p>
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
    </div>
  );
};
