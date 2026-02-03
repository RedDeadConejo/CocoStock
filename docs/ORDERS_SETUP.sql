-- Sistema de Pedidos - CocoStock
-- Este script crea la estructura de pedidos

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de items del pedido (productos en el pedido)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Nombre del producto al momento del pedido (por si se elimina)
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para orders
-- Los usuarios pueden ver sus propios pedidos
CREATE POLICY "Usuarios pueden ver sus propios pedidos"
  ON orders FOR SELECT
  USING (auth.uid() = created_by);

-- Los usuarios de tienda pueden crear pedidos
CREATE POLICY "Usuarios de tienda pueden crear pedidos"
  ON orders FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('tienda', 'admin', 'almacen')
    )
  );

-- Los usuarios pueden actualizar sus propios pedidos solo si están pendientes
CREATE POLICY "Usuarios pueden actualizar sus propios pedidos pendientes"
  ON orders FOR UPDATE
  USING (
    auth.uid() = created_by AND
    status = 'pending'
  )
  WITH CHECK (
    auth.uid() = created_by AND
    status = 'pending'
  );

-- Usuarios de almacén y admin pueden ver todos los pedidos
CREATE POLICY "Almacén y admin pueden ver todos los pedidos"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Usuarios de almacén y admin pueden actualizar el estado de los pedidos
CREATE POLICY "Almacén y admin pueden actualizar pedidos"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Políticas RLS para order_items
-- Los usuarios pueden ver items de sus propios pedidos
CREATE POLICY "Usuarios pueden ver items de sus pedidos"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.created_by = auth.uid()
    )
  );

-- Los usuarios pueden crear items en sus propios pedidos
CREATE POLICY "Usuarios pueden crear items en sus pedidos"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.created_by = auth.uid() AND o.status = 'pending'
    )
  );

-- Usuarios de almacén y admin pueden ver todos los items
CREATE POLICY "Almacén y admin pueden ver todos los items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name IN ('almacen', 'admin')
    )
  );

-- Comentarios en las tablas
COMMENT ON TABLE orders IS 'Tabla de pedidos realizados por usuarios de tienda';
COMMENT ON TABLE order_items IS 'Items/productos dentro de cada pedido';
COMMENT ON COLUMN orders.status IS 'Estado del pedido: pending, processing, completed, cancelled';
COMMENT ON COLUMN order_items.product_name IS 'Nombre del producto al momento del pedido (backup por si se elimina)';

