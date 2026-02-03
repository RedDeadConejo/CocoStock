-- RPC para Roles y Usuarios (auditoría Supabase)
-- Ejecutar en Supabase SQL Editor después de ROLE_MANAGEMENT_SETUP.sql (usa is_user_admin)
-- Usa user_has_permission() para que cualquier rol con el permiso correspondiente funcione
-- (no solo admin/tienda/almacen fijos).
-- 1. user_has_permission: helper para comprobar permiso del rol del usuario
-- 2. rename_role, delete_role: requieren manage_roles (o rol admin)
-- 3. get_view_permissions_map: mapa view_id -> array de role_name (para Layout/Sidebar)

-- ============================================
-- 0. USER_HAS_PERMISSION (helper reutilizable)
-- ============================================
-- Cualquier RPC que dependa de permisos por rol debe usar esta función.
-- Devuelve true si el usuario es admin O si su rol tiene el permiso en user_roles.permissions.
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name TEXT;
  v_perm_value TEXT;
BEGIN
  IF p_user_id IS NULL OR p_permission_key IS NULL OR trim(p_permission_key) = '' THEN
    RETURN false;
  END IF;

  SELECT up.role_name INTO v_role_name
  FROM user_profiles up
  WHERE up.id = p_user_id;

  IF v_role_name IS NULL THEN
    RETURN false;
  END IF;

  IF v_role_name = 'admin' THEN
    RETURN true;
  END IF;

  SELECT (ur.permissions->>p_permission_key) INTO v_perm_value
  FROM user_roles ur
  WHERE ur.role_name = v_role_name;

  RETURN (v_perm_value = 'true');
END;
$$;

GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT) TO authenticated;

-- ============================================
-- 1. RENAME_ROLE
-- ============================================
CREATE OR REPLACE FUNCTION rename_role(
  p_old_name TEXT,
  p_new_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_permissions JSONB DEFAULT NULL
)
RETURNS SETOF user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_name TEXT := lower(trim(p_new_name));
  v_current user_roles%ROWTYPE;
BEGIN
  IF NOT user_has_permission(auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar roles (se requiere permiso manage_roles)';
  END IF;

  IF p_old_name = 'admin' THEN
    RAISE EXCEPTION 'No se puede cambiar el nombre del rol administrador (admin)';
  END IF;

  IF p_new_name IS NULL OR v_new_name = '' THEN
    RAISE EXCEPTION 'El nombre del rol es requerido';
  END IF;

  IF v_new_name = p_old_name THEN
    -- Solo actualizar descripción/permisos sin renombrar
    UPDATE user_roles
    SET
      description = COALESCE(p_description, description),
      permissions = COALESCE(p_permissions, permissions),
      updated_at = now()
    WHERE role_name = p_old_name;
    RETURN QUERY SELECT * FROM user_roles WHERE role_name = p_old_name;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM user_roles WHERE role_name = v_new_name) THEN
    RAISE EXCEPTION 'Ya existe un rol con ese nombre';
  END IF;

  SELECT * INTO v_current FROM user_roles WHERE role_name = p_old_name;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rol no encontrado';
  END IF;

  INSERT INTO user_roles (role_name, description, permissions)
  VALUES (
    v_new_name,
    COALESCE(p_description, v_current.description),
    COALESCE(p_permissions, v_current.permissions)
  );

  UPDATE user_profiles SET role_name = v_new_name WHERE role_name = p_old_name;

  DELETE FROM user_roles WHERE role_name = p_old_name;

  RETURN QUERY SELECT * FROM user_roles WHERE role_name = v_new_name;
END;
$$;

GRANT EXECUTE ON FUNCTION rename_role(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================
-- 2. DELETE_ROLE
-- ============================================
CREATE OR REPLACE FUNCTION delete_role(p_role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT user_has_permission(auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar roles (se requiere permiso manage_roles)';
  END IF;

  IF p_role_name = 'admin' THEN
    RAISE EXCEPTION 'No se puede eliminar el rol administrador';
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE role_name = p_role_name) THEN
    RAISE EXCEPTION 'No se puede eliminar un rol que tiene usuarios asignados';
  END IF;

  DELETE FROM user_roles WHERE role_name = p_role_name;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_role(TEXT) TO authenticated;

-- ============================================
-- 3. GET_VIEW_PERMISSIONS_MAP
-- ============================================
-- Devuelve JSONB: { "dashboard": ["admin", "tienda"], "inventory": ["admin"], ... }
-- Para Layout y Sidebar (cualquier usuario autenticado puede llamarla)
CREATE OR REPLACE FUNCTION get_view_permissions_map()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_view_ids TEXT[] := ARRAY[
    'dashboard', 'inventory', 'orders', 'platos', 'merma',
    'purchases', 'suppliers', 'statistics', 'account', 'settings'
  ];
  v_view_id TEXT;
  v_role_names TEXT[];
  v_result JSONB := '{}'::JSONB;
BEGIN
  FOREACH v_view_id IN ARRAY v_view_ids
  LOOP
    SELECT array_agg(role_name ORDER BY role_name)
    INTO v_role_names
    FROM user_roles
    WHERE role_name = 'admin'
       OR (permissions->>('view_' || v_view_id)) = 'true';

    v_result := v_result || jsonb_build_object(v_view_id, COALESCE(v_role_names, ARRAY['admin']));
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_view_permissions_map() TO authenticated;
