/**
 * Servicio de Restaurantes
 * Maneja todas las operaciones CRUD con restaurantes en Supabase
 */

import { supabase } from './supabase';

const TABLE_NAME = 'restaurants';

/**
 * Obtiene todos los restaurantes activos (no eliminados)
 */
export async function getRestaurants() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('eliminado', false)
    .order('nombre', { ascending: true });

  if (error) {
    throw new Error(`Error al obtener restaurantes: ${error.message}`);
  }

  return data;
}

/**
 * Obtiene un restaurante por su ID
 */
export async function getRestaurantById(id) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .eq('eliminado', false)
    .single();

  if (error) {
    throw new Error(`Error al obtener restaurante: ${error.message}`);
  }

  return data;
}

/**
 * Crea un nuevo restaurante
 */
export async function createRestaurant(restaurantData) {
  const restaurant = {
    nombre: String(restaurantData.nombre || ''),
    direccion: String(restaurantData.direccion || ''),
    telefono: String(restaurantData.telefono || ''),
    email: String(restaurantData.email || ''),
    notas: String(restaurantData.notas || ''),
    eliminado: false, // Boolean, NO string - importante para RLS
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([restaurant])
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear restaurante: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza un restaurante existente
 */
export async function updateRestaurant(id, restaurantData) {
  const updates = {
    nombre: String(restaurantData.nombre || ''),
    direccion: String(restaurantData.direccion || ''),
    telefono: String(restaurantData.telefono || ''),
    email: String(restaurantData.email || ''),
    notas: String(restaurantData.notas || ''),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar restaurante: ${error.message}`);
  }

  return data;
}

/**
 * Elimina un restaurante (soft delete - solo marca como eliminado)
 */
export async function deleteRestaurant(id) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ eliminado: true })
    .eq('id', id)
    .eq('eliminado', false)
    .select()
    .single();

  if (error) {
    const errorDetails = {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    };
    
    console.error('Error al eliminar restaurante:', errorDetails);
    
    if (error.message?.includes('row-level security') || error.code === '42501') {
      throw new Error(
        'Error de permisos RLS. Verifica las políticas de seguridad. ' +
        `Detalles: ${error.message || error.details || 'Error desconocido'}`
      );
    }
    
    throw new Error(
      `Error al eliminar restaurante: ${error.message || error.details || 'Error desconocido'}`
    );
  }

  return data;
}

/**
 * Obtiene el restaurante de un usuario
 */
export async function getUserRestaurant(userId) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('restaurant_id')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Error al obtener restaurante del usuario: ${error.message}`);
  }

  if (!profile?.restaurant_id) {
    return null;
  }

  return await getRestaurantById(profile.restaurant_id);
}

/**
 * Asigna un restaurante a un usuario
 */
export async function assignRestaurantToUser(userId, restaurantId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ restaurant_id: restaurantId || null })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al asignar restaurante: ${error.message}`);
  }

  return data;
}
