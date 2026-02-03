/**
 * Componente OrdersList
 * Lista de pedidos para usuarios de Almacén y Admin
 */

import { useState, useEffect, useRef } from 'react';
import { getOrders, updateOrderStatus, updateOrderItemQuantitySent, ORDER_STATUS } from '../../services/orders';
import { formatDateTime } from '../../utils/formatters';
import { getStatusLabel, getStatusBadgeClass, FILTER_INCIDENTS } from '../../utils/orderStatus';
import './OrdersList.css';

function OrdersList({ userId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'processing', 'completed'
  const [editingQuantities, setEditingQuantities] = useState({}); // { itemId: quantitySent }
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
    if (isInitialized) {
      loadOrders();
      // Verificar si hay un pedido seleccionado desde el Dashboard
      const savedOrderId = sessionStorage.getItem('selectedOrderId');
      if (savedOrderId) {
        setSelectedOrderId(savedOrderId);
        sessionStorage.removeItem('selectedOrderId');
      }
    }
  }, [statusFilter, isInitialized]);

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

  const hasOrderIncidents = (order) => {
    return order?.order_items?.some((item) => {
      const requested = parseFloat(item.quantity_requested ?? item.quantity ?? 0);
      const sent =
        item.quantity_sent != null && item.quantity_sent !== undefined
          ? parseFloat(item.quantity_sent)
          : null;
      return sent !== null && !Number.isNaN(sent) && Math.abs(sent - requested) > 0.01;
    });
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      let data;
      if (statusFilter === FILTER_INCIDENTS) {
        data = await getOrders(null, null);
        data = (data || []).filter(hasOrderIncidents);
      } else {
        const status = statusFilter !== 'all' ? statusFilter : null;
        data = await getOrders(null, status);
      }
      setOrders(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      await loadOrders(); // Recargar pedidos
    } catch (err) {
      setError(err.message || 'Error al actualizar estado del pedido');
    }
  };


  const getTotalQuantity = (items, useSent = false) => {
    return items.reduce((total, item) => {
      const quantity = useSent 
        ? parseFloat(item.quantity_sent || item.quantity || 0)
        : parseFloat(item.quantity_requested || item.quantity || 0);
      return total + quantity;
    }, 0);
  };

  const handleQuantitySentChange = (itemId, newQuantity) => {
    setEditingQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  };

  const handleSaveQuantitySent = async (itemId) => {
    const newQuantity = editingQuantities[itemId];
    if (newQuantity === undefined) return;

    const quantityNum = parseFloat(newQuantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('La cantidad debe ser un número válido mayor o igual a 0');
      return;
    }

    try {
      await updateOrderItemQuantitySent(itemId, quantityNum);
      setEditingQuantities(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      await loadOrders(); // Recargar pedidos
    } catch (err) {
      setError(err.message || 'Error al actualizar cantidad enviada');
    }
  };

  return (
    <div className="orders-list-container">
      {error && (
        <div className="orders-list-message orders-list-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="orders-list-filters">
        <label htmlFor="status-filter" className="orders-list-filter-label">
          Filtrar por estado:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="orders-list-filter-select"
        >
          <option value="all">Todos</option>
          <option value={ORDER_STATUS.PENDING}>Pendientes</option>
          <option value={ORDER_STATUS.PROCESSING}>En Proceso</option>
          <option value={ORDER_STATUS.COMPLETED}>Completados</option>
          <option value={FILTER_INCIDENTS}>Incidencias</option>
          <option value={ORDER_STATUS.CANCELLED}>Cancelados</option>
        </select>
        <button
          className="orders-list-refresh-button"
          onClick={loadOrders}
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div className="orders-list-loading">Cargando pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="orders-list-empty">
          <p>No hay pedidos {statusFilter !== 'all' ? `con filtro "${getStatusLabel(statusFilter)}"` : ''}</p>
        </div>
      ) : (
        <div className="orders-list-grid">
          {orders.map(order => (
            <div 
              key={order.id} 
              ref={(el) => { orderRefs.current[order.id] = el; }}
              className={`orders-list-card ${selectedOrderId === order.id ? 'orders-list-card-highlighted' : ''}`}
            >
              <div className="orders-list-card-header">
                <div className="orders-list-card-info">
                  <h3 className="orders-list-card-title">
                    Pedido #{order.id.substring(0, 8)}
                  </h3>
                  <p className="orders-list-card-date">
                    {formatDateTime(order.created_at)}
                  </p>
                  {order.restaurants && (
                    <p className="orders-list-card-restaurant">
                      🏪 {order.restaurants.nombre}
                    </p>
                  )}
                  {order.user_profiles && (
                    <p className="orders-list-card-user">
                      {order.user_profiles.full_name 
                        ? `👤 ${order.user_profiles.full_name}`
                        : order.user_profiles.email 
                          ? `👤 ${order.user_profiles.email}`
                          : `👤 ID: ${order.created_by?.substring(0, 8)}...`}
                    </p>
                  )}
                </div>
                <div className={`orders-list-status-badge ${getStatusBadgeClass(order.status, 'orders-') || ''}`}>
                  {getStatusLabel(order.status)}
                </div>
              </div>

              <div className="orders-list-items">
                <h4 className="orders-list-items-title">
                  Productos ({order.order_items?.length || 0})
                </h4>
                <div className="orders-list-items-list">
                  {order.order_items?.map(item => {
                    const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
                    const quantitySentValue = item.quantity_sent !== null && item.quantity_sent !== undefined 
                      ? item.quantity_sent 
                      : quantityRequested;
                    const quantitySent = parseFloat(quantitySentValue);
                    const isEditing = editingQuantities.hasOwnProperty(item.id);
                    const currentEditValue = isEditing ? editingQuantities[item.id] : quantitySent;
                    const canEdit = order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.PROCESSING;
                    const hasChanged = Math.abs(quantityRequested - quantitySent) > 0.01; // Usar tolerancia para comparación de decimales
                    
                    // Inicializar edición al hacer click
                    const handleEditClick = () => {
                      if (!isEditing && canEdit) {
                        handleQuantitySentChange(item.id, quantitySent);
                      }
                    };

                    return (
                      <div key={item.id} className={`orders-list-item ${hasChanged ? 'orders-list-item-modified' : ''}`}>
                        <div className="orders-list-item-info">
                          <span className="orders-list-item-name">
                            {item.product_name || item.products?.nombre || 'Producto eliminado'}
                          </span>
                          {item.products?.referencia && (
                            <span className="orders-list-item-ref">
                              Ref: {item.products.referencia}
                            </span>
                          )}
                          {item.products?.stock !== undefined && (
                            <span className="orders-list-item-stock">
                              Stock disponible: {parseFloat(item.products.stock || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="orders-list-item-quantities">
                          <div className="orders-list-quantity-group">
                            <span className="orders-list-quantity-label">Pedido:</span>
                            <span className="orders-list-quantity-requested">
                              {quantityRequested.toFixed(2)}
                            </span>
                          </div>
                          <div className="orders-list-quantity-separator">→</div>
                          <div className="orders-list-quantity-group">
                            <span className="orders-list-quantity-label">Enviar:</span>
                            {canEdit ? (
                              <div className="orders-list-quantity-edit">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={currentEditValue}
                                  onChange={(e) => handleQuantitySentChange(item.id, e.target.value)}
                                  onFocus={handleEditClick}
                                  onBlur={() => {
                                    if (isEditing && Math.abs(parseFloat(currentEditValue) - quantitySent) > 0.01) {
                                      handleSaveQuantitySent(item.id);
                                    } else if (isEditing) {
                                      // Si no cambió, cancelar edición
                                      setEditingQuantities(prev => {
                                        const next = { ...prev };
                                        delete next[item.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && isEditing) {
                                      handleSaveQuantitySent(item.id);
                                      e.target.blur();
                                    } else if (e.key === 'Escape' && isEditing) {
                                      setEditingQuantities(prev => {
                                        const next = { ...prev };
                                        delete next[item.id];
                                        return next;
                                      });
                                      e.target.blur();
                                    }
                                  }}
                                  className="orders-list-quantity-input"
                                  disabled={order.status === ORDER_STATUS.COMPLETED}
                                />
                                {isEditing && Math.abs(parseFloat(currentEditValue) - quantitySent) > 0.01 && (
                                  <button
                                    className="orders-list-quantity-save"
                                    onClick={() => handleSaveQuantitySent(item.id)}
                                    title="Guardar (Enter)"
                                  >
                                    💾
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className={`orders-list-quantity-sent ${hasChanged ? 'orders-list-quantity-changed' : ''}`}>
                                {quantitySent.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="orders-list-totals">
                  <div className="orders-list-total-item">
                    <span>Total pedido:</span>
                    <span>{getTotalQuantity(order.order_items || [], false).toFixed(2)}</span>
                  </div>
                  <div className="orders-list-total-item">
                    <span>Total a enviar:</span>
                    <span className={getTotalQuantity(order.order_items || [], true) !== getTotalQuantity(order.order_items || [], false) ? 'orders-list-total-changed' : ''}>
                      {getTotalQuantity(order.order_items || [], true).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="orders-list-notes">
                  <strong>Notas:</strong> {order.notes}
                </div>
              )}

              <div className="orders-list-actions">
                {order.status === ORDER_STATUS.PENDING && (
                  <>
                    <button
                      className="orders-list-action-button orders-list-action-process"
                      onClick={() => handleStatusChange(order.id, ORDER_STATUS.PROCESSING)}
                    >
                      ⚙️ En Proceso
                    </button>
                    <button
                      className="orders-list-action-button orders-list-action-complete"
                      onClick={() => handleStatusChange(order.id, ORDER_STATUS.COMPLETED)}
                    >
                      ✅ Completar
                    </button>
                    <button
                      className="orders-list-action-button orders-list-action-cancel"
                      onClick={() => handleStatusChange(order.id, ORDER_STATUS.CANCELLED)}
                    >
                      ❌ Cancelar
                    </button>
                  </>
                )}
                {order.status === ORDER_STATUS.PROCESSING && (
                  <>
                    <button
                      className="orders-list-action-button orders-list-action-complete"
                      onClick={() => handleStatusChange(order.id, ORDER_STATUS.COMPLETED)}
                    >
                      ✅ Completar
                    </button>
                    <button
                      className="orders-list-action-button orders-list-action-cancel"
                      onClick={() => handleStatusChange(order.id, ORDER_STATUS.CANCELLED)}
                    >
                      ❌ Cancelar
                    </button>
                  </>
                )}
                {(order.status === ORDER_STATUS.COMPLETED || order.status === ORDER_STATUS.CANCELLED) && (
                  <p className="orders-list-status-final">
                    Pedido {order.status === ORDER_STATUS.COMPLETED ? 'completado' : 'cancelado'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrdersList;

