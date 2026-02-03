/**
 * Servicio de Compras a Proveedores
 * Maneja todas las operaciones con compras en Supabase
 */

import { supabase } from './supabase';

const PURCHASES_TABLE = 'purchases';
const PURCHASE_ITEMS_TABLE = 'purchase_items';

/**
 * Estados de compra disponibles
 */
export const PURCHASE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * Obtiene todas las compras con sus items y perfil del creador.
 * Usa RPC get_purchases_with_creators (una sola llamada) si está disponible; si no, consulta + user_profiles.
 * @param {string} userId - Si se proporciona, filtra por usuario
 * @param {string} status - Si se proporciona, filtra por estado
 */
export async function getPurchases(userId = null, status = null) {
  try {
    const { data, error } = await supabase.rpc('get_purchases_with_creators', {
      p_user_id: userId || null,
      p_status: status || null,
    });
    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (_) {}

  // Fallback: consulta compras + user_profiles por separado
  let query = supabase
    .from(PURCHASES_TABLE)
    .select(`
      *,
      purchase_items (
        id,
        product_id,
        product_name,
        quantity,
        quantity_requested,
        quantity_received,
        products (
          id,
          nombre,
          referencia,
          precio,
          stock,
          formato
        )
      ),
      suppliers (
        id,
        nombre,
        contacto,
        telefono,
        email,
        direccion
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
    throw new Error(`Error al obtener compras: ${error.message}`);
  }

  if (data && data.length > 0) {
    const userIds = [...new Set(data.map(purchase => purchase.created_by).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (!profilesError && profiles) {
        const profilesMap = {};
        profiles.forEach(profile => { profilesMap[profile.id] = profile; });
        data.forEach(purchase => {
          if (purchase.created_by && profilesMap[purchase.created_by]) {
            purchase.user_profiles = profilesMap[purchase.created_by];
          }
        });
      }
    }
  }

  return data || [];
}

/**
 * Obtiene una compra por su ID con sus items
 */
export async function getPurchaseById(purchaseId) {
  const { data, error } = await supabase
    .from(PURCHASES_TABLE)
    .select(`
      *,
      purchase_items (
        id,
        product_id,
        product_name,
        quantity,
        quantity_requested,
        quantity_received,
        products (
          id,
          nombre,
          referencia,
          precio,
          stock,
          formato
        )
      ),
      suppliers (
        id,
        nombre,
        contacto,
        telefono,
        email,
        direccion
      )
    `)
    .eq('id', purchaseId)
    .single();

  if (error) {
    throw new Error(`Error al obtener compra: ${error.message}`);
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
 * Crea una nueva compra con sus items.
 * Usa RPC create_purchase en Supabase (transacción atómica) si está disponible.
 * @param {string} supplierId - ID del proveedor
 * @param {Array} items - Array de items { product_id, product_name, quantity }
 * @param {string} notes - Notas opcionales de la compra
 */
export async function createPurchase(supplierId, items, notes = '') {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  if (!items || items.length === 0) {
    throw new Error('La compra debe contener al menos un producto');
  }

  if (!supplierId) {
    throw new Error('Debe seleccionar un proveedor');
  }

  const pItems = items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name || 'Producto',
    quantity: parseFloat(item.quantity) || 0,
  }));

  try {
    const { data, error } = await supabase.rpc('create_purchase', {
      p_supplier_id: supplierId,
      p_notes: notes || null,
      p_items: pItems,
    });

    if (!error && data && (Array.isArray(data) ? data[0] : data)) {
      const purchase = Array.isArray(data) ? data[0] : data;
      return await getPurchaseById(purchase.id);
    }
  } catch (_) {}

  // Fallback: crear compra e ítems en cliente (comportamiento anterior)
  const { data: purchase, error: purchaseError } = await supabase
    .from(PURCHASES_TABLE)
    .insert([{
      created_by: user.id,
      supplier_id: supplierId,
      status: PURCHASE_STATUS.PENDING,
      notes: notes || null,
    }])
    .select()
    .single();

  if (purchaseError) {
    throw new Error(`Error al crear compra: ${purchaseError.message}`);
  }

  const purchaseItems = items.map((item) => {
    const quantity = parseFloat(item.quantity) || 0;
    return {
      purchase_id: purchase.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity,
      quantity_requested: quantity,
      quantity_received: 0,
    };
  });

  const { error: itemsError } = await supabase
    .from(PURCHASE_ITEMS_TABLE)
    .insert(purchaseItems);

  if (itemsError) {
    await supabase.from(PURCHASES_TABLE).delete().eq('id', purchase.id);
    throw new Error(`Error al crear items de la compra: ${itemsError.message}`);
  }

  return await getPurchaseById(purchase.id);
}

/**
 * Procesa la finalización de una compra: suma stock y registra entradas
 * @param {string} purchaseId - ID de la compra a procesar
 */
async function processPurchaseCompletion(purchaseId) {
  // Obtener la compra completa con sus items
  const purchase = await getPurchaseById(purchaseId);

  if (!purchase || !purchase.purchase_items || purchase.purchase_items.length === 0) {
    throw new Error('Compra no encontrada o sin items');
  }

  // Obtener el usuario actual (quien completa la compra)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;
  const userEmail = user?.email || null;

  // Procesar cada item de la compra
  for (const item of purchase.purchase_items) {
    if (!item.product_id) continue;

    // Usar quantity_received si existe y no es null, sino usar quantity_requested, sino quantity (compatibilidad)
    const quantityToAdd = parseFloat(
      (item.quantity_received !== null && item.quantity_received !== undefined && item.quantity_received > 0) 
        ? item.quantity_received 
        : (item.quantity_requested || item.quantity || 0)
    );
    if (quantityToAdd <= 0) continue;

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
      const newStock = currentStock + quantityToAdd;
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

      // Registrar la entrada en stock_history
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert([
          {
            product_id: item.product_id,
            user_id: userId,
            user_email: userEmail,
            action_type: 'add',
            old_stock: String(currentStock),
            new_stock: newStockString,
            quantity: String(quantityToAdd),
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
 * Actualiza el estado de una compra.
 * Si se completa: usa RPC complete_purchase (transacción en Supabase) si está disponible.
 * @param {string} purchaseId - ID de la compra
 * @param {string} status - Nuevo estado
 */
export async function updatePurchaseStatus(purchaseId, status) {
  if (!Object.values(PURCHASE_STATUS).includes(status)) {
    throw new Error(`Estado inválido: ${status}`);
  }

  if (status === PURCHASE_STATUS.COMPLETED) {
    try {
      const { data, error } = await supabase.rpc('complete_purchase', { p_purchase_id: purchaseId });
      if (!error && data && (Array.isArray(data) ? data.length > 0 : data)) {
        return await getPurchaseById(purchaseId);
      }
    } catch (_) {}
    await processPurchaseCompletion(purchaseId);
  }

  const { data, error } = await supabase
    .from(PURCHASES_TABLE)
    .update({ status })
    .eq('id', purchaseId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar compra: ${error.message}`);
  }

  return data;
}

/**
 * Cancela una compra (solo si está pendiente)
 */
export async function cancelPurchase(purchaseId) {
  // Verificar que la compra esté pendiente
  const purchase = await getPurchaseById(purchaseId);
  
  if (purchase.status !== PURCHASE_STATUS.PENDING) {
    throw new Error('Solo se pueden cancelar compras pendientes');
  }

  return await updatePurchaseStatus(purchaseId, PURCHASE_STATUS.CANCELLED);
}

/**
 * Elimina un item de una compra pendiente
 */
export async function deletePurchaseItem(itemId) {
  const { error } = await supabase
    .from(PURCHASE_ITEMS_TABLE)
    .delete()
    .eq('id', itemId);

  if (error) {
    throw new Error(`Error al eliminar item: ${error.message}`);
  }
}

/**
 * Actualiza la cantidad de un item en una compra pendiente
 */
export async function updatePurchaseItemQuantity(itemId, quantity) {
  const quantityNum = parseFloat(quantity);
  
  if (isNaN(quantityNum) || quantityNum < 0) {
    throw new Error('La cantidad debe ser un número válido mayor o igual a 0');
  }

  const { data, error } = await supabase
    .from(PURCHASE_ITEMS_TABLE)
    .update({ 
      quantity: quantityNum,
      quantity_requested: quantityNum 
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar cantidad: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza la cantidad recibida de un item (solo para almacén/admin)
 * @param {string} itemId - ID del item a actualizar
 * @param {number} quantityReceived - Nueva cantidad recibida
 */
export async function updatePurchaseItemQuantityReceived(itemId, quantityReceived) {
  const quantityNum = parseFloat(quantityReceived);
  
  if (isNaN(quantityNum) || quantityNum < 0) {
    throw new Error('La cantidad recibida debe ser un número válido mayor o igual a 0');
  }

  const { data, error } = await supabase
    .from(PURCHASE_ITEMS_TABLE)
    .update({ quantity_received: quantityNum })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar cantidad recibida: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene estadísticas de compras
 */
export async function getPurchaseStats() {
  const { data, error } = await supabase
    .from(PURCHASES_TABLE)
    .select('id, status, created_at, updated_at');

  if (error) {
    throw new Error(`Error al obtener estadísticas: ${error.message}`);
  }

  const completedPurchases = (data || []).filter((p) => p.status === PURCHASE_STATUS.COMPLETED);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const completedToday = (data || []).filter((p) => {
    if (p.status !== PURCHASE_STATUS.COMPLETED) return false;
    const updated = new Date(p.updated_at);
    return updated >= startOfToday;
  }).length;

  const rotation24h = completedPurchases.filter((p) => {
    const completedAt = new Date(p.updated_at);
    return completedAt >= last24h;
  }).length;

  // Incidencias: compras con al menos un ítem donde quantity_received ≠ quantity_requested
  let incidents = 0;
  let incidentsWeekly = 0;
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: itemsData } = await supabase
    .from(PURCHASE_ITEMS_TABLE)
    .select('purchase_id, quantity_requested, quantity_received, quantity');
  if (itemsData && itemsData.length > 0) {
    const purchaseIdsWithIncidents = new Set();
    itemsData.forEach((item) => {
      const requested = parseFloat(item.quantity_requested ?? item.quantity ?? 0);
      const received =
        item.quantity_received != null && item.quantity_received !== ''
          ? parseFloat(item.quantity_received)
          : null;
      if (received !== null && !Number.isNaN(received) && Math.abs(received - requested) > 0.001) {
        purchaseIdsWithIncidents.add(item.purchase_id);
      }
    });
    incidents = purchaseIdsWithIncidents.size;
    incidentsWeekly = (data || []).filter(
      (p) => purchaseIdsWithIncidents.has(p.id) && new Date(p.updated_at) >= last7d
    ).length;
  }

  const stats = {
    total: data.length,
    pending: data.filter((p) => p.status === PURCHASE_STATUS.PENDING).length,
    processing: data.filter((p) => p.status === PURCHASE_STATUS.PROCESSING).length,
    completed: completedPurchases.length,
    completedToday,
    cancelled: data.filter((p) => p.status === PURCHASE_STATUS.CANCELLED).length,
    rotation24h,
    incidents,
    incidentsWeekly,
  };

  return stats;
}

/**
 * Cantidad comprada (recibida) por producto en los últimos 30 días (compras completadas).
 * Para calcular % merma/compra mensual por producto.
 * @returns {Promise<Record<string, number>>} product_id -> total quantity_received
 */
export async function getPurchasedQuantityByProductLast30Days() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const { data: purchases, error: purchasesError } = await supabase
    .from(PURCHASES_TABLE)
    .select('id')
    .eq('status', PURCHASE_STATUS.COMPLETED)
    .gte('created_at', since);

  if (purchasesError || !purchases || purchases.length === 0) {
    return {};
  }

  const purchaseIds = purchases.map((p) => p.id);
  const { data: items, error: itemsError } = await supabase
    .from(PURCHASE_ITEMS_TABLE)
    .select('product_id, quantity_received, quantity')
    .in('purchase_id', purchaseIds);

  if (itemsError || !items || items.length === 0) {
    return {};
  }

  const byProduct = {};
  items.forEach((item) => {
    const pid = item.product_id;
    if (!pid) return;
    const qty =
      item.quantity_received != null && item.quantity_received !== ''
        ? parseFloat(item.quantity_received)
        : parseFloat(item.quantity) || 0;
    if (!Number.isNaN(qty)) {
      byProduct[pid] = (byProduct[pid] || 0) + qty;
    }
  });
  return byProduct;
}
