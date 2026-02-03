/**
 * Componente MyPurchases
 * Lista de compras del usuario
 */

import { useState, useEffect, useRef } from 'react';
import { getPurchases, PURCHASE_STATUS } from '../../services/purchases';
import { formatDateTime } from '../../utils/formatters';
import { getPurchaseStatusLabel, getPurchaseStatusBadgeClass } from '../../utils/purchaseStatus';
import './MyPurchases.css';

function MyPurchases({ userId }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const purchaseRefs = useRef({});
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);

  useEffect(() => {
    if (userId) {
      loadPurchases();
      // Verificar si hay una compra seleccionada desde el Dashboard
      const savedPurchaseId = sessionStorage.getItem('selectedPurchaseId');
      if (savedPurchaseId) {
        setSelectedPurchaseId(savedPurchaseId);
        sessionStorage.removeItem('selectedPurchaseId');
      }
    }
  }, [userId, statusFilter]);

  // Hacer scroll a la compra seleccionada cuando se carga
  useEffect(() => {
    if (selectedPurchaseId && purchaseRefs.current[selectedPurchaseId] && !loading) {
      setTimeout(() => {
        purchaseRefs.current[selectedPurchaseId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        // Remover el highlight después de 3 segundos
        setTimeout(() => {
          setSelectedPurchaseId(null);
        }, 3000);
      }, 100);
    }
  }, [selectedPurchaseId, loading]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      setError('');
      
      const status = statusFilter !== 'all' ? statusFilter : null;
      const data = await getPurchases(userId, status);
      setPurchases(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar compras');
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

  const hasPurchaseModifications = (items) => {
    return items?.some(item => {
      const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
      const quantityReceivedValue = item.quantity_received !== null && item.quantity_received !== undefined
        ? item.quantity_received
        : 0;
      const quantityReceived = parseFloat(quantityReceivedValue);
      return quantityReceived > 0 && Math.abs(quantityRequested - quantityReceived) > 0.01;
    });
  };

  return (
    <div className="my-purchases-container">
      <div className="my-purchases-header">
        <h1 className="my-purchases-title">📦 Mis Compras</h1>
        <p className="my-purchases-subtitle">Consulta el estado de tus compras</p>
      </div>

      {error && (
        <div className="my-purchases-message my-purchases-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="my-purchases-filters">
        <label htmlFor="status-filter" className="my-purchases-filter-label">
          Filtrar por estado:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="my-purchases-filter-select"
        >
          <option value="all">Todos</option>
          <option value={PURCHASE_STATUS.PENDING}>Pendientes</option>
          <option value={PURCHASE_STATUS.PROCESSING}>En Proceso</option>
          <option value={PURCHASE_STATUS.COMPLETED}>Completados</option>
          <option value={PURCHASE_STATUS.CANCELLED}>Cancelados</option>
        </select>
        <button
          className="my-purchases-refresh-button"
          onClick={loadPurchases}
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div className="my-purchases-loading">Cargando compras...</div>
      ) : purchases.length === 0 ? (
        <div className="my-purchases-empty">
          <p>No tienes compras {statusFilter !== 'all' ? `con estado "${getPurchaseStatusLabel(statusFilter)}"` : ''}</p>
          <p className="my-purchases-empty-hint">
            Las compras que realices aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="my-purchases-grid">
          {purchases.map(purchase => (
            <div 
              key={purchase.id} 
              ref={(el) => { purchaseRefs.current[purchase.id] = el; }}
              className={`my-purchases-card ${selectedPurchaseId === purchase.id ? 'my-purchases-card-highlighted' : ''}`}
            >
              <div className="my-purchases-card-header">
                <div className="my-purchases-card-info">
                  <h3 className="my-purchases-card-title">
                    Compra #{purchase.id.substring(0, 8)}
                  </h3>
                  <p className="my-purchases-card-date">
                    {formatDateTime(purchase.created_at)}
                  </p>
                  {purchase.suppliers && (
                    <p className="my-purchases-card-supplier">
                      🏭 {purchase.suppliers.nombre}
                    </p>
                  )}
                  {purchase.user_profiles && purchase.user_profiles.full_name && (
                    <p className="my-purchases-card-user">
                      👤 {purchase.user_profiles.full_name}
                    </p>
                  )}
                </div>
                <div className={`my-purchases-status-badge ${getPurchaseStatusBadgeClass(purchase.status, 'my-purchases-') || ''}`}>
                  {getPurchaseStatusLabel(purchase.status)}
                </div>
              </div>

              <div className="my-purchases-items">
                <h4 className="my-purchases-items-title">
                  Productos ({purchase.purchase_items?.length || 0})
                </h4>
                <div className="my-purchases-items-list">
                  {purchase.purchase_items?.map(item => {
                    const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
                    const quantityReceivedValue = item.quantity_received !== null && item.quantity_received !== undefined
                      ? item.quantity_received
                      : 0;
                    const quantityReceived = parseFloat(quantityReceivedValue);
                    const hasChanged = quantityReceived > 0 && Math.abs(quantityRequested - quantityReceived) > 0.01;
                    const itemClassName = `my-purchases-item${hasChanged ? ' my-purchases-item-modified' : ''}`;

                    return (
                      <div key={item.id} className={itemClassName}>
                        <div className="my-purchases-item-info">
                          <span className="my-purchases-item-name">
                            {item.product_name || item.products?.nombre || 'Producto eliminado'}
                          </span>
                          {item.products?.referencia && (
                            <span className="my-purchases-item-ref">
                              Ref: {item.products.referencia}
                            </span>
                          )}
                        </div>
                        <div className="my-purchases-item-quantities">
                          {hasChanged ? (
                            <>
                              <div className="my-purchases-quantity-group">
                                <span className="my-purchases-quantity-label">Solicitado:</span>
                                <span className="my-purchases-quantity-requested">
                                  {quantityRequested.toFixed(2)}
                                </span>
                              </div>
                              <div className="my-purchases-quantity-separator">→</div>
                              <div className="my-purchases-quantity-group">
                                <span className="my-purchases-quantity-label">Recibido:</span>
                                <span className="my-purchases-quantity-received">
                                  {quantityReceived.toFixed(2)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="my-purchases-item-quantity-single">
                              {quantityRequested.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="my-purchases-total">
                  Total items: {getTotalQuantity(purchase.purchase_items || [])}
                </div>
              </div>

              {purchase.notes && (
                <div className="my-purchases-notes">
                  <strong>Notas:</strong> {purchase.notes}
                </div>
              )}

              {hasPurchaseModifications(purchase.purchase_items) && (
                <div className="my-purchases-modified-info">
                  <span className="my-purchases-modified-icon">⚠️</span>
                  <span>Algunas cantidades recibidas difieren de las solicitadas. Revisa los detalles arriba.</span>
                </div>
              )}

              {purchase.status === PURCHASE_STATUS.COMPLETED && (
                <div className="my-purchases-completed-info">
                  <span className="my-purchases-completed-icon">✅</span>
                  <span>Tu compra ha sido completada y el stock ha sido actualizado</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyPurchases;
