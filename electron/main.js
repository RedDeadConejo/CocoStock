import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { startLocalServer, stopLocalServer, getServerStatus } from './localServer.js';
import { getAuthorizedIps, saveAuthorizedIps, getActiveAuthorizedIps } from './authorizedIpsStorage.js';
import { downloadUpdate, getDownloadProgress, cancelDownload } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mantener una referencia global del objeto window
let mainWindow;

// Tokens de servidor merma activos (para invalidar al cerrar la app)
let storedMermaTokens = [];

function createWindow() {
  // Crear la ventana del navegador
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
      preload: join(__dirname, 'preload.cjs'),
    },
    icon: join(__dirname, '../public/logo.png'), // Icono de la app
    show: false, // No mostrar hasta que esté listo
  });

  // Cargar la aplicación
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // En desarrollo, cargar desde el servidor de Vite
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // En producción, cargar desde los archivos construidos.
    // En macOS el .app usa rutas distintas; file:// evita ventana en negro.
    const indexPath = join(__dirname, '../dist/index.html');
    if (existsSync(indexPath)) {
      if (process.platform === 'darwin') {
        mainWindow.loadURL(pathToFileURL(indexPath).href);
      } else {
        mainWindow.loadFile(indexPath);
      }
    } else {
      console.error('No se encontró el archivo index.html en dist/', indexPath);
    }
  }

  // Mostrar la ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Enfocar la ventana
    if (isDev) {
      mainWindow.focus();
    }
  });

  // Abrir DevTools en desarrollo
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Emitido cuando la ventana es cerrada
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Este método se ejecutará cuando Electron haya terminado de inicializarse
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // En macOS es común recrear una ventana cuando se hace clic en el icono
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Manejar errores de carga
app.on('web-contents-created', (event, contents) => {
  contents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Error al cargar:', errorCode, errorDescription);
  });
});

// IPC Handlers para IPs autorizadas (almacenamiento local cifrado)
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

// IPC Handlers para el servidor local (varios servidores: merma, app completa, etc.)
ipcMain.handle('local-server:start', async (event, serversConfig = [], supabaseUrl = null, supabaseAnonKey = null) => {
  try {
    const userDataPath = app.getPath('userData');
    const authorizedIpsList = getActiveAuthorizedIps(userDataPath);
    const result = await startLocalServer(serversConfig, supabaseUrl, supabaseAnonKey, authorizedIpsList);
    if (result.success && Array.isArray(serversConfig)) {
      storedMermaTokens = serversConfig
        .filter((c) => c.mode === 'merma' && c.token)
        .map((c) => c.token);
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

// IPC Handlers para actualizaciones (descarga desde Supabase Storage u otra URL)
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

// Detener el servidor e invalidar tokens de merma cuando la aplicación se cierra
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
      mainWindow.webContents.executeJavaScript(`
        if (window.localStorage) {
          const keys = Object.keys(window.localStorage);
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
              window.localStorage.removeItem(key);
            }
          });
        }
        if (window.sessionStorage) {
          const keys = Object.keys(window.sessionStorage);
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase') || key === 'merma_local_access' || key === 'merma_session_id' || key === 'merma_token' || key === 'merma_restaurant_id' || key === 'merma_restaurant_name') {
              window.sessionStorage.removeItem(key);
            }
          });
        }
      `).catch(err => {
        console.error('Error al limpiar sesión:', err);
      });
    } catch (err) {
      console.error('Error al notificar cierre de sesión:', err);
    }
  }
});

