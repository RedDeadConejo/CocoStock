-- ============================================
-- CocoStock - 20: app_releases — SELECT explícito para anon + authenticated
-- ============================================
-- Si solo existen políticas INSERT/UPDATE/DELETE y la SELECT pública se perdió o
-- no aplica al rol del cliente, RLS devuelve 0 filas (sin error): lista de releases
-- vacía en la app y el updater no detecta versiones (p. ej. win32-win7).
--
-- Ejecutar en SQL Editor si getAppReleases() devuelve [] o el updater no ve releases.

DROP POLICY IF EXISTS "Lectura pública de releases activos" ON app_releases;

CREATE POLICY "Lectura pública de releases activos" ON app_releases
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.app_releases TO anon, authenticated;
