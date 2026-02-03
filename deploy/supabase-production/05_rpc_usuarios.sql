-- ============================================
-- CocoStock Producción - 05: RPC Usuarios (Auth)
-- ============================================
-- get_all_users_with_profiles: lista usuarios con perfiles (solo admin)

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin') THEN
    RAISE EXCEPTION 'Solo los administradores pueden ver todos los usuarios';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.created_at, u.last_sign_in_at,
    COALESCE(up.role_name, 'tienda')::VARCHAR(50), up.full_name, up.phone, up.restaurant_id, up.created_at
  FROM auth.users u
  LEFT JOIN user_profiles up ON u.id = up.id
  ORDER BY u.created_at DESC;
END; $$;

GRANT EXECUTE ON FUNCTION get_all_users_with_profiles() TO authenticated;
