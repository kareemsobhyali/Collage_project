import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Monitor, CheckCircle2, X } from 'lucide-react';
import { isElectron } from '../services/printer';
import { toast } from '../utils/toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredBranchPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

interface InstallAppButtonProps {
  variant?: 'header' | 'login';
}

const checkIsRunningStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isElectron()) return true;
  if ((window.navigator as any).standalone === true) return true;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.matchMedia?.('(display-mode: window-controls-overlay)').matches) return true;
  return false;
};

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({ variant = 'header' }) => {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsRunningStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__deferredBranchPwaPrompt || null : null
  );
  const [installing, setInstalling] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isWindows = /windows/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);

  useEffect(() => {
    if (checkIsRunningStandalone()) {
      setIsInstalled(true);
      return;
    }

    const syncDeferredPrompt = () => {
      if (window.__deferredBranchPwaPrompt) {
        setDeferredPrompt(window.__deferredBranchPwaPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredBranchPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleInstalled = () => {
      window.__deferredBranchPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowGuideModal(false);
    };

    syncDeferredPrompt();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('branch-pwa-installable', syncDeferredPrompt);
    window.addEventListener('branch-pwa-installed', handleInstalled);
    window.addEventListener('appinstalled', handleInstalled);

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) {
        handleInstalled();
      }
    };
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('branch-pwa-installable', syncDeferredPrompt);
      window.removeEventListener('branch-pwa-installed', handleInstalled);
      window.removeEventListener('appinstalled', handleInstalled);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.__deferredBranchPwaPrompt;
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        setInstalling(true);
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        window.__deferredBranchPwaPrompt = null;
        setDeferredPrompt(null);
        if (choice?.outcome === 'accepted') {
          setIsInstalled(true);
          toast.success('تم بدء تثبيت برنامج الفرع على جهازك بنجاح!');
        }
      } catch (_err) {
        setShowGuideModal(true);
      } finally {
        setInstalling(false);
      }
      return;
    }

    setShowGuideModal(true);
  };

  const guideModal =
    showGuideModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowGuideModal(false)}
          >
            <div
              dir="rtl"
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">
                      {isWindows ? 'تثبيت نظام الفرع على الويندوز' : 'تثبيت نظام الفرع كتطبيق مستقل'}
                    </h3>
                    <p className="text-[11px] text-slate-300">UniFood Branch POS</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-right">
                {isIOS ? (
                  <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                    <p className="font-bold text-slate-900">لتثبيت التطبيق على iPhone أو iPad:</p>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <p>1. اضغط على زر <strong>المشاركة (Share)</strong> في أسفل متصفح Safari.</p>
                      <p>2. اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> ثم اضغط <strong>إضافة</strong>.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                    <p className="font-bold text-slate-900">
                      لتثبيت النظام كبرنامج مستقل على سطح المكتب وشريط المهام في الويندوز (Chrome أو Edge):
                    </p>
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <p>
                          انظر إلى <strong>شريط العنوان بالأعلى</strong> (بجانب علامة النجمة) واضغط على أيقونة التثبيت{' '}
                          <span className="inline-block px-1.5 py-0.5 bg-white border border-indigo-200 rounded font-mono text-[11px] font-bold text-indigo-700">
                            تثبيت UniFood Branch
                          </span>
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <p>
                          أو من قائمة المتصفح <strong className="font-mono">(⋮)</strong> بالأعلى اختر{' '}
                          <strong>التطبيقات (Apps)</strong> أو <strong>البث والحفظ والمشاركة</strong> ثم{' '}
                          <strong>تثبيت الصفحة كتطبيق (Install)</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold leading-relaxed">
                        بعد التثبيت ستظهر أيقونة البرنامج على سطح المكتب وقائمة Start، وسيعمل في نافذة مستقلة مع وصول التحديثات تلقائياً.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors"
                >
                  حسناً، فهمت
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === 'login') {
    return (
      <>
        <div className="mt-5 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
          >
            <Monitor className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>
              {installing
                ? 'جاري فتح نافذة التثبيت...'
                : isWindows
                ? 'تثبيت برنامج الفرع على الويندوز (سطح المكتب)'
                : 'تثبيت نظام الفرع كتطبيق مستقل على جهازك'}
            </span>
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-1.5">
            يعمل كبرنامج مستقل من سطح المكتب وشريط المهام مع تحديثات تلقائية فورية
          </p>
        </div>
        {guideModal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        className="h-8 sm:h-9 px-2.5 sm:px-3 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 shadow-sm active:scale-95 disabled:opacity-60"
        title={
          isWindows
            ? 'تثبيت نظام الفرع كبرنامج مستقل على سطح المكتب في الويندوز'
            : 'تثبيت نظام الفرع كتطبيق مستقل على الجهاز'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">{isWindows ? 'تثبيت على الويندوز' : 'تثبيت التطبيق'}</span>
        <span className="sm:hidden">تثبيت</span>
      </button>
      {guideModal}
    </>
  );
};
