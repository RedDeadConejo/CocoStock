-- ============================================
-- CocoStock - Migración: soporte Mac Intel/Apple Silicon
-- ============================================
-- Ejecutar solo si ya tienes app_releases con platform='darwin'.
-- Convierte releases antiguos 'darwin' a 'darwin-x64' (asumimos Intel si no se especifica).
-- Para Apple Silicon, sube manualmente un nuevo release con platform='darwin-arm64'.
--
-- Valores de platform soportados:
--   win32         - Windows x64
--   darwin-x64    - Mac Intel
--   darwin-arm64  - Mac Apple Silicon (M1, M2, M3...)
--   linux         - Linux x64
--   linux-arm64   - Linux ARM64

-- Opcional: migrar 'darwin' antiguo a 'darwin-x64'
-- (Descomenta si tienes releases con platform='darwin')
/*
UPDATE app_releases
SET platform = 'darwin-x64'
WHERE platform = 'darwin';
*/

-- Actualizar comentarios
COMMENT ON COLUMN app_releases.platform IS 'Plataforma: win32 (Windows), darwin-x64 (Mac Intel), darwin-arm64 (Mac Apple Silicon), linux, linux-arm64';
