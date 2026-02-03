/**
 * Componente MultiSelect
 * Selector múltiple con búsqueda
 */

import { useState, useRef, useEffect } from 'react';
import './MultiSelect.css';

function MultiSelect({ 
  options = [], 
  selected = [], 
  onChange, 
  placeholder = 'Selecciona...',
  label = '',
  disabled = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Filtrar opciones basado en el término de búsqueda
  const filteredOptions = options.filter(option =>
    option.label?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Maneja el toggle de una opción
   */
  const handleToggle = (optionId) => {
    if (disabled) return;

    const isSelected = selected.includes(optionId);
    let newSelected;

    if (isSelected) {
      newSelected = selected.filter(id => id !== optionId);
    } else {
      newSelected = [...selected, optionId];
    }

    onChange(newSelected);
  };

  /**
   * Elimina una opción seleccionada
   */
  const handleRemove = (optionId, e) => {
    e.stopPropagation();
    if (disabled) return;

    const newSelected = selected.filter(id => id !== optionId);
    onChange(newSelected);
  };

  const selectedLabels = options
    .filter(opt => selected.includes(opt.value))
    .map(opt => opt.label);

  return (
    <div className="multi-select" ref={containerRef}>
      {label && (
        <label className="multi-select-label">
          {label}
        </label>
      )}
      
      <div 
        className={`multi-select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="multi-select-selected">
          {selected.length === 0 ? (
            <span className="multi-select-placeholder">{placeholder}</span>
          ) : (
            <div className="multi-select-tags">
              {selectedLabels.slice(0, 3).map((label, index) => {
                const option = options.find(opt => opt.label === label);
                return (
                  <span key={option?.value || index} className="multi-select-tag">
                    {label}
                    {!disabled && (
                      <button
                        type="button"
                        className="multi-select-tag-remove"
                        onClick={(e) => handleRemove(option?.value, e)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
              {selected.length > 3 && (
                <span className="multi-select-tag-more">
                  +{selected.length - 3} más
                </span>
              )}
            </div>
          )}
        </div>
        <span className="multi-select-arrow">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div className="multi-select-dropdown">
          <div className="multi-select-search">
            <input
              type="text"
              className="multi-select-search-input"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="multi-select-options">
            {filteredOptions.length === 0 ? (
              <div className="multi-select-no-results">
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={`multi-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggle(option.value)}
                  >
                    <span className="multi-select-checkbox">
                      {isSelected ? '✓' : ''}
                    </span>
                    <span className="multi-select-option-label">{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiSelect;

