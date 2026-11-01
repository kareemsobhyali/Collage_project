const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

let mainWindow;

function checkUrl(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const client = u.protocol === 'https:' ? https : http;
      const req = client.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname,
        method: 'HEAD',
        timeout: 2500,
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

async function getRemoteTargetUrl() {
  const GITHUB_CONFIG = 'https://raw.githubusercontent.com/kareemsobhyali/Collage_project/main/server-config.json';
  
  // 1. محاولة جلب أحدث عنوان سيرفر من GitHub لحظياً
  const remoteWebUrl = await new Promise((resolve) => {
    try {
      https.get(GITHUB_CONFIG, { timeout: 2500 }, (res) => {
        if (res.statusCode !== 200) return resolve(null);
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(parsed.webUrl || null);
          } catch (_e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    } catch (_e) {
      resolve(null);
    }
  });

  if (remoteWebUrl) {
    return remoteWebUrl.replace(/\/+$/, '') + '/branch/';
  }

  // 2. قراءة الملف المحلي في الحزمة
  try {
    const localCandidates = [
      path.join(__dirname, '../public/server-config.json'),
      path.join(__dirname, '../dist/server-config.json'),
      path.join(__dirname, '../../server-config.json'),
    ];
    for (const p of localCandidates) {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data && data.webUrl) {
          return data.webUrl.replace(/\/+$/, '') + '/branch/';
        }
      }
    }
  } catch (_e) {}

  return 'https://unifood.store/branch/';
}

async function loadBestUrl() {
  if (!mainWindow) return;

  // أ. إذا كان التطبيق في بيئة التطوير المحلية للمبرمج
  if (!app.isPackaged) {
    const devUrl = 'http://localhost:5173';
    if (await checkUrl(devUrl)) {
      console.log('[Electron Dev] Connected to Vite dev server:', devUrl);
      return mainWindow.loadURL(devUrl).catch(() => {});
    }

    const localBackendUrl = 'http://localhost:5000/branch/';
    if (await checkUrl(localBackendUrl)) {
      console.log('[Electron Dev] Connected to local backend server:', localBackendUrl);
      return mainWindow.loadURL(localBackendUrl).catch(() => {});
    }
  }

  // ب. الاتصال المباشر بالسيرفر السحابي الحي (Live Cloud URL) لتلقي كافة التحديثات لحظياً دون الحاجة لتحديث الـ EXE
  try {
    const liveRemoteUrl = await getRemoteTargetUrl();
    console.log('[Electron] Checking live cloud URL for instant updates:', liveRemoteUrl);
    if (await checkUrl(liveRemoteUrl)) {
      console.log('[Electron] Successfully connected to live cloud app:', liveRemoteUrl);
      return mainWindow.loadURL(liveRemoteUrl).catch((err) => {
        console.error('[Electron] Failed to load remote URL, falling back to local bundle:', err);
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      });
    }
  } catch (err) {
    console.error('[Electron] Error while connecting to live cloud server:', err);
  }

  // ج. إذا كان العميل أوفلاين أو تعذر الوصول للسيرفر السحابي، يتم تحميل النسخة المجمعة محلياً
  console.log('[Electron] Cloud unreachable or offline, loading local bundle dist/index.html');
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
