/**
 * Componente Auth
 * Formulario de inicio de sesión
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { checkVersion } from '../../services/version';
import { APP_VERSION } from '../../constants/version';
import logo from '../../assets/logo.png';
import './Auth.css';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [versionError, setVersionError] = useState(null);

  /**
   * Verifica la versión de la aplicación al cargar
   * Si falla la verificación, se bloquea el login
   */
  useEffect(() => {
    const verifyVersion = async () => {
      try {
        setCheckingVersion(true);
        setVersionError(null); // Limpiar errores previos
        
        // Intentar verificar la versión con un timeout
        const versionCheck = await Promise.race([
          checkVersion(APP_VERSION),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout al verificar versión')), 10000)
          )
        ]);
        
        // Si la verificación fue exitosa y la versión es inválida, bloquear
        if (versionCheck && !versionCheck.isValid && versionCheck.minimumVersion) {
          setVersionError({
            currentVersion: versionCheck.currentVersion,
            minimumVersion: versionCheck.minimumVersion,
            isError: false, // Es un error de versión, no de conexión
          });
        } else if (!versionCheck || !versionCheck.minimumVersion) {
          // Si no hay versión mínima configurada, permitir acceso
          setVersionError(null);
        }
      } catch (err) {
        console.error('Error al verificar versión:', err.message);
        // En caso de error (timeout, conexión, permisos, etc.), BLOQUEAR acceso
        setVersionError({
          currentVersion: APP_VERSION,
          minimumVersion: null,
          isError: true, // Es un error de conexión/verificación
          errorMessage: err.message || 'No se pudo verificar la versión de la aplicación',
        });
      } finally {
        setCheckingVersion(false);
      }
    };

    verifyVersion();
  }, []);

  /**
   * Maneja el envío del formulario de inicio de sesión
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Bloquear login si la versión es obsoleta
    if (versionError) {
      setError('Debes actualizar la aplicación para continuar');
      return;
    }

    setLoading(true);
    setError('');

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message || 'Error al iniciar sesión');
    }

    setLoading(false);
  };

  // Mostrar carga mientras se verifica la versión
  if (checkingVersion) {
    return (
      <div className="auth-wrapper">
        <div className="auth-container">
          <div className="auth-header">
            <img src={logo} alt="CocoStock Logo" className="auth-logo" />
            <h1 className="auth-title">CocoStock</h1>
            <p className="auth-subtitle">Verificando versión...</p>
          </div>
          <div className="auth-loading">
            <span className="auth-spinner"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="auth-header">
          <img src={logo} alt="CocoStock Logo" className="auth-logo" />
          <h1 className="auth-title">CocoStock</h1>
          <p className="auth-subtitle">Bienvenido de nuevo</p>
        </div>

        {/* Mensaje de versión obsoleta o error de verificación */}
        {versionError && (
          <div className="auth-message auth-version-error">
            <span className="auth-icon">{versionError.isError ? '⚠️' : '🔄'}</span>
            <div className="auth-version-content">
              <strong>
                {versionError.isError 
                  ? 'Error al verificar versión' 
                  : 'Versión obsoleta detectada'}
              </strong>
              {versionError.isError ? (
                <>
                  <p>
                    No se pudo verificar la versión de la aplicación. 
                    Por favor, verifica tu conexión a internet e intenta nuevamente.
                  </p>
                  {versionError.errorMessage && (
                    <p className="auth-version-action">
                      <small>Error: {versionError.errorMessage}</small>
                    </p>
                  )}
                  <p className="auth-version-action">
                    El acceso está bloqueado hasta que se pueda verificar la versión.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Tu versión actual es <strong>{versionError.currentVersion}</strong>, 
                    pero se requiere la versión <strong>{versionError.minimumVersion}</strong> o superior.
                  </p>
                  <p className="auth-version-action">
                    Por favor, actualiza la aplicación para continuar.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <form className="auth-form" onSubmit={handleLogin}>
          {error && (
            <div className="auth-message auth-error">
              <span className="auth-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="auth-input-group">
            <label htmlFor="email" className="auth-label">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="password" className="auth-label">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading || versionError}
          >
            {loading ? (
              <>
                <span className="auth-spinner"></span>
                <span>Procesando...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;

