/**
 * Componente ShoppingCart
 * Carrito de compra para usuarios de Restaurante
 */

import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../../services/products';
import { createOrder } from '../../services/orders';
import { formatCurrency } from '../../utils/formatters';
import './ShoppingCart.css';

function ShoppingCart({ userId, onOrderCreated }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // Array de { product_id, product_name, quantity }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar productos');
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

  // Agregar producto al carrito
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      // Si ya existe, aumentar cantidad
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: parseFloat(item.quantity) + 1 }
          : item
      ));
    } else {
      // Si no existe, agregar nuevo item
      setCart([...cart, {
        product_id: product.id,
        product_name: product.nombre,
        quantity: 1
      }]);
    }
    
    setError('');
    setSuccess('');
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

  // Enviar pedido
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      setError('El carrito está vacío');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      await createOrder(cart, notes);
      
      setSuccess('Pedido enviado correctamente');
      clearCart();
      
      // Cambiar a la vista de pedidos después de 2 segundos
      setTimeout(() => {
        setSuccess('');
        if (onOrderCreated) {
          onOrderCreated();
        }
      }, 2000);
    } catch (err) {
      setError(err.message || 'Error al enviar el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shopping-cart-container">
      {error && (
        <div className="shopping-cart-message shopping-cart-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="shopping-cart-message shopping-cart-success">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="shopping-cart-content">
        {/* Panel de Productos */}
        <div className="shopping-cart-products-panel">
          <div className="shopping-cart-search">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="shopping-cart-search-input"
            />
          </div>

          {loading ? (
            <div className="shopping-cart-loading">Cargando productos...</div>
          ) : (
            <div className="shopping-cart-products-grid">
              {filteredProducts.map(product => (
                <div key={product.id} className="shopping-cart-product-card">
                  <div className="shopping-cart-product-info">
                    <h3 className="shopping-cart-product-name">{product.nombre}</h3>
                    {product.referencia && (
                      <p className="shopping-cart-product-ref">Ref: {product.referencia}</p>
                    )}
                    <p className="shopping-cart-product-stock">
                      Stock: {product.stock || '0'} {product.formato || ''}
                    </p>
                    {product.precio && (
                      <p className="shopping-cart-product-price">
                        {formatCurrency(product.precio)}
                      </p>
                    )}
                  </div>
                  <button
                    className="shopping-cart-add-button"
                    onClick={() => addToCart(product)}
                    disabled={parseFloat(product.stock || 0) === 0}
                  >
                    ➕ Agregar
                  </button>
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className="shopping-cart-empty">
                  {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel del Carrito */}
        <div className="shopping-cart-cart-panel">
          <div className="shopping-cart-cart-header">
            <h2>Carrito ({totalItems} {totalItems === 1 ? 'item' : 'items'})</h2>
            {cart.length > 0 && (
              <button
                className="shopping-cart-clear-button"
                onClick={clearCart}
              >
                🗑️ Limpiar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="shopping-cart-cart-empty">
              <p>El carrito está vacío</p>
              <p className="shopping-cart-cart-empty-hint">
                Agrega productos desde el panel izquierdo
              </p>
            </div>
          ) : (
            <>
              <div className="shopping-cart-items">
                {cart.map(item => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={item.product_id} className="shopping-cart-item">
                      <div className="shopping-cart-item-info">
                        <h4 className="shopping-cart-item-name">{item.product_name}</h4>
                        {product?.formato && (
                          <p className="shopping-cart-item-format">{product.formato}</p>
                        )}
                      </div>
                      <div className="shopping-cart-item-controls">
                        <button
                          className="shopping-cart-quantity-button"
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
                          className="shopping-cart-quantity-input"
                        />
                        <button
                          className="shopping-cart-quantity-button"
                          onClick={() => updateQuantity(item.product_id, parseFloat(item.quantity) + 1)}
                        >
                          ➕
                        </button>
                        <button
                          className="shopping-cart-remove-button"
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

              <div className="shopping-cart-notes">
                <label htmlFor="order-notes" className="shopping-cart-notes-label">
                  Notas (opcional):
                </label>
                <textarea
                  id="order-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agregar notas sobre el pedido..."
                  className="shopping-cart-notes-textarea"
                  rows="3"
                />
              </div>

              <button
                className="shopping-cart-submit-button"
                onClick={handleSubmitOrder}
                disabled={submitting || cart.length === 0}
              >
                {submitting ? (
                  <>
                    <span className="shopping-cart-spinner"></span>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>Enviar Pedido</span>
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

export default ShoppingCart;

