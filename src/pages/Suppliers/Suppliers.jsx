/**
 * Página Suppliers
 * Gestión de proveedores
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { getSuppliers, deleteSupplier } from '../../services/suppliers';
import { supabase } from '../../services/supabase';
import SupplierForm from '../../components/SupplierForm/SupplierForm';
import SupplierProfile from '../../components/SupplierProfile/SupplierProfile';
import './Suppliers.css';

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshIntervalRef = useRef(null);
  const channelRef = useRef(null);

  // Estado de filtros
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Carga los proveedores desde Supabase
   * @param {boolean} silent - Si es true, no muestra el loading
   */
  const loadSuppliers = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError('');
      const data = await getSuppliers();
      setSuppliers(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Carga inicial
    loadSuppliers();

    // Configurar Supabase Realtime para escuchar cambios
    const channel = supabase
      .channel('suppliers-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Escucha INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'suppliers',
          filter: 'eliminado=eq.false', // Solo proveedores activos
        },
        (payload) => {
          console.log('Cambio detectado en proveedores:', payload);
          // Recargar proveedores cuando hay cambios
          loadSuppliers(true); // Recarga silenciosa
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Polling periódico como respaldo (cada 30 segundos)
    refreshIntervalRef.current = setInterval(() => {
      loadSuppliers(true); // Recarga silenciosa
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
   * Maneja la eliminación de un proveedor (soft delete)
   */
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
      return;
    }

    try {
      await deleteSupplier(id);
      await loadSuppliers(); // Recargar la lista
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * Abre el formulario para editar un proveedor
   */
  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  /**
   * Cierra el formulario y recarga los proveedores
   */
  const handleFormClose = () => {
    setShowForm(false);
    setEditingSupplier(null);
    loadSuppliers();
  };

  /**
   * Abre el formulario para crear un nuevo proveedor
   */
  const handleCreate = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  /**
   * Filtra los proveedores según el término de búsqueda
   */
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;

    const search = searchTerm.toLowerCase();
    return suppliers.filter(
      (supplier) =>
        supplier.nombre?.toLowerCase().includes(search) ||
        supplier.contacto?.toLowerCase().includes(search) ||
        supplier.email?.toLowerCase().includes(search) ||
        supplier.telefono?.toLowerCase().includes(search)
    );
  }, [suppliers, searchTerm]);

  /**
   * Limpia el filtro de búsqueda
   */
  const clearFilter = () => {
    setSearchTerm('');
  };

  return (
    <div className="suppliers">
      <div className="suppliers-header">
        <div>
          <h1 className="suppliers-title">🏢 Proveedores</h1>
          <div className="suppliers-header-info">
            <p className="suppliers-subtitle">Gestiona tus proveedores</p>
            {lastUpdate && (
              <p className="suppliers-last-update">
                {isRefreshing ? (
                  <span className="suppliers-refreshing">🔄 Actualizando...</span>
                ) : (
                  <span>
                    Última actualización: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="suppliers-header-actions">
          <button
            className="suppliers-button-refresh"
            onClick={() => loadSuppliers(false)}
            title="Actualizar proveedores"
            disabled={loading || isRefreshing}
          >
            <span className="suppliers-icon">🔄</span>
            Actualizar
          </button>
          <button className="suppliers-button-create" onClick={handleCreate}>
            <span className="suppliers-icon">➕</span>
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {error && (
        <div className="suppliers-error">
          <span className="suppliers-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="suppliers-filters">
        <div className="suppliers-filters-row">
          <div className="suppliers-filter-group">
            <label htmlFor="search" className="suppliers-filter-label">
              🔍 Búsqueda
            </label>
            <input
              id="search"
              type="text"
              className="suppliers-filter-input"
              placeholder="Buscar por nombre, contacto, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {searchTerm && (
            <button
              className="suppliers-filter-clear"
              onClick={clearFilter}
              title="Limpiar búsqueda"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {searchTerm && (
          <div className="suppliers-filters-info">
            Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores
          </div>
        )}
      </div>

      {loading ? (
        <div className="suppliers-loading">Cargando proveedores...</div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="suppliers-empty">
          <span className="suppliers-icon">🏢</span>
          <p>
            {searchTerm
              ? 'No se encontraron proveedores con la búsqueda aplicada'
              : 'No hay proveedores registrados'}
          </p>
          {searchTerm && (
            <button className="suppliers-button-create" onClick={clearFilter}>
              Limpiar búsqueda
            </button>
          )}
          {!searchTerm && (
            <button className="suppliers-button-create" onClick={handleCreate}>
              Crear primer proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="suppliers-cards-grid">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="suppliers-card suppliers-card-clickable"
              onClick={() => setSelectedSupplierId(supplier.id)}
            >
              <div className="suppliers-card-header">
                <h3 className="suppliers-card-title">{supplier.nombre}</h3>
              </div>

              <div className="suppliers-card-body">
                <div className="suppliers-card-info">
                  {supplier.contacto && (
                    <div className="suppliers-card-item">
                      <span className="suppliers-card-label">Contacto:</span>
                      <span className="suppliers-card-value">
                        {supplier.contacto}
                      </span>
                    </div>
                  )}

                  {supplier.telefono && (
                    <div className="suppliers-card-item">
                      <span className="suppliers-card-label">Teléfono:</span>
                      <span className="suppliers-card-value">
                        <a href={`tel:${supplier.telefono}`} className="suppliers-card-link">
                          {supplier.telefono}
                        </a>
                      </span>
                    </div>
                  )}

                  {supplier.email && (
                    <div className="suppliers-card-item">
                      <span className="suppliers-card-label">Email:</span>
                      <span className="suppliers-card-value">
                        <a href={`mailto:${supplier.email}`} className="suppliers-card-link">
                          {supplier.email}
                        </a>
                      </span>
                    </div>
                  )}

                  {supplier.direccion && (
                    <div className="suppliers-card-item">
                      <span className="suppliers-card-label">Dirección:</span>
                      <span className="suppliers-card-value">
                        {supplier.direccion}
                      </span>
                    </div>
                  )}

                  {supplier.notas && (
                    <div className="suppliers-card-item">
                      <span className="suppliers-card-label">Notas:</span>
                      <span className="suppliers-card-value suppliers-card-notes">
                        {supplier.notas}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="suppliers-card-actions">
                <button
                  className="suppliers-card-button suppliers-card-button-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(supplier);
                  }}
                  title="Editar"
                >
                  ✏️ Editar
                </button>
                <button
                  className="suppliers-card-button suppliers-card-button-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(supplier.id);
                  }}
                  title="Eliminar"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SupplierForm
          supplier={editingSupplier}
          onClose={handleFormClose}
          onSave={handleFormClose}
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

export default Suppliers;

