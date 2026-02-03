/**
 * Página Orders
 * Gestión de pedidos - Dashboard (Estado de pedidos) y vistas según el cargo
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';
import { getOrderStats } from '../../services/orders';
import ShoppingCart from '../../components/ShoppingCart/ShoppingCart';
import OrdersList from '../../components/OrdersList/OrdersList';
import MyOrders from '../../components/MyOrders/MyOrders';
import StatCard from '../../components/StatCard/StatCard';
import { FILTER_INCIDENTS } from '../../utils/orderStatus';
import './Orders.css';

function Orders() {
  const [currentUser, setCurrentUser] = useState(null);
  const [restauranteView, setRestauranteView] = useState('cart'); // 'cart' o 'orders'
  const [ordersDashboard, setOrdersDashboard] = useState({
    stats: { pending: 0, processing: 0, completedToday: 0, cancelled: 0, averageProcessingTime: 0, rotation24h: 0, rotation7d: 0, incidents: 0, incidentsWeekly: 0 },
    loading: true,
  });
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const { roleName, isRestaurante, isAlmacen, isAdmin, loading: roleLoading } = useRole(currentUser?.id);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // Cargar dashboard de pedidos (solo estadísticas)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setOrdersDashboard(prev => ({ ...prev, loading: true }));
      try {
        const stats = await getOrderStats();
        if (cancelled) return;
        setOrdersDashboard({ stats, loading: false });
      } catch (err) {
        if (!cancelled) setOrdersDashboard(prev => ({ ...prev, loading: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Si hay un pedido seleccionado desde el Dashboard, cambiar a la vista de pedidos
  useEffect(() => {
    const selectedOrderId = sessionStorage.getItem('selectedOrderId');
    if (selectedOrderId && isRestaurante) {
      setRestauranteView('orders');
    }
  }, [isRestaurante]);

  const formatProcessingTime = useCallback((hours) => {
    if (!hours || hours === 0) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${hours.toFixed(1)} h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours < 1 ? `${days} día${days !== 1 ? 's' : ''}` : `${days}d ${remainingHours.toFixed(1)}h`;
  }, []);

  const handleOrderStatusFilter = (status) => {
    sessionStorage.setItem('ordersStatusFilter', status);
    setListRefreshKey(k => k + 1);
    if (isRestaurante) setRestauranteView('orders');
  };

  /* Mismo orden que Purchases: Pendientes, En proceso, Incidencias, Completados, Cancelados, Rotación */
  const orderCards = useMemo(() => [
    { id: 'pending', icon: '⏳', title: 'Pendientes', value: ordersDashboard.stats.pending, color: '#F59E0B', description: 'Esperando procesamiento', clickable: true, onClick: () => handleOrderStatusFilter('pending') },
    { id: 'processing', icon: '⚙️', title: 'En Proceso', value: ordersDashboard.stats.processing, color: '#3B82F6', description: 'Siendo preparados', clickable: true, onClick: () => handleOrderStatusFilter('processing') },
    { id: 'incidents', icon: '⚠️', title: 'Incidencias (semana)', value: ordersDashboard.stats.incidentsWeekly ?? 0, color: '#DC2626', description: 'Pedidos con cantidad enviada distinta a la solicitada en los últimos 7 días', clickable: true, onClick: () => handleOrderStatusFilter(FILTER_INCIDENTS) },
    { id: 'completed', icon: '✅', title: 'Completados (hoy)', value: ordersDashboard.stats.completedToday ?? 0, color: '#10B981', description: 'Completados hoy', clickable: true, onClick: () => handleOrderStatusFilter('completed') },
    { id: 'cancelled', icon: '❌', title: 'Cancelados', value: ordersDashboard.stats.cancelled, color: '#DC2626', description: 'Pedidos cancelados', clickable: true, onClick: () => handleOrderStatusFilter('cancelled') },
    { id: 'rotation', icon: '🔄', title: 'Rotación (24h)', value: ordersDashboard.stats.rotation24h, color: '#8B5CF6', description: `Completados en últimas 24h | Promedio: ${formatProcessingTime(ordersDashboard.stats.averageProcessingTime)}`, clickable: false },
  ], [ordersDashboard.stats, formatProcessingTime]);

  const renderOrdersDashboard = () => (
    <div className="orders-dashboard">
      <h2 className="orders-dashboard-section-title">📋 Estado de pedidos</h2>
      {ordersDashboard.loading ? (
        <div className="orders-dashboard-loading">
          <div className="orders-dashboard-spinner" />
          <p>Cargando estadísticas...</p>
        </div>
      ) : (
        <div className="orders-dashboard-grid">
          {orderCards.map((card) => (
            <StatCard key={card.id} {...card} />
          ))}
        </div>
      )}
    </div>
  );

  // Mostrar vista con pestañas para usuarios de restaurante
  if (isRestaurante) {
    return (
      <div className="orders-container">
        <div className="orders-header">
          <h1 className="orders-title">🛒 Pedidos</h1>
          <p className="orders-subtitle">Gestiona tus pedidos al almacén</p>
        </div>
        {renderOrdersDashboard()}
        <div className="orders-tabs">
          <button
            className={`orders-tab ${restauranteView === 'cart' ? 'active' : ''}`}
            onClick={() => setRestauranteView('cart')}
          >
            🛒 Hacer Pedido
          </button>
          <button
            className={`orders-tab ${restauranteView === 'orders' ? 'active' : ''}`}
            onClick={() => setRestauranteView('orders')}
          >
            📋 Mis Pedidos
          </button>
        </div>
        <div className="orders-content">
          {restauranteView === 'cart' ? (
            <ShoppingCart 
              userId={currentUser?.id}
              onOrderCreated={() => { setRestauranteView('orders'); setListRefreshKey(k => k + 1); }}
            />
          ) : (
            <MyOrders key={listRefreshKey} userId={currentUser?.id} />
          )}
        </div>
      </div>
    );
  }

  // Mostrar lista de pedidos para almacén y admin
  if (isAlmacen || isAdmin) {
    return (
      <div className="orders-container">
        <div className="orders-header">
          <h1 className="orders-title">🛒 Pedidos</h1>
          <p className="orders-subtitle">Gestiona todos los pedidos</p>
        </div>
        {renderOrdersDashboard()}
        <div className="orders-content">
          <OrdersList key={listRefreshKey} userId={currentUser?.id} />
        </div>
      </div>
    );
  }

  // Cargando o sin acceso
  if (roleLoading) {
    return (
      <div className="orders-container">
        <div className="orders-loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <div className="orders-error">
        <h2>Acceso Denegado</h2>
        <p>No tienes permisos para acceder a esta sección.</p>
      </div>
    </div>
  );
}

export default Orders;

