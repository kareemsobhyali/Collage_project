import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Users, 
  X, 
  Share2, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  RotateCw, 
  User, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';

interface GroupCartModalProps {
  branchId: string;
  branchName: string;
  initialCode?: string | null;
  onClose: () => void;
  onCheckoutGroupCart: (groupData: { items: any[]; groupCartDetails: any; branchId: string }) => void;
}

export const GroupCartModal: React.FC<GroupCartModalProps> = ({
  branchId,
  branchName,
  initialCode,
  onClose,
  onCheckoutGroupCart,
}) => {
  const [shareCode, setShareCode] = useState<string | null>(initialCode || null);
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Creation state
  const [hostName, setHostName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('customer_user') || '{}');
      return u.name || '';
    } catch (e) {
      return '';
    }
  });

  // Join code state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Student adding item directly
  const [myStudentName, setMyStudentName] = useState(() => {
    return localStorage.getItem('last_student_name') || hostName || '';
  });

  const fetchCart = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGroupCart(code);
      setCart(data);
      setShareCode(code);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل سلة الشلة');
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
      setCart(updatedCart);
    });

    return () => {
      socket.disconnect();
    };
  }, [shareCode]);

  // Create new group cart
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      setError('يرجى كتابة اسمك لبدء السلة');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newCart = await api.createGroupCart(branchId, hostName.trim());
      setCart(newCart);
      setShareCode(newCart.shareCode);
      setMyStudentName(hostName.trim());
      localStorage.setItem('last_student_name', hostName.trim());
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

  // Copy share link
  const handleCopyLink = () => {
    if (!shareCode) return;
    const link = `${window.location.origin}${window.location.pathname}?group=${shareCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Remove item
  const handleRemoveItem = async (itemId: string) => {
    if (!shareCode) return;
    try {
      await api.removeGroupCartItem(shareCode, itemId);
    } catch (err: any) {
      alert(err.message || 'فشل حذف الصنف');
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

  // Handle final checkout
  const handleProceedToCheckout = () => {
    if (!cart?.items || cart.items.length === 0) {
      alert('السلة فارغة حالياً!');
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
      name: it.itemName,
      price: it.unitPrice,
      quantity: it.quantity,
      sizeName: it.sizeName,
      selectedModifiers: it.selectedModifiers ? JSON.parse(it.selectedModifiers) : [],
      notes: `[كيس: ${it.studentName}] ${it.notes || ''}`.trim(),
    }));

    onCheckoutGroupCart({
      items: orderItems,
      groupCartDetails,
      branchId: cart.branchId || branchId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">سلة الشلة (الطلب الجماعي)</h3>
              <p className="text-xs text-slate-500">اطلب مع أصحابك في أوردر واحد والحساب وتقسيم الأكياس محسوبة تلقائياً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="m-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* If cart not started yet */}
        {!cart ? (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Create Group Cart */}
            <form onSubmit={handleCreate} className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>بدء سلة شلة جديدة لهذا المطعم</span>
              </h4>
              <p className="text-xs text-slate-500">
                شارك الرابط أو الكود مع أصحابك في المدرج أو الكلية، وكل واحد هيضيف طلبه وهيظهر حسابه منفصل.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسمك (صاحب السلة):</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="مثال: أحمد"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span>إنشاء سلة الشلة ومشاركة الرابط</span>
              </button>
            </form>

            <div className="text-center text-xs text-slate-400 font-bold">أو</div>

            {/* Join Existing Cart */}
            <form onSubmit={handleJoin} className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
              <h4 className="font-black text-sm text-slate-800">الانضمام لسلة شلة موجودة</h4>
              <p className="text-xs text-slate-500">لو حد من أصحابك بعتلك كود السلة المكون من 6 رموز:</p>

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
                  انضمام
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Cart Details View */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Share Code Bar */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-3xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[11px] opacity-80 block font-bold">كود مشاركة سلة الشلة:</span>
                <span className="font-mono text-xl font-black tracking-widest">{cart.shareCode}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'تم نسخ الرابط!' : 'نسخ رابط المشاركة'}</span>
              </button>
            </div>

            {/* Host Banner */}
            <div className="flex items-center justify-between px-2 text-xs text-slate-500 font-bold">
              <span>صاحب السلة: {cart.hostName}</span>
              <span>مطعم: {cart.branch?.name || branchName}</span>
            </div>

            {/* Items Partitioned by Student */}
            {Object.keys(itemsByStudent).length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-3xl">
                <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-xs">سلة الشلة فارغة حالياً</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  انسخ الرابط وشاركه مع زملائك ليضيف كل طالب طلبه باسمه مباشرة!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
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
                          <span className="font-black text-slate-800 text-xs">كيس الطالب: {student}</span>
                        </div>
                        <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                          الحساب: {studentSubtotal} ج.م
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 text-xs">
                        {studentItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                            <div>
                              <div className="font-bold text-slate-800">
                                {item.quantity} × {item.itemName} {item.sizeName ? `(${item.sizeName})` : ''}
                              </div>
                              {item.notes && <div className="text-[10px] text-slate-400">📝 {item.notes}</div>}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">{item.totalPrice} ج.م</span>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-rose-400 hover:text-rose-600 rounded-lg transition-colors"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
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
          <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">إجمالي سلة الشلة:</span>
                <span className="text-xs font-bold text-slate-600">
                  {Object.keys(itemsByStudent).length} طلاب • {cart?.items?.length || 0} صنف
                </span>
              </div>
              <span className="text-lg font-black text-slate-900 font-mono">{grandTotal} ج.م</span>
            </div>

            <button
              type="button"
              disabled={!cart?.items || cart.items.length === 0}
              onClick={handleProceedToCheckout}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>إتمام طلب الشلة وتأكيد الأكياس</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
