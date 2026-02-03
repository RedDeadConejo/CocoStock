/**
 * Componente principal de la aplicación
 * Gestiona la autenticación y renderiza la vista correspondiente
 */

import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useSessionCleanup } from './hooks/useSessionCleanup';
import { unregisterMermaServerToken } from './services/merma';
import Auth from './components/Auth/Auth';
import Layout from './components/Layout/Layout';
import Merma from './pages/Merma/Merma';

function App() {
  const { session, loading } = useAuth();
  const [isLocalAccess, setIsLocalAccess] = useState(false);
  
  // Cerrar sesión automáticamente al cerrar la aplicación
  useSessionCleanup();

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

  // Renderizar Auth si no hay sesión, Layout si hay sesión
  return (
    <>
      {!session ? <Auth /> : <Layout session={session} />}
    </>
  );
}

export default App;
