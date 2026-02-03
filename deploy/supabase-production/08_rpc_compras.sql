-- ============================================
-- CocoStock Producción - 08: RPC Compras
-- ============================================
-- create_purchase, complete_purchase
-- Requiere: 06 (user_has_permission)

CREATE OR REPLACE FUNCTION create_purchase(p_supplier_id UUID, p_notes TEXT DEFAULT NULL, p_items JSONB DEFAULT '[]'::JSONB)
RETURNS SETOF purchases LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_purchase_id UUID; v_uid UUID := auth.uid(); v_items_len INT; v_can_create BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuario no autenticado'; END IF;
  IF p_supplier_id IS NULL THEN RAISE EXCEPTION 'Debe seleccionar un proveedor'; END IF;
  SELECT user_has_permission(v_uid, 'create_purchases') OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('tienda', 'admin', 'almacen')) INTO v_can_create;
  IF NOT COALESCE(v_can_create, false) THEN RAISE EXCEPTION 'No tienes permiso para crear compras'; END IF;
  SELECT jsonb_array_length(p_items) INTO v_items_len; IF v_items_len IS NULL OR v_items_len < 1 THEN RAISE EXCEPTION 'La compra debe contener al menos un producto'; END IF;
  INSERT INTO purchases (created_by, supplier_id, status, notes) VALUES (v_uid, p_supplier_id, 'pending', NULLIF(trim(p_notes), '')) RETURNING id INTO v_purchase_id;
  INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, quantity_requested, quantity_received)
  SELECT v_purchase_id, (elem->>'product_id')::UUID, COALESCE(NULLIF(trim(elem->>'product_name'), ''), 'Producto'), GREATEST(0, (elem->>'quantity')::NUMERIC), GREATEST(0, (elem->>'quantity')::NUMERIC), 0
  FROM jsonb_array_elements(p_items) AS elem WHERE elem->>'product_id' IS NOT NULL AND elem->>'product_id' != '';
  RETURN QUERY SELECT * FROM purchases WHERE id = v_purchase_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_purchase(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION complete_purchase(p_purchase_id UUID)
RETURNS SETOF purchases LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_purchase purchases%ROWTYPE; v_uid UUID := auth.uid(); v_item RECORD; v_qty NUMERIC; v_cur_stock NUMERIC; v_new_stock NUMERIC; v_product_stock TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuario no autenticado'; END IF;
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id; IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada'; END IF;
  IF v_purchase.status NOT IN ('pending', 'processing') THEN RAISE EXCEPTION 'Solo se pueden completar compras pendientes o en proceso'; END IF;
  IF v_purchase.created_by != v_uid AND NOT user_has_permission(v_uid, 'complete_purchases') AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('almacen', 'admin')) THEN RAISE EXCEPTION 'No tienes permiso para completar esta compra'; END IF;
  FOR v_item IN SELECT pi.id, pi.product_id, pi.product_name, COALESCE(NULLIF(pi.quantity_received, 0), pi.quantity_requested, pi.quantity, 0) AS qty FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id AND pi.product_id IS NOT NULL LOOP
    v_qty := GREATEST(0, v_item.qty); IF v_qty <= 0 THEN CONTINUE; END IF;
    SELECT stock INTO v_product_stock FROM products WHERE id = v_item.product_id AND (eliminado = false OR eliminado IS NULL) FOR UPDATE;
    IF v_product_stock IS NOT NULL THEN
      v_cur_stock := COALESCE(NULLIF(trim(v_product_stock), '')::NUMERIC, 0); v_new_stock := v_cur_stock + v_qty;
      UPDATE products SET stock = v_new_stock::TEXT WHERE id = v_item.product_id;
      INSERT INTO stock_history (product_id, user_id, user_email, action_type, old_stock, new_stock, quantity) VALUES (v_item.product_id, v_uid, NULL, 'add', v_cur_stock::TEXT, v_new_stock::TEXT, v_qty::TEXT);
    END IF;
  END LOOP;
  UPDATE purchases SET status = 'completed', updated_at = now() WHERE id = p_purchase_id;
  RETURN QUERY SELECT * FROM purchases WHERE id = p_purchase_id;
END; $$;
GRANT EXECUTE ON FUNCTION complete_purchase(UUID) TO authenticated;
