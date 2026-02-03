/**
 * Hook personalizado para manejar la autenticación
 * Gestiona el estado de sesión y los cambios de autenticación
 */

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { getSessionPreferences } from '../utils/sessionPreferences';

/**
 * Verifica si una sesión ha expirado
 */
function isSessionExpired(session) {
  if (!session || !session.expires_at) {
    return true;
  }
  
  // Convertir expires_at (timestamp en segundos) a milisegundos
  const expiresAt = session.expires_at * 1000;
  const now = Date.now();
  
  // Considerar expirada si falta menos de 1 minuto (60 segundos)
  // Esto da margen para refrescar antes de que expire completamente
  return now >= (expiresAt - 60000);
}

/**
 * Verifica si una sesión está cerca de expirar (para renovarla antes)
 */
function isSessionNearExpiry(session) {
  if (!session || !session.expires_at) {
    return true;
  }
  
  const expiresAt = session.expires_at * 1000;
  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;
  
  // Renovar si falta menos de 5 minutos (300000 ms)
  return timeUntilExpiry < 300000;
}

/**
 * Intenta renovar la sesión usando el refresh token
 */
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

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const preferences = getSessionPreferences();
    const keepSessionActive = preferences.keepSessionActive;

    // Obtener la sesión actual al cargar
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (initialSession) {
        if (isSessionExpired(initialSession)) {
          if (keepSessionActive) {
            // Intentar renovar la sesión
            console.log('Sesión expirada, intentando renovar...');
            const refreshed = await refreshSession();
            if (refreshed) {
              setSession(refreshed);
            } else {
              // Si no se puede renovar, cerrar sesión
              await supabase.auth.signOut();
              setSession(null);
            }
          } else {
            // Si no está activada la opción, cerrar sesión normalmente
            await supabase.auth.signOut();
            setSession(null);
          }
        } else {
          setSession(initialSession);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    // Escuchar cambios en el estado de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        if (isSessionExpired(session)) {
          if (keepSessionActive) {
            // Intentar renovar la sesión
            console.log('Sesión expirada en cambio de estado, intentando renovar...');
            const refreshed = await refreshSession();
            if (refreshed) {
              setSession(refreshed);
            } else {
              await supabase.auth.signOut();
              setSession(null);
            }
          } else {
            console.log('Sesión expirada, cerrando sesión...');
            await supabase.auth.signOut();
            setSession(null);
          }
        } else {
          setSession(session);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    // Verificar periódicamente si la sesión necesita renovación (cada 1 minuto)
    const checkExpirationInterval = setInterval(async () => {
      try {
        const currentPrefs = getSessionPreferences();
        const shouldKeepActive = currentPrefs.keepSessionActive;

        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error al obtener sesión:', error);
          if (!shouldKeepActive) {
            setSession(null);
          }
          return;
        }
        
        if (!currentSession) {
          if (session) {
            setSession(null);
          }
          return;
        }

        if (isSessionExpired(currentSession)) {
          if (shouldKeepActive) {
            // Intentar renovar la sesión
            console.log('Sesión expirada detectada, renovando...');
            const refreshed = await refreshSession();
            if (refreshed) {
              setSession(refreshed);
            } else {
              // Si no se puede renovar después de varios intentos, cerrar sesión
              console.warn('No se pudo renovar la sesión, cerrando...');
              await supabase.auth.signOut();
              setSession(null);
            }
          } else {
            console.log('Sesión expirada detectada, cerrando sesión...');
            await supabase.auth.signOut();
            setSession(null);
          }
        } else if (isSessionNearExpiry(currentSession) && shouldKeepActive) {
          // Renovar antes de que expire si la opción está activada
          console.log('Sesión cerca de expirar, renovando preventivamente...');
          const refreshed = await refreshSession();
          if (refreshed) {
            setSession(refreshed);
          }
        } else if (currentSession?.access_token !== session?.access_token) {
          // Solo actualizar si realmente cambió
          setSession(currentSession);
        }
      } catch (err) {
        console.error('Error al verificar expiración de sesión:', err);
      }
    }, 60000); // Verificar cada 1 minuto

    // Limpiar suscripción e intervalo al desmontar
    return () => {
      subscription.unsubscribe();
      clearInterval(checkExpirationInterval);
    };
  }, [session?.access_token]);

  return { session, loading };
}

