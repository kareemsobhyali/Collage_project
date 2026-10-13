import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  RefreshCw, 
  Check, 
  Zap, 
  VolumeX, 
  FileText, 
  Download, 
  Sliders, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { 
  fetchSystemPrinters, 
  type DetectedPrinter, 
  getPreferredPrinter, 
  setPreferredPrinter,
  getAutoPrintOnNewOrder,
  setAutoPrintOnNewOrder,
  getAutoPrintOnAccept,
  setAutoPrintOnAccept,
  getSilentPrintEnabled,
  setSilentPrintEnabled,
  getReceiptPaperWidth,
  setReceiptPaperWidth,
  printTestReceipt,
  isElectron,
  downloadKioskPrintingShortcut
} from '../services/printer';

interface PrinterSettingsModalProps {
  branchName: string;
  onClose: () => void;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({ branchName, onClose }) => {
  const [printers, setPrinters] = useState<DetectedPrinter[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(getPreferredPrinter());
  const [customPrinterInput, setCustomPrinterInput] = useState<string>('');
  const [useCustomInput, setUseCustomInput] = useState<boolean>(false);

  const [autoPrintNewOrder, setAutoPrintNewOrderState] = useState<boolean>(getAutoPrintOnNewOrder());
  const [autoPrintAccept, setAutoPrintAcceptState] = useState<boolean>(getAutoPrintOnAccept());
  const [silentPrint, setSilentPrintState] = useState<boolean>(getSilentPrintEnabled());
  const [paperWidth, setPaperWidthState] = useState<'80mm' | '58mm'>(getReceiptPaperWidth());

  const [loadingPrinters, setLoadingPrinters] = useState<boolean>(false);
  const [printingTest, setPrintingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isElectronEnv] = useState<boolean>(isElectron());
  const [showKioskHelp, setShowKioskHelp] = useState<boolean>(!isElectron());

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const list = await fetchSystemPrinters();
      setPrinters(list);

      // إذا كانت الطابعة المحفوظة غير موجودة في القائمة ولكن هناك طابعة افتراضية
      const saved = getPreferredPrinter();
      if (!saved && list.length > 0) {
        const def = list.find(p => p.isDefault) || list[0];
        setSelectedPrinter(def.name);
        setPreferredPrinter(def.name);
      } else if (saved) {
        setSelectedPrinter(saved);
        const exists = list.some(p => p.name === saved);
        if (!exists && saved !== 'DEFAULT') {
          setUseCustomInput(true);
          setCustomPrinterInput(saved);
        }
      }
    } catch (e) {
      console.error('Error fetching printers:', e);
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const handleSelectPrinter = (name: string) => {
    setSelectedPrinter(name);
    setPreferredPrinter(name);
    setUseCustomInput(false);
  };

  const handleCustomPrinterSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrinterInput.trim()) return;
    const name = customPrinterInput.trim();
    setSelectedPrinter(name);
    setPreferredPrinter(name);
  };

  const handleToggleAutoPrintNewOrder = (val: boolean) => {
    setAutoPrintNewOrderState(val);
    setAutoPrintOnNewOrder(val);
  };

  const handleToggleAutoPrintAccept = (val: boolean) => {
    setAutoPrintAcceptState(val);
    setAutoPrintOnAccept(val);
  };

  const handleToggleSilentPrint = (val: boolean) => {
    setSilentPrintState(val);
    setSilentPrintEnabled(val);
  };

  const handleSelectPaperWidth = (w: '80mm' | '58mm') => {
    setPaperWidthState(w);
    setReceiptPaperWidth(w);
  };

  const handlePrintTest = async () => {
    setPrintingTest(true);
    setTestResult(null);
    try {
      await printTestReceipt(branchName);
      setTestResult('تم إرسال أمر البون التجريبي للطابعة بنجاح 🧾');
    } catch (_err) {
      setTestResult('حدث خطأ أثناء الطباعة، يرجى فحص كابل الطابعة أو التعريف.');
    } finally {
      setPrintingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">إعدادات الطابعة الحرارية والطباعة الصامتة</h3>
              <p className="text-xs text-slate-500 mt-0.5">تثبيت طابعة البونات والطباعة المباشرة بدون شاشات منبثقة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 modal-scroll">
          {/* 1. Detect & Select Printer */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">1</span>
                <label className="text-sm font-black text-slate-800">اختيار وتثبيت الطابعة المعتمدة</label>
              </div>
              <button
                type="button"
                onClick={loadPrinters}
                disabled={loadingPrinters}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin' : ''}`} />
                <span>{loadingPrinters ? 'جاري الفحص...' : 'تحديث الطابعات المتصلة'}</span>
              </button>
            </div>

            {/* List of Detected Printers */}
            <div className="space-y-2">
              {/* Option: Default Windows Printer */}
              <div
                onClick={() => handleSelectPrinter('')}
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  !selectedPrinter || selectedPrinter === 'DEFAULT'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    !selectedPrinter || selectedPrinter === 'DEFAULT'
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {(!selectedPrinter || selectedPrinter === 'DEFAULT') && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 block">طابعة الويندوز الافتراضية (Default Printer)</span>
                    <span className="text-[11px] text-slate-500">الطباعة مباشرة على أي طابعة محددة كافتراضية في إعدادات الويندوز</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">النظام</span>
              </div>

              {/* Detected Physical Printers */}
              {printers.map((p) => {
                const isSelected = selectedPrinter === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => handleSelectPrinter(p.name)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-800 block truncate font-mono">{p.name}</span>
                        {p.portName && (
                          <span className="text-[10px] text-slate-400 font-mono">المنفذ: {p.portName}</span>
                        )}
                      </div>
                    </div>
                    {p.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                        الافتراضية ⭐
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Manual Input Fallback */}
              <div
                onClick={() => setUseCustomInput(true)}
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                  useCustomInput
                    ? 'border-indigo-600 bg-indigo-50/30'
                    : 'border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">كتابة اسم طابعة حرارية محددة يدوياً</span>
                  </div>
                  <span className="text-[10px] text-slate-400">مثال: Xprinter XP-80C</span>
                </div>

                {useCustomInput && (
                  <form onSubmit={handleCustomPrinterSave} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="اكتب اسم الطابعة في الويندوز (مثل: XP-80C أو POS-80)"
                      value={customPrinterInput}
                      onChange={e => setCustomPrinterInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs shrink-0"
                    >
                      تثبيت
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* 2. Automation & Silent Printing Options */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">2</span>
              <label className="text-sm font-black text-slate-800">إعدادات الطباعة التلقائية والصامتة</label>
            </div>

            {/* 3 Toggle Cards in a clean responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Auto print on accept */}
              <div 
                onClick={() => handleToggleAutoPrintAccept(!autoPrintAccept)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  autoPrintAccept ? 'border-emerald-500 bg-emerald-50/40 shadow-xs' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>عند قبول الطلب</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintAccept}
                    onChange={e => handleToggleAutoPrintAccept(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">يطبع فور الضغط على تأكيد القبول وتحديد الدقائق (موصى به ⭐)</p>
              </div>

              {/* Auto print on new order */}
              <div 
                onClick={() => handleToggleAutoPrintNewOrder(!autoPrintNewOrder)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  autoPrintNewOrder ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>عند وصول الطلب</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintNewOrder}
                    onChange={e => handleToggleAutoPrintNewOrder(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">يطبع لحظة طلب الطالب مباشرة قبل مراجعة الكاشير</p>
              </div>

              {/* Silent Printing Mode */}
              <div 
                onClick={() => handleToggleSilentPrint(!silentPrint)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 sm:col-span-2 md:col-span-1 ${
                  silentPrint ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800">
                    <VolumeX className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>الطباعة الصامتة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={silentPrint}
                    onChange={e => handleToggleSilentPrint(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">إرسال البون فوراً إلى الطابعة دون أي شاشات وسيطة</p>
              </div>
            </div>

            {/* Receipt Paper Width Card - Full Width Responsive Layout */}
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 pr-1">
                <span className="font-black text-xs text-slate-800 block">عرض ورق الطابعة الحرارية ومحيط الأمان</span>
                <p className="text-[11px] text-slate-500 mt-0.5">اختر حجم رول الورق المستخدم لمنع قص الأسعار والأرقام من جهة اليسار</p>
              </div>
              <div className="flex bg-white rounded-xl p-1 border border-slate-200 shrink-0 self-start sm:self-auto shadow-xs">
                <button
                  type="button"
                  onClick={() => handleSelectPaperWidth('80mm')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                    paperWidth === '80mm' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  80 مم (الرول العريض) ⭐
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPaperWidth('58mm')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                    paperWidth === '58mm' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  58 مم (رول صغير)
                </button>
              </div>
            </div>
          </div>

          {/* 3. Test Printing & Status Banner */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-right min-w-0">
              <span className="text-xs font-black text-indigo-950 block">تجربة الطابعة وتأكيد الإعدادات</span>
              <span className="text-[11px] text-indigo-700 block truncate mt-0.5">
                الطابعة الحالية المعتمدة: <strong>{selectedPrinter || 'طابعة النظام الافتراضية'}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handlePrintTest}
              disabled={printingTest}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 self-stretch sm:self-auto"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>{printingTest ? 'جاري إرسال البون...' : 'طباعة بون تجريبي فوري 🧾'}</span>
            </button>
          </div>

          {testResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {/* 4. Web Browser Kiosk Mode Helper (For Chrome / Edge users) */}
          {!isElectronEnv && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs">
              <div 
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowKioskHelp(!showKioskHelp)}
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-slate-800">
                    💡 هل تستخدم المتصفح (Chrome أو Edge) وتريد إخفاء نافذة الطباعة للأبد؟
                  </span>
                </div>
                <span className="text-xs text-indigo-600 font-bold hover:underline">
                  {showKioskHelp ? 'إخفاء' : 'عرض الطريقة (سهلة جداً)'}
                </span>
              </div>

              {showKioskHelp && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p>
                    في متصفحات الويب العادية (مثل Chrome و Edge)، يفرض المتصفح ظهور نافذة اختيار الطابعة. 
                    لإلغاء هذه النافذة تماماً وجعل الطابعة تطبع <strong>مباشرة بدون أي شاشات (Silent Kiosk Printing)</strong>:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-medium pr-2">
                    <li>تأكد من تعيين طابعتك الحرارية كـ <strong>طابعة افتراضية (Default Printer)</strong> في ويندوز (من Settings ثم Printers).</li>
                    <li>اضغط على الزر بالأسفل لتحميل ملف التشغيل السريع <code>UniFood-POS-SilentPrint.bat</code> (أو استخدم الملف المنشأ على سطح مكتبك).</li>
                    <li>افتح الملف وسيفتح شاشة الكاشير في بيئة مخصصة ومستقلة تماماً تطبع فورياً وبصمت تام!</li>
                  </ol>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => downloadKioskPrintingShortcut()}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل اختصار تشغيل الكاشير الصامت (UniFood-POS.bat)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            يتم حفظ الإعدادات تلقائياً على هذا الجهاز
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
          >
            تم وحفظ الإعدادات ✓
          </button>
        </div>
      </div>
    </div>
  );
};
