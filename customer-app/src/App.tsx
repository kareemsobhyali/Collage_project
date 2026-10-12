import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Store, 
  User, 
  ShoppingBag, 
  Clock, 
  LogOut, 
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Sparkles
} from 'lucide-react';
import { api, API_BASE_URL } from './services/api';
import { registerServiceWorker } from './services/notifications';
import { BranchList } from './components/BranchList';
import { BranchMenu } from './components/BranchMenu';
import { AuthModal } from './components/AuthModal';
import { ItemCustomizeModal } from './components/ItemCustomizeModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { MyOrdersModal } from './components/MyOrdersModal';
import { ProfileModal } from './components/ProfileModal';
import { AdminPage } from './components/AdminPage';
import { DriverPortal } from './components/DriverPortal';
import { GroupCartModal } from './components/GroupCartModal';
import { Logo } from './components/Logo';

export function App() {
  const isAdminRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/admin') ||
    window.location.search.includes('admin') ||
    window.location.hash.includes('admin')
  );

  const isDriverRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/driver') ||
    window.location.pathname.startsWith('/delivery') ||
    window.location.pathname.startsWith('/elviery') ||
    window.location.search.includes('driver') ||
    window.location.search.includes('delivery') ||
    window.location.search.includes('elviery') ||
    window.location.hash.includes('driver') ||
    window.location.hash.includes('delivery') ||
    window.location.hash.includes('elviery')
  );

  const groupParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('group') : null;

  const [showDriverPortal, setShowDriverPortal] = useState(isDriverRoute);
  const [showGroupCartModal, setShowGroupCartModal] = useState(Boolean(groupParam));
  const [groupCartCode, setGroupCartCode] = useState<string | null>(groupParam);
  const [groupCartDetailsForCheckout, setGroupCartDetailsForCheckout] = useState<any | null>(null);

  if (isAdminRoute) {
    return <AdminPage />;
  }

  if (showDriverPortal) {
    return <DriverPortal onClose={() => setShowDriverPortal(false)} />;
  }

  const [user, setUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('customer_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [branchCategories, setBranchCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<any | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // تحميل قائمة الفروع عند بدء التطبيق
  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await api.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
    registerServiceWorker();

    const socketHost = API_BASE_URL.replace('/api', '');
    const socket = io(socketHost);

    socket.on('branch_status_updated', (data: any) => {
      setBranches(prev => prev.map(b => {
        if (b.id === data.branchId) {
          return {
            ...b,
            operationalStatus: data.operationalStatus,
            closedUntil: data.closedUntil,
            closingReason: data.closingReason,
          };
        }
        return b;
      }));

      setSelectedBranch((prev: any) => {
        if (prev && prev.id === data.branchId) {
          return {
            ...prev,
            operationalStatus: data.operationalStatus,
            closedUntil: data.closedUntil,
            closingReason: data.closingReason,
          };
        }
        return prev;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // عند اختيار فرع، جلب المنيو الخاص به
  const handleSelectBranch = async (branch: any) => {
    try {
      setLoading(true);
      const data = await api.getBranchMenu(branch.id);
      setSelectedBranch(data.branch);
      setBranchCategories(data.categories || []);
      // إفراغ السلة إذا كانت تخص فرعاً آخر
      if (cart.length > 0 && cart[0].branchId !== branch.id) {
        setCart([]);
      }
    } catch (err: any) {
      alert(err.message || 'فشل فتح منيو المطعم');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    setUser(null);
  };

  const handleAddToCart = (itemToAdd: any) => {
    setCart([...cart, { ...itemToAdd, branchId: selectedBranch.id }]);
  };

  const handleReorder = async (order: any) => {
    try {
      const data = await api.getBranchMenu(order.branchId);
      if (data?.branch) {
        setSelectedBranch(data.branch);
        setBranchCategories(data.categories || []);
      }
    } catch (_e) {
      let targetBranch = branches.find((b: any) => b.id === order.branchId);
      if (!targetBranch) {
        try {
          const allBranches = await api.getBranches();
          targetBranch = (allBranches || []).find((b: any) => b.id === order.branchId);
        } catch (_err) {}
      }
      if (targetBranch) {
        setSelectedBranch(targetBranch);
      }
    }

    const reorderedItems = (order.items || []).map((it: any) => {
      let mods = [];
      if (it.selectedModifiers) {
        try {
          mods = typeof it.selectedModifiers === 'string' ? JSON.parse(it.selectedModifiers) : it.selectedModifiers;
        } catch (e) {}
      }
      return {
        menuItemId: it.menuItemId,
        id: it.menuItemId,
        name: it.itemName,
        itemName: it.itemName,
        sizeName: it.sizeName,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        quantity: it.quantity,
        selectedModifiers: mods,
        notes: it.notes,
        branchId: order.branchId,
      };
    });

    setCart(reorderedItems);
    setShowMyOrdersModal(false);
    setShowCartModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Mobile/Desktop Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => setSelectedBranch(null)}
            className="cursor-pointer"
          >
            <Logo size="sm" />
          </div>

          {/* User & Orders Tools */}
          <div className="flex items-center gap-2">
            {/* Group Cart Button */}
            <button
              onClick={() => setShowGroupCartModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors"
              title="مشاركة سلة جماعية مع أصحابك (سلة الشلة)"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">سلة الشلة</span>
            </button>

            {/* Driver Portal Shortcut */}
            <button
              onClick={() => setShowDriverPortal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              title="بوابة كباتن التوصيل (الطيارين)"
            >
              <Truck className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">الطيارين</span>
            </button>

            {/* Quick Cart Button */}
            {cart.length > 0 && (
              <button
                onClick={() => {
                  if (selectedBranch) {
                    setShowCartModal(true);
                  } else {
                    const b = branches.find(item => item.id === cart[0]?.branchId);
                    if (b) {
                      handleSelectBranch(b).then(() => setShowCartModal(true));
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
                title="عرض سلة الطلبات"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">السلة</span>
                <span className="bg-white text-indigo-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMyOrdersModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">طلباتي</span>
                </button>

                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-3 py-1.5 rounded-xl text-xs text-slate-700 font-bold transition-colors border border-transparent hover:border-indigo-200 cursor-pointer"
                  title="حسابي والمحفظة الجامعية ونقاط الولاء"
                >
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="line-clamp-1 max-w-[80px]">{user.name.split(' ')[0]}</span>
                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full text-[10px] font-black flex items-center gap-0.5">
                    <span>★</span>
                    <span>{user.loyaltyPoints ?? 0}</span>
                  </span>
                </button>

                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-sm transition-all"
              >
                دخول / حساب جديد
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-3xl w-full mx-auto">
        {selectedBranch ? (
          <BranchMenu
            branch={selectedBranch}
            categories={branchCategories}
            cart={cart}
            onBack={() => setSelectedBranch(null)}
            onSelectItem={(item) => setCustomizingItem(item)}
            onOpenCart={() => setShowCartModal(true)}
          />
        ) : (
          <BranchList
            branches={branches}
            onSelectBranch={handleSelectBranch}
          />
        )}
      </main>

      {/* Modals */}
      {customizingItem && (
        <ItemCustomizeModal
          item={customizingItem}
          onAddToCart={handleAddToCart}
          onClose={() => setCustomizingItem(null)}
        />
      )}

      {showCartModal && selectedBranch && (
        <CartCheckoutModal
          cart={cart}
          branch={selectedBranch}
          user={user}
          groupCartDetails={groupCartDetailsForCheckout}
          onUpdateCart={setCart}
          onRequireAuth={() => setShowAuthModal(true)}
          onOrderSuccess={(createdOrder) => {
            setTrackingOrder(createdOrder);
            setGroupCartDetailsForCheckout(null);
            try {
              const saved = localStorage.getItem('customer_user');
              if (saved) setUser(JSON.parse(saved));
            } catch (_e) {}
          }}
          onClose={() => {
            setShowCartModal(false);
            setGroupCartDetailsForCheckout(null);
          }}
        />
      )}

      {showGroupCartModal && (
        <GroupCartModal
          branchId={selectedBranch?.id || branches[0]?.id || ''}
          branchName={selectedBranch?.name || branches[0]?.name || 'مطعم الجامعة'}
          initialCode={groupCartCode}
          onClose={() => {
            setShowGroupCartModal(false);
            setGroupCartCode(null);
          }}
          onCheckoutGroupCart={(groupData) => {
            const target = branches.find((b: any) => b.id === groupData.branchId) || selectedBranch;
            if (target) setSelectedBranch(target);
            setCart(groupData.items);
            setGroupCartDetailsForCheckout(groupData.groupCartDetails);
            setShowGroupCartModal(false);
            setShowCartModal(true);
          }}
        />
      )}

      {showProfileModal && user && (
        <ProfileModal
          user={user}
          onUpdateUser={(updated) => setUser(updated)}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {trackingOrder && (
        <OrderTrackingModal
          order={trackingOrder}
          onOrderUpdated={(updatedOrder) => {
            setTrackingOrder(updatedOrder);
            try {
              const saved = localStorage.getItem('customer_user');
              if (saved) setUser(JSON.parse(saved));
            } catch (_e) {}
            if (updatedOrder.status === 'REJECTED') {
              api.getMe().then(res => {
                if (res?.user) {
                  localStorage.setItem('customer_user', JSON.stringify(res.user));
                  setUser(res.user);
                }
              }).catch(() => {});
            }
          }}
          onClose={() => setTrackingOrder(null)}
        />
      )}

      {showMyOrdersModal && (
        <MyOrdersModal
          onSelectOrderToTrack={(o) => setTrackingOrder(o)}
          onReorder={handleReorder}
          onClose={() => setShowMyOrdersModal(false)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onSuccess={(u) => setUser(u)}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

export default App;
