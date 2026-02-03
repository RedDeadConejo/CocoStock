-- Platos / Productos por Restaurante (Local) - CocoStock
-- Cada local tiene su propio catálogo de platos o productos que vende

-- Tabla de platos por restaurante
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_eliminado ON dishes(eliminado);
CREATE INDEX IF NOT EXISTS idx_dishes_activo ON dishes(activo);
CREATE INDEX IF NOT EXISTS idx_dishes_nombre ON dishes(nombre);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_dishes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_dishes_updated_at ON dishes;
CREATE TRIGGER update_dishes_updated_at
  BEFORE UPDATE ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION update_dishes_updated_at();

-- RLS
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;

-- SELECT: admin ve todos; almacen ve todos; tienda solo los de su restaurante
CREATE POLICY "Admin ve todos los platos"
  ON dishes FOR SELECT
  USING (
    eliminado = false AND
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

CREATE POLICY "Almacen ve todos los platos"
  ON dishes FOR SELECT
  USING (
    eliminado = false AND
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'almacen'
    )
  );

CREATE POLICY "Tienda ve platos de su restaurante"
  ON dishes FOR SELECT
  USING (
    eliminado = false AND
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.restaurant_id = dishes.restaurant_id
    )
  );

-- INSERT: admin para cualquier restaurante; tienda solo para el suyo
CREATE POLICY "Admin inserta platos"
  ON dishes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

CREATE POLICY "Tienda inserta platos en su restaurante"
  ON dishes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.restaurant_id = dishes.restaurant_id
    )
  );

-- UPDATE: admin para cualquier plato; tienda solo los de su restaurante
CREATE POLICY "Admin actualiza platos"
  ON dishes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

CREATE POLICY "Tienda actualiza platos de su restaurante"
  ON dishes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.restaurant_id = dishes.restaurant_id
    )
  );

-- DELETE (soft delete vía UPDATE): mismas políticas que UPDATE
-- Las políticas de UPDATE ya permiten marcar eliminado = true

COMMENT ON TABLE dishes IS 'Platos o productos que vende cada restaurante (local)';
COMMENT ON COLUMN dishes.restaurant_id IS 'Restaurante/local al que pertenece el plato';
COMMENT ON COLUMN dishes.categoria IS 'Ej: Entrantes, Principales, Postres, Bebidas';
COMMENT ON COLUMN dishes.activo IS 'Si está visible en carta; false para ocultar sin eliminar';
