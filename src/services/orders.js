/**
 * Servicio de Pedidos
 * Maneja todas las operaciones con pedidos en Supabase
 */

import { supabase } from './supabase';

const ORDERS_TABLE = 'orders';
const ORDER_ITEMS_TABLE = 'order_items';

/**
 * Estados de pedido disponibles
 */
export const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * Obtiene todos los pedidos con sus items y perfil del creador.
 * Usa RPC get_orders_with_creators (una sola llamada) si está disponible; si no, consulta + user_profiles.
 * @param {string} userId - Si se proporciona, filtra por usuario
 * @param {string} status - Si se proporciona, filtra por estado
 */
export async function getOrders(userId = null, status = null) {
  try {
    const { data, error } = await supabase.rpc('get_orders_with_creators', {
      p_user_id: userId || null,
      p_status: status || null,
    });
    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (_) {}

  // Fallback: consulta pedidos + user_profiles por separado
  let query = supabase
    .from(ORDERS_TABLE)
    .select(`
      *,
      order_items (
        id,
        product_id,
        product_name,
        quantity,
        quantity_requested,
        quantity_sent,
        products (
          id,
          nombre,
          referencia,
          precio,
          stock,
          formato
        )
      ),
      restaurants (
        id,
        nombre,
        direccion,
        telefono,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('created_by', userId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al obtener pedidos: ${error.message}`);
  }

  if (data && data.length > 0) {
    const userIds = [...new Set(data.map(order => order.created_by).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (!profilesError && profiles) {
        const profilesMap = {};
        profiles.forEach(profile => { profilesMap[profile.id] = profile; });
        data.forEach(order => {
          if (order.created_by && profilesMap[order.created_by]) {
            order.user_profiles = profilesMap[order.created_by];
          }
        });
      }
    }
  }

  return data || [];
}

/**
 * Obtiene un pedido por su ID con sus items
 */
export async function getOrderById(orderId) {
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select(`
      *,
      order_items (
        id,
        product_id,
        product_name,
        quantity,
        quantity_requested,
        quantity_sent,
        products (
          id,
          nombre,
          referencia,
          precio,
          stock,
          formato
        )
      ),
      restaurants (
        id,
        nombre,
        direccion,
        telefono,
        email
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    throw new Error(`Error al obtener pedido: ${error.message}`);
  }

  // Obtener información del usuario si existe
  if (data && data.created_by) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('id', data.created_by)
      .single();
    
    if (!profileError && profile) {
      data.user_profiles = profile;
    }
  }

  return data;
}

/**
 * Crea un nuevo pedido con sus items.
 * Usa RPC create_order en Supabase (transacción atómica) si está disponible.
 * @param {Array} items - Array de items { product_id, product_name, quantity }
 * @param {string} notes - Notas opcionales del pedido
 */
export async function createOrder(items, notes = '') {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  if (!items || items.length === 0) {
    throw new Error('El pedido debe contener al menos un producto');
  }

  let restaurantId = null;
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('restaurant_id')
      .eq('id', user.id)
      .single();
    if (profile?.restaurant_id) restaurantId = profile.restaurant_id;
  } catch (_) {}

  const pItems = items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name || 'Producto',
    quantity: parseFloat(item.quantity) || 0,
  }));

  try {
    const { data, error } = await supabase.rpc('create_order', {
      p_restaurant_id: restaurantId,
      p_notes: notes || null,
      p_items: pItems,
    });

    if (!error && data && (Array.isArray(data) ? data[0] : data)) {
      const order = Array.isArray(data) ? data[0] : data;
      return await getOrderById(order.id);
    }
  } catch (_) {}

  // Fallback: crear pedido e ítems en cliente (comportamiento anterior)
  const { data: order, error: orderError } = await supabase
    .from(ORDERS_TABLE)
    .insert([{
      created_by: user.id,
      restaurant_id: restaurantId,
      status: ORDER_STATUS.PENDING,
      notes: notes || null,
    }])
    .select()
    .single();

  if (orderError) {
    throw new Error(`Error al crear pedido: ${orderError.message}`);
  }

  const orderItems = items.map((item) => {
    const quantity = parseFloat(item.quantity) || 0;
    return {
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity,
      quantity_requested: quantity,
      quantity_sent: quantity,
    };
  });

  const { error: itemsError } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .insert(orderItems);

  if (itemsError) {
    await supabase.from(ORDERS_TABLE).delete().eq('id', order.id);
    throw new Error(`Error al crear items del pedido: ${itemsError.message}`);
  }

  return await getOrderById(order.id);
}

/**
 * Procesa la finalización de un pedido: resta stock y registra salidas
 * @param {string} orderId - ID del pedido a procesar
 */
async function processOrderCompletion(orderId) {
  // Obtener el pedido completo con sus items
  const order = await getOrderById(orderId);

  if (!order || !order.order_items || order.order_items.length === 0) {
    throw new Error('Pedido no encontrado o sin items');
  }

  // Obtener el usuario actual (quien completa el pedido)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;
  const userEmail = user?.email || null;

  // Procesar cada item del pedido
  for (const item of order.order_items) {
    if (!item.product_id) continue;

    // Usar quantity_sent si existe y no es null, sino usar quantity_requested, sino quantity (compatibilidad)
    const quantityToSubtract = parseFloat(
      (item.quantity_sent !== null && item.quantity_sent !== undefined) 
        ? item.quantity_sent 
        : (item.quantity_requested || item.quantity || 0)
    );
    if (quantityToSubtract <= 0) continue;

    try {
      // Obtener el producto actual
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, stock')
        .eq('id', item.product_id)
        .eq('eliminado', false)
        .single();

      if (productError || !product) {
        console.warn(`Producto ${item.product_id} no encontrado, saltando...`);
        continue;
      }

      const currentStock = parseFloat(product.stock || 0);
      const newStock = Math.max(0, currentStock - quantityToSubtract);
      const newStockString = String(newStock);

      // Actualizar el stock del producto
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStockString })
        .eq('id', item.product_id);

      if (updateError) {
        console.error(`Error al actualizar stock del producto ${item.product_id}:`, updateError);
        continue;
      }

      // Registrar la salida en stock_history
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert([
          {
            product_id: item.product_id,
            user_id: userId,
            user_email: userEmail,
            action_type: 'subtract',
            old_stock: String(currentStock),
            new_stock: newStockString,
            quantity: String(quantityToSubtract),
          },
        ]);

      if (historyError) {
        console.warn(`Error al registrar historial para producto ${item.product_id}:`, historyError);
        // No lanzar error, solo loguear
      }
    } catch (err) {
      console.error(`Error procesando item ${item.id}:`, err);
      // Continuar con el siguiente item
    }
  }
}

/**
 * Actualiza el estado de un pedido.
 * Si se completa: usa RPC complete_order (transacción en Supabase) si está disponible.
 * @param {string} orderId - ID del pedido
 * @param {string} status - Nuevo estado
 */
export async function updateOrderStatus(orderId, status) {
  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw new Error(`Estado inválido: ${status}`);
  }

  if (status === ORDER_STATUS.COMPLETED) {
    try {
      const { data, error } = await supabase.rpc('complete_order', { p_order_id: orderId });
      if (!error && data && (Array.isArray(data) ? data.length > 0 : data)) {
        return await getOrderById(orderId);
      }
    } catch (_) {}
    await processOrderCompletion(orderId);
  }

  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar pedido: ${error.message}`);
  }

  return data;
}

/**
 * Cancela un pedido (solo si está pendiente)
 */
export async function cancelOrder(orderId) {
  // Verificar que el pedido esté pendiente
  const order = await getOrderById(orderId);
  
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new Error('Solo se pueden cancelar pedidos pendientes');
  }

  return await updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
}

/**
 * Elimina un item de un pedido pendiente
 */
export async function deleteOrderItem(itemId) {
  const { error } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .delete()
    .eq('id', itemId);

  if (error) {
    throw new Error(`Error al eliminar item: ${error.message}`);
  }
}

/**
 * Actualiza la cantidad de un item en un pedido pendiente
 */
export async function updateOrderItemQuantity(itemId, quantity) {
  const quantityNum = parseFloat(quantity);
  
  if (isNaN(quantityNum) || quantityNum < 0) {
    throw new Error('La cantidad debe ser un número válido mayor o igual a 0');
  }

  const { data, error } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .update({ quantity: quantityNum })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar cantidad: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza la cantidad enviada de un item (solo para almacén/admin)
 * @param {string} itemId - ID del item a actualizar
 * @param {number} quantitySent - Nueva cantidad enviada
 */
export async function updateOrderItemQuantitySent(itemId, quantitySent) {
  const quantityNum = parseFloat(quantitySent);
  
  if (isNaN(quantityNum) || quantityNum < 0) {
    throw new Error('La cantidad enviada debe ser un número válido mayor o igual a 0');
  }

  const { data, error } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .update({ quantity_sent: quantityNum })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar cantidad enviada: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene estadísticas de pedidos
 */
export async function getOrderStats() {
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select('id, status, created_at, updated_at');

  if (error) {
    throw new Error(`Error al obtener estadísticas: ${error.message}`);
  }

  // Calcular rotación (tiempo promedio de procesamiento)
  const completedOrders = data.filter((o) => o.status === ORDER_STATUS.COMPLETED);
  let averageProcessingTime = 0;
  let rotation24h = 0;
  let rotation7d = 0;

  if (completedOrders.length > 0) {
    // Calcular tiempo promedio de procesamiento (en horas)
    const processingTimes = completedOrders
      .map(order => {
        const created = new Date(order.created_at);
        const updated = new Date(order.updated_at);
        return (updated - created) / (1000 * 60 * 60); // Convertir a horas
      })
      .filter(time => time > 0); // Filtrar tiempos inválidos

    if (processingTimes.length > 0) {
      averageProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
    }

    // Calcular rotación (pedidos completados en últimas 24 horas y 7 días)
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    rotation24h = completedOrders.filter(order => {
      const completedAt = new Date(order.updated_at);
      return completedAt >= last24h;
    }).length;

    rotation7d = completedOrders.filter(order => {
      const completedAt = new Date(order.updated_at);
      return completedAt >= last7d;
    }).length;
  }

  // Completados hoy (mismo día natural)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const completedToday = (data || []).filter((o) => {
    if (o.status !== ORDER_STATUS.COMPLETED) return false;
    const updated = new Date(o.updated_at);
    return updated >= startOfToday;
  }).length;

  // Incidencias: pedidos con al menos un ítem donde quantity_sent ≠ quantity_requested
  let incidents = 0;
  let incidentsWeekly = 0;
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: itemsData } = await supabase
    .from(ORDER_ITEMS_TABLE)
    .select('order_id, quantity_requested, quantity_sent, quantity');
  if (itemsData && itemsData.length > 0) {
    const orderIdsWithIncidents = new Set();
    itemsData.forEach((item) => {
      const requested = parseFloat(item.quantity_requested ?? item.quantity ?? 0);
      const sent =
        item.quantity_sent != null && item.quantity_sent !== ''
          ? parseFloat(item.quantity_sent)
          : null;
      if (sent !== null && !Number.isNaN(sent) && Math.abs(sent - requested) > 0.001) {
        orderIdsWithIncidents.add(item.order_id);
      }
    });
    incidents = orderIdsWithIncidents.size;
    // Incidencias semanales: pedidos con incidencia actualizados en los últimos 7 días
    incidentsWeekly = (data || []).filter(
      (o) => orderIdsWithIncidents.has(o.id) && new Date(o.updated_at) >= last7d
    ).length;
  }

  const stats = {
    total: data.length,
    pending: data.filter((o) => o.status === ORDER_STATUS.PENDING).length,
    processing: data.filter((o) => o.status === ORDER_STATUS.PROCESSING).length,
    completed: completedOrders.length,
    completedToday,
    cancelled: data.filter((o) => o.status === ORDER_STATUS.CANCELLED).length,
    incidents,
    incidentsWeekly,
    averageProcessingTime, // en horas
    rotation24h, // pedidos completados en últimas 24 horas
    rotation7d, // pedidos completados en últimos 7 días
  };

  return stats;
}

/**
 * Obtiene estadísticas de rotación de productos
 * Basado en salidas de stock (action_type='subtract' en stock_history)
 */
export async function getProductRotationStats() {
  // Obtener todas las salidas de stock (action_type='subtract')
  const { data: stockHistory, error: historyError } = await supabase
    .from('stock_history')
    .select(`
      id,
      product_id,
      quantity,
      created_at,
      products (
        id,
        nombre,
        referencia
      )
    `)
    .eq('action_type', 'subtract')
    .order('created_at', { ascending: false });

  if (historyError) {
    throw new Error(`Error al obtener estadísticas de rotación: ${historyError.message}`);
  }

  if (!stockHistory || stockHistory.length === 0) {
    return {
      topProducts: [],
      allProducts: [],
    };
  }

  // Calcular rotación total por producto
  const productRotation = {};
  stockHistory.forEach(entry => {
    if (!entry.product_id) return;
    
    const productId = entry.product_id;
    const productName = entry.products?.nombre || 'Producto Desconocido';
    const quantity = parseFloat(entry.quantity || 0);

    if (!productRotation[productId]) {
      productRotation[productId] = {
        productId,
        productName,
        totalQuantity: 0,
        movements: [],
      };
    }

    productRotation[productId].totalQuantity += quantity;
    productRotation[productId].movements.push({
      date: entry.created_at,
      quantity,
    });
  });

  // Convertir a array y ordenar por cantidad total
  const allProducts = Object.values(productRotation)
    .sort((a, b) => b.totalQuantity - a.totalQuantity);

  const topProducts = allProducts.slice(0, 10); // Top 10 productos

  return {
    topProducts,
    allProducts,
  };
}

