const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    fullscreen: true,
    title: 'نظام مطاعم الجامعة - لوحة الفرع واستقبال الطلبات',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.maximize();
  mainWindow.setFullScreen(true);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // إلغاء القائمة المنبثقة للزر الأيمن للفأرة (Disable right-click context menu)
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // حماية من استغلال منفذ التطوير المحلي في بيئة الإنتاج
  if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    const devUrl = 'http://localhost:5173';
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
      console.error('Failed to load local index.html:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 1. جلب قائمة الطابعات المتعرف عليها على الجهاز
ipcMain.handle('get-system-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: Boolean(p.isDefault),
      status: p.status
    }));
  } catch (err) {
    console.error('Failed to get printers:', err);
    return [];
  }
});

// 2. معالج أمر الطباعة الحرارية الصامتة والمباشرة
ipcMain.handle('print-receipt-silent', async (_event, { html, deviceName }) => {
  return new Promise((resolve) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          javascript: false,
        }
      });

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print({
          silent: true,
          deviceName: deviceName || undefined,
          printBackground: true,
          margins: { marginType: 'none' },
        }, (success, failureReason) => {
          try {
            printWin.close();
          } catch (_e) {}
          resolve({ success, failureReason });
        });
      });
    } catch (err) {
      resolve({ success: false, failureReason: err.message });
    }
  });
});

// معالج أمر الطباعة الحرارية المباشر
ipcMain.on('print-receipt', (event, payload = {}) => {
  if (mainWindow) {
    mainWindow.webContents.print({
      silent: typeof payload.silent === 'boolean' ? payload.silent : true,
      deviceName: payload.deviceName || undefined,
      printBackground: true,
    }, (success, failureReason) => {
      event.reply('print-result', { success, failureReason });
    });
  }
});

// 3. معالج إظهار نافذة البرنامج في الواجهة تلقائياً فوق أي برنامج آخر عند وصول طلب جديد (Auto focus & bring to front)
ipcMain.on('bring-to-front', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.focus();
    mainWindow.moveTop();
    mainWindow.flashFrame(true);
    // إبقاء النافذة في المقدمة لثانيتين لضمان رفعها فوق أي تطبيق آخر مفتوح على الويندوز
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    }, 2000);
  }
});

// 4. معالجات وضع ملء الشاشة (Full Screen)
ipcMain.on('set-fullscreen', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setFullScreen(Boolean(flag));
  }
});

ipcMain.on('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
