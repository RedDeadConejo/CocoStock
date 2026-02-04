/**
 * Módulo de actualizaciones para Electron
 * Descarga instaladores desde una URL (p. ej. Supabase Storage) y abre el instalador
 */

import { net } from 'electron';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';

let downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };
let currentDownloadAbortController = null;

/**
 * Construye la ruta del archivo temporal para la descarga
 * @param {string} userDataPath - app.getPath('userData')
 * @param {string} fileName - Nombre del archivo (ej: CocoStock-Setup-1.9.1.exe)
 * @returns {string}
 */
export function getDownloadPath(userDataPath, fileName) {
  const updatesDir = join(userDataPath, 'updates');
  return join(updatesDir, fileName || 'installer.exe');
}

/**
 * Descarga un archivo desde una URL y lo guarda en la carpeta de actualizaciones
 * @param {string} downloadUrl - URL pública del archivo (ej. Supabase Storage)
 * @param {string} userDataPath - app.getPath('userData')
 * @param {string} [fileName] - Nombre del archivo de destino (por defecto se extrae de la URL)
 * @param {object} [onProgress] - { onProgress: (percent, bytesDownloaded, totalBytes) => void }
 * @returns {Promise<{ success: boolean, localPath?: string, error?: string }>}
 */
export async function downloadUpdate(downloadUrl, userDataPath, fileName = null, onProgress = null) {
  if (currentDownloadAbortController) {
    currentDownloadAbortController.abort();
  }
  currentDownloadAbortController = new AbortController();
  downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };

  let destFileName = fileName;
  if (!destFileName) {
    try {
      const u = new URL(downloadUrl);
      const pathname = u.pathname || '';
      destFileName = pathname.split('/').filter(Boolean).pop() || 'installer.exe';
    } catch {
      destFileName = 'installer.exe';
    }
  }

  const destPath = getDownloadPath(userDataPath, destFileName);
  const updatesDir = dirname(destPath);

  try {
    await mkdir(updatesDir, { recursive: true });
  } catch (err) {
    return { success: false, error: 'No se pudo crear la carpeta de descargas: ' + err.message };
  }

  return new Promise((resolve) => {
    const request = net.request({
      url: downloadUrl,
      method: 'GET',
      useSessionCookies: false,
    });

    request.on('response', async (response) => {
      const statusCode = response.statusCode || 0;
      if (statusCode < 200 || statusCode >= 300) {
        resolve({ success: false, error: `Error HTTP ${statusCode}` });
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      downloadProgress.totalBytes = totalBytes;

      let bytesDownloaded = 0;

      const writeStream = createWriteStream(destPath);
      let writeError = null;
      writeStream.on('error', (err) => { writeError = err; });

      response.on('data', (chunk) => {
        if (writeError) return;
        writeStream.write(chunk, (err) => { if (err) writeError = err; });
        bytesDownloaded += chunk.length;
        downloadProgress.bytesDownloaded = bytesDownloaded;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : 0;
        downloadProgress.percent = percent;
        if (typeof onProgress?.onProgress === 'function') {
          try {
            onProgress.onProgress(percent, bytesDownloaded, totalBytes);
          } catch (_) {}
        }
      });

      response.on('end', () => {
        writeStream.end(() => {
          if (writeError) {
            resolve({ success: false, error: 'Error al guardar el archivo: ' + writeError.message });
            return;
          }
          downloadProgress.percent = 100;
          downloadProgress.bytesDownloaded = bytesDownloaded;
          if (typeof onProgress?.onProgress === 'function') {
            try {
              onProgress.onProgress(100, bytesDownloaded, totalBytes || bytesDownloaded);
            } catch (_) {}
          }
          resolve({ success: true, localPath: destPath });
        });
      });

      response.on('error', (err) => {
        resolve({ success: false, error: err.message || 'Error en la respuesta' });
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message || 'Error de conexión' });
    });

    request.on('aborted', () => {
      resolve({ success: false, error: 'Descarga cancelada' });
    });

    if (currentDownloadAbortController) {
      currentDownloadAbortController.signal.addEventListener('abort', () => {
        request.abort();
      });
    }

    request.end();
  });
}

/**
 * Obtiene el progreso actual de la descarga
 * @returns {{ percent: number, bytesDownloaded: number, totalBytes: number }}
 */
export function getDownloadProgress() {
  return { ...downloadProgress };
}

/**
 * Cancela la descarga en curso
 */
export function cancelDownload() {
  if (currentDownloadAbortController) {
    currentDownloadAbortController.abort();
    currentDownloadAbortController = null;
  }
}
