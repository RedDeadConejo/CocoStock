/**
 * Componente ProductForm
 * Formulario para crear y editar productos
 */

import { useState, useEffect } from 'react';
import { createProduct, updateProduct, getProductById } from '../../services/products';
import { getSuppliers } from '../../services/suppliers';
import MultiSelect from '../MultiSelect/MultiSelect';
import './ProductForm.css';

// Opciones comunes de formato
const formatOptions = [
  { value: '', label: 'Seleccionar formato...' },
  { value: 'kg', label: 'kg (Kilogramos)' },
  { value: 'g', label: 'g (Gramos)' },
  { value: 'L', label: 'L (Litros)' },
  { value: 'ml', label: 'ml (Mililitros)' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'botella', label: 'Botella' },
  { value: 'lata', label: 'Lata' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'otro', label: 'Otro (personalizado)' },
];

function ProductForm({ product, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [formData, setFormData] = useState({
    nombre: '',
    precio: '',
    formato: '',
    medida: '',
    precio_por_formato: '',
    iva: '',
    referencia: '',
    nivel_reordenado: '',
    cantidad_por_formato: '',
    stock: '',
  });
  const [customFormat, setCustomFormat] = useState(false);
  const [customFormatValue, setCustomFormatValue] = useState('');
  const [customMeasure, setCustomMeasure] = useState(false);
  const [customMeasureValue, setCustomMeasureValue] = useState('');

  const isEditing = !!product;
  const isCreating = !isEditing;

  /**
   * Carga los proveedores disponibles
   */
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        setLoadingSuppliers(true);
        const data = await getSuppliers();
        setSuppliers(data);
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, []);

  /**
   * Inicializa el formulario con los datos del producto si está editando
   */
  useEffect(() => {
    const loadProductData = async () => {
      if (product) {
        // Si el producto ya tiene suppliers cargados, usarlos
        if (product.suppliers && Array.isArray(product.suppliers)) {
          setSelectedSupplierIds(product.suppliers.map(s => s.id));
        } else {
          // Si no, cargar el producto completo con proveedores
          try {
            const fullProduct = await getProductById(product.id);
            if (fullProduct.suppliers) {
              setSelectedSupplierIds(fullProduct.suppliers.map(s => s.id));
            }
          } catch (err) {
            console.error('Error al cargar proveedores del producto:', err);
          }
        }

        const productFormat = product.formato || '';
        const isCustomFormat = productFormat && !formatOptions.some(opt => opt.value === productFormat && opt.value !== '');
        const productMeasure = product.medida || '';
        const isCustomMeasure = productMeasure && !formatOptions.some(opt => opt.value === productMeasure && opt.value !== '');
        
        setFormData({
          nombre: product.nombre || '',
          precio: product.precio || '',
          formato: isCustomFormat ? 'otro' : productFormat,
          medida: isCustomMeasure ? 'otro' : productMeasure,
          precio_por_formato: product.precio_por_formato || '',
          iva: product.iva || '',
          referencia: product.referencia || '',
          nivel_reordenado: product.nivel_reordenado || '',
          cantidad_por_formato: product.cantidad_por_formato || '',
          stock: product.stock || '0',
        });
        setCustomFormat(isCustomFormat);
        setCustomFormatValue(isCustomFormat ? productFormat : '');
        setCustomMeasure(isCustomMeasure);
        setCustomMeasureValue(isCustomMeasure ? productMeasure : '');
      }
    };
    loadProductData();
  }, [product]);

  /**
   * Maneja el cambio en los campos del formulario
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el formato, verificar si es "otro"
    if (name === 'formato') {
      const isOther = value === 'otro';
      setCustomFormat(isOther);
      if (!isOther) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
        return;
      }
    }
    
    // Si cambia la medida, verificar si es "otro"
    if (name === 'medida') {
      const isOther = value === 'otro';
      setCustomMeasure(isOther);
      if (!isOther) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
        return;
      }
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Maneja el cambio del formato personalizado
   */
  const handleCustomFormatChange = (e) => {
    const value = e.target.value;
    setCustomFormatValue(value);
    setFormData((prev) => ({
      ...prev,
      formato: value,
    }));
  };

  /**
   * Maneja el cambio de la medida personalizada
   */
  const handleCustomMeasureChange = (e) => {
    const value = e.target.value;
    setCustomMeasureValue(value);
    setFormData((prev) => ({
      ...prev,
      medida: value,
    }));
  };

  /**
   * Maneja el envío del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Si el formato es "otro", usar el valor personalizado
      const finalFormat = formData.formato === 'otro' ? customFormatValue : formData.formato;
      // Si la medida es "otro", usar el valor personalizado
      const finalMeasure = formData.medida === 'otro' ? customMeasureValue : formData.medida;
      
      const productData = {
        ...formData,
        formato: finalFormat,
        medida: finalMeasure,
        supplierIds: selectedSupplierIds,
      };

      if (isEditing) {
        await updateProduct(product.id, productData);
      } else {
        await createProduct(productData);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-form-overlay" onClick={onClose}>
      <div className="product-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="product-form-header">
          <h2 className="product-form-title">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button className="product-form-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="product-form-error">
            <span className="product-form-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="product-form-row">
            <div className="product-form-group product-form-group-large">
              <label htmlFor="nombre" className="product-form-label">
                Nombre *
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                className="product-form-input"
                value={formData.nombre}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="product-form-group product-form-group-small">
              <label htmlFor="referencia" className="product-form-label">
                Referencia
              </label>
              <input
                id="referencia"
                name="referencia"
                type="text"
                className="product-form-input"
                value={formData.referencia}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="product-form-row">
            <div className="product-form-group">
              <label htmlFor="precio" className="product-form-label">
                Precio *
              </label>
              <input
                id="precio"
                name="precio"
                type="number"
                step="0.0000001"
                min="-1"
                className="product-form-input"
                value={formData.precio}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="product-form-group">
              <label htmlFor="formato" className="product-form-label">
                Formato
              </label>
              {!customFormat ? (
                <select
                  id="formato"
                  name="formato"
                  className="product-form-input product-form-select"
                  value={formData.formato}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {formatOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="formato-custom"
                  name="formato-custom"
                  type="text"
                  className="product-form-input"
                  value={customFormatValue}
                  onChange={handleCustomFormatChange}
                  placeholder="Escribe el formato personalizado..."
                  disabled={loading}
                />
              )}
            </div>
          </div>

          <div className="product-form-row">
            <div className="product-form-group">
              <label htmlFor="medida" className="product-form-label">
                Medida
              </label>
              {!customMeasure ? (
                <select
                  id="medida"
                  name="medida"
                  className="product-form-input product-form-select"
                  value={formData.medida}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {formatOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="medida-custom"
                  name="medida-custom"
                  type="text"
                  className="product-form-input"
                  value={customMeasureValue}
                  onChange={handleCustomMeasureChange}
                  placeholder="Escribe la medida personalizada..."
                  disabled={loading}
                />
              )}
            </div>

            <div className="product-form-group">
              <MultiSelect
                options={suppliers.map(s => ({
                  value: s.id,
                  label: s.nombre,
                }))}
                selected={selectedSupplierIds}
                onChange={setSelectedSupplierIds}
                placeholder="Selecciona proveedores..."
                label="Proveedores"
                disabled={loading || loadingSuppliers}
              />
            </div>
          </div>

          <div className="product-form-row">
            <div className="product-form-group">
              <label htmlFor="precio_por_formato" className="product-form-label">
                Precio por Formato
              </label>
              <input
                id="precio_por_formato"
                name="precio_por_formato"
                type="number"
                step="0.01"
                min="0"
                className="product-form-input"
                value={formData.precio_por_formato}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="product-form-group">
              <label htmlFor="iva" className="product-form-label">
                IVA (%)
              </label>
              <input
                id="iva"
                name="iva"
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="product-form-input"
                value={formData.iva}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="product-form-row">
            <div className="product-form-group">
              <label htmlFor="nivel_reordenado" className="product-form-label">
                Nivel de Reordenado
              </label>
              <input
                id="nivel_reordenado"
                name="nivel_reordenado"
                type="number"
                min="0"
                className="product-form-input"
                value={formData.nivel_reordenado}
                onChange={handleChange}
                disabled={loading}
                placeholder="Cantidad mínima antes de reordenar"
              />
            </div>

            <div className="product-form-group">
              <label htmlFor="cantidad_por_formato" className="product-form-label">
                Cantidad por Formato
              </label>
              <input
                id="cantidad_por_formato"
                name="cantidad_por_formato"
                type="number"
                step="0.001"
                min="0"
                className="product-form-input"
                value={formData.cantidad_por_formato}
                onChange={handleChange}
                disabled={loading}
                placeholder="Ej: 12 (si el formato es caja de 12)"
              />
            </div>
          </div>

          {isCreating && (
            <div className="product-form-row">
              <div className="product-form-group">
                <label htmlFor="stock" className="product-form-label">
                  Stock Inicial (Cantidad en Inventario) *
                </label>
                <input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  className="product-form-input"
                  value={formData.stock}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Cantidad inicial en inventario"
                />
              </div>
            </div>
          )}

          <div className="product-form-actions">
            <button
              type="button"
              className="product-form-button-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="product-form-button-save"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="product-form-spinner"></span>
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Actualizar' : 'Crear'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductForm;

