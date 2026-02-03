-- ============================================
-- Configuración de Base de Datos - Proveedores
-- ============================================

-- Crear la tabla suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  eliminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_suppliers_eliminado ON suppliers(eliminado);
CREATE INDEX IF NOT EXISTS idx_suppliers_nombre ON suppliers(nombre);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (lectura): solo proveedores no eliminados
CREATE POLICY "Users can view suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (eliminado = false);

-- Política para INSERT (crear): cualquier usuario autenticado puede crear
CREATE POLICY "Users can create suppliers"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para UPDATE (actualizar y soft delete):
-- Permite actualizar cualquier campo de proveedores no eliminados
-- y permite cambiar 'eliminado' de false a true
CREATE POLICY "Users can update suppliers"
ON suppliers FOR UPDATE
TO authenticated
USING (eliminado = false)
WITH CHECK (true);  -- Permite cualquier cambio, incluyendo eliminado = true

-- Función para soft delete (bypass RLS)
CREATE OR REPLACE FUNCTION soft_delete_supplier(supplier_id UUID)
RETURNS suppliers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result suppliers;
BEGIN
  UPDATE suppliers
  SET eliminado = true
  WHERE id = supplier_id AND eliminado = false
  RETURNING * INTO result;
  
  RETURN result;
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION soft_delete_supplier(UUID) TO authenticated;

-- Verificar que todo se creó correctamente
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'suppliers';

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'soft_delete_supplier';

