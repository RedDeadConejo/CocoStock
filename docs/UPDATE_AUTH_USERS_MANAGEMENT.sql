-- Actualización de la función get_all_users_with_profiles()
-- Este script actualiza la función para incluir restaurant_id
-- IMPORTANTE: Ejecuta este script si ya tienes la función creada

-- ============================================
-- ACTUALIZAR FUNCIÓN PARA INCLUIR restaurant_id
-- ============================================

-- Primero eliminar la función existente
DROP FUNCTION IF EXISTS get_all_users_with_profiles();

-- Recrear la función con restaurant_id incluido
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
-- VERIFICACIÓN
-- ============================================

-- Verificar que la función se creó correctamente
-- Puedes ejecutar esto para verificar:
-- SELECT proname, proargtypes FROM pg_proc WHERE proname = 'get_all_users_with_profiles';
