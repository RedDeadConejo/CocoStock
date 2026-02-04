-- ============================================
-- CocoStock Producción - Releases para actualizaciones (app_releases)
-- ============================================
-- La app Electron consulta la última versión disponible y descarga el instalador
-- desde Supabase Storage (bucket app-releases, público para lectura).

-- ========== APP_RELEASES ==========
CREATE TABLE IF NOT EXISTS app_releases (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'win32',
  file_path TEXT NOT NULL,
  file_size BIGINT,
  release_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(version, platform)
);

CREATE INDEX IF NOT EXISTS idx_app_releases_platform_active_created
  ON app_releases(platform, is_active, created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_app_releases_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trigger_update_app_releases_updated_at ON app_releases;
CREATE TRIGGER trigger_update_app_releases_updated_at
  BEFORE UPDATE ON app_releases FOR EACH ROW EXECUTE FUNCTION update_app_releases_updated_at();

-- RLS: lectura pública para que la app pueda ver releases sin sesión
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de releases activos" ON app_releases;
CREATE POLICY "Lectura pública de releases activos" ON app_releases
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo servicio puede escribir app_releases" ON app_releases;
CREATE POLICY "Solo servicio puede escribir app_releases" ON app_releases
  FOR ALL USING (true) WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE app_releases IS 'Releases de la app para actualizaciones; file_path es la ruta dentro del bucket app-releases en Storage';
COMMENT ON COLUMN app_releases.platform IS 'win32, darwin o linux';
COMMENT ON COLUMN app_releases.file_path IS 'Nombre del archivo en el bucket (ej: CocoStock-Setup-1.9.1.exe)';
