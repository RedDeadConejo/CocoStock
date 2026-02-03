-- ============================================
-- CocoStock Producción - 02: Productos e Inventario
-- ============================================
-- Tablas: products, suppliers, product_suppliers, product_changes_history, stock_history
-- Función: soft_delete_supplier
-- RLS

-- ========== PRODUCTS ==========
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio TEXT DEFAULT '0',
  formato TEXT DEFAULT '',
  medida TEXT DEFAULT '',
  precio_por_formato TEXT DEFAULT '0',
  iva TEXT DEFAULT '0',
  referencia TEXT DEFAULT '',
  nivel_reordenado TEXT DEFAULT '0',
  cantidad_por_formato TEXT DEFAULT '0',
  stock TEXT DEFAULT '0',
  eliminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ========== SUPPLIERS ==========
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  eliminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_suppliers_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_suppliers_updated_at();

-- ========== PRODUCT_SUPPLIERS ==========
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);

-- ========== PRODUCT_CHANGES_HISTORY ==========
CREATE TABLE IF NOT EXISTS product_changes_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_changes_product_id ON product_changes_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_changes_history_user_id ON product_changes_history(user_id);

-- ========== STOCK_HISTORY ==========
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type TEXT NOT NULL,
  old_stock TEXT NOT NULL,
  new_stock TEXT NOT NULL,
  quantity TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_id ON stock_history(user_id);

-- ========== RLS ==========
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados ven productos no eliminados" ON products FOR SELECT TO authenticated USING (eliminado = false);
CREATE POLICY "Insertar productos" ON products FOR INSERT TO authenticated WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));
CREATE POLICY "Actualizar productos" ON products FOR UPDATE TO authenticated USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory')) WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view suppliers" ON suppliers FOR SELECT TO authenticated USING (eliminado = false);
CREATE POLICY "Users can create suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));
CREATE POLICY "Users can update suppliers" ON suppliers FOR UPDATE TO authenticated USING (eliminado = false AND (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'))) WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));

ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view product suppliers" ON product_suppliers FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE solo admin o permiso edit_inventory
CREATE POLICY "Users can create product suppliers" ON product_suppliers FOR INSERT TO authenticated WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));
CREATE POLICY "Users can update product suppliers" ON product_suppliers FOR UPDATE TO authenticated USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory')) WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));
CREATE POLICY "Users can delete product suppliers" ON product_suppliers FOR DELETE TO authenticated USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'edit_inventory'));

ALTER TABLE product_changes_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view product changes history" ON product_changes_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create product changes history" ON product_changes_history FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view stock history" ON stock_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create stock history" ON stock_history FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- ========== SOFT_DELETE_SUPPLIER ==========
CREATE OR REPLACE FUNCTION soft_delete_supplier(supplier_id UUID)
RETURNS suppliers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result suppliers;
BEGIN
  UPDATE suppliers SET eliminado = true WHERE id = supplier_id AND eliminado = false RETURNING * INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION soft_delete_supplier(UUID) TO authenticated;
