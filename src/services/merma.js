/**
 * Servicio de Merma
 * Registro de pérdidas/desperdicios por restaurante
 */

import { supabase } from './supabase';

const TABLE_NAME = 'merma';

/**
 * Obtiene las mermas de un restaurante
 * @param {string} restaurantId - ID del restaurante
 * @param {object} filters - { fechaDesde, fechaHasta, productId }
 */
export async function getMermaByRestaurant(restaurantId, filters = {}) {
  if (!restaurantId) return [];

  let query = supabase
    .from(TABLE_NAME)
    .select(`
      *,
      products (
        id,
        nombre,
        medida,
        formato,
        referencia
      )
    `)
    .eq('restaurant_id', restaurantId)
    .order('fecha', { ascending: false });

  if (filters.fechaDesde) {
    query = query.gte('fecha', filters.fechaDesde);
  }
  if (filters.fechaHasta) {
    query = query.lte('fecha', filters.fechaHasta);
  }
  if (filters.productId) {
    query = query.eq('product_id', filters.productId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al obtener merma: ${error.message}`);
  }

  return (data || []).map((m) => ({
    ...m,
    product: m.products,
    products: undefined,
  }));
}

/**
 * Crea un registro de merma
 */
export async function createMerma(mermaData) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const merma = {
    restaurant_id: mermaData.restaurant_id,
    product_id: mermaData.product_id,
    quantity: parseFloat(mermaData.quantity) || 0,
    motivo: mermaData.motivo ? String(mermaData.motivo).trim() : null,
    fecha: mermaData.fecha ? new Date(mermaData.fecha).toISOString() : new Date().toISOString(),
    created_by: user?.id || null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([merma])
    .select(`
      *,
      products (
        id,
        nombre,
        medida,
        formato,
        referencia
      )
    `)
    .single();

  if (error) {
    throw new Error(`Error al crear merma: ${error.message}`);
  }

  return {
    ...data,
    product: data.products,
    products: undefined,
  };
}

/**
 * Obtiene todas las mermas (admin/almacen)
 */
export async function getAllMerma(filters = {}) {
  let query = supabase
    .from(TABLE_NAME)
    .select(`
      *,
      products (
        id,
        nombre,
        medida,
        formato,
        referencia
      ),
      restaurants (
        id,
        nombre
      )
    `)
    .order('fecha', { ascending: false });

  if (filters.restaurantId) {
    query = query.eq('restaurant_id', filters.restaurantId);
  }
  if (filters.fechaDesde) {
    query = query.gte('fecha', filters.fechaDesde);
  }
  if (filters.fechaHasta) {
    query = query.lte('fecha', filters.fechaHasta);
  }
  if (filters.productId) {
    query = query.eq('product_id', filters.productId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al obtener merma: ${error.message}`);
  }

  return (data || []).map((m) => ({
    ...m,
    product: m.products,
    restaurant: m.restaurants,
    products: undefined,
    restaurants: undefined,
  }));
}

/**
 * Elimina un registro de merma (solo admin)
 */
export async function deleteMerma(id) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Error al eliminar merma: ${error.message}`);
  }
}

/**
 * Registra un token de servidor merma (cuenta actual + restaurante).
 * Se llama al iniciar el servidor local merma desde Ajustes.
 */
export async function registerMermaServerToken(token, restaurantId) {
  const { error } = await supabase.rpc('register_merma_server_token', {
    p_token: token,
    p_restaurant_id: restaurantId,
  });
  if (error) throw new Error(error.message || 'Error al registrar token de merma');
}

/**
 * Desregistra un token de servidor merma. Se llama al detener el servidor.
 */
export async function unregisterMermaServerToken(token) {
  const { error } = await supabase.rpc('unregister_merma_server_token', {
    p_token: token,
  });
  if (error) throw new Error(error.message || 'Error al desregistrar token de merma');
}

/**
 * Crea una merma desde la interfaz local (sin sesión) usando el token del servidor.
 */
export async function createMermaWithToken(token, restaurantId, mermaData) {
  const { data, error } = await supabase.rpc('create_merma_with_token', {
    p_token: token,
    p_restaurant_id: restaurantId,
    p_product_id: mermaData.product_id,
    p_quantity: parseFloat(mermaData.quantity) || 0,
    p_motivo: mermaData.motivo ? String(mermaData.motivo).trim() : null,
    p_fecha: mermaData.fecha ? new Date(mermaData.fecha).toISOString() : new Date().toISOString(),
  });
  if (error) throw new Error(error.message || 'Error al crear merma');
  return data;
}

/**
 * Lista productos para el formulario de merma local (sin sesión).
 */
export async function getProductsForMerma() {
  const { data, error } = await supabase.rpc('get_products_for_merma');
  if (error) throw new Error(error.message || 'Error al cargar productos');
  return data || [];
}
