const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_INVOKE_CHANNELS = ['get-system-printers', 'print-receipt-silent', 'is-always-on-top'];
const ALLOWED_SEND_CHANNELS = [
  'print-receipt',
  'bring-to-front',
  'window-focus',
  'set-always-on-top',
  'toggle-always-on-top',
  'set-fullscreen',
  'toggle-fullscreen'
];
const ALLOWED_RECEIVE_CHANNELS = ['print-result', 'always-on-top-changed'];

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  invoke: (channel, data) => {
    if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  send: (channel, data) => {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, callback) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel) && typeof callback === 'function') {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },
});
