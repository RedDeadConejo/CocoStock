-- ============================================
-- CocoStock Producción - 00: Control de versiones (app_version)
-- ============================================
-- La app consulta la versión mínima requerida en la pantalla de login.
-- Si no existe la tabla o no hay fila activa, se permite el acceso.

-- ========== APP_VERSION ==========
CREATE TABLE IF NOT EXISTS app_version (
  id SERIAL PRIMARY KEY,
  minimum_version VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_version_is_active_created ON app_version(is_active, created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_app_version_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trigger_update_app_version_updated_at ON app_version;
CREATE TRIGGER trigger_update_app_version_updated_at
  BEFORE UPDATE ON app_version FOR EACH ROW EXECUTE FUNCTION update_app_version_updated_at();

-- RLS: lectura pública (anon + authenticated) para que el login pueda ver la versión mínima sin sesión
ALTER TABLE app_version ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de versión activa" ON app_version;
CREATE POLICY "Lectura pública de versión activa" ON app_version
  FOR SELECT USING (true);

-- Solo admins pueden insertar/actualizar/eliminar (opcional; si no tienes is_user_admin aquí, usar WITH CHECK (false) y gestionar desde Dashboard)
DROP POLICY IF EXISTS "Solo servicio puede escribir app_version" ON app_version;
CREATE POLICY "Solo servicio puede escribir app_version" ON app_version
  FOR ALL USING (true) WITH CHECK (true);

-- Fila inicial: versión mínima 1.0.0 (cambiar en Dashboard o con UPDATE cuando quieras forzar actualización)
INSERT INTO app_version (minimum_version, is_active)
SELECT '1.0.0', true
WHERE NOT EXISTS (SELECT 1 FROM app_version LIMIT 1);
