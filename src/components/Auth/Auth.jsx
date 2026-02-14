/**
 * Componente Auth
 * Formulario de inicio de sesión
 * La verificación de versión se hace tras login exitoso (App.jsx)
 * El email recordado se guarda cifrado en local (secureStorage).
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { getRememberedEmail, setRememberedEmail, clearRememberedEmail } from '../../utils/rememberedEmail';
import logo from '../../assets/logo.png';
import './Auth.css';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordKeyDown = (e) => {
    setCapsLockOn(e.getModifierState?.('CapsLock') ?? false);
  };

  useEffect(() => {
    if (!passwordFocused) return;
    const onKeyDown = (e) => setCapsLockOn(e.getModifierState?.('CapsLock') ?? false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [passwordFocused]);

  useEffect(() => {
    getRememberedEmail().then((stored) => {
      if (stored) {
        setEmail(stored);
        setRememberEmail(true);
      }
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message || 'Error al iniciar sesión');
    } else {
      if (rememberEmail) {
        await setRememberedEmail(email);
      } else {
        clearRememberedEmail();
      }
    }

    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="auth-header">
          <img src={logo} alt="CocoStock Logo" className="auth-logo" />
          <h1 className="auth-title">CocoStock</h1>
          <p className="auth-subtitle">Bienvenido de nuevo</p>
        </div>

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
            <div className="auth-password-wrapper">
              {passwordFocused && capsLockOn && (
                <div className="auth-caps-popup" role="alert">
                  <span className="auth-caps-icon">⇪</span>
                  <span>Mayúsculas activadas</span>
                </div>
              )}
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handlePasswordKeyDown}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                disabled={loading}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? (
                  <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="auth-remember-row">
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                className="auth-checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                disabled={loading}
              />
              <span className="auth-checkbox-text">Recordar email</span>
            </label>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
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
