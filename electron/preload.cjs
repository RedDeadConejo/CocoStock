/**
 * Preload Script para Electron
 * Expone APIs seguras desde el proceso principal al renderer
 * 
 * NOTA: Este archivo debe usar CommonJS (require) porque Electron
 * no puede ejecutar ES modules directamente en el contexto del preload
 * El sufijo .cjs indica explícitamente que es CommonJS
 */

const { contextBridge, ipcRenderer } = require('electron');

// Plataforma para actualizaciones: win32, darwin-x64, darwin-arm64, linux, linux-arm64
const platform = process.platform || 'win32';
const arch = process.arch || 'x64';
const platformKey = (() => {
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux';
  return platform; // win32, etc.
})();

// Exponer APIs protegidas al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // APIs del servidor local (varios servidores: merma, app completa, etc.)
  localServer: {
    start: (serversConfig, supabaseUrl, supabaseAnonKey) =>
      ipcRenderer.invoke('local-server:start', serversConfig, supabaseUrl, supabaseAnonKey),
    stop: () => ipcRenderer.invoke('local-server:stop'),
    getStatus: () => ipcRenderer.invoke('local-server:status'),
  },
  // IPs autorizadas (almacenamiento local cifrado, solo en Electron)
  authorizedIps: {
    get: () => ipcRenderer.invoke('authorized-ips:get'),
    save: (list) => ipcRenderer.invoke('authorized-ips:save', list),
  },
  // Al cerrar la app: invalida tokens de merma (callback recibe array de tokens, debe devolver Promise)
  onBeforeQuit: (callback) => {
    ipcRenderer.on('app-before-quit', (event, tokens) => {
      Promise.resolve(callback(tokens))
        .then(() => ipcRenderer.send('app-before-quit-done'))
        .catch(() => ipcRenderer.send('app-before-quit-done'));
    });
  },
  // Actualizaciones: descarga desde URL (ej. Supabase Storage) y abrir instalador
  updater: {
    download: (downloadUrl, fileName) => ipcRenderer.invoke('updater:download', downloadUrl, fileName),
    getProgress: () => ipcRenderer.invoke('updater:get-progress'),
    cancelDownload: () => ipcRenderer.invoke('updater:cancel-download'),
    openInstaller: (localPath) => ipcRenderer.invoke('updater:open-installer', localPath),
  },
  platform: platformKey,
});

