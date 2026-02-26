-- ============================================
-- CocoStock Producción - 12: Storage Policies (app-releases)
-- ============================================
-- NO EJECUTAR ESTE ARCHIVO EN SUPABASE.
--
-- En Supabase, storage.objects es gestionado por el sistema. Crear políticas
-- con SQL suele devolver 42501 (debe ser el propietario de los objetos de la tabla).
-- No uses DDL (ALTER TABLE, etc.) sobre storage.objects.
--
-- Crea las políticas desde el Panel de Control:
--   Storage → app-releases → Policies → New Policy
--
-- Guía paso a paso con las expresiones exactas:
--   Ver 12_storage_app_releases_MANUAL.md
--
-- Resumen de políticas a crear en la interfaz:
--   1. SELECT (Read) para authenticated:  USING (bucket_id = 'app-releases')
--   2. INSERT para authenticated:         WITH CHECK (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()))
--   3. UPDATE para authenticated:         USING y WITH CHECK (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()))
--   4. DELETE para authenticated:        USING (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()))
--
-- Bucket: app-releases debe existir y ser PRIVADO.
-- ============================================

-- (Las sentencias SQL originales se mantienen solo como referencia; no ejecutar.)

/*
DROP POLICY IF EXISTS "Usuarios autenticados pueden descargar releases" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden descargar releases"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app-releases');

DROP POLICY IF EXISTS "Solo Admin puede subir releases" ON storage.objects;
CREATE POLICY "Solo Admin puede subir releases"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Solo Admin puede actualizar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede actualizar releases"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()))
WITH CHECK (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()));

DROP POLICY IF EXISTS "Solo Admin puede eliminar releases" ON storage.objects;
CREATE POLICY "Solo Admin puede eliminar releases"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app-releases' AND public.is_user_admin(auth.uid()));
*/
