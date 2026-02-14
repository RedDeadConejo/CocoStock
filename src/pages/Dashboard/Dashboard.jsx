/**
 * Página Dashboard
 * Tres variantes según rol/permisos: admin, almacén, restaurante.
 * Cada una muestra atajos a secciones permitidas (sin métricas).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getProducts } from '../../services/products';
import { getAllMerma } from '../../services/merma';
import { getOrders } from '../../services/orders';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';
import { VIEW_IDS } from '../../services/roleManagement';
import { getHiddenShortcuts, setHiddenShortcuts as persistHiddenShortcuts } from '../../utils/dashboardShortcuts';
import { formatDate } from '../../utils/formatters';
import ProductForm from '../../components/ProductForm/ProductForm';
import StockManager from '../../components/StockManager/StockManager';
import './Dashboard.css';

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
  const { roleName, permissions, isAdmin, isAlmacen, isGestorAlmacen, isRestaurante } = useRole(userId);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showStockManager, setShowStockManager] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [hiddenShortcuts, setHiddenShortcuts] = useState([]);
  const [showCustomizeShortcuts, setShowCustomizeShortcuts] = useState(false);
  const [recentMerma, setRecentMerma] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentRecordsLoading, setRecentRecordsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getHiddenShortcuts(userId).then(setHiddenShortcuts);
  }, [userId]);

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
    // El resto solo por permiso explícito (los nombres de rol pueden cambiar)
    if (permissions.dashboard_gestor_almacen === true) return 'gestor_almacen';
    if (permissions.dashboard_almacen === true) return 'almacen';
    if (permissions.dashboard_restaurante === true) return 'restaurante';
    return 'default';
  }, [roleName, permissions, isAdmin, viewPermissionsMap]);

  const canAccessInventory = canAccessView('inventory');
  const canAccessPurchases = canAccessView('purchases');
  const canAccessSettings = canAccessView('settings');
  const canAccessLocalServers = isAdmin || permissions.view_settings_local_servers === true;

  useEffect(() => {
    if (canAccessInventory && (dashboardVariant === 'almacen' || dashboardVariant === 'admin' || dashboardVariant === 'gestor_almacen')) {
      loadProducts();
    }
  }, [dashboardVariant, canAccessInventory]);

  useEffect(() => {
    if (dashboardVariant !== 'admin') return;
    let cancelled = false;
    setRecentRecordsLoading(true);
    Promise.all([
      getAllMerma({ limit: 40 }),
      getOrders(null, null).then((list) => (Array.isArray(list) ? list.slice(0, 25) : [])),
    ])
      .then(([merma, orders]) => {
        if (!cancelled) {
          setRecentMerma(merma || []);
          setRecentOrders(orders || []);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn('[Dashboard] Error al cargar últimos registros:', err);
      })
      .finally(() => {
        if (!cancelled) setRecentRecordsLoading(false);
      });
    return () => { cancelled = true; };
  }, [dashboardVariant]);

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

  const handleGoToInventoryLowStock = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('inventoryStockFilter', 'low');
    if (onNavigate) onNavigate('inventory');
  };

  const handleGoToOrdersPending = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('ordersStatusFilter', 'pending');
    if (onNavigate) onNavigate('orders');
  };

  const handleGoToOrdersProcessing = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('ordersStatusFilter', 'processing');
    if (onNavigate) onNavigate('orders');
  };

  const handleGoToPurchasesPending = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('purchasesStatusFilter', 'pending');
    if (onNavigate) onNavigate('purchases');
  };

  const handleGoToMermaForm = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('mermaOpenForm', 'true');
    if (onNavigate) onNavigate('merma');
  };

  const handleGoToSettingsLocalServers = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('settingsOpenTab', 'local-servers');
    if (onNavigate) onNavigate('settings');
  };

  const handleGoToSettingsAuthorizedIps = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('settingsOpenTab', 'authorized-ips');
    if (onNavigate) onNavigate('settings');
  };

  const canAccessOrders = canAccessView('orders');
  const canAccessMerma = canAccessView('merma');
  const canAccessSettingsAuthorizedIps = isAdmin || permissions.view_settings_authorized_ips === true;
  const canAccessSettingsRoles = isAdmin || permissions.view_settings_roles === true;
  const canAccessSettingsUsers = isAdmin || permissions.view_settings_users === true;
  const canAccessSettingsRestaurants = isAdmin || permissions.view_settings_restaurants === true;

  const isShortcutHidden = useCallback((id) => hiddenShortcuts.includes(id), [hiddenShortcuts]);

  const availableShortcutsForModal = useMemo(() => {
    const viewItems = allowedViewIds.map((id) => ({ id, label: VIEW_LABELS[id]?.label || id }));
    const actionItems = [];
    const add = (id, label) => actionItems.push({ id, label });

    switch (dashboardVariant) {
      case 'admin':
        if (canAccessSettingsRoles) add('action_new_role', 'Nuevo rol');
        if (canAccessSettingsUsers) add('action_new_user', 'Nuevo usuario');
        if (canAccessSettingsRestaurants) add('action_new_restaurant', 'Nuevo restaurante');
        if (canAccessInventory) {
          add('action_stock_mass', 'Establecer stock masivo');
          add('action_new_product', 'Nuevo producto');
          add('action_inventory_low_stock', 'Inventario con stock bajo');
        }
        if (canAccessPurchases) {
          add('action_purchase_cart', 'Nueva compra a proveedores');
          add('action_purchases_pending', 'Compras pendientes');
        }
        if (isElectron() && canAccessSettings && canAccessLocalServers) {
          add('action_servers_start', 'Iniciar servidores locales');
          add('action_servers_config', 'Configurar servidores locales');
        }
        if (canAccessOrders) {
          add('action_orders_pending', 'Pedidos pendientes');
          add('action_orders_processing', 'Pedidos en proceso');
        }
        if (canAccessMerma) add('action_merma_form', 'Registrar merma');
        if (canAccessSettingsAuthorizedIps) add('action_ips_authorized', 'IPs autorizadas');
        break;
      case 'almacen':
      case 'gestor_almacen':
        if (canAccessInventory) {
          add('action_stock_mass', 'Establecer stock masivo');
          add('action_new_product', 'Nuevo producto');
          add('action_inventory_low_stock', 'Inventario con stock bajo');
        }
        if (canAccessPurchases) {
          add('action_purchase_cart', 'Nueva compra a proveedores');
          add('action_purchases_pending', 'Compras pendientes');
        }
        if (canAccessOrders) {
          add('action_orders_pending', 'Pedidos pendientes');
          add('action_orders_processing', 'Pedidos en proceso');
        }
        if (canAccessMerma) add('action_merma_form', 'Registrar merma');
        if (canAccessSettings && canAccessLocalServers) add('action_servers_config', 'Configurar servidores locales');
        break;
      case 'restaurante':
      case 'default':
        if (isElectron() && canAccessSettings && canAccessLocalServers) add('action_servers_start', 'Iniciar servidores locales');
        if (canAccessInventory) add('action_inventory_low_stock', 'Inventario con stock bajo');
        if (canAccessOrders) {
          add('action_orders_pending', 'Pedidos pendientes');
          add('action_orders_processing', 'Pedidos en proceso');
        }
        if (canAccessPurchases) add('action_purchases_pending', 'Compras pendientes');
        if (canAccessMerma) add('action_merma_form', 'Registrar merma');
        if (canAccessSettings && canAccessLocalServers) add('action_servers_config', 'Configurar servidores locales');
        if (dashboardVariant === 'default' && canAccessSettingsAuthorizedIps) add('action_ips_authorized', 'IPs autorizadas');
        break;
      default:
        break;
    }
    return [...viewItems, ...actionItems];
  }, [
    dashboardVariant,
    allowedViewIds,
    canAccessSettingsRoles,
    canAccessSettingsUsers,
    canAccessSettingsRestaurants,
    canAccessInventory,
    canAccessPurchases,
    canAccessOrders,
    canAccessMerma,
    canAccessSettings,
    canAccessLocalServers,
    canAccessSettingsAuthorizedIps,
  ]);

  const handleToggleShortcut = useCallback((shortcutId) => {
    const next = hiddenShortcuts.includes(shortcutId)
      ? hiddenShortcuts.filter((id) => id !== shortcutId)
      : [...hiddenShortcuts, shortcutId];
    setHiddenShortcuts(next);
    persistHiddenShortcuts(userId, next);
  }, [userId, hiddenShortcuts]);

  const recentRecordsByRestaurant = useMemo(() => {
    const byId = new Map();
    const addRestaurant = (id, name) => {
      if (!id) return;
      if (!byId.has(id)) byId.set(id, { id, name: name || `Restaurante ${id}`, merma: [], orders: [] });
    };
    recentMerma.forEach((m) => {
      const rid = m.restaurant_id || m.restaurant?.id;
      if (!rid) return;
      const name = m.restaurant?.nombre;
      addRestaurant(rid, name);
      byId.get(rid).merma.push(m);
    });
    recentOrders.forEach((o) => {
      const rid = o.restaurant_id || o.restaurants?.id;
      if (!rid) return;
      const name = o.restaurants?.nombre;
      addRestaurant(rid, name);
      byId.get(rid).orders.push(o);
    });
    return Array.from(byId.values())
      .map((r) => ({
        ...r,
        merma: r.merma.slice(0, 5),
        orders: r.orders.slice(0, 5),
      }))
      .sort((a, b) => {
        const lastA = Math.max(
          ...a.merma.map((m) => new Date(m.fecha).getTime()),
          ...a.orders.map((o) => new Date(o.created_at).getTime()),
          0
        );
        const lastB = Math.max(
          ...b.merma.map((m) => new Date(m.fecha).getTime()),
          ...b.orders.map((o) => new Date(o.created_at).getTime()),
          0
        );
        return lastB - lastA;
      });
  }, [recentMerma, recentOrders]);

  const renderShortcut = (viewId) => {
    if (isShortcutHidden(viewId)) return null;
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

  const renderAdminDashboard = () => (
    <div className="dashboard-actions">
      <div className="dashboard-actions-header">
        <div>
          <h2 className="dashboard-actions-title">Acciones rápidas</h2>
          <p className="dashboard-actions-subtitle">
            Tareas que no están en el menú lateral: abrir formularios y flujos concretos en un clic.
          </p>
        </div>
        <button type="button" className="dashboard-customize-btn" onClick={() => setShowCustomizeShortcuts(true)} title="Mostrar u ocultar atajos">
          ⚙️ Personalizar atajos
        </button>
      </div>
      <div className="dashboard-actions-grid">
        {canAccessSettingsRoles && !isShortcutHidden('action_new_role') && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenNewRole}>
            <span className="dashboard-action-icon">👤</span>
            <span className="dashboard-action-label">Nuevo rol</span>
            <span className="dashboard-action-desc">Crear un rol con permisos personalizados</span>
          </button>
        )}
        {canAccessSettingsUsers && !isShortcutHidden('action_new_user') && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenNewUser}>
            <span className="dashboard-action-icon">➕</span>
            <span className="dashboard-action-label">Nuevo usuario</span>
            <span className="dashboard-action-desc">Dar de alta un usuario en la app</span>
          </button>
        )}
        {canAccessSettingsRestaurants && !isShortcutHidden('action_new_restaurant') && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenNewRestaurant}>
            <span className="dashboard-action-icon">🏢</span>
            <span className="dashboard-action-label">Nuevo restaurante</span>
            <span className="dashboard-action-desc">Añadir un local/restaurante al sistema</span>
          </button>
        )}
        {canAccessInventory && !isShortcutHidden('action_stock_mass') && (
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
        )}
        {canAccessInventory && !isShortcutHidden('action_new_product') && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenProductForm}>
            <span className="dashboard-action-icon">📦</span>
            <span className="dashboard-action-label">Nuevo producto</span>
            <span className="dashboard-action-desc">Añadir un producto al inventario</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchase_cart') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchaseCart}>
            <span className="dashboard-action-icon">🛒</span>
            <span className="dashboard-action-label">Nueva compra a proveedores</span>
            <span className="dashboard-action-desc">Ir al carrito y crear una compra</span>
          </button>
        )}
        {isElectron() && canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_start') && (
          <button type="button" className="dashboard-action-btn dashboard-action-servers" onClick={handleActivarServidores}>
            <span className="dashboard-action-icon">🚀</span>
            <span className="dashboard-action-label">Iniciar servidores locales</span>
            <span className="dashboard-action-desc">Activar los servidores configurados con un clic</span>
          </button>
        )}
        {canAccessInventory && !isShortcutHidden('action_inventory_low_stock') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToInventoryLowStock}>
            <span className="dashboard-action-icon">⚠️</span>
            <span className="dashboard-action-label">Inventario con stock bajo</span>
            <span className="dashboard-action-desc">Ver productos con stock bajo o en alerta</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersPending}>
            <span className="dashboard-action-icon">⏳</span>
            <span className="dashboard-action-label">Pedidos pendientes</span>
            <span className="dashboard-action-desc">Ir a pedidos filtrados por pendientes</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_processing') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersProcessing}>
            <span className="dashboard-action-icon">⚙️</span>
            <span className="dashboard-action-label">Pedidos en proceso</span>
            <span className="dashboard-action-desc">Ir a pedidos en preparación</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchases_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchasesPending}>
            <span className="dashboard-action-icon">📋</span>
            <span className="dashboard-action-label">Compras pendientes</span>
            <span className="dashboard-action-desc">Ir a compras filtradas por pendientes</span>
          </button>
        )}
        {canAccessMerma && !isShortcutHidden('action_merma_form') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToMermaForm}>
            <span className="dashboard-action-icon">📝</span>
            <span className="dashboard-action-label">Registrar merma</span>
            <span className="dashboard-action-desc">Abrir formulario de registro de pérdidas</span>
          </button>
        )}
        {canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_config') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsLocalServers}>
            <span className="dashboard-action-icon">🖥️</span>
            <span className="dashboard-action-label">Configurar servidores locales</span>
            <span className="dashboard-action-desc">Gestionar servidores de merma y app local</span>
          </button>
        )}
        {canAccessSettingsAuthorizedIps && !isShortcutHidden('action_ips_authorized') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsAuthorizedIps}>
            <span className="dashboard-action-icon">🔒</span>
            <span className="dashboard-action-label">IPs autorizadas</span>
            <span className="dashboard-action-desc">Ver o editar direcciones IP permitidas</span>
          </button>
        )}
      </div>

      <section className="dashboard-recent-records" aria-labelledby="dashboard-recent-title">
        <h2 id="dashboard-recent-title" className="dashboard-recent-title">Últimos registros por restaurante</h2>
        {recentRecordsLoading ? (
          <p className="dashboard-recent-loading">Cargando registros...</p>
        ) : recentRecordsByRestaurant.length === 0 ? (
          <p className="dashboard-recent-empty">No hay registros recientes.</p>
        ) : (
          <div className="dashboard-recent-list">
            {recentRecordsByRestaurant.map((rest) => (
              <div key={rest.id} className="dashboard-recent-card">
                <h3 className="dashboard-recent-rest-name">{rest.name}</h3>
                <div className="dashboard-recent-blocks">
                  {rest.merma.length > 0 && (
                    <div className="dashboard-recent-block">
                      <h4 className="dashboard-recent-block-title">📉 Últimas mermas</h4>
                      <ul className="dashboard-recent-ul">
                        {rest.merma.map((m) => (
                          <li key={m.id} className="dashboard-recent-li">
                            <span className="dashboard-recent-date">{formatDate(m.fecha, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            <span>{m.product?.nombre || 'Producto'} · {Number(m.quantity)} {m.product?.medida || ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rest.orders.length > 0 && (
                    <div className="dashboard-recent-block">
                      <h4 className="dashboard-recent-block-title">🛒 Últimos pedidos</h4>
                      <ul className="dashboard-recent-ul">
                        {rest.orders.map((o) => (
                          <li key={o.id} className="dashboard-recent-li">
                            <span className="dashboard-recent-date">{formatDate(o.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            <span>Estado: {o.status || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
      <div className="dashboard-actions-header">
        <h2 className="dashboard-actions-title">Acciones rápidas</h2>
        <button type="button" className="dashboard-customize-btn" onClick={() => setShowCustomizeShortcuts(true)} title="Mostrar u ocultar atajos">
          ⚙️ Personalizar atajos
        </button>
      </div>
      <div className="dashboard-actions-grid">
        {canAccessInventory && !isShortcutHidden('action_stock_mass') && (
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
        )}
        {canAccessInventory && !isShortcutHidden('action_new_product') && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenProductForm}>
            <span className="dashboard-action-icon">➕</span>
            <span className="dashboard-action-label">Nuevo producto</span>
            <span className="dashboard-action-desc">Añadir un producto al inventario</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchase_cart') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchaseCart}>
            <span className="dashboard-action-icon">🛒</span>
            <span className="dashboard-action-label">Nueva compra a proveedores</span>
            <span className="dashboard-action-desc">Ir al carrito de compras</span>
          </button>
        )}
        {allowedViewIds.filter((id) => !['inventory', 'purchases'].includes(id)).map((viewId) => renderShortcut(viewId))}
        {canAccessInventory && !isShortcutHidden('action_inventory_low_stock') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToInventoryLowStock}>
            <span className="dashboard-action-icon">⚠️</span>
            <span className="dashboard-action-label">Inventario con stock bajo</span>
            <span className="dashboard-action-desc">Ver productos con stock bajo o en alerta</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersPending}>
            <span className="dashboard-action-icon">⏳</span>
            <span className="dashboard-action-label">Pedidos pendientes</span>
            <span className="dashboard-action-desc">Ir a pedidos filtrados por pendientes</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_processing') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersProcessing}>
            <span className="dashboard-action-icon">⚙️</span>
            <span className="dashboard-action-label">Pedidos en proceso</span>
            <span className="dashboard-action-desc">Ir a pedidos en preparación</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchases_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchasesPending}>
            <span className="dashboard-action-icon">📋</span>
            <span className="dashboard-action-label">Compras pendientes</span>
            <span className="dashboard-action-desc">Ir a compras filtradas por pendientes</span>
          </button>
        )}
        {canAccessMerma && !isShortcutHidden('action_merma_form') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToMermaForm}>
            <span className="dashboard-action-icon">📝</span>
            <span className="dashboard-action-label">Registrar merma</span>
            <span className="dashboard-action-desc">Abrir formulario de registro de pérdidas</span>
          </button>
        )}
        {canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_config') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsLocalServers}>
            <span className="dashboard-action-icon">🖥️</span>
            <span className="dashboard-action-label">Configurar servidores locales</span>
            <span className="dashboard-action-desc">Gestionar servidores de merma y app local</span>
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

  const renderGestorAlmacenDashboard = () => (
    <div className="dashboard-actions">
      <div className="dashboard-actions-header">
        <div>
          <h2 className="dashboard-actions-title">Gestor de almacén</h2>
          <p className="dashboard-actions-subtitle">
            Acciones rápidas para inventario, compras y gestión del almacén.
          </p>
        </div>
        <button type="button" className="dashboard-customize-btn" onClick={() => setShowCustomizeShortcuts(true)} title="Mostrar u ocultar atajos">
          ⚙️ Personalizar atajos
        </button>
      </div>
      <div className="dashboard-actions-grid">
        {canAccessInventory && !isShortcutHidden('action_stock_mass') && (
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
        )}
        {canAccessInventory && !isShortcutHidden('action_new_product') && (
          <button type="button" className="dashboard-action-btn" onClick={handleOpenProductForm}>
            <span className="dashboard-action-icon">📦</span>
            <span className="dashboard-action-label">Nuevo producto</span>
            <span className="dashboard-action-desc">Añadir un producto al inventario</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchase_cart') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchaseCart}>
            <span className="dashboard-action-icon">🛒</span>
            <span className="dashboard-action-label">Nueva compra a proveedores</span>
            <span className="dashboard-action-desc">Ir al carrito de compras</span>
          </button>
        )}
        {allowedViewIds.filter((id) => !['inventory', 'purchases'].includes(id)).map((viewId) => renderShortcut(viewId))}
        {canAccessInventory && !isShortcutHidden('action_inventory_low_stock') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToInventoryLowStock}>
            <span className="dashboard-action-icon">⚠️</span>
            <span className="dashboard-action-label">Inventario con stock bajo</span>
            <span className="dashboard-action-desc">Ver productos con stock bajo o en alerta</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersPending}>
            <span className="dashboard-action-icon">⏳</span>
            <span className="dashboard-action-label">Pedidos pendientes</span>
            <span className="dashboard-action-desc">Ir a pedidos filtrados por pendientes</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_processing') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersProcessing}>
            <span className="dashboard-action-icon">⚙️</span>
            <span className="dashboard-action-label">Pedidos en proceso</span>
            <span className="dashboard-action-desc">Ir a pedidos en preparación</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchases_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchasesPending}>
            <span className="dashboard-action-icon">📋</span>
            <span className="dashboard-action-label">Compras pendientes</span>
            <span className="dashboard-action-desc">Ir a compras filtradas por pendientes</span>
          </button>
        )}
        {canAccessMerma && !isShortcutHidden('action_merma_form') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToMermaForm}>
            <span className="dashboard-action-icon">📝</span>
            <span className="dashboard-action-label">Registrar merma</span>
            <span className="dashboard-action-desc">Abrir formulario de registro de pérdidas</span>
          </button>
        )}
        {canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_config') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsLocalServers}>
            <span className="dashboard-action-icon">🖥️</span>
            <span className="dashboard-action-label">Configurar servidores locales</span>
            <span className="dashboard-action-desc">Gestionar servidores de merma y app local</span>
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

  const renderRestauranteDashboard = () => (
    <div className="dashboard-actions">
      <div className="dashboard-actions-header">
        <h2 className="dashboard-actions-title">Acciones rápidas</h2>
        <button type="button" className="dashboard-customize-btn" onClick={() => setShowCustomizeShortcuts(true)} title="Mostrar u ocultar atajos">
          ⚙️ Personalizar atajos
        </button>
      </div>
      <div className="dashboard-actions-grid">
        {allowedViewIds.map((viewId) => renderShortcut(viewId))}
        {isElectron() && canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_start') && (
          <button type="button" className="dashboard-action-btn dashboard-action-servers" onClick={handleActivarServidores}>
            <span className="dashboard-action-icon">🚀</span>
            <span className="dashboard-action-label">Iniciar servidores locales</span>
            <span className="dashboard-action-desc">Activar los servidores configurados con un clic</span>
          </button>
        )}
        {canAccessInventory && !isShortcutHidden('action_inventory_low_stock') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToInventoryLowStock}>
            <span className="dashboard-action-icon">⚠️</span>
            <span className="dashboard-action-label">Inventario con stock bajo</span>
            <span className="dashboard-action-desc">Ver productos con stock bajo o en alerta</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersPending}>
            <span className="dashboard-action-icon">⏳</span>
            <span className="dashboard-action-label">Pedidos pendientes</span>
            <span className="dashboard-action-desc">Ir a pedidos filtrados por pendientes</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_processing') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersProcessing}>
            <span className="dashboard-action-icon">⚙️</span>
            <span className="dashboard-action-label">Pedidos en proceso</span>
            <span className="dashboard-action-desc">Ir a pedidos en preparación</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchases_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchasesPending}>
            <span className="dashboard-action-icon">📋</span>
            <span className="dashboard-action-label">Compras pendientes</span>
            <span className="dashboard-action-desc">Ir a compras filtradas por pendientes</span>
          </button>
        )}
        {canAccessMerma && !isShortcutHidden('action_merma_form') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToMermaForm}>
            <span className="dashboard-action-icon">📝</span>
            <span className="dashboard-action-label">Registrar merma</span>
            <span className="dashboard-action-desc">Abrir formulario de registro de pérdidas</span>
          </button>
        )}
        {canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_config') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsLocalServers}>
            <span className="dashboard-action-icon">🖥️</span>
            <span className="dashboard-action-label">Configurar servidores locales</span>
            <span className="dashboard-action-desc">Gestionar servidores de merma y app local</span>
          </button>
        )}
      </div>
    </div>
  );

  /** Dashboard genérico cuando solo tiene "Inicio" y ningún permiso de dashboard concreto */
  const renderDefaultDashboard = () => (
    <div className="dashboard-actions">
      <div className="dashboard-actions-header">
        <div>
          <h2 className="dashboard-actions-title">Acciones rápidas</h2>
          <p className="dashboard-actions-subtitle">
            Accede a las secciones permitidas para tu rol.
          </p>
        </div>
        <button type="button" className="dashboard-customize-btn" onClick={() => setShowCustomizeShortcuts(true)} title="Mostrar u ocultar atajos">
          ⚙️ Personalizar atajos
        </button>
      </div>
      <div className="dashboard-actions-grid">
        {allowedViewIds.map((viewId) => renderShortcut(viewId))}
        {isElectron() && canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_start') && (
          <button type="button" className="dashboard-action-btn dashboard-action-servers" onClick={handleActivarServidores}>
            <span className="dashboard-action-icon">🚀</span>
            <span className="dashboard-action-label">Iniciar servidores locales</span>
            <span className="dashboard-action-desc">Activar los servidores configurados con un clic</span>
          </button>
        )}
        {canAccessInventory && !isShortcutHidden('action_inventory_low_stock') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToInventoryLowStock}>
            <span className="dashboard-action-icon">⚠️</span>
            <span className="dashboard-action-label">Inventario con stock bajo</span>
            <span className="dashboard-action-desc">Ver productos con stock bajo o en alerta</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersPending}>
            <span className="dashboard-action-icon">⏳</span>
            <span className="dashboard-action-label">Pedidos pendientes</span>
            <span className="dashboard-action-desc">Ir a pedidos filtrados por pendientes</span>
          </button>
        )}
        {canAccessOrders && !isShortcutHidden('action_orders_processing') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToOrdersProcessing}>
            <span className="dashboard-action-icon">⚙️</span>
            <span className="dashboard-action-label">Pedidos en proceso</span>
            <span className="dashboard-action-desc">Ir a pedidos en preparación</span>
          </button>
        )}
        {canAccessPurchases && !isShortcutHidden('action_purchases_pending') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToPurchasesPending}>
            <span className="dashboard-action-icon">📋</span>
            <span className="dashboard-action-label">Compras pendientes</span>
            <span className="dashboard-action-desc">Ir a compras filtradas por pendientes</span>
          </button>
        )}
        {canAccessMerma && !isShortcutHidden('action_merma_form') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToMermaForm}>
            <span className="dashboard-action-icon">📝</span>
            <span className="dashboard-action-label">Registrar merma</span>
            <span className="dashboard-action-desc">Abrir formulario de registro de pérdidas</span>
          </button>
        )}
        {canAccessSettings && canAccessLocalServers && !isShortcutHidden('action_servers_config') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsLocalServers}>
            <span className="dashboard-action-icon">🖥️</span>
            <span className="dashboard-action-label">Configurar servidores locales</span>
            <span className="dashboard-action-desc">Gestionar servidores de merma y app local</span>
          </button>
        )}
        {canAccessSettingsAuthorizedIps && !isShortcutHidden('action_ips_authorized') && (
          <button type="button" className="dashboard-action-btn" onClick={handleGoToSettingsAuthorizedIps}>
            <span className="dashboard-action-icon">🔒</span>
            <span className="dashboard-action-label">IPs autorizadas</span>
            <span className="dashboard-action-desc">Ver o editar direcciones IP permitidas</span>
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
        {dashboardVariant === 'gestor_almacen' && renderGestorAlmacenDashboard()}
        {dashboardVariant === 'restaurante' && renderRestauranteDashboard()}
        {dashboardVariant === 'default' && renderDefaultDashboard()}
      </div>

      {showCustomizeShortcuts && (
        <div className="dashboard-modal-overlay" onClick={() => setShowCustomizeShortcuts(false)} role="dialog" aria-modal="true" aria-labelledby="dashboard-customize-title">
          <div className="dashboard-modal dashboard-customize-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h3 id="dashboard-customize-title" className="dashboard-modal-title">Personalizar atajos</h3>
              <button type="button" className="dashboard-modal-close" onClick={() => setShowCustomizeShortcuts(false)} aria-label="Cerrar">✕</button>
            </div>
            <p className="dashboard-customize-intro">
              Marca los atajos que quieres ver en Inicio. Los que desmarques se ocultarán.
            </p>
            <div className="dashboard-customize-list">
              {availableShortcutsForModal.map(({ id, label }) => (
                <label key={id} className="dashboard-customize-item">
                  <input
                    type="checkbox"
                    checked={!hiddenShortcuts.includes(id)}
                    onChange={() => handleToggleShortcut(id)}
                  />
                  <span className="dashboard-customize-label">{label}</span>
                </label>
              ))}
            </div>
            {availableShortcutsForModal.length === 0 && (
              <p className="dashboard-customize-empty">No hay atajos disponibles para tu rol.</p>
            )}
            <div className="dashboard-modal-actions">
              <button type="button" className="dashboard-btn-secondary" onClick={() => setShowCustomizeShortcuts(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
