import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Users, 
  X, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  RotateCw, 
  Sparkles,
  UtensilsCrossed,
  LogOut,
  Store,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';

interface GroupCartModalProps {
  branchId: string;
  branchName: string;
  branches?: any[];
  user: any | null;
  initialCode?: string | null;
  onClose: () => void;
  onActiveCodeChange: (code: string | null, branchId?: string) => void;
  onBrowseBranchMenu: (branchId: string) => void;
  onCheckoutGroupCart: (groupData: { items: any[]; groupCartDetails: any; branchId: string }) => void;
}

export const GroupCartModal: React.FC<GroupCartModalProps> = ({
  branchId,
  branchName,
  branches = [],
  user,
  initialCode,
  onClose,
  onActiveCodeChange,
  onBrowseBranchMenu,
  onCheckoutGroupCart,
}) => {
  const [shareCode, setShareCode] = useState<string | null>(initialCode || null);
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || branches[0]?.id || '');
  const [showBranchSelectModal, setShowBranchSelectModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

  const selectedBranch = branches.find((b: any) => b.id === selectedBranchId) || branches[0];

  // Quick menu items inside modal so participants can add directly or browse full menu
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // Student name from logged-in account
  const studentName = user?.name || 'طالب';

  // Join code state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCodeOnly, setCopiedCodeOnly] = useState(false);

  // Host detection
  const isHost = Boolean(
    (cart?.hostName && studentName && cart.hostName === studentName) ||
    (cart?.shareCode && localStorage.getItem(`group_host_${cart.shareCode}`) === 'true')
  );

  const fetchCart = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGroupCart(code);
      setCart(data);
      setShareCode(data.shareCode || code);
      onActiveCodeChange(data.shareCode || code, data.branchId);
      if (data.branchId) {
        api.getBranchMenu(data.branchId).then((res) => {
          setMenuCategories(res.categories || []);
        }).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'سلة الشلة غير موجودة أو انتهت صلاحيتها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchCart(initialCode);
    }
  }, [initialCode]);

  // Real-time socket sync
  useEffect(() => {
    if (!shareCode) return;

    const socketHost = API_BASE_URL.replace('/api', '');
    const socket: Socket = io(socketHost);

    socket.on('connect', () => {
      socket.emit('join_group_cart', shareCode);
    });

    socket.on('group_cart_updated', (updatedCart: any) => {
      setCart((prev: any) => ({
        ...prev,
        ...updatedCart,
        branch: updatedCart.branch || prev?.branch,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [shareCode]);

  // Create new group cart
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBranchId = selectedBranchId || branchId || branches[0]?.id;
    if (!targetBranchId) {
      setError('يرجى اختيار المطعم أولاً');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newCart = await api.createGroupCart(targetBranchId, studentName);
      if (newCart?.shareCode) {
        localStorage.setItem(`group_host_${newCart.shareCode}`, 'true');
      }
      setCart(newCart);
      setShareCode(newCart.shareCode);
      onActiveCodeChange(newCart.shareCode, targetBranchId);
      api.getBranchMenu(targetBranchId).then((res) => {
        setMenuCategories(res.categories || []);
      }).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء سلة الشلة');
    } finally {
      setLoading(false);
    }
  };

  // Join existing group cart
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    await fetchCart(joinCodeInput.trim().toUpperCase());
  };

  // Leave / Clear active group cart
  const handleLeaveGroupCart = () => {
    if (isHost) {
      setShowLeaveConfirmModal(true);
      return;
    }
    setCart(null);
    setShareCode(null);
    onActiveCodeChange(null);
  };

  const confirmLeaveGroupCart = () => {
    setShowLeaveConfirmModal(false);
    setCart(null);
    setShareCode(null);
    onActiveCodeChange(null);
  };

  // Quick add item from inside modal
  const handleQuickAddItem = async (item: any) => {
    if (!shareCode) return;
    try {
      setAddingItemId(item.id);
      setError(null);
      await api.addGroupCartItem(shareCode, {
        studentName,
        menuItemId: item.id,
        itemName: item.name,
        unitPrice: item.basePrice,
        quantity: 1,
      });
      await fetchCart(shareCode);
    } catch (err: any) {
      setError(err.message || 'فشل إضافة الصنف لسلة الشلة');
    } finally {
      setAddingItemId(null);
    }
  };

  // Copy share link
  const handleCopyLink = () => {
    if (!shareCode) return;
    const link = `${window.location.origin}${window.location.pathname}?group=${shareCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyCode = () => {
    if (!shareCode) return;
    navigator.clipboard.writeText(shareCode);
    setCopiedCodeOnly(true);
    setTimeout(() => setCopiedCodeOnly(false), 2500);
  };

  // Remove item with owner verification
  const handleRemoveItem = async (itemId: string, itemStudentName: string) => {
    if (!shareCode) return;
    if (!isHost && itemStudentName !== studentName) {
      setError('لا يمكنك حذف أصناف طالب آخر! يمكنك فقط تعديل وحذف أصنافك الخاصة.');
      return;
    }
    try {
      await api.removeGroupCartItem(shareCode, itemId, studentName);
      await fetchCart(shareCode);
    } catch (err: any) {
      setError(err.message || 'فشل حذف الصنف');
    }
  };

  // Group items by studentName
  const itemsByStudent: Record<string, any[]> = {};
  let grandTotal = 0;

  if (cart?.items) {
    cart.items.forEach((item: any) => {
      if (!itemsByStudent[item.studentName]) {
        itemsByStudent[item.studentName] = [];
      }
      itemsByStudent[item.studentName].push(item);
      grandTotal += item.totalPrice;
    });
  }

  // Handle final checkout (host only)
  const handleProceedToCheckout = () => {
    if (!isHost) {
      setError(`عذراً، منشئ ومسؤول السلة فقط (${cart?.hostName || 'المسؤول'}) هو المخول بإتمام الطلب وإرساله للمطعم.`);
      return;
    }

    if (!cart?.items || cart.items.length === 0) {
      setError('سلة الشلة فارغة! أضف أصنافاً أولاً قبل إتمام الطلب.');
      return;
    }

    // Build partitioned bags details
    const groupCartDetails = Object.keys(itemsByStudent).map((student) => ({
      studentName: student,
      subtotal: itemsByStudent[student].reduce((sum, it) => sum + it.totalPrice, 0),
      items: itemsByStudent[student].map((it) => ({
        itemName: it.itemName,
        sizeName: it.sizeName,
        quantity: it.quantity,
        totalPrice: it.totalPrice,
      })),
    }));

    // Format consolidated items for standard checkout
    const orderItems = cart.items.map((it: any) => ({
      menuItemId: it.menuItemId,
      itemName: it.itemName,
      name: it.itemName,
      unitPrice: it.unitPrice,
      price: it.unitPrice,
      totalPrice: it.totalPrice,
      quantity: it.quantity,
      sizeName: it.sizeName,
      selectedModifiers: it.selectedModifiers
        ? typeof it.selectedModifiers === 'string'
          ? JSON.parse(it.selectedModifiers)
          : it.selectedModifiers
        : [],
      notes: `[كيس: ${it.studentName}] ${it.notes || ''}`.trim(),
      branchId: cart.branchId || branchId,
    }));

    onCheckoutGroupCart({
      items: orderItems,
      groupCartDetails,
      branchId: cart.branchId || branchId,
    });
  };

  const allQuickMenuItems = menuCategories.flatMap((c) => c.items || []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-indigo-50 to-purple-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">سلة الشلة (الطلب الجماعي)</h3>
              <p className="text-xs text-slate-500">
                حسابك المسجل: <span className="font-bold text-indigo-700">{studentName}</span> (تُحفظ السلة تلقائياً عند إغلاق النافذة)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
            title="تصغير النافذة (تبقى السلة نشطة)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold text-center shrink-0">
            {error}
          </div>
        )}

        {/* If cart not started yet */}
        {!cart ? (
          <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Create Group Cart */}
            <form onSubmit={handleCreate} className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3.5">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>إنشاء سلة شلة جديدة</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                أنشئ سلة جماعية وشارك رمز الدعوة مع أصدقائك، ليتمكن كل طالب من الانضمام بحسابه وإضافة وجباته في كيس منفصل!
              </p>

              {branches.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر المطعم:</label>
                  <button
                    type="button"
                    onClick={() => setShowBranchSelectModal(true)}
                    className="w-full p-2.5 sm:p-3 bg-white border border-slate-300 hover:border-indigo-500 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-between shadow-xs transition-all text-right active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {selectedBranch?.logo ? (
                        <img src={selectedBranch.logo} alt="" className="w-8 h-8 rounded-xl object-cover border border-slate-100 shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100">
                          <Store className="w-4 h-4" />
                        </div>
                      )}
                      <div className="text-right truncate">
                        <div className="font-black text-slate-800 text-xs truncate">{selectedBranch?.name || 'اختر المطعم'}</div>
                        {selectedBranch?.cuisine && (
                          <div className="text-[10px] text-slate-400 font-medium truncate">{selectedBranch.cuisine}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50/90 px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0">
                      <span>تغيير</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>
              )}

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">منشئ ومسؤول السلة:</span>
                <span className="font-black text-indigo-700">{studentName}</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span>إنشاء سلة الشلة</span>
              </button>
            </form>

            <div className="text-center text-xs text-slate-400 font-bold">أو</div>

            {/* Join Existing Cart */}
            <form onSubmit={handleJoin} className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
              <h4 className="font-black text-sm text-slate-800">الانضمام لسلة شلة برمز المشاركة</h4>
              <p className="text-xs text-slate-500">أدخل رمز الانضمام المكون من 6 خانات الذي أرسله لك صديقك لتضيف وجبتك معه:</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="مثال: ABC123"
                  className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-center text-sm font-black tracking-widest focus:ring-2 focus:ring-indigo-600 uppercase"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all"
                >
                  {loading ? '...' : 'انضمام'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Cart Details View */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Share Code Bar */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-3xl shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] opacity-85 block font-bold">رمز دعوة الأصدقاء للسلة:</span>
                  <span className="font-mono text-2xl font-black tracking-widest">{cart.shareCode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1"
                  >
                    {copiedCodeOnly ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodeOnly ? 'تم نسخ الرمز' : 'نسخ الرمز'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم نسخ الرابط!' : 'نسخ الرابط'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/20 text-[11px] text-indigo-100 font-bold">
                <span className="flex items-center gap-1">
                  <Store className="w-3.5 h-3.5" />
                  <span>مطعم: {cart.branch?.name || branchName}</span>
                </span>
                <span>منشئ ومسؤول السلة: {cart.hostName}</span>
              </div>
            </div>

            {/* Action Bar: Add My Items from Menu */}
            <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-xs text-purple-950">أضف وجبتك لكيسك الخاص ({studentName})</h4>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  تصفح قائمة طعام المطعم واختر الأصناف والإضافات، وستُضاف تلقائياً إلى كيسك في سلة الشلة!
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBrowseBranchMenu(cart.branchId || branchId)}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>تصفح المنيو وإضافة أصنافي</span>
              </button>
            </div>

            {/* Quick Add Strip right inside modal */}
            {allQuickMenuItems.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 block">⚡ إضافة سريعة مباشرة لكيس ({studentName}):</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                  {allQuickMenuItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-2.5 min-w-[155px] shrink-0 flex flex-col justify-between gap-2 shadow-2xs"
                    >
                      <div>
                        <div className="font-black text-xs text-slate-800 line-clamp-1">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[11px] font-mono font-bold ${item.originalBasePrice && item.originalBasePrice > item.basePrice ? 'text-rose-600' : 'text-indigo-600'}`}>
                            {item.basePrice} ج.م
                          </span>
                          {item.originalBasePrice && item.originalBasePrice > item.basePrice && (
                            <span className="text-[10px] text-slate-400 line-through font-mono">
                              {item.originalBasePrice} ج.م
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={addingItemId === item.id}
                        onClick={() => handleQuickAddItem(item)}
                        className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{addingItemId === item.id ? 'جاري الإضافة...' : 'أضف لكيسي'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Partitioned by Student */}
            {Object.keys(itemsByStudent).length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-3xl">
                <ShoppingBag className="w-9 h-9 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-xs">سلة الشلة فارغة حالياً</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  اضغط على "تصفح المنيو وإضافة أصنافي" أو اختر من الإضافة السريعة أعلاه!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-700">الأكياس المضافة بالسلة ({Object.keys(itemsByStudent).length} طلاب):</h4>
                {Object.keys(itemsByStudent).map((student) => {
                  const studentItems = itemsByStudent[student];
                  const studentSubtotal = studentItems.reduce((acc, it) => acc + it.totalPrice, 0);

                  return (
                    <div key={student} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
                      {/* Student Header & Subtotal */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                            {student.substring(0, 1)}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-800 text-xs">كيس الطالب: {student}</span>
                            {student === cart.hostName && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded-md">
                                منشئ ومسؤول السلة 👑
                              </span>
                            )}
                            {student === studentName && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-md">
                                أنت
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                          المجموع: {studentSubtotal} ج.م
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 text-xs">
                        {studentItems.map((item) => {
                          const canDeleteThisItem = isHost || item.studentName === studentName;

                          return (
                            <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                              <div>
                                <div className="font-bold text-slate-800">
                                  {item.quantity} × {item.itemName} {item.sizeName ? `(${item.sizeName})` : ''}
                                </div>
                                {item.notes && <div className="text-[10px] text-slate-400">📝 {item.notes}</div>}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-700">{item.totalPrice} ج.م</span>
                                {canDeleteThisItem ? (
                                  <button
                                    onClick={() => handleRemoveItem(item.id, item.studentName)}
                                    className="p-1 text-rose-400 hover:text-rose-600 rounded-lg transition-colors"
                                    title="حذف الصنف من الكيس"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-300 select-none" title="لا يمكنك حذف أصناف طالب آخر">
                                    🔒
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {cart && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">إجمالي طلب الشلة:</span>
                <span className="text-xs font-bold text-slate-600">
                  {Object.keys(itemsByStudent).length} طلاب • {cart?.items?.length || 0} صنف
                </span>
              </div>
              <span className="text-lg font-black text-slate-900 font-mono">{grandTotal} ج.م</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLeaveGroupCart}
                className="px-3.5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
                title="مغادرة سلة الشلة"
              >
                <LogOut className="w-4 h-4" />
                <span>مغادرة السلة</span>
              </button>

              {isHost ? (
                <button
                  type="button"
                  disabled={!cart?.items || cart.items.length === 0}
                  onClick={handleProceedToCheckout}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>إتمام طلب الشلة وإرساله للمطعم</span>
                </button>
              ) : (
                <div className="flex-1 py-2.5 px-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 text-center">
                  <span className="text-sm">🔒</span>
                  <span>بانتظار منشئ السلة ({cart.hostName}) لإنهاء الطلب وتأكيده للمطعم</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Branch Selection Custom Modal */}
        {showBranchSelectModal && (
          <div 
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 overscroll-contain"
            onClick={() => setShowBranchSelectModal(false)}
          >
            <div 
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-800">اختر المطعم لسلة الشلة</h3>
                    <p className="text-[10px] text-slate-500 font-bold">حدد المطعم الذي ستطلب منه أنت وأصدقاؤك</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBranchSelectModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Branches List */}
              <div className="p-3 space-y-2 overflow-y-auto max-h-[60vh] overscroll-contain">
                {branches.map((b: any) => {
                  const isSelected = b.id === selectedBranchId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBranchId(b.id);
                        setShowBranchSelectModal(false);
                      }}
                      className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between text-right active:scale-[0.99] ${
                        isSelected 
                          ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500' 
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {b.logo ? (
                          <img src={b.logo} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
                            <Store className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className={`font-black text-xs sm:text-sm truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {b.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {b.cuisine && (
                              <span className="text-[11px] text-slate-500 font-medium truncate">{b.cuisine}</span>
                            )}
                            {b.isActive === false ? (
                              <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded-md">مغلق حالياً</span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-md">متاح الآن</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mr-2 shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-200 shrink-0 mr-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBranchSelectModal(false)}
                  className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leave Group Cart Confirmation Modal */}
        {showLeaveConfirmModal && (
          <div 
            className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overscroll-contain"
            onClick={() => setShowLeaveConfirmModal(false)}
          >
            <div 
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-5 space-y-4 animate-in zoom-in-95 duration-200 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">مغادرة سلة الشلة؟</h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  تنبيه: أنت منشئ هذه السلة ومسؤولها. إذا غادرت السلة فلن تتمكن من إدارة وتأكيد طلبات أصدقائك. هل أنت متأكد من رغبتك في المغادرة؟
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirmModal(false)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  البقاء في السلة
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveGroupCart}
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition-colors shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>نعم، مغادرة</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
