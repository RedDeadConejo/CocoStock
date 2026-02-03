-- ============================================
-- CocoStock Producción - 04: Platos y Merma
-- ============================================
-- Tablas: dishes, dish_ingredients, merma, merma_server_tokens
-- RPCs merma: register_merma_server_token, unregister_merma_server_token, create_merma_with_token, get_products_for_merma
-- RLS

-- ========== DISHES ==========
CREATE TABLE IF NOT EXISTS dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10, 2) NOT NULL DEFAULT 0,
  categoria TEXT,
  activo BOOLEAN DEFAULT true,
  eliminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON dishes(restaurant_id);

CREATE OR REPLACE FUNCTION update_dishes_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_dishes_updated_at ON dishes;
CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION update_dishes_updated_at();

-- ========== DISH_INGREDIENTS ==========
CREATE TABLE IF NOT EXISTS dish_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(dish_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish_id ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_product_id ON dish_ingredients(product_id);

-- ========== MERMA ==========
CREATE TABLE IF NOT EXISTS merma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 0,
  motivo TEXT,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merma_restaurant_id ON merma(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_merma_product_id ON merma(product_id);
CREATE INDEX IF NOT EXISTS idx_merma_created_by ON merma(created_by);

-- ========== MERMA_SERVER_TOKENS ==========
CREATE TABLE IF NOT EXISTS merma_server_tokens (
  token UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merma_server_tokens_user ON merma_server_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_merma_server_tokens_restaurant_id ON merma_server_tokens(restaurant_id);

-- ========== RLS DISHES (una política por acción para evitar multiple_permissive_policies) ==========
-- view_platos_all: ver/crear/editar todos. view_platos: solo del propio restaurante.
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver todos los platos" ON dishes;
DROP POLICY IF EXISTS "Ver platos de mi restaurante" ON dishes;
CREATE POLICY "Ver platos" ON dishes FOR SELECT USING (eliminado = false AND (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND restaurant_id = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid())))));
DROP POLICY IF EXISTS "Insertar platos (todos)" ON dishes;
DROP POLICY IF EXISTS "Insertar platos (mi restaurante)" ON dishes;
CREATE POLICY "Insertar platos" ON dishes FOR INSERT WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND restaurant_id = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));
DROP POLICY IF EXISTS "Actualizar platos (todos)" ON dishes;
DROP POLICY IF EXISTS "Actualizar platos (mi restaurante)" ON dishes;
CREATE POLICY "Actualizar platos" ON dishes FOR UPDATE USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND restaurant_id = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));

-- ========== RLS DISH_INGREDIENTS ==========
ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver ingredientes (todos los platos)" ON dish_ingredients;
DROP POLICY IF EXISTS "Ver ingredientes (platos de mi restaurante)" ON dish_ingredients;
CREATE POLICY "Ver ingredientes" ON dish_ingredients FOR SELECT USING (EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_ingredients.dish_id AND d.eliminado = false) AND (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND (SELECT restaurant_id FROM dishes WHERE id = dish_ingredients.dish_id) = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))))));
CREATE POLICY "Insertar ingredientes" ON dish_ingredients FOR INSERT WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND (SELECT restaurant_id FROM dishes WHERE id = dish_ingredients.dish_id) = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));
CREATE POLICY "Actualizar ingredientes" ON dish_ingredients FOR UPDATE USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND (SELECT restaurant_id FROM dishes WHERE id = dish_ingredients.dish_id) = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));
CREATE POLICY "Eliminar ingredientes" ON dish_ingredients FOR DELETE USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_platos_all') OR (user_has_permission((select auth.uid()), 'view_platos') AND (SELECT restaurant_id FROM dishes WHERE id = dish_ingredients.dish_id) = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));

-- ========== RLS MERMA ==========
ALTER TABLE merma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver todas las mermas" ON merma;
DROP POLICY IF EXISTS "Ver mermas de mi restaurante" ON merma;
CREATE POLICY "Ver mermas" ON merma FOR SELECT USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_merma_all') OR (user_has_permission((select auth.uid()), 'view_merma') AND restaurant_id = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));
DROP POLICY IF EXISTS "Insertar mermas (todas)" ON merma;
DROP POLICY IF EXISTS "Insertar mermas (mi restaurante)" ON merma;
CREATE POLICY "Insertar mermas" ON merma FOR INSERT WITH CHECK (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_merma_all') OR (user_has_permission((select auth.uid()), 'view_merma') AND restaurant_id = (SELECT restaurant_id FROM user_profiles WHERE id = (select auth.uid()))));
CREATE POLICY "Actualizar mermas" ON merma FOR UPDATE USING (is_user_admin((select auth.uid())) OR user_has_permission((select auth.uid()), 'view_merma_all'));
CREATE POLICY "Eliminar mermas" ON merma FOR DELETE USING (is_user_admin((select auth.uid())));

-- ========== RLS MERMA_SERVER_TOKENS ==========
-- Tokens vinculan usuario con restaurante al iniciar servidor merma; cada usuario solo gestiona los suyos.
ALTER TABLE merma_server_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve sus propios tokens merma" ON merma_server_tokens FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Usuario inserta su propio token merma" ON merma_server_tokens FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Usuario elimina sus propios tokens merma" ON merma_server_tokens FOR DELETE USING (user_id = (select auth.uid()));

-- ========== RPCs MERMA ==========
CREATE OR REPLACE FUNCTION register_merma_server_token(p_token UUID, p_restaurant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO merma_server_tokens (token, user_id, restaurant_id) VALUES (p_token, (select auth.uid()), p_restaurant_id); END; $$;
GRANT EXECUTE ON FUNCTION register_merma_server_token(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION create_merma_with_token(p_token UUID, p_restaurant_id UUID, p_product_id UUID, p_quantity NUMERIC, p_motivo TEXT DEFAULT NULL, p_fecha TIMESTAMPTZ DEFAULT now())
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_new_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM merma_server_tokens WHERE token = p_token AND restaurant_id = p_restaurant_id;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Token no válido o no coincide con el restaurante'; END IF;
  INSERT INTO merma (restaurant_id, product_id, quantity, motivo, fecha, created_by) VALUES (p_restaurant_id, p_product_id, p_quantity, NULLIF(trim(p_motivo), ''), COALESCE(p_fecha, now()), v_user_id) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_merma_with_token(UUID, UUID, UUID, NUMERIC, TEXT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION unregister_merma_server_token(p_token UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM merma_server_tokens WHERE token = p_token AND user_id = (select auth.uid()); END; $$;
GRANT EXECUTE ON FUNCTION unregister_merma_server_token(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION get_products_for_merma()
RETURNS TABLE (id UUID, nombre TEXT, medida TEXT, formato TEXT, referencia TEXT) LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id, p.nombre, p.medida, p.formato, p.referencia FROM products p WHERE p.eliminado = false ORDER BY p.nombre;
$$;
GRANT EXECUTE ON FUNCTION get_products_for_merma() TO anon, authenticated;
