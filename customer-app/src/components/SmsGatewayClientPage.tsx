import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Power, 
  Battery, 
  Wifi, 
  Server, 
  Key, 
  Clock, 
  Smartphone,
  ExternalLink,
  Info
} from 'lucide-react';
import { API_BASE_URL, api } from '../services/api';
import { Logo } from './Logo';

export const SmsGatewayClientPage: React.FC = () => {
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('sms_gw_server_url') || (typeof window !== 'undefined' ? window.location.origin : '');
  });
  const [deviceKey, setDeviceKey] = useState(() => {
    return localStorage.getItem('sms_gw_device_key') || 'UNIFOOD-SMS-GATEWAY-2026';
  });

  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [hasSmsPermission, setHasSmsPermission] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [simOperator, setSimOperator] = useState<string>('جاري الفحص...');
  const [todaySentCount, setTodaySentCount] = useState<number>(0);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('رسالة تجريبية من بوابة UniFood SMS Gateway 🚀');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // فحص بيئة الأندرويد الأصلية
  useEffect(() => {
    const bridge = (window as any).AndroidBridge;
    if (bridge) {
      setIsNativeApp(true);
      try {
        setHasSmsPermission(Boolean(bridge.isSmsPermissionGranted?.()));
        setIsServiceRunning(Boolean(bridge.isSmsGatewayRunning?.()));
      } catch (_e) {}
    }

    // جلب معلومات البطارية من متصفح الهاتف إن أمكن
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // نبضة دورية وتحديث البيانات
  const refreshStatus = async () => {
    const bridge = (window as any).AndroidBridge;
    if (bridge) {
      try {
        setHasSmsPermission(Boolean(bridge.isSmsPermissionGranted?.()));
        setIsServiceRunning(Boolean(bridge.isSmsGatewayRunning?.()));
      } catch (_e) {}
    }

    setLastCheckTime(new Date().toLocaleTimeString('ar-EG'));

    // جلب الرسائل المعلقة والنشطة من السيرفر
    try {
      const cleanServer = serverUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanServer}/api/sms-gateway/device/pending`, {
        headers: {
          'x-gateway-key': deviceKey.trim(),
        },
      });
      const data = await res.json();
      if (data?.messages) {
        setRecentLogs(data.messages);
      }
    } catch (_e) {}
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, [serverUrl, deviceKey]);

  // طلب إذن إرسال الرسائل من نظام أندرويد
  const handleRequestPermission = () => {
    const bridge = (window as any).AndroidBridge;
    if (bridge?.requestSmsPermission) {
      bridge.requestSmsPermission();
      setTimeout(refreshStatus, 2000);
    } else {
      alert('يتم تفعيل صلاحية إرسال الرسائل عند فتح التطبيق داخل هاتف الأندرويد.');
    }
  };

  // تشغيل أو إيقاف الخدمة
  const handleToggleService = () => {
    const bridge = (window as any).AndroidBridge;
    if (!bridge) {
      alert('لتشغيل بوابة إرسال الـ SMS من الشريحة، يرجى فتح هذا التطبيق عبر ملف APK المخصص للأندرويد على هاتفك.');
      return;
    }

    if (isServiceRunning) {
      bridge.stopSmsGateway?.();
      setIsServiceRunning(false);
    } else {
      if (!hasSmsPermission) {
        bridge.requestSmsPermission?.();
        alert('يرجى الموافقة على إذن إرسال الرسائل أولاً.');
        return;
      }
      bridge.startSmsGateway?.(serverUrl, deviceKey);
      setIsServiceRunning(true);
    }
  };

  // إرسال رسالة تجريبية
  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      alert('يرجى إدخال رقم الهاتف للتجربة');
      return;
    }

    setSendingTest(true);
    setTestStatus(null);

    const bridge = (window as any).AndroidBridge;
    if (bridge?.sendNativeSmsTest) {
      const sent = bridge.sendNativeSmsTest(testPhone.trim(), testMessage.trim());
      setSendingTest(false);
      setTestStatus(sent ? 'تم إرسال الرسالة التجريبية بنجاح عبر شريحة الهاتف! 📱' : 'فشل إرسال الرسالة، تأكد من وجود رصيد وصلاحيات SMS.');
    } else {
      // إرسال عبر مسار السيرفر لاختبار الطابور
      try {
        const cleanServer = serverUrl.replace(/\/+$/, '');
        const res = await fetch(`${cleanServer}/api/sms-gateway/admin/test-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone.trim(), message: testMessage.trim() }),
        });
        const data = await res.json();
        setSendingTest(false);
        setTestStatus(data.message || 'تم إدراج الرسالة في الطابور بنجاح.');
      } catch (err: any) {
        setSendingTest(false);
        setTestStatus('خطأ: ' + (err.message || 'فشل الإرسال'));
      }
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('sms_gw_server_url', serverUrl);
    localStorage.setItem('sms_gw_device_key', deviceKey);
    alert('تم حفظ إعدادات الاتصال بنجاح.');
    refreshStatus();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white" dir="rtl">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-3.5 px-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-600/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-white">UniFood SMS Gateway</h1>
              <p className="text-[11px] text-slate-400">بوابة إرسال رسائل التحقق (OTP) من هاتفك</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
              isServiceRunning 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isServiceRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{isServiceRunning ? 'الخدمة تعمل' : 'الخدمة متوقفة'}</span>
            </span>

            <button
              onClick={refreshStatus}
              title="تحديث الحالة"
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Permission Alert if not granted */}
        {isNativeApp && !hasSmsPermission && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-2">
              <p className="font-bold text-amber-300">إذن إرسال الرسائل (SEND_SMS) غير مفعل</p>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                لكي يتمكن التطبيق من إرسال رسائل الـ OTP لعملائك عبر شريحة الهاتف، يجب منح التطبيق إذن إرسال الرسائل.
              </p>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs transition-colors cursor-pointer"
              >
                منح الإذن الآن
              </button>
            </div>
          </div>
        )}

        {/* Master Power Toggle Button */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl text-center space-y-4">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleToggleService}
              className={`w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all shadow-xl active:scale-95 cursor-pointer ${
                isServiceRunning
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-600/30 ring-4 ring-emerald-500/30'
                  : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-slate-400 hover:text-white shadow-black/40 ring-4 ring-slate-800'
              }`}
            >
              <Power className="w-8 h-8" />
              <span className="text-[11px] font-black">{isServiceRunning ? 'إيقاف' : 'تشغيل'}</span>
            </button>
          </div>

          <div>
            <h3 className="text-base font-black text-white">
              {isServiceRunning ? 'بوابة الرسائل نشطة وتستقبل الطلبات' : 'بوابة الرسائل متوقفة حالياً'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              {isServiceRunning 
                ? 'التطبيق يعمل في خلفية الهاتف كخدمة مستمرة (Foreground Service) ويقوم بإرسال الرسائل تلقائياً حتى عند قفل الشاشة.' 
                : 'اضغط على الزر بالأعلى لبدء تشغيل خدمة استقبال وإرسال رسائل الـ SMS تلقائياً.'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
            <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px] mb-1">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span>البطارية</span>
              </div>
              <div className="text-sm font-black font-mono text-emerald-400">
                {batteryLevel !== null ? `${batteryLevel}%` : '100%'}
              </div>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px] mb-1">
                <Wifi className="w-3.5 h-3.5 text-sky-400" />
                <span>الشبكة</span>
              </div>
              <div className="text-xs font-black text-sky-300 truncate">
                {simOperator || 'شريحة SIM'}
              </div>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px] mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>آخر فحص</span>
              </div>
              <div className="text-xs font-bold font-mono text-amber-300">
                {lastCheckTime || 'الآن'}
              </div>
            </div>
          </div>
        </div>

        {/* Server & Device Key Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Server className="w-4 h-4 text-sky-400" />
            <h4 className="text-sm font-black text-white">إعدادات الاتصال بالسيرفر</h4>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رابط السيرفر (Server API URL)</label>
              <div className="relative">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  placeholder="https://unifood.store"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">مفتاح ربط الهاتف السري (Device Key)</label>
              <div className="relative">
                <input
                  type="text"
                  value={deviceKey}
                  onChange={e => setDeviceKey(e.target.value)}
                  placeholder="UNIFOOD-SMS-GATEWAY-2026"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500 font-bold"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                تأكد من مطابقة هذا المفتاح مع المفتاح المعروض في لوحة تحكم الأدمن (/admin).
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-xl text-xs transition-colors border border-slate-700"
            >
              حفظ إعدادات الاتصال
            </button>
          </div>
        </div>

        {/* Test SMS Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Send className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-black text-white">إرسال رسالة SMS تجريبية من الشريحة</h4>
          </div>

          {testStatus && (
            <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-sky-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{testStatus}</span>
            </div>
          )}

          <form onSubmit={handleSendTestSms} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رقم هاتف التجربة</label>
              <input
                type="tel"
                placeholder="010XXXXXXXX"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">نص الرسالة التجريبية</label>
              <textarea
                rows={2}
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={sendingTest}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{sendingTest ? 'جاري الإرسال عبر الشريحة...' : 'إرسال الرسالة التجريبية الآن 📱'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
