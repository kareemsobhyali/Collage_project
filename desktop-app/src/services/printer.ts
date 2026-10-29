/**
 * UniFood Thermal Printing Service
 * Handles thermal receipt generation, silent printing without dialogs,
 * system printer detection, and automated printing on order arrival.
 */

import { api } from './api';
import { getDisplayAddress } from '../utils/address';

export interface DetectedPrinter {
  name: string;
  isDefault: boolean;
  displayName?: string;
  portName?: string;
}

export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).electronAPI?.isElectron ||
    (window as any).process?.type ||
    (window as any).electron ||
    navigator.userAgent.toLowerCase().includes('electron') ||
    typeof (window as any).require === 'function'
  );
};

export const getElectronIpc = () => {
  if (typeof window !== 'undefined') {
    if ((window as any).electronAPI && typeof (window as any).electronAPI.invoke === 'function') {
      return (window as any).electronAPI;
    }
    if (typeof (window as any).require === 'function') {
      try {
        return (window as any).require('electron').ipcRenderer;
      } catch (_e) {}
    }
  }
  return null;
};

const escapeHtml = (val: unknown): string => {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  return val === 'true'; // الافتراضي false: لا يطبع قبل مراجعة وقبول الكاشير للطلب
};

export const setAutoPrintOnNewOrder = (enabled: boolean): void => {
  localStorage.setItem('unifood_autoprint_new_order', enabled ? 'true' : 'false');
};

export const getAutoPrintOnAccept = (): boolean => {
  const val = localStorage.getItem('unifood_autoprint_on_accept');
  return val === null ? true : val === 'true'; // الافتراضي true: طباعة البون فورياً عند قبول وبدء تجهيز الطلب
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
  const formattedDate = escapeHtml(new Date(order.createdAt || Date.now()).toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  }));

  const is58 = paperWidth === '58mm';
  // عرض آمن جداً لمنع قص الأرقام والأسعار من الحافة اليسرى لورق الطابعة
  const bodyWidth = is58 ? '46mm' : '62mm';
  const fontSize = is58 ? '11px' : '12px';
  const titleSize = is58 ? '16px' : '19px';

  const safeBranchName = escapeHtml(branchName);
  const safeOrderNumber = escapeHtml(order.orderNumber || '—');

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
      ? `<div style="font-size: 11px; font-weight: 700; color: #000; padding-right: 8px; margin-top: 2px;">+ ${modifiersList.map((m: any) => `${escapeHtml(m.optionName)} (${escapeHtml(m.price)} ج.م)`).join('، ')}</div>`
      : '';
    return `
      <div style="border-bottom: 1px dashed #000; padding: 5px 0;">
        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: ${is58 ? '12px' : '13px'}; color: #000;">
          <span style="text-align: right;">${escapeHtml(item.quantity)} × ${escapeHtml(item.itemName)} ${item.sizeName ? `(${escapeHtml(item.sizeName)})` : ''}</span>
          <span style="direction: ltr; font-weight: 900; padding-left: 4px; white-space: nowrap;">${escapeHtml(item.totalPrice)} ج.م</span>
        </div>
        ${modsText}
      </div>
    `;
  }).join('');

  const isDirectTransferOnDelivery = (order.paymentMethod === 'VODAFONE_CASH' || order.paymentMethod === 'INSTAPAY') && !order.paymentProofUrl && !order.paymentSenderPhone;
  const paymentLabel = escapeHtml(
    order.paymentMethod === 'CASH' ? 'كاش عند الاستلام' :
    order.paymentMethod === 'VODAFONE_CASH' ? (isDirectTransferOnDelivery ? 'محفظة كاش (عند الاستلام)' : 'محفظة كاش') :
    order.paymentMethod === 'INSTAPAY' ? (isDirectTransferOnDelivery ? 'إنستاباي (عند الاستلام)' : 'إنستاباي') :
    order.paymentMethod === 'CARD' ? 'بطاقة دفع' : (order.paymentMethod || 'نقدي')
  );

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>بون طلب #${safeOrderNumber} - ${safeBranchName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap');
          @page {
            margin: 0 !important;
            size: auto;
          }
          * {
            box-sizing: border-box !important;
            margin: 0;
            padding: 0;
            color: #000000 !important; /* أسود داكن نقي لمنع أي بهتان في رؤوس الطابعات الحرارية */
          }
          body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: rtl;
            color: #000000 !important;
            background: #ffffff !important;
            font-size: ${fontSize};
            font-weight: 700;
            line-height: 1.35;
            width: ${bodyWidth} !important;
            max-width: ${bodyWidth} !important;
            margin: 0 auto !important;
            padding: 4px 2px 8px 6px !important; /* هامش أمان إضافي في اليسار 6mm لمنع قص الأرقام */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .font-bold { font-weight: 800; }
          .font-black { font-weight: 900; }
          .dashed {
            border-bottom: 1.5px dashed #000000;
            margin: 5px 0;
          }
          .solid {
            border-bottom: 2px solid #000000;
            margin: 5px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 3px 0;
            padding: 0 1px;
          }
          .price-val {
            direction: ltr;
            text-align: left;
            font-weight: 900;
            padding-left: 4px;
            white-space: nowrap;
          }
          .customer-card {
            background: #ffffff;
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 5px;
            margin: 5px 0;
            text-align: right;
            font-size: 11px;
            font-weight: 800;
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
          <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px;">UNIFOOD • منصة طلب وتوصيل الوجبات</div>
          <div style="font-size: ${titleSize}; font-weight: 900; margin: 2px 0;">${safeBranchName}</div>
          <div style="font-size: 11px; font-weight: 800;">منظومة طلب وتوصيل وجبات المطاعم</div>
          <div class="dashed"></div>

          <div class="row">
            <span class="font-bold">رقم الطلب:</span>
            <span class="price-val" style="font-size: 17px; font-weight: 900;">#${safeOrderNumber}</span>
          </div>
          <div class="row">
            <span>الوقت:</span>
            <span style="font-size: 11px; font-weight: 800;">${formattedDate}</span>
          </div>
          <div class="row">
            <span>نوع الطلب:</span>
            <span class="font-bold">${order.orderType === 'DELIVERY' ? 'توصيل للعنوان' : 'استلام من الفرع'}</span>
          </div>
          <div class="row">
            <span>طريقة الدفع:</span>
            <span class="font-bold">${paymentLabel}</span>
          </div>
          ${order.estimatedMinutes ? `
          <div class="row" style="font-weight: 900;">
            <span>الوقت المقدر:</span>
            <span>${escapeHtml(order.estimatedMinutes)} دقيقة</span>
          </div>` : ''}

          <div class="customer-card">
            <div><strong>العميل:</strong> ${escapeHtml(order.customerName || 'عميل')}</div>
            <div><strong>الهاتف:</strong> ${escapeHtml(order.customerPhone || '—')}</div>
            ${order.orderType === 'DELIVERY' && order.deliveryZoneName ? `<div><strong>منطقة التوصيل:</strong> ${escapeHtml(order.deliveryZoneName)}</div>` : ''}
            ${order.orderType === 'DELIVERY' && order.addressText ? `<div><strong>العنوان:</strong> ${escapeHtml(getDisplayAddress(order.addressText, 'مقر العميل'))}</div>` : ''}
            ${order.paymentSenderPhone ? `<div><strong>رقم المحول منه:</strong> ${escapeHtml(order.paymentSenderPhone)}</div>` : ''}
            ${(order.notes || order.orderNotes) ? `<div style="font-weight: 900; margin-top: 2px;"><strong>ملاحظات:</strong> ${escapeHtml(order.notes || order.orderNotes)}</div>` : ''}
          </div>

          <div class="solid"></div>

          <div style="width: 100%; text-align: right;">
            <div class="row font-bold" style="border-bottom: 1.5px solid #000; padding-bottom: 3px; font-size: 12px;">
              <span>الصنف / التفاصيل</span>
              <span class="price-val">المبلغ</span>
            </div>
            ${itemsHtml}
            ${(order.notes || order.orderNotes) ? `
            <div style="margin-top: 5px; padding: 4px; border: 1.5px solid #000; border-radius: 4px; font-size: 11px; font-weight: 900; background: #fff;">
              <strong>ملاحظات العميل:</strong> ${escapeHtml(order.notes || order.orderNotes)}
            </div>` : ''}
          </div>

          <div class="dashed"></div>

          <div style="margin: 4px 0;">
            <div class="row">
              <span>المجموع الفرعي:</span>
              <span class="price-val">${escapeHtml(order.subtotal || 0)} ج.م</span>
            </div>
            ${order.orderType === 'DELIVERY' ? `
            <div class="row">
              <span>رسوم التوصيل:</span>
              <span class="price-val">${escapeHtml(order.deliveryFee || 0)} ج.م</span>
            </div>` : ''}
            ${order.discount && order.discount > 0 ? `
            <div class="row" style="font-weight: 900;">
              <span>خصم الكوبون${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ''}:</span>
              <span class="price-val">-${escapeHtml(order.discount)} ج.م</span>
            </div>` : ''}
            ${order.walletDiscount && order.walletDiscount > 0 ? `
            <div class="row" style="font-weight: 900;">
              <span>خصم المحفظة:</span>
              <span class="price-val">-${escapeHtml(order.walletDiscount)} ج.م</span>
            </div>` : ''}
            <div class="row font-black" style="border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; font-size: 15px;">
              <span>الإجمالي المطلوب:</span>
              <span class="price-val" style="font-size: 16px;">${escapeHtml(order.total || 0)} ج.م</span>
            </div>
          </div>

          <div class="dashed"></div>
          <div style="font-size: 11px; font-weight: 800; margin-top: 4px;">
            شكراً لطلبكم عبر UniFood • وجبتك لحد عندك 🚀
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
      iframe.style.width = '100px';
      iframe.style.height = '100px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
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

      let printed = false;
      const triggerPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print call error:', e);
        }
      };

      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = () => {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 300);
          resolve(true);
        };

        iframe.contentWindow.onload = () => {
          setTimeout(triggerPrint, 150);
        };
      }

      // مهلة احتياطية في حال لم يُطلق المتصفح onload
      setTimeout(triggerPrint, 450);

      // مهلة أمان قصوى لتنظيف الـ DOM وحل الـ Promise
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        resolve(true);
      }, 10000);
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
    customerName: 'عميل تجريبي',
    customerPhone: '01012345678',
    addressText: 'شارع النصر - عمارة 4 - الدور الثاني',
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
  let safeUrl = 'http://localhost:5000/branch/';
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      safeUrl = parsed.href.replace(/["%&|<>^`\r\n]/g, '');
    }
  } catch (_e) {}

  const batContent = `@echo off
chcp 65001 > nul
title تشغيل كاشير UniFood بالطباعة الصامتة
echo ======================================================================
echo    UniFood POS - تشغيل شاشة الكاشير بالطباعة الحرارية التلقائية الصامتة
echo ======================================================================

set PROFILE_DIR="%LOCALAPPDATA%\\UniFoodPOSProfile"

:: التحقق من وجود مسار جوجل كروم
if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir=%PROFILE_DIR% --kiosk-printing --app="${safeUrl}"
    exit
)

if exist "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir=%PROFILE_DIR% --kiosk-printing --app="${safeUrl}"
    exit
)

if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir=%PROFILE_DIR% --kiosk-printing --app="${safeUrl}"
    exit
)

:: إن لم يتوفر كروم، استخدام إيدج
if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --user-data-dir=%PROFILE_DIR% --kiosk-printing --app="${safeUrl}"
    exit
)

start chrome --user-data-dir=%PROFILE_DIR% --kiosk-printing --app="${safeUrl}"
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
