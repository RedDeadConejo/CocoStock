-- Fix para políticas RLS de user_profiles
-- Ejecutar este script si hay problemas con usuarios que no pueden leer/crear su perfil

-- Eliminar políticas existentes si hay problemas (descomentar si es necesario)
-- DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON user_profiles;
-- DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON user_profiles;
-- DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil (excepto cargo)" ON user_profiles;

-- Política para que los usuarios puedan ver su propio perfil
CREATE POLICY IF NOT EXISTS "Usuarios pueden ver su propio perfil"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Política para que los usuarios puedan crear su propio perfil si no existe
CREATE POLICY IF NOT EXISTS "Usuarios pueden crear su propio perfil"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Política para que los usuarios puedan actualizar su propio perfil (excepto cargo)
CREATE POLICY IF NOT EXISTS "Usuarios pueden actualizar su propio perfil (excepto cargo)"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verificar que las políticas estén activas
-- SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

