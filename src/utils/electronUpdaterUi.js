/**
 * Descarga de releases en Electron: progreso desde el proceso principal.
 */

/**
 * @param {{ error?: string, promise?: Promise<{ success: boolean, localPath?: string, error?: string }> }} started - resultado de startElectronReleaseDownload
 * @param {(p: { percent: number, bytesDownloaded: number, totalBytes: number } | null) => void} [onProgressState] - null al terminar o si error previo
 * @returns {Promise<{ success: boolean, localPath?: string, error?: string }>}
 */
export async function executeUpdaterDownload(started, onProgressState) {
  if (started.error) {
    onProgressState?.(null);
    return { success: false, error: started.error };
  }

  const api = window.electronAPI?.updater;
  if (!api?.getProgress) {
    onProgressState?.(null);
    return { success: false, error: 'Actualizador no disponible' };
  }

  const id = setInterval(() => {
    api.getProgress().then((p) => onProgressState?.(p)).catch(() => {});
  }, 300);

  try {
    return await started.promise;
  } catch (err) {
    return { success: false, error: err?.message || 'Error en la descarga' };
  } finally {
    clearInterval(id);
    onProgressState?.(null);
  }
}
