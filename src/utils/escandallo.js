/**
 * Utilidad para calcular el escandallo (coste de ingredientes) de platos
 */

/**
 * Obtiene el coste unitario de un producto (por medida/formato)
 * Usa precio_por_formato / cantidad_por_formato si están definidos, si no precio
 * @param {object} product - Producto con precio, precio_por_formato, cantidad_por_formato
 * @returns {number}
 */
export function getUnitCost(product) {
  if (!product) return 0;
  const ppf = parseFloat(product.precio_por_formato);
  const cpf = parseFloat(product.cantidad_por_formato);
  const p = parseFloat(product.precio);
  if (cpf > 0 && !isNaN(ppf) && ppf >= 0) {
    return ppf / cpf;
  }
  return !isNaN(p) && p >= 0 ? p : 0;
}

/**
 * Formatea la unidad del producto para mostrar (medida, formato)
 * @param {object} product
 * @returns {string}
 */
export function formatUnit(product) {
  if (!product) return 'ud';
  return [product.medida, product.formato].filter(Boolean).join(' ') || 'ud';
}

/**
 * Calcula el escandallo de un plato
 * @param {object} dish - Plato con ingredients[] y cada ingredient con product, quantity
 * @returns {{ lines: Array<{ product, quantity, unit, unitCost, cost }>, totalCost: number }}
 */
export function computeEscandallo(dish) {
  const ingredients = dish?.ingredients || [];
  const lines = ingredients.map((ing) => {
    const p = ing.product;
    const q = parseFloat(ing.quantity) || 0;
    const unitCost = getUnitCost(p);
    const cost = q * unitCost;
    return {
      product: p,
      productName: p?.nombre ?? 'Producto',
      quantity: q,
      unit: formatUnit(p),
      unitCost,
      cost,
    };
  });
  const totalCost = lines.reduce((acc, l) => acc + l.cost, 0);
  return { lines, totalCost };
}

/**
 * Genera CSV del escandallo de varios platos (filtrados)
 * @param {object[]} dishes - Lista de platos
 * @param {object} opts - { locale }
 * @returns {string}
 */
export function escandalloToCsv(dishes, opts = {}) {
  const rows = [];
  const sep = ';';
  const enc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  rows.push(['Plato', 'Precio venta (€)', 'Coste (€)', 'Margen (%)', 'Ingrediente', 'Cantidad', 'Unidad', 'P. unit. (€)', 'Coste (€)'].map(enc).join(sep));

  for (const d of dishes) {
    const { lines, totalCost } = computeEscandallo(d);
    const precio = parseFloat(d.precio) || 0;
    const margen = precio > 0 ? (((precio - totalCost) / precio) * 100).toFixed(1) : '-';

    if (lines.length === 0) {
      rows.push([enc(d.nombre), enc(precio), enc(totalCost.toFixed(2)), enc(margen), '', '', '', '', ''].join(sep));
    } else {
      lines.forEach((line, i) => {
        const nomb = i === 0 ? d.nombre : '';
        const pv = i === 0 ? precio : '';
        const tc = i === 0 ? totalCost.toFixed(2) : '';
        const m = i === 0 ? margen : '';
        rows.push([
          enc(nomb),
          enc(pv),
          enc(tc),
          enc(m),
          enc(line.productName),
          enc(line.quantity),
          enc(line.unit),
          enc(line.unitCost.toFixed(4)),
          enc(line.cost.toFixed(2)),
        ].join(sep));
      });
    }
  }

  return '\uFEFF' + rows.join('\r\n');
}
