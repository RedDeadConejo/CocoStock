-- ============================================
-- Historial de Cambios de Productos
-- Tabla para registrar todos los cambios de productos (cada campo individualmente)
-- ============================================

-- Crear la tabla product_changes_history
CREATE TABLE IF NOT EXISTS product_changes_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  field_name TEXT NOT NULL, -- Nombre del campo que cambió (nombre, precio, formato, etc.)
  old_value TEXT, -- Valor anterior (puede ser NULL si es un campo nuevo)
  new_value TEXT, -- Valor nuevo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_product_changes_product_id ON product_changes_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_changes_user_id ON product_changes_history(user_id);
CREATE INDEX IF NOT EXISTS idx_product_changes_created_at ON product_changes_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_changes_field_name ON product_changes_history(field_name);

-- Habilitar RLS (Row Level Security)
ALTER TABLE product_changes_history ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (lectura): usuarios autenticados pueden ver el historial
CREATE POLICY "Users can view product changes history"
ON product_changes_history FOR SELECT
TO authenticated
USING (true);

-- Política para INSERT (crear): usuarios autenticados pueden crear registros
CREATE POLICY "Users can create product changes history"
ON product_changes_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verificar que todo se creó correctamente
SELECT tablename, schemaname
FROM pg_tables
WHERE tablename = 'product_changes_history';

SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'product_changes_history';

