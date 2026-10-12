/**
 * UniFood Thermal Printing Service
 * Handles thermal receipt generation, iframe printing without blank pages,
 * and printer settings (auto-print on accept & test receipts).
 */

export const getAutoPrintEnabled = (): boolean => {
  return localStorage.getItem('unifood_autoprint') === 'true';
};

export const setAutoPrintEnabled = (enabled: boolean): void => {
  localStorage.setItem('unifood_autoprint', enabled ? 'true' : 'false');
};

export const getPreferredPrinter = (): string => {
  return localStorage.getItem('unifood_printer_name') || 'الطابعة الافتراضية للنظام (Default Thermal Printer)';
};

export const setPreferredPrinter = (name: string): void => {
  localStorage.setItem('unifood_printer_name', name);
};

export const generateReceiptHtml = (order: any, branchName: string): string => {
  const formattedDate = new Date(order.createdAt || Date.now()).toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const itemsHtml = (order.items || []).map((item: any) => {
    let modifiersList: any[] = [];
    if (item.selectedModifiers) {
      try {
        modifiersList = typeof item.selectedModifiers === 'string' 
          ? JSON.parse(item.selectedModifiers) 
          : item.selectedModifiers;
      } catch (e) {}
    }
    const modsText = modifiersList && modifiersList.length > 0 
      ? `<div style="font-size: 11px; color: #555; padding-right: 12px; margin-top: 2px;">+ ${modifiersList.map((m: any) => `${m.optionName} (${m.price} ج.م)`).join('، ')}</div>`
      : '';
    return `
      <div style="border-bottom: 1px dotted #ccc; padding: 6px 0;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
          <span>${item.quantity} × ${item.itemName} ${item.sizeName ? `(${item.sizeName})` : ''}</span>
          <span>${item.totalPrice} ج.م</span>
        </div>
        ${modsText}
      </div>
    `;
  }).join('');

  const paymentLabel = 
    order.paymentMethod === 'CASH' ? 'كاش عند الاستلام' :
    order.paymentMethod === 'VODAFONE_CASH' ? 'محفظة كاش (فودافون كاش)' :
    order.paymentMethod === 'INSTAPAY' ? 'إنستاباي InstaPay' :
    order.paymentMethod === 'CARD' ? 'بطاقة دفع إلكتروني' : (order.paymentMethod || 'نقدي');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>بون طلب #${order.orderNumber || ''} - ${branchName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          @page {
            margin: 4mm;
            size: 80mm auto;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Cairo', monospace, sans-serif;
            direction: rtl;
            color: #000;
            background: #fff;
            font-size: 12px;
            line-height: 1.4;
            width: 72mm;
            margin: 0 auto;
            padding: 8px 4px;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .font-bold { font-weight: 700; }
          .font-black { font-weight: 900; }
          .dashed {
            border-bottom: 1px dashed #777;
            margin: 8px 0;
          }
          .solid {
            border-bottom: 1.5px solid #000;
            margin: 8px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 3px 0;
          }
          .customer-card {
            background: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 8px;
            margin: 8px 0;
            text-align: right;
            font-size: 12px;
          }
          .customer-card div {
            margin-bottom: 3px;
          }
          .customer-card div:last-child {
            margin-bottom: 0;
          }
        </style>
      </head>
      <body>
        <div class="center">
          <div style="font-size: 11px; font-weight: 800; color: #333; letter-spacing: 1px;">UNIFOOD • يونيفود</div>
          <div style="font-size: 18px; font-weight: 900; margin: 4px 0;">${branchName}</div>
          <div style="font-size: 11px; color: #666;">منظومة توصيل طلبات الحرم الجامعي</div>
          <div class="dashed"></div>

          <div class="row">
            <span class="font-bold">رقم الطلب:</span>
            <span class="font-black" style="font-size: 16px;">#${order.orderNumber || '—'}</span>
          </div>
          <div class="row">
            <span>الوقت:</span>
            <span>${formattedDate}</span>
          </div>
          <div class="row">
            <span>نوع الطلب:</span>
            <span class="font-bold">${order.orderType === 'DELIVERY' ? 'توصيل داخل الجامعة' : 'استلام من الفرع'}</span>
          </div>
          <div class="row">
            <span>طريقة الدفع:</span>
            <span class="font-bold">${paymentLabel}</span>
          </div>
          ${order.estimatedMinutes ? `
          <div class="row" style="color: #2563eb; font-weight: bold;">
            <span>الوقت المقدر:</span>
            <span>${order.estimatedMinutes} دقيقة</span>
          </div>` : ''}

          <div class="customer-card">
            <div><strong>العميل:</strong> ${order.customerName || 'غير مسجل'}</div>
            <div><strong>الهاتف:</strong> ${order.customerPhone || '—'}</div>
            ${order.orderType === 'DELIVERY' && order.deliveryZoneName ? `<div><strong>منطقة التوصيل:</strong> ${order.deliveryZoneName}</div>` : ''}
            ${order.orderType === 'DELIVERY' && order.addressText ? `<div><strong>العنوان:</strong> ${order.addressText}</div>` : ''}
            ${order.paymentSenderPhone ? `<div><strong>رقم المحول منه:</strong> ${order.paymentSenderPhone}</div>` : ''}
            ${order.notes ? `<div style="color: #b45309; margin-top: 4px;"><strong>ملاحظات العميل:</strong> ${order.notes}</div>` : ''}
          </div>

          <div class="solid"></div>

          <div style="width: 100%; text-align: right;">
            <div class="row font-bold" style="border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 12px;">
              <span>الصنف / التفاصيل</span>
              <span>المبلغ</span>
            </div>
            ${itemsHtml}
          </div>

          <div class="dashed"></div>

          <div style="margin: 6px 0;">
            <div class="row">
              <span>المجموع الفرعي:</span>
              <span>${order.subtotal || 0} ج.م</span>
            </div>
            ${order.orderType === 'DELIVERY' ? `
            <div class="row">
              <span>رسوم التوصيل${order.deliveryZoneName ? ` (${order.deliveryZoneName})` : ''}:</span>
              <span>${order.deliveryFee || 0} ج.م</span>
            </div>` : ''}
            ${order.discount && order.discount > 0 ? `
            <div class="row" style="color: #16a34a; font-weight: bold;">
              <span>خصم الكوبون${order.promoCode ? ` (${order.promoCode})` : ''}:</span>
              <span>-${order.discount} ج.م</span>
            </div>` : ''}
            <div class="row font-black" style="border-top: 1.5px solid #000; padding-top: 6px; margin-top: 6px; font-size: 15px;">
              <span>الإجمالي المطلوب:</span>
              <span>${order.total || 0} ج.م</span>
            </div>
          </div>

          <div class="dashed"></div>
          <div style="font-size: 11px; color: #444; font-weight: bold; margin-top: 8px;">
            شكراً لطلبكم عبر UniFood • وجبتك لحد عندك 🎓
          </div>
        </div>
      </body>
    </html>
  `;
};

export const printOrderReceipt = (order: any, branchName: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        resolve(true);
        return;
      }

      const html = generateReceiptHtml(order, branchName);
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(true);
        }, 1500);
      }, 350);
    } catch (e) {
      console.error('Print receipt error:', e);
      resolve(false);
    }
  });
};

export const printTestReceipt = (branchName: string): Promise<boolean> => {
  const dummyOrder = {
    orderNumber: 999,
    createdAt: new Date().toISOString(),
    orderType: 'DELIVERY',
    deliveryZoneName: 'مبنى كلية الهندسة (تجربة)',
    paymentMethod: 'CASH',
    customerName: 'طالب تجريبي',
    customerPhone: '01012345678',
    addressText: 'الدور الثاني - مدرج 3',
    notes: 'بون فحص وتجربة الطابعة الحرارية',
    items: [
      {
        itemName: 'برجر كلاسيك سينجل',
        quantity: 1,
        totalPrice: 85,
        sizeName: 'وسط',
        selectedModifiers: JSON.stringify([{ optionName: 'جبنة شيدر إضافية', price: 15 }])
      },
      {
        itemName: 'كانز بيبسي مثلج',
        quantity: 1,
        totalPrice: 20
      }
    ],
    subtotal: 105,
    deliveryFee: 10,
    total: 115,
  };

  return printOrderReceipt(dummyOrder, branchName);
};
