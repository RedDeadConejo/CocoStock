-- ============================================
-- CocoStock Producción - 12: Storage Policies (app-releases)
-- ============================================
-- Políticas para el bucket app-releases:
--   - Solo usuarios autenticados pueden descargar (SELECT)
--   - Solo usuarios con rol Admin pueden subir/actualizar/eliminar releases (INSERT/UPDATE/DELETE)
--
-- IMPORTANTE: El bucket app-releases debe ser PRIVADO (no público).
-- Si no existe: Supabase Dashboard → Storage → New bucket → id: app-releases → Private.
-- Si ya existe como público: Storage → app-releases → Configuration → Public = OFF.

-- ========== POLÍTICAS EN storage.objects ==========
-- RLS ya está habilitado por defecto en storage.objects

-- SELECT: Solo usuarios autenticados pueden descargar (leer objetos)
DROP POLICY IF EXISTS "Usuarios autenticados pueden descargar releases" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden descargar releases"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'app-releases');

-- INSERT: Solo Admin puede subir releases
DROP POLICY IF EXISTS "Solo Admin puede subir releases" ON storage.objects;
CREATE POLICY "Solo Admin puede subir releases"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-releases'
  AND public.is_user_admin(auth.uid())
);

-- UPDATE: Solo Admin puede actualizar/reemplazar releases
DROP POLICY IF EXISTS "Solo Admin puede actualizar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede actualizar releases"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND public.is_user_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'app-releases'
  AND public.is_user_admin(auth.uid())
);

-- DELETE: Solo Admin puede eliminar releases
DROP POLICY IF EXISTS "Solo Admin puede eliminar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede eliminar releases"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND public.is_user_admin(auth.uid())
);

-- Comentarios
COMMENT ON TABLE storage.objects IS 'Políticas de app-releases: descarga solo autenticados, subida solo Admin';
