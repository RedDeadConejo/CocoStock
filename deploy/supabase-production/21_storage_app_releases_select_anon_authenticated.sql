-- ============================================
-- CocoStock - 21: Storage app-releases — SELECT para anon + authenticated
-- ============================================
--
-- Contexto
-- --------
-- La tabla public.app_releases suele tener SELECT para anon + authenticated (p. ej. script 20),
-- así que cualquiera puede saber version y file_path.
-- Si storage.objects solo tiene SELECT para authenticated (script 12), las peticiones a Storage
-- con rol anon fallan: el cliente sin sesión (o con JWT anon) usa Authorization = anon key.
-- El API de Storage suele responder con error tipo «Object not found» / 400 aunque el archivo exista.
--
-- Síntoma: actualización se detecta (PostgREST con anon OK) pero createSignedUrl o la descarga fallan;
-- en Windows 7 a veces pasa más si la sesión no se restaura igual que en Win10+.
--
-- Qué hace este script
-- -------------------
-- Sustituye la política de solo-authenticated por una política que permite leer objetos del
-- bucket app-releases tanto con rol anon como authenticated (coherente con metadata pública).
--
-- Ejecutar en Supabase SQL Editor. Si «must be owner» impide DROP, borra la política antigua en
-- Dashboard → Storage → app-releases → Policies y crea manualmente la misma expresión.
-- ============================================

DROP POLICY IF EXISTS "Usuarios autenticados pueden descargar releases" ON storage.objects;
DROP POLICY IF EXISTS "CocoStock app-releases SELECT anon authenticated v1" ON storage.objects;

CREATE POLICY "CocoStock app-releases SELECT anon authenticated v1"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'app-releases');
