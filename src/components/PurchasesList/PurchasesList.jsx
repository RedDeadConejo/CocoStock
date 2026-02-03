/**
 * Componente PurchasesList
 * Lista de compras para usuarios de Almacén y Admin
 */

import { useState, useEffect, useRef } from 'react';
import { getPurchases, updatePurchaseStatus, updatePurchaseItemQuantityReceived, PURCHASE_STATUS } from '../../services/purchases';
import { formatDateTime } from '../../utils/formatters';
import { getPurchaseStatusLabel, getPurchaseStatusBadgeClass, FILTER_PURCHASE_INCIDENTS } from '../../utils/purchaseStatus';
import './PurchasesList.css';

function PurchasesList({ userId }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'processing', 'completed', 'cancelled'
  const [editingQuantities, setEditingQuantities] = useState({}); // { itemId: quantityReceived }
  const purchaseRefs = useRef({});
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [exportMessage, setExportMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Leer filtro desde sessionStorage al montar (ej. clic en tarjeta del dashboard)
  useEffect(() => {
    const savedFilter = sessionStorage.getItem('purchasesStatusFilter');
    if (savedFilter) {
      setStatusFilter(savedFilter);
      sessionStorage.removeItem('purchasesStatusFilter');
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      loadPurchases();
      const savedPurchaseId = sessionStorage.getItem('selectedPurchaseId');
      if (savedPurchaseId) {
        setSelectedPurchaseId(savedPurchaseId);
        sessionStorage.removeItem('selectedPurchaseId');
      }
    }
  }, [statusFilter, isInitialized]);

  // Escuchar evento de compra creada para recargar
  useEffect(() => {
    const handlePurchaseCreated = () => {
      loadPurchases();
    };
    window.addEventListener('purchaseCreated', handlePurchaseCreated);
    return () => window.removeEventListener('purchaseCreated', handlePurchaseCreated);
  }, []);

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

  const hasPurchaseIncidents = (purchase) => {
    return purchase?.purchase_items?.some((item) => {
      const requested = parseFloat(item.quantity_requested ?? item.quantity ?? 0);
      const received =
        item.quantity_received != null && item.quantity_received !== undefined
          ? parseFloat(item.quantity_received)
          : null;
      return received !== null && !Number.isNaN(received) && Math.abs(received - requested) > 0.01;
    });
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);
      setError('');
      let data;
      if (statusFilter === FILTER_PURCHASE_INCIDENTS) {
        data = await getPurchases(null, null);
        data = (data || []).filter(hasPurchaseIncidents);
      } else {
        const status = statusFilter !== 'all' ? statusFilter : null;
        data = await getPurchases(null, status);
      }
      setPurchases(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar compras');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (purchaseId, newStatus) => {
    try {
      await updatePurchaseStatus(purchaseId, newStatus);
      await loadPurchases(); // Recargar compras
    } catch (err) {
      setError(err.message || 'Error al actualizar estado de la compra');
    }
  };

  const getTotalQuantity = (items, useReceived = false) => {
    return items.reduce((total, item) => {
      const quantity = useReceived 
        ? parseFloat(item.quantity_received || 0)
        : parseFloat(item.quantity_requested || item.quantity || 0);
      return total + quantity;
    }, 0);
  };

  const handleQuantityReceivedChange = (itemId, newQuantity) => {
    setEditingQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  };

  const formatPurchaseAsHtml = (purchase) => {
    const productsRows = (purchase.purchase_items || [])
      .map((item, index) => {
        const quantity = parseFloat(item.quantity_requested || item.quantity || 0).toFixed(2);
        const name = item.product_name || item.products?.nombre || 'Producto';
        const ref = item.products?.referencia ? `Ref: ${item.products.referencia}` : '';
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${name}</td>
            <td>${quantity}</td>
            <td>${ref}</td>
          </tr>
        `;
      })
      .join('');

    const totals = getTotalQuantity(purchase.purchase_items || [], false).toFixed(2);

    return `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Compra ${purchase.id.substring(0, 8)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { margin-bottom: 4px; }
          .meta { margin: 0 0 16px 0; color: #334155; }
          .block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
          .totals { margin-top: 12px; font-weight: 600; }
          .notes { margin-top: 12px; padding: 12px; background: #fff7ed; border: 1px solid #fdba74; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>Compra #${purchase.id.substring(0, 8)}</h1>
        <p class="meta">
          Proveedor: ${purchase.suppliers?.nombre || 'N/D'}<br />
          Fecha: ${formatDateTime(purchase.created_at)}<br />
          Estado: ${getPurchaseStatusLabel(purchase.status)}<br />
          Solicitado por: ${purchase.user_profiles?.full_name || purchase.user_profiles?.email || 'N/D'}
        </p>
        <div class="block">
          <strong>Productos</strong>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              ${productsRows || '<tr><td colspan="4">Sin productos</td></tr>'}
            </tbody>
          </table>
          <div class="totals">Total items: ${totals}</div>
          ${purchase.notes ? `<div class="notes"><strong>Notas:</strong> ${purchase.notes}</div>` : ''}
        </div>
      </body>
      </html>
    `;
  };

  const handleExportPurchase = (purchase) => {
    const html = formatPurchaseAsHtml(purchase);
    // Generar .doc (Word abre HTML con este mime)
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedido-${purchase.id.substring(0, 8)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportMessage('Documento descargado en formato .doc listo para enviar.');
    setTimeout(() => setExportMessage(''), 3000);
  };

  const handleSaveQuantityReceived = async (itemId) => {
    const newQuantity = editingQuantities[itemId];
    if (newQuantity === undefined) return;

    const quantityNum = parseFloat(newQuantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('La cantidad debe ser un número válido mayor o igual a 0');
      return;
    }

    try {
      await updatePurchaseItemQuantityReceived(itemId, quantityNum);
      setEditingQuantities(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      await loadPurchases(); // Recargar compras
    } catch (err) {
      setError(err.message || 'Error al actualizar cantidad recibida');
    }
  };

  return (
    <div className="purchases-list-container">
      {error && (
        <div className="purchases-list-message purchases-list-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {exportMessage && (
        <div className="purchases-list-message purchases-list-success">
          <span>✅</span>
          <span>{exportMessage}</span>
        </div>
      )}

      <div className="purchases-list-filters">
        <label htmlFor="status-filter" className="purchases-list-filter-label">
          Filtrar por estado:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="purchases-list-filter-select"
        >
          <option value="all">Todos</option>
          <option value={PURCHASE_STATUS.PENDING}>Pendientes</option>
          <option value={PURCHASE_STATUS.PROCESSING}>En Proceso</option>
          <option value={PURCHASE_STATUS.COMPLETED}>Completados</option>
          <option value={FILTER_PURCHASE_INCIDENTS}>Incidencias</option>
          <option value={PURCHASE_STATUS.CANCELLED}>Cancelados</option>
        </select>
        <button
          className="purchases-list-refresh-button"
          onClick={loadPurchases}
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div className="purchases-list-loading">Cargando compras...</div>
      ) : purchases.length === 0 ? (
        <div className="purchases-list-empty">
          <p>No hay compras {statusFilter !== 'all' ? `con filtro "${getPurchaseStatusLabel(statusFilter)}"` : ''}</p>
        </div>
      ) : (
        <div className="purchases-list-grid">
          {purchases.map(purchase => (
            <div 
              key={purchase.id} 
              ref={(el) => { purchaseRefs.current[purchase.id] = el; }}
              className={`purchases-list-card ${selectedPurchaseId === purchase.id ? 'purchases-list-card-highlighted' : ''}`}
            >
              <div className="purchases-list-card-header">
                <div className="purchases-list-card-info">
                  <h3 className="purchases-list-card-title">
                    Compra #{purchase.id.substring(0, 8)}
                  </h3>
                  <p className="purchases-list-card-date">
                    {formatDateTime(purchase.created_at)}
                  </p>
                  {purchase.suppliers && (
                    <p className="purchases-list-card-supplier">
                      🏭 {purchase.suppliers.nombre}
                    </p>
                  )}
                  {purchase.user_profiles && (
                    <p className="purchases-list-card-user">
                      {purchase.user_profiles.full_name 
                        ? `👤 ${purchase.user_profiles.full_name}`
                        : purchase.user_profiles.email 
                          ? `👤 ${purchase.user_profiles.email}`
                          : `👤 ID: ${purchase.created_by?.substring(0, 8)}...`}
                    </p>
                  )}
                </div>
                <div className={`purchases-list-status-badge ${getPurchaseStatusBadgeClass(purchase.status, 'purchases-list-') || ''}`}>
                  {getPurchaseStatusLabel(purchase.status)}
                </div>
              </div>

              <div className="purchases-list-items">
                <h4 className="purchases-list-items-title">
                  Productos ({purchase.purchase_items?.length || 0})
                </h4>
                <div className="purchases-list-items-list">
                  {purchase.purchase_items?.map(item => {
                    const quantityRequested = parseFloat(item.quantity_requested || item.quantity || 0);
                    const quantityReceivedValue = item.quantity_received !== null && item.quantity_received !== undefined 
                      ? item.quantity_received 
                      : 0;
                    const quantityReceived = parseFloat(quantityReceivedValue);
                    const isEditing = editingQuantities.hasOwnProperty(item.id);
                    const currentEditValue = isEditing ? editingQuantities[item.id] : quantityReceived;
                    const canEdit = purchase.status === PURCHASE_STATUS.PENDING || purchase.status === PURCHASE_STATUS.PROCESSING;
                    const hasChanged = quantityReceived > 0 && Math.abs(quantityRequested - quantityReceived) > 0.01;
                    
                    // Inicializar edición al hacer click
                    const handleEditClick = () => {
                      if (!isEditing && canEdit) {
                        handleQuantityReceivedChange(item.id, quantityReceived);
                      }
                    };

                    return (
                      <div key={item.id} className={`purchases-list-item ${hasChanged ? 'purchases-list-item-modified' : ''}`}>
                        <div className="purchases-list-item-info">
                          <span className="purchases-list-item-name">
                            {item.product_name || item.products?.nombre || 'Producto eliminado'}
                          </span>
                          {item.products?.referencia && (
                            <span className="purchases-list-item-ref">
                              Ref: {item.products.referencia}
                            </span>
                          )}
                          {item.products?.stock !== undefined && (
                            <span className="purchases-list-item-stock">
                              Stock actual: {parseFloat(item.products.stock || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="purchases-list-item-quantities">
                          <div className="purchases-list-quantity-group">
                            <span className="purchases-list-quantity-label">Solicitado:</span>
                            <span className="purchases-list-quantity-requested">
                              {quantityRequested.toFixed(2)}
                            </span>
                          </div>
                          <div className="purchases-list-quantity-separator">→</div>
                          <div className="purchases-list-quantity-group">
                            <span className="purchases-list-quantity-label">Recibido:</span>
                            {canEdit ? (
                              <div className="purchases-list-quantity-edit">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={currentEditValue}
                                  onChange={(e) => handleQuantityReceivedChange(item.id, e.target.value)}
                                  onFocus={handleEditClick}
                                  onBlur={() => {
                                    if (isEditing && Math.abs(parseFloat(currentEditValue) - quantityReceived) > 0.01) {
                                      handleSaveQuantityReceived(item.id);
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
                                      handleSaveQuantityReceived(item.id);
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
                                  className="purchases-list-quantity-input"
                                  disabled={purchase.status === PURCHASE_STATUS.COMPLETED}
                                />
                                {isEditing && Math.abs(parseFloat(currentEditValue) - quantityReceived) > 0.01 && (
                                  <button
                                    className="purchases-list-quantity-save"
                                    onClick={() => handleSaveQuantityReceived(item.id)}
                                    title="Guardar (Enter)"
                                  >
                                    💾
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className={`purchases-list-quantity-received ${hasChanged ? 'purchases-list-quantity-changed' : ''}`}>
                                {quantityReceived.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="purchases-list-totals">
                  <div className="purchases-list-total-item">
                    <span className="purchases-list-total-label">Total solicitado:</span>
                    <span className="purchases-list-total-value">
                      {getTotalQuantity(purchase.purchase_items || [], false).toFixed(2)}
                    </span>
                  </div>
                  <div className="purchases-list-total-item">
                    <span className="purchases-list-total-label">Total recibido:</span>
                    <span className="purchases-list-total-value">
                      {getTotalQuantity(purchase.purchase_items || [], true).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {purchase.notes && (
                <div className="purchases-list-notes">
                  <strong>Notas:</strong> {purchase.notes}
                </div>
              )}

              <div className="purchases-list-actions">
                <label htmlFor={`status-${purchase.id}`} className="purchases-list-status-label">
                  Cambiar estado:
                </label>
                <select
                  id={`status-${purchase.id}`}
                  value={purchase.status}
                  onChange={(e) => handleStatusChange(purchase.id, e.target.value)}
                  className="purchases-list-status-select"
                  disabled={purchase.status === PURCHASE_STATUS.COMPLETED}
                >
                  <option value={PURCHASE_STATUS.PENDING}>Pendiente</option>
                  <option value={PURCHASE_STATUS.PROCESSING}>En Proceso</option>
                  <option value={PURCHASE_STATUS.COMPLETED}>Completado</option>
                  <option value={PURCHASE_STATUS.CANCELLED}>Cancelado</option>
                </select>
                <button
                  className="purchases-list-export-button"
                  onClick={() => handleExportPurchase(purchase)}
                  title="Copiar resumen para email o descargar .txt"
                >
                  📧 Exportar
                </button>
              </div>

              {purchase.status === PURCHASE_STATUS.COMPLETED && (
                <div className="purchases-list-completed-info">
                  <span className="purchases-list-completed-icon">✅</span>
                  <span>Esta compra ha sido completada y el stock ha sido actualizado</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PurchasesList;
