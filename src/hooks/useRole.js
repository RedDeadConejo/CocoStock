/**
 * Hook personalizado para manejar cargos y permisos
 * Gestiona el estado del cargo del usuario y sus permisos
 */

import { useState, useEffect } from 'react';
import { getUserProfile, getUserRole, hasPermission, hasRole, hasAnyRole, ROLES } from '../services/roles';

// Cache simple para evitar múltiples consultas del mismo usuario
const roleCache = new Map();
const loadingUsers = new Set();

// Listeners para notificar cambios de rol a todos los componentes
const roleUpdateListeners = new Set();

/**
 * Notifica a todos los listeners que el rol cambió
 */
function notifyRoleUpdate(userId, newRole, oldRole) {
  roleUpdateListeners.forEach(listener => {
    try {
      listener({ userId, newRole, oldRole });
    } catch (err) {
      console.error('[useRole] Error en listener:', err);
    }
  });
}

/**
 * Suscribe un listener a cambios de rol
 */
export function subscribeToRoleUpdates(listener) {
  roleUpdateListeners.add(listener);
  return () => roleUpdateListeners.delete(listener);
}

/**
 * Limpia el cache de roles (útil para forzar recarga)
 */
export function clearRoleCache(userId = null) {
  if (userId) {
    roleCache.delete(userId);
    console.log('[useRole] Cache limpiado para usuario:', userId);
  } else {
    roleCache.clear();
    console.log('[useRole] Cache limpiado completamente');
  }
}

export function useRole(userId) {
  const [roleName, setRoleName] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Escuchar eventos de actualización de rol y cambios en el cache
  useEffect(() => {
    if (!userId) return;
    
    const handleRoleUpdate = ({ userId: updatedUserId, newRole, oldRole }) => {
      if (updatedUserId === userId) {
        console.log('[useRole] Rol actualizado, sincronizando estado:', { newRole, oldRole });
        // Actualizar estado inmediatamente
        setRoleName(newRole);
        // Limpiar cache y forzar recarga completa
        roleCache.delete(userId);
        // Recargar el rol completo
        const loadUserRole = async () => {
          try {
            const userProfile = await getUserProfile(userId);
            const newRoleName = userProfile.role_name || ROLES.RESTAURANTE;
            setRoleName(newRoleName);
            setPermissions(userProfile.permissions || {});
            setProfile(userProfile);
            roleCache.set(userId, {
              roleName: newRoleName,
              permissions: userProfile.permissions || {},
              profile: userProfile,
              timestamp: Date.now()
            });
          } catch (err) {
            console.error('[useRole] Error al recargar rol:', err);
          }
        };
        loadUserRole();
      }
    };
    
    const handleForceReload = (event) => {
      if (event.detail.userId === userId) {
        console.log('[useRole] Forzando recarga de rol:', event.detail);
        // Limpiar cache inmediatamente
        roleCache.delete(userId);
        // Forzar recarga
        const loadUserRole = async () => {
          try {
            setLoading(true);
            const userProfile = await getUserProfile(userId);
            const newRoleName = userProfile.role_name || ROLES.RESTAURANTE;
            console.log('[useRole] Rol recargado desde DB:', newRoleName);
            setRoleName(newRoleName);
            setPermissions(userProfile.permissions || {});
            setProfile(userProfile);
            roleCache.set(userId, {
              roleName: newRoleName,
              permissions: userProfile.permissions || {},
              profile: userProfile,
              timestamp: Date.now()
            });
            setLoading(false);
          } catch (err) {
            console.error('[useRole] Error al forzar recarga de rol:', err);
            setLoading(false);
          }
        };
        loadUserRole();
      }
    };
    
    // Suscribirse a actualizaciones
    const unsubscribe = subscribeToRoleUpdates(handleRoleUpdate);
    
    // Escuchar eventos del navegador
    const roleUpdatedHandler = (event) => {
      if (event.detail.userId === userId) {
        handleRoleUpdate(event.detail);
      }
    };
    
    const forceReloadHandler = (event) => {
      handleForceReload(event);
    };
    
    window.addEventListener('roleUpdated', roleUpdatedHandler);
    window.addEventListener('forceRoleReload', forceReloadHandler);
    
    return () => {
      unsubscribe();
      window.removeEventListener('roleUpdated', roleUpdatedHandler);
      window.removeEventListener('forceRoleReload', forceReloadHandler);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setRoleName(null);
      setPermissions({});
      setProfile(null);
      return;
    }

    // Si ya tenemos el rol en cache, usar esos datos
    // PERO verificar si el cache está desactualizado
    const cached = roleCache.get(userId);
    if (cached) {
      const cacheAge = Date.now() - (cached.timestamp || 0);
      const MAX_CACHE_AGE = 2 * 60 * 1000; // 2 minutos (reducido para evitar problemas)
      
      if (cacheAge > MAX_CACHE_AGE) {
        // Cache muy viejo, limpiar y recargar
        roleCache.delete(userId);
        console.log('[useRole] Cache expirado, recargando...');
      } else {
        // Usar cache pero verificar que sea consistente
        const cachedRole = cached.roleName;
        console.log('[useRole] Usando cache:', {
          roleName: cachedRole,
          cacheAge: Math.round(cacheAge / 1000) + 's',
          userId,
          timestamp: new Date(cached.timestamp).toISOString(),
          isAdmin: cachedRole === ROLES.ADMIN
        });
        
        // IMPORTANTE: Si el cache tiene un rol que no es admin, pero estamos en una zona de admin,
        // verificar en DB antes de usar el cache (para evitar problemas de sincronización)
        // Esto es una verificación de seguridad adicional
        if (cachedRole !== ROLES.ADMIN && cacheAge < 30 * 1000) {
          // Si el cache es reciente (< 30 segundos) y no es admin, verificar en DB
          // pero solo si no hay otra verificación en curso
          console.warn('[useRole] Cache tiene rol no-admin reciente, verificando en DB...');
          // No bloquear, usar cache pero disparar verificación en background
          const verifyInBackground = async () => {
            try {
              const userProfile = await getUserProfile(userId);
              const dbRole = userProfile?.role_name || ROLES.RESTAURANTE;
              if (dbRole === ROLES.ADMIN && cachedRole !== ROLES.ADMIN) {
                console.warn('[useRole] ⚠️ Discrepancia detectada: DB tiene admin pero cache tiene', cachedRole);
                // Limpiar cache y actualizar
                roleCache.delete(userId);
                setRoleName(dbRole);
                setPermissions(userProfile.permissions || {});
                setProfile(userProfile);
                roleCache.set(userId, {
                  roleName: dbRole,
                  permissions: userProfile.permissions || {},
                  profile: userProfile,
                  timestamp: Date.now()
                });
                // Notificar a otros componentes
                notifyRoleUpdate(userId, dbRole, cachedRole);
                window.dispatchEvent(new CustomEvent('roleUpdated', { 
                  detail: { userId, newRole: dbRole, oldRole: cachedRole } 
                }));
              }
            } catch (err) {
              console.error('[useRole] Error en verificación en background:', err);
            }
          };
          verifyInBackground();
        }
        
        setRoleName(cachedRole);
        setPermissions(cached.permissions);
        setProfile(cached.profile);
        setLoading(false);
        return;
      }
    }

    let cancelled = false;
    
    // Si ya estamos cargando este usuario, esperar a que termine
    if (loadingUsers.has(userId)) {
      // Esperar y verificar si ya se cargó en cache
      const checkCache = setInterval(() => {
        if (cancelled) {
          clearInterval(checkCache);
          return;
        }
        
        const cached = roleCache.get(userId);
        if (cached) {
          clearInterval(checkCache);
          setRoleName(cached.roleName);
          setPermissions(cached.permissions);
          setProfile(cached.profile);
          setLoading(false);
        } else if (!loadingUsers.has(userId)) {
          // Si ya no está cargando pero no hay cache, usar valores por defecto
          clearInterval(checkCache);
          const defaultRole = ROLES.RESTAURANTE;
          setRoleName(defaultRole);
          setPermissions({});
          setLoading(false);
        }
      }, 50);
      
      // Timeout después de 3 segundos para evitar esperar indefinidamente
      const timeout = setTimeout(() => {
        clearInterval(checkCache);
        if (!cancelled) {
          // Si después de 3 segundos todavía está cargando, usar valores por defecto
          const defaultRole = ROLES.RESTAURANTE;
          setRoleName(defaultRole);
          setPermissions({});
          setLoading(false);
        }
      }, 3000);
      
      return () => {
        cancelled = true;
        clearInterval(checkCache);
        clearTimeout(timeout);
      };
    }

    loadingUsers.add(userId);

    const loadUserRole = async () => {
      setLoading(true);
      setError(null);

      try {
        // Solo hacer una consulta (getUserProfile ya incluye todo)
        const userProfile = await getUserProfile(userId);

        if (cancelled) return;

        const newRoleName = userProfile.role_name || ROLES.RESTAURANTE;
        
        // Log de depuración detallado
        console.log('[useRole] Perfil cargado desde DB:', {
          userId,
          roleName: newRoleName,
          profileRoleName: userProfile.role_name,
          profileId: userProfile?.id,
          isAdmin: newRoleName === ROLES.ADMIN,
          timestamp: new Date().toISOString()
        });
        
        // Limpiar cache anterior si existe y el rol cambió
        const oldCached = roleCache.get(userId);
        if (oldCached && oldCached.roleName !== newRoleName) {
          console.warn('[useRole] ⚠️ Rol cambió en DB, limpiando cache antiguo:', {
            oldRole: oldCached.roleName,
            newRole: newRoleName,
            userId,
            oldCachedTimestamp: new Date(oldCached.timestamp).toISOString()
          });
        }
        
        // IMPORTANTE: Si el rol en DB es admin pero el cache tenía otro valor, forzar actualización
        if (newRoleName === ROLES.ADMIN && oldCached && oldCached.roleName !== ROLES.ADMIN) {
          console.error('[useRole] 🚨 CRÍTICO: DB tiene admin pero cache tenía', oldCached.roleName);
          console.error('[useRole] Forzando actualización inmediata de todos los componentes...');
        }
        
        // Guardar en cache con timestamp
        const cachedData = {
          roleName: newRoleName,
          permissions: userProfile.permissions || {},
          profile: userProfile,
          timestamp: Date.now()
        };
        roleCache.set(userId, cachedData);
        
        // Notificar a otros componentes que el rol cambió (si cambió)
        if (oldCached && oldCached.roleName !== newRoleName) {
          console.warn('[useRole] 🔄 Rol cambió, notificando a todos los listeners:', {
            userId,
            oldRole: oldCached.roleName,
            newRole: newRoleName
          });
          notifyRoleUpdate(userId, newRoleName, oldCached.roleName);
          // También disparar evento del navegador por compatibilidad
          window.dispatchEvent(new CustomEvent('roleUpdated', { 
            detail: { userId, newRole: newRoleName, oldRole: oldCached.roleName } 
          }));
        }
        
        // Si el rol cargado es diferente al esperado, log de advertencia
        if (newRoleName !== userProfile.role_name) {
          console.warn('[useRole] ⚠️ Discrepancia en rol:', {
            roleName: newRoleName,
            profileRoleName: userProfile.role_name,
            userId
          });
        }

        // Actualizar estado inmediatamente
        setProfile(userProfile);
        setRoleName(newRoleName);
        setPermissions(userProfile.permissions || {});
        
        // Si el nuevo rol es admin, asegurarse de que todos los componentes se actualicen
        if (newRoleName === ROLES.ADMIN) {
          console.log('[useRole] ✅ Rol admin confirmado, estado actualizado');
        }
      } catch (err) {
        if (cancelled) return;
        
        console.error('[useRole] Error al cargar cargo de usuario:', err);
        
        // No cerrar sesión por errores de carga de rol
        // Solo loguear el error y usar valores por defecto
        setError(err.message || 'Error desconocido al cargar rol');
        
        // Valores por defecto (pero no cachear errores para permitir reintentos)
        const defaultRole = ROLES.RESTAURANTE;
        setRoleName(defaultRole);
        setPermissions({});
        
        // Solo cachear si el error no es crítico (no cachear errores de permisos)
        const isCriticalError = err.code === '42501' || err.message?.includes('permission denied') || err.message?.includes('policy');
        if (!isCriticalError) {
          roleCache.set(userId, {
            roleName: defaultRole,
            permissions: {},
            profile: null,
            timestamp: Date.now()
          });
        } else {
          // Si es un error de permisos, limpiar cache para permitir reintentos
          roleCache.delete(userId);
          console.warn('[useRole] Error de permisos detectado, cache limpiado para permitir reintentos');
        }
      } finally {
        loadingUsers.delete(userId);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadUserRole();

    // Cleanup para evitar actualizaciones después de desmontar
    return () => {
      cancelled = true;
      loadingUsers.delete(userId);
    };
  }, [userId]);

  /**
   * Verifica si el usuario tiene un cargo específico
   */
  const checkRole = async (roleNameToCheck) => {
    if (!userId) return false;
    try {
      return await hasRole(userId, roleNameToCheck);
    } catch (err) {
      console.error('Error al verificar cargo:', err);
      return false;
    }
  };

  /**
   * Verifica si el usuario tiene alguno de los cargos especificados
   */
  const checkAnyRole = async (roleNames) => {
    if (!userId) return false;
    try {
      return await hasAnyRole(userId, roleNames);
    } catch (err) {
      console.error('Error al verificar cargos:', err);
      return false;
    }
  };

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const checkPermission = async (permission) => {
    if (!userId) return false;
    try {
      return await hasPermission(userId, permission);
    } catch (err) {
      console.error('Error al verificar permiso:', err);
      return false;
    }
  };

  /**
   * Verifica si el usuario puede acceder (por cargo o permiso)
   */
  const canAccess = async (requiredRolesOrPermissions) => {
    if (!userId) return false;
    
    // Si es admin, siempre puede acceder
    if (roleName === ROLES.ADMIN) {
      return true;
    }

    // Si es un array de cargos
    if (Array.isArray(requiredRolesOrPermissions)) {
      return await checkAnyRole(requiredRolesOrPermissions);
    }

    // Si es un solo cargo
    if (typeof requiredRolesOrPermissions === 'string') {
      if (requiredRolesOrPermissions in ROLES) {
        return await checkRole(requiredRolesOrPermissions);
      }
      // Si no es un cargo conocido, asumir que es un permiso
      return await checkPermission(requiredRolesOrPermissions);
    }

    return false;
  };

  // Helpers sincrónicos basados en el estado actual
  const isAdmin = roleName === ROLES.ADMIN;
  const isAlmacen = roleName === ROLES.ALMACEN;
  const isRestaurante = roleName === ROLES.RESTAURANTE;
  
  // Verificar permisos sincrónicamente (basado en estado cargado)
  const hasPermissionSync = (permission) => {
    if (isAdmin) return true;
    return permissions[permission] === true;
  };

  return {
    roleName,
    permissions,
    profile,
    loading,
    error,
    checkRole,
    checkAnyRole,
    checkPermission,
    canAccess,
    hasPermission: hasPermissionSync,
    // Helpers rápidos
    isAdmin,
    isAlmacen,
    isRestaurante,
  };
}
