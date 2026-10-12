const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'نظام مطاعم الجامعة - لوحة الفرع واستقبال الطلبات',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const devUrl = 'http://localhost:5173';
  mainWindow.loadURL(devUrl).catch(() => {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// معالج أمر الطباعة الحرارية المباشر
ipcMain.on('print-receipt', (event) => {
  if (mainWindow) {
    mainWindow.webContents.print({
      silent: false,
      printBackground: true,
    }, (success, failureReason) => {
      event.reply('print-result', { success, failureReason });
    });
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
