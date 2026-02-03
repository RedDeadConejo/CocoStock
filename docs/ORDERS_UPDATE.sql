-- Actualización del Sistema de Pedidos - CocoStock
-- Agrega campos para distinguir entre cantidad pedida y cantidad enviada

-- Agregar campo quantity_requested (cantidad pedida originalmente)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS quantity_requested NUMERIC(10, 2);

-- Agregar campo quantity_sent (cantidad enviada realmente)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS quantity_sent NUMERIC(10, 2);

-- Migrar datos existentes: quantity_requested = quantity, quantity_sent = quantity
UPDATE order_items 
SET 
  quantity_requested = quantity,
  quantity_sent = quantity
WHERE quantity_requested IS NULL OR quantity_sent IS NULL;

-- Hacer que quantity_requested no sea nulo después de migrar
ALTER TABLE order_items 
ALTER COLUMN quantity_requested SET NOT NULL;

-- Establecer valores por defecto
ALTER TABLE order_items 
ALTER COLUMN quantity_requested SET DEFAULT 0;

ALTER TABLE order_items 
ALTER COLUMN quantity_sent SET DEFAULT 0;

-- Actualizar las políticas RLS para permitir que almacén pueda actualizar order_items
-- Primero eliminar la política si existe (por si se ejecuta múltiples veces)
DROP POLICY IF EXISTS "Almacén y admin pueden actualizar items de pedidos" ON order_items;

-- Crear la política para que almacén y admin puedan actualizar order_items
CREATE POLICY "Almacén y admin pueden actualizar items de pedidos"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Comentarios en las nuevas columnas
COMMENT ON COLUMN order_items.quantity_requested IS 'Cantidad pedida originalmente por el cliente';
COMMENT ON COLUMN order_items.quantity_sent IS 'Cantidad realmente enviada (puede ser modificada por almacén)';

-- Mantener compatibilidad: quantity sigue siendo la cantidad pedida
COMMENT ON COLUMN order_items.quantity IS 'Cantidad pedida (mantener por compatibilidad, usar quantity_requested)';

