/**
 * Componente MyOrders
 * Lista de pedidos del usuario de Restaurante
 */

import { useState, useEffect, useRef } from 'react';
import { getOrders, ORDER_STATUS } from '../../services/orders';
import { formatDateTime } from '../../utils/formatters';
import { getStatusLabel, getStatusBadgeClass, FILTER_INCIDENTS } from '../../utils/orderStatus';
import './MyOrders.css';

function MyOrders({ userId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const orderRefs = useRef({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Leer filtro desde sessionStorage al montar y establecerlo
  useEffect(() => {
    const savedFilter = sessionStorage.getItem('ordersStatusFilter');
    if (savedFilter) {
      setStatusFilter(savedFilter);
      sessionStorage.removeItem('ordersStatusFilter');
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (userId && isInitialized) {
      loadOrders();
      // Verificar si hay un pedido seleccionado desde el Dashboard
      const savedOrderId = sessionStorage.getItem('selectedOrderId');
      if (savedOrderId) {
        setSelectedOrderId(savedOrderId);
        sessionStorage.removeItem('selectedOrderId');
      }
    }
  }, [userId, statusFilter, isInitialized]);

  // Hacer scroll al pedido seleccionado cuando se carga
  useEffect(() => {
    if (selectedOrderId && orderRefs.current[selectedOrderId] && !loading) {
      setTimeout(() => {
        orderRefs.current[selectedOrderId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        // Remover el highlight después de 3 segundos
        setTimeout(() => {
          setSelectedOrderId(null);
        }, 3000);
      }, 100);
    }
  }, [selectedOrderId, loading]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      let data;
      if (statusFilter === FILTER_INCIDENTS) {
        data = await getOrders(userId, null);
        data = (data || []).filter((order) => hasOrderModifications(order.order_items));
      } else {
        const status = statusFilter !== 'all' ? statusFilter : null;
        data = await getOrders(userId, status);
      }
      setOrders(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };


  const getTotalQuantity = (items) => {
    return items.reduce((total, item) => {
      const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
      return total + quantityRequested;
    }, 0);
  };

  const hasOrderModifications = (items) => {
    return items?.some(item => {
      const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
      const quantitySentValue = item.quantity_sent !== null && item.quantity_sent !== undefined
        ? item.quantity_sent
        : quantityRequested;
      const quantitySent = parseFloat(quantitySentValue);
      return Math.abs(quantityRequested - quantitySent) > 0.01;
    });
  };

  return (
    <div className="my-orders-container">
      {error && (
        <div className="my-orders-message my-orders-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="my-orders-filters">
        <label htmlFor="status-filter" className="my-orders-filter-label">
          Filtrar por estado:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="my-orders-filter-select"
        >
          <option value="all">Todos</option>
          <option value={ORDER_STATUS.PENDING}>Pendientes</option>
          <option value={ORDER_STATUS.PROCESSING}>En Proceso</option>
          <option value={ORDER_STATUS.COMPLETED}>Completados</option>
          <option value={FILTER_INCIDENTS}>Incidencias</option>
          <option value={ORDER_STATUS.CANCELLED}>Cancelados</option>
        </select>
        <button
          className="my-orders-refresh-button"
          onClick={loadOrders}
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div className="my-orders-loading">Cargando pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="my-orders-empty">
          <p>No tienes pedidos {statusFilter !== 'all' ? `con filtro "${getStatusLabel(statusFilter)}"` : ''}</p>
          <p className="my-orders-empty-hint">
            Los pedidos que realices aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="my-orders-grid">
          {orders.map(order => (
            <div 
              key={order.id} 
              ref={(el) => { orderRefs.current[order.id] = el; }}
              className={`my-orders-card ${selectedOrderId === order.id ? 'my-orders-card-highlighted' : ''}`}
            >
              <div className="my-orders-card-header">
                <div className="my-orders-card-info">
                  <h3 className="my-orders-card-title">
                    Pedido #{order.id.substring(0, 8)}
                  </h3>
                  <p className="my-orders-card-date">
                    {formatDateTime(order.created_at)}
                  </p>
                  {order.restaurants && (
                    <p className="my-orders-card-restaurant">
                      🏪 {order.restaurants.nombre}
                    </p>
                  )}
                  {order.user_profiles && order.user_profiles.full_name && (
                    <p className="my-orders-card-user">
                      👤 {order.user_profiles.full_name}
                    </p>
                  )}
                </div>
                <div className={`my-orders-status-badge ${getStatusBadgeClass(order.status, 'my-orders-') || ''}`}>
                  {getStatusLabel(order.status)}
                </div>
              </div>

              <div className="my-orders-items">
                <h4 className="my-orders-items-title">
                  Productos ({order.order_items?.length || 0})
                </h4>
                <div className="my-orders-items-list">
                  {order.order_items?.map(item => {
                    const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
                    const quantitySentValue = item.quantity_sent !== null && item.quantity_sent !== undefined
                      ? item.quantity_sent
                      : quantityRequested;
                    const quantitySent = parseFloat(quantitySentValue);
                    const hasChanged = Math.abs(quantityRequested - quantitySent) > 0.01;
                    const itemClassName = `my-orders-item${hasChanged ? ' my-orders-item-modified' : ''}`;

                    return (
                      <div key={item.id} className={itemClassName}>
                        <div className="my-orders-item-info">
                          <span className="my-orders-item-name">
                            {item.product_name || item.products?.nombre || 'Producto eliminado'}
                          </span>
                          {item.products?.referencia && (
                            <span className="my-orders-item-ref">
                              Ref: {item.products.referencia}
                            </span>
                          )}
                        </div>
                        <div className="my-orders-item-quantities">
                          {hasChanged ? (
                            <>
                              <div className="my-orders-quantity-group">
                                <span className="my-orders-quantity-label">Pedido:</span>
                                <span className="my-orders-quantity-requested">
                                  {quantityRequested.toFixed(2)}
                                </span>
                              </div>
                              <div className="my-orders-quantity-separator">→</div>
                              <div className="my-orders-quantity-group">
                                <span className="my-orders-quantity-label">Enviado:</span>
                                <span className="my-orders-quantity-sent">
                                  {quantitySent.toFixed(2)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="my-orders-item-quantity-single">
                              {quantityRequested.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="my-orders-total">
                  Total items: {getTotalQuantity(order.order_items || [])}
                </div>
              </div>

              {order.notes && (
                <div className="my-orders-notes">
                  <strong>Notas:</strong> {order.notes}
                </div>
              )}

              {hasOrderModifications(order.order_items) && (
                <div className="my-orders-modified-info">
                  <span className="my-orders-modified-icon">⚠️</span>
                  <span>Algunas cantidades han sido modificadas por almacén. Revisa los detalles arriba.</span>
                </div>
              )}

              {order.status === ORDER_STATUS.COMPLETED && (
                <div className="my-orders-completed-info">
                  <span className="my-orders-completed-icon">✅</span>
                  <span>Tu pedido ha sido completado y está listo</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyOrders;

