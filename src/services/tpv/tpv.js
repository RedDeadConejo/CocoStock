/**
 * Servicio TPV - Punto de venta
 * Crear ventas, líneas, cerrar/cancelar. Usa schema tpv.
 */

import { supabase } from '../supabase';
import { getTpv, TPV_TABLES } from './supabaseTpv';
import { getProducts } from '../products';
import { getDishesByRestaurant } from '../dishes';
import { getUserRestaurant } from '../restaurants';

const SALE_STATUS = { OPEN: 'open', CLOSED: 'closed', CANCELLED: 'cancelled' };

/**
 * Obtiene el restaurante del usuario actual
 */
export async function getCurrentUserRestaurant(userId) {
  if (!userId) return null;
  return getUserRestaurant(userId);
}

/**
 * Lista de ventas (por defecto abiertas) del restaurante del usuario
 */
export async function getSales(restaurantId, status = SALE_STATUS.OPEN) {
  const tpv = getTpv();
  let query = tpv.from(TPV_TABLES.SALES).select('*').order('created_at', { ascending: false });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`Error al obtener ventas: ${error.message}`);
  return data || [];
}

/**
 * Obtiene una venta con sus líneas
 */
export async function getSaleWithItems(saleId) {
  const tpv = getTpv();
  const { data: sale, error: saleError } = await tpv
    .from(TPV_TABLES.SALES)
    .select('*')
    .eq('id', saleId)
    .single();
  if (saleError || !sale) throw new Error(saleError?.message || 'Venta no encontrada');

  const { data: items, error: itemsError } = await tpv
    .from(TPV_TABLES.SALE_ITEMS)
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true });
  if (itemsError) throw new Error(`Error al obtener líneas: ${itemsError.message}`);

  const total = (items || []).reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
  return { ...sale, items: items || [], total };
}

/**
 * Crea una nueva venta (estado open)
 */
export async function createSale(restaurantId, userId) {
  const tpv = getTpv();
  const { data, error } = await tpv
    .from(TPV_TABLES.SALES)
    .insert({
      restaurant_id: restaurantId,
      created_by: userId || null,
      status: SALE_STATUS.OPEN,
      total: 0,
    })
    .select()
    .single();
  if (error) throw new Error(`Error al crear venta: ${error.message}`);
  return data;
}

/**
 * Añade una línea a una venta (producto o plato)
 * unitPrice y quantity se usan para calcular subtotal
 */
export async function addSaleItem(saleId, { productId, dishId, itemName, quantity = 1, unitPrice }) {
  const qty = Number(quantity) || 1;
  const price = Number(unitPrice) || 0;
  const subtotal = Math.round(qty * price * 100) / 100;

  const tpv = getTpv();
  const { data, error } = await tpv
    .from(TPV_TABLES.SALE_ITEMS)
    .insert({
      sale_id: saleId,
      product_id: productId || null,
      dish_id: dishId || null,
      item_name: String(itemName || ''),
      quantity: qty,
      unit_price: price,
      subtotal,
    })
    .select()
    .single();
  if (error) throw new Error(`Error al añadir línea: ${error.message}`);

  await recalcSaleTotal(saleId);
  return data;
}

/**
 * Actualiza cantidad y recalcula subtotal de una línea
 */
export async function updateSaleItem(itemId, { quantity, unitPrice }) {
  const tpv = getTpv();
  const qty = Number(quantity) ?? 1;
  const price = Number(unitPrice) ?? 0;
  const subtotal = Math.round(qty * price * 100) / 100;

  const { data, error } = await tpv
    .from(TPV_TABLES.SALE_ITEMS)
    .update({ quantity: qty, unit_price: price, subtotal })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw new Error(`Error al actualizar línea: ${error.message}`);

  const { data: item } = await tpv.from(TPV_TABLES.SALE_ITEMS).select('sale_id').eq('id', itemId).single();
  if (item?.sale_id) await recalcSaleTotal(item.sale_id);
  return data;
}

/**
 * Elimina una línea y recalcula total de la venta
 */
export async function removeSaleItem(itemId) {
  const tpv = getTpv();
  const { data: item } = await tpv.from(TPV_TABLES.SALE_ITEMS).select('sale_id').eq('id', itemId).single();
  const { error } = await tpv.from(TPV_TABLES.SALE_ITEMS).delete().eq('id', itemId);
  if (error) throw new Error(`Error al eliminar línea: ${error.message}`);
  if (item?.sale_id) await recalcSaleTotal(item.sale_id);
  return true;
}

async function recalcSaleTotal(saleId) {
  const tpv = getTpv();
  const { data: items } = await tpv.from(TPV_TABLES.SALE_ITEMS).select('subtotal').eq('sale_id', saleId);
  const total = (items || []).reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
  await tpv.from(TPV_TABLES.SALES).update({ total }).eq('id', saleId);
}

/**
 * Cierra una venta (status closed, closed_at ahora)
 */
export async function closeSale(saleId, notes = null) {
  const tpv = getTpv();
  const updates = { status: SALE_STATUS.CLOSED, closed_at: new Date().toISOString() };
  if (notes !== undefined && notes !== null) updates.notes = String(notes);
  const { data, error } = await tpv.from(TPV_TABLES.SALES).update(updates).eq('id', saleId).select().single();
  if (error) throw new Error(`Error al cerrar venta: ${error.message}`);
  return data;
}

/**
 * Cancela una venta
 */
export async function cancelSale(saleId) {
  const tpv = getTpv();
  const { data, error } = await tpv
    .from(TPV_TABLES.SALES)
    .update({ status: SALE_STATUS.CANCELLED, closed_at: new Date().toISOString() })
    .eq('id', saleId)
    .select()
    .single();
  if (error) throw new Error(`Error al cancelar venta: ${error.message}`);
  return data;
}

/**
 * Productos para el TPV (id, nombre, precio numérico)
 */
export async function getProductsForTpv() {
  const products = await getProducts();
  return (products || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: parseFloat(p.precio) || 0,
    tipo: 'product',
  }));
}

/**
 * Platos de un restaurante para el TPV
 */
export async function getDishesForTpv(restaurantId) {
  if (!restaurantId) return [];
  const dishes = await getDishesByRestaurant(restaurantId);
  return (dishes || []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
    precio: Number(d.precio) || 0,
    tipo: 'dish',
  }));
}

export { SALE_STATUS };
