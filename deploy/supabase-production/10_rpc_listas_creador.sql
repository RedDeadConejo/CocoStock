-- ============================================
-- CocoStock Producción - 10: RPC Listas con Creador
-- ============================================
-- get_orders_with_creators, get_purchases_with_creators (SECURITY INVOKER, RLS aplica)

CREATE OR REPLACE FUNCTION get_orders_with_creators(p_user_id UUID DEFAULT NULL, p_status TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RETURN (SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', o.id, 'created_by', o.created_by, 'restaurant_id', o.restaurant_id, 'status', o.status, 'notes', o.notes, 'created_at', o.created_at, 'updated_at', o.updated_at,
      'user_profiles', CASE WHEN o.created_by IS NULL THEN NULL ELSE jsonb_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) END,
      'order_items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', oi.id, 'product_id', oi.product_id, 'product_name', oi.product_name, 'quantity', oi.quantity, 'quantity_requested', oi.quantity_requested, 'quantity_sent', oi.quantity_sent, 'products', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'nombre', p.nombre, 'referencia', p.referencia, 'precio', p.precio, 'stock', p.stock, 'formato', p.formato) END)), '[]'::jsonb) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id),
      'restaurants', (SELECT to_jsonb(r.*) FROM restaurants r WHERE r.id = o.restaurant_id LIMIT 1))
    AS row FROM orders o LEFT JOIN user_profiles up ON up.id = o.created_by
    WHERE (p_user_id IS NULL OR o.created_by = p_user_id) AND (p_status IS NULL OR trim(p_status) = '' OR o.status = trim(p_status))
    ORDER BY o.created_at DESC
  ) sub(row));
END; $$;
GRANT EXECUTE ON FUNCTION get_orders_with_creators(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_purchases_with_creators(p_user_id UUID DEFAULT NULL, p_status TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RETURN (SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', p.id, 'created_by', p.created_by, 'supplier_id', p.supplier_id, 'status', p.status, 'notes', p.notes, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'user_profiles', CASE WHEN p.created_by IS NULL THEN NULL ELSE jsonb_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) END,
      'purchase_items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pi.id, 'product_id', pi.product_id, 'product_name', pi.product_name, 'quantity', pi.quantity, 'quantity_requested', pi.quantity_requested, 'quantity_received', pi.quantity_received, 'products', CASE WHEN prod.id IS NULL THEN NULL ELSE jsonb_build_object('id', prod.id, 'nombre', prod.nombre, 'referencia', prod.referencia, 'precio', prod.precio, 'stock', prod.stock, 'formato', prod.formato) END)), '[]'::jsonb) FROM purchase_items pi LEFT JOIN products prod ON prod.id = pi.product_id WHERE pi.purchase_id = p.id),
      'suppliers', (SELECT to_jsonb(s.*) FROM suppliers s WHERE s.id = p.supplier_id LIMIT 1))
    AS row FROM purchases p LEFT JOIN user_profiles up ON up.id = p.created_by
    WHERE (p_user_id IS NULL OR p.created_by = p_user_id) AND (p_status IS NULL OR trim(p_status) = '' OR p.status = trim(p_status))
    ORDER BY p.created_at DESC
  ) sub(row));
END; $$;
GRANT EXECUTE ON FUNCTION get_purchases_with_creators(UUID, TEXT) TO authenticated;
