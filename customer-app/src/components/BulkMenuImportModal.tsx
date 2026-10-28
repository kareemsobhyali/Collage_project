import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Sparkles,
  Layers,
  UtensilsCrossed,
  Image as ImageIcon
} from 'lucide-react';
import { 
  parseExcelFile, 
  parsePastedMenuText, 
  downloadMenuExcelTemplate, 
  type ParsedBulkItem, 
  type ParseResult 
} from '../utils/menuExcelParser';
import { api, getFullImageUrl } from '../services/api';

interface BulkMenuImportModalProps {
  branch: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkMenuImportModal: React.FC<BulkMenuImportModalProps> = ({
  branch,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'EXCEL' | 'PASTE'>('EXCEL');
  const [fileName, setFileName] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [importProgressText, setImportProgressText] = useState<string>('');
  const [successInfo, setSuccessInfo] = useState<{
    categoriesCreated: number;
    itemsCreated: number;
    imagesDownloaded: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !branch) return null;

  // معالجة اختيار ملف Excel أو CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessInfo(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelFile(buffer);
      if (result.items.length === 0) {
        setErrorMsg('لم نتمكن من قراءة أي أصناف صالحة من الملف. تأكد من وجود أعمدة: القسم، اسم الصنف، السعر.');
      }
      setParseResult(result);
    } catch (err: any) {
      setErrorMsg(`حدث خطأ أثناء قراءة ملف الإكسيل: ${err?.message || err}`);
      setParseResult(null);
    }
  };

  // معالجة سحب وإفلات الملف
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessInfo(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelFile(buffer);
      setParseResult(result);
    } catch (err: any) {
      setErrorMsg(`فشل قراءة الملف: ${err?.message || err}`);
    }
  };

  // معالجة تحليل النص المنسوخ
  const handleParseText = () => {
    if (!pastedText.trim()) {
      setErrorMsg('يرجى لصق نص المنيو أولاً');
      return;
    }
    setErrorMsg('');
    setSuccessInfo(null);
    const result = parsePastedMenuText(pastedText);
    if (result.items.length === 0) {
      setErrorMsg('لم نتمكن من استخراج أصناف صالحة من النص. تأكد من كتابة اسم الصنف والسعر.');
    }
    setParseResult(result);
  };

  // إرسال البيانات المجمعة للسيرفر للاستيراد
  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.items.length === 0) return;

    try {
      setImporting(true);
      setErrorMsg('');
      setImportProgressText('جاري رفع الأصناف وتنزيل الصور وتخزينها على السيرفر...');

      const res = await api.importAdminBulkMenu(branch.id, {
        replaceExisting,
        items: parseResult.items,
      });

      setSuccessInfo({
        categoriesCreated: res.categoriesCreated || 0,
        itemsCreated: res.itemsCreated || parseResult.items.length,
        imagesDownloaded: res.imagesDownloaded || 0,
      });

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل استيراد المنيو على السيرفر');
    } finally {
      setImporting(false);
      setImportProgressText('');
    }
  };

  // تصفية الأصناف المعروضة في جدول المعاينة
  const filteredItems = (parseResult?.items || []).filter((item: ParsedBulkItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.categoryName.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>استيراد منيو مجمع لمطعم: {branch?.name || ''}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Excel / CSV / نص
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                أضف كل أقسام وأصناف وأحجام مطعمك دفعة واحدة وبضغطة زر مع حفظ الصور محلياً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Container */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Success Banner */}
          {successInfo && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 animate-slideDown">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div className="text-sm">
                <p className="font-black">تم استيراد المنيو بنجاح تام! 🎉</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  تمت إضافة {successInfo.itemsCreated} صنف عبر {successInfo.categoriesCreated} قسم، وتم تحميل وحفظ {successInfo.imagesDownloaded} صورة على السيرفر.
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-xs font-bold">{errorMsg}</p>
            </div>
          )}

          {/* Navigation Tabs (Excel File vs Paste Text) */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('EXCEL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'EXCEL'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>رفع ملف Excel أو CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PASTE')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'PASTE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Clipboard className="w-4 h-4" />
                <span>لصق نص المنيو مباشرة</span>
              </button>
            </div>

            {/* Template Download Button */}
            <button
              type="button"
              onClick={() => downloadMenuExcelTemplate(branch?.name)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-colors"
              title="تحميل قالب إكسيل جاهز يحتوي على أمثلة للشاورما والمشويات والأحجام"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>تحميل نموذج الإكسيل (.xlsx)</span>
            </button>
          </div>

          {/* Tab 1: Excel / CSV File Dropzone */}
          {activeTab === 'EXCEL' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 transition-all rounded-3xl p-7 text-center cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white shadow-xs border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800">
                {fileName ? `تم اختيار: ${fileName}` : 'اسحب وأفلت ملف الإكسيل هنا أو اضغط للاختيار'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                يدعم ملفات Excel (.xlsx, .xls) وملفات CSV. يقوم النظام تلقائياً بالتعرف على أسماء الأعمدة العربية والإنجليزية.
              </p>
            </div>
          )}

          {/* Tab 2: Paste Raw Text */}
          {activeTab === 'PASTE' && (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`الصق نص المنيو هنا، مثال:
[وجبات الشاورما]
شاورما فراخ عربي - 85 - شاورما متبلة بالثومية مع بطاطس - صغير:65, كبير:85
شاورما لحمة عربي - 95 - لحم بلدي طازج - صغير:75, كبير:95 - https://example.com/shawarma.jpg

[المشروبات]
بيبسي كانز - 20
مياه معدنية - 10`}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-800"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  صيغة السطر: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">اسم الصنف - السعر - الوصف - الأحجام (اختياري)</code>
                </span>
                <button
                  type="button"
                  onClick={handleParseText}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تحليل النص المنسوخ</span>
                </button>
              </div>
            </div>
          )}

          {/* Parsed Result & Preview */}
          {parseResult && parseResult.items.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">عدد الأقسام</span>
                    <span className="text-base font-black text-slate-800">{parseResult.categoriesCount}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">إجمالي الأصناف</span>
                    <span className="text-base font-black text-emerald-600">{parseResult.items.length}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">أصناف بأحجام</span>
                    <span className="text-base font-black text-slate-800">
                      {parseResult.itemsWithSizesCount}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">أصناف بروابط صور</span>
                    <span className="text-base font-black text-slate-800">
                      {parseResult.itemsWithImagesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Table Header & Search */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span>معاينة الأصناف الجاهزة للاستيراد ({filteredItems.length})</span>
                </h4>
                <div className="relative w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في الأصناف المستخرجة..."
                    className="w-full pl-3 pr-8 py-1.5 bg-slate-100 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">القسم</th>
                      <th className="p-2.5">اسم الصنف</th>
                      <th className="p-2.5">السعر الأساسي</th>
                      <th className="p-2.5">الأحجام والأسعار</th>
                      <th className="p-2.5">الصورة</th>
                      <th className="p-2.5">الوصف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                            {item.categoryName}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="p-2.5 font-mono font-bold text-emerald-600">{item.basePrice} ج.م</td>
                        <td className="p-2.5">
                          {item.sizes && item.sizes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.sizes.map((s, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono"
                                >
                                  {s.name}: {s.price}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {item.imageUrl ? (
                            <div className="flex items-center gap-1.5" title={item.imageUrl}>
                              <img
                                src={getFullImageUrl(item.imageUrl)}
                                alt=""
                                onError={(e: any) => {
                                  e.target.style.display = 'none';
                                }}
                                className="w-6 h-6 rounded-md object-cover border border-slate-200"
                              />
                              <span className="text-[10px] text-sky-600 truncate max-w-[120px] font-mono">
                                سيتم تنزيلها وحفظها
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px]">بدون صورة</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px] truncate max-w-[180px]">
                          {item.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mode Option: Merge vs Replace */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="adminReplaceMenu"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="adminReplaceMenu" className="text-xs font-bold text-slate-700 cursor-pointer">
                    استبدال المنيو الحالي بالكامل (حذف المنيو القديم وإضافة هذا الجديد)
                  </label>
                </div>
                <span className="text-[11px] text-slate-400">
                  {replaceExisting ? '⚠️ سيتم حذف الأقسام والأصناف الحالية' : '✅ سيتم دمج الأصناف الجديدة مع الحالية'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="text-xs text-slate-500">
            {importing && (
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>{importProgressText}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parseResult || parseResult.items.length === 0 || importing}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                !parseResult || parseResult.items.length === 0 || importing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
              }`}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ والتنزيل...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد استيراد المنيو ({parseResult?.items.length || 0} صنف)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
