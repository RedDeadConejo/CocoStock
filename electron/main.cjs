/**
 * Punto de entrada Electron (CommonJS) — compatible Electron 22 (Win7) y Electron 33+.
 * No usar .js con "type":"module" aquí: ERR_REQUIRE_ESM / carga del main en versiones antiguas.
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { pathToFileURL } = require('url');
const { join } = require('path');
const { existsSync, readFileSync } = require('fs');
const os = require('os');

const { startLocalServer, stopLocalServer, getServerStatus } = require('./localServer.cjs');
const { getAuthorizedIps, saveAuthorizedIps, getActiveAuthorizedIps } = require('./authorizedIpsStorage.cjs');
const { downloadUpdate, getDownloadProgress, cancelDownload } = require('./updater.cjs');
const {
  restoreDeviceSession,
  saveDeviceSession,
  touchDeviceSession,
  clearDeviceSession,
} = require('./deviceSessionStorage.cjs');
const { getMachineFingerprint } = require('./machineFingerprint.cjs');

let mainWindow;
let storedMermaTokens = [];

/**
 * Clave de plataforma para el renderer (actualizaciones). Se lee en el proceso principal
 * para no usar fs en el preload: en Win7 + app empaquetada el preload podía fallar y no exponer electronAPI.
 */
function getRendererPlatformKeyForPreload() {
  const pkgRoot = app.isPackaged ? app.getAppPath() : join(__dirname, '..');
  try {
    const pkgPath = join(pkgRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (typeof pkg.cocoStockPlatform === 'string' && pkg.cocoStockPlatform.trim()) {
      return pkg.cocoStockPlatform.trim();
    }
  } catch (err) {
    console.warn('CocoStock: package.json / cocoStockPlatform:', err.message);
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
}

function createWindow() {
  const platformKeyForPreload = getRendererPlatformKeyForPreload();
  const preloadPath = app.isPackaged
    ? join(app.getAppPath(), 'electron', 'preload.cjs')
    : join(__dirname, 'preload.cjs');
  const indexPathProd = app.isPackaged
    ? join(app.getAppPath(), 'dist', 'index.html')
    : join(__dirname, '../dist/index.html');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      sandbox: false,
      additionalArguments: [`--cocostock-platform=${platformKeyForPreload}`],
      preload: preloadPath,
    },
    icon: join(__dirname, '../public/logo.png'),
    show: false,
  });

  mainWindow.webContents.on('preload-error', (event, preloadPathArg, error) => {
    console.error('CocoStock preload-error:', preloadPathArg, error);
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    if (existsSync(indexPathProd)) {
      if (process.platform === 'darwin') {
        mainWindow.loadURL(pathToFileURL(indexPathProd).href);
      } else {
        mainWindow.loadFile(indexPathProd);
      }
    } else {
      console.error('No se encontró index.html en dist:', indexPathProd);
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.focus();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('did-fail-load', (ev, errorCode, errorDescription) => {
    console.error('Error al cargar:', errorCode, errorDescription);
  });
});

ipcMain.handle('os:info', () => ({
  platform: process.platform,
  release: os.release(),
  arch: process.arch,
  updaterKey: getRendererPlatformKeyForPreload(),
}));

ipcMain.handle('authorized-ips:get', async () => {
  try {
    const userDataPath = app.getPath('userData');
    return getAuthorizedIps(userDataPath);
  } catch (error) {
    console.error('Error al leer IPs autorizadas:', error);
    return [];
  }
});

ipcMain.handle('authorized-ips:save', async (event, list = []) => {
  try {
    const userDataPath = app.getPath('userData');
    saveAuthorizedIps(userDataPath, list);
    return { success: true };
  } catch (error) {
    console.error('Error al guardar IPs autorizadas:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('local-server:start', async (event, serversConfig = [], supabaseUrl = null, supabaseAnonKey = null) => {
  try {
    const userDataPath = app.getPath('userData');
    const authorizedIpsList = getActiveAuthorizedIps(userDataPath);
    const result = await startLocalServer(serversConfig, supabaseUrl, supabaseAnonKey, authorizedIpsList);
    if (result.success && Array.isArray(serversConfig)) {
      const batch = serversConfig
        .filter((c) => c.mode === 'merma' && c.token)
        .map((c) => c.token);
      storedMermaTokens = [...storedMermaTokens, ...batch];
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Error desconocido',
    };
  }
});

ipcMain.handle('local-server:stop', async () => {
  try {
    storedMermaTokens = [];
    await stopLocalServer();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Error desconocido',
    };
  }
});

ipcMain.handle('local-server:status', async () => {
  return getServerStatus();
});

ipcMain.handle('device-session:restore', async () => {
  try {
    return restoreDeviceSession(app.getPath('userData'));
  } catch (err) {
    console.error('device-session:restore', err);
    return { ok: false, reason: 'error' };
  }
});

ipcMain.handle('device-session:save', async (event, session) => {
  try {
    if (!session || typeof session !== 'object' || !session.refresh_token) {
      return { success: false };
    }
    saveDeviceSession(app.getPath('userData'), session);
    return { success: true };
  } catch (err) {
    console.error('device-session:save', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('device-session:touch', async () => {
  try {
    return { success: touchDeviceSession(app.getPath('userData')) };
  } catch {
    return { success: false };
  }
});

ipcMain.handle('device-session:clear', async () => {
  try {
    clearDeviceSession(app.getPath('userData'));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('device-session:get-fingerprint', () => {
  try {
    return { fingerprint: getMachineFingerprint() };
  } catch (err) {
    return { fingerprint: null, error: err.message };
  }
});

ipcMain.handle('updater:download', async (event, downloadUrl, fileName = null) => {
  try {
    const userDataPath = app.getPath('userData');
    const result = await downloadUpdate(downloadUrl, userDataPath, fileName);
    return result;
  } catch (error) {
    return { success: false, error: error.message || 'Error al descargar' };
  }
});

ipcMain.handle('updater:get-progress', async () => {
  return getDownloadProgress();
});

ipcMain.handle('updater:cancel-download', async () => {
  cancelDownload();
  return { success: true };
});

ipcMain.handle('updater:open-installer', async (event, localPath) => {
  try {
    if (!localPath || typeof localPath !== 'string') {
      return { success: false, error: 'Ruta no válida' };
    }
    await shell.openPath(localPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Error al abrir el instalador' };
  }
});

app.on('before-quit', async (event) => {
  await stopLocalServer();

  if (storedMermaTokens.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    event.preventDefault();
    mainWindow.webContents.send('app-before-quit', storedMermaTokens);
    ipcMain.once('app-before-quit-done', () => {
      storedMermaTokens = [];
      app.quit();
    });
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      // No borrar sb-/supabase en localStorage: la sesión de escritorio persiste (device_session.enc).
      mainWindow.webContents.executeJavaScript(`
        if (window.sessionStorage) {
          const keys = Object.keys(window.sessionStorage);
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase') || key === 'merma_local_access' || key === 'merma_session_id' || key === 'merma_token' || key === 'merma_restaurant_id' || key === 'merma_restaurant_name') {
              window.sessionStorage.removeItem(key);
            }
          });
        }
      `).catch((err) => {
        console.error('Error al limpiar sesión:', err);
      });
    } catch (err) {
      console.error('Error al notificar cierre de sesión:', err);
    }
  }
});
