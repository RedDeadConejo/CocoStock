-- ============================================
-- CocoStock Producción - 07: RPC Pedidos
-- ============================================
-- create_order, complete_order
-- Requiere: 06 (user_has_permission)

CREATE OR REPLACE FUNCTION create_order(p_restaurant_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL, p_items JSONB DEFAULT '[]'::JSONB)
RETURNS SETOF orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id UUID; v_uid UUID := auth.uid(); v_items_len INT; v_can_create BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuario no autenticado'; END IF;
  SELECT user_has_permission(v_uid, 'create_orders') OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('tienda', 'admin', 'almacen')) INTO v_can_create;
  IF NOT COALESCE(v_can_create, false) THEN RAISE EXCEPTION 'No tienes permiso para crear pedidos'; END IF;
  SELECT jsonb_array_length(p_items) INTO v_items_len;
  IF v_items_len IS NULL OR v_items_len < 1 THEN RAISE EXCEPTION 'El pedido debe contener al menos un producto'; END IF;
  INSERT INTO orders (created_by, restaurant_id, status, notes) VALUES (v_uid, p_restaurant_id, 'pending', NULLIF(trim(p_notes), '')) RETURNING id INTO v_order_id;
  INSERT INTO order_items (order_id, product_id, product_name, quantity, quantity_requested, quantity_sent)
  SELECT v_order_id, (elem->>'product_id')::UUID, COALESCE(NULLIF(trim(elem->>'product_name'), ''), 'Producto'), GREATEST(0, (elem->>'quantity')::NUMERIC), GREATEST(0, (elem->>'quantity')::NUMERIC), GREATEST(0, (elem->>'quantity')::NUMERIC)
  FROM jsonb_array_elements(p_items) AS elem WHERE elem->>'product_id' IS NOT NULL AND elem->>'product_id' != '';
  RETURN QUERY SELECT * FROM orders WHERE id = v_order_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_order(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION complete_order(p_order_id UUID)
RETURNS SETOF orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order orders%ROWTYPE; v_uid UUID := auth.uid(); v_item RECORD; v_qty NUMERIC; v_cur_stock NUMERIC; v_new_stock NUMERIC; v_product_stock TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuario no autenticado'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id; IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF v_order.status NOT IN ('pending', 'processing') THEN RAISE EXCEPTION 'Solo se pueden completar pedidos pendientes o en proceso'; END IF;
  IF v_order.created_by != v_uid AND NOT user_has_permission(v_uid, 'complete_orders') AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('almacen', 'admin')) THEN RAISE EXCEPTION 'No tienes permiso para completar este pedido'; END IF;
  FOR v_item IN SELECT oi.id, oi.product_id, oi.product_name, COALESCE(NULLIF(oi.quantity_sent, 0), oi.quantity_requested, oi.quantity, 0) AS qty FROM order_items oi WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL LOOP
    v_qty := GREATEST(0, v_item.qty); IF v_qty <= 0 THEN CONTINUE; END IF;
    SELECT stock INTO v_product_stock FROM products WHERE id = v_item.product_id AND (eliminado = false OR eliminado IS NULL) FOR UPDATE;
    IF v_product_stock IS NOT NULL THEN
      v_cur_stock := COALESCE(NULLIF(trim(v_product_stock), '')::NUMERIC, 0); v_new_stock := GREATEST(0, v_cur_stock - v_qty);
      UPDATE products SET stock = v_new_stock::TEXT WHERE id = v_item.product_id;
      INSERT INTO stock_history (product_id, user_id, user_email, action_type, old_stock, new_stock, quantity) VALUES (v_item.product_id, v_uid, NULL, 'subtract', v_cur_stock::TEXT, v_new_stock::TEXT, v_qty::TEXT);
    END IF;
  END LOOP;
  UPDATE orders SET status = 'completed', updated_at = now() WHERE id = p_order_id;
  RETURN QUERY SELECT * FROM orders WHERE id = p_order_id;
END; $$;
GRANT EXECUTE ON FUNCTION complete_order(UUID) TO authenticated;
