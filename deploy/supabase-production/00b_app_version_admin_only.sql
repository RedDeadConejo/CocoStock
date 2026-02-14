-- ============================================
-- CocoStock - Restringir app_version a solo Admin
-- ============================================
-- Solo administradores pueden insertar/actualizar/eliminar la versión mínima.
-- La lectura (SELECT) sigue siendo pública para el login. is_user_admin en 01_roles.
-- Ejecutar tras 00_app_version.sql y 01_roles_perfiles_restaurantes.sql.

DROP POLICY IF EXISTS "Solo servicio puede escribir app_version" ON app_version;

CREATE POLICY "Solo Admin puede insertar app_version" ON app_version
  FOR INSERT TO authenticated
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Solo Admin puede actualizar app_version" ON app_version
  FOR UPDATE TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Solo Admin puede eliminar app_version" ON app_version
  FOR DELETE TO authenticated
  USING (public.is_user_admin(auth.uid()));
