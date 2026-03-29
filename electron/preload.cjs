/**
 * Preload Script para Electron
 * Expone APIs seguras desde el proceso principal al renderer
 *
 * Sin fs/path aquí: en Windows 7 + app empaquetada, leer package.json en el preload
 * podía fallar y abortar todo el script, dejando window.electronAPI indefinido (la UI creía ser navegador).
 * La clave win32-win7 la pasa el main por process.argv (--cocostock-platform=...).
 */

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

const platformKey = (() => {
  for (const a of process.argv || []) {
    if (typeof a === 'string' && a.startsWith('--cocostock-platform=')) {
      const v = a.slice('--cocostock-platform='.length).trim();
      if (v) return v;
    }
  }
  const platform = process.platform || 'win32';
  const arch = process.arch || 'x64';
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux';
  if (platform === 'win32') {
    const rel = (os.release() || '').split('.');
    const maj = parseInt(rel[0], 10);
    const min = parseInt(rel[1], 10);
    if (maj === 6 && min === 1) return 'win32-win7';
  }
  return platform;
})();

contextBridge.exposeInMainWorld('electronAPI', {
  getOsInfo: () => ipcRenderer.invoke('os:info'),
  localServer: {
    start: (serversConfig, supabaseUrl, supabaseAnonKey) =>
      ipcRenderer.invoke('local-server:start', serversConfig, supabaseUrl, supabaseAnonKey),
    stop: () => ipcRenderer.invoke('local-server:stop'),
    getStatus: () => ipcRenderer.invoke('local-server:status'),
  },
  authorizedIps: {
    get: () => ipcRenderer.invoke('authorized-ips:get'),
    save: (list) => ipcRenderer.invoke('authorized-ips:save', list),
  },
  onBeforeQuit: (callback) => {
    ipcRenderer.on('app-before-quit', (event, tokens) => {
      Promise.resolve(callback(tokens))
        .then(() => ipcRenderer.send('app-before-quit-done'))
        .catch(() => ipcRenderer.send('app-before-quit-done'));
    });
  },
  updater: {
    download: (downloadUrl, fileName) => ipcRenderer.invoke('updater:download', downloadUrl, fileName),
    getProgress: () => ipcRenderer.invoke('updater:get-progress'),
    cancelDownload: () => ipcRenderer.invoke('updater:cancel-download'),
    openInstaller: (localPath) => ipcRenderer.invoke('updater:open-installer', localPath),
  },
  deviceSession: {
    restore: () => ipcRenderer.invoke('device-session:restore'),
    save: (session) => ipcRenderer.invoke('device-session:save', session),
    touch: () => ipcRenderer.invoke('device-session:touch'),
    clear: () => ipcRenderer.invoke('device-session:clear'),
    getFingerprint: () => ipcRenderer.invoke('device-session:get-fingerprint'),
  },
  platform: platformKey,
});
