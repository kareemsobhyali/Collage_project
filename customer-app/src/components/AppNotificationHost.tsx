import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BellRing,
  X,
  Clock
} from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

function detectToastStyle(message: string, customTitle?: string): {
  title: string;
  type: 'success' | 'warning' | 'error' | 'info';
} {
  const text = `${customTitle || ''} ${message}`;
  if (
    text.includes('تم ') ||
    text.includes('بنجاح') ||
    text.includes('نسخ') ||
    text.includes('✅') ||
    text.includes('🎉') ||
    text.includes('🥳')
  ) {
    return { title: customTitle || 'تم بنجاح ✨', type: 'success' };
  }
  if (
    text.includes('مغلق') ||
    text.includes('مواعيد العمل') ||
    text.includes('انتظار') ||
    text.includes('تأكيد') ||
    text.includes('الحد الأدنى')
  ) {
    return { title: customTitle || 'تنبيه من المطعم ⏰', type: 'warning' };
  }
  if (
    text.includes('عذراً') ||
    text.includes('فشل') ||
    text.includes('خطأ') ||
    text.includes('غير متاح') ||
    text.includes('إلغاء') ||
    text.includes('⚠️')
  ) {
    return { title: customTitle || 'تنبيه هام', type: 'error' };
  }
  return { title: customTitle || 'إشعار يونيفود 🔔', type: 'info' };
}

export function showInAppNotification(message: string, customTitle?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('unifood-inapp-notify', {
      detail: { message, title: customTitle },
    })
  );
}

export const AppNotificationHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, customTitle?: string) => {
      if (!message) return;
      const cleanMessage = String(message).trim();
      const { title, type } = detectToastStyle(cleanMessage, customTitle);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setToasts((prev) => [{ id, title, message: cleanMessage, type }, ...prev.slice(0, 2)]);

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // استبدال window.alert الافتراضي القبيح في المتصفح والأندرويد بإشعارات أنيقة داخل التطبيق
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      addToast(String(msg ?? ''));
    };

    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<{ message: string; title?: string }>;
      if (custom.detail?.message) {
        addToast(custom.detail.message, custom.detail.title);
      }
    };

    window.addEventListener('unifood-inapp-notify', handleCustomEvent);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener('unifood-inapp-notify', handleCustomEvent);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[9999] flex flex-col gap-2.5 pointer-events-none"
      dir="rtl"
    >
      {toasts.map((toast) => {
        const theme = {
          success: {
            bg: 'bg-slate-900/95 border-emerald-500/40',
            iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            titleColor: 'text-emerald-300',
            barColor: 'bg-emerald-500',
            Icon: CheckCircle2,
          },
          warning: {
            bg: 'bg-slate-900/95 border-amber-500/40',
            iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            titleColor: 'text-amber-300',
            barColor: 'bg-amber-500',
            Icon: Clock,
          },
          error: {
            bg: 'bg-slate-900/95 border-rose-500/40',
            iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
            titleColor: 'text-rose-300',
            barColor: 'bg-rose-500',
            Icon: AlertTriangle,
          },
          info: {
            bg: 'bg-slate-900/95 border-indigo-500/40',
            iconBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
            titleColor: 'text-indigo-300',
            barColor: 'bg-indigo-500',
            Icon: BellRing,
          },
        }[toast.type];

        const IconComponent = theme.Icon;

        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${theme.bg} text-white p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 cursor-pointer flex items-start gap-3`}
          >
            {/* Accent Side Bar */}
            <div className={`w-1 self-stretch rounded-full ${theme.barColor} shrink-0`} />

            {/* Icon Badge */}
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${theme.iconBg}`}
            >
              <IconComponent className="w-5 h-5" />
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className={`text-xs font-black ${theme.titleColor} truncate`}>
                  {toast.title}
                </h4>
                <span className="text-[10px] font-bold text-slate-400 shrink-0">الآن</span>
              </div>
              <p className="text-xs text-slate-100 font-bold leading-relaxed mt-1 whitespace-pre-line">
                {toast.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="إغلاق الإشعار"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
