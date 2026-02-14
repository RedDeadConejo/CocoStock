/**
 * Componente ProductForm
 * Formulario para crear y editar productos
 */

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { createProduct, updateProduct, getProductById } from '../../services/products';
import { getSuppliers } from '../../services/suppliers';
import MultiSelect from '../MultiSelect/MultiSelect';
import './ProductForm.css';

// Título de sección
function SectionTitle({ title }) {
  return (
    <h3 className="product-form-section-title">{title}</h3>
  );
}

// Etiqueta de campo con icono de información individual (popup al pasar el ratón)
function LabelWithInfo({ htmlFor, children, info }) {
  const [showInfo, setShowInfo] = useState(false);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const hideTimerRef = useRef(null);

  const handleEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowInfo(true);
  };
  const handleLeave = () => {
    hideTimerRef.current = setTimeout(() => setShowInfo(false), 150);
  };

  useLayoutEffect(() => {
    if (!showInfo || !info || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPopupCoords({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, [showInfo, info]);

  return (
    <div className="product-form-label-wrap">
      <label htmlFor={htmlFor} className="product-form-label">{children}</label>
      {info && (
        <span className="product-form-field-info-wrap" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <button ref={buttonRef} type="button" className="product-form-info-btn" aria-label="Información sobre este campo">
            ℹ️
          </button>
          {showInfo && createPortal(
            <div
              className="product-form-info-popup product-form-field-popup product-form-field-popup-portal"
              role="tooltip"
              style={{
                top: popupCoords.top,
                left: popupCoords.left,
                transform: 'translate(-50%, calc(-100% - 6px))',
              }}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
            >
              {info}
            </div>,
            document.body
          )}
        </span>
      )}
    </div>
  );
}

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
  const [useDesglose, setUseDesglose] = useState(false);
  const [desgloseUnidades, setDesgloseUnidades] = useState('');
  const [desgloseContenido, setDesgloseContenido] = useState('');

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
        
        const cpf = product.cantidad_por_formato || '';
        const cpfNum = parseFloat(cpf);
        const hasSimpleDesglose = !isNaN(cpfNum) && cpfNum >= 1 && Number.isInteger(cpfNum);

        setFormData({
          nombre: product.nombre || '',
          precio: product.precio || '',
          formato: isCustomFormat ? 'otro' : productFormat,
          medida: isCustomMeasure ? 'otro' : productMeasure,
          precio_por_formato: product.precio_por_formato || '',
          iva: product.iva || '',
          referencia: product.referencia || '',
          nivel_reordenado: product.nivel_reordenado || '',
          cantidad_por_formato: cpf,
          stock: product.stock || '0',
        });
        setCustomFormat(isCustomFormat);
        setCustomFormatValue(isCustomFormat ? productFormat : '');
        setCustomMeasure(isCustomMeasure);
        setCustomMeasureValue(isCustomMeasure ? productMeasure : '');
        if (hasSimpleDesglose) {
          setDesgloseUnidades(String(cpfNum));
          setDesgloseContenido('1');
        }
      }
    };
    loadProductData();
  }, [product]);

  /**
   * Sincroniza desglose → cantidad_por_formato cuando está activo
   */
  useEffect(() => {
    if (!useDesglose) return;
    const u = parseFloat(desgloseUnidades);
    const c = parseFloat(desgloseContenido);
    if (!isNaN(u) && !isNaN(c) && u > 0 && c > 0) {
      setFormData((prev) => ({ ...prev, cantidad_por_formato: String(u * c) }));
    }
  }, [useDesglose, desgloseUnidades, desgloseContenido]);

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
          {/* Información general */}
          <div className="product-form-section">
            <SectionTitle title="Información general" />
            <div className="product-form-row">
              <div className="product-form-group">
                <LabelWithInfo htmlFor="nombre" info="Nombre comercial del producto. Ej: Arroz integral, Salsa de soja, Noodles.">
                  Nombre *
                </LabelWithInfo>
                <input id="nombre" name="nombre" type="text" className="product-form-input" value={formData.nombre} onChange={handleChange} required disabled={loading} placeholder="Ej: Arroz integral" />
              </div>
              <div className="product-form-group">
                <LabelWithInfo htmlFor="referencia" info="Código o referencia interna para identificar el producto. Ej: ARR-001.">
                  Referencia
                </LabelWithInfo>
                <input id="referencia" name="referencia" type="text" className="product-form-input" value={formData.referencia} onChange={handleChange} disabled={loading} placeholder="ARR-001" />
              </div>
            </div>
            <div className="product-form-row">
              <div className="product-form-group product-form-group-full">
                <LabelWithInfo htmlFor="product-form-suppliers" info="Proveedores que suministran este producto. Permite saber dónde comprar y consultar precios.">
                  Proveedores
                </LabelWithInfo>
                <MultiSelect options={suppliers.map(s => ({ value: s.id, label: s.nombre }))} selected={selectedSupplierIds} onChange={setSelectedSupplierIds} placeholder="Proveedores..." label="" disabled={loading || loadingSuppliers} />
              </div>
            </div>
          </div>

          {/* Presentación y unidad */}
          <div className="product-form-section">
            <SectionTitle title="Presentación y unidad" />
            <div className="product-form-row">
              <div className="product-form-group">
                <LabelWithInfo htmlFor="formato" info="En qué unidad compras el producto. Ej: caja, kg, botella, bolsa, paquete.">
                  Unidad de compra
                </LabelWithInfo>
                {!customFormat ? (
                  <select id="formato" name="formato" className="product-form-input product-form-select" value={formData.formato} onChange={handleChange} disabled={loading}>
                    {formatOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input id="formato-custom" type="text" className="product-form-input" value={customFormatValue} onChange={handleCustomFormatChange} placeholder="Ej: bandeja" disabled={loading} />
                )}
              </div>
              <div className="product-form-group">
                <LabelWithInfo htmlFor="medida" info="Unidad en que se mide el contenido para recetas y escandallos. Ej: L, g, ml, paquetes, unidades.">
                  Unidad del contenido
                </LabelWithInfo>
                {!customMeasure ? (
                  <select id="medida" name="medida" className="product-form-input product-form-select" value={formData.medida} onChange={handleChange} disabled={loading}>
                    {formatOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input id="medida-custom" type="text" className="product-form-input" value={customMeasureValue} onChange={handleCustomMeasureChange} placeholder="Ej: L, g" disabled={loading} />
                )}
              </div>
            </div>
            <div className="product-form-row product-form-row-compact">
              <div className="product-form-radio-group product-form-radio-inline">
                <label className="product-form-radio-label">
                  <input type="radio" name="modo_contenido" checked={!useDesglose} onChange={() => setUseDesglose(false)} disabled={loading} />
                  <span>Total directo</span>
                </label>
                <label className="product-form-radio-label">
                  <input type="radio" name="modo_contenido" checked={useDesglose} onChange={() => setUseDesglose(true)} disabled={loading} />
                  <span>Desglose (4 × 1 L)</span>
                </label>
              </div>
              {!useDesglose ? (
                <div className="product-form-group product-form-group-inline">
                  <LabelWithInfo htmlFor="cantidad_por_formato" info="Cuántas unidades de contenido (L, g, paquetes…) vienen en cada unidad que compras. Ej: caja de 10 paquetes de noodles → 10. Caja de 4 L → 4.">
                    Contenido por unidad de compra
                  </LabelWithInfo>
                  <input id="cantidad_por_formato" name="cantidad_por_formato" type="number" step="0.001" min="0" className="product-form-input" value={formData.cantidad_por_formato} onChange={handleChange} disabled={loading} placeholder="4" />
                </div>
              ) : (
                <div className="product-form-group product-form-desglose-inline">
                  <LabelWithInfo htmlFor="desglose-unidades" info="Unidades × contenido por unidad. Ej: 4 paquetes × 1 L = 4 L total por unidad de compra.">
                    Desglose
                  </LabelWithInfo>
                  <div className="product-form-desglose product-form-desglose-inline">
                    <input id="desglose-unidades" type="number" step="1" min="0" className="product-form-input product-form-input-sm" value={desgloseUnidades} onChange={(e) => setDesgloseUnidades(e.target.value)} disabled={loading} placeholder="4" />
                    <span>×</span>
                    <input type="number" step="0.001" min="0" className="product-form-input product-form-input-sm" value={desgloseContenido} onChange={(e) => setDesgloseContenido(e.target.value)} disabled={loading} placeholder="1" />
                    <span className="product-form-desglose-eq">= {formData.cantidad_por_formato || '0'} {formData.medida || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Precios e inventario */}
          <div className="product-form-section product-form-section-grid">
            <div className="product-form-section-block">
              <SectionTitle title="Precios" />
              <div className="product-form-row">
                <div className="product-form-group">
                  <LabelWithInfo htmlFor="precio_por_formato" info="Lo que pagas por cada unidad de compra (caja, kg, botella…). Se usa para calcular el coste unitario en escandallos: Precio ÷ Contenido por unidad de compra.">
                    Precio/unidad compra *
                  </LabelWithInfo>
                  <input id="precio_por_formato" name="precio_por_formato" type="number" step="0.01" min="0" className="product-form-input" value={formData.precio_por_formato} onChange={handleChange} disabled={loading} placeholder="10" />
                </div>
                <div className="product-form-group">
                  <LabelWithInfo htmlFor="iva" info="Porcentaje de IVA aplicable. Se usa para facturación y cálculos con impuestos.">
                    IVA (%)
                  </LabelWithInfo>
                  <input id="iva" name="iva" type="number" step="0.01" min="0" max="100" className="product-form-input" value={formData.iva} onChange={handleChange} disabled={loading} placeholder="21" />
                </div>
              </div>
            </div>
            <div className="product-form-section-block">
              <SectionTitle title="Inventario" />
              <div className="product-form-row">
                <div className="product-form-group">
                  <LabelWithInfo htmlFor="nivel_reordenado" info="Cantidad mínima antes de que se active un aviso de reorden. Ej: si pones 5, te avisará cuando queden 5 o menos unidades.">
                    Stock mínimo
                  </LabelWithInfo>
                  <input id="nivel_reordenado" name="nivel_reordenado" type="number" min="0" className="product-form-input" value={formData.nivel_reordenado} onChange={handleChange} disabled={loading} placeholder="5" />
                </div>
                {isCreating && (
                  <div className="product-form-group">
                    <LabelWithInfo htmlFor="stock" info="Cantidad actual en almacén al dar de alta el producto. Después se actualiza con entradas y salidas.">
                      Stock inicial *
                    </LabelWithInfo>
                    <input id="stock" name="stock" type="number" min="0" className="product-form-input" value={formData.stock} onChange={handleChange} required disabled={loading} placeholder="0" />
                  </div>
                )}
              </div>
            </div>
          </div>

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

