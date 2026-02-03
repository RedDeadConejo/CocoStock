/**
 * Servicio de Productos
 * Maneja todas las operaciones CRUD con productos en Supabase
 */

import { supabase } from './supabase';

const TABLE_NAME = 'products';

/**
 * Obtiene todos los productos activos (no eliminados) con sus proveedores
 */
export async function getProducts() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(`
      *,
      product_suppliers (
        supplier_id,
        suppliers (
          id,
          nombre,
          contacto,
          telefono,
          email
        )
      )
    `)
    .eq('eliminado', false) // Boolean, no string
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  // Transformar los datos para facilitar el uso
  return data.map(product => ({
    ...product,
    suppliers: product.product_suppliers?.map(ps => ps.suppliers).filter(Boolean) || []
  }));
}

/**
 * Obtiene un producto por su ID con sus proveedores
 */
export async function getProductById(id) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(`
      *,
      product_suppliers (
        supplier_id,
        suppliers (
          id,
          nombre,
          contacto,
          telefono,
          email
        )
      )
    `)
    .eq('id', id)
    .eq('eliminado', false) // Boolean, no string
    .single();

  if (error) {
    throw new Error(`Error al obtener producto: ${error.message}`);
  }

  // Transformar los datos para facilitar el uso
  return {
    ...data,
    suppliers: data.product_suppliers?.map(ps => ps.suppliers).filter(Boolean) || []
  };
}

/**
 * Crea un nuevo producto y sus relaciones con proveedores.
 * Usa RPC create_product en Supabase (transacción: producto + historial + proveedores) si está disponible.
 */
export async function createProduct(productData) {
  const pProduct = {
    nombre: String(productData.nombre || ''),
    precio: String(productData.precio || '0'),
    formato: String(productData.formato || ''),
    medida: String(productData.medida || ''),
    precio_por_formato: String(productData.precio_por_formato || '0'),
    iva: String(productData.iva || '0'),
    referencia: String(productData.referencia || ''),
    nivel_reordenado: String(productData.nivel_reordenado || '0'),
    cantidad_por_formato: String(productData.cantidad_por_formato || '0'),
    stock: String(productData.stock || '0'),
  };
  const supplierIds = Array.isArray(productData.supplierIds) ? productData.supplierIds : [];

  try {
    const { data, error } = await supabase.rpc('create_product', {
      p_product: pProduct,
      p_supplier_ids: supplierIds,
    });
    if (!error && data && (Array.isArray(data) ? data[0] : data)) {
      return Array.isArray(data) ? data[0] : data;
    }
  } catch (_) {}

  // Fallback: crear producto, historial y proveedores en cliente (comportamiento anterior)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;
  const userEmail = user?.email || null;
  const product = { ...pProduct, eliminado: false };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([product])
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear producto: ${error.message}`);
  }

  const fieldsToTrack = ['nombre', 'precio', 'formato', 'precio_por_formato', 'iva', 'referencia', 'nivel_reordenado', 'cantidad_por_formato', 'stock'];
  const historyRecords = fieldsToTrack.map(field => ({
    product_id: data.id,
    user_id: userId,
    user_email: userEmail,
    field_name: field,
    old_value: null,
    new_value: String(product[field] || ''),
  }));
  if (historyRecords.length > 0) {
    try {
      await supabase.from('product_changes_history').insert(historyRecords);
    } catch (_) {}
  }
  if (supplierIds.length > 0) {
    await setProductSuppliers(data.id, supplierIds);
  }
  return data;
}

/**
 * Actualiza un producto existente y sus relaciones con proveedores.
 * Usa RPC update_product en Supabase (transacción: update + historial + proveedores) si está disponible.
 */
export async function updateProduct(id, productData) {
  const pProduct = {
    nombre: String(productData.nombre || ''),
    precio: String(productData.precio || '0'),
    formato: String(productData.formato || ''),
    medida: String(productData.medida || ''),
    precio_por_formato: String(productData.precio_por_formato || '0'),
    iva: String(productData.iva || '0'),
    referencia: String(productData.referencia || ''),
    nivel_reordenado: String(productData.nivel_reordenado || '0'),
    cantidad_por_formato: String(productData.cantidad_por_formato || '0'),
    stock: String(productData.stock || '0'),
  };
  const supplierIds = productData.supplierIds !== undefined
    ? (Array.isArray(productData.supplierIds) ? productData.supplierIds : [])
    : null;

  try {
    const { data, error } = await supabase.rpc('update_product', {
      p_id: id,
      p_product: pProduct,
      p_supplier_ids: supplierIds,
    });
    if (!error && data && (Array.isArray(data) ? data[0] : data)) {
      return Array.isArray(data) ? data[0] : data;
    }
  } catch (_) {}

  // Fallback: actualizar producto, historial y proveedores en cliente (comportamiento anterior)
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;
  const userEmail = user?.email || null;

  const { data: currentProduct, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .eq('eliminado', false)
    .single();

  if (fetchError || !currentProduct) {
    throw new Error(currentProduct ? `Error al obtener producto: ${fetchError.message}` : 'Producto no encontrado');
  }

  const updates = { ...pProduct };
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar producto: ${error.message}`);
  }

  const fieldsToTrack = ['nombre', 'precio', 'formato', 'medida', 'precio_por_formato', 'iva', 'referencia', 'nivel_reordenado', 'cantidad_por_formato', 'stock'];
  const historyRecords = [];
  for (const field of fieldsToTrack) {
    const oldValue = String(currentProduct[field] || '');
    const newValue = String(updates[field] || '');
    if (oldValue !== newValue) {
      historyRecords.push({ product_id: id, user_id: userId, user_email: userEmail, field_name: field, old_value: oldValue, new_value: newValue });
    }
  }
  if (historyRecords.length > 0) {
    try {
      await supabase.from('product_changes_history').insert(historyRecords);
    } catch (_) {}
  }
  if (supplierIds !== null) {
    await setProductSuppliers(id, supplierIds);
  }
  return data;
}

/**
 * Actualiza el stock de un producto y registra el cambio en el historial
 * @param {string} id - ID del producto
 * @param {string} action - Acción: 'add', 'subtract', o 'set'
 * @param {number} quantity - Cantidad a agregar, restar o establecer
 */
export async function updateStock(id, action, quantity) {
  // Obtener el usuario actual
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;
  const userEmail = user?.email || null;

  // Primero obtener el producto actual
  const { data: product, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('stock')
    .eq('id', id)
    .eq('eliminado', false)
    .single();

  if (fetchError) {
    throw new Error(`Error al obtener producto: ${fetchError.message}`);
  }

  if (!product) {
    throw new Error('Producto no encontrado');
  }

  const currentStock = parseFloat(product.stock || 0);
  const oldStock = String(currentStock);
  let newStock;

  switch (action) {
    case 'add':
      newStock = currentStock + quantity;
      break;
    case 'subtract':
      newStock = Math.max(0, currentStock - quantity);
      break;
    case 'set':
      newStock = quantity;
      break;
    default:
      throw new Error('Acción no válida. Use: add, subtract o set');
  }

  const newStockString = String(newStock);

  // Actualizar el stock
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ stock: newStockString })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar stock: ${error.message}`);
  }

  // Registrar el cambio en el historial
  try {
    const { error: historyError } = await supabase
      .from('stock_history')
      .insert({
        product_id: id,
        user_id: userId,
        user_email: userEmail,
        action_type: action,
        old_stock: oldStock,
        new_stock: newStockString,
        quantity: String(quantity),
      });

    if (historyError) {
      // No lanzar error si falla el historial, solo loguear
      console.warn('Error al registrar historial de stock:', historyError);
    }
  } catch (historyErr) {
    // No lanzar error si falla el historial, solo loguear
    console.warn('Error al registrar historial de stock:', historyErr);
  }

  return data;
}

/**
 * Elimina un producto (soft delete - solo marca como eliminado)
 * IMPORTANTE: eliminado debe ser boolean (true), no string ('true')
 * 
 * Intenta primero con función almacenada (bypass RLS), luego con update directo
 */
export async function deleteProduct(id) {
  // Método 1: RPC soft_delete_product (permiso edit_inventory, transacción en servidor)
  try {
    const { data, error } = await supabase.rpc('soft_delete_product', {
      p_product_id: id,
    });
    if (!error && data) {
      return Array.isArray(data) ? data[0] : data;
    }
  } catch (rpcError) {
    console.warn('RPC soft_delete_product no disponible, usando fallback:', rpcError);
  }

  // Método 2: Update directo (si la función no existe o falla)
  let { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ eliminado: true })
    .eq('id', id)
    .eq('eliminado', false)
    .select()
    .single();

  // Método 3: Intentar sin el filtro eliminado (último recurso)
  if (error && error.message?.includes('row-level security')) {
    console.warn('Intentando sin filtro eliminado...');
    const result = await supabase
      .from(TABLE_NAME)
      .update({ eliminado: true })
      .eq('id', id)
      .select()
      .single();
    
    data = result.data;
    error = result.error;
  }

  if (error) {
    const errorDetails = {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    };
    
    console.error('Error al eliminar producto:', errorDetails);
    
    if (error.message?.includes('row-level security') || error.code === '42501') {
      throw new Error(
        'Error de permisos RLS. Ejecuta docs/MIGRATE_TO_ELIMINADO.sql para configurar las políticas. ' +
        `Detalles: ${error.message || error.details || 'Error desconocido'}`
      );
    }
    
    throw new Error(
      `Error al eliminar producto: ${error.message || error.details || 'Error desconocido'}`
    );
  }

  return data;
}

/**
 * Establece los proveedores de un producto
 * Elimina las relaciones existentes y crea las nuevas
 * @param {string} productId - ID del producto
 * @param {string[]} supplierIds - Array de IDs de proveedores
 */
export async function setProductSuppliers(productId, supplierIds) {
  // Eliminar todas las relaciones existentes del producto
  const { error: deleteError } = await supabase
    .from('product_suppliers')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(`Error al eliminar relaciones de proveedores: ${deleteError.message}`);
  }

  // Si no hay proveedores, terminar aquí
  if (!supplierIds || supplierIds.length === 0) {
    return;
  }

  // Crear las nuevas relaciones
  const relations = supplierIds.map(supplierId => ({
    product_id: productId,
    supplier_id: supplierId,
  }));

  const { error: insertError } = await supabase
    .from('product_suppliers')
    .insert(relations);

  if (insertError) {
    throw new Error(`Error al crear relaciones de proveedores: ${insertError.message}`);
  }
}

/**
 * Obtiene el historial de cambios de stock de un producto
 * @param {string} productId - ID del producto
 * @param {number} limit - Límite de registros a obtener (opcional, por defecto 50)
 */
export async function getStockHistory(productId, limit = 50) {
  const { data, error } = await supabase
    .from('stock_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al obtener historial de stock: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene el historial de cambios de stock de todos los productos
 * @param {number} limit - Límite de registros a obtener (opcional, por defecto 100)
 */
export async function getAllStockHistory(limit = 100) {
  const { data, error } = await supabase
    .from('stock_history')
    .select(`
      *,
      products (
        id,
        nombre,
        referencia
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al obtener historial de stock: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene el historial de cambios de un producto (todos los campos)
 * @param {string} productId - ID del producto
 * @param {number} limit - Límite de registros a obtener (opcional, por defecto 100)
 */
export async function getProductChangesHistory(productId, limit = 100) {
  const { data, error } = await supabase
    .from('product_changes_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al obtener historial de cambios: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene el historial de cambios de todos los productos
 * @param {number} limit - Límite de registros a obtener (opcional, por defecto 200)
 */
export async function getAllProductChangesHistory(limit = 200) {
  const { data, error } = await supabase
    .from('product_changes_history')
    .select(`
      *,
      products (
        id,
        nombre,
        referencia
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al obtener historial de cambios: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene el historial de cambios de un campo específico de un producto
 * @param {string} productId - ID del producto
 * @param {string} fieldName - Nombre del campo (ej: 'precio', 'nombre')
 * @param {number} limit - Límite de registros a obtener (opcional, por defecto 50)
 */
export async function getProductFieldHistory(productId, fieldName, limit = 50) {
  const { data, error } = await supabase
    .from('product_changes_history')
    .select('*')
    .eq('product_id', productId)
    .eq('field_name', fieldName)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al obtener historial del campo: ${error.message}`);
  }

  return data;
}
