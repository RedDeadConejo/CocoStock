-- Gestión de Usuarios de Autenticación
-- Este script crea funciones RPC para que los administradores puedan
-- ver y crear usuarios en auth.users desde la aplicación

-- ============================================
-- FUNCIÓN PARA OBTENER USUARIOS
-- ============================================

-- Función para obtener todos los usuarios con sus perfiles
-- Solo accesible por administradores
CREATE OR REPLACE FUNCTION get_all_users_with_profiles()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  role_name VARCHAR(50),
  full_name TEXT,
  phone TEXT,
  restaurant_id UUID,
  profile_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verificar que el usuario actual es admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role_name = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden ver todos los usuarios';
  END IF;

  -- Retornar usuarios con sus perfiles
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(up.role_name, 'tienda')::VARCHAR(50) as role_name,
    up.full_name,
    up.phone,
    up.restaurant_id,
    up.created_at as profile_created_at
  FROM auth.users u
  LEFT JOIN user_profiles up ON u.id = up.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION get_all_users_with_profiles() TO authenticated;

-- ============================================
-- FUNCIÓN PARA CREAR USUARIOS
-- ============================================

-- Función para crear un nuevo usuario
-- Solo accesible por administradores
CREATE OR REPLACE FUNCTION create_user_account(
  user_email TEXT,
  user_password TEXT,
  user_role_name VARCHAR(50) DEFAULT 'tienda',
  user_full_name TEXT DEFAULT NULL,
  user_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role_name VARCHAR(50),
  full_name TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_user_id UUID;
  new_user_email TEXT;
BEGIN
  -- Verificar que el usuario actual es admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role_name = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear usuarios';
  END IF;

  -- Verificar que el rol existe
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.role_name = user_role_name
  ) THEN
    RAISE EXCEPTION 'El rol especificado no existe: %', user_role_name;
  END IF;

  -- Verificar que el email no existe
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.email = user_email
  ) THEN
    RAISE EXCEPTION 'Ya existe un usuario con el email: %', user_email;
  END IF;

  -- Crear el usuario en auth.users
  -- Nota: En Supabase, la creación de usuarios debe hacerse desde el cliente
  -- usando supabase.auth.admin.createUser() o desde el dashboard.
  -- Esta función prepara el perfil, pero el usuario debe crearse primero.
  
  -- IMPORTANTE: Esta función asume que el usuario ya fue creado en auth.users
  -- y solo crea/actualiza el perfil. Para crear usuarios completamente,
  -- usa el método del cliente con createUser() que llama a supabase.auth.admin.createUser()
  
  -- Por ahora, lanzamos un error indicando que se debe usar el método del cliente
  RAISE EXCEPTION 'La creación de usuarios debe hacerse desde el cliente de la aplicación usando supabase.auth.admin.createUser(). Esta función RPC solo prepara el perfil después de la creación.';

  -- Crear el perfil del usuario
  INSERT INTO user_profiles (id, role_name, full_name, phone)
  VALUES (new_user_id, user_role_name, user_full_name, user_phone)
  ON CONFLICT (id) DO UPDATE
  SET role_name = user_role_name,
      full_name = COALESCE(user_full_name, user_profiles.full_name),
      phone = COALESCE(user_phone, user_profiles.phone);

  -- Retornar los datos del usuario creado
  RETURN QUERY
  SELECT 
    new_user_id,
    user_email::TEXT,
    user_role_name::VARCHAR(50),
    user_full_name,
    user_phone;
END;
$$;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION create_user_account(TEXT, TEXT, VARCHAR, TEXT, TEXT) TO authenticated;

-- ============================================
-- FUNCIÓN ALTERNATIVA PARA CREAR USUARIOS
-- Si auth.users_admin_create no está disponible
-- ============================================

-- Esta función alternativa usa el método de Supabase para crear usuarios
-- Requiere que se configure correctamente en el dashboard de Supabase
CREATE OR REPLACE FUNCTION create_user_via_supabase(
  user_email TEXT,
  user_password TEXT,
  user_role_name VARCHAR(50) DEFAULT 'tienda',
  user_full_name TEXT DEFAULT NULL,
  user_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verificar que el usuario actual es admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role_name = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear usuarios';
  END IF;

  -- Verificar que el rol existe
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.role_name = user_role_name
  ) THEN
    RAISE EXCEPTION 'El rol especificado no existe: %', user_role_name;
  END IF;

  -- Nota: La creación de usuarios debe hacerse desde el cliente usando
  -- supabase.auth.admin.createUser() o desde el dashboard de Supabase
  -- Esta función solo prepara el perfil para cuando se cree el usuario
  
  RETURN jsonb_build_object(
    'message', 'La creación de usuarios debe hacerse desde el cliente de Supabase',
    'email', user_email,
    'role', user_role_name,
    'full_name', user_full_name,
    'phone', user_phone
  );
END;
$$;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION create_user_via_supabase(TEXT, TEXT, VARCHAR, TEXT, TEXT) TO authenticated;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. La función get_all_users_with_profiles() permite a los administradores
--    ver todos los usuarios con sus perfiles y roles.

-- 2. Para crear usuarios, hay dos opciones:
--    a) Usar supabase.auth.admin.createUser() desde el cliente (recomendado)
--    b) Usar la función create_user_account() si está disponible en tu versión de Supabase

-- 3. Asegúrate de que las políticas RLS estén configuradas correctamente
--    para que los administradores puedan ver y gestionar usuarios.

-- 4. La función create_user_account() requiere que auth.users_admin_create
--    esté disponible en tu instancia de Supabase. Si no está disponible,
--    usa el método del cliente con supabase.auth.admin.createUser().
