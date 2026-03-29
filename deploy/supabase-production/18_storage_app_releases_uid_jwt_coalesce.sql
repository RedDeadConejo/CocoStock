-- ============================================
-- CocoStock - 18: Storage app-releases — uid efectivo (auth.uid + JWT sub)
-- ============================================
-- En algunos contextos de Storage, auth.uid() puede ser NULL mientras el JWT
-- sigue válido; is_user_admin / user_has_permission reciben NULL y devuelven false.
-- Este script AÑADE políticas con nombres nuevos (no hace DROP). RLS permissive:
-- basta que UNA política permita la operación.
--
-- Tras ejecutar, puedes borrar desde el Dashboard políticas duplicadas/obsoletas.
-- Requiere: bucket app-releases, funciones public.is_user_admin y user_has_permission.

CREATE POLICY "CocoStock app-releases INSERT uid_jwt v1"
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

CREATE POLICY "CocoStock app-releases UPDATE uid_jwt v1"
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

CREATE POLICY "CocoStock app-releases DELETE uid_jwt v1"
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
