/**
 * Componente PurchaseCart
 * Carrito de compra para compras a proveedores
 */

import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../../services/products';
import { getSuppliers } from '../../services/suppliers';
import { createPurchase } from '../../services/purchases';
import { formatCurrency } from '../../utils/formatters';
import './PurchaseCart.css';

function PurchaseCart({ userId, onPurchaseCreated }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]); // Array de { product_id, product_name, quantity, supplier_id, supplier_name }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [productsData, suppliersData] = await Promise.all([
        getProducts(),
        getSuppliers()
      ]);
      setProducts(productsData || []);
      setSuppliers(suppliersData || []);
    } catch (err) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos por búsqueda
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    
    const search = searchTerm.toLowerCase();
    return products.filter(product =>
      product.nombre?.toLowerCase().includes(search) ||
      product.referencia?.toLowerCase().includes(search)
    );
  }, [products, searchTerm]);

  // Agregar producto al carrito con su proveedor inicial
  const addToCart = (product) => {
    const supplierOptions = product.suppliers || [];
    if (supplierOptions.length === 0) {
      setError('El producto no tiene proveedores asignados.');
      return;
    }

    const defaultSupplier = supplierOptions[0];
    const existingItem = cart.find(
      item => item.product_id === product.id && item.supplier_id === defaultSupplier.id
    );
    
    if (existingItem) {
      // Si ya existe con el mismo proveedor, aumentar cantidad
      setCart(cart.map(item =>
        item.product_id === product.id && item.supplier_id === defaultSupplier.id
          ? { ...item, quantity: parseFloat(item.quantity) + 1 }
          : item
      ));
    } else {
      // Si no existe, agregar nuevo item
      setCart([...cart, {
        product_id: product.id,
        product_name: product.nombre,
        quantity: 1,
        supplier_id: defaultSupplier.id,
        supplier_name: defaultSupplier.nombre,
      }]);
    }
    
    setError('');
    setSuccess('');
  };

  // Cambiar proveedor de un item
  const updateItemSupplier = (productId, supplierId) => {
    const product = products.find(p => p.id === productId);
    const supplier = product?.suppliers?.find(s => s.id === supplierId);
    if (!supplier) return;

    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, supplier_id: supplier.id, supplier_name: supplier.nombre }
        : item
    ));
  };

  // Actualizar cantidad de un item
  const updateQuantity = (productId, quantity) => {
    const quantityNum = parseFloat(quantity);
    
    if (isNaN(quantityNum) || quantityNum < 0) {
      return;
    }

    if (quantityNum === 0) {
      // Si la cantidad es 0, eliminar del carrito
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: quantityNum }
        : item
    ));
  };

  // Eliminar producto del carrito
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Limpiar carrito
  const clearCart = () => {
    setCart([]);
    setNotes('');
  };

  // Calcular total de items
  const totalItems = useMemo(() => {
    return cart.reduce((total, item) => total + parseFloat(item.quantity || 0), 0);
  }, [cart]);

  // Enviar compra
  const handleSubmitPurchase = async () => {
    if (cart.length === 0) {
      setError('El carrito está vacío');
      return;
    }

    // Validar que todos los items tengan proveedor
    const itemsWithoutSupplier = cart.filter(item => !item.supplier_id);
    if (itemsWithoutSupplier.length > 0) {
      setError('Todos los productos necesitan un proveedor.');
      return;
    }

    // Agrupar items por proveedor
    const itemsBySupplier = cart.reduce((acc, item) => {
      if (!acc[item.supplier_id]) {
        acc[item.supplier_id] = [];
      }
      acc[item.supplier_id].push(item);
      return acc;
    }, {});

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const results = [];
      for (const [supplierId, items] of Object.entries(itemsBySupplier)) {
        const purchase = await createPurchase(supplierId, items, notes);
        results.push({ supplierId, purchaseId: purchase?.id, itemCount: items.length });
      }
      
      const summary = results.map(r => `${r.itemCount} productos`).join(' + ');
      setSuccess(`Se crearon ${results.length} pedidos por proveedor (${summary})`);
      clearCart();
      
      // Cambiar a la vista de compras después de 2 segundos
      setTimeout(() => {
        setSuccess('');
        if (onPurchaseCreated) {
          onPurchaseCreated();
        }
      }, 2000);
    } catch (err) {
      setError(err.message || 'Error al crear la compra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="purchase-cart-container">
      {error && (
        <div className="purchase-cart-message purchase-cart-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="purchase-cart-message purchase-cart-success">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="purchase-cart-content">
        {/* Panel de Productos */}
        <div className="purchase-cart-products-panel">
          <div className="purchase-cart-search">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="purchase-cart-search-input"
            />
          </div>

          {loading ? (
            <div className="purchase-cart-loading">Cargando productos...</div>
          ) : (
            <div className="purchase-cart-products-grid">
              {filteredProducts.map(product => (
                <div key={product.id} className="purchase-cart-product-card">
                  <div className="purchase-cart-product-info">
                    <h3 className="purchase-cart-product-name">{product.nombre}</h3>
                    {product.referencia && (
                      <p className="purchase-cart-product-ref">Ref: {product.referencia}</p>
                    )}
                    <p className="purchase-cart-product-stock">
                      Stock: {product.stock || '0'} {product.formato || ''}
                    </p>
                    {product.suppliers?.length > 0 && (
                      <p className="purchase-cart-product-suppliers">
                        Proveedores: {product.suppliers.map(s => s.nombre).join(', ')}
                      </p>
                    )}
                    {product.precio && (
                      <p className="purchase-cart-product-price">
                        {formatCurrency(product.precio)}
                      </p>
                    )}
                  </div>
                  <button
                    className="purchase-cart-add-button"
                    onClick={() => addToCart(product)}
                  >
                    ➕ Agregar
                  </button>
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className="purchase-cart-empty">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel del Carrito */}
        <div className="purchase-cart-cart-panel">
          <div className="purchase-cart-cart-header">
            <h2>Carrito ({totalItems} {totalItems === 1 ? 'item' : 'items'})</h2>
            {cart.length > 0 && (
              <button
                className="purchase-cart-clear-button"
                onClick={clearCart}
              >
                🗑️ Limpiar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="purchase-cart-cart-empty">
              <p>El carrito está vacío</p>
              <p className="purchase-cart-cart-empty-hint">
                Agrega productos desde el panel izquierdo
              </p>
            </div>
          ) : (
            <>
              <div className="purchase-cart-items">
                {cart.map(item => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={item.product_id} className="purchase-cart-item">
                      <div className="purchase-cart-item-info">
                        <h4 className="purchase-cart-item-name">{item.product_name}</h4>
                        {product?.formato && (
                          <p className="purchase-cart-item-format">{product.formato}</p>
                        )}
                        <div className="purchase-cart-item-supplier">
                          <label>Proveedor:</label>
                          <select
                            value={item.supplier_id}
                            onChange={(e) => updateItemSupplier(item.product_id, e.target.value)}
                          >
                            {(product?.suppliers || []).map(supplier => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="purchase-cart-item-controls">
                        <button
                          className="purchase-cart-quantity-button"
                          onClick={() => updateQuantity(item.product_id, parseFloat(item.quantity) - 1)}
                        >
                          ➖
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                          className="purchase-cart-quantity-input"
                        />
                        <button
                          className="purchase-cart-quantity-button"
                          onClick={() => updateQuantity(item.product_id, parseFloat(item.quantity) + 1)}
                        >
                          ➕
                        </button>
                        <button
                          className="purchase-cart-remove-button"
                          onClick={() => removeFromCart(item.product_id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="purchase-cart-notes">
                <label htmlFor="purchase-notes" className="purchase-cart-notes-label">
                  Notas (opcional):
                </label>
                <textarea
                  id="purchase-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agregar notas sobre la compra..."
                  className="purchase-cart-notes-textarea"
                  rows="3"
                />
              </div>

              <button
                className="purchase-cart-submit-button"
                onClick={handleSubmitPurchase}
                disabled={submitting || cart.length === 0}
              >
                {submitting ? (
                  <>
                    <span className="purchase-cart-spinner"></span>
                    <span>Creando...</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>Crear Compra</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PurchaseCart;
