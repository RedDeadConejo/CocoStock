-- ============================================
-- Historial de Cambios de Stock
-- Tabla para registrar todos los cambios de stock
-- ============================================

-- Crear la tabla stock_history
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type TEXT NOT NULL, -- 'add', 'subtract', 'set'
  old_stock TEXT NOT NULL,
  new_stock TEXT NOT NULL,
  quantity TEXT NOT NULL, -- Cantidad que se agregó, restó o estableció
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_id ON stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (lectura): usuarios autenticados pueden ver el historial
CREATE POLICY "Users can view stock history"
ON stock_history FOR SELECT
TO authenticated
USING (true);

-- Política para INSERT (crear): usuarios autenticados pueden crear registros
CREATE POLICY "Users can create stock history"
ON stock_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verificar que todo se creó correctamente
SELECT tablename, schemaname
FROM pg_tables
WHERE tablename = 'stock_history';

SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'stock_history';

