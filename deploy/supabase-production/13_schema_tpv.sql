-- ============================================
-- CocoStock Producción - 13: Schema TPV (Punto de Venta)
-- ============================================
-- Separa los datos del front/TPV del backoffice (schema public).
-- Backoffice (public): usuarios, productos, pedidos, compras, platos, merma, etc.
-- TPV (tpv): ventas, líneas de venta, mesas/comandas (futuro).
--
-- *** IMPORTANTE: Tras ejecutar este script ***
-- Si la app muestra "Invalid schema: tpv" o "No API key found":
--   Dashboard de Supabase → Project Settings (engranaje) → API
--   → Sección "Exposed schemas" → Añadir "tpv" (junto a public) → Save.
-- Sin este paso la API no expone las tablas del TPV.

-- ========== CREAR SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS tpv;

GRANT USAGE ON SCHEMA tpv TO anon;
GRANT USAGE ON SCHEMA tpv TO authenticated;
GRANT USAGE ON SCHEMA tpv TO service_role;

-- ========== TABLA: tpv.sales (tickets/ventas) ==========
CREATE TABLE IF NOT EXISTS tpv.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  notes TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpv_sales_restaurant_id ON tpv.sales(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tpv_sales_created_by ON tpv.sales(created_by);
CREATE INDEX IF NOT EXISTS idx_tpv_sales_status ON tpv.sales(status);
CREATE INDEX IF NOT EXISTS idx_tpv_sales_created_at ON tpv.sales(created_at DESC);

CREATE OR REPLACE FUNCTION tpv.update_sales_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = tpv, public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_tpv_sales_updated_at ON tpv.sales;
CREATE TRIGGER update_tpv_sales_updated_at
  BEFORE UPDATE ON tpv.sales FOR EACH ROW EXECUTE FUNCTION tpv.update_sales_updated_at();

-- ========== TABLA: tpv.sale_items (líneas de venta) ==========
CREATE TABLE IF NOT EXISTS tpv.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES tpv.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  dish_id UUID REFERENCES public.dishes(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT sale_items_product_or_dish CHECK (product_id IS NOT NULL OR dish_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tpv_sale_items_sale_id ON tpv.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_tpv_sale_items_product_id ON tpv.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_tpv_sale_items_dish_id ON tpv.sale_items(dish_id);

-- ========== RLS tpv.sales ==========
ALTER TABLE tpv.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver ventas de mi restaurante o todos si permiso"
  ON tpv.sales FOR SELECT USING (
    restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
    OR public.is_user_admin((select auth.uid()))
    OR public.user_has_permission((select auth.uid()), 'view_tpv_sales')
  );

CREATE POLICY "Crear ventas en mi restaurante"
  ON tpv.sales FOR INSERT WITH CHECK (
    restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
    AND (public.is_user_admin((select auth.uid())) OR public.user_has_permission((select auth.uid()), 'create_tpv_sales'))
  );

CREATE POLICY "Actualizar ventas (cerrar/cancelar) en mi restaurante"
  ON tpv.sales FOR UPDATE USING (
    restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
    AND (public.is_user_admin((select auth.uid())) OR public.user_has_permission((select auth.uid()), 'manage_tpv_sales'))
  )
  WITH CHECK (
    restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
  );

-- ========== RLS tpv.sale_items ==========
ALTER TABLE tpv.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver líneas de ventas que puedo ver"
  ON tpv.sale_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tpv.sales s
      WHERE s.id = sale_items.sale_id
      AND (
        s.restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
        OR public.is_user_admin((select auth.uid()))
        OR public.user_has_permission((select auth.uid()), 'view_tpv_sales')
      )
    )
  );

CREATE POLICY "Insertar líneas en ventas abiertas de mi restaurante"
  ON tpv.sale_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tpv.sales s
      WHERE s.id = sale_items.sale_id
      AND s.restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
      AND s.status = 'open'
      AND (public.is_user_admin((select auth.uid())) OR public.user_has_permission((select auth.uid()), 'create_tpv_sales'))
    )
  );

CREATE POLICY "Actualizar líneas de ventas abiertas"
  ON tpv.sale_items FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tpv.sales s
      WHERE s.id = sale_items.sale_id
      AND s.status = 'open'
      AND s.restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
      AND (public.is_user_admin((select auth.uid())) OR public.user_has_permission((select auth.uid()), 'manage_tpv_sales'))
    )
  );

CREATE POLICY "Eliminar líneas de ventas abiertas"
  ON tpv.sale_items FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tpv.sales s
      WHERE s.id = sale_items.sale_id
      AND s.status = 'open'
      AND s.restaurant_id = (SELECT restaurant_id FROM public.user_profiles WHERE id = (select auth.uid()))
      AND (public.is_user_admin((select auth.uid())) OR public.user_has_permission((select auth.uid()), 'manage_tpv_sales'))
    )
  );

-- Permisos para que PostgREST/Supabase API pueda leer/escribir
GRANT SELECT, INSERT, UPDATE, DELETE ON tpv.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tpv.sale_items TO authenticated;
GRANT USAGE ON SCHEMA tpv TO anon, authenticated, service_role;
