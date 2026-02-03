-- Ingredientes de platos - CocoStock
-- Cada plato puede tener ingredientes seleccionados desde los productos del almacén (inventario)

-- Tabla de ingredientes por plato (producto del inventario + cantidad)
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

-- RLS: mismo criterio que dishes (acceso según plato → restaurante)
ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;

-- SELECT: quien puede ver el plato puede ver sus ingredientes
CREATE POLICY "Admin ve ingredientes de platos"
  ON dish_ingredients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_ingredients.dish_id AND d.eliminado = false)
    AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Almacen ve ingredientes de platos"
  ON dish_ingredients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM dishes d WHERE d.id = dish_ingredients.dish_id AND d.eliminado = false)
    AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'almacen')
  );

CREATE POLICY "Tienda ve ingredientes de platos de su restaurante"
  ON dish_ingredients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dishes d
      INNER JOIN user_profiles up ON up.id = auth.uid() AND up.restaurant_id = d.restaurant_id
      WHERE d.id = dish_ingredients.dish_id AND d.eliminado = false
    )
  );

-- INSERT / UPDATE / DELETE: mismo criterio que dishes
CREATE POLICY "Admin inserta ingredientes"
  ON dish_ingredients FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Tienda inserta ingredientes en platos de su restaurante"
  ON dish_ingredients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dishes d
      INNER JOIN user_profiles up ON up.id = auth.uid() AND up.restaurant_id = d.restaurant_id
      WHERE d.id = dish_ingredients.dish_id
    )
  );

CREATE POLICY "Admin actualiza ingredientes"
  ON dish_ingredients FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Tienda actualiza ingredientes de platos de su restaurante"
  ON dish_ingredients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dishes d
      INNER JOIN user_profiles up ON up.id = auth.uid() AND up.restaurant_id = d.restaurant_id
      WHERE d.id = dish_ingredients.dish_id
    )
  );

CREATE POLICY "Admin elimina ingredientes"
  ON dish_ingredients FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role_name = 'admin')
  );

CREATE POLICY "Tienda elimina ingredientes de platos de su restaurante"
  ON dish_ingredients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM dishes d
      INNER JOIN user_profiles up ON up.id = auth.uid() AND up.restaurant_id = d.restaurant_id
      WHERE d.id = dish_ingredients.dish_id
    )
  );

COMMENT ON TABLE dish_ingredients IS 'Ingredientes de cada plato: productos del inventario (almacén) y cantidad';
COMMENT ON COLUMN dish_ingredients.quantity IS 'Cantidad usada por plato; unidad según producto (medida/formato)';
