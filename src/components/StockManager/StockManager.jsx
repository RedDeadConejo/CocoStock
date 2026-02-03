/**
 * Componente StockManager
 * Modal para gestionar el stock de productos de forma masiva
 */

import { useState, useEffect } from 'react';
import { updateStock } from '../../services/products';
import './StockManager.css';

function StockManager({ products, onClose, onSave, onlySetStock = false }) {
  const [productStocks, setProductStocks] = useState({});
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('set'); // 'add', 'subtract', 'set'
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Inicializar stocks de productos
  useEffect(() => {
    const initialStocks = {};
    products.forEach(product => {
      initialStocks[product.id] = product.stock || '0';
    });
    setProductStocks(initialStocks);
  }, [products]);

  // Si no hay productos, mostrar mensaje
  if (!products || products.length === 0) {
    return (
      <div className="stock-manager-overlay" onClick={onClose}>
        <div className="stock-manager-container" onClick={(e) => e.stopPropagation()}>
          <div className="stock-manager-header">
            <h2 className="stock-manager-title">Gestionar Stock Masivo</h2>
            <button className="stock-manager-close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="stock-manager-content">
            <div className="stock-manager-error">
              <span className="stock-manager-icon">⚠️</span>
              <span>No hay productos disponibles para gestionar stock</span>
            </div>
            <div className="stock-manager-footer">
              <button
                type="button"
                className="stock-manager-button-cancel"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Maneja el cambio de stock individual
   */
  const handleStockChange = (productId, newStock) => {
    setProductStocks(prev => ({
      ...prev,
      [productId]: newStock
    }));
    setError('');
    setSuccess('');
  };

  /**
   * Maneja la selección/deselección de productos
   */
  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  /**
   * Selecciona/deselecciona todos los productos
   */
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedProducts(new Set(products.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  /**
   * Guarda el stock de un producto individual
   */
  const handleSaveIndividual = async (productId) => {
    const newStock = parseFloat(productStocks[productId]);
    
    if (isNaN(newStock) || newStock < 0) {
      setError('Por favor ingresa una cantidad válida');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await updateStock(productId, 'set', newStock);
      setSuccess(`Stock actualizado para ${products.find(p => p.id === productId)?.nombre}`);
      setTimeout(() => setSuccess(''), 2000);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Aplica acción masiva a productos seleccionados
   */
  const handleBulkAction = async () => {
    if (selectedProducts.size === 0) {
      setError('Por favor selecciona al menos un producto');
      return;
    }

    const quantityNum = parseFloat(bulkQuantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('Por favor ingresa una cantidad válida');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatePromises = Array.from(selectedProducts).map(productId => {
        return updateStock(productId, bulkAction, quantityNum);
      });

      await Promise.all(updatePromises);
      
      setSuccess(`${selectedProducts.size} producto(s) actualizado(s) correctamente`);
      setSelectedProducts(new Set());
      setBulkQuantity('');
      setTimeout(() => setSuccess(''), 3000);
      onSave();
    } catch (err) {
      setError(err.message || 'Error al actualizar productos');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Guarda todos los cambios individuales pendientes
   */
  const handleSaveAll = async () => {
    const productsToUpdate = products.filter(product => {
      const currentStock = parseFloat(product.stock || 0);
      const newStock = parseFloat(productStocks[product.id] || 0);
      return !isNaN(newStock) && newStock !== currentStock && newStock >= 0;
    });

    if (productsToUpdate.length === 0) {
      setError('No hay cambios para guardar');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatePromises = productsToUpdate.map(product => {
        const newStock = parseFloat(productStocks[product.id]);
        return updateStock(product.id, 'set', newStock);
      });

      await Promise.all(updatePromises);
      
      setSuccess(`${productsToUpdate.length} producto(s) actualizado(s) correctamente`);
      setTimeout(() => setSuccess(''), 3000);
      onSave();
    } catch (err) {
      setError(err.message || 'Error al actualizar productos');
    } finally {
      setLoading(false);
    }
  };

  const allSelected = products.length > 0 && selectedProducts.size === products.length;
  const someSelected = selectedProducts.size > 0 && selectedProducts.size < products.length;

  return (
    <div className="stock-manager-overlay" onClick={onClose}>
      <div className="stock-manager-container" onClick={(e) => e.stopPropagation()}>
        <div className="stock-manager-header">
          <h2 className="stock-manager-title">Gestionar Stock Masivo</h2>
          <button className="stock-manager-close" onClick={onClose} tabIndex="-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="stock-manager-error">
            <span className="stock-manager-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="stock-manager-success">
            <span className="stock-manager-icon">✓</span>
            <span>{success}</span>
          </div>
        )}

        <div className="stock-manager-content">
          {/* Acción Masiva */}
          <div className="stock-manager-bulk-section">
            <div className="stock-manager-bulk-controls">
              <input
                type="number"
                min="0"
                step="0.01"
                className="stock-manager-bulk-input"
                value={bulkQuantity}
                onChange={(e) => setBulkQuantity(e.target.value)}
                disabled={loading}
                placeholder="Nuevo stock"
                tabIndex="-1"
              />
              {!onlySetStock && (
                <>
                  <label className="stock-manager-radio">
                    <input
                      type="radio"
                      name="bulkAction"
                      value="add"
                      checked={bulkAction === 'add'}
                      onChange={(e) => setBulkAction(e.target.value)}
                      disabled={loading}
                      tabIndex="-1"
                    />
                    <span className="stock-manager-radio-label stock-manager-radio-compact">
                      <span className="stock-manager-radio-icon">➕</span>
                      Agregar
                    </span>
                  </label>
                  <label className="stock-manager-radio">
                    <input
                      type="radio"
                      name="bulkAction"
                      value="subtract"
                      checked={bulkAction === 'subtract'}
                      onChange={(e) => setBulkAction(e.target.value)}
                      disabled={loading}
                      tabIndex="-1"
                    />
                    <span className="stock-manager-radio-label stock-manager-radio-compact">
                      <span className="stock-manager-radio-icon">➖</span>
                      Restar
                    </span>
                  </label>
                  <label className="stock-manager-radio">
                    <input
                      type="radio"
                      name="bulkAction"
                      value="set"
                      checked={bulkAction === 'set'}
                      onChange={(e) => setBulkAction(e.target.value)}
                      disabled={loading}
                      tabIndex="-1"
                    />
                    <span className="stock-manager-radio-label stock-manager-radio-compact">
                      <span className="stock-manager-radio-icon">🔢</span>
                      Establecer
                    </span>
                  </label>
                </>
              )}
              {onlySetStock && (
                <span className="stock-manager-bulk-label">Establecer stock</span>
              )}
              <button
                type="button"
                className="stock-manager-button-bulk"
                onClick={handleBulkAction}
                disabled={loading || selectedProducts.size === 0}
                tabIndex="-1"
              >
                Aplicar a {selectedProducts.size} seleccionado(s)
              </button>
            </div>
          </div>

          {/* Tabla de Productos */}
          <div className="stock-manager-table-section">
            <div className="stock-manager-table-header">
              <h3 className="stock-manager-section-title">Productos</h3>
              <label className="stock-manager-select-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  disabled={loading}
                  tabIndex="-1"
                />
                <span>Seleccionar todos</span>
              </label>
            </div>

            <div className="stock-manager-table-wrapper">
              <table className="stock-manager-table">
                <thead>
                  <tr>
                    <th className="stock-manager-th-checkbox">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={loading}
                        tabIndex="-1"
                      />
                    </th>
                    <th className="stock-manager-th-name">Producto</th>
                    <th className="stock-manager-th-stock">Stock Actual</th>
                    <th className="stock-manager-th-new">Nuevo Stock</th>
                    <th className="stock-manager-th-action">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const currentStock = parseFloat(product.stock || 0);
                    const newStock = parseFloat(productStocks[product.id] || '0');
                    const hasChanges = !isNaN(newStock) && newStock !== currentStock;
                    
                    return (
                      <tr 
                        key={product.id}
                        className={hasChanges ? 'stock-manager-row-changed' : ''}
                      >
                        <td className="stock-manager-td-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                            disabled={loading}
                            tabIndex="-1"
                          />
                        </td>
                        <td className="stock-manager-td-name">
                          <div className="stock-manager-product-name">{product.nombre}</div>
                          {product.referencia && (
                            <div className="stock-manager-product-ref">{product.referencia}</div>
                          )}
                        </td>
                        <td className="stock-manager-td-stock">
                          <span className="stock-manager-current-stock">{currentStock}</span>
                        </td>
                        <td className="stock-manager-td-new">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="stock-manager-table-input"
                            value={productStocks[product.id] || '0'}
                            onChange={(e) => handleStockChange(product.id, e.target.value)}
                            disabled={loading}
                            tabIndex={products.indexOf(product) + 1}
                          />
                        </td>
                        <td className="stock-manager-td-action">
                          <button
                            type="button"
                            className="stock-manager-button-save-row"
                            onClick={() => handleSaveIndividual(product.id)}
                            disabled={loading || !hasChanges}
                            title="Guardar cambios"
                            tabIndex="-1"
                          >
                            💾
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="stock-manager-footer">
          <button
            type="button"
            className="stock-manager-button-cancel"
            onClick={onClose}
            disabled={loading}
            tabIndex="-1"
          >
            Cerrar
          </button>
          <button
            type="button"
            className="stock-manager-button-save-all"
            onClick={handleSaveAll}
            disabled={loading}
            tabIndex="-1"
          >
            {loading ? (
              <>
                <span className="stock-manager-spinner"></span>
                <span>Guardando...</span>
              </>
            ) : (
              <span>💾 Guardar Todos los Cambios</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StockManager;
