/**
 * Hook personalizado para manejar la autenticación
 * En Electron: sesión en disco + validación Supabase en segundo plano (no bloquea "Cargando…").
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getSessionPreferences } from '../utils/sessionPreferences';
import { signOutDesktopCleanup, forceResetAuthToLogin } from '../services/authSignOut';
import {
  applyElectronDeviceSessionOnStartup,
  persistElectronDeviceSession,
  clearElectronDeviceSessionFile,
  shouldAutoRefreshJwtForElectron,
} from '../services/deviceSession';
import {
  syncElectronDeviceSessionWithSupabase,
  heartbeatElectronDeviceSession,
} from '../services/deviceSessionServer';

const AUTH_LOADING_WATCHDOG_MS = 30000;

function isSessionExpired(session) {
  if (!session || !session.expires_at) {
    return true;
  }
  const expiresAt = session.expires_at * 1000;
  const now = Date.now();
  return now >= expiresAt - 60000;
}

function isSessionNearExpiry(session) {
  if (!session || !session.expires_at) {
    return true;
  }
  const expiresAt = session.expires_at * 1000;
  const now = Date.now();
  return expiresAt - now < 300000;
}

async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error al renovar sesión:', error);
      return null;
    }
    return data.session;
  } catch (err) {
    console.error('Error al renovar sesión:', err);
    return null;
  }
}

function shouldKeepJwtAlive(keepSessionActive) {
  return keepSessionActive === true || shouldAutoRefreshJwtForElectron();
}

/** Persistencia disco + RPC servidor (no bloquear splash). */
async function electronPersistAndEnforce(setSession) {
  if (typeof window === 'undefined' || !window.electronAPI?.deviceSession) return;
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.refresh_token) return;
    await persistElectronDeviceSession(s);
    const sr = await syncElectronDeviceSessionWithSupabase();
    if (!sr.ok && !sr.softError && !sr.skipped) {
      await signOutDesktopCleanup();
      setSession(null);
    }
  } catch (e) {
    console.warn('electronPersistAndEnforce:', e);
  }
}

/** @returns {Promise<boolean>} false si se cerró sesión. */
async function persistIfElectron(event, session) {
  if (typeof window === 'undefined' || !session || !window.electronAPI?.deviceSession) return true;
  if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') {
    return true;
  }
  try {
    await persistElectronDeviceSession(session);
    const sr = await syncElectronDeviceSessionWithSupabase();
    if (!sr.ok && !sr.softError && !sr.skipped) {
      await signOutDesktopCleanup();
      return false;
    }
  } catch (e) {
    console.warn('persistIfElectron:', e);
  }
  return true;
}

async function enforceServerDeviceSession(setSession) {
  try {
    const sr = await syncElectronDeviceSessionWithSupabase();
    if (sr.ok || sr.skipped || sr.softError) return;
    await signOutDesktopCleanup();
    setSession(null);
  } catch (e) {
    console.warn('enforceServerDeviceSession:', e);
  }
}

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => {
      if (!loadingRef.current) return;
      void (async () => {
        console.warn(
          'CocoStock: la autenticación tardó demasiado; se eliminan tokens guardados y se muestra el login.'
        );
        await forceResetAuthToLogin();
        setSession(null);
        setLoading(false);
      })();
    }, AUTH_LOADING_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    let touchCounter = 0;

    const init = async () => {
      try {
        if (typeof window !== 'undefined' && window.electronAPI?.deviceSession) {
          await applyElectronDeviceSessionOnStartup();
        }
        if (cancelled) return;

        const preferences = await getSessionPreferences();
        const keepSessionActive = preferences.keepSessionActive;
        const keepJwt = shouldKeepJwtAlive(keepSessionActive);

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (initialSession) {
          if (isSessionExpired(initialSession)) {
            if (keepJwt) {
              const refreshed = await refreshSession();
              if (refreshed) {
                setSession(refreshed);
              } else {
                await signOutDesktopCleanup();
                setSession(null);
              }
            } else {
              await signOutDesktopCleanup();
              setSession(null);
            }
          } else {
            setSession(initialSession);
          }
        } else {
          setSession(null);
        }
      } catch (e) {
        console.error('useAuth init:', e);
        setSession(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
      if (!cancelled) {
        void electronPersistAndEnforce(setSession);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setLoading(false);
        void clearElectronDeviceSessionFile();
        try {
          sessionStorage.removeItem('settingsAppReleasesUnlocked');
        } catch (_) {}
        return;
      }

      if (!nextSession) {
        setSession(null);
        setLoading(false);
        try {
          sessionStorage.removeItem('settingsAppReleasesUnlocked');
        } catch (_) {}
        return;
      }

      if (!isSessionExpired(nextSession)) {
        setSession(nextSession);
      }

      setLoading(false);

      void (async () => {
        try {
          const prefs = await getSessionPreferences();
          const keepJwt = shouldKeepJwtAlive(prefs.keepSessionActive);

          if (isSessionExpired(nextSession)) {
            if (keepJwt) {
              const refreshed = await refreshSession();
              if (refreshed) {
                setSession(refreshed);
                const persistOk = await persistIfElectron(event, refreshed);
                if (!persistOk) {
                  setSession(null);
                  return;
                }
                await enforceServerDeviceSession(setSession);
              } else {
                await signOutDesktopCleanup();
                setSession(null);
              }
            } else {
              await signOutDesktopCleanup();
              setSession(null);
            }
            return;
          }

          const persistOk = await persistIfElectron(event, nextSession);
          if (!persistOk) {
            setSession(null);
            return;
          }

          await enforceServerDeviceSession(setSession);
        } catch (e) {
          console.error('onAuthStateChange (async):', e);
          setSession(null);
        }
      })();
    });

    const checkExpirationInterval = setInterval(async () => {
      try {
        const currentPrefs = await getSessionPreferences();
        const keepJwt = shouldKeepJwtAlive(currentPrefs.keepSessionActive);

        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error al obtener sesión:', error);
          if (!keepJwt) setSession(null);
          return;
        }

        if (!currentSession) {
          if (sessionRef.current) setSession(null);
          return;
        }

        if (window.electronAPI?.deviceSession) {
          touchCounter += 1;
          if (touchCounter % 15 === 0) {
            const hr = await heartbeatElectronDeviceSession();
            if (!hr.ok && !hr.softError && !hr.skipped) {
              await signOutDesktopCleanup();
              setSession(null);
            }
          }
        }

        if (isSessionExpired(currentSession)) {
          if (keepJwt) {
            const refreshed = await refreshSession();
            if (refreshed) {
              setSession(refreshed);
              await persistElectronDeviceSession(refreshed);
              await enforceServerDeviceSession(setSession);
            } else {
              await signOutDesktopCleanup();
              setSession(null);
            }
          } else {
            await signOutDesktopCleanup();
            setSession(null);
          }
        } else if (isSessionNearExpiry(currentSession) && keepJwt) {
          const refreshed = await refreshSession();
          if (refreshed) {
            setSession(refreshed);
            await persistElectronDeviceSession(refreshed);
            await enforceServerDeviceSession(setSession);
          }
        } else if (currentSession?.access_token !== sessionRef.current?.access_token) {
          setSession(currentSession);
        }
      } catch (err) {
        console.error('Error al verificar expiración de sesión:', err);
      }
    }, 60000);

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!sessionRef.current || !window.electronAPI?.deviceSession) return;
      void (async () => {
        const hr = await heartbeatElectronDeviceSession();
        if (!hr.ok && !hr.softError && !hr.skipped) {
          await signOutDesktopCleanup();
          setSession(null);
        }
      })();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearInterval(checkExpirationInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { session, loading };
}
