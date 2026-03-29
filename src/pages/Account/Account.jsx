/**
 * Página Account
 * Vista de perfil de usuario
 */

import { useState, useEffect } from 'react';
import { getSessionPreferences, setKeepSessionActive } from '../../utils/sessionPreferences';
import { getLatestRelease, startElectronReleaseDownload } from '../../services/updater';
import { executeUpdaterDownload } from '../../utils/electronUpdaterUi';
import { APP_VERSION } from '../../constants/version';
import './Account.css';

function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

function Account({ session }) {
  const [keepSessionActive, setKeepSessionActiveState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Actualizaciones (solo Electron)
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadedPath, setDownloadedPath] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    getSessionPreferences().then((prefs) => setKeepSessionActiveState(prefs.keepSessionActive));
  }, []);

  const handleCheckUpdates = async () => {
    if (!isElectron()) return;
    setUpdateCheckLoading(true);
    setUpdateInfo(null);
    setMessage('');
    try {
      const result = await getLatestRelease();
      if (result.error && !result.available) {
        setMessage('No se pudo comprobar actualizaciones. ' + (result.error || ''));
      } else if (result.available) {
        setUpdateInfo(result);
      } else {
        let osSuffix = '';
        let osInfo = null;
        try {
          osInfo = await window.electronAPI?.getOsInfo?.();
          if (osInfo) {
            osSuffix = ` SO: ${osInfo.platform} · ${osInfo.release} · ${osInfo.arch} · actualizaciones: ${osInfo.updaterKey}`;
          }
        } catch {
          /* ignorar */
        }
        const line = result.hint
          ? `${result.hint}${osSuffix}`
          : `Tienes la última versión instalada (${APP_VERSION}).${osSuffix}`;
        setMessage(line);
        console.log('[CocoStock actualizaciones] Comprobación.', {
          appVersion: APP_VERSION,
          latestInServer: result.latestVersion ?? null,
          hint: result.hint,
          newerOnOtherPlatform: result.newerOnOtherPlatform,
          ...osInfo,
        });
      }
    } catch (err) {
      setMessage('Error al comprobar actualizaciones: ' + err.message);
    } finally {
      setUpdateCheckLoading(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!isElectron() || !updateInfo?.available) return;
    if (!updateInfo.filePath && !updateInfo.downloadUrl) return;
    setDownloadError(null);
    setDownloadedPath(null);
    setDownloadProgress({ percent: 0, bytesDownloaded: 0, totalBytes: 0 });
    const started = await startElectronReleaseDownload(updateInfo);
    const result = await executeUpdaterDownload(started, setDownloadProgress);
    if (result.success && result.localPath) {
      setDownloadedPath(result.localPath);
    } else {
      setDownloadError(result.error || 'Error en la descarga');
    }
  };

  const handleCancelDownload = async () => {
    if (window.electronAPI?.updater?.cancelDownload) {
      await window.electronAPI.updater.cancelDownload();
      setDownloadProgress(null);
      setDownloadError('Descarga cancelada');
    }
  };

  const handleOpenInstaller = async () => {
    if (!isElectron() || !downloadedPath) return;
    try {
      await window.electronAPI.updater.openInstaller(downloadedPath);
      setMessage('Se ha abierto el instalador. Puedes cerrar la aplicación para instalar la actualización.');
    } catch (err) {
      setMessage('Error al abrir el instalador: ' + err.message);
    }
  };

  const handleToggleKeepSession = async (enabled) => {
    setSaving(true);
    setMessage('');
    try {
      await setKeepSessionActive(enabled);
      setKeepSessionActiveState(enabled);
      setMessage(enabled 
        ? 'Sesión persistente activada. La sesión no expirará hasta que cierres la aplicación o cierres sesión manualmente.'
        : 'Sesión persistente desactivada. La sesión expirará según la configuración normal.');
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setMessage('Error al guardar la preferencia: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const userInfo = [
    {
      label: 'Correo electrónico',
      value: session.user.email,
    },
    {
      label: 'ID de usuario',
      value: `${session.user.id.substring(0, 8)}...`,
      isId: true,
    },
  ];

  return (
    <div className="account-page">
      <div className="account-container-page">
        <div className="account-header">
          <div className="account-avatar">
            {session.user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <h1 className="account-title">👤 Mi Perfil</h1>
          <p className="account-subtitle">Información de tu cuenta</p>
        </div>

        <div className="account-info">
          {userInfo.map((info, index) => (
            <div key={index} className="account-info-item">
              <span className="account-info-label">{info.label}</span>
              <span className={`account-info-value ${info.isId ? 'account-id' : ''}`}>
                {info.value}
              </span>
            </div>
          ))}
        </div>

        <div className="account-settings">
          <h2 className="account-settings-title">⚙️ Configuración de Sesión</h2>
          
          {message && (
            <div className={`account-message ${message.includes('Error') ? 'account-message-error' : 'account-message-success'}`}>
              <span className="account-icon">{message.includes('Error') ? '⚠️' : '✓'}</span>
              <span>{message}</span>
            </div>
          )}

          <div className="account-setting-item">
            <div className="account-setting-content">
              <div className="account-setting-header">
                <label htmlFor="keep-session" className="account-setting-label">
                  🔒 Mantener sesión activa
                </label>
                <label className="account-toggle">
                  <input
                    id="keep-session"
                    type="checkbox"
                    checked={keepSessionActive}
                    onChange={(e) => handleToggleKeepSession(e.target.checked)}
                    disabled={saving}
                    className="account-toggle-input"
                  />
                  <span className="account-toggle-slider"></span>
                </label>
              </div>
              <p className="account-setting-description">
                {isElectron()
                  ? 'En la aplicación de escritorio la sesión se guarda cifrada en este equipo y Supabase registra el dispositivo: otro PC no puede reutilizar esa sesión y, si pasan más de 2 días sin renovación en el servidor, la app cerrará sesión. El token de acceso se renueva automáticamente mientras uses la app.'
                  : keepSessionActive
                    ? 'La sesión se renovará automáticamente y no expirará hasta que cierres la aplicación o cierres sesión manualmente.'
                    : 'La sesión expirará según la configuración normal de seguridad. Se renovará automáticamente cuando sea posible, pero puede requerir iniciar sesión nuevamente después de un tiempo de inactividad.'}
              </p>
            </div>
          </div>
        </div>

        {isElectron() && (
          <div className="account-settings account-updates-section">
            <h2 className="account-settings-title">📦 Actualizaciones</h2>
            <p className="account-setting-description" style={{ marginBottom: '1rem' }}>
              Versión instalada: <strong>{APP_VERSION}</strong>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="account-btn account-btn-secondary"
                onClick={handleCheckUpdates}
                disabled={updateCheckLoading}
              >
                {updateCheckLoading ? 'Buscando...' : 'Buscar actualizaciones'}
              </button>
            </div>

            {updateInfo && updateInfo.available && (
              <div className="account-update-available">
                <p className="account-update-version">
                  Nueva versión disponible: <strong>{updateInfo.latestVersion}</strong>
                </p>
                {updateInfo.releaseNotes && (
                  <p className="account-update-notes">{updateInfo.releaseNotes}</p>
                )}
                {!downloadProgress && !downloadedPath && !downloadError && (
                  <button
                    type="button"
                    className="account-btn account-btn-primary"
                    onClick={handleDownloadUpdate}
                  >
                    Descargar actualización
                  </button>
                )}
                {downloadProgress != null && (
                  <>
                    <div className="account-update-progress-bar">
                      <div
                        className="account-update-progress-fill"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                    <p className="account-update-progress-text">
                      {downloadProgress.percent}%
                      {downloadProgress.totalBytes > 0 &&
                        ` · ${(downloadProgress.bytesDownloaded / 1024 / 1024).toFixed(2)} / ${(downloadProgress.totalBytes / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                    <button
                      type="button"
                      className="account-btn account-btn-secondary"
                      onClick={handleCancelDownload}
                    >
                      Cancelar descarga
                    </button>
                  </>
                )}
                {downloadError && (
                  <p className="account-message account-message-error" style={{ marginTop: '0.75rem' }}>
                    <span className="account-icon">⚠️</span>
                    <span>{downloadError}</span>
                  </p>
                )}
                {downloadedPath && (
                  <div style={{ marginTop: '1rem' }}>
                    <p className="account-message account-message-success" style={{ marginBottom: '0.75rem' }}>
                      <span className="account-icon">✓</span>
                      <span>Descarga completada.</span>
                    </p>
                    <button
                      type="button"
                      className="account-btn account-btn-primary"
                      onClick={handleOpenInstaller}
                    >
                      Abrir instalador
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Account;

