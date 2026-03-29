-- ============================================
-- CocoStock - 19: app_releases — escritura solo gestores de releases
-- ============================================
-- Si la app no lista releases o el updater no ve filas, ejecuta ANTES o DESPUÉS:
--   20_app_releases_select_anon_authenticated.sql
--
-- Corrige «Error al registrar: new row violates row-level security policy»
-- cuando la tabla solo tenía SELECT público y no había política INSERT válida
-- para el rol authenticated (p. ej. se retiró el antiguo FOR ALL abierto).
--
-- Lectura: sigue pública (anon + authenticated) para el updater sin login.
-- Escritura: mismo criterio que Storage (is_user_admin o manage_app_releases).

-- Quitar política histórica «todo permitido» si aún existe (sustituida por las de abajo)
DROP POLICY IF EXISTS "Solo servicio puede escribir app_releases" ON app_releases;

-- Por si se re-ejecuta el script
DROP POLICY IF EXISTS "app_releases_insert_manage" ON app_releases;
DROP POLICY IF EXISTS "app_releases_update_manage" ON app_releases;
DROP POLICY IF EXISTS "app_releases_delete_manage" ON app_releases;

CREATE POLICY "app_releases_insert_manage" ON app_releases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  );

CREATE POLICY "app_releases_update_manage" ON app_releases
  FOR UPDATE TO authenticated
  USING (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  )
  WITH CHECK (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  );

CREATE POLICY "app_releases_delete_manage" ON app_releases
  FOR DELETE TO authenticated
  USING (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  );

-- Asegurar privilegios de tabla (por si hubo REVOKE manual)
GRANT SELECT ON TABLE public.app_releases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.app_releases TO authenticated;

COMMENT ON TABLE app_releases IS 'Releases: SELECT público; INSERT/UPDATE/DELETE solo admin o manage_app_releases';
