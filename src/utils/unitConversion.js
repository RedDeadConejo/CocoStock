/**
 * Conversiones entre unidades para ingredientes de recetas.
 * La quantity se guarda siempre en la unidad base del producto (medida).
 */

const FACTOR = 1000; // L<->ml, kg<->g

/**
 * Convierte un valor de una unidad a la unidad base del producto.
 * @param {number} value - Valor en la unidad 'fromUnit'
 * @param {string} fromUnit - Unidad del valor (L, ml, kg, g)
 * @param {string} baseUnit - Unidad base del producto (medida)
 * @returns {number}
 */
export function toBaseQuantity(value, fromUnit, baseUnit) {
  if (!fromUnit || !baseUnit || fromUnit === baseUnit) return value;
  if (fromUnit === 'ml' && baseUnit === 'L') return value / FACTOR;
  if (fromUnit === 'L' && baseUnit === 'ml') return value * FACTOR;
  if (fromUnit === 'g' && baseUnit === 'kg') return value / FACTOR;
  if (fromUnit === 'kg' && baseUnit === 'g') return value * FACTOR;
  return value;
}

/**
 * Convierte un valor de la unidad base a la unidad de visualización.
 * @param {number} value - Valor en unidad base
 * @param {string} toUnit - Unidad a mostrar (L, ml, kg, g)
 * @param {string} baseUnit - Unidad base del producto
 * @returns {number}
 */
export function fromBaseQuantity(value, toUnit, baseUnit) {
  if (!toUnit || !baseUnit || toUnit === baseUnit) return value;
  if (toUnit === 'ml' && baseUnit === 'L') return value * FACTOR;
  if (toUnit === 'L' && baseUnit === 'ml') return value / FACTOR;
  if (toUnit === 'g' && baseUnit === 'kg') return value * FACTOR;
  if (toUnit === 'kg' && baseUnit === 'g') return value / FACTOR;
  return value;
}

/**
 * Unidades que se pueden elegir por ingrediente (según medida del producto)
 */
export const UNIT_OPTIONS = [
  { value: 'L', label: 'L' },
  { value: 'ml', label: 'ml' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'unidades', label: 'unidades' },
];

/**
 * Unidades compatibles para cada medida base
 */
export function getUnitsForMedida(medida) {
  if (!medida) return UNIT_OPTIONS;
  const m = String(medida).toLowerCase();
  if (m === 'l' || m === 'ml') return UNIT_OPTIONS.filter((u) => ['L', 'ml'].includes(u.value));
  if (m === 'kg' || m === 'g') return UNIT_OPTIONS.filter((u) => ['kg', 'g'].includes(u.value));
  const exact = UNIT_OPTIONS.find((u) => u.value.toLowerCase() === m);
  return exact ? [exact] : [{ value: medida, label: medida }, ...UNIT_OPTIONS];
}
