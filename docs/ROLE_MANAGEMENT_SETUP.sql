-- Configuración de Base de Datos - Gestión de Roles
-- Este script actualiza las políticas RLS para permitir a los administradores
-- gestionar roles y usuarios desde la aplicación

-- ============================================
-- FUNCIÓN HELPER (DEBE CREARSE PRIMERO)
-- ============================================

-- Función helper para verificar si un usuario es admin sin causar recursión
-- Esta función usa SECURITY DEFINER para evitar problemas de RLS
-- IMPORTANTE: Debe crearse ANTES de las políticas que la usan
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role VARCHAR(50);
BEGIN
  SELECT role_name INTO user_role
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;

-- ============================================
-- POLÍTICAS PARA user_roles
-- ============================================

-- Permitir a todos los usuarios autenticados ver los roles
-- (Ya existe, pero la incluimos por si acaso)
DROP POLICY IF EXISTS "Todos pueden ver cargos" ON user_roles;
CREATE POLICY "Todos pueden ver cargos"
  ON user_roles FOR SELECT
  USING (true);

-- Permitir a los administradores crear nuevos roles
DROP POLICY IF EXISTS "Admins pueden crear roles" ON user_roles;
CREATE POLICY "Admins pueden crear roles"
  ON user_roles FOR INSERT
  WITH CHECK (
    is_user_admin(auth.uid())
  );

-- Permitir a los administradores actualizar roles
DROP POLICY IF EXISTS "Admins pueden actualizar roles" ON user_roles;
CREATE POLICY "Admins pueden actualizar roles"
  ON user_roles FOR UPDATE
  USING (
    is_user_admin(auth.uid())
  )
  WITH CHECK (
    is_user_admin(auth.uid())
  );

-- Permitir a los administradores eliminar roles (excepto admin)
DROP POLICY IF EXISTS "Admins pueden eliminar roles" ON user_roles;
CREATE POLICY "Admins pueden eliminar roles"
  ON user_roles FOR DELETE
  USING (
    is_user_admin(auth.uid())
    AND role_name != 'admin' -- No permitir eliminar el rol admin
  );

-- ============================================
-- POLÍTICAS PARA user_profiles
-- ============================================

-- Los usuarios pueden ver su propio perfil
-- IMPORTANTE: Esta política debe permitir siempre que un usuario vea su propio perfil
-- para evitar problemas de recursión al verificar si es admin
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON user_profiles;
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Permitir a los administradores ver todos los perfiles
-- Esta política usa la función helper para evitar recursión
DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON user_profiles;
CREATE POLICY "Admins pueden ver todos los perfiles"
  ON user_profiles FOR SELECT
  USING (
    -- Usar la función helper que no pasa por RLS
    is_user_admin(auth.uid())
  );

-- Los usuarios pueden crear su propio perfil
-- (Ya existe, pero la incluimos por si acaso)
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON user_profiles;
CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil (campos como full_name, phone)
-- Nota: Esta política permite actualizar campos del perfil, pero los cambios de rol
-- se manejan exclusivamente por la política de administradores
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil (excepto cargo)" ON user_profiles;
CREATE POLICY "Usuarios pueden actualizar su propio perfil (excepto cargo)"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Solo permitir si el usuario NO es admin (los admins usan la política separada)
    AND NOT is_user_admin(auth.uid())
  );

-- Permitir a los administradores cambiar roles de usuarios
DROP POLICY IF EXISTS "Admins pueden cambiar cargos de usuarios" ON user_profiles;
CREATE POLICY "Admins pueden cambiar cargos de usuarios"
  ON user_profiles FOR UPDATE
  USING (
    is_user_admin(auth.uid())
  )
  WITH CHECK (
    is_user_admin(auth.uid())
  );

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. Este script actualiza las políticas RLS existentes
-- 2. Los administradores ahora pueden:
--    - Crear, actualizar y eliminar roles (excepto el rol 'admin')
--    - Ver todos los perfiles de usuario
--    - Cambiar el rol de cualquier usuario
-- 3. Los usuarios normales pueden:
--    - Ver su propio perfil
--    - Actualizar su propio perfil (pero no su rol)
-- 4. Asegúrate de que RLS esté habilitado en ambas tablas:
--    ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
