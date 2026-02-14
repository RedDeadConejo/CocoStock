/**
 * Página Platos
 * Productos o platos de cada local (restaurante)
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';
import { getRestaurants } from '../../services/restaurants';
import { getUserRestaurant } from '../../services/restaurants';
import {
  getDishesByRestaurant,
  createDish,
  updateDish,
  deleteDish,
  setDishIngredients,
} from '../../services/dishes';
import { getProducts } from '../../services/products';
import { formatCurrency } from '../../utils/formatters';
import { computeEscandallo, escandalloToCsv } from '../../utils/escandallo';
import { toBaseQuantity, fromBaseQuantity, getUnitsForMedida } from '../../utils/unitConversion';
import './Platos.css';

const CATEGORIAS = ['Entrantes', 'Principales', 'Postres', 'Bebidas', 'Otros'];

function Platos() {
  const [currentUser, setCurrentUser] = useState(null);
  const { roleName, isAdmin, isAlmacen, isRestaurante, loading: roleLoading } = useRole(currentUser?.id);

  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [userRestaurant, setUserRestaurant] = useState(null);

  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria: '',
    activo: true,
    ingredients: [],
  });
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showEscandallo, setShowEscandallo] = useState(null); // 'individual' | 'filtered'
  const [escandalloDish, setEscandalloDish] = useState(null);

  const canEdit = isAdmin || isRestaurante;
  const effectiveRestaurantId = isRestaurante
    ? userRestaurant?.id
    : selectedRestaurantId || null;

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (!effectiveRestaurantId) {
      setDishes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    getDishesByRestaurant(effectiveRestaurantId)
      .then(setDishes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [effectiveRestaurantId]);

  useEffect(() => {
    if (showForm && canEdit) {
      setLoadingProducts(true);
      getProducts()
        .then(setProducts)
        .catch((err) => {
          console.error('Error al cargar productos:', err);
          setError(err.message);
        })
        .finally(() => setLoadingProducts(false));
    }
  }, [showForm, canEdit]);

  const handleCreate = () => {
    setEditingDish(null);
    setFormData({
      nombre: '',
      descripcion: '',
      precio: '',
      categoria: '',
      activo: true,
      ingredients: [],
    });
    setShowForm(true);
  };

  const handleEdit = (dish) => {
    setEditingDish(dish);
    const ing = (dish.ingredients || []).map((i) => {
      const baseQty = Number(i.quantity) || 0;
      const baseUnit = i.product?.medida || 'unidades';
      const displayUnit = i.unit || baseUnit;
      const displayQty = fromBaseQuantity(baseQty, displayUnit, baseUnit);
      return {
        product_id: i.product_id,
        quantity: displayQty,
        unit: displayUnit,
        product: i.product,
      };
    });
    setFormData({
      nombre: dish.nombre || '',
      descripcion: dish.descripcion || '',
      precio: String(dish.precio ?? ''),
      categoria: dish.categoria || '',
      activo: dish.activo !== false,
      ingredients: ing,
    });
    setShowForm(true);
  };

  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { product_id: '', quantity: '', unit: '' }],
    }));
  };

  const removeIngredient = (idx) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const updateIngredient = (idx, field, value) => {
    setFormData((prev) => {
      const next = [...prev.ingredients];
      const ing = { ...next[idx], [field]: value };
      if (field === 'product_id') {
        const p = products.find((x) => x.id === value);
        if (p?.medida && !ing.unit) ing.unit = p.medida;
      }
      if (field === 'unit') {
        const p = products.find((x) => x.id === ing.product_id) || ing.product;
        const baseUnit = p?.medida || 'unidades';
        const oldUnit = next[idx].unit || baseUnit;
        const baseQty = toBaseQuantity(parseFloat(next[idx].quantity) || 0, oldUnit, baseUnit);
        ing.quantity = fromBaseQuantity(baseQty, value || baseUnit, baseUnit);
      }
      next[idx] = ing;
      return { ...prev, ingredients: next };
    });
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingDish(null);
    if (effectiveRestaurantId) {
      getDishesByRestaurant(effectiveRestaurantId).then(setDishes).catch(console.error);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const nombre = formData.nombre.trim();
    if (!nombre) {
      setError('El nombre es obligatorio');
      return;
    }
    const precio = parseFloat(formData.precio);
    if (isNaN(precio) || precio < 0) {
      setError('Precio debe ser un número >= 0');
      return;
    }
    const validIngredients = (formData.ingredients || [])
      .filter((i) => i.product_id && (parseFloat(i.quantity) || 0) > 0)
      .map((i) => {
        const p = products.find((x) => x.id === i.product_id) || i.product;
        const baseUnit = p?.medida || 'unidades';
        const displayUnit = i.unit || baseUnit;
        const baseQty = toBaseQuantity(parseFloat(i.quantity) || 0, displayUnit, baseUnit);
        return { product_id: i.product_id, quantity: baseQty, unit: displayUnit !== baseUnit ? displayUnit : null };
      });
    try {
      let dishId;
      if (editingDish) {
        await updateDish(editingDish.id, {
          nombre,
          descripcion: formData.descripcion.trim() || null,
          precio,
          categoria: formData.categoria.trim() || null,
          activo: formData.activo,
        });
        dishId = editingDish.id;
      } else {
        const created = await createDish({
          restaurant_id: effectiveRestaurantId,
          nombre,
          descripcion: formData.descripcion.trim() || null,
          precio,
          categoria: formData.categoria.trim() || null,
          activo: formData.activo,
        });
        dishId = created.id;
      }
      await setDishIngredients(dishId, validIngredients);
      handleFormClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatIngredientUnit = (p, unitOverride = null) => {
    if (!p) return 'ud';
    return unitOverride || p.medida || p.formato || 'ud';
  };

  const openEscandalloIndividual = (dish) => {
    setEscandalloDish(dish);
    setShowEscandallo('individual');
  };

  const openEscandalloFiltered = () => {
    setEscandalloDish(null);
    setShowEscandallo('filtered');
  };

  const closeEscandallo = () => {
    setShowEscandallo(null);
    setEscandalloDish(null);
  };

  const exportEscandalloCsv = () => {
    const list = showEscandallo === 'individual' && escandalloDish ? [escandalloDish] : filteredDishes;
    const csv = escandalloToCsv(list);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base =
      showEscandallo === 'individual' && escandalloDish
        ? (escandalloDish.nombre || 'plato').replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)
        : 'filtrados';
    a.download = `escandallo-${base}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printEscandallo = () => {
    window.print();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este plato?')) return;
    try {
      setError('');
      await deleteDish(id);
      if (effectiveRestaurantId) {
        const data = await getDishesByRestaurant(effectiveRestaurantId);
        setDishes(data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('all');

  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!d.nombre?.toLowerCase().includes(s) && !d.descripcion?.toLowerCase().includes(s)) return false;
      }
      if (filterCategoria !== 'all' && (d.categoria || '') !== filterCategoria) return false;
      return true;
    });
  }, [dishes, searchTerm, filterCategoria]);

  const categoriasEnUso = useMemo(() => {
    const set = new Set(dishes.map((d) => d.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [dishes]);

  if (roleLoading) {
    return (
      <div className="platos">
        <div className="platos-loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="platos">
      <div className="platos-header">
        <div>
          <h1 className="platos-title">🍽️ Platos del local</h1>
          <p className="platos-subtitle">Productos o platos de cada restaurante</p>
        </div>
        <div className="platos-header-actions">
          {(isAdmin || isAlmacen) && (
            <div className="platos-select-wrap">
              <label htmlFor="platos-restaurant" className="platos-select-label">Local</label>
              <select
                id="platos-restaurant"
                className="platos-select"
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
            <div className="platos-local-badge">
              <span className="platos-icon">📍</span>
              {userRestaurant.nombre}
            </div>
          )}
          {canEdit && effectiveRestaurantId && (
            <button type="button" className="platos-btn platos-btn-create" onClick={handleCreate}>
              <span className="platos-icon">➕</span>
              Nuevo plato
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="platos-error">
          <span className="platos-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {isRestaurante && !userRestaurant && !roleLoading && (
        <div className="platos-empty">
          <span className="platos-icon">📍</span>
          <p>No tienes un local asignado. Contacta con un administrador.</p>
        </div>
      )}

      {(isAdmin || isAlmacen) && !selectedRestaurantId && restaurants.length > 0 && !roleLoading && (
        <div className="platos-empty">
          <span className="platos-icon">🍽️</span>
          <p>Selecciona un local para ver sus platos.</p>
        </div>
      )}

      {effectiveRestaurantId && (
        <>
          <div className="platos-filters">
            <div className="platos-filters-row">
              <div className="platos-filter-group">
                <label htmlFor="platos-search" className="platos-filter-label">🔍 Búsqueda</label>
                <input
                  id="platos-search"
                  type="text"
                  className="platos-filter-input"
                  placeholder="Nombre o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="platos-filter-group">
                <label htmlFor="platos-cat" className="platos-filter-label">Categoría</label>
                <select
                  id="platos-cat"
                  className="platos-filter-select"
                  value={filterCategoria}
                  onChange={(e) => setFilterCategoria(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {categoriasEnUso.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {filteredDishes.length > 0 && (
                <button
                  type="button"
                  className="platos-btn platos-btn-escandallo"
                  onClick={openEscandalloFiltered}
                >
                  📋 Escandallo ({filteredDishes.length} platos)
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="platos-loading">Cargando platos...</div>
          ) : filteredDishes.length === 0 ? (
            <div className="platos-empty">
              <span className="platos-icon">🍽️</span>
              <p>
                {dishes.length === 0
                  ? 'Aún no hay platos en este local.'
                  : 'No hay platos que coincidan con los filtros.'}
              </p>
              {canEdit && dishes.length === 0 && (
                <button type="button" className="platos-btn platos-btn-create" onClick={handleCreate}>
                  Crear primer plato
                </button>
              )}
            </div>
          ) : (
            <div className="platos-grid">
              {filteredDishes.map((d) => (
                <div key={d.id} className="platos-card">
                  <div className="platos-card-header">
                    <h3 className="platos-card-title">{d.nombre}</h3>
                    <span className={`platos-card-badge platos-card-badge-${d.activo ? 'activo' : 'inactivo'}`}>
                      {d.activo ? 'Activo' : 'Oculto'}
                    </span>
                  </div>
                  <div className="platos-card-body">
                    {d.descripcion && (
                      <p className="platos-card-desc">{d.descripcion}</p>
                    )}
                    <div className="platos-card-row">
                      <span className="platos-card-label">Precio</span>
                      <span className="platos-card-value platos-card-precio">
                        {formatCurrency(d.precio)}
                      </span>
                    </div>
                    {d.categoria && (
                      <div className="platos-card-row">
                        <span className="platos-card-label">Categoría</span>
                        <span className="platos-card-value">{d.categoria}</span>
                      </div>
                    )}
                    {d.ingredients && d.ingredients.length > 0 && (
                      <div className="platos-card-ingredients">
                        <span className="platos-card-label">Ingredientes</span>
                        <ul className="platos-ingredients-list">
                          {d.ingredients.map((i) => {
                            const baseUnit = i.product?.medida || 'unidades';
                            const displayUnit = i.unit || baseUnit;
                            const displayQty = displayUnit !== baseUnit
                              ? fromBaseQuantity(Number(i.quantity) || 0, displayUnit, baseUnit)
                              : Number(i.quantity) || 0;
                            return (
                              <li key={i.id || i.product_id}>
                                {i.product?.nombre ?? 'Producto'}
                                {' — '}
                                {displayQty} {formatIngredientUnit(i.product, displayUnit)}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="platos-card-actions">
                    {(d.ingredients?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        className="platos-card-btn platos-card-btn-escandallo"
                        onClick={() => openEscandalloIndividual(d)}
                      >
                        📋 Escandallo
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="platos-card-btn platos-card-btn-edit"
                          onClick={() => handleEdit(d)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="platos-card-btn platos-card-btn-delete"
                          onClick={() => handleDelete(d.id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="platos-modal-overlay" onClick={handleFormClose}>
          <div className="platos-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="platos-modal-title">
              {editingDish ? 'Editar plato' : 'Nuevo plato'}
            </h3>
            <form onSubmit={handleFormSubmit} className="platos-form">
              <div className="platos-form-group">
                <label htmlFor="form-nombre">Nombre *</label>
                <input
                  id="form-nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej. Ensalada César"
                  required
                />
              </div>
              <div className="platos-form-group">
                <label htmlFor="form-desc">Descripción</label>
                <textarea
                  id="form-desc"
                  value={formData.descripcion}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción opcional"
                  rows={2}
                />
              </div>
              <div className="platos-form-group">
                <label htmlFor="form-precio">Precio (€) *</label>
                <input
                  id="form-precio"
                  type="text"
                  inputMode="decimal"
                  value={formData.precio}
                  onChange={(e) => setFormData((prev) => ({ ...prev, precio: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="platos-form-group">
                <label htmlFor="form-categoria">Categoría</label>
                <select
                  id="form-categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoria: e.target.value }))}
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="platos-form-group platos-form-check">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, activo: e.target.checked }))}
                  />
                  <span>Visible en carta</span>
                </label>
              </div>

              <div className="platos-form-group platos-ingredients">
                <div className="platos-ingredients-header">
                  <label>🥗 Ingredientes (productos del almacén)</label>
                  <button
                    type="button"
                    className="platos-btn platos-btn-small platos-btn-secondary"
                    onClick={addIngredient}
                    disabled={loadingProducts}
                  >
                    + Añadir ingrediente
                  </button>
                </div>
                {(formData.ingredients || []).length > 0 && (
                  <div className="platos-ingredients-columns">
                    <span className="platos-ingredient-col-producto">Producto</span>
                    <span className="platos-ingredient-col-cantidad">Cantidad</span>
                    <span className="platos-ingredient-col-unidad">Unidad</span>
                    <span className="platos-ingredient-col-actions" aria-hidden="true" />
                  </div>
                )}
                {loadingProducts && (
                  <p className="platos-ingredients-loading">Cargando productos...</p>
                )}
                {(formData.ingredients || []).map((ing, idx) => {
                  const usedIds = formData.ingredients
                    .filter((_, i) => i !== idx)
                    .map((x) => x.product_id)
                    .filter(Boolean);
                  const inProducts = products.find((p) => p.id === ing.product_id);
                  const extra =
                    ing.product_id && !inProducts && ing.product
                      ? [
                          {
                            id: ing.product_id,
                            nombre: `${ing.product.nombre || 'Producto'} (fuera de inventario)`,
                            medida: ing.product.medida,
                            formato: ing.product.formato,
                          },
                        ]
                      : [];
                  const available = [
                    ...products.filter((p) => !usedIds.includes(p.id)),
                    ...extra,
                  ];
                  const selectedProduct = ing.product_id
                    ? products.find((p) => p.id === ing.product_id) || ing.product
                    : null;
                  return (
                    <div key={idx} className="platos-ingredient-row">
                      <select
                        className="platos-ingredient-select"
                        value={ing.product_id || ''}
                        onChange={(e) => updateIngredient(idx, 'product_id', e.target.value)}
                      >
                        <option value="">Seleccionar producto</option>
                        {available.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                            {(p.medida || p.formato) && ` (${formatIngredientUnit(p)})`}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="platos-ingredient-qty"
                        placeholder="Cantidad"
                        value={ing.quantity ?? ''}
                        onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                      />
                      <select
                        className="platos-ingredient-unit-select"
                        value={ing.unit || selectedProduct?.medida || ''}
                        onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                        disabled={!selectedProduct}
                        title={selectedProduct ? 'Unidad de medida para esta receta' : 'Selecciona un producto primero'}
                      >
                        {selectedProduct ? (
                          getUnitsForMedida(selectedProduct.medida).map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))
                        ) : (
                          <option value="">—</option>
                        )}
                      </select>
                      <button
                        type="button"
                        className="platos-ingredient-remove"
                        onClick={() => removeIngredient(idx)}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="platos-form-actions">
                <button type="button" className="platos-btn platos-btn-secondary" onClick={handleFormClose}>
                  Cancelar
                </button>
                <button type="submit" className="platos-btn platos-btn-primary">
                  {editingDish ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEscandallo && (
        <div className="platos-modal-overlay platos-escandallo-overlay" onClick={closeEscandallo}>
          <div
            className="platos-modal platos-escandallo-modal no-print"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="platos-escandallo-print">
              <h3 className="platos-modal-title">
                {showEscandallo === 'individual' && escandalloDish
                  ? `📋 Escandallo: ${escandalloDish.nombre}`
                  : `📋 Escandallo (${filteredDishes.length} platos filtrados)`}
              </h3>

              {showEscandallo === 'individual' && escandalloDish ? (
                <EscandalloIndividual dish={escandalloDish} formatCurrency={formatCurrency} computeEscandallo={computeEscandallo} />
              ) : (
                <EscandalloFiltered dishes={filteredDishes} formatCurrency={formatCurrency} computeEscandallo={computeEscandallo} />
              )}

              <div className="platos-escandallo-actions no-print">
                <button type="button" className="platos-btn platos-btn-secondary" onClick={closeEscandallo}>
                  Cerrar
                </button>
                <button type="button" className="platos-btn platos-btn-primary" onClick={exportEscandalloCsv}>
                  📥 Exportar CSV
                </button>
                <button type="button" className="platos-btn platos-btn-secondary" onClick={printEscandallo}>
                  🖨️ Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EscandalloIndividual({ dish, formatCurrency, computeEscandallo }) {
  const { lines, totalCost } = computeEscandallo(dish);
  const precio = parseFloat(dish.precio) || 0;
  const margen = precio > 0 ? (((precio - totalCost) / precio) * 100).toFixed(1) : '-';

  if (lines.length === 0) {
    return (
      <p className="platos-escandallo-empty">
        Este plato no tiene ingredientes definidos. Añade ingredientes para calcular el escandallo.
      </p>
    );
  }

  return (
    <div className="platos-escandallo-content">
      <table className="platos-escandallo-table">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Cantidad</th>
            <th>Unidad</th>
            <th>P. unit.</th>
            <th>Coste</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{l.productName}</td>
              <td>{l.quantity}</td>
              <td>{l.unit}</td>
              <td>{formatCurrency(l.unitCost)}</td>
              <td>{formatCurrency(l.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="platos-escandallo-total">
            <td colSpan={4}>Coste total</td>
            <td>{formatCurrency(totalCost)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="platos-escandallo-summary">
        <div className="platos-escandallo-row">
          <span>Precio venta</span>
          <span>{formatCurrency(precio)}</span>
        </div>
        <div className="platos-escandallo-row">
          <span>Coste ingredientes</span>
          <span>{formatCurrency(totalCost)}</span>
        </div>
        <div className="platos-escandallo-row platos-escandallo-margen">
          <span>Margen</span>
          <span>{margen === '-' ? '-' : `${margen} %`}</span>
        </div>
      </div>
    </div>
  );
}

function EscandalloFiltered({ dishes, formatCurrency, computeEscandallo }) {
  const rows = [];
  let granTotal = 0;

  dishes.forEach((d) => {
    const { lines, totalCost } = computeEscandallo(d);
    const precio = parseFloat(d.precio) || 0;
    const margen = precio > 0 ? (((precio - totalCost) / precio) * 100).toFixed(1) : '-';
    granTotal += totalCost;

    if (lines.length === 0) {
      rows.push({ type: 'empty', dish: d, totalCost: 0, precio, margen });
    } else {
      lines.forEach((l, i) => {
        rows.push({
          type: 'line',
          dish: d,
          line: l,
          isFirst: i === 0,
          isLast: i === lines.length - 1,
          totalCost,
          precio,
          margen,
        });
      });
    }
  });

  return (
    <div className="platos-escandallo-content">
      <table className="platos-escandallo-table platos-escandallo-table-filtered">
        <thead>
          <tr>
            <th>Plato</th>
            <th>Ingrediente</th>
            <th>Cantidad</th>
            <th>Unidad</th>
            <th>P. unit.</th>
            <th>Coste</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            if (r.type === 'empty') {
              return (
                <tr key={idx}>
                  <td>{r.dish.nombre}</td>
                  <td colSpan={5} className="platos-escandallo-empty-cell">
                    Sin ingredientes
                  </td>
                </tr>
              );
            }
            return (
              <tr key={idx}>
                <td>{r.isFirst ? r.dish.nombre : ''}</td>
                <td>{r.line.productName}</td>
                <td>{r.line.quantity}</td>
                <td>{r.line.unit}</td>
                <td>{formatCurrency(r.line.unitCost)}</td>
                <td>{formatCurrency(r.line.cost)}</td>
              </tr>
            );
          })}
        </tbody>
        {rows.some((r) => r.type === 'line') && (
          <tfoot>
            <tr className="platos-escandallo-total">
              <td colSpan={5}>Total coste (todos los platos)</td>
              <td>{formatCurrency(granTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default Platos;
