/**
 * Componente Sidebar
 * Panel lateral de navegación
 */

import { useMemo } from 'react';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';

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

function Sidebar({ currentView, onViewChange, onLogout, isOpen, onToggle, userId, viewPermissionsMap }) {
  const { roleName, loading } = useRole(userId);

  // Elementos del menú (id debe coincidir con vista en Layout)
  const allMenuItems = useMemo(() => [
    { id: 'dashboard', label: 'Inicio', icon: '📊' },
    { id: 'inventory', label: 'Inventario', icon: '📦' },
    { id: 'orders', label: 'Pedidos', icon: '🛒' },
    { id: 'platos', label: 'Platos del local', icon: '🍽️' },
    { id: 'merma', label: 'Merma', icon: '📉' },
    { id: 'purchases', label: 'Compras', icon: '💰' },
    { id: 'suppliers', label: 'Catálogo de proveedores', icon: '🏢' },
    { id: 'statistics', label: 'Estadísticas', icon: '📈' },
    { id: 'account', label: 'Mi Perfil', icon: '👤' },
    { id: 'settings', label: 'Configuración', icon: '⚙️' },
  ], []);

  // Filtrar según permisos de vistas (desde DB o fallback por defecto)
  const menuItems = useMemo(() => {
    if (loading || !roleName) return [];
    const normalizedRole = String(roleName).trim().toLowerCase();
    return allMenuItems.filter((item) => {
      const allowedRoles = viewPermissionsMap?.[item.id] ?? DEFAULT_VIEW_ROLES[item.id];
      if (!allowedRoles || !Array.isArray(allowedRoles)) return false;
      if (normalizedRole === String(ROLES.ADMIN || '').trim().toLowerCase()) return true;
      return allowedRoles.some((r) => String(r ?? '').trim().toLowerCase() === normalizedRole);
    });
  }, [allMenuItems, loading, roleName, viewPermissionsMap]);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-logo">CocoStock</h2>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label="Toggle sidebar"
        >
          {isOpen ? '←' : '→'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {isOpen && <span className="sidebar-text">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-item sidebar-logout"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onLogout) {
              onLogout();
            }
          }}
        >
          <span className="sidebar-icon">🚪</span>
          {isOpen && <span className="sidebar-text">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;

