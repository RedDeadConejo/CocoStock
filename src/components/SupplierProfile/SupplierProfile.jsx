/**
 * Componente SupplierProfile
 * Modal que muestra el perfil de un proveedor y sus productos asociados
 */

import { useState, useEffect } from 'react';
import { getSupplierById, getSupplierProducts } from '../../services/suppliers';
import { formatCurrency } from '../../utils/formatters';
import './SupplierProfile.css';

function SupplierProfile({ supplierId, onClose }) {
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSupplierData = async () => {
      if (!supplierId) return;

      setLoading(true);
      setError('');

      try {
        // Cargar datos del proveedor y sus productos en paralelo
        const [supplierData, productsData] = await Promise.all([
          getSupplierById(supplierId),
          getSupplierProducts(supplierId),
        ]);

        setSupplier(supplierData);
        setProducts(productsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSupplierData();
  }, [supplierId]);


  if (!supplierId) {
    return null;
  }

  return (
    <div className="supplier-profile-overlay" onClick={onClose}>
      <div
        className="supplier-profile-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="supplier-profile-header">
          <h2 className="supplier-profile-title">Perfil del Proveedor</h2>
          <button className="supplier-profile-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="supplier-profile-loading">Cargando información...</div>
        ) : error ? (
          <div className="supplier-profile-error">
            <span className="supplier-profile-icon">⚠️</span>
            <span>{error}</span>
          </div>
        ) : supplier ? (
          <>
            {/* Información del Proveedor */}
            <div className="supplier-profile-info">
              <div className="supplier-profile-section">
                <h3 className="supplier-profile-section-title">Información General</h3>
                <div className="supplier-profile-details">
                  <div className="supplier-profile-detail-item">
                    <span className="supplier-profile-detail-label">Nombre:</span>
                    <span className="supplier-profile-detail-value">{supplier.nombre}</span>
                  </div>

                  {supplier.contacto && (
                    <div className="supplier-profile-detail-item">
                      <span className="supplier-profile-detail-label">Contacto:</span>
                      <span className="supplier-profile-detail-value">
                        {supplier.contacto}
                      </span>
                    </div>
                  )}

                  {supplier.telefono && (
                    <div className="supplier-profile-detail-item">
                      <span className="supplier-profile-detail-label">Teléfono:</span>
                      <span className="supplier-profile-detail-value">
                        <a
                          href={`tel:${supplier.telefono}`}
                          className="supplier-profile-link"
                        >
                          {supplier.telefono}
                        </a>
                      </span>
                    </div>
                  )}

                  {supplier.email && (
                    <div className="supplier-profile-detail-item">
                      <span className="supplier-profile-detail-label">Email:</span>
                      <span className="supplier-profile-detail-value">
                        <a
                          href={`mailto:${supplier.email}`}
                          className="supplier-profile-link"
                        >
                          {supplier.email}
                        </a>
                      </span>
                    </div>
                  )}

                  {supplier.direccion && (
                    <div className="supplier-profile-detail-item">
                      <span className="supplier-profile-detail-label">Dirección:</span>
                      <span className="supplier-profile-detail-value">
                        {supplier.direccion}
                      </span>
                    </div>
                  )}

                  {supplier.notas && (
                    <div className="supplier-profile-detail-item">
                      <span className="supplier-profile-detail-label">Notas:</span>
                      <span className="supplier-profile-detail-value supplier-profile-notes">
                        {supplier.notas}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Productos Asociados */}
              <div className="supplier-profile-section">
                <h3 className="supplier-profile-section-title">
                  Productos Asociados ({products.length})
                </h3>

                {products.length === 0 ? (
                  <div className="supplier-profile-empty">
                    <span className="supplier-profile-icon">📦</span>
                    <p>Este proveedor no tiene productos asociados</p>
                  </div>
                ) : (
                  <div className="supplier-profile-products">
                    {products.map((product) => (
                      <div key={product.id} className="supplier-profile-product-card">
                        <div className="supplier-profile-product-header">
                          <h4 className="supplier-profile-product-name">
                            {product.nombre}
                          </h4>
                          <span className="supplier-profile-product-price">
                            {formatCurrency(parseFloat(product.precio || 0))}
                          </span>
                        </div>

                        <div className="supplier-profile-product-details">
                          {product.referencia && (
                            <div className="supplier-profile-product-detail">
                              <span className="supplier-profile-product-label">Ref:</span>
                              <span>{product.referencia}</span>
                            </div>
                          )}

                          {product.formato && (
                            <div className="supplier-profile-product-detail">
                              <span className="supplier-profile-product-label">Formato:</span>
                              <span>{product.formato}</span>
                            </div>
                          )}

                          <div className="supplier-profile-product-detail">
                            <span className="supplier-profile-product-label">Stock:</span>
                            <span className="supplier-profile-product-stock">
                              {product.stock || '0'}
                            </span>
                          </div>

                          {product.nivel_reordenado && (
                            <div className="supplier-profile-product-detail">
                              <span className="supplier-profile-product-label">Nivel Reordenado:</span>
                              <span>{product.nivel_reordenado}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SupplierProfile;

