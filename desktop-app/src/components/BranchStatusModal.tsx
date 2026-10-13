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
      onClose();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة عمل الفرع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">حالة استقبال الطلبات للفرع</h3>
              <p className="text-xs text-slate-500">التحكم في فتح المطعم أو إغلاقه مؤقتاً مع عداد تنازلي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Status Choice Cards */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 mb-1">اختر الحالة المطلوبة:</label>

            {/* 1. OPEN */}
            <div
              onClick={() => setSelectedStatus('OPEN')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                selectedStatus === 'OPEN'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <span className="font-black text-sm text-slate-900 block">🟢 مفتوح (استقبال الطلبات)</span>
                  <span className="text-xs text-slate-500">المطعم متاح للطلاب والطلبات تصلك مباشرة مع التنبيه الصوتي</span>
                </div>
              </div>
              <input
                type="radio"
                name="status"
                checked={selectedStatus === 'OPEN'}
                onChange={() => setSelectedStatus('OPEN')}
                className="text-emerald-600 focus:ring-0 w-4 h-4"
              />
            </div>

            {/* 2. BUSY / Temporary Closed with Timer */}
            <div
              onClick={() => setSelectedStatus('BUSY')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                selectedStatus === 'BUSY'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-sm text-slate-900 block">🟡 مغلق مؤقتاً (مع عداد تنازلي)</span>
                  <span className="text-xs text-slate-500">لفترات الراحة أو ضغط المطبخ. يفتح تلقائياً بعد انتهاء المدة</span>
                </div>
              </div>
              <input
                type="radio"
                name="status"
                checked={selectedStatus === 'BUSY'}
                onChange={() => setSelectedStatus('BUSY')}
                className="text-amber-600 focus:ring-0 w-4 h-4"
              />
            </div>

            {/* 3. CLOSED */}
            <div
              onClick={() => setSelectedStatus('CLOSED')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                selectedStatus === 'CLOSED'
                  ? 'border-rose-500 bg-rose-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <PowerOff className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-sm text-slate-900 block">🔴 مغلق حتى إشعار آخر</span>
                  <span className="text-xs text-slate-500">إيقاف استقبال الطلبات كلياً حتى تقوم بفتحه يدوياً</span>
                </div>
              </div>
              <input
                type="radio"
                name="status"
                checked={selectedStatus === 'CLOSED'}
                onChange={() => setSelectedStatus('CLOSED')}
                className="text-rose-600 focus:ring-0 w-4 h-4"
              />
            </div>
          </div>

          {/* Conditional Duration Options for BUSY Status */}
          {selectedStatus === 'BUSY' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>تحديد مدة الإغلاق المؤقت:</span>
                </span>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                  {durationMinutes} دقيقة
                </span>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-6 gap-1.5">
                {durationPresets.map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPreset(mins)}
                    className={`py-2 text-xs font-bold rounded-xl transition-all font-mono ${
                      durationMinutes === mins
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {mins >= 60 ? `${mins / 60} س` : `${mins} د`}
                  </button>
                ))}
              </div>

              {/* Custom Minutes Input */}
              <div className="flex items-center gap-2 pt-1">
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
              <div className="text-[11px] text-amber-800 bg-white/80 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                <span>وقت إعادة الفتح التلقائي المتوقع:</span>
                <span className="font-black font-mono text-amber-950">
                  {new Date(Date.now() + durationMinutes * 60 * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )}

          {/* Reason Input */}
          {(selectedStatus === 'BUSY' || selectedStatus === 'CLOSED') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سبب الإغلاق (يظهر للطلاب كرسالة توضيحية - اختياري):
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={selectedStatus === 'BUSY' ? 'مثال: ضغط طلبات كبير / تجهيز المطبخ' : 'مثال: انتهت مواعيد العمل لليوم'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
              />
            </div>
          )}

          {/* Sticky Footer Actions */}
          <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-4 bg-white/95 backdrop-blur-sm flex items-center justify-end gap-3 border-t border-slate-200 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-2 ${
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
