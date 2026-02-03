/**
 * Página Account
 * Vista de perfil de usuario
 */

import { useState, useEffect } from 'react';
import { getSessionPreferences, setKeepSessionActive } from '../../utils/sessionPreferences';
import './Account.css';

function Account({ session }) {
  const [keepSessionActive, setKeepSessionActiveState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const prefs = getSessionPreferences();
    setKeepSessionActiveState(prefs.keepSessionActive);
  }, []);

  const handleToggleKeepSession = async (enabled) => {
    setSaving(true);
    setMessage('');
    try {
      setKeepSessionActive(enabled);
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
                {keepSessionActive
                  ? 'La sesión se renovará automáticamente y no expirará hasta que cierres la aplicación o cierres sesión manualmente.'
                  : 'La sesión expirará según la configuración normal de seguridad. Se renovará automáticamente cuando sea posible, pero puede requerir iniciar sesión nuevamente después de un tiempo de inactividad.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Account;

