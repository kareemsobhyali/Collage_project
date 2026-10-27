import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  PowerOff, 
  AlertTriangle,
  Play,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { toast } from '../utils/toast';
import { useLockBodyScroll } from '../utils/scrollLock';

interface BranchStatusModalProps {
  currentStatus: 'OPEN' | 'BUSY' | 'CLOSED';
  currentClosedUntil?: string | null;
  currentReason?: string | null;
  onSave: (status: 'OPEN' | 'BUSY' | 'CLOSED', durationMinutes?: number, reason?: string) => Promise<void>;
  onClose: () => void;
}

export const BranchStatusModal: React.FC<BranchStatusModalProps> = ({
  currentStatus,
  currentClosedUntil,
  currentReason,
  onSave,
  onClose,
}) => {
  useLockBodyScroll(true);
  const [selectedStatus, setSelectedStatus] = useState<'OPEN' | 'BUSY' | 'CLOSED'>(currentStatus || 'OPEN');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState<string>('30');
  const [reason, setReason] = useState<string>(currentReason || '');
  const [loading, setLoading] = useState(false);

  const durationPresets = [15, 30, 45, 60, 90, 120];

  const handleSelectPreset = (mins: number) => {
    setDurationMinutes(mins);
    setCustomMinutes(String(mins));
  };

  const handleCustomChange = (val: string) => {
    setCustomMinutes(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDurationMinutes(parsed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSave(
        selectedStatus, 
        selectedStatus === 'BUSY' ? durationMinutes : undefined, 
        reason.trim() || undefined
      );
      toast.success('تم تحديث حالة عمل الفرع بنجاح');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث حالة عمل الفرع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm sm:text-base truncate">حالة استقبال الطلبات للفرع</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">التحكم في فتح المطعم أو إغلاقه مؤقتاً مع عداد تنازلي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Status Choice Cards */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 mb-1">اختر الحالة المطلوبة:</label>

              {/* 1. OPEN */}
              <div
                onClick={() => setSelectedStatus('OPEN')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  selectedStatus === 'OPEN'
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-xs sm:text-sm text-slate-900 block">🟢 مفتوح (استقبال الطلبات)</span>
                    <span className="text-[11px] sm:text-xs text-slate-500 block leading-tight">المطعم متاح للعملاء والطلبات تصلك مباشرة مع التنبيه الصوتي</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="status"
                  checked={selectedStatus === 'OPEN'}
                  onChange={() => setSelectedStatus('OPEN')}
                  className="text-emerald-600 focus:ring-0 w-4 h-4 shrink-0"
                />
              </div>

              {/* 2. BUSY / Temporary Closed with Timer */}
              <div
                onClick={() => setSelectedStatus('BUSY')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  selectedStatus === 'BUSY'
                    ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-xs sm:text-sm text-slate-900 block">🟡 مغلق مؤقتاً (مع عداد تنازلي)</span>
                    <span className="text-[11px] sm:text-xs text-slate-500 block leading-tight">لفترات الراحة أو ضغط المطبخ. يفتح تلقائياً بعد انتهاء المدة</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="status"
                  checked={selectedStatus === 'BUSY'}
                  onChange={() => setSelectedStatus('BUSY')}
                  className="text-amber-600 focus:ring-0 w-4 h-4 shrink-0"
                />
              </div>

              {/* 3. CLOSED */}
              <div
                onClick={() => setSelectedStatus('CLOSED')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  selectedStatus === 'CLOSED'
                    ? 'border-rose-500 bg-rose-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <PowerOff className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-xs sm:text-sm text-slate-900 block">🔴 مغلق حتى إشعار آخر</span>
                    <span className="text-[11px] sm:text-xs text-slate-500 block leading-tight">إيقاف استقبال الطلبات كلياً حتى تقوم بفتحه يدوياً</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="status"
                  checked={selectedStatus === 'CLOSED'}
                  onChange={() => setSelectedStatus('CLOSED')}
                  className="text-rose-600 focus:ring-0 w-4 h-4 shrink-0"
                />
              </div>
            </div>

            {/* Conditional Duration Options for BUSY Status */}
            {selectedStatus === 'BUSY' && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تحديد مدة الإغلاق المؤقت:</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-md">
                    {durationMinutes} دقيقة
                  </span>
                </div>

                {/* Presets - 3 columns on mobile, 6 on desktop to prevent text wrapping */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {durationPresets.map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSelectPreset(mins)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl transition-all font-mono whitespace-nowrap text-center ${
                        durationMinutes === mins
                          ? 'bg-amber-500 text-white shadow-sm font-black'
                          : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      {mins >= 60 ? `${mins / 60} س` : `${mins} د`}
                    </button>
                  ))}
                </div>

                {/* Custom Minutes Input */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-amber-800 font-bold shrink-0">مدة أخرى (بالدقائق):</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customMinutes}
                    onChange={e => handleCustomChange(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                  />
                </div>

                {/* Expected Reopen Time Preview */}
                <div className="text-[11px] text-amber-800 bg-white/90 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                  <span>وقت إعادة الفتح التلقائي المتوقع:</span>
                  <span className="font-black font-mono text-amber-950">
                    {new Date(Date.now() + durationMinutes * 60 * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}

            {/* Reason Input */}
            {(selectedStatus === 'BUSY' || selectedStatus === 'CLOSED') && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  سبب الإغلاق (يظهر للعملاء كرسالة توضيحية - اختياري):
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={selectedStatus === 'BUSY' ? 'مثال: ضغط طلبات كبير / تجهيز المطبخ' : 'مثال: انتهت مواعيد العمل لليوم'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all resize-none"
                />
              </div>
            )}
          </div>

          {/* Clean Dedicated Footer outside scroll container */}
          <div className="shrink-0 p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 sm:flex-none px-5 py-2.5 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
                selectedStatus === 'OPEN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  : selectedStatus === 'BUSY'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
              }`}
            >
              {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              <span>حفظ وتطبيق الحالة فورياً</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
