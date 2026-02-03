/**
 * Servicio de Platos por Restaurante
 * CRUD de platos/productos de cada local
 */

import { supabase } from './supabase';

const TABLE_NAME = 'dishes';

const INGREDIENTS_TABLE = 'dish_ingredients';

/**
 * Obtiene los platos de un restaurante (solo activos, no eliminados) con sus ingredientes
 * @param {string} restaurantId - ID del restaurante
 */
export async function getDishesByRestaurant(restaurantId) {
  if (!restaurantId) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(`
      *,
      dish_ingredients (
        id,
        product_id,
        quantity,
        products (
          id,
          nombre,
          medida,
          formato,
          referencia,
          precio,
          precio_por_formato,
          cantidad_por_formato
        )
      )
    `)
    .eq('restaurant_id', restaurantId)
    .eq('eliminado', false)
    .order('categoria', { ascending: true, nullsFirst: false })
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(`Error al obtener platos: ${error.message}`);
  }

  const dishes = (data || []).map((d) => ({
    ...d,
    ingredients: (d.dish_ingredients || []).map((di) => ({
      id: di.id,
      product_id: di.product_id,
      quantity: di.quantity,
      product: di.products,
    })),
    dish_ingredients: undefined,
  }));

  return dishes;
}

/**
 * Obtiene un plato por ID
 */
export async function getDishById(id) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .eq('eliminado', false)
    .single();

  if (error) {
    throw new Error(`Error al obtener plato: ${error.message}`);
  }

  return data;
}

/**
 * Crea un plato
 */
export async function createDish(dishData) {
  const dish = {
    restaurant_id: dishData.restaurant_id,
    nombre: String(dishData.nombre || '').trim(),
    descripcion: dishData.descripcion ? String(dishData.descripcion).trim() : null,
    precio: parseFloat(dishData.precio) || 0,
    categoria: dishData.categoria ? String(dishData.categoria).trim() : null,
    activo: dishData.activo !== false,
    eliminado: false,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([dish])
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear plato: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza un plato
 */
export async function updateDish(id, dishData) {
  const updates = {
    nombre: String(dishData.nombre || '').trim(),
    descripcion: dishData.descripcion ? String(dishData.descripcion).trim() : null,
    precio: parseFloat(dishData.precio) || 0,
    categoria: dishData.categoria ? String(dishData.categoria).trim() : null,
    activo: dishData.activo !== false,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar plato: ${error.message}`);
  }

  return data;
}

/**
 * Elimina un plato (soft delete)
 */
export async function deleteDish(id) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ eliminado: true, activo: false })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al eliminar plato: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene los ingredientes de un plato con datos del producto
 * @param {string} dishId - ID del plato
 */
export async function getDishIngredients(dishId) {
  if (!dishId) return [];

  const { data, error } = await supabase
    .from(INGREDIENTS_TABLE)
    .select(`
      id,
      product_id,
      quantity,
      products (
        id,
        nombre,
        medida,
        formato,
        referencia,
        precio,
        precio_por_formato,
        cantidad_por_formato
      )
    `)
    .eq('dish_id', dishId);

  if (error) {
    throw new Error(`Error al obtener ingredientes: ${error.message}`);
  }

  return (data || []).map((di) => ({
    id: di.id,
    product_id: di.product_id,
    quantity: di.quantity,
    product: di.products,
  }));
}

/**
 * Establece los ingredientes de un plato (reemplaza todos)
 * @param {string} dishId - ID del plato
 * @param {Array<{ product_id: string, quantity: number }>} items - Lista de ingredientes
 */
export async function setDishIngredients(dishId, items) {
  const { error: delError } = await supabase
    .from(INGREDIENTS_TABLE)
    .delete()
    .eq('dish_id', dishId);

  if (delError) {
    throw new Error(`Error al limpiar ingredientes: ${delError.message}`);
  }

  if (!items || items.length === 0) return [];

  const rows = items
    .filter((x) => x.product_id && (parseFloat(x.quantity) || 0) > 0)
    .map((x) => ({
      dish_id: dishId,
      product_id: x.product_id,
      quantity: parseFloat(x.quantity) || 0,
    }));

  if (rows.length === 0) return [];

  const { error } = await supabase
    .from(INGREDIENTS_TABLE)
    .insert(rows);

  if (error) {
    throw new Error(`Error al guardar ingredientes: ${error.message}`);
  }

  return [];
}

/**
 * Obtiene estadísticas agregadas de platos (para página Estadísticas)
 * @returns {Promise<{ total: number, byRestaurant: Array<{ id: string, nombre: string, count: number }>, byCategory: Record<string, number> }>}
 */
export async function getDishesStats() {
  const { data: dishes, error } = await supabase
    .from(TABLE_NAME)
    .select('id, restaurant_id, categoria')
    .eq('eliminado', false);

  if (error) {
    throw new Error(`Error al obtener estadísticas de platos: ${error.message}`);
  }

  const list = dishes || [];
  const byRestaurantMap = {};
  const byCategory = {};

  list.forEach((d) => {
    const rid = d.restaurant_id || 'sin-restaurante';
    if (!byRestaurantMap[rid]) byRestaurantMap[rid] = 0;
    byRestaurantMap[rid] += 1;
    const cat = d.categoria && d.categoria.trim() ? d.categoria.trim() : 'Sin categoría';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, nombre')
    .eq('eliminado', false);

  const byRestaurant = Object.entries(byRestaurantMap).map(([id, count]) => ({
    id,
    nombre: restaurants?.find((r) => r.id === id)?.nombre || id,
    count,
  })).sort((a, b) => b.count - a.count);

  return {
    total: list.length,
    byRestaurant,
    byCategory,
  };
}
