-- ============================================
-- CocoStock - 04b: Unidad por ingrediente en dish_ingredients
-- ============================================
-- Permite que cada ingrediente de un plato tenga su propia unidad (L, ml, g, kg...)
-- así la misma receta puede mostrar "0.5 L" en un plato y "200 ml" en otro.
-- La quantity se guarda siempre en la unidad base del producto para el cálculo del coste.

ALTER TABLE dish_ingredients
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT NULL;

COMMENT ON COLUMN dish_ingredients.unit IS 'Unidad de visualización para este ingrediente (L, ml, g, kg...). Si null, usa product.medida. La quantity está siempre en la unidad base del producto.';
