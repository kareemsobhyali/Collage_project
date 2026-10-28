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

  if (!isOpen) return null;

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

      const res = await api.importBulkMenu({
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
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <span>استيراد منيو مجمّع (Excel / CSV)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  تحميل الصور التلقائي ✓
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                أضف أقساماً وأصنافاً وأحجاماً غير محدودة دفعة واحدة لـ <strong className="text-slate-800">{branch?.name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: Template download & Tabs */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('EXCEL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'EXCEL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>ملف Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PASTE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'PASTE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Clipboard className="w-4 h-4 text-indigo-600" />
              <span>لصق نص المنيو</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => downloadMenuExcelTemplate(branch?.name || 'المطعم')}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>تحميل نموذج إكسيل الجاهز (.xlsx)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {/* Tab 1: Excel Drop Zone */}
          {activeTab === 'EXCEL' && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30 rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer group space-y-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-800">
                    {fileName ? `الملف المحدد: ${fileName}` : 'اضغط لاختيار ملف الإكسيل أو اسحبه وأفلته هنا'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات: <span className="font-mono font-bold text-slate-700">.xlsx , .xls , .csv</span>
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Paste Menu Text */}
          {activeTab === 'PASTE' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                الصق نص المنيو هنا (اكتب اسم القسم بين أقواس مربعة <span className="text-emerald-700 font-mono">[اسم القسم]</span> والوجبات تحته):
              </label>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`[قسم الشاورما]
شاورما دجاج سوري - 75 - صغير:50, وسط:75, كبير:95 - مع ثومية وبطاطس
فتة شاورما مشكل - 120

[قسم البرجر]
دبل تشيز برجر - 110 - دبل:110, تريبل:135`}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                dir="rtl"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>تحليل النص المنسوخ وعرض المعاينة</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Info Message */}
          {successInfo && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-black flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <div>
                <span>تم استيراد المنيو وتحديث القائمة بنجاح! ✓</span>
                <span className="block font-medium text-emerald-700 text-[11px] mt-0.5">
                  تم إنشاء {successInfo.categoriesCreated} قسم جديد، و {successInfo.itemsCreated} صنف، وتم تحميل وحفظ {successInfo.imagesDownloaded} صورة على السيرفر محلياً.
                </span>
              </div>
            </div>
          )}

          {/* Live Preview Table */}
          {parseResult && parseResult.items.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Quick Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">الأقسام المكتشفة</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{parseResult.categoriesCount}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5">
                  <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">إجمالي الوجبات</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{parseResult.items.length}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">وجبات بأحجام</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{parseResult.itemsWithSizesCount}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">صور سيتم تحميلها</span>
                    <span className="text-sm font-black text-purple-700 font-mono">{parseResult.itemsWithImagesCount}</span>
                  </div>
                </div>
              </div>

              {/* Table search filter */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث سريع داخل الأصناف المقروءة..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  عرض {filteredItems.length} من {parseResult.items.length} صنف
                </span>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">القسم</th>
                      <th className="p-2.5">اسم الوجبة</th>
                      <th className="p-2.5">السعر الأساسي</th>
                      <th className="p-2.5">الأحجام</th>
                      <th className="p-2.5">الصورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-bold text-indigo-700">{item.categoryName}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-900 block">{item.name}</span>
                          {item.description && (
                            <span className="text-[10px] text-slate-400 block line-clamp-1">{item.description}</span>
                          )}
                        </td>
                        <td className="p-2.5 font-black text-emerald-700 font-mono">{item.basePrice} ج.م</td>
                        <td className="p-2.5">
                          {item.sizes && item.sizes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.sizes.map((s, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold"
                                >
                                  {s.name}: {s.price} ج.م
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">حجم موحد</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {item.imageUrl ? (
                            <div className="flex items-center gap-1.5 text-purple-700 font-bold text-[10px]">
                              <img
                                src={getFullImageUrl(item.imageUrl)}
                                alt=""
                                className="w-6 h-6 rounded-md object-cover border border-slate-200 bg-slate-100"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                                سيتم تنزيلها
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">بدون صورة</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mode Option: Merge or Replace */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">طريقة الاستيراد والتخزين:</span>
                  <span className="text-[11px] text-slate-500">
                    {replaceExisting
                      ? 'سيتم مسح قائمة الطعام القديمة بالكامل وإحلال الأصناف الجديدة مكانها.'
                      : 'سيتم دمج وإضافة هذه الأصناف للمنيو الحالي دون المساس بالأصناف السابقة.'}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                  />
                  <span className={`text-xs font-black ${replaceExisting ? 'text-rose-700' : 'text-slate-600'}`}>
                    مسح المنيو القديم أولاً
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={importing || !parseResult || parseResult.items.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{importProgressText || 'جاري الاستيراد...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {parseResult && parseResult.items.length > 0
                    ? `اعتماد واستيراد (${parseResult.items.length} صنف)`
                    : 'اعتماد المنيو'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
