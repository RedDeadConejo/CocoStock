-- Sistema de Merma - CocoStock
-- Registro de pérdidas/desperdicios por restaurante (local)

-- Tabla de merma
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
CREATE INDEX IF NOT EXISTS idx_merma_fecha ON merma(fecha DESC);

-- NOTA: Las IPs autorizadas para merma ya NO se guardan en base de datos.
-- Se almacenan localmente en la app de escritorio (Electron), cifradas con AES-256-GCM.
-- Ver Ajustes → IPs Autorizadas en la aplicación de escritorio.

-- RLS para merma
ALTER TABLE merma ENABLE ROW LEVEL SECURITY;

-- SELECT: admin y almacen ven todas; tienda solo las de su restaurante
CREATE POLICY "Admin ve todas las mermas"
  ON merma FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Almacen ve todas las mermas"
  ON merma FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'almacen')
  );

CREATE POLICY "Tienda ve mermas de su restaurante"
  ON merma FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.restaurant_id = merma.restaurant_id
    )
  );

-- INSERT: admin, almacen y tienda pueden crear mermas
CREATE POLICY "Admin inserta mermas"
  ON merma FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Almacen inserta mermas"
  ON merma FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'almacen')
  );

CREATE POLICY "Tienda inserta mermas en su restaurante"
  ON merma FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.restaurant_id = merma.restaurant_id
    )
  );

-- UPDATE: solo admin y almacen pueden actualizar
CREATE POLICY "Admin actualiza mermas"
  ON merma FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Almacen actualiza mermas"
  ON merma FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'almacen')
  );

-- DELETE: solo admin puede eliminar
CREATE POLICY "Admin elimina mermas"
  ON merma FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

-- Tokens de servidor merma: vinculan la cuenta que inicia el servidor con el restaurante
-- La merma se registra como created_by = user_id de quien inició el servidor
CREATE TABLE IF NOT EXISTS merma_server_tokens (
  token UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merma_server_tokens_user ON merma_server_tokens(user_id);

-- Solo el propio usuario (o admin) puede registrar/desregistrar su token (vía RLS o función)
-- Las funciones son SECURITY DEFINER y comprueban auth.uid()

-- Registrar token: lo llama la app con sesión al iniciar servidor merma (cuenta actual + restaurante asignado)
CREATE OR REPLACE FUNCTION register_merma_server_token(p_token UUID, p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO merma_server_tokens (token, user_id, restaurant_id)
  VALUES (p_token, auth.uid(), p_restaurant_id);
END;
$$;

-- Solo usuarios autenticados pueden registrar (su propio user_id = auth.uid())
GRANT EXECUTE ON FUNCTION register_merma_server_token(UUID, UUID) TO authenticated;

-- Crear merma con token: lo llama la interfaz local sin sesión
CREATE OR REPLACE FUNCTION create_merma_with_token(
  p_token UUID,
  p_restaurant_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_motivo TEXT DEFAULT NULL,
  p_fecha TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM merma_server_tokens
  WHERE token = p_token AND restaurant_id = p_restaurant_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Token no válido o no coincide con el restaurante';
  END IF;

  INSERT INTO merma (restaurant_id, product_id, quantity, motivo, fecha, created_by)
  VALUES (p_restaurant_id, p_product_id, p_quantity, NULLIF(trim(p_motivo), ''), COALESCE(p_fecha, now()), v_user_id)
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_merma_with_token(UUID, UUID, UUID, NUMERIC, TEXT, TIMESTAMPTZ) TO anon, authenticated;

-- Desregistrar token: lo llama la app con sesión al detener servidor merma
CREATE OR REPLACE FUNCTION unregister_merma_server_token(p_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM merma_server_tokens
  WHERE token = p_token AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION unregister_merma_server_token(UUID) TO authenticated;

-- Listado de productos para el formulario de merma (sin sesión)
CREATE OR REPLACE FUNCTION get_products_for_merma()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  medida TEXT,
  formato TEXT,
  referencia TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.nombre, p.medida, p.formato, p.referencia
  FROM products p
  WHERE p.eliminado = false
  ORDER BY p.nombre;
$$;

GRANT EXECUTE ON FUNCTION get_products_for_merma() TO anon, authenticated;

COMMENT ON TABLE merma IS 'Registro de pérdidas/desperdicios (merma) por restaurante';
COMMENT ON COLUMN merma.motivo IS 'Razón de la merma (ej: caducado, dañado, roto)';
COMMENT ON TABLE merma_server_tokens IS 'Tokens de servidor merma: cuenta y restaurante de quien inició el servidor';

-- OPCIONAL: Si tenías la tabla authorized_ips y la función check_authorized_ip (ya no se usan; las IPs son locales y cifradas)
-- DROP FUNCTION IF EXISTS check_authorized_ip(TEXT);
-- DROP TABLE IF EXISTS authorized_ips;
