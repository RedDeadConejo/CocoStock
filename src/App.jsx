/**
 * Componente principal de la aplicación
 * Gestiona la autenticación y renderiza la vista correspondiente
 * La verificación de versión se hace tras login exitoso: si la versión no es válida,
 * se muestra un popup de bloqueo con botón para descargar la nueva versión.
 */

import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useSessionCleanup } from './hooks/useSessionCleanup';
import { unregisterMermaServerToken } from './services/merma';
import { checkVersion } from './services/version';
import { supabase } from './services/supabase';
import Auth from './components/Auth/Auth';
import Layout from './components/Layout/Layout';
import Merma from './pages/Merma/Merma';
import VersionBlockedOverlay from './components/VersionBlockedOverlay/VersionBlockedOverlay';
import { APP_VERSION } from './constants/version';

function App() {
  const { session, loading } = useAuth();
  const [isLocalAccess, setIsLocalAccess] = useState(false);
  const [versionCheck, setVersionCheck] = useState({ loading: true, isValid: true, minimumVersion: null });
  
  // Cerrar sesión automáticamente al cerrar la aplicación
  useSessionCleanup();

  // Verificar versión solo tras login exitoso (cuando hay sesión y no es merma)
  useEffect(() => {
    if (!session || isLocalAccess) {
      if (!session) setVersionCheck({ loading: false, isValid: true, minimumVersion: null });
      return;
    }
    let cancelled = false;
    const verify = async () => {
      try {
        const result = await Promise.race([
          checkVersion(APP_VERSION),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
        ]);
        if (!cancelled) {
          setVersionCheck({
            loading: false,
            isValid: result?.isValid ?? true,
            minimumVersion: result?.minimumVersion ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setVersionCheck({ loading: false, isValid: true, minimumVersion: null });
        }
      }
    };
    setVersionCheck((prev) => ({ ...prev, loading: true }));
    verify();
    return () => { cancelled = true; };
  }, [session?.user?.id, isLocalAccess]);

  // Al cerrar la app (Electron): invalidar tokens de merma para que pestañas abiertas no sigan registrando
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onBeforeQuit) return;
    window.electronAPI.onBeforeQuit(async (tokens) => {
      if (!Array.isArray(tokens)) return;
      for (const token of tokens) {
        try {
          await unregisterMermaServerToken(token);
        } catch (_) {}
      }
    });
  }, []);

  // Detectar si es acceso local (interfaz de merma)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const localParam = urlParams.get('local');
    const sessionLocal = sessionStorage.getItem('merma_local_access');
    
    if (localParam === 'true' || sessionLocal === 'true') {
      setIsLocalAccess(true);
      // Asegurar que el flag esté en sessionStorage
      sessionStorage.setItem('merma_local_access', 'true');
    } else {
      setIsLocalAccess(false);
      sessionStorage.removeItem('merma_local_access');
    }
  }, []);

  // Mostrar carga mientras se verifica la sesión
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000000',
        color: '#FFFFFF'
      }}>
        Cargando...
      </div>
    );
  }

  // Si es acceso local (merma), mostrar solo Merma (no requiere sesión: usa la cuenta que inició el servidor)
  if (isLocalAccess) {
    return <Merma />;
  }

  // Sin sesión: pantalla de login
  if (!session) {
    return <Auth />;
  }

  // Con sesión: verificar versión antes de cargar el menú
  if (versionCheck.loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#000000', color: '#FFFFFF',
      }}>
        Verificando versión...
      </div>
    );
  }

  // Versión no permitida: popup de bloqueo con botón de descarga
  if (!versionCheck.isValid && versionCheck.minimumVersion) {
    return (
      <VersionBlockedOverlay
        minimumVersion={versionCheck.minimumVersion}
        onLogout={() => supabase.auth.signOut()}
      />
    );
  }

  // Versión OK: cargar menú normal
  return <Layout session={session} />;
}

export default App;
