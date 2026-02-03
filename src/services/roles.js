/**
 * Servicio de Roles/Cargos
 * Gestiona cargos y permisos de usuarios basado en funciones
 */

import { supabase } from './supabase';

const ROLES_TABLE = 'user_roles';
const PROFILES_TABLE = 'user_profiles';

/**
 * Cargos disponibles en el sistema
 */
export const ROLES = {
  ADMIN: 'admin',
  ALMACEN: 'almacen',
  RESTAURANTE: 'restaurante',
};

/**
 * Descripción de los cargos (se completan con los roles de la BD; aquí solo valores por defecto)
 */
export const ROLE_DESCRIPTIONS = {
  admin: 'Administrador - Acceso completo',
  almacen: 'Almacén - Gestión de stock e inventario',
  restaurante: 'Restaurante - Gestión de ventas y productos',
};

/**
 * Permisos disponibles en el sistema
 */
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  
  // Inventario
  VIEW_INVENTORY: 'view_inventory',
  EDIT_INVENTORY: 'edit_inventory',
  MANAGE_STOCK: 'manage_stock',
  
  // Proveedores
  MANAGE_SUPPLIERS: 'manage_suppliers',
  
  // Estadísticas
  VIEW_STATISTICS: 'view_statistics',
  EDIT_STATISTICS: 'edit_statistics',
  
  // Administración
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
};

/**
 * Crea un perfil para el usuario si no existe
 */
async function createProfileIfNotExists(userId) {
  try {
    console.log('[createProfileIfNotExists] Intentando crear perfil para:', userId);
    
    const { data, error: insertError } = await supabase
      .from(PROFILES_TABLE)
      .insert([{
        id: userId,
        role_name: ROLES.RESTAURANTE,
      }])
      .select();

    // Si ya existe, ignorar el error
    if (insertError) {
      if (insertError.code === '23505') {
        console.log('[createProfileIfNotExists] El perfil ya existe');
      } else {
        console.error('[createProfileIfNotExists] Error al crear perfil:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
      }
    } else {
      console.log('[createProfileIfNotExists] Perfil creado exitosamente:', data);
    }
  } catch (err) {
    console.error('[createProfileIfNotExists] Excepción al crear perfil:', err);
  }
}

/**
 * Obtiene el perfil del usuario actual con su cargo
 */
export async function getUserProfile(userId) {
  if (!userId) {
    return {
      role_name: ROLES.RESTAURANTE,
      permissions: {},
    };
  }

  // Intentar obtener el perfil (sin .single() para evitar error si no existe)
  let profileData = null;
  let profileError = null;
  
  try {
    const { data: profileDataArray, error: error } = await supabase
      .from(PROFILES_TABLE)
      .select('*')
      .eq('id', userId)
      .limit(1);

    profileError = error;

    // Si no hay error y hay datos, usar el primer resultado
    if (!profileError && profileDataArray && profileDataArray.length > 0) {
      profileData = profileDataArray[0];
    } else if (profileError) {
      // Log detallado del error
      console.error('[getUserProfile] Error al obtener perfil:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        userId
      });

      // Si hay error 500, puede ser un problema de RLS
      if (profileError.code === '42501' || profileError.message?.includes('permission denied') || profileError.message?.includes('policy')) {
        console.error('[getUserProfile] Error de permisos RLS. Verifica las políticas de user_profiles.');
        // Intentar crear el perfil de todas formas
      }

      // Verificar si es porque no existe el perfil
      const isNotFoundError = 
        profileError.code === 'PGRST116' || 
        profileError.message?.includes('0 rows') ||
        profileError.message?.includes('Cannot coerce') ||
        (profileError.code && profileError.code.includes('406')) ||
        profileError.code === '42501'; // Permission denied también puede significar que no existe

      if (isNotFoundError || !profileData) {
        // El perfil no existe o no se puede acceder, intentar crearlo
        console.log('[getUserProfile] Perfil no existe o no accesible, intentando crear...');
        await createProfileIfNotExists(userId);
        
        // Esperar un momento para que se cree
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Intentar obtener de nuevo después de crear
        const { data: retryData, error: retryError } = await supabase
          .from(PROFILES_TABLE)
          .select('*')
          .eq('id', userId)
          .limit(1);
        
        if (!retryError && retryData && retryData.length > 0) {
          profileData = retryData[0];
          console.log('[getUserProfile] Perfil creado y obtenido exitosamente');
        } else {
          console.warn('[getUserProfile] No se pudo crear/obtener el perfil después del intento:', retryError);
        }
      }
    }
  } catch (err) {
    console.error('[getUserProfile] Excepción al obtener perfil:', err);
    profileError = err;
  }

  // Si aún no hay perfil, usar valores por defecto
  if (!profileData) {
    console.warn('[getUserProfile] No se encontró perfil para usuario:', userId);
    return {
      id: userId,
      role_name: ROLES.RESTAURANTE,
      permissions: {},
    };
  }

  const roleName = profileData?.role_name || ROLES.RESTAURANTE;
  
  // Log de depuración
  console.log('[getUserProfile] Perfil encontrado:', {
    userId,
    roleName,
    profileData,
    isAdmin: roleName === ROLES.ADMIN
  });

  // Obtener los permisos del cargo
  const { data: roleDataArray, error: roleError } = await supabase
    .from(ROLES_TABLE)
    .select('*')
    .eq('role_name', roleName)
    .limit(1);

  if (roleError || !roleDataArray || roleDataArray.length === 0) {
    console.warn('Error al obtener datos del cargo:', roleError);
    return {
      ...profileData,
      role_name: roleName,
      permissions: {},
    };
  }

  const roleData = roleDataArray[0];

  return {
    ...profileData,
    role_name: roleName,
    permissions: roleData?.permissions || {},
  };
}

/**
 * Obtiene el cargo del usuario actual
 */
export async function getUserRole(userId) {
  try {
    const profile = await getUserProfile(userId);
    return profile.role_name || ROLES.RESTAURANTE;
  } catch (error) {
    console.error('Error al obtener cargo:', error);
    return ROLES.RESTAURANTE; // Cargo por defecto
  }
}

/**
 * Verifica si el usuario tiene un cargo específico
 */
export async function hasRole(userId, roleName) {
  const userRole = await getUserRole(userId);
  return userRole === roleName;
}

/**
 * Verifica si el usuario tiene alguno de los cargos especificados
 */
export async function hasAnyRole(userId, roleNames) {
  const userRole = await getUserRole(userId);
  return roleNames.includes(userRole);
}

/**
 * Verifica si el usuario tiene un permiso específico
 */
export async function hasPermission(userId, permission) {
  try {
    const profile = await getUserProfile(userId);
    const permissions = profile.permissions || {};
    
    // Admin siempre tiene todos los permisos
    if (profile.role_name === ROLES.ADMIN) {
      return true;
    }
    
    return permissions[permission] === true;
  } catch (error) {
    console.error('Error al verificar permiso:', error);
    return false;
  }
}

/**
 * Verifica si el usuario tiene todos los permisos especificados
 */
export async function hasAllPermissions(userId, permissionList) {
  for (const permission of permissionList) {
    if (!(await hasPermission(userId, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * Obtiene todos los cargos disponibles
 */
export async function getAllRoles() {
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select('*')
    .order('role_name', { ascending: true });

  if (error) {
    throw new Error(`Error al obtener cargos: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza el cargo de un usuario (solo administradores)
 */
export async function updateUserRole(userId, roleName) {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update({ role_name: roleName })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar cargo: ${error.message}`);
  }

  return data;
}

/**
 * Verifica si el usuario puede acceder a una vista/sección
 */
export async function canAccess(userId, requiredPermissions) {
  // Si es admin, siempre puede acceder
  if (await hasRole(userId, ROLES.ADMIN)) {
    return true;
  }

  // Verificar si tiene todos los permisos requeridos
  if (Array.isArray(requiredPermissions)) {
    return await hasAllPermissions(userId, requiredPermissions);
  }

  // Si es un solo permiso
  return await hasPermission(userId, requiredPermissions);
}

/**
 * Verifica si el usuario puede acceder por cargo
 */
export async function canAccessByRole(userId, allowedRoles) {
  return await hasAnyRole(userId, allowedRoles);
}

