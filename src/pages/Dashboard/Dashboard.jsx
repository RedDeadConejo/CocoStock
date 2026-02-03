/**
 * Página Dashboard
 * Tres variantes según rol/permisos: admin, almacén, restaurante.
 * Cada una muestra atajos a secciones permitidas (sin métricas).
 */

import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../../services/products';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';
import { VIEW_IDS } from '../../services/roleManagement';
import ProductForm from '../../components/ProductForm/ProductForm';
import StockManager from '../../components/StockManager/StockManager';
import './Dashboard.css';

const DEFAULT_VIEW_ROLES = {
  dashboard: [ROLES.ADMIN, ROLES.ALMACEN, ROLES.RESTAURANTE],
  inventory: [ROLES.ADMIN, ROLES.ALMACEN],
  orders: [ROLES.ADMIN, ROLES.ALMACEN, ROLES.RESTAURANTE],
  platos: [ROLES.ADMIN, ROLES.ALMACEN, ROLES.RESTAURANTE],
  merma: [ROLES.ADMIN, ROLES.ALMACEN, ROLES.RESTAURANTE],
  purchases: [ROLES.ADMIN, ROLES.ALMACEN],
  suppliers: [ROLES.ADMIN],
  statistics: [ROLES.ADMIN, ROLES.ALMACEN],
  account: [ROLES.ADMIN, ROLES.ALMACEN, ROLES.RESTAURANTE],
  settings: [ROLES.ADMIN, ROLES.RESTAURANTE],
};

const VIEW_LABELS = {
  inventory: { label: 'Inventario', icon: '📦', desc: 'Gestionar productos y stock' },
  orders: { label: 'Pedidos', icon: '🛒', desc: 'Ver y gestionar pedidos' },
  platos: { label: 'Platos del local', icon: '🍽️', desc: 'Productos o platos del local' },
  merma: { label: 'Merma', icon: '📉', desc: 'Registro de pérdidas' },
  purchases: { label: 'Compras', icon: '💰', desc: 'Compras a proveedores' },
  suppliers: { label: 'Catálogo de proveedores', icon: '🏢', desc: 'Proveedores' },
  statistics: { label: 'Estadísticas', icon: '📈', desc: 'Análisis y estadísticas' },
  account: { label: 'Mi Perfil', icon: '👤', desc: 'Datos de la cuenta' },
  settings: { label: 'Configuración', icon: '⚙️', desc: 'Ajustes y servidores locales' },
};

function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI;
}

function Dashboard({ session, onNavigate, viewPermissionsMap }) {
  const userId = session?.user?.id;
  const { roleName, permissions, isAdmin, isAlmacen, isRestaurante } = useRole(userId);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showStockManager, setShowStockManager] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);

  const getAllowedRolesForView = (viewId) =>
    (viewPermissionsMap && viewPermissionsMap[viewId]) ?? DEFAULT_VIEW_ROLES[viewId] ?? [];

  const canAccessView = (viewId) => {
    if (isAdmin) return true;
    const allowed = getAllowedRolesForView(viewId);
    return Array.isArray(allowed) && allowed.includes(roleName);
  };

  const allowedViewIds = useMemo(() => {
    return VIEW_IDS.filter((id) => id !== 'dashboard' && canAccessView(id));
  }, [roleName, viewPermissionsMap, isAdmin]);

  const dashboardVariant = useMemo(() => {
    if (isAdmin) return 'admin';
    if (permissions.dashboard_almacen === true || roleName === ROLES.ALMACEN) return 'almacen';
    if (permissions.dashboard_restaurante === true || roleName === ROLES.RESTAURANTE) return 'restaurante';
    return canAccessView('inventory') || canAccessView('purchases') ? 'almacen' : 'restaurante';
  }, [roleName, permissions, isAdmin, isAlmacen, isRestaurante, viewPermissionsMap]);

  const canAccessInventory = canAccessView('inventory');
  const canAccessPurchases = canAccessView('purchases');
  const canAccessSettings = canAccessView('settings');
  const canAccessLocalServers = isAdmin || permissions.view_settings_local_servers === true;

  useEffect(() => {
    if (canAccessInventory && (dashboardVariant === 'almacen' || dashboardVariant === 'admin')) {
      loadProducts();
    }
  }, [dashboardVariant, canAccessInventory]);

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error al cargar productos:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleOpenStockManager = () => setShowStockManager(true);
  const handleOpenProductForm = () => setShowProductForm(true);
  const handleCloseStockManager = () => {
    setShowStockManager(false);
    loadProducts();
  };
  const handleCloseProductForm = () => {
    setShowProductForm(false);
    loadProducts();
  };

  const handleGoToPurchaseCart = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('purchasesOpenCart', 'true');
    if (onNavigate) onNavigate('purchases');
  };

  const handleGoToView = (viewId) => {
    if (onNavigate) onNavigate(viewId);
  };

  const handleActivarServidores = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('settingsOpenTab', 'local-servers');
      sessionStorage.setItem('settingsAutoStartServers', 'true');
    }
    if (onNavigate) onNavigate('settings');
  };

  const handleOpenNewRole = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('settingsOpenTab', 'roles');
      sessionStorage.setItem('settingsOpenRoleForm', 'true');
    }
    if (onNavigate) onNavigate('settings');
  };

  const handleOpenNewUser = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('settingsOpenTab', 'users');
      sessionStorage.setItem('settingsOpenUserForm', 'true');
    }
    if (onNavigate) onNavigate('settings');
  };

  const handleOpenNewRestaurant = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('settingsOpenTab', 'restaurants');
      sessionStorage.setItem('settingsOpenRestaurantForm', 'true');
    }
    if (onNavigate) onNavigate('settings');
  };

  const renderShortcut = (viewId) => {
    const meta = VIEW_LABELS[viewId];
    if (!meta) return null;
    return (
      <button
        key={viewId}
        type="button"
        className="dashboard-action-btn"
        onClick={() => handleGoToView(viewId)}
      >
        <span className="dashboard-action-icon">{meta.icon}</span>
        <span className="dashboard-action-label">{meta.label}</span>
        <span className="dashboard-action-desc">{meta.desc}</span>
      </button>
    );
  };

  const canAccessSettingsRoles = isAdmin || permissions.view_settings_roles === true;
  const canAccessSettingsUsers = isAdmin || permissions.view_settings_users === true;
  const canAccessSettingsRestaurants = isAdmin || permissions.view_settings_restaurants === true;

  const renderAdminDashboard = () => (
    <div className="dashboard-actions">
      <h2 className="dashboard-actions-title">Acciones rápidas</h2>
      <p className="dashboard-actions-subtitle">
        Tareas que no están en el menú lateral: abrir formularios y flujos concretos en un clic.
      </p>
      <div className="dashboard-actions-grid">
        {canAccessSettingsRoles && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenNewRole}>
            <span className="dashboard-action-icon">👤</span>
            <span className="dashboard-action-label">Nuevo rol</span>
            <span className="dashboard-action-desc">Crear un rol con permisos personalizados</span>
          </button>
        )}
        {canAccessSettingsUsers && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenNewUser}>
            <span className="dashboard-action-icon">➕</span>
            <span className="dashboard-action-label">Nuevo usuario</span>
            <span className="dashboard-action-desc">Dar de alta un usuario en la app</span>
          </button>
        )}
        {canAccessSettingsRestaurants && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenNewRestaurant}>
            <span className="dashboard-action-icon">🏢</span>
            <span className="dashboard-action-label">Nuevo restaurante</span>
            <span className="dashboard-action-desc">Añadir un local/restaurante al sistema</span>
          </button>
        )}
        {canAccessInventory && (
          <>
            <button
              type="button"
              className="dashboard-action-btn"
              onClick={handleOpenStockManager}
              disabled={productsLoading}
            >
              <span className="dashboard-action-icon">🔢</span>
              <span className="dashboard-action-label">Establecer stock masivo</span>
              <span className="dashboard-action-desc">Ajustar stock de varios productos a un valor</span>
            </button>
            <button type="button" className="dashboard-action-btn" onClick={handleOpenProductForm}>
              <span className="dashboard-action-icon">📦</span>
              <span className="dashboard-action-label">Nuevo producto</span>
              <span className="dashboard-action-desc">Añadir un producto al inventario</span>
            </button>
          </>
        )}
        {canAccessPurchases && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchaseCart}>
            <span className="dashboard-action-icon">🛒</span>
            <span className="dashboard-action-label">Nueva compra a proveedores</span>
            <span className="dashboard-action-desc">Ir al carrito y crear una compra</span>
          </button>
        )}
        {isElectron() && canAccessSettings && canAccessLocalServers && (
          <button type="button" className="dashboard-action-btn dashboard-action-servers" onClick={handleActivarServidores}>
            <span className="dashboard-action-icon">🚀</span>
            <span className="dashboard-action-label">Iniciar servidores locales</span>
            <span className="dashboard-action-desc">Activar los servidores configurados con un clic</span>
          </button>
        )}
      </div>

      {showStockManager && (
        <StockManager
          products={products}
          onClose={handleCloseStockManager}
          onSave={handleCloseStockManager}
          onlySetStock
        />
      )}
      {showProductForm && (
        <div className="dashboard-modal-overlay" onClick={handleCloseProductForm}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h3 className="dashboard-modal-title">Nuevo producto</h3>
              <button type="button" className="dashboard-modal-close" onClick={handleCloseProductForm}>✕</button>
            </div>
            <ProductForm product={null} onClose={handleCloseProductForm} onSave={handleCloseProductForm} />
          </div>
        </div>
      )}
    </div>
  );

  const renderAlmacenDashboard = () => (
    <div className="dashboard-actions">
      <h2 className="dashboard-actions-title">Acciones rápidas</h2>
      <div className="dashboard-actions-grid">
        {canAccessInventory && (
          <>
            <button
              type="button"
              className="dashboard-action-btn"
              onClick={handleOpenStockManager}
              disabled={productsLoading}
            >
              <span className="dashboard-action-icon">🔢</span>
              <span className="dashboard-action-label">Establecer stock masivo</span>
              <span className="dashboard-action-desc">Ajustar stock de varios productos a un valor</span>
            </button>
            <button type="button" className="dashboard-action-btn" onClick={handleOpenProductForm}>
              <span className="dashboard-action-icon">➕</span>
              <span className="dashboard-action-label">Nuevo producto</span>
              <span className="dashboard-action-desc">Añadir un producto al inventario</span>
            </button>
          </>
        )}
        {canAccessPurchases && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchaseCart}>
            <span className="dashboard-action-icon">🛒</span>
            <span className="dashboard-action-label">Nueva compra a proveedores</span>
            <span className="dashboard-action-desc">Ir al carrito de compras</span>
          </button>
        )}
        {allowedViewIds.filter((id) => !['inventory', 'purchases'].includes(id)).map((viewId) => renderShortcut(viewId))}
      </div>

      {showStockManager && (
        <StockManager
          products={products}
          onClose={handleCloseStockManager}
          onSave={handleCloseStockManager}
          onlySetStock
        />
      )}
      {showProductForm && (
        <div className="dashboard-modal-overlay" onClick={handleCloseProductForm}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h3 className="dashboard-modal-title">Nuevo producto</h3>
              <button type="button" className="dashboard-modal-close" onClick={handleCloseProductForm}>✕</button>
            </div>
            <ProductForm product={null} onClose={handleCloseProductForm} onSave={handleCloseProductForm} />
          </div>
        </div>
      )}
    </div>
  );

  const renderRestauranteDashboard = () => (
    <div className="dashboard-actions">
      <h2 className="dashboard-actions-title">Acciones rápidas</h2>
      <div className="dashboard-actions-grid">
        {allowedViewIds.map((viewId) => renderShortcut(viewId))}
        {isElectron() && canAccessSettings && canAccessLocalServers && (
          <button type="button" className="dashboard-action-btn dashboard-action-servers" onClick={handleActivarServidores}>
            <span className="dashboard-action-icon">🚀</span>
            <span className="dashboard-action-label">Iniciar servidores locales</span>
            <span className="dashboard-action-desc">Activar los servidores configurados con un clic</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">📊 Inicio</h1>
        <p className="dashboard-subtitle">
          Bienvenido, {session?.user?.email || 'Usuario'}
        </p>
      </div>

      <div className="dashboard-content">
        {dashboardVariant === 'admin' && renderAdminDashboard()}
        {dashboardVariant === 'almacen' && renderAlmacenDashboard()}
        {dashboardVariant === 'restaurante' && renderRestauranteDashboard()}
      </div>
    </div>
  );
}

export default Dashboard;
