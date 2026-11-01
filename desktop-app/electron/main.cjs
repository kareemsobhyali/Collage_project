const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

function checkUrl(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'HEAD',
        timeout: 1200,
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch (_e) {
      resolve(false);
    }
  });
}

async function loadBestUrl() {
  if (!mainWindow) return;

  const backendUrl = 'http://localhost:5000/branch/';
  if (await checkUrl(backendUrl)) {
    console.log('[Electron] Connected to unified backend:', backendUrl);
    return mainWindow.loadURL(backendUrl).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  }

  const devUrl = 'http://localhost:5173';
  if (await checkUrl(devUrl)) {
    console.log('[Electron] Connected to Vite dev server:', devUrl);
    return mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  }

  console.log('[Electron] Loading local bundle dist/index.html');
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
    console.error('Failed to load local index.html:', err);
  });
}

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

  loadBestUrl();

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

// 3. معالجات إظهار نافذة البرنامج في الواجهة وتثبيتها في المقدمة وأخذ الفوكس تلقائياً (Bring to Front, Window Focus & Always on Top)
let isPinnedAlwaysOnTop = false;

function forceBringToFront(keepAlwaysOnTop = true) {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  // رفع النافذة لمستوى screen-saver لضمان قفزها فوق كافة النوافذ والألعاب والتطبيقات المفتوحة
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.moveTop();
  mainWindow.focus();
  mainWindow.webContents.focus();
  mainWindow.flashFrame(true);

  if (keepAlwaysOnTop) {
    isPinnedAlwaysOnTop = true;
    try {
      mainWindow.webContents.send('always-on-top-changed', true);
    } catch (_e) {}
  } else if (!isPinnedAlwaysOnTop) {
    // إبقاء النافذة في المقدمة لعدة ثوانٍ لضمان وصول التنبيه للكاشير
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !isPinnedAlwaysOnTop) {
        mainWindow.setAlwaysOnTop(false);
        try {
          mainWindow.webContents.send('always-on-top-changed', false);
        } catch (_e) {}
      }
    }, 4000);
  }
}

ipcMain.on('bring-to-front', () => {
  forceBringToFront(true);
});

ipcMain.on('window-focus', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
    mainWindow.webContents.focus();
  }
});

ipcMain.on('set-always-on-top', (_event, flag) => {
  if (mainWindow) {
    isPinnedAlwaysOnTop = Boolean(flag);
    mainWindow.setAlwaysOnTop(isPinnedAlwaysOnTop, 'screen-saver');
    if (isPinnedAlwaysOnTop) {
      mainWindow.moveTop();
    }
    try {
      mainWindow.webContents.send('always-on-top-changed', isPinnedAlwaysOnTop);
    } catch (_e) {}
  }
});

ipcMain.on('toggle-always-on-top', () => {
  if (mainWindow) {
    isPinnedAlwaysOnTop = !isPinnedAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isPinnedAlwaysOnTop, 'screen-saver');
    if (isPinnedAlwaysOnTop) {
      mainWindow.moveTop();
    }
    try {
      mainWindow.webContents.send('always-on-top-changed', isPinnedAlwaysOnTop);
    } catch (_e) {}
  }
});

ipcMain.handle('is-always-on-top', () => {
  return isPinnedAlwaysOnTop;
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
