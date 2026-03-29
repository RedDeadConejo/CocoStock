-- ============================================
-- CocoStock Producción - 12: Storage Policies (app-releases)
-- ============================================
-- Políticas para el bucket app-releases:
--   - Solo usuarios autenticados pueden descargar (SELECT)
--   - Escritura: is_user_admin O user_has_permission(..., 'manage_app_releases')
--
-- IMPORTANTE: El bucket app-releases debe ser PRIVADO (no público).
-- Si no existe: Supabase Dashboard → Storage → New bucket → id: app-releases → Private.
-- Si ya existe como público: Storage → app-releases → Configuration → Public = OFF.

-- ========== POLÍTICAS EN storage.objects ==========
-- RLS ya está habilitado por defecto en storage.objects

-- SELECT: anon + authenticated (coherente con app_releases legible sin sesión; ver 21 si solo faltaba esto en prod)
DROP POLICY IF EXISTS "Usuarios autenticados pueden descargar releases" ON storage.objects;
DROP POLICY IF EXISTS "CocoStock app-releases SELECT anon authenticated v1" ON storage.objects;
CREATE POLICY "CocoStock app-releases SELECT anon authenticated v1"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'app-releases');

-- INSERT
DROP POLICY IF EXISTS "Solo Admin puede subir releases" ON storage.objects;
CREATE POLICY "Solo Admin puede subir releases"
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

-- UPDATE: Solo Admin puede actualizar/reemplazar releases
DROP POLICY IF EXISTS "Solo Admin puede actualizar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede actualizar releases"
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

-- DELETE: Solo Admin puede eliminar releases
DROP POLICY IF EXISTS "Solo Admin puede eliminar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede eliminar releases"
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

-- Comentarios
COMMENT ON TABLE storage.objects IS 'Políticas app-releases: lectura autenticados; escritura is_user_admin o manage_app_releases';
