import React from 'react';
import { Printer, X } from 'lucide-react';
import { printOrderReceipt } from '../services/printer';
import { getDisplayAddress } from '../utils/address';

interface ReceiptModalProps {
  order: any;
  branchName: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, branchName, onClose }) => {
  if (!order) return null;

  const formattedDate = new Date(order.createdAt).toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const handlePrint = () => {
    printOrderReceipt(order, branchName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header (Hidden in Print) */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">معاينة بون المطبخ والعميل</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white" id="printable-receipt">
          <div className="border border-dashed border-slate-300 p-4 rounded-lg font-mono text-center text-slate-800">
            {/* Header info */}
            <div className="flex items-center justify-center gap-1.5 mb-1 text-slate-500">
              <span className="text-xs font-black tracking-wider uppercase text-indigo-700">UniFood</span>
              <span className="text-[10px]">•</span>
              <span className="text-[11px] font-bold">يونيفود للجامعات</span>
            </div>
            <h2 className="text-xl font-black mb-1">{branchName}</h2>
            <p className="text-xs text-slate-500 mb-2">منظومة توصيل طلبات الحرم الجامعي</p>
            <div className="border-b border-dashed border-slate-300 my-2"></div>

            <div className="flex justify-between items-center text-xs mb-1">
              <span>رقم الطلب:</span>
              <span className="font-bold text-sm">#{order.orderNumber}</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span>الوقت:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span>نوع الطلب:</span>
              <span className="font-bold text-indigo-700">
                {order.orderType === 'DELIVERY' ? 'توصيل' : 'استلام من الفرع'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs mb-2">
              <span>طريقة الدفع:</span>
              <span className="font-bold">
                {order.paymentMethod === 'CASH' && 'كاش عند الاستلام'}
                {order.paymentMethod === 'VODAFONE_CASH' && 'محفظة كاش'}
                {order.paymentMethod === 'INSTAPAY' && 'إنستاباي'}
                {order.paymentMethod === 'CARD' && 'بطاقة دفع'}
              </span>
            </div>
            {order.paymentSenderPhone && (
              <div className="flex justify-between items-center text-xs mb-2 bg-slate-100 p-1.5 rounded">
                <span className="font-bold">المحول منه:</span>
                <span className="font-mono font-bold">{order.paymentSenderPhone}</span>
              </div>
            )}

            <div className="border-b border-dashed border-slate-300 my-2"></div>

            {/* Customer Info */}
            <div className="text-right text-xs mb-3 space-y-1 bg-slate-50 p-2 rounded">
              <div><span className="font-bold">العميل:</span> {order.customerName}</div>
              <div><span className="font-bold">الهاتف:</span> {order.customerPhone}</div>
              {order.orderType === 'DELIVERY' && (
                <div><span className="font-bold">العنوان الجامعي:</span> {getDisplayAddress(order.addressText, 'مقر العميل بالحرم')}</div>
              )}
              {order.notes && (
                <div><span className="font-bold text-amber-700">ملاحظات:</span> {order.notes}</div>
              )}
            </div>

            <div className="border-b border-slate-400 my-2"></div>

            {/* Items Table */}
            <div className="text-xs text-right space-y-2 mb-3">
              <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                <span>الصنف / التفاصيل</span>
                <span>المبلغ</span>
              </div>
              {order.items?.map((item: any, idx: number) => {
                let modifiersList: any[] = [];
                if (item.selectedModifiers) {
                  try {
                    modifiersList = JSON.parse(item.selectedModifiers);
                  } catch (e) {}
                }

                return (
                  <div key={idx} className="border-b border-slate-100 pb-1">
                    <div className="flex justify-between font-bold">
                      <span>{item.quantity} × {item.itemName} {item.sizeName ? `(${item.sizeName})` : ''}</span>
                      <span>{item.totalPrice} ج.م</span>
                    </div>
                    {modifiersList.length > 0 && (
                      <div className="text-[10px] text-slate-600 pr-2">
                        + {modifiersList.map(m => `${m.optionName} (${m.price} ج.م)`).join('، ')}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] text-slate-800 font-bold pr-2">
                        * ملاحظة: {item.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-b border-dashed border-slate-300 my-2"></div>

            {/* Totals */}
            <div className="text-xs space-y-1 mb-3">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{order.subtotal} ج.م</span>
              </div>
              {order.orderType === 'DELIVERY' && (
                <div className="flex justify-between">
                  <span>رسوم التوصيل:</span>
                  <span>{order.deliveryFee} ج.م</span>
                </div>
              )}
              {Boolean(order.discount && Number(order.discount) > 0) && (
                <div className="flex justify-between font-bold text-emerald-800">
                  <span>خصم الكوبون ({order.promoCode || 'كود'}):</span>
                  <span>-{order.discount} ج.م</span>
                </div>
              )}
              {Boolean(order.walletDiscount && Number(order.walletDiscount) > 0) && (
                <div className="flex justify-between font-bold text-purple-900">
                  <span>خصم المحفظة الإلكترونية:</span>
                  <span>-{order.walletDiscount} ج.م</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-300 pt-1">
                <span>الإجمالي الكلي:</span>
                <span>{order.total} ج.م</span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300 my-3"></div>
            <p className="text-[10px] text-slate-500 font-bold">شكراً لطلبكم عبر UniFood • وجبتك لحد عندك</p>
          </div>
        </div>

        {/* Footer actions (Hidden in Print) */}
        <div className="p-4 border-t bg-slate-50 flex items-center justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            إغلاق
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            طباعة البون
          </button>
        </div>
      </div>
    </div>
  );
};
