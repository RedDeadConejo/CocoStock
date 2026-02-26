-- ============================================
-- CocoStock Producción - 15: Incluir vista TPV en get_view_permissions_map
-- ============================================
-- Añade 'tpv' a la lista de vistas para que el menú muestre TPV según permiso view_tpv.

CREATE OR REPLACE FUNCTION get_view_permissions_map()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_view_ids TEXT[] := ARRAY['dashboard','tpv','inventory','orders','platos','merma','purchases','suppliers','statistics','account','settings']; v_view_id TEXT; v_role_names TEXT[]; v_result JSONB := '{}'::JSONB;
BEGIN
  FOREACH v_view_id IN ARRAY v_view_ids LOOP
    SELECT array_agg(role_name ORDER BY role_name) INTO v_role_names FROM user_roles WHERE role_name = 'admin' OR (permissions->>('view_' || v_view_id)) = 'true';
    v_result := v_result || jsonb_build_object(v_view_id, COALESCE(v_role_names, ARRAY['admin']));
  END LOOP;
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION get_view_permissions_map() TO authenticated;
