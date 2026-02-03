-- ============================================
-- Control de Versiones - Configuración
-- ============================================
-- Este script crea la tabla para gestionar la versión mínima requerida de la aplicación
-- y las políticas RLS necesarias.

-- ============================================
-- Tabla: app_version
-- ============================================
-- Almacena la versión mínima requerida de la aplicación
CREATE TABLE IF NOT EXISTS app_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minimum_version TEXT NOT NULL,
  message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_app_version_active ON app_version(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_app_version_created ON app_version(created_at DESC);

-- ============================================
-- Función para actualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_app_version_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger para updated_at
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_app_version_updated_at ON app_version;
CREATE TRIGGER trigger_update_app_version_updated_at
  BEFORE UPDATE ON app_version
  FOR EACH ROW
  EXECUTE FUNCTION update_app_version_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE app_version ENABLE ROW LEVEL SECURITY;

-- Política: Cualquier usuario autenticado puede leer la versión mínima requerida
CREATE POLICY "Usuarios autenticados pueden leer versión mínima"
  ON app_version
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Solo administradores pueden insertar/actualizar (ajustar según tu sistema de roles)
-- Por ahora, permitimos a todos los autenticados para facilitar la configuración inicial
-- Puedes restringir esto más tarde según tus necesidades
CREATE POLICY "Usuarios autenticados pueden gestionar versión"
  ON app_version
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Datos iniciales
-- ============================================
-- Insertar versión inicial (ajustar según tu versión actual)
-- Ejemplo: Si tu versión actual es 1.0.0, establece minimum_version a '1.0.0'
INSERT INTO app_version (minimum_version, message, is_active)
VALUES ('1.0.0', 'Versión inicial de la aplicación', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Notas de uso
-- ============================================
-- Para actualizar la versión mínima requerida:
-- 1. Desactivar la versión anterior:
--    UPDATE app_version SET is_active = false WHERE is_active = true;
--
-- 2. Insertar nueva versión mínima:
--    INSERT INTO app_version (minimum_version, message, is_active)
--    VALUES ('1.1.0', 'Se requiere actualizar a la versión 1.1.0 o superior', true);
--
-- 3. Para verificar la versión actual configurada:
--    SELECT * FROM app_version WHERE is_active = true ORDER BY created_at DESC LIMIT 1;

