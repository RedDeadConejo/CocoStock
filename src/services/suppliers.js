/**
 * Servicio de Proveedores
 * Maneja todas las operaciones CRUD con proveedores en Supabase
 */

import { supabase } from './supabase';

const TABLE_NAME = 'suppliers';

/**
 * Obtiene todos los proveedores activos (no eliminados)
 */
export async function getSuppliers() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('eliminado', false)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(`Error al obtener proveedores: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene un proveedor por su ID
 */
export async function getSupplierById(id) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .eq('eliminado', false)
    .single();

  if (error) {
    throw new Error(`Error al obtener proveedor: ${error.message}`);
  }

  return data;
}

/**
 * Crea un nuevo proveedor
 */
export async function createSupplier(supplierData) {
  const supplier = {
    nombre: String(supplierData.nombre || ''),
    contacto: String(supplierData.contacto || ''),
    telefono: String(supplierData.telefono || ''),
    email: String(supplierData.email || ''),
    direccion: String(supplierData.direccion || ''),
    notas: String(supplierData.notas || ''),
    eliminado: false, // Boolean, NO string - importante para RLS
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([supplier])
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear proveedor: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza un proveedor existente
 */
export async function updateSupplier(id, supplierData) {
  const updates = {
    nombre: String(supplierData.nombre || ''),
    contacto: String(supplierData.contacto || ''),
    telefono: String(supplierData.telefono || ''),
    email: String(supplierData.email || ''),
    direccion: String(supplierData.direccion || ''),
    notas: String(supplierData.notas || ''),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar proveedor: ${error.message}`);
  }

  return data;
}

/**
 * Elimina un proveedor (soft delete - solo marca como eliminado)
 */
export async function deleteSupplier(id) {
  // Método 1: Intentar con función almacenada (bypass RLS)
  try {
    const { data, error } = await supabase.rpc('soft_delete_supplier', {
      supplier_id: id,
    });

    if (!error && data) {
      return data;
    }
  } catch (rpcError) {
    console.warn('Función RPC no disponible, usando método directo:', rpcError);
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
    
    console.error('Error al eliminar proveedor:', errorDetails);
    
    if (error.message?.includes('row-level security') || error.code === '42501') {
      throw new Error(
        'Error de permisos RLS. Verifica las políticas de seguridad. ' +
        `Detalles: ${error.message || error.details || 'Error desconocido'}`
      );
    }
    
    throw new Error(
      `Error al eliminar proveedor: ${error.message || error.details || 'Error desconocido'}`
    );
  }

  return data;
}

/**
 * Obtiene los productos asociados a un proveedor
 * @param {string} supplierId - ID del proveedor
 */
export async function getSupplierProducts(supplierId) {
  const { data, error } = await supabase
    .from('product_suppliers')
    .select(`
      product_id,
      products (
        id,
        nombre,
        precio,
        formato,
        referencia,
        stock,
        nivel_reordenado,
        eliminado
      )
    `)
    .eq('supplier_id', supplierId);

  if (error) {
    throw new Error(`Error al obtener productos del proveedor: ${error.message}`);
  }

  // Filtrar productos eliminados y transformar los datos
  return data
    .filter(ps => ps.products && !ps.products.eliminado)
    .map(ps => ps.products);
}

