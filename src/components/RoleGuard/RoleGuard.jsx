/**
 * Componente RoleGuard
 * Protege secciones o componentes según el cargo del usuario
 */

import React, { useState, useEffect } from 'react';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';

/**
 * RoleGuard - Protege contenido según el cargo del usuario
 * @param {Object} props
 * @param {string|string[]} props.allowedRoles - Cargo(s) permitido(s)
 * @param {React.ReactNode} props.children - Contenido a mostrar si tiene acceso
 * @param {React.ReactNode} props.fallback - Contenido a mostrar si no tiene acceso (opcional)
 * @param {string} props.userId - ID del usuario actual
 */
function RoleGuard({ allowedRoles, children, fallback = null, userId }) {
  const { roleName, loading } = useRole(userId);

  // Calcular acceso de forma sincrónica basado en el estado cargado
  const hasAccess = React.useMemo(() => {
    // Si está cargando, asumir acceso temporalmente (optimistic rendering)
    // Esto evita que la pantalla se quede en negro
    if (loading) {
      return true; // Permitir acceso mientras carga
    }

    if (!roleName || !userId) {
      console.warn('[RoleGuard] No hay roleName o userId:', { roleName, userId, loading });
      return false;
    }

    // Normalizar para comparación (por si acaso hay espacios o mayúsculas)
    const normalizedRoleName = String(roleName || '').trim().toLowerCase();
    const normalizedAdminRole = String(ROLES.ADMIN || '').trim().toLowerCase();
    
    // Si es admin, siempre tiene acceso
    if (normalizedRoleName === normalizedAdminRole || roleName === ROLES.ADMIN) {
      console.log('[RoleGuard] ✅ Admin detectado, acceso permitido automáticamente:', { 
        roleName, 
        normalizedRoleName,
        ROLES_ADMIN: ROLES.ADMIN,
        normalizedAdminRole,
        allowedRoles 
      });
      return true;
    }

    // Verificar si el cargo está en los permitidos
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // Comparación directa (los roles ya están en el formato correcto)
    const access = rolesArray.includes(roleName);
    
    // Log de depuración (solo si no tiene acceso para no saturar la consola)
    if (!access) {
      console.warn('[RoleGuard] ❌ Acceso denegado:', {
        roleName,
        normalizedRoleName,
        roleNameType: typeof roleName,
        allowedRoles: rolesArray,
        allowedRolesTypes: rolesArray.map(r => typeof r),
        userId,
        loading,
        isAdmin: normalizedRoleName === normalizedAdminRole,
        // Información adicional para debugging
        roleNameValue: JSON.stringify(roleName),
        allowedRolesValues: rolesArray.map(r => JSON.stringify(r)),
        // Verificar si el problema es que el cache tiene un valor incorrecto
        cacheIssue: normalizedRoleName !== normalizedAdminRole && rolesArray.includes(ROLES.ADMIN)
      });
      
      // Si el usuario debería ser admin pero no lo es, intentar forzar recarga
      if (normalizedRoleName !== normalizedAdminRole && rolesArray.includes(ROLES.ADMIN) && userId) {
        console.warn('[RoleGuard] Posible problema de cache: usuario debería ser admin pero tiene', roleName);
        // Disparar evento para forzar verificación
        window.dispatchEvent(new CustomEvent('forceRoleReload', { 
          detail: { userId, expectedRole: ROLES.ADMIN } 
        }));
      }
    }
    
    return access;
  }, [loading, roleName, userId, allowedRoles]);

  // Si está cargando, mostrar el contenido (optimistic rendering)
  // Esto evita que se muestre el fallback mientras se carga el rol
  if (loading) {
    return children;
  }

  // Si no tiene acceso después de cargar, mostrar fallback
  if (!hasAccess) {
    console.warn('[RoleGuard] Acceso denegado, mostrando fallback:', {
      roleName,
      allowedRoles,
      userId,
      loading,
      isAdmin: roleName === ROLES.ADMIN
    });
    return fallback;
  }

  // Si tiene acceso, mostrar el contenido
  return children;
}

/**
 * Helper para verificar permisos específicos
 */
function PermissionGuard({ permission, children, fallback = null, userId }) {
  const { hasPermission, loading } = useRole(userId);
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!userId) {
      setHasAccess(false);
      setChecking(false);
      return;
    }

    const verify = async () => {
      setChecking(true);
      
      // Verificar permiso de forma sincrónica usando el estado cargado
      const result = hasPermission(permission);
      setHasAccess(result);
      setChecking(false);
    };

    verify();
  }, [userId, permission, hasPermission]);

  if (loading || checking) {
    return null;
  }

  if (!hasAccess) {
    return fallback;
  }

  return children;
}

export default RoleGuard;
export { PermissionGuard };
export { ROLES };
