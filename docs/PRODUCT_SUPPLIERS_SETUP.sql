-- ============================================
-- Relación Productos - Proveedores
-- Tabla intermedia para relación muchos-a-muchos
-- ============================================

-- Crear la tabla intermedia product_suppliers
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, supplier_id) -- Evitar duplicados
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (lectura): usuarios autenticados pueden ver relaciones
CREATE POLICY "Users can view product suppliers"
ON product_suppliers FOR SELECT
TO authenticated
USING (true);

-- Política para INSERT (crear): usuarios autenticados pueden crear relaciones
CREATE POLICY "Users can create product suppliers"
ON product_suppliers FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para UPDATE (actualizar): usuarios autenticados pueden actualizar relaciones
CREATE POLICY "Users can update product suppliers"
ON product_suppliers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política para DELETE (eliminar): usuarios autenticados pueden eliminar relaciones
CREATE POLICY "Users can delete product suppliers"
ON product_suppliers FOR DELETE
TO authenticated
USING (true);

-- Verificar que todo se creó correctamente
SELECT tablename, schemaname
FROM pg_tables
WHERE tablename = 'product_suppliers';

SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'product_suppliers';

