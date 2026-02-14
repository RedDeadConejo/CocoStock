/**
 * Servicio de Gestión de Roles
 * Permite a los administradores gestionar roles, usuarios y permisos
 */

import { supabase } from './supabase';

const ROLES_TABLE = 'user_roles';
const PROFILES_TABLE = 'user_profiles';
const AUTH_TABLE = 'auth.users';

/**
 * Obtiene todos los roles disponibles
 */
export async function getAllRoles() {
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select('*')
    .order('role_name', { ascending: true });

  if (error) {
    throw new Error(`Error al obtener roles: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtiene un rol por su nombre
 */
export async function getRoleByName(roleName) {
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select('*')
    .eq('role_name', roleName)
    .single();

  if (error) {
    throw new Error(`Error al obtener rol: ${error.message}`);
  }

  return data;
}

/**
 * Crea un nuevo rol
 */
export async function createRole(roleData) {
  const { role_name, description, permissions } = roleData;

  if (!role_name) {
    throw new Error('El nombre del rol es requerido');
  }

  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .insert([{
      role_name: role_name.toLowerCase().trim(),
      description: description || '',
      permissions: permissions || {}
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un rol con ese nombre');
    }
    throw new Error(`Error al crear rol: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza un rol existente.
 * Si se cambia role_name: usa RPC rename_role (transacción en Supabase).
 * Si no: actualización directa de descripción/permisos.
 * No se permite renombrar el rol 'admin'.
 */
export async function updateRole(roleName, updates) {
  const { role_name: newRoleName, description, permissions } = updates;
  const newName = newRoleName ? newRoleName.toLowerCase().trim() : null;
  const isRenaming = newName && newName !== roleName;

  if (isRenaming) {
    const current = await getRoleByName(roleName);
    if (!current) {
      throw new Error('Rol no encontrado.');
    }
    const { data, error } = await supabase.rpc('rename_role', {
      p_old_name: roleName,
      p_new_name: newName,
      p_description: description !== undefined ? description : current.description,
      p_permissions: permissions !== undefined ? permissions : (current.permissions || {}),
    });

    if (error) {
      throw new Error(error.message || 'Error al renombrar rol');
    }
    return Array.isArray(data) ? data[0] : data;
  }

  const updateData = {};
  if (description !== undefined) updateData.description = description;
  if (permissions !== undefined) updateData.permissions = permissions;
  if (Object.keys(updateData).length === 0) return (await getRoleByName(roleName)) || null;

  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .update(updateData)
    .eq('role_name', roleName)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar rol: ${error.message}`);
  }
  return data;
}

/**
 * Elimina un rol (solo si no tiene usuarios asignados).
 * Usa RPC delete_role en Supabase para atomicidad.
 */
export async function deleteRole(roleName) {
  const { error } = await supabase.rpc('delete_role', { p_role_name: roleName });

  if (error) {
    throw new Error(error.message || 'Error al eliminar rol');
  }
  return true;
}

/**
 * Obtiene todos los usuarios con sus perfiles y roles
 */
export async function getAllUsers() {
  // Obtener usuarios desde auth.users y sus perfiles
  const { data: profiles, error } = await supabase
    .from(PROFILES_TABLE)
    .select(`
      id,
      role_name,
      full_name,
      phone,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error al obtener usuarios: ${error.message}`);
  }

  // Retornar perfiles directamente
  // Nota: Para obtener emails, se necesitaría una función RPC en Supabase
  // o permisos de administrador de Supabase
  return profiles || [];
}

/**
 * Obtiene todos los usuarios (versión alternativa sin admin)
 */
export async function getAllUsersSimple() {
  const { data: profiles, error } = await supabase
    .from(PROFILES_TABLE)
    .select(`
      id,
      role_name,
      full_name,
      phone,
      restaurant_id,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error al obtener usuarios: ${error.message}`);
  }

  return profiles || [];
}

/**
 * Obtiene todos los usuarios con información de autenticación
 * Usa la función RPC get_all_users_with_profiles
 */
export async function getAllUsersWithAuth() {
  const { data, error } = await supabase.rpc('get_all_users_with_profiles');

  if (error) {
    throw new Error(`Error al obtener usuarios: ${error.message}`);
  }

  return data || [];
}

/**
 * Crea un nuevo usuario en auth.users y su perfil.
 * Usa solo la Edge Function create-user (Supabase); un solo flujo, sin race con el trigger de perfil.
 * Envía explícitamente el JWT de la sesión para evitar 401 en el gateway de Edge Functions.
 */
export async function createUser(userData) {
  const { email, password, role_name, restaurant_id, full_name, phone } = userData;

  if (!email || !password) {
    throw new Error('El email y la contraseña son requeridos');
  }

  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Debes iniciar sesión para crear usuarios. Vuelve a entrar en la app.');
  }
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    session = refreshData.session;
  }

  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      email,
      password,
      role_name: role_name || null,
      restaurant_id: restaurant_id || null,
      full_name: full_name || null,
      phone: phone || null,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    let message = error.message || 'Error al invocar la función de crear usuario';
    const res = error.context;
    if (res && typeof res.json === 'function') {
      try {
        const body = await res.json();
        if (body && typeof body.error === 'string') message = body.error;
      } catch (_) {}
    }
    console.error('[createUser] Error del servidor (400):', message);
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.success || !data?.user) {
    throw new Error('No se pudo crear el usuario');
  }

  const u = data.user;
  return {
    id: u.id,
    email: u.email,
    role_name: u.role_name ?? null,
    full_name: u.full_name ?? null,
    phone: u.phone ?? null,
  };
}

/**
 * Actualiza el rol de un usuario
 */
export async function updateUserRole(userId, newRoleName) {
  // Verificar que el rol existe
  const { data: roleData, error: roleError } = await supabase
    .from(ROLES_TABLE)
    .select('role_name')
    .eq('role_name', newRoleName)
    .single();

  if (roleError || !roleData) {
    throw new Error('El rol especificado no existe');
  }

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update({ role_name: newRoleName })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar rol del usuario: ${error.message}`);
  }

  return data;
}

/**
 * Actualiza el perfil completo de un usuario
 */
export async function updateUserProfile(userId, profileData) {
  const updates = {};
  
  if (profileData.role_name !== undefined) {
    // Verificar que el rol existe
    const { data: roleData, error: roleError } = await supabase
      .from(ROLES_TABLE)
      .select('role_name')
      .eq('role_name', profileData.role_name)
      .single();

    if (roleError || !roleData) {
      throw new Error('El rol especificado no existe');
    }
    updates.role_name = profileData.role_name;
  }
  
  if (profileData.full_name !== undefined) {
    updates.full_name = profileData.full_name || null;
  }
  
  if (profileData.phone !== undefined) {
    updates.phone = profileData.phone || null;
  }
  
  if (profileData.restaurant_id !== undefined) {
    // Si restaurant_id es una cadena vacía, convertirla a null
    updates.restaurant_id = profileData.restaurant_id || null;
  }

  // Si no hay actualizaciones, no hacer nada
  if (Object.keys(updates).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar perfil del usuario: ${error.message}`);
  }

  return data;
}

/**
 * Elimina un usuario (auth + perfil).
 * Requiere la Edge Function delete-user desplegada en Supabase.
 * Solo administradores. No se puede eliminar el propio usuario.
 * Envía explícitamente el JWT de la sesión para evitar 401 en el gateway de Edge Functions.
 * @param {string} userId - UUID del usuario a eliminar
 */
export async function deleteUser(userId) {
  if (!userId) {
    throw new Error('El ID del usuario es requerido');
  }

  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Debes iniciar sesión para eliminar usuarios. Vuelve a entrar en la app.');
  }
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    session = refreshData.session;
  }

  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { userId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    let message = error.message || 'Error al invocar la función de eliminar usuario';
    const res = error.context;
    if (res && typeof res.json === 'function') {
      try {
        const body = await res.json();
        if (body && typeof body.error === 'string') message = body.error;
      } catch (_) {}
    }
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

/** IDs de vistas/pestañas del sistema (deben coincidir con Layout y Sidebar) */
export const VIEW_IDS = [
  'dashboard',
  'inventory',
  'orders',
  'platos',
  'merma',
  'purchases',
  'suppliers',
  'statistics',
  'account',
  'settings',
];

/**
 * Obtiene los permisos disponibles en el sistema
 * Incluye permisos de vista (acceso a pestañas) y permisos de acción
 */
export function getAvailablePermissions() {
  return {
    // Acceso a vistas/pestañas
    view_dashboard: 'Acceso: Inicio',
    dashboard_almacen: 'Ver dashboard de almacén (atajos almacén)',
    dashboard_gestor_almacen: 'Ver dashboard de gestor de almacén (atajos gestor)',
    dashboard_restaurante: 'Ver dashboard de restaurante (atajos restaurante)',
    view_inventory: 'Acceso: Inventario',
    view_orders: 'Acceso: Pedidos',
    view_all_orders: 'Ver todos los pedidos (RLS)',
    create_orders: 'Crear pedidos',
    complete_orders: 'Completar pedidos (restar stock)',
    view_platos: 'Acceso: Platos (solo mi restaurante)',
    view_platos_all: 'Ver/editar platos de todos los restaurantes',
    view_merma: 'Acceso: Merma (solo mi restaurante)',
    view_merma_all: 'Ver/editar mermas de todos',
    view_purchases: 'Acceso: Compras',
    view_all_purchases: 'Ver todas las compras (RLS)',
    create_purchases: 'Crear compras',
    complete_purchases: 'Completar compras (sumar stock)',
    view_suppliers: 'Acceso: Catálogo de proveedores',
    view_statistics: 'Acceso: Estadísticas',
    view_account: 'Acceso: Mi Perfil',
    view_settings: 'Acceso: Configuración',
    view_settings_roles: 'Config: ver pestaña Roles',
    view_settings_users: 'Config: ver pestaña Usuarios',
    view_settings_restaurants: 'Config: ver pestaña Restaurantes',
    view_settings_authorized_ips: 'Config: ver pestaña IPs Autorizadas',
    view_settings_local_servers: 'Config: ver pestaña Servidores locales',
    create_server_merma: 'Crear servidor local tipo Merma',
    create_server_full: 'Crear servidor local tipo App completa',
    // Permisos de acción
    edit_inventory: 'Editar Inventario',
    manage_stock: 'Gestionar Stock',
    manage_suppliers: 'Gestionar catálogo de proveedores',
    edit_statistics: 'Editar Estadísticas',
    manage_users: 'Gestionar Usuarios',
    manage_settings: 'Gestionar Configuración',
    manage_roles: 'Gestionar Roles',
  };
}

/**
 * Obtiene las vistas/secciones disponibles en el sistema
 */
export function getAvailableViews() {
  return {
    dashboard: 'Inicio',
    inventory: 'Inventario',
    orders: 'Pedidos',
    platos: 'Platos del local',
    merma: 'Merma',
    purchases: 'Compras',
    suppliers: 'Catálogo de proveedores',
    statistics: 'Estadísticas',
    account: 'Mi Perfil',
    settings: 'Configuración',
  };
}

/**
 * Construye el mapa de qué roles pueden acceder a cada vista.
 * Se usa en Layout (RoleGuard) y Sidebar (filtrar menú).
 * Usa RPC get_view_permissions_map en Supabase si existe; si no, fallback en cliente.
 * @returns {Promise<Record<string, string[]>>} { viewId: ['admin', 'almacen', ...], ... }
 */
export async function getViewPermissionsMap() {
  try {
    const { data, error } = await supabase.rpc('get_view_permissions_map');
    if (!error && data && typeof data === 'object') {
      return data;
    }
  } catch (_) {
    // RPC no disponible o error: usar lógica en cliente
  }

  const roles = await getAllRoles();
  const map = {};
  VIEW_IDS.forEach((viewId) => {
    map[viewId] = ['admin'];
  });
  roles.forEach((role) => {
    const roleName = role.role_name;
    const permissions = role.permissions || {};
    VIEW_IDS.forEach((viewId) => {
      const permKey = `view_${viewId}`;
      if (permissions[permKey] === true && !map[viewId].includes(roleName)) {
        map[viewId].push(roleName);
      }
    });
  });
  return map;
}
