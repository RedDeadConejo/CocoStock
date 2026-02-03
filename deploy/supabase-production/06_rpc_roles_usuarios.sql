-- ============================================
-- CocoStock Producción - 06: RPC Roles y Usuarios
-- ============================================
-- user_has_permission, rename_role, delete_role, get_view_permissions_map
-- Requiere: 01 (is_user_admin no necesario para estas RPCs; usan user_has_permission)

CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role_name TEXT; v_perm_value TEXT;
BEGIN
  IF p_user_id IS NULL OR p_permission_key IS NULL OR trim(p_permission_key) = '' THEN RETURN false; END IF;
  SELECT up.role_name INTO v_role_name FROM user_profiles up WHERE up.id = p_user_id;
  IF v_role_name IS NULL THEN RETURN false; END IF;
  IF v_role_name = 'admin' THEN RETURN true; END IF;
  SELECT (ur.permissions->>p_permission_key) INTO v_perm_value FROM user_roles ur WHERE ur.role_name = v_role_name;
  RETURN (v_perm_value = 'true');
END; $$;
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION rename_role(p_old_name TEXT, p_new_name TEXT, p_description TEXT DEFAULT NULL, p_permissions JSONB DEFAULT NULL)
RETURNS SETOF user_roles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_name TEXT := lower(trim(p_new_name)); v_current user_roles%ROWTYPE;
BEGIN
  IF NOT user_has_permission(auth.uid(), 'manage_roles') THEN RAISE EXCEPTION 'No tienes permiso para gestionar roles (manage_roles)'; END IF;
  IF p_old_name = 'admin' THEN RAISE EXCEPTION 'No se puede cambiar el nombre del rol administrador'; END IF;
  IF p_new_name IS NULL OR v_new_name = '' THEN RAISE EXCEPTION 'El nombre del rol es requerido'; END IF;
  IF v_new_name = p_old_name THEN
    UPDATE user_roles SET description = COALESCE(p_description, description), permissions = COALESCE(p_permissions, permissions), updated_at = now() WHERE role_name = p_old_name;
    RETURN QUERY SELECT * FROM user_roles WHERE role_name = p_old_name; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE role_name = v_new_name) THEN RAISE EXCEPTION 'Ya existe un rol con ese nombre'; END IF;
  SELECT * INTO v_current FROM user_roles WHERE role_name = p_old_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rol no encontrado'; END IF;
  INSERT INTO user_roles (role_name, description, permissions) VALUES (v_new_name, COALESCE(p_description, v_current.description), COALESCE(p_permissions, v_current.permissions));
  UPDATE user_profiles SET role_name = v_new_name WHERE role_name = p_old_name;
  DELETE FROM user_roles WHERE role_name = p_old_name;
  RETURN QUERY SELECT * FROM user_roles WHERE role_name = v_new_name;
END; $$;
GRANT EXECUTE ON FUNCTION rename_role(TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION delete_role(p_role_name TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT user_has_permission(auth.uid(), 'manage_roles') THEN RAISE EXCEPTION 'No tienes permiso para eliminar roles'; END IF;
  IF p_role_name = 'admin' THEN RAISE EXCEPTION 'No se puede eliminar el rol administrador'; END IF;
  IF EXISTS (SELECT 1 FROM user_profiles WHERE role_name = p_role_name) THEN RAISE EXCEPTION 'No se puede eliminar un rol que tiene usuarios asignados'; END IF;
  DELETE FROM user_roles WHERE role_name = p_role_name; RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION delete_role(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_view_permissions_map()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_view_ids TEXT[] := ARRAY['dashboard','inventory','orders','platos','merma','purchases','suppliers','statistics','account','settings']; v_view_id TEXT; v_role_names TEXT[]; v_result JSONB := '{}'::JSONB;
BEGIN
  FOREACH v_view_id IN ARRAY v_view_ids LOOP
    SELECT array_agg(role_name ORDER BY role_name) INTO v_role_names FROM user_roles WHERE role_name = 'admin' OR (permissions->>('view_' || v_view_id)) = 'true';
    v_result := v_result || jsonb_build_object(v_view_id, COALESCE(v_role_names, ARRAY['admin']));
  END LOOP;
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION get_view_permissions_map() TO authenticated;
