import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, X, RotateCw } from 'lucide-react';
import { useLockBodyScroll } from '../utils/scrollLock';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'نعم، تأكيد',
  cancelText = 'إلغاء',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) => {
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md ${
            variant === 'danger'
              ? 'bg-rose-100 text-rose-600 shadow-rose-500/20'
              : variant === 'warning'
              ? 'bg-amber-100 text-amber-600 shadow-amber-500/20'
              : 'bg-indigo-100 text-indigo-600 shadow-indigo-500/20'
          }`}
        >
          {variant === 'danger' && <Trash2 className="w-7 h-7" />}
          {variant === 'warning' && <AlertTriangle className="w-7 h-7" />}
          {variant === 'primary' && <HelpCircle className="w-7 h-7" />}
        </div>

        {/* Content */}
        <div>
          <h3 className="font-black text-slate-900 text-base">{title}</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">{message}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors text-center disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                : variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
            } disabled:opacity-50`}
          >
            {loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
