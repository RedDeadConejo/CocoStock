/**
 * Servicio de control de versiones
 * Verifica la versión mínima requerida desde Supabase
 */

import { supabase } from './supabase';
import { APP_VERSION, compareVersions } from '../constants/version';

/**
 * Obtiene la versión mínima requerida desde Supabase
 * @returns {Promise<string|null>} - Versión mínima requerida o null si hay error
 */
export async function getMinimumRequiredVersion() {
  try {
    // Intentar obtener desde la tabla app_version
    // La política RLS permite lectura a usuarios autenticados, pero también intentamos sin autenticación
    const { data, error } = await supabase
      .from('app_version')
      .select('minimum_version')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // Usar maybeSingle en lugar de single para evitar error si no hay datos

    if (error) {
      // Si la tabla no existe o hay error de permisos, devolver null (no bloquear)
      if (error.code === 'PGRST116' ||
          error.code === 'PGRST205' || // Tabla no encontrada en el schema cache
          error.code === '42P01' ||
          error.code === 'PGRST301' ||
          error.code === '42501' || // Insufficient privilege
          error.message?.includes('permission') ||
          error.message?.includes('policy') ||
          error.message?.includes('row-level security') ||
          error.message?.includes('Could not find the table')) {
        console.warn('Tabla app_version no accesible o no configurada. El control de versiones no está activo.');
        return null;
      }
      console.error('Error al obtener versión mínima:', error);
      return null;
    }

    return data?.minimum_version || null;
  } catch (error) {
    // Tabla inexistente o error de red: no bloquear ni llenar consola al cerrar sesión
    const isTableMissing = error?.code === 'PGRST205' || error?.message?.includes('Could not find the table');
    if (!isTableMissing) console.error('Error al obtener versión mínima requerida:', error);
    return null;
  }
}

/**
 * Verifica si la versión actual es compatible
 * @param {string} currentVersion - Versión actual de la app (opcional, usa APP_VERSION por defecto)
 * @returns {Promise<{isValid: boolean, minimumVersion: string|null, currentVersion: string}>}
 */
export async function checkVersion(currentVersion = APP_VERSION) {
  try {
    const minimumVersion = await getMinimumRequiredVersion();

    // Si no hay versión mínima configurada, permitir acceso
    if (!minimumVersion) {
      return {
        isValid: true,
        minimumVersion: null,
        currentVersion,
      };
    }

    // Comparar versiones
    const isValid = compareVersions(currentVersion, minimumVersion) >= 0;

    return {
      isValid,
      minimumVersion,
      currentVersion,
    };
  } catch (error) {
    console.error('Error al verificar versión:', error);
    // En caso de error, permitir acceso para no bloquear usuarios
    return {
      isValid: true,
      minimumVersion: null,
      currentVersion,
    };
  }
}

