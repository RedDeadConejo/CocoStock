/**
 * Utilidades de formateo compartidas
 */

/**
 * Formatea un valor numérico como moneda
 * Muestra todos los decimales que tenga el valor float original
 * @param {number|string} value - Valor numérico o string numérico
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined) {
    return '0,00 €';
  }
  
  // Preservar el valor original como string para detectar decimales
  const originalStr = String(value);
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0,00 €';
  }
  
  // Detectar cuántos decimales tiene el número original desde el string
  const decimalIndex = originalStr.indexOf('.');
  let decimals = 2; // Por defecto 2 decimales
  
  if (decimalIndex !== -1) {
    // Contar los decimales después del punto
    const decimalPart = originalStr.substring(decimalIndex + 1);
    // Eliminar ceros finales pero preservar al menos 1 decimal si había punto
    const trimmedDecimals = decimalPart.replace(/0+$/, '');
    decimals = trimmedDecimals.length || 1; // Al menos 1 decimal si había punto
    // Limitar a un máximo razonable (20 decimales)
    if (decimals > 20) decimals = 20;
  } else {
    // Si no tiene punto decimal, verificar si es entero
    if (numValue % 1 === 0) {
      decimals = 0; // Es un número entero
    } else {
      // Tiene decimales pero no se ven en el string (puede ser notación científica)
      // Usar 2 decimales por defecto
      decimals = 2;
    }
  }
  
  // Formatear con los decimales detectados
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
};

/**
 * Formatea una fecha a formato legible
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const defaultOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('es-ES', { ...defaultOptions, ...options });
};

/**
 * Formatea una fecha completa con hora
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
