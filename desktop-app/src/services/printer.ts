/**
 * UniFood Thermal Printing Service
 * Handles thermal receipt generation, silent printing without dialogs,
 * system printer detection, and automated printing on order arrival.
 */

export interface DetectedPrinter {
  name: string;
  isDefault: boolean;
  displayName?: string;
  portName?: string;
}

export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).process?.type ||
    (window as any).electron ||
    navigator.userAgent.toLowerCase().includes('electron') ||
    typeof (window as any).require === 'function'
  );
};

export const getElectronIpc = () => {
  if (typeof window !== 'undefined' && typeof (window as any).require === 'function') {
    try {
      return (window as any).require('electron').ipcRenderer;
    } catch (_e) {}
  }
  return null;
};

// 1. استعلام الطابعات المتعرف عليها من نظام التشغيل
export const fetchSystemPrinters = async (): Promise<DetectedPrinter[]> => {
  // أولاً: فحص الطابعات عبر Electron إن كان التطبيق يعمل كـ Desktop App
  const ipc = getElectronIpc();
  if (ipc) {
    try {
      const printers = await ipc.invoke('get-system-printers');
      if (Array.isArray(printers) && printers.length > 0) {
        return printers;
      }
    } catch (e) {
      console.warn('Electron get-system-printers error:', e);
    }
  }

  // ثانياً: فحص الطابعات عبر سيرفر الـ Backend إن كان يعمل محلياً على جهاز الكاشير
  try {
    const { api } = await import('./api');
    const printers = await api.getSystemPrinters();
    if (Array.isArray(printers) && printers.length > 0) {
      return printers;
    }
  } catch (_e) {}

  return [];
};

// 2. إعدادات الطباعة التلقائية والصامتة
export const getAutoPrintOnNewOrder = (): boolean => {
  const val = localStorage.getItem('unifood_autoprint_new_order');
  return val === null ? true : val === 'true';
};

export const setAutoPrintOnNewOrder = (enabled: boolean): void => {
  localStorage.setItem('unifood_autoprint_new_order', enabled ? 'true' : 'false');
};

export const getAutoPrintOnAccept = (): boolean => {
  const val = localStorage.getItem('unifood_autoprint_on_accept');
  return val === null ? true : val === 'true';
};

export const setAutoPrintOnAccept = (enabled: boolean): void => {
  localStorage.setItem('unifood_autoprint_on_accept', enabled ? 'true' : 'false');
};

export const getAutoPrintEnabled = (): boolean => {
  return getAutoPrintOnAccept();
};

export const setAutoPrintEnabled = (enabled: boolean): void => {
  setAutoPrintOnAccept(enabled);
};

export const getSilentPrintEnabled = (): boolean => {
  const val = localStorage.getItem('unifood_silent_print');
  return val === null ? true : val === 'true';
};

export const setSilentPrintEnabled = (enabled: boolean): void => {
  localStorage.setItem('unifood_silent_print', enabled ? 'true' : 'false');
};

export const getPreferredPrinter = (): string => {
  return localStorage.getItem('unifood_printer_name') || '';
};

export const setPreferredPrinter = (name: string): void => {
  localStorage.setItem('unifood_printer_name', name);
};

export const getReceiptPaperWidth = (): '80mm' | '58mm' => {
  return (localStorage.getItem('unifood_receipt_width') as '80mm' | '58mm') || '80mm';
};

export const setReceiptPaperWidth = (width: '80mm' | '58mm'): void => {
  localStorage.setItem('unifood_receipt_width', width);
};

export const generateReceiptHtml = (order: any, branchName: string, paperWidth: '80mm' | '58mm' = '80mm'): string => {
  const formattedDate = new Date(order.createdAt || Date.now()).toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const is58 = paperWidth === '58mm';
  const pageWidth = is58 ? '58mm' : '80mm';
  const bodyWidth = is58 ? '50mm' : '72mm';
  const fontSize = is58 ? '11px' : '12px';
  const titleSize = is58 ? '15px' : '18px';

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
      ? `<div style="font-size: 10px; color: #555; padding-right: 8px; margin-top: 2px;">+ ${modifiersList.map((m: any) => `${m.optionName} (${m.price} ج.م)`).join('، ')}</div>`
      : '';
    return `
      <div style="border-bottom: 1px dotted #ccc; padding: 5px 0;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58 ? '12px' : '13px'};">
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
            margin: 2mm;
            size: ${pageWidth} auto;
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
            font-size: ${fontSize};
            line-height: 1.4;
            width: ${bodyWidth};
            margin: 0 auto;
            padding: 6px 2px;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .font-bold { font-weight: 700; }
          .font-black { font-weight: 900; }
          .dashed {
            border-bottom: 1px dashed #777;
            margin: 6px 0;
          }
          .solid {
            border-bottom: 1.5px solid #000;
            margin: 6px 0;
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
            padding: 6px;
            margin: 6px 0;
            text-align: right;
            font-size: 11px;
          }
          .customer-card div {
            margin-bottom: 2px;
          }
          .customer-card div:last-child {
            margin-bottom: 0;
          }
        </style>
      </head>
      <body>
        <div class="center">
          <div style="font-size: 10px; font-weight: 800; color: #333; letter-spacing: 1px;">UNIFOOD • يونيفود</div>
          <div style="font-size: ${titleSize}; font-weight: 900; margin: 3px 0;">${branchName}</div>
          <div style="font-size: 10px; color: #666;">منظومة توصيل طلبات الحرم الجامعي</div>
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
            ${order.notes ? `<div style="color: #b45309; margin-top: 3px;"><strong>ملاحظات:</strong> ${order.notes}</div>` : ''}
          </div>

          <div class="solid"></div>

          <div style="width: 100%; text-align: right;">
            <div class="row font-bold" style="border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 11px;">
              <span>الصنف / التفاصيل</span>
              <span>المبلغ</span>
            </div>
            ${itemsHtml}
          </div>

          <div class="dashed"></div>

          <div style="margin: 5px 0;">
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
            <div class="row font-black" style="border-top: 1.5px solid #000; padding-top: 5px; margin-top: 5px; font-size: 14px;">
              <span>الإجمالي المطلوب:</span>
              <span>${order.total || 0} ج.م</span>
            </div>
          </div>

          <div class="dashed"></div>
          <div style="font-size: 10px; color: #444; font-weight: bold; margin-top: 6px;">
            شكراً لطلبكم عبر UniFood • وجبتك لحد عندك 🎓
          </div>
        </div>
      </body>
    </html>
  `;
};

// تنفيذ أمر الطباعة المباشرة الصامتة
export const printOrderReceipt = async (order: any, branchName: string): Promise<boolean> => {
  const paperWidth = getReceiptPaperWidth();
  const html = generateReceiptHtml(order, branchName, paperWidth);
  const preferredPrinter = getPreferredPrinter();
  const isSilent = getSilentPrintEnabled();

  // 1. إذا كان التطبيق يعمل داخل Electron: الطباعة الصامتة المباشرة بالخلفية بدون أي نوافذ
  const ipc = getElectronIpc();
  if (ipc && isSilent) {
    try {
      const res = await ipc.invoke('print-receipt-silent', {
        html,
        deviceName: preferredPrinter && preferredPrinter !== 'DEFAULT' ? preferredPrinter : undefined
      });
      if (res && res.success) {
        return true;
      }
    } catch (err) {
      console.warn('Electron silent print failed, fallback to iframe:', err);
    }
  }

  // 2. إذا كان يعمل داخل المتصفح (Chrome / Edge)
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
      }, 300);
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
    notes: 'بون فحص وتجربة الطابعة الحرارية الصامتة',
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

// دالة لتوليد وتحميل ملف تشغيل المتصفح بوضع الطباعة الصامتة الفورية (Kiosk Printing)
export const downloadKioskPrintingShortcut = (appUrl: string = window.location.href) => {
  const batContent = `@echo off
chcp 65001 > nul
title تشغيل كاشير UniFood بالطباعة الصامتة
echo جاري تشغيل شاشة المطعم بوضع الطباعة الحرارية الصامتة...

:: محاولة فتح مايكروسوفت إيدج أولاً
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start msedge --app="${appUrl}" --kiosk-printing
    exit
)

:: إن لم يتوفر إيدج، فتح جوجل كروم
where chrome >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start chrome --app="${appUrl}" --kiosk-printing
    exit
)

:: المتصفح الافتراضي
start "" "${appUrl}"
exit
`;

  const blob = new Blob([batContent], { type: 'application/x-bat' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'UniFood-POS-SilentPrint.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
