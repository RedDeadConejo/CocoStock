/**
 * Página Inventory
 * Gestión de inventario de productos
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { getProducts, deleteProduct } from '../../services/products';
import { getSuppliers } from '../../services/suppliers';
import { supabase } from '../../services/supabase';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';
import { formatCurrency } from '../../utils/formatters';
import ProductForm from '../../components/ProductForm/ProductForm';
import StockManager from '../../components/StockManager/StockManager';
import SupplierProfile from '../../components/SupplierProfile/SupplierProfile';
import './Inventory.css';

function Inventory() {
  // Obtener el usuario actual y su cargo
  const [currentUser, setCurrentUser] = useState(null);
  const { roleName, isAdmin, isAlmacen, loading: roleLoading } = useRole(currentUser?.id);
  
  // Verificar permisos
  const canEdit = isAdmin || isAlmacen;
  const canManageStock = isAdmin || isAlmacen;
  
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);
  const [products, setProducts] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showStockManager, setShowStockManager] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshIntervalRef = useRef(null);
  const channelRef = useRef(null);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'warning', 'normal'
  const [supplierFilter, setSupplierFilter] = useState('all'); // 'all' o ID del proveedor

  // Leer filtro desde sessionStorage al montar y establecerlo
  useEffect(() => {
    const savedFilter = sessionStorage.getItem('inventoryStockFilter');
    if (savedFilter) {
      setStockFilter(savedFilter);
      sessionStorage.removeItem('inventoryStockFilter');
    }
  }, []);

  /**
   * Carga los productos desde Supabase
   * @param {boolean} silent - Si es true, no muestra el loading
   */
  const loadProducts = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError('');
      const data = await getProducts();
      setProducts(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Carga inicial de productos
    loadProducts();

    // Cargar proveedores para el filtro
    const loadSuppliers = async () => {
      try {
        const data = await getSuppliers();
        setAllSuppliers(data);
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
      }
    };
    loadSuppliers();

    // Configurar Supabase Realtime para escuchar cambios
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Escucha INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'products',
          filter: 'eliminado=eq.false', // Solo productos activos
        },
        (payload) => {
          console.log('Cambio detectado en productos:', payload);
          // Recargar productos cuando hay cambios
          loadProducts(true); // Recarga silenciosa
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Polling periódico como respaldo (cada 30 segundos)
    refreshIntervalRef.current = setInterval(() => {
      loadProducts(true); // Recarga silenciosa
    }, 30000); // 30 segundos

    // Limpieza al desmontar
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);


  /**
   * Maneja la eliminación de un producto (soft delete)
   */
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      return;
    }

    try {
      await deleteProduct(id);
      await loadProducts(); // Recargar la lista
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * Abre el formulario para editar un producto
   */
  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  /**
   * Cierra el formulario y recarga los productos
   */
  const handleFormClose = () => {
    setShowForm(false);
    setEditingProduct(null);
    loadProducts();
  };

  /**
   * Abre el formulario para crear un nuevo producto
   */
  const handleCreate = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  /**
   * Determina el estado del stock basado en el stock actual y nivel de reordenado
   * @param {string} stock - Cantidad actual en inventario
   * @param {string} nivelReordenado - Nivel de reordenado
   * @returns {string} - 'low', 'warning', o 'normal'
   */
  const getStockStatus = (stock, nivelReordenado) => {
    const stockNum = parseFloat(stock || 0);
    const nivelNum = parseFloat(nivelReordenado || 0);

    if (nivelNum === 0) return 'normal'; // Si no hay nivel definido, considerar normal

    // Rojo: stock está por debajo del nivel de reordenado
    if (stockNum <= nivelNum) {
      return 'low';
    }

    // Amarillo: stock está cerca del nivel (entre nivel y 1.5x nivel)
    if (stockNum > nivelNum && stockNum < nivelNum * 1.5) {
      return 'warning';
    }

    // Normal: stock está bien por encima del nivel
    return 'normal';
  };

  /**
   * Obtiene el texto del estado del stock
   */
  const getStockStatusText = (status) => {
    switch (status) {
      case 'low':
        return 'Stock Bajo';
      case 'warning':
        return 'Stock Bajo';
      default:
        return 'Stock Normal';
    }
  };

  /**
   * Filtra los productos según los criterios seleccionados
   */
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Filtro de búsqueda (nombre o referencia)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          product.nombre?.toLowerCase().includes(search) ||
          product.referencia?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Filtro por estado de stock
      if (stockFilter !== 'all') {
        const status = getStockStatus(product.stock, product.nivel_reordenado);
        if (status !== stockFilter) return false;
      }

      // Filtro por proveedor
      if (supplierFilter !== 'all') {
        const hasSupplier = product.suppliers?.some(
          (s) => s.id === supplierFilter
        );
        if (!hasSupplier) return false;
      }

      return true;
    });
  }, [products, searchTerm, stockFilter, supplierFilter]);

  /**
   * Limpia todos los filtros
   */
  const clearFilters = () => {
    setSearchTerm('');
    setStockFilter('all');
    setSupplierFilter('all');
  };

  const hasActiveFilters = searchTerm || stockFilter !== 'all' || supplierFilter !== 'all';

  return (
    <div className="inventory">
      <div className="inventory-header">
        <div>
          <h1 className="inventory-title">📦 Inventario</h1>
          <div className="inventory-header-info">
            <p className="inventory-subtitle">Gestiona tus productos</p>
            {lastUpdate && (
              <p className="inventory-last-update">
                {isRefreshing ? (
                  <span className="inventory-refreshing">🔄 Actualizando...</span>
                ) : (
                  <span>
                    Última actualización: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="inventory-header-actions">
          <button
            className="inventory-button-refresh"
            onClick={() => loadProducts(false)}
            title="Actualizar inventario"
            disabled={loading || isRefreshing}
          >
            <span className="inventory-icon">🔄</span>
            Actualizar
          </button>
          {canManageStock && (
            <button
              className="inventory-button-stock"
              onClick={() => {
                if (products.length === 0) {
                  setError('No hay productos disponibles para gestionar stock');
                  return;
                }
                setShowStockManager(true);
              }}
              title="Gestionar stock"
              disabled={loading}
            >
              <span className="inventory-icon">📊</span>
              Gestionar Stock
            </button>
          )}
          {canEdit && (
            <button className="inventory-button-create" onClick={handleCreate}>
              <span className="inventory-icon">➕</span>
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="inventory-error">
          <span className="inventory-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="inventory-filters">
        <div className="inventory-filters-row">
          <div className="inventory-filter-group">
            <label htmlFor="search" className="inventory-filter-label">
              🔍 Búsqueda
            </label>
            <input
              id="search"
              type="text"
              className="inventory-filter-input"
              placeholder="Buscar por nombre o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="inventory-filter-group">
            <label htmlFor="stock-filter" className="inventory-filter-label">
              📊 Estado de Stock
            </label>
            <select
              id="stock-filter"
              className="inventory-filter-select"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="low">Stock Bajo</option>
              <option value="warning">Stock Advertencia</option>
              <option value="normal">Stock Normal</option>
            </select>
          </div>

          <div className="inventory-filter-group">
            <label htmlFor="supplier-filter" className="inventory-filter-label">
              🏢 Proveedor
            </label>
            <select
              id="supplier-filter"
              className="inventory-filter-select"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="all">Todos los proveedores</option>
              {allSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.nombre}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              className="inventory-filter-clear"
              onClick={clearFilters}
              title="Limpiar filtros"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="inventory-filters-info">
            Mostrando {filteredProducts.length} de {products.length} productos
          </div>
        )}
      </div>

      {loading ? (
        <div className="inventory-loading">Cargando productos...</div>
      ) : products.length === 0 ? (
        <div className="inventory-empty">
          <span className="inventory-icon">📦</span>
          <p>No hay productos en el inventario</p>
          <button className="inventory-button-create" onClick={handleCreate}>
            Crear primer producto
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="inventory-empty">
          <span className="inventory-icon">📦</span>
          <p>
            {hasActiveFilters
              ? 'No se encontraron productos con los filtros aplicados'
              : 'No hay productos en el inventario'}
          </p>
          {hasActiveFilters && (
            <button className="inventory-button-create" onClick={clearFilters}>
              Limpiar filtros
            </button>
          )}
          {!hasActiveFilters && (
            <button className="inventory-button-create" onClick={handleCreate}>
              Crear primer producto
            </button>
          )}
        </div>
      ) : (
        <div className="inventory-cards-grid">
          {filteredProducts.map((product) => {
            const stockStatus = getStockStatus(
              product.stock,
              product.nivel_reordenado
            );
            return (
              <div
                key={product.id}
                className={`inventory-card inventory-card-${stockStatus}`}
              >
                <div className="inventory-card-header">
                  <h3 className="inventory-card-title">{product.nombre}</h3>
                  <span className={`inventory-card-status inventory-card-status-${stockStatus}`}>
                    {getStockStatusText(stockStatus)}
                  </span>
                </div>

                <div className="inventory-card-body">
                  <div className="inventory-card-info">
                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Referencia:</span>
                      <span className="inventory-card-value">
                        {product.referencia || 'N/A'}
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Formato:</span>
                      <span className="inventory-card-value">
                        {product.cantidad_por_formato + ' ' + product.formato || 'N/A'}
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Precio/{product.formato || 'Unitario'}:</span>
                      <span className="inventory-card-value">
                        {formatCurrency(parseFloat(product.precio || 0))}
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Precio/Formato:</span>
                      <span className="inventory-card-value">
                        {formatCurrency(parseFloat(product.precio_por_formato || 0))}
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">IVA:</span>
                      <span className="inventory-card-value">
                        {parseFloat(product.iva || 0).toFixed(2)}%
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Stock (Inventario):</span>
                      <span className="inventory-card-value inventory-card-quantity">
                        {product.stock || '0'}
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Cantidad por Formato:</span>
                      <span className="inventory-card-value">
                        {product.cantidad_por_formato || 'N/A'}
                      </span>
                    </div>

                    <div className="inventory-card-item">
                      <span className="inventory-card-label">Nivel Reordenado:</span>
                      <span className="inventory-card-value">
                        {product.nivel_reordenado || 'N/A'}
                      </span>
                    </div>

                    {product.suppliers && product.suppliers.length > 0 && (
                      <div className="inventory-card-item">
                        <span className="inventory-card-label">Proveedores:</span>
                        <div className="inventory-card-suppliers">
                          {product.suppliers.map((supplier, index) => (
                            <button
                              key={supplier.id}
                              type="button"
                              className="inventory-card-supplier-tag inventory-card-supplier-tag-clickable"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSupplierId(supplier.id);
                              }}
                              title={`Ver perfil de ${supplier.nombre}`}
                            >
                              {supplier.nombre}
                              {index < product.suppliers.length - 1 && ', '}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="inventory-card-actions">
                    <button
                      className="inventory-card-button inventory-card-button-edit"
                      onClick={() => handleEdit(product)}
                      title="Editar"
                    >
                      ✏️ Editar
                    </button>
                    {isAdmin && (
                      <button
                        className="inventory-card-button inventory-card-button-delete"
                        onClick={() => handleDelete(product.id)}
                        title="Eliminar"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
          onSave={handleFormClose}
        />
      )}

      {showStockManager && (
        <StockManager
          products={products}
          onClose={() => setShowStockManager(false)}
          onSave={() => {
            loadProducts();
            setShowStockManager(false);
          }}
        />
      )}

      {selectedSupplierId && (
        <SupplierProfile
          supplierId={selectedSupplierId}
          onClose={() => setSelectedSupplierId(null)}
        />
      )}
    </div>
  );
}

export default Inventory;

