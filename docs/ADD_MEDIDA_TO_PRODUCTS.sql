-- Agregar columna 'medida' a la tabla products
-- Este script agrega el campo medida con las mismas opciones que formato

-- Agregar la columna medida si no existe
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS medida TEXT;

-- Comentario en la columna
COMMENT ON COLUMN products.medida IS 'Medida del producto (kg, g, L, ml, unidades, caja, etc.)';
