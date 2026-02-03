/**
 * Componente SupplierForm
 * Formulario para crear y editar proveedores
 */

import { useState, useEffect } from 'react';
import { createSupplier, updateSupplier } from '../../services/suppliers';
import './SupplierForm.css';

function SupplierForm({ supplier, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: '',
  });

  const isEditing = !!supplier;

  /**
   * Inicializa el formulario con los datos del proveedor si está editando
   */
  useEffect(() => {
    if (supplier) {
      setFormData({
        nombre: supplier.nombre || '',
        contacto: supplier.contacto || '',
        telefono: supplier.telefono || '',
        email: supplier.email || '',
        direccion: supplier.direccion || '',
        notas: supplier.notas || '',
      });
    }
  }, [supplier]);

  /**
   * Maneja el cambio en los campos del formulario
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
      if (isEditing) {
        await updateSupplier(supplier.id, formData);
      } else {
        await createSupplier(formData);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="supplier-form-overlay" onClick={onClose}>
      <div className="supplier-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="supplier-form-header">
          <h2 className="supplier-form-title">
            {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h2>
          <button className="supplier-form-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="supplier-form-error">
            <span className="supplier-form-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="supplier-form" onSubmit={handleSubmit}>
          <div className="supplier-form-group">
            <label htmlFor="nombre" className="supplier-form-label">
              Nombre *
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              className="supplier-form-input"
              value={formData.nombre}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="supplier-form-group">
            <label htmlFor="contacto" className="supplier-form-label">
              Contacto
            </label>
            <input
              id="contacto"
              name="contacto"
              type="text"
              className="supplier-form-input"
              value={formData.contacto}
              onChange={handleChange}
              disabled={loading}
              placeholder="Nombre de contacto"
            />
          </div>

          <div className="supplier-form-row">
            <div className="supplier-form-group">
              <label htmlFor="telefono" className="supplier-form-label">
                Teléfono
              </label>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                className="supplier-form-input"
                value={formData.telefono}
                onChange={handleChange}
                disabled={loading}
                placeholder="+34 123 456 789"
              />
            </div>

            <div className="supplier-form-group">
              <label htmlFor="email" className="supplier-form-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="supplier-form-input"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                placeholder="proveedor@email.com"
              />
            </div>
          </div>

          <div className="supplier-form-group">
            <label htmlFor="direccion" className="supplier-form-label">
              Dirección
            </label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              className="supplier-form-input"
              value={formData.direccion}
              onChange={handleChange}
              disabled={loading}
              placeholder="Dirección completa"
            />
          </div>

          <div className="supplier-form-group">
            <label htmlFor="notas" className="supplier-form-label">
              Notas
            </label>
            <textarea
              id="notas"
              name="notas"
              className="supplier-form-textarea"
              value={formData.notas}
              onChange={handleChange}
              disabled={loading}
              placeholder="Información adicional sobre el proveedor"
              rows="4"
            />
          </div>

          <div className="supplier-form-actions">
            <button
              type="button"
              className="supplier-form-button-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="supplier-form-button-save"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="supplier-form-spinner"></span>
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

export default SupplierForm;

