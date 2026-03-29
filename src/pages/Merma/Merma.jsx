/**
 * Página Merma
 * Registro de pérdidas/desperdicios por restaurante
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';
import { getRestaurants } from '../../services/restaurants';
import { getUserRestaurant } from '../../services/restaurants';
import { getProducts } from '../../services/products';
import {
  getMermaByRestaurant,
  getAllMerma,
  createMerma,
  deleteMerma,
  normalizeMermaQuantity,
} from '../../services/merma';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/formatters';
import './Merma.css';

// Detectar si es acceso local (sin sidebar)
const isLocalAccess = () => {
  return window.location.search.includes('local=true') || 
         sessionStorage.getItem('merma_local_access') === 'true';
};

function Merma() {
  const [currentUser, setCurrentUser] = useState(null);
  const { roleName, isAdmin, isAlmacen, isRestaurante, loading: roleLoading } = useRole(currentUser?.id);
  const [localAccess] = useState(isLocalAccess());
  // Modo local: session_id inyectado por el servidor (el token nunca llega al cliente; todo pasa por el servidor local)
  const [localMermaConfig, setLocalMermaConfig] = useState(() => {
    if (!isLocalAccess()) return null;
    const sessionId = sessionStorage.getItem('merma_session_id');
    const restaurantName = sessionStorage.getItem('merma_restaurant_name') || '';
    return sessionId ? { sessionId, restaurantName } : null;
  });

  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [userRestaurant, setUserRestaurant] = useState(null);

  const [products, setProducts] = useState([]);
  const [merma, setMerma] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    motivo: '',
    fecha: new Date().toISOString().slice(0, 16),
  });
  // Búsqueda de producto (solo interfaz local táctil)
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchFocused, setProductSearchFocused] = useState(false);
  const productSearchBlurTimer = useRef(null);

  const canEdit = isAdmin || isAlmacen || isRestaurante;
  const effectiveRestaurantId = isRestaurante
    ? userRestaurant?.id
    : selectedRestaurantId || null;

  useEffect(() => {
    if (localAccess) {
      const sessionId = sessionStorage.getItem('merma_session_id');
      const restaurantName = sessionStorage.getItem('merma_restaurant_name') || '';
      setLocalMermaConfig(sessionId ? { sessionId, restaurantName } : null);
      return;
    }
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    loadUser();
  }, [localAccess]);

  useEffect(() => {
    if (localAccess) return;
    if (sessionStorage.getItem('mermaOpenForm') === 'true') {
      sessionStorage.removeItem('mermaOpenForm');
      setShowForm(true);
    }
  }, []);

  useEffect(() => {
    if (localAccess) return;
    if (!roleName) return;
    if (isAdmin || isAlmacen) {
      getRestaurants()
        .then(setRestaurants)
        .catch((err) => {
          console.error('Error al cargar restaurantes:', err);
          setError(err.message);
        });
    }
    if (isRestaurante && currentUser?.id) {
      getUserRestaurant(currentUser.id)
        .then((r) => {
          setUserRestaurant(r);
          if (r?.id) setSelectedRestaurantId(String(r.id));
        })
        .catch((err) => {
          console.error('Error al cargar restaurante del usuario:', err);
          setError(err.message);
        });
    }
  }, [roleName, isAdmin, isAlmacen, isRestaurante, currentUser?.id]);

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
    }
  };

  const loadMerma = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = isAdmin || isAlmacen
        ? await getAllMerma({ restaurantId: effectiveRestaurantId })
        : await getMermaByRestaurant(effectiveRestaurantId);
      setMerma(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [effectiveRestaurantId, isAdmin, isAlmacen]);

  useEffect(() => {
    if (localAccess) return;
    if (effectiveRestaurantId) {
      loadMerma();
    } else {
      setMerma([]);
      setLoading(false);
    }
  }, [localAccess, effectiveRestaurantId, loadMerma]);

  useEffect(() => {
    if (localAccess && localMermaConfig?.sessionId) {
      fetch('/api/products')
        .then((r) => {
          if (!r.ok) throw new Error(r.status === 403 ? 'IP no autorizada' : r.statusText || 'Error al cargar');
          return r.json();
        })
        .then(setProducts)
        .catch((err) => {
          console.error('Error al cargar productos:', err);
          setError(err.message);
        });
      return;
    }
    if (effectiveRestaurantId) {
      loadProducts();
    }
  }, [localAccess, localMermaConfig?.sessionId, effectiveRestaurantId]);

  useEffect(() => {
    if (localAccess || !effectiveRestaurantId) return undefined;

    const channel = supabase
      .channel(`realtime-merma-${effectiveRestaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merma',
          filter: `restaurant_id=eq.${effectiveRestaurantId}`,
        },
        () => {
          loadMerma();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [localAccess, effectiveRestaurantId, loadMerma]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const quantity = normalizeMermaQuantity(formData.quantity);
    if (!formData.product_id) {
      setError('Selecciona un producto');
      return;
    }
    if (quantity === null) {
      setError('La cantidad debe ser un número entero mayor que 0 (unidades, sin decimales)');
      return;
    }

    try {
      if (localAccess && localMermaConfig?.sessionId) {
        const res = await fetch('/api/merma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: localMermaConfig.sessionId,
            product_id: formData.product_id,
            quantity,
            motivo: formData.motivo || null,
            fecha: formData.fecha ? new Date(formData.fecha).toISOString() : new Date().toISOString(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText || 'Error al registrar merma');
      } else {
        await createMerma({
          restaurant_id: effectiveRestaurantId,
          product_id: formData.product_id,
          quantity,
          motivo: formData.motivo.trim() || null,
          fecha: formData.fecha ? new Date(formData.fecha).toISOString() : new Date().toISOString(),
        });
      }

      setSuccess('Merma registrada correctamente');
      setFormData({
        product_id: '',
        quantity: '',
        motivo: '',
        fecha: new Date().toISOString().slice(0, 16),
      });
      setShowForm(false);
      if (!localAccess) await loadMerma();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este registro de merma?')) return;
    try {
      setError('');
      await deleteMerma(id);
      await loadMerma();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatMermaQty = (q) => Math.max(0, Math.round(Number(q)));

  // Productos filtrados por nombre (interfaz local)
  const filteredProductsLocal = useMemo(() => {
    if (!localAccess || !products.length) return products;
    const q = (productSearchQuery || '').trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.referencia || '').toLowerCase().includes(q)
    );
  }, [localAccess, products, productSearchQuery]);

  const showLocalProductList =
    localAccess &&
    !formData.product_id &&
    (productSearchFocused || productSearchQuery.trim() !== '');

  useEffect(() => {
    return () => {
      if (productSearchBlurTimer.current) {
        clearTimeout(productSearchBlurTimer.current);
      }
    };
  }, []);

  // Si es acceso local, mostrar interfaz simplificada (sin sesión: usa cuenta que inició el servidor)
  if (localAccess) {
    if (!localMermaConfig) {
      return (
        <div className="merma merma-local">
          <div className="merma-local-container">
            <div className="merma-local-title-row">
              <h1 className="merma-local-title">📉 Registro de Merma</h1>
              <button
                type="button"
                className="merma-local-reload"
                onClick={() => window.location.reload()}
              >
                🔄 Recargar página
              </button>
            </div>
            <div className="merma-error">
              <span>⚠️</span>
              <span>Configuración no válida. Accede desde la URL del servidor de merma (IP autorizada).</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="merma merma-local">
        <div className="merma-local-container">
          <div className="merma-local-title-row">
            <h1 className="merma-local-title">📉 Registro de Merma</h1>
            <button
              type="button"
              className="merma-local-reload"
              onClick={() => window.location.reload()}
            >
              🔄 Recargar página
            </button>
          </div>

          {error && (
            <div className="merma-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="merma-success">
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          <div className="merma-local-badge">
            <span>📍</span>
            {localMermaConfig.restaurantName || 'Local'}
          </div>

          {localMermaConfig.sessionId && (
            <form onSubmit={handleSubmit} className="merma-form merma-form-local">
              <div
                className={`merma-form-group merma-form-group-touch merma-local-product-field${showLocalProductList ? ' merma-local-product-field--open' : ''}`}
              >
                <label htmlFor="local-product-search">Buscar producto por nombre</label>
                <div className="merma-local-product-input-shell">
                  {showLocalProductList && (
                    <div className="merma-local-product-list" role="listbox" aria-label="Productos">
                      {filteredProductsLocal.slice(0, 50).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          className="merma-local-product-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, product_id: p.id }));
                            setProductSearchQuery('');
                            setProductSearchFocused(false);
                          }}
                        >
                          <span className="merma-local-product-name">{p.nombre}</span>
                          {(p.referencia || p.medida || p.formato) && (
                            <span className="merma-local-product-meta">
                              {[p.referencia, p.medida, p.formato].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredProductsLocal.length === 0 && productSearchQuery.trim() && (
                        <p className="merma-local-no-results">No hay productos con &quot;{productSearchQuery}&quot;</p>
                      )}
                    </div>
                  )}
                  <input
                    id="local-product-search"
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    className="merma-local-search"
                    value={
                      formData.product_id
                        ? (products.find((p) => p.id === formData.product_id)?.nombre || '')
                        : productSearchQuery
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setProductSearchQuery(v);
                      if (!v) setFormData((prev) => ({ ...prev, product_id: '' }));
                    }}
                    onFocus={() => {
                      if (productSearchBlurTimer.current) {
                        clearTimeout(productSearchBlurTimer.current);
                        productSearchBlurTimer.current = null;
                      }
                      if (formData.product_id) {
                        const name = products.find((p) => p.id === formData.product_id)?.nombre || '';
                        setFormData((prev) => ({ ...prev, product_id: '' }));
                        setProductSearchQuery(name);
                      }
                      setProductSearchFocused(true);
                    }}
                    onBlur={() => {
                      productSearchBlurTimer.current = setTimeout(() => {
                        setProductSearchFocused(false);
                        productSearchBlurTimer.current = null;
                      }, 180);
                    }}
                    placeholder="Escribe para buscar..."
                  />
                </div>
                {formData.product_id && (
                  <button
                    type="button"
                    className="merma-local-clear-product"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, product_id: '' }));
                      setProductSearchQuery('');
                    }}
                  >
                    Cambiar producto
                  </button>
                )}
              </div>

              <div className="merma-form-group merma-form-group-touch">
                <label htmlFor="local-quantity">Cantidad (unidades enteras) *</label>
                <div className="merma-local-quantity-wrap">
                  <input
                    id="local-quantity"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="merma-local-input-touch"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        quantity: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="Ej: 5"
                    required
                  />
                  <span className="merma-local-unit">unidades</span>
                </div>
              </div>

              <div className="merma-form-group merma-form-group-touch">
                <label htmlFor="local-motivo">Motivo (opcional)</label>
                <input
                  id="local-motivo"
                  type="text"
                  className="merma-local-input-touch"
                  value={formData.motivo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej: Caducado, Dañado, Roto"
                />
              </div>

              <div className="merma-form-group merma-form-group-touch">
                <label htmlFor="local-fecha">Fecha</label>
                <div className="merma-local-datetime-wrap">
                  <input
                    id="local-fecha"
                    type="datetime-local"
                    className="merma-local-input-touch merma-local-datetime"
                    value={formData.fecha}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="merma-local-fecha-now"
                    onClick={() => setFormData((prev) => ({ ...prev, fecha: new Date().toISOString().slice(0, 16) }))}
                  >
                    Actualizar
                  </button>
                </div>
              </div>

              <button type="submit" className="merma-btn merma-btn-primary merma-local-submit">
                Registrar Merma
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  if (roleLoading) {
    return (
      <div className="merma">
        <div className="merma-loading">Cargando...</div>
      </div>
    );
  }

  // Interfaz normal (con sidebar)
  return (
    <div className="merma">
      <div className="merma-header">
        <div>
          <h1 className="merma-title">📉 Merma</h1>
          <p className="merma-subtitle">Registro de pérdidas y desperdicios</p>
        </div>
        <div className="merma-header-actions">
          {(isAdmin || isAlmacen) && (
            <div className="merma-select-wrap">
              <label htmlFor="merma-restaurant" className="merma-select-label">Local</label>
              <select
                id="merma-restaurant"
                className="merma-select"
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
              >
                <option value="">Seleccionar local</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {isRestaurante && userRestaurant && (
            <div className="merma-local-badge">
              <span>📍</span>
              {userRestaurant.nombre}
            </div>
          )}
          <button
            type="button"
            className="merma-btn merma-btn-secondary"
            onClick={() => window.location.reload()}
            title="Recargar la página por si el servidor se reinició"
          >
            <span>🔄</span>
            Recargar página
          </button>
          {canEdit && effectiveRestaurantId && (
            <button
              type="button"
              className="merma-btn merma-btn-create"
              onClick={() => setShowForm(true)}
            >
              <span>➕</span>
              Nueva Merma
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="merma-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="merma-success">
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      {isRestaurante && !userRestaurant && !roleLoading && (
        <div className="merma-empty">
          <span>📍</span>
          <p>No tienes un local asignado. Contacta con un administrador.</p>
        </div>
      )}

      {(isAdmin || isAlmacen) && !selectedRestaurantId && restaurants.length > 0 && !roleLoading && (
        <div className="merma-empty">
          <span>📉</span>
          <p>Selecciona un local para ver sus registros de merma.</p>
        </div>
      )}

      {effectiveRestaurantId && (
        <>
          {loading ? (
            <div className="merma-loading">Cargando registros...</div>
          ) : merma.length === 0 ? (
            <div className="merma-empty">
              <span>📉</span>
              <p>Aún no hay registros de merma en este local.</p>
              {canEdit && (
                <button
                  type="button"
                  className="merma-btn merma-btn-create"
                  onClick={() => setShowForm(true)}
                >
                  Registrar primera merma
                </button>
              )}
            </div>
          ) : (
            <div className="merma-list">
              {merma.map((m) => (
                <div key={m.id} className="merma-card">
                  <div className="merma-card-header">
                    <h3>{m.product?.nombre ?? 'Producto'}</h3>
                    {isAdmin && (
                      <button
                        type="button"
                        className="merma-card-delete"
                        onClick={() => handleDelete(m.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <div className="merma-card-body">
                    <div className="merma-card-row">
                      <span className="merma-card-label">Cantidad</span>
                      <span className="merma-card-value">
                        {formatMermaQty(m.quantity)} unidades
                      </span>
                    </div>
                    {m.motivo && (
                      <div className="merma-card-row">
                        <span className="merma-card-label">Motivo</span>
                        <span className="merma-card-value">{m.motivo}</span>
                      </div>
                    )}
                    <div className="merma-card-row">
                      <span className="merma-card-label">Fecha</span>
                      <span className="merma-card-value">
                        {formatDate(m.fecha)}
                      </span>
                    </div>
                    {m.product?.referencia && (
                      <div className="merma-card-row">
                        <span className="merma-card-label">Referencia</span>
                        <span className="merma-card-value">{m.product.referencia}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="merma-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="merma-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="merma-modal-title">Nueva Merma</h3>
            <form onSubmit={handleSubmit} className="merma-form">
              <div className="merma-form-group">
                <label htmlFor="form-product">Producto *</label>
                <select
                  id="form-product"
                  value={formData.product_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, product_id: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.referencia ? `(${p.referencia})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="merma-form-group">
                <label htmlFor="form-quantity">Cantidad (unidades enteras) *</label>
                <input
                  id="form-quantity"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  placeholder="Ej: 5"
                  required
                />
                <span className="merma-form-unit">unidades</span>
              </div>

              <div className="merma-form-group">
                <label htmlFor="form-motivo">Motivo (opcional)</label>
                <input
                  id="form-motivo"
                  type="text"
                  value={formData.motivo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej: Caducado, Dañado, Roto"
                />
              </div>

              <div className="merma-form-group">
                <label htmlFor="form-fecha">Fecha</label>
                <input
                  id="form-fecha"
                  type="datetime-local"
                  value={formData.fecha}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))}
                />
              </div>

              <div className="merma-form-actions">
                <button
                  type="button"
                  className="merma-btn merma-btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="merma-btn merma-btn-primary">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Merma;
