-- =============================================================================
-- CocoStock — HOTFIX consolidado (Supabase → SQL Editor)
-- =============================================================================
-- Storage (sección 3): crea políticas «CocoStock … v1». Si ya existen con otra
-- definición, bórralas antes manualmente en Dashboard → Storage → app-releases
-- → Policies (Postgres no permite cambiar el cuerpo de una política existente).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Permisos JSON por rol (idempotente)
-- -----------------------------------------------------------------------------
UPDATE user_roles SET permissions = permissions || '{"view_dashboard":true,"view_inventory":true,"view_orders":true,"view_all_orders":true,"view_platos":true,"view_platos_all":true,"view_merma":true,"view_merma_all":true,"view_purchases":true,"view_all_purchases":true,"view_suppliers":true,"view_statistics":true,"view_account":true,"view_settings":true,"view_settings_roles":true,"view_settings_users":true,"view_settings_restaurants":true,"view_settings_authorized_ips":true,"view_settings_local_servers":true,"create_server_merma":true,"create_server_full":true,"manage_roles":true,"manage_app_releases":true,"create_orders":true,"complete_orders":true,"create_purchases":true,"complete_purchases":true,"edit_inventory":true}'::jsonb WHERE role_name = 'admin';

UPDATE user_roles SET permissions = permissions || '{"view_dashboard":true,"view_inventory":true,"view_orders":true,"view_all_orders":true,"view_platos":true,"view_platos_all":true,"view_merma":true,"view_merma_all":true,"view_purchases":true,"view_all_purchases":true,"view_statistics":true,"view_account":true,"complete_orders":true,"create_purchases":true,"complete_purchases":true,"edit_inventory":true}'::jsonb WHERE role_name = 'almacen';

UPDATE user_roles SET permissions = permissions || '{"view_dashboard":true,"view_inventory":true,"view_orders":true,"view_platos":true,"view_merma":true,"view_statistics":true,"view_account":true,"view_settings":true,"view_settings_authorized_ips":true,"view_settings_local_servers":true,"create_server_merma":true,"create_orders":true,"create_purchases":true}'::jsonb WHERE role_name = 'tienda';

-- -----------------------------------------------------------------------------
-- 2) Device sessions: GRANT si existe la tabla
-- -----------------------------------------------------------------------------
DO $gr$
BEGIN
  IF to_regclass('public.cocostock_device_sessions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cocostock_device_sessions TO authenticated';
  END IF;
END
$gr$;

-- -----------------------------------------------------------------------------
-- 3) Storage app-releases — políticas v1 con COALESCE(auth.uid, jwt sub)
--     (en Storage a veces auth.uid() es NULL; sin esto is_user_admin falla.)
--     Borra manualmente en Dashboard las políticas con el mismo nombre si ya existen.
-- -----------------------------------------------------------------------------
CREATE POLICY "CocoStock app-releases INSERT manage v1"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  )
);

CREATE POLICY "CocoStock app-releases UPDATE manage v1"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  )
)
WITH CHECK (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  )
);

CREATE POLICY "CocoStock app-releases DELETE manage v1"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)))
    OR public.user_has_permission(COALESCE((SELECT auth.uid()), (((SELECT auth.jwt())->>'sub')::uuid)), 'manage_app_releases')
  )
);

-- -----------------------------------------------------------------------------
-- 4) Si la sección 3 no puedes aplicarla (políticas v1 ya existen con SQL viejo),
--    ejecuta en una query aparte: 18_storage_app_releases_uid_jwt_coalesce.sql
--    (nombres «uid_jwt»; se suma a las actuales, RLS permissive = OR).
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 5) app_releases — SELECT explícito (anon + authenticated)
--    Sin esto, RLS puede ocultar todas las filas: lista vacía y updater ciego.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Lectura pública de releases activos" ON app_releases;
CREATE POLICY "Lectura pública de releases activos" ON app_releases
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.app_releases TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6) app_releases — INSERT/UPDATE/DELETE para authenticated
--    Corrige «Error al registrar: new row violates RLS» tras subir a Storage.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Solo servicio puede escribir app_releases" ON app_releases;
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

GRANT INSERT, UPDATE, DELETE ON TABLE public.app_releases TO authenticated;
