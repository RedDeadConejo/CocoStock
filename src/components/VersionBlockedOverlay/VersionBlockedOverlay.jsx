/**
 * Popup que bloquea la app cuando la versión ya no está permitida.
 * Se muestra tras un login exitoso si la versión actual es inferior a la mínima requerida.
 * Solo permite descargar la nueva versión.
 */

import { useState } from 'react';
import { getLatestRelease, startElectronReleaseDownload } from '../../services/updater';
import { executeUpdaterDownload } from '../../utils/electronUpdaterUi';
import { APP_VERSION } from '../../constants/version';
import { isNativeAndroidApp, PLAY_STORE_APP_URL } from '../../utils/capacitorPlatform';
import './VersionBlockedOverlay.css';

function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.updater;
}

function VersionBlockedOverlay({ minimumVersion, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadedPath, setDownloadedPath] = useState(null);
  const [downloadOpenedInBrowser, setDownloadOpenedInBrowser] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await getLatestRelease();
      if (!result.available) {
        setError(result.error || result.hint || 'No hay actualización disponible para tu plataforma.');
        return;
      }
      if (isElectron() && !result.filePath) {
        setError(result.error || result.hint || 'No hay actualización disponible para tu plataforma.');
        return;
      }
      if (!isElectron() && !result.downloadUrl) {
        setError(result.error || result.hint || 'No hay actualización disponible para tu plataforma.');
        return;
      }
      if (isElectron()) {
        setDownloadProgress({ percent: 0, bytesDownloaded: 0, totalBytes: 0 });
        const started = await startElectronReleaseDownload(result);
        const res = await executeUpdaterDownload(started, setDownloadProgress);
        if (res.success && res.localPath) {
          setDownloadedPath(res.localPath);
        } else {
          setError(res.error || 'Error en la descarga');
        }
      } else {
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
        setDownloadOpenedInBrowser(true);
      }
    } catch (err) {
      setError(err.message || 'No se pudo obtener la actualización');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInstaller = async () => {
    if (!isElectron() || !downloadedPath) return;
    try {
      await window.electronAPI.updater.openInstaller(downloadedPath);
    } catch (err) {
      setError(err.message);
    }
  };

  if (isNativeAndroidApp()) {
    return (
      <div className="version-blocked-overlay">
        <div className="version-blocked-popup">
          <div className="version-blocked-icon">🔄</div>
          <h1 className="version-blocked-title">Versión no permitida</h1>
          <p className="version-blocked-message">
            Tu versión actual (<strong>{APP_VERSION}</strong>) ya no está permitida.
            Se requiere la versión <strong>{minimumVersion}</strong> o superior.
          </p>
          <p className="version-blocked-action">
            En Android las actualizaciones solo están disponibles en Google Play. Actualiza la app desde la tienda.
          </p>
          <a
            href={PLAY_STORE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="version-blocked-btn version-blocked-btn-primary"
            style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-block' }}
          >
            Abrir en Google Play
          </a>
          {onLogout && (
            <button
              type="button"
              className="version-blocked-btn version-blocked-btn-link"
              onClick={onLogout}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="version-blocked-overlay">
      <div className="version-blocked-popup">
        <div className="version-blocked-icon">🔄</div>
        <h1 className="version-blocked-title">Versión no permitida</h1>
        <p className="version-blocked-message">
          Tu versión actual (<strong>{APP_VERSION}</strong>) ya no está permitida.
          Se requiere la versión <strong>{minimumVersion}</strong> o superior.
        </p>
        <p className="version-blocked-action">
          Descarga la nueva versión para continuar.
        </p>

        {error && (
          <div className="version-blocked-error">
            <span className="version-blocked-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {downloadOpenedInBrowser && !downloadedPath && (
          <p className="version-blocked-success-msg" style={{ marginBottom: '0.5rem' }}>
            Se ha abierto la descarga en una nueva pestaña. Si no se inició, haz clic de nuevo.
          </p>
        )}

        {!downloadProgress && !downloadedPath && (
          <button
            type="button"
            className="version-blocked-btn version-blocked-btn-primary"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="version-blocked-spinner"></span>
                Buscando actualización...
              </>
            ) : (
              'Descargar nueva versión'
            )}
          </button>
        )}

        {downloadProgress != null && (
          <div className="version-blocked-download">
            <div className="version-blocked-progress-bar">
              <div
                className="version-blocked-progress-fill"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <p className="version-blocked-progress-text">
              {downloadProgress.percent}%
              {downloadProgress.totalBytes > 0 &&
                ` · ${(downloadProgress.bytesDownloaded / 1024 / 1024).toFixed(2)} / ${(downloadProgress.totalBytes / 1024 / 1024).toFixed(2)} MB`}
            </p>
          </div>
        )}

        {downloadedPath && (
          <div className="version-blocked-success">
            <p className="version-blocked-success-msg">✓ Descarga completada</p>
            <button
              type="button"
              className="version-blocked-btn version-blocked-btn-primary"
              onClick={handleOpenInstaller}
            >
              Abrir instalador
            </button>
          </div>
        )}

        {onLogout && (
          <button
            type="button"
            className="version-blocked-btn version-blocked-btn-link"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}

export default VersionBlockedOverlay;
