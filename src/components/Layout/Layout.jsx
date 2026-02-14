/**
 * Componente Layout
 * Contenedor principal con sidebar y área de contenido
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { getViewPermissionsMap } from '../../services/roleManagement';
import Dashboard from '../../pages/Dashboard/Dashboard';
import Inventory from '../../pages/Inventory/Inventory';
import Orders from '../../pages/Orders/Orders';
import Platos from '../../pages/Platos/Platos';
import Merma from '../../pages/Merma/Merma';
import Purchases from '../../pages/Purchases/Purchases';
import Suppliers from '../../pages/Suppliers/Suppliers';
import Statistics from '../../pages/Statistics/Statistics';
import Account from '../../pages/Account/Account';
import Settings from '../../pages/Settings/Settings';
import Sidebar from './Sidebar';
import RoleGuard, { ROLES } from '../RoleGuard/RoleGuard';
import { useRole, clearRoleCache } from '../../hooks/useRole';
import './Layout.css';

/** Solo admin por defecto; el resto de roles obtienen permisos desde la BD */
const DEFAULT_VIEW_ROLES = {
  dashboard: [ROLES.ADMIN],
  inventory: [ROLES.ADMIN],
  orders: [ROLES.ADMIN],
  platos: [ROLES.ADMIN],
  merma: [ROLES.ADMIN],
  purchases: [ROLES.ADMIN],
  suppliers: [ROLES.ADMIN],
  statistics: [ROLES.ADMIN],
  account: [ROLES.ADMIN],
  settings: [ROLES.ADMIN],
};

function Layout({ session }) {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [viewPermissionsMap, setViewPermissionsMap] = useState(null);
  const userId = session?.user?.id;
  const { roleName, loading: roleLoading, error: roleError } = useRole(userId);

  const loadViewPermissionsMap = () => {
    getViewPermissionsMap()
      .then((map) => setViewPermissionsMap(map))
      .catch((err) => console.warn('[Layout] Error al cargar permisos de vistas:', err));
  };

  // Cargar mapa de permisos por vista (roles que pueden acceder a cada pestaña)
  useEffect(() => {
    loadViewPermissionsMap();
  }, []);

  // Recargar permisos cuando se crea/actualiza/elimina un rol desde Configuración
  useEffect(() => {
    const handler = () => loadViewPermissionsMap();
    window.addEventListener('viewPermissionsUpdated', handler);
    return () => window.removeEventListener('viewPermissionsUpdated', handler);
  }, []);
  
  // Log de depuración del rol
  useEffect(() => {
    if (userId && !roleLoading) {
      console.log('[Layout] Rol del usuario:', {
        userId,
        roleName,
        isAdmin: roleName === ROLES.ADMIN,
        error: roleError
      });
    }
  }, [userId, roleName, roleLoading, roleError]);
  
  // Timeout de seguridad: si después de 5 segundos sigue cargando, mostrar contenido de todas formas
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    if (!userId) {
      setShowContent(false);
      return;
    }
    
    // Mostrar contenido después de un tiempo máximo
    const timeout = setTimeout(() => {
      setShowContent(true);
    }, 5000);
    
    // Si termina de cargar, mostrar contenido inmediatamente
    if (!roleLoading) {
      clearTimeout(timeout);
      setShowContent(true);
    }
    
    return () => clearTimeout(timeout);
  }, [userId, roleLoading]);

  // Detectar si estamos en móvil y ajustar el sidebar inicialmente
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };

    // Verificar al cargar
    const initialMobile = window.innerWidth <= 768;
    setIsMobile(initialMobile);
    
    // Ajustar estado inicial del sidebar: cerrado en móvil, abierto en desktop
    if (initialMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }

    // Escuchar cambios de tamaño (solo actualizar isMobile, no el sidebar)
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []); // Solo al montar

  // NOTA: La verificación de permisos se maneja completamente en RoleGuard
  // No necesitamos redirección adicional aquí ya que RoleGuard muestra el fallback
  // si el usuario no tiene acceso

  /**
   * Maneja el cierre de sesión
   * Cierra la sesión usando Supabase y limpia el storage
   */
  const handleLogout = async () => {
    console.log('Iniciando cierre de sesión...');
    
    try {
      // Cerrar sesión en Supabase primero (esto disparará onAuthStateChange automáticamente)
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error al cerrar sesión en Supabase:', error);
      } else {
        console.log('Sesión cerrada correctamente en Supabase');
      }

      // Limpiar el localStorage de Supabase después de cerrar sesión
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || 
              key.includes('supabase') || 
              key.includes('supabase.auth.token')) {
            window.localStorage.removeItem(key);
          }
        });
      }

      // Limpiar sessionStorage (incl. sección Releases desbloqueada)
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keys = Object.keys(window.sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || 
              key.includes('supabase') || 
              key.includes('supabase.auth.token') ||
              key === 'settingsAppReleasesUnlocked') {
            window.sessionStorage.removeItem(key);
          }
        });
      }
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      
      // Asegurarse de que el storage esté limpio de todas formas
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            window.localStorage.removeItem(key);
          }
        });
      }
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('settingsAppReleasesUnlocked');
      }
    }
  };

  /**
   * Maneja el cambio de vista y cierra el sidebar en móvil
   */
  const handleViewChange = (view) => {
    setCurrentView(view);
    // Cerrar el sidebar en móvil después de seleccionar una opción
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  /** Roles permitidos para la vista actual (desde DB o fallback por defecto) */
  const getAllowedRolesForView = (viewId) =>
    (viewPermissionsMap && viewPermissionsMap[viewId]) || DEFAULT_VIEW_ROLES[viewId] || DEFAULT_VIEW_ROLES.dashboard;

  const fallbackDenied = (message = 'No tienes permisos para acceder a esta sección.') => (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#FFFFFF' }}>
      <h2>Acceso Denegado</h2>
      <p>{message}</p>
    </div>
  );

  /**
   * Renderiza el contenido según la vista actual
   */
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('dashboard')} userId={userId}>
            <Dashboard 
              session={session} 
              onNavigate={handleViewChange}
              viewPermissionsMap={viewPermissionsMap}
            />
          </RoleGuard>
        );
      case 'inventory':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('inventory')} userId={userId} fallback={fallbackDenied()}>
            <Inventory />
          </RoleGuard>
        );
      case 'orders':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('orders')} userId={userId}>
            <Orders />
          </RoleGuard>
        );
      case 'platos':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('platos')} userId={userId}>
            <Platos />
          </RoleGuard>
        );
      case 'merma':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('merma')} userId={userId}>
            <Merma />
          </RoleGuard>
        );
      case 'purchases':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('purchases')} userId={userId} fallback={fallbackDenied()}>
            <Purchases />
          </RoleGuard>
        );
      case 'suppliers':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('suppliers')} userId={userId} fallback={fallbackDenied()}>
            <Suppliers />
          </RoleGuard>
        );
      case 'statistics':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('statistics')} userId={userId} fallback={fallbackDenied()}>
            <Statistics />
          </RoleGuard>
        );
      case 'account':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('account')} userId={userId}>
            <Account session={session} />
          </RoleGuard>
        );
      case 'settings':
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('settings')} userId={userId} fallback={fallbackDenied()}>
            <Settings />
          </RoleGuard>
        );
      default:
        return (
          <RoleGuard allowedRoles={getAllowedRolesForView('dashboard')} userId={userId}>
            <Dashboard
              session={session}
              onNavigate={handleViewChange}
              viewPermissionsMap={viewPermissionsMap}
            />
          </RoleGuard>
        );
    }
  };

  return (
    <div className="layout">
      {/* Overlay para móviles cuando el sidebar está abierto */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userId={userId}
        isMobile={isMobile}
        viewPermissionsMap={viewPermissionsMap}
      />

      <main className="main-content">
        {/* Botón de hamburguesa para móviles - solo visible cuando el sidebar está cerrado */}
        {isMobile && !sidebarOpen && (
          <button
            className="mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        )}
        {roleLoading && !showContent ? (
          <div className="layout-loading">
            <div className="layout-spinner"></div>
            <p>Cargando permisos...</p>
            {roleError && (
              <p style={{ color: '#DC2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Error: {roleError}
              </p>
            )}
          </div>
        ) : (
          renderContent()
        )}
      </main>
    </div>
  );
}

export default Layout;

