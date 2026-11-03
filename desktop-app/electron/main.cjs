const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

// ضبط اسم التطبيق لتوحيد مجلد بيانات المستخدم (userData) عبر بيئة التطوير والإنتاج
app.setName('UniFood Branch POS');

let mainWindow;

// إدارة حفظ بيانات الجلسة وتسجيل الدخول للفرع بشكل دائم على نظام التشغيل
function getAuthSessionFilePath() {
  return path.join(app.getPath('userData'), 'pos-auth-session.json');
}

function readAuthSession() {
  try {
    const p = getAuthSessionFilePath();
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(content);
      if (data && data.token) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[Electron Auth] Failed to read session file:', err);
  }
  return null;
}

function writeAuthSession(sessionData) {
  try {
    const p = getAuthSessionFilePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(p, JSON.stringify(sessionData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Electron Auth] Failed to write session file:', err);
    return false;
  }
}

function clearAuthSession() {
  try {
    const p = getAuthSessionFilePath();
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
    return true;
  } catch (err) {
    console.error('[Electron Auth] Failed to clear session file:', err);
    return false;
  }
}

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

// 1. إدارة جلسة تسجيل دخول الفرع وحفظها محلياً على الويندوز
ipcMain.handle('get-saved-session', async () => {
  return readAuthSession();
});

ipcMain.handle('save-session', async (_event, sessionData) => {
  return writeAuthSession(sessionData);
});

ipcMain.handle('clear-session', async () => {
  return clearAuthSession();
});

// 2. جلب قائمة الطابعات المتعرف عليها على الجهاز
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

// 3. معالج أمر الطباعة الحرارية الصامتة والمباشرة مع دعم التراجع التلقائي للطابعة الافتراضية ونافذة الطباعة
ipcMain.handle('print-receipt-silent', async (_event, { html, deviceName, silent = true }) => {
  return new Promise((resolve) => {
    let printWin = null;
    let finished = false;

    const cleanup = () => {
      if (printWin && !printWin.isDestroyed()) {
        try {
          printWin.destroy();
        } catch (_e) {}
        printWin = null;
      }
    };

    // مهلة أمان قصوى 14 ثانية لعدم تعليق الـ Promise أبداً
    const safetyTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        resolve({ success: false, failureReason: 'انتهت مهلة استجابة الطابعة (Timeout 14s)' });
      }
    }, 14000);

    try {
      printWin = new BrowserWindow({
        show: false,
        width: 380,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          javascript: false,
        },
      });

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWin.webContents.on('did-finish-load', () => {
        // تنفيذ محاولة الطباعة
        const tryPrint = (targetDevice, isSilent, isFallback = false) => {
          if (finished || !printWin || printWin.isDestroyed()) return;

          printWin.webContents.print({
            silent: isSilent,
            deviceName: targetDevice || undefined,
            printBackground: true,
            margins: { marginType: 'none' },
          }, (success, failureReason) => {
            if (finished) return;

            if (success) {
              finished = true;
              clearTimeout(safetyTimer);
              cleanup();
              return resolve({ success: true, methodUsed: isSilent ? 'silent' : 'dialog' });
            }

            console.warn(`[Electron Print] Attempt failed (device: ${targetDevice}, silent: ${isSilent}):`, failureReason);

            // خطوة 2: إذا فشلت الطابعة المحددة، نحاول مع الطابعة الافتراضية للنظام
            if (targetDevice && !isFallback) {
              console.log('[Electron Print] Retrying with system default printer...');
              return tryPrint(undefined, isSilent, true);
            }

            // خطوة 3: إذا كانت الطباعة الصامتة مرفوضة (مثلاً طابعة PDF أو طابعة تتطلب مسار حفظ)، نفتح نافذة الطباعة العادية
            if (isSilent) {
              console.log('[Electron Print] Silent print rejected, opening system print dialog...');
              return tryPrint(undefined, false, true);
            }

            finished = true;
            clearTimeout(safetyTimer);
            cleanup();
            resolve({ success: false, failureReason: failureReason || 'فشل أمر الطباعة' });
          });
        };

        // إتاحة 150ms للمتصفح لحساب الـ CSS ورسم محتوى البون
        setTimeout(() => {
          tryPrint(deviceName || undefined, silent !== false);
        }, 150);
      });

      printWin.webContents.on('did-fail-load', (_e, code, desc) => {
        if (!finished) {
          finished = true;
          clearTimeout(safetyTimer);
          cleanup();
          resolve({ success: false, failureReason: `فشل تحميل محتوى البون: ${desc} (${code})` });
        }
      });
    } catch (err) {
      if (!finished) {
        finished = true;
        clearTimeout(safetyTimer);
        cleanup();
        resolve({ success: false, failureReason: err.message });
      }
    }
  });
});

// معالج فتح نافذة الطباعة اليدوية مباشرة لاختيار الطابعة أو الحفظ كـ PDF
ipcMain.handle('print-receipt-dialog', async (_event, { html }) => {
  return new Promise((resolve) => {
    let printWin = null;
    let finished = false;

    const cleanup = () => {
      if (printWin && !printWin.isDestroyed()) {
        try { printWin.destroy(); } catch (_e) {}
        printWin = null;
      }
    };

    const safetyTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        resolve({ success: false, failureReason: 'انتهت مهلة نافذة الطباعة' });
      }
    }, 30000);

    try {
      printWin = new BrowserWindow({
        show: false,
        width: 400,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          javascript: false,
        },
      });

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWin.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          if (finished || !printWin || printWin.isDestroyed()) return;
          printWin.webContents.print({
            silent: false,
            printBackground: true,
          }, (success, failureReason) => {
            if (finished) return;
            finished = true;
            clearTimeout(safetyTimer);
            cleanup();
            resolve({ success, failureReason });
          });
        }, 150);
      });
    } catch (err) {
      clearTimeout(safetyTimer);
      cleanup();
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
