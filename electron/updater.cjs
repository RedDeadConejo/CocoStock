/**
 * Actualizaciones Electron — CommonJS
 *
 * Descargas vía session.downloadURL (stack Chromium). net.request fallaba en Win7
 * con URLs largas de Storage (firmadas) pese a que el servidor respondía.
 */
const { session } = require('electron');
const { mkdir } = require('fs/promises');
const { dirname, join } = require('path');

let downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };
/** @type {import('electron').DownloadItem | null} */
let currentDownloadItem = null;
let downloadProgressTimer = null;

function getDownloadPath(userDataPath, fileName) {
  const updatesDir = join(userDataPath, 'updates');
  return join(updatesDir, fileName || 'installer.exe');
}

function clearDownloadProgressTimer() {
  if (downloadProgressTimer) {
    clearInterval(downloadProgressTimer);
    downloadProgressTimer = null;
  }
}

/**
 * @param {string} downloadUrl
 * @param {string} userDataPath
 * @param {string | null} [fileName]
 * @param {{ onProgress?: (p:number,b:number,t:number)=>void } | null} [onProgress]
 */
async function downloadUpdate(downloadUrl, userDataPath, fileName = null, onProgress = null) {
  if (currentDownloadItem) {
    try {
      currentDownloadItem.cancel();
    } catch (_) {}
    currentDownloadItem = null;
  }
  clearDownloadProgressTimer();

  downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };

  let destFileName = fileName;
  if (!destFileName) {
    try {
      const u = new URL(downloadUrl);
      const pathname = u.pathname || '';
      destFileName = pathname.split('/').filter(Boolean).pop();
    } catch (_) {}
    if (!destFileName) {
      destFileName = process.platform === 'darwin' ? 'CocoStock-mac.zip' : 'installer.exe';
    }
  }

  const destPath = getDownloadPath(userDataPath, destFileName);
  const updatesDir = dirname(destPath);

  try {
    await mkdir(updatesDir, { recursive: true });
  } catch (err) {
    return { success: false, error: 'No se pudo crear la carpeta de descargas: ' + err.message };
  }

  const sess = session.defaultSession;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const done = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      sess.removeListener('will-download', onWillDownload);
      clearDownloadProgressTimer();
      currentDownloadItem = null;
      resolve(result);
    };

    timeoutId = setTimeout(() => {
      if (!currentDownloadItem) {
        done({ success: false, error: 'Tiempo de espera al iniciar la descarga' });
      }
    }, 90000);

    const onWillDownload = (_event, item) => {
      if (settled) return;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      currentDownloadItem = item;
      item.setSavePath(destPath);

      downloadProgressTimer = setInterval(() => {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        downloadProgress.bytesDownloaded = received;
        downloadProgress.totalBytes = total;
        downloadProgress.percent = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0;
        if (onProgress && typeof onProgress.onProgress === 'function') {
          try {
            onProgress.onProgress(downloadProgress.percent, received, total);
          } catch (_) {}
        }
      }, 250);

      item.once('done', (_e, state) => {
        if (state === 'completed') {
          const received = item.getReceivedBytes();
          const total = item.getTotalBytes();
          downloadProgress.percent = 100;
          downloadProgress.bytesDownloaded = received;
          downloadProgress.totalBytes = total || received;
          if (onProgress && typeof onProgress.onProgress === 'function') {
            try {
              onProgress.onProgress(100, received, total || received);
            } catch (_) {}
          }
          done({ success: true, localPath: destPath });
          return;
        }
        const err =
          state === 'cancelled'
            ? 'Descarga cancelada'
            : state === 'interrupted'
              ? 'Descarga interrumpida'
              : `Descarga: ${state}`;
        done({ success: false, error: err });
      });
    };

    sess.once('will-download', onWillDownload);

    try {
      sess.downloadURL(downloadUrl);
    } catch (err) {
      done({ success: false, error: err.message || 'No se pudo iniciar la descarga' });
    }
  });
}

function getDownloadProgress() {
  return { ...downloadProgress };
}

function cancelDownload() {
  if (currentDownloadItem) {
    try {
      currentDownloadItem.cancel();
    } catch (_) {}
    currentDownloadItem = null;
  }
  clearDownloadProgressTimer();
}

module.exports = {
  getDownloadPath,
  downloadUpdate,
  getDownloadProgress,
  cancelDownload,
};
