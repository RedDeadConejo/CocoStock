-- ============================================
-- CocoStock - 17: Storage app-releases (manage_app_releases + is_user_admin)
-- ============================================
--
-- ERROR «42501: must be owner of table objects» al hacer DROP POLICY
-- -----------------------------------------------------------------
-- En Supabase alojado, storage.objects pertenece a un rol interno (p. ej.
-- supabase_storage_admin). El SQL Editor suele NO poder DROP/ALTER políticas.
--
-- Qué hacer:
--
-- A) Bloque 17b: CREATE de políticas «CocoStock … v1». Si ya existen y quieres
--    sustituir la definición, bórralas antes en Dashboard (Storage → Policies);
--    Postgres no permite ALTER del cuerpo de una política.
--
-- B) Si CREATE también falla: Dashboard → Storage → elige bucket app-releases
--    → pestaña Policies (o Database → Policies → filtrar schema storage,
--    tabla objects). Ahí puedes borrar las políticas viejas y crear nuevas
--    pegando las mismas expresiones que en 17b.
--
-- Expresiones a usar en la UI (rol: authenticated):
--   INSERT  → WITH CHECK:  (igual que en 17b)
--   UPDATE  → USING y WITH CHECK
--   DELETE  → USING
--
-- C) Migraciones con Supabase CLI (`supabase db push` / migraciones enlazadas al
--    proyecto) a veces ejecutan con privilegios que sí permiten DROP; entonces
--    puedes usar el bloque «17c REEMPLAZO».
--
-- Requisitos: 01 (is_user_admin, user_has_permission), bucket app-releases privado.

-- ============================================
-- 17b) Crear políticas v1 (borra manualmente en Dashboard si ya existen y hay que recrear)
-- ============================================

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

-- Opcional en UI: borrar también «Solo Admin puede subir/actualizar/eliminar releases» si ya no las quieres.

-- ============================================
-- 17c) REEMPLAZO COMPLETO — solo si DROP te está permitido (CLI / self-hosted)
-- ============================================
-- No ejecutes 17c si 17b ya funcionó, salvo que quieras unificar nombres.

/*
DROP POLICY IF EXISTS "Solo Admin puede subir releases" ON storage.objects;
CREATE POLICY "Solo Admin puede subir releases"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin((select auth.uid()))
    OR public.user_has_permission((select auth.uid()), 'manage_app_releases')
  )
);

DROP POLICY IF EXISTS "Solo Admin puede actualizar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede actualizar releases"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin((select auth.uid()))
    OR public.user_has_permission((select auth.uid()), 'manage_app_releases')
  )
)
WITH CHECK (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin((select auth.uid()))
    OR public.user_has_permission((select auth.uid()), 'manage_app_releases')
  )
);

DROP POLICY IF EXISTS "Solo Admin puede eliminar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede eliminar releases"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND (
    public.is_user_admin((select auth.uid()))
    OR public.user_has_permission((select auth.uid()), 'manage_app_releases')
  )
);
*/
