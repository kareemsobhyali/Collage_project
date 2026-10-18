import React, { useState, useEffect, useMemo } from 'react';
import { 
  LifeBuoy, 
  Search, 
  RotateCw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Phone, 
  ExternalLink, 
  ShoppingBag, 
  Calendar,
  Send,
  User,
  Check,
  Tag
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from '../utils/toast';

interface SupportTicket {
  id: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  category: string;
  categoryLabel?: string;
  subject: string;
  message: string;
  orderNumber?: string;
  branchId?: string;
  branchName?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  adminNotes?: string;
  branchNotes?: string;
  createdAt: string;
  updatedAt?: string;
  orderTotal?: number;
  orderStatus?: string;
  orderCreatedAt?: string;
  orderItemsSummary?: string;
}

export const BranchSupportView: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const fetchTickets = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const list = await api.getSupportTickets();
      setTickets(list || []);

      // Initialize notes state
      const notesMap: Record<string, string> = {};
      (list || []).forEach((t: SupportTicket) => {
        notesMap[t.id] = t.branchNotes || '';
      });
      setTicketNotes(notesMap);
    } catch (err: any) {
      toast.error(err.message || 'فشل جلب شكاوى العملاء');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleUpdateStatus = async (ticketId: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    try {
      setUpdatingStatusId(ticketId);
      const updated = await api.updateSupportTicket(ticketId, {
        status: newStatus,
        branchNotes: ticketNotes[ticketId] ?? '',
      });

      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, status: newStatus, updatedAt: updated?.updatedAt || new Date().toISOString() } : t))
      );
      toast.success('تم تحديث حالة الشكوى بنجاح');
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث حالة الشكوى');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSaveNotes = async (ticketId: string) => {
    try {
      setSavingNotesId(ticketId);
      const notes = ticketNotes[ticketId] ?? '';
      await api.updateSupportTicket(ticketId, {
        branchNotes: notes,
      });

      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, branchNotes: notes } : t))
      );
      toast.success('تم حفظ رد وملاحظة المطعم بنجاح');
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ الملاحظة');
    } finally {
      setSavingNotesId(null);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Status filter
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = ticket.userName?.toLowerCase().includes(query);
        const matchesPhone = ticket.userPhone?.toLowerCase().includes(query);
        const matchesSubject = ticket.subject?.toLowerCase().includes(query);
        const matchesMessage = ticket.message?.toLowerCase().includes(query);
        const matchesOrder = ticket.orderNumber?.toString().toLowerCase().includes(query.replace('#', ''));

        return matchesName || matchesPhone || matchesSubject || matchesMessage || matchesOrder;
      }

      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  // Statistics
  const counts = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'OPEN').length;
    const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const resolved = tickets.filter(t => t.status === 'RESOLVED').length;
    return { total, open, inProgress, resolved };
  }, [tickets]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const getCleanWhatsappLink = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '20' + clean.slice(1);
    }
    return `https://wa.me/${clean}`;
  };

  const renderOrderStatusBadge = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'DELIVERED':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-md font-bold">مكتمل</span>;
      case 'CANCELLED':
        return <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-md font-bold">ملغي</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-md font-bold">في الطريق</span>;
      case 'PREPARING':
        return <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-md font-bold">قيد التحضير</span>;
      case 'READY':
        return <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-md font-bold">جاهز</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800">شكاوى وبلاغات العملاء</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة شكاوى وبلاغات العملاء الخاصة بفرعك وحلها والتواصل المباشر مع العميل
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchTickets(true)}
          disabled={refreshing}
          className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 shrink-0"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          <span>تحديث الشكاوى</span>
        </button>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50/80 border-indigo-200 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500">إجمالي البلاغات</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{counts.total}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('OPEN')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'OPEN'
              ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>جديدة وبانتظار الرد</span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">{counts.open}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('IN_PROGRESS')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'IN_PROGRESS'
              ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>قيد المتابعة</span>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">{counts.inProgress}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('RESOLVED')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'RESOLVED'
              ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تم الحل والتسوية</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{counts.resolved}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            الكل ({counts.total})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'OPEN'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            جديدة ({counts.open})
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            قيد المتابعة ({counts.inProgress})
          </button>
          <button
            onClick={() => setStatusFilter('RESOLVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'RESOLVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            تم الحل ({counts.resolved})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، العميل، الهاتف، أو الموضوع..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-200">
          <RotateCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-600" />
          <p className="text-xs font-bold">جاري تحميل شكاوى وبلاغات الفرع...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-200">
          <LifeBuoy className="w-16 h-16 mx-auto mb-3 opacity-30 text-slate-300" />
          <h4 className="text-base font-bold text-slate-700">لا توجد بلاغات أو شكاوى مطابقة</h4>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? 'لم يتم العثور على أي بلاغات تطابق كلمة البحث المدخلة'
              : 'ممتاز! لا توجد شكاوى مسجلة بحاجة للمتابعة حالياً'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map(ticket => {
            const isResolved = ticket.status === 'RESOLVED';
            const isInProgress = ticket.status === 'IN_PROGRESS';
            const isOpen = ticket.status === 'OPEN';

            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${
                  isOpen
                    ? 'border-rose-200 ring-1 ring-rose-500/10'
                    : isInProgress
                    ? 'border-amber-200 ring-1 ring-amber-500/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Header Row: Category Badge + Status Badge + Date */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{ticket.categoryLabel || 'بلاغ دعم'}</span>
                    </span>

                    {isOpen && (
                      <span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                        <span>جديدة</span>
                      </span>
                    )}

                    {isInProgress && (
                      <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>قيد المتابعة</span>
                      </span>
                    )}

                    {isResolved && (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم الحل والتسوية</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3.5">
                  {/* Left Column: Complaint Details & Message */}
                  <div className="lg:col-span-2 space-y-3">
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                        {ticket.subject}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {ticket.message}
                      </p>
                    </div>

                    {/* Order Information (if attached) */}
                    {ticket.orderNumber && (
                      <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="text-xs font-black text-indigo-900">
                              رقم الطلب المتعلق: #{ticket.orderNumber.replace('#', '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderOrderStatusBadge(ticket.orderStatus)}
                            {ticket.orderTotal !== undefined && (
                              <span className="text-xs font-black text-indigo-700 font-mono">
                                {ticket.orderTotal} ج.م
                              </span>
                            )}
                          </div>
                        </div>

                        {ticket.orderItemsSummary && (
                          <div className="text-xs text-slate-600 pt-1 border-t border-indigo-100/60 font-medium">
                            <span className="font-bold text-slate-700">أصناف الطلب: </span>
                            <span>{ticket.orderItemsSummary}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Customer Info & Status Switcher */}
                  <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400">بيانات صاحب البلاغ:</div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-800 truncate">{ticket.userName || 'عميل'}</div>
                          <div className="text-[11px] font-mono text-slate-500">{ticket.userPhone || 'بدون هاتف'}</div>
                        </div>
                      </div>

                      {ticket.userPhone && (
                        <a
                          href={getCleanWhatsappLink(ticket.userPhone)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>تواصل واتساب مع العميل</span>
                        </a>
                      )}
                    </div>

                    {/* Change Status Buttons */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5">تغيير حالة الشكوى:</div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => handleUpdateStatus(ticket.id, 'OPEN')}
                          disabled={updatingStatusId === ticket.id}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all text-center ${
                            ticket.status === 'OPEN'
                              ? 'bg-rose-600 text-white shadow-sm font-black'
                              : 'bg-white text-slate-600 hover:bg-rose-50 border border-slate-200'
                          }`}
                        >
                          جديدة
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(ticket.id, 'IN_PROGRESS')}
                          disabled={updatingStatusId === ticket.id}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all text-center ${
                            ticket.status === 'IN_PROGRESS'
                              ? 'bg-amber-600 text-white shadow-sm font-black'
                              : 'bg-white text-slate-600 hover:bg-amber-50 border border-slate-200'
                          }`}
                        >
                          قيد المتابعة
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(ticket.id, 'RESOLVED')}
                          disabled={updatingStatusId === ticket.id}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all text-center ${
                            ticket.status === 'RESOLVED'
                              ? 'bg-emerald-600 text-white shadow-sm font-black'
                              : 'bg-white text-slate-600 hover:bg-emerald-50 border border-slate-200'
                          }`}
                        >
                          تم الحل
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch Notes & Resolution Area */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      ملاحظة ورد المطعم على الشكوى (كيف تم التعامل مع المشكلة):
                    </label>
                    {ticket.updatedAt && (
                      <span className="text-[10px] text-slate-400">
                        آخر تحديث: {formatDate(ticket.updatedAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="مثال: تم التواصل مع العميل وتعويضه بصنف مجاني بالطلب القادم..."
                      value={ticketNotes[ticket.id] ?? ''}
                      onChange={e =>
                        setTicketNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                    />
                    <button
                      onClick={() => handleSaveNotes(ticket.id)}
                      disabled={savingNotesId === ticket.id}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 shrink-0 disabled:opacity-50"
                    >
                      {savingNotesId === ticket.id ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>حفظ الملاحظة</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
