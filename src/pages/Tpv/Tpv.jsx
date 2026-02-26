/**
 * Página TPV - Punto de venta
 * Ventas abiertas, ticket actual, añadir líneas (productos/platos), cerrar/cancelar venta
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import {
  getCurrentUserRestaurant,
  getSales,
  getSaleWithItems,
  createSale,
  addSaleItem,
  updateSaleItem,
  removeSaleItem,
  closeSale,
  cancelSale,
  getProductsForTpv,
  getDishesForTpv,
  SALE_STATUS,
} from '../../services/tpv/tpv';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import './Tpv.css';

function Tpv() {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [openSales, setOpenSales] = useState([]);
  const [currentSale, setCurrentSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [addSearch, setAddSearch] = useState('');
  const [addTab, setAddTab] = useState('product'); // 'product' | 'dish'

  const loadUserAndRestaurant = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
    if (!u) return null;
    try {
      const rest = await getCurrentUserRestaurant(u.id);
      setRestaurant(rest);
      return rest?.id ?? null;
    } catch {
      setRestaurant(null);
      return null;
    }
  }, []);

  const tpvErrorMessage = (err, fallback) => {
    const msg = err?.message || '';
    if (msg.includes('Invalid schema') || msg.includes('schema: tpv') || msg.includes('apikey')) {
      return 'El schema TPV no está expuesto en la API. En Supabase: Project Settings → API → Exposed schemas → añadir "tpv" y guardar.';
    }
    return fallback || msg || 'Error en TPV';
  };

  const loadOpenSales = useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    try {
      const list = await getSales(restaurantId, SALE_STATUS.OPEN);
      setOpenSales(list || []);
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al cargar ventas'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError('');
      const restId = await loadUserAndRestaurant();
      if (!cancelled && restId) await loadOpenSales(restId);
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [loadUserAndRestaurant, loadOpenSales]);

  const refreshAfterSaleChange = useCallback(() => {
    if (restaurant?.id) loadOpenSales(restaurant.id);
    setCurrentSale(null);
  }, [restaurant?.id, loadOpenSales]);

  const handleNewSale = async () => {
    if (!restaurant?.id || !user?.id) return;
    setError('');
    setSubmitting(true);
    try {
      const sale = await createSale(restaurant.id, user.id);
      setOpenSales((prev) => [sale, ...prev]);
      const full = await getSaleWithItems(sale.id);
      setCurrentSale(full);
      setSuccess('Venta creada');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al crear venta'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSale = async (saleId) => {
    setError('');
    try {
      const full = await getSaleWithItems(saleId);
      setCurrentSale(full);
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al cargar venta'));
    }
  };

  const handleBackToList = () => {
    setCurrentSale(null);
    if (restaurant?.id) loadOpenSales(restaurant.id);
  };

  const handleAddItem = async (item) => {
    if (!currentSale || currentSale.status !== SALE_STATUS.OPEN) return;
    setError('');
    try {
      await addSaleItem(currentSale.id, {
        productId: item.tipo === 'product' ? item.id : null,
        dishId: item.tipo === 'dish' ? item.id : null,
        itemName: item.nombre,
        quantity: 1,
        unitPrice: item.precio,
      });
      const updated = await getSaleWithItems(currentSale.id);
      setCurrentSale(updated);
      setAddModalOpen(false);
      setAddSearch('');
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al añadir'));
    }
  };

  const handleUpdateItemQty = async (itemId, quantity) => {
    if (!currentSale) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0.001) return;
    setError('');
    try {
      const item = currentSale.items.find((i) => i.id === itemId);
      if (!item) return;
      await updateSaleItem(itemId, { quantity: qty, unitPrice: item.unit_price });
      const updated = await getSaleWithItems(currentSale.id);
      setCurrentSale(updated);
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al actualizar'));
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!currentSale) return;
    setError('');
    try {
      await removeSaleItem(itemId);
      const updated = await getSaleWithItems(currentSale.id);
      setCurrentSale(updated);
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al eliminar'));
    }
  };

  const handleCloseSale = async () => {
    if (!currentSale) return;
    setSubmitting(true);
    setError('');
    try {
      await closeSale(currentSale.id);
      setSuccess('Venta cerrada');
      setTimeout(() => setSuccess(''), 2000);
      refreshAfterSaleChange();
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al cerrar venta'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSale = async () => {
    if (!currentSale || !window.confirm('¿Cancelar esta venta? No se podrá deshacer.')) return;
    setSubmitting(true);
    setError('');
    try {
      await cancelSale(currentSale.id);
      setSuccess('Venta cancelada');
      setTimeout(() => setSuccess(''), 2000);
      refreshAfterSaleChange();
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al cancelar'));
    } finally {
      setSubmitting(false);
    }
  };

  const openAddModal = async () => {
    setAddModalOpen(true);
    setAddSearch('');
    setAddTab('product');
    try {
      const [prods, dishList] = await Promise.all([
        getProductsForTpv(),
        restaurant?.id ? getDishesForTpv(restaurant.id) : [],
      ]);
      setProducts(prods);
      setDishes(dishList);
    } catch (e) {
      setError(tpvErrorMessage(e, 'Error al cargar listas'));
    }
  };

  const addItemsFiltered = useMemo(() => {
    const term = (addSearch || '').toLowerCase().trim();
    if (!term) {
      return addTab === 'product'
        ? products
        : dishes;
    }
    const list = addTab === 'product' ? products : dishes;
    return list.filter((x) => x.nombre?.toLowerCase().includes(term));
  }, [addTab, addSearch, products, dishes]);

  if (loading) {
    return (
      <div className="tpv-container">
        <div className="tpv-loading">
          <div className="tpv-spinner" />
          <p>Cargando TPV...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="tpv-container">
        <div className="tpv-header">
          <h1 className="tpv-title">🖥️ TPV</h1>
          <p className="tpv-subtitle">Punto de venta</p>
        </div>
        <div className="tpv-no-restaurant">
          <p>No tienes un restaurante asignado.</p>
          <p>Configura tu perfil en <strong>Mi Perfil</strong> o pide a un administrador que te asigne un restaurante para usar el TPV.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tpv-container">
      <div className="tpv-header">
        <h1 className="tpv-title">🖥️ TPV</h1>
        <p className="tpv-subtitle">Punto de venta · {restaurant.nombre}</p>
      </div>

      {error && (
        <div className="tpv-message tpv-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="tpv-message tpv-success">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      {!currentSale ? (
        <>
          <div className="tpv-actions">
            <button
              type="button"
              className="tpv-btn tpv-btn-primary"
              onClick={handleNewSale}
              disabled={submitting}
            >
              ➕ Nueva venta
            </button>
          </div>
          <div className="tpv-sales-section">
            <h2 className="tpv-section-title">Ventas abiertas</h2>
            {openSales.length === 0 ? (
              <div className="tpv-empty">No hay ventas abiertas. Crea una con «Nueva venta».</div>
            ) : (
              <div className="tpv-sales-grid">
                {openSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    className="tpv-sale-card"
                    onClick={() => handleOpenSale(sale.id)}
                  >
                    <span className="tpv-sale-id">{sale.id.slice(0, 8)}…</span>
                    <span className="tpv-sale-total">{formatCurrency(sale.total)}</span>
                    <span className="tpv-sale-date">{formatDateTime(sale.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="tpv-ticket">
          <div className="tpv-ticket-header">
            <h2 className="tpv-ticket-title">Ticket · {currentSale.id.slice(0, 8)}…</h2>
            <button type="button" className="tpv-btn tpv-btn-ghost" onClick={handleBackToList}>
              ← Volver
            </button>
          </div>

          <div className="tpv-ticket-items">
            {currentSale.items.length === 0 ? (
              <div className="tpv-ticket-empty">Sin líneas. Añade productos o platos.</div>
            ) : (
              <ul className="tpv-items-list">
                {currentSale.items.map((item) => (
                  <li key={item.id} className="tpv-item-row">
                    <span className="tpv-item-name">{item.item_name}</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItemQty(item.id, e.target.value)}
                      className="tpv-item-qty"
                    />
                    <span className="tpv-item-price">{formatCurrency(item.unit_price)}</span>
                    <span className="tpv-item-subtotal">{formatCurrency(item.subtotal)}</span>
                    <button
                      type="button"
                      className="tpv-item-remove"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label="Quitar"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="tpv-ticket-total">
            <span>Total</span>
            <strong>{formatCurrency(currentSale.total)}</strong>
          </div>

          <div className="tpv-ticket-actions">
            <button
              type="button"
              className="tpv-btn tpv-btn-secondary"
              onClick={openAddModal}
              disabled={currentSale.status !== SALE_STATUS.OPEN}
            >
              ➕ Añadir producto / plato
            </button>
            {currentSale.status === SALE_STATUS.OPEN && (
              <>
                <button
                  type="button"
                  className="tpv-btn tpv-btn-danger"
                  onClick={handleCancelSale}
                  disabled={submitting}
                >
                  Cancelar venta
                </button>
                <button
                  type="button"
                  className="tpv-btn tpv-btn-primary"
                  onClick={handleCloseSale}
                  disabled={submitting || currentSale.items.length === 0}
                >
                  ✅ Cerrar venta
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="tpv-modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="tpv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tpv-modal-header">
              <h3>Añadir al ticket</h3>
              <button type="button" className="tpv-modal-close" onClick={() => setAddModalOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="tpv-modal-tabs">
              <button
                type="button"
                className={addTab === 'product' ? 'active' : ''}
                onClick={() => setAddTab('product')}
              >
                Productos
              </button>
              <button
                type="button"
                className={addTab === 'dish' ? 'active' : ''}
                onClick={() => setAddTab('dish')}
              >
                Platos
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="tpv-modal-search"
            />
            <div className="tpv-modal-list">
              {addItemsFiltered.map((item) => (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  className="tpv-modal-item"
                  onClick={() => handleAddItem(item)}
                >
                  <span className="tpv-modal-item-name">{item.nombre}</span>
                  <span className="tpv-modal-item-price">{formatCurrency(item.precio)}</span>
                </button>
              ))}
              {addItemsFiltered.length === 0 && (
                <div className="tpv-modal-empty">
                  {addTab === 'product' ? 'No hay productos' : 'No hay platos'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tpv;
