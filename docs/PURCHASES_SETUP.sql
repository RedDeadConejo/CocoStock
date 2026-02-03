-- Sistema de Compras a Proveedores - CocoStock
-- Este script crea la estructura de compras a proveedores

-- Tabla de compras
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de items de la compra (productos en la compra)
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Nombre del producto al momento de la compra (por si se elimina)
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity_requested NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Cantidad solicitada originalmente
  quantity_received NUMERIC(10, 2) DEFAULT 0, -- Cantidad recibida (puede ser diferente a la solicitada)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_purchases_created_by ON purchases(created_by);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_purchases_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para purchases
-- Los usuarios pueden ver sus propias compras
CREATE POLICY "Usuarios pueden ver sus propias compras"
  ON purchases FOR SELECT
  USING (auth.uid() = created_by);

-- Los usuarios pueden crear compras
CREATE POLICY "Usuarios pueden crear compras"
  ON purchases FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('tienda', 'admin', 'almacen')
    )
  );

-- Los usuarios pueden actualizar sus propias compras solo si están pendientes
CREATE POLICY "Usuarios pueden actualizar sus propias compras pendientes"
  ON purchases FOR UPDATE
  USING (
    auth.uid() = created_by AND
    status = 'pending'
  )
  WITH CHECK (
    auth.uid() = created_by AND
    status = 'pending'
  );

-- Usuarios de almacén y admin pueden ver todas las compras
CREATE POLICY "Almacén y admin pueden ver todas las compras"
  ON purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Usuarios de almacén y admin pueden actualizar el estado de las compras
CREATE POLICY "Almacén y admin pueden actualizar compras"
  ON purchases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Políticas RLS para purchase_items
-- Los usuarios pueden ver items de sus propias compras
CREATE POLICY "Usuarios pueden ver items de sus compras"
  ON purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.id = purchase_items.purchase_id AND p.created_by = auth.uid()
    )
  );

-- Los usuarios pueden crear items en sus propias compras
CREATE POLICY "Usuarios pueden crear items en sus compras"
  ON purchase_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.id = purchase_items.purchase_id AND p.created_by = auth.uid() AND p.status = 'pending'
    )
  );

-- Usuarios de almacén y admin pueden ver todos los items
CREATE POLICY "Almacén y admin pueden ver todos los items"
  ON purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Comentarios en las tablas
COMMENT ON TABLE purchases IS 'Tabla de compras realizadas a proveedores';
COMMENT ON TABLE purchase_items IS 'Items/productos dentro de cada compra';
COMMENT ON COLUMN purchases.status IS 'Estado de la compra: pending, processing, completed, cancelled';
COMMENT ON COLUMN purchase_items.product_name IS 'Nombre del producto al momento de la compra (backup por si se elimina)';
COMMENT ON COLUMN purchase_items.quantity_requested IS 'Cantidad solicitada originalmente';
COMMENT ON COLUMN purchase_items.quantity_received IS 'Cantidad recibida (puede ser diferente a la solicitada)';
