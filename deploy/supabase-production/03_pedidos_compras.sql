-- ============================================
-- CocoStock Producción - 03: Pedidos y Compras
-- ============================================
-- Tablas: orders (con restaurant_id), order_items (quantity_requested, quantity_sent), purchases, purchase_items
-- RLS

-- ========== ORDERS ==========
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);

CREATE OR REPLACE FUNCTION update_orders_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_orders_updated_at();

-- ========== ORDER_ITEMS ==========
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity_requested NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity_sent NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ========== PURCHASES ==========
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_created_by ON purchases(created_by);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);

CREATE OR REPLACE FUNCTION update_purchases_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION update_purchases_updated_at();

-- ========== PURCHASE_ITEMS ==========
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity_requested NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity_received NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);

-- ========== RLS ORDERS (una política por acción para evitar multiple_permissive_policies) ==========
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios pedidos" ON orders;
DROP POLICY IF EXISTS "Ver todos los pedidos" ON orders;
CREATE POLICY "Ver pedidos propios o todos con permiso" ON orders FOR SELECT USING ((select auth.uid()) = created_by OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_all_orders'));
CREATE POLICY "Crear pedidos" ON orders FOR INSERT WITH CHECK ((select auth.uid()) = created_by AND (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'create_orders')));
DROP POLICY IF EXISTS "Actualizar pedidos pendientes propios" ON orders;
DROP POLICY IF EXISTS "Completar pedidos" ON orders;
CREATE POLICY "Actualizar o completar pedidos" ON orders FOR UPDATE USING (((select auth.uid()) = created_by AND status = 'pending') OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'complete_orders')) WITH CHECK (((select auth.uid()) = created_by AND status = 'pending') OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'complete_orders'));

-- ========== RLS ORDER_ITEMS ==========
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver items de sus pedidos" ON order_items;
DROP POLICY IF EXISTS "Ver todos los items pedidos" ON order_items;
CREATE POLICY "Ver items de pedidos propios o todos" ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.created_by = (select auth.uid())) OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_all_orders'));
CREATE POLICY "Usuarios pueden crear items en sus pedidos" ON order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.created_by = (select auth.uid()) AND o.status = 'pending'));
CREATE POLICY "Actualizar items de pedidos" ON order_items FOR UPDATE USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'complete_orders')) WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'complete_orders'));

-- ========== RLS PURCHASES ==========
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias compras" ON purchases;
DROP POLICY IF EXISTS "Ver todas las compras" ON purchases;
CREATE POLICY "Ver compras propias o todas con permiso" ON purchases FOR SELECT USING ((select auth.uid()) = created_by OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_all_purchases'));
CREATE POLICY "Crear compras" ON purchases FOR INSERT WITH CHECK ((select auth.uid()) = created_by AND (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'create_purchases')));
DROP POLICY IF EXISTS "Actualizar compras pendientes propias" ON purchases;
DROP POLICY IF EXISTS "Completar compras" ON purchases;
CREATE POLICY "Actualizar o completar compras" ON purchases FOR UPDATE USING (((select auth.uid()) = created_by AND status = 'pending') OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'complete_purchases')) WITH CHECK (((select auth.uid()) = created_by AND status = 'pending') OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'complete_purchases'));

-- ========== RLS PURCHASE_ITEMS ==========
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver items de sus compras" ON purchase_items;
DROP POLICY IF EXISTS "Ver todos los items compra" ON purchase_items;
CREATE POLICY "Ver items de compras propias o todas" ON purchase_items FOR SELECT USING (EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_items.purchase_id AND p.created_by = (select auth.uid())) OR is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_all_purchases'));
CREATE POLICY "Usuarios pueden crear items en sus compras" ON purchase_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_items.purchase_id AND p.created_by = (select auth.uid()) AND p.status = 'pending'));
