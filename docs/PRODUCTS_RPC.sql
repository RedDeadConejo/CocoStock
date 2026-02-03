-- RPC para Productos (auditoría Supabase - sección 4)
-- Ejecutar DESPUÉS de ROLES_USERS_RPC.sql (usa user_has_permission).
-- Usa permiso edit_inventory para crear/actualizar productos (roles personalizados).
-- 1. create_product: producto + historial de creación + product_suppliers en una transacción
-- 2. update_product: actualización + historial de cambios + product_suppliers en una transacción

-- Requiere: tabla products con columnas nombre, precio, formato, medida, precio_por_formato,
-- iva, referencia, nivel_reordenado, cantidad_por_formato, stock, eliminado;
-- product_changes_history; product_suppliers.

-- ============================================
-- 1. CREATE_PRODUCT
-- ============================================
-- p_product: JSONB { nombre, precio, formato, medida, precio_por_formato, iva, referencia,
--   nivel_reordenado, cantidad_por_formato, stock } (todos como string)
-- p_supplier_ids: JSONB array de UUIDs ["uuid1", "uuid2"]
CREATE OR REPLACE FUNCTION create_product(
  p_product JSONB,
  p_supplier_ids JSONB DEFAULT '[]'::JSONB
)
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_uid UUID := auth.uid();
  v_fields TEXT[] := ARRAY[
    'nombre', 'precio', 'formato', 'medida', 'precio_por_formato', 'iva',
    'referencia', 'nivel_reordenado', 'cantidad_por_formato', 'stock'
  ];
  v_field TEXT;
  v_val TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT user_has_permission(v_uid, 'edit_inventory')
     AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('admin', 'almacen')) THEN
    RAISE EXCEPTION 'No tienes permiso para crear productos (edit_inventory o rol admin/almacen)';
  END IF;

  IF p_product IS NULL OR (p_product->>'nombre') IS NULL OR trim(p_product->>'nombre') = '' THEN
    RAISE EXCEPTION 'El nombre del producto es requerido';
  END IF;

  INSERT INTO products (
    nombre, precio, formato, medida, precio_por_formato, iva, referencia,
    nivel_reordenado, cantidad_por_formato, stock, eliminado
  ) VALUES (
    coalesce(trim(p_product->>'nombre'), ''),
    coalesce(trim(p_product->>'precio'), '0'),
    coalesce(trim(p_product->>'formato'), ''),
    coalesce(trim(p_product->>'medida'), ''),
    coalesce(trim(p_product->>'precio_por_formato'), '0'),
    coalesce(trim(p_product->>'iva'), '0'),
    coalesce(trim(p_product->>'referencia'), ''),
    coalesce(trim(p_product->>'nivel_reordenado'), '0'),
    coalesce(trim(p_product->>'cantidad_por_formato'), '0'),
    coalesce(trim(p_product->>'stock'), '0'),
    false
  )
  RETURNING id INTO v_product_id;

  FOREACH v_field IN ARRAY v_fields
  LOOP
    v_val := coalesce(trim(p_product->>v_field), '');
    INSERT INTO product_changes_history (product_id, user_id, user_email, field_name, old_value, new_value)
    VALUES (v_product_id, v_uid, NULL, v_field, NULL, v_val);
  END LOOP;

  DELETE FROM product_suppliers WHERE product_id = v_product_id;
  IF jsonb_array_length(p_supplier_ids) > 0 THEN
    INSERT INTO product_suppliers (product_id, supplier_id)
    SELECT v_product_id, (trim(elem))::UUID
    FROM jsonb_array_elements_text(p_supplier_ids) AS elem
    WHERE trim(elem) != '';
  END IF;

  RETURN QUERY SELECT * FROM products WHERE id = v_product_id;
END;
$$;

-- Nota: p_supplier_ids en Supabase/PostgREST puede enviarse como array de strings ["uuid1","uuid2"]
-- Si la función espera JSONB, el cliente envía { p_supplier_ids: ["uuid1", "uuid2"] }
GRANT EXECUTE ON FUNCTION create_product(JSONB, JSONB) TO authenticated;

-- ============================================
-- 2. UPDATE_PRODUCT
-- ============================================
-- p_supplier_ids: NULL = no cambiar proveedores; [] = quitar todos; [uuid,...] = reemplazar
CREATE OR REPLACE FUNCTION update_product(
  p_id UUID,
  p_product JSONB,
  p_supplier_ids JSONB DEFAULT NULL
)
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current products%ROWTYPE;
  v_uid UUID := auth.uid();
  v_fields TEXT[] := ARRAY[
    'nombre', 'precio', 'formato', 'medida', 'precio_por_formato', 'iva',
    'referencia', 'nivel_reordenado', 'cantidad_por_formato', 'stock'
  ];
  v_field TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT user_has_permission(v_uid, 'edit_inventory')
     AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('admin', 'almacen')) THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar productos (edit_inventory o rol admin/almacen)';
  END IF;

  SELECT * INTO v_current FROM products WHERE id = p_id AND (eliminado = false OR eliminado IS NULL);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  UPDATE products SET
    nombre = coalesce(nullif(trim(p_product->>'nombre'), ''), v_current.nombre),
    precio = coalesce(trim(p_product->>'precio'), v_current.precio),
    formato = coalesce(trim(p_product->>'formato'), v_current.formato),
    medida = coalesce(trim(p_product->>'medida'), v_current.medida),
    precio_por_formato = coalesce(trim(p_product->>'precio_por_formato'), v_current.precio_por_formato),
    iva = coalesce(trim(p_product->>'iva'), v_current.iva),
    referencia = coalesce(trim(p_product->>'referencia'), v_current.referencia),
    nivel_reordenado = coalesce(trim(p_product->>'nivel_reordenado'), v_current.nivel_reordenado),
    cantidad_por_formato = coalesce(trim(p_product->>'cantidad_por_formato'), v_current.cantidad_por_formato),
    stock = coalesce(trim(p_product->>'stock'), v_current.stock),
    updated_at = now()
  WHERE id = p_id;

  FOREACH v_field IN ARRAY v_fields
  LOOP
    v_old := CASE v_field
      WHEN 'nombre' THEN v_current.nombre
      WHEN 'precio' THEN v_current.precio
      WHEN 'formato' THEN v_current.formato
      WHEN 'medida' THEN v_current.medida
      WHEN 'precio_por_formato' THEN v_current.precio_por_formato
      WHEN 'iva' THEN v_current.iva
      WHEN 'referencia' THEN v_current.referencia
      WHEN 'nivel_reordenado' THEN v_current.nivel_reordenado
      WHEN 'cantidad_por_formato' THEN v_current.cantidad_por_formato
      WHEN 'stock' THEN v_current.stock
      ELSE NULL
    END;
    v_new := coalesce(trim(p_product->>v_field), v_old);
    v_old := coalesce(v_old, '');
    v_new := coalesce(v_new, '');
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO product_changes_history (product_id, user_id, user_email, field_name, old_value, new_value)
      VALUES (p_id, v_uid, NULL, v_field, v_old, v_new);
    END IF;
  END LOOP;

  IF p_supplier_ids IS NOT NULL THEN
    DELETE FROM product_suppliers WHERE product_id = p_id;
    IF jsonb_array_length(p_supplier_ids) > 0 THEN
      INSERT INTO product_suppliers (product_id, supplier_id)
      SELECT p_id, (trim(elem))::UUID
      FROM jsonb_array_elements_text(p_supplier_ids) AS elem
      WHERE trim(elem) != '';
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM products WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_product(UUID, JSONB, JSONB) TO authenticated;

-- ============================================
-- 3. SOFT_DELETE_PRODUCT
-- ============================================
-- Marca producto como eliminado (eliminado = true). Requiere permiso edit_inventory.
-- DROP necesario si la función existía con otro tipo de retorno (p. ej. products en vez de SETOF products).
DROP FUNCTION IF EXISTS soft_delete_product(UUID);
CREATE OR REPLACE FUNCTION soft_delete_product(p_product_id UUID)
RETURNS SETOF products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT user_has_permission(v_uid, 'edit_inventory')
     AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid AND up.role_name IN ('admin', 'almacen')) THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar productos (edit_inventory o rol admin/almacen)';
  END IF;

  UPDATE products
  SET eliminado = true, updated_at = now()
  WHERE id = p_product_id AND (eliminado = false OR eliminado IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado o ya eliminado';
  END IF;

  RETURN QUERY SELECT * FROM products WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_product(UUID) TO authenticated;
