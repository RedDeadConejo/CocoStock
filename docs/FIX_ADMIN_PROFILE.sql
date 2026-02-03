-- Script para verificar y corregir el perfil del administrador
-- Ejecuta este script en Supabase SQL Editor

-- ============================================
-- VERIFICAR PERFIL DEL ADMIN
-- ============================================

-- Reemplaza 'TU_USER_ID_AQUI' con el ID del usuario admin
-- Puedes obtener el ID desde la consola del navegador o desde auth.users en Supabase

-- Verificar si el perfil existe
SELECT 
  id,
  role_name,
  full_name,
  phone,
  created_at
FROM user_profiles
WHERE id = '31b0109b-a382-4892-b09c-83d07f86a15f';

-- ============================================
-- CREAR O ACTUALIZAR PERFIL COMO ADMIN
-- ============================================

-- Si el perfil no existe, crearlo
INSERT INTO user_profiles (id, role_name)
VALUES ('31b0109b-a382-4892-b09c-83d07f86a15f', 'admin')
ON CONFLICT (id) 
DO UPDATE SET 
  role_name = 'admin',
  updated_at = now();

-- ============================================
-- VERIFICAR DESPUÉS DE LA ACTUALIZACIÓN
-- ============================================

SELECT 
  id,
  role_name,
  full_name,
  phone,
  created_at,
  updated_at
FROM user_profiles
WHERE id = '31b0109b-a382-4892-b09c-83d07f86a15f';

-- ============================================
-- VERIFICAR POLÍTICAS RLS
-- ============================================

-- Verificar que RLS esté habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- Listar todas las políticas de user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- ============================================
-- SI HAY PROBLEMAS CON RLS, EJECUTAR ESTO:
-- ============================================

-- Asegurar que RLS esté habilitado
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Verificar que la política básica existe
-- (Esta debería permitir que cualquier usuario vea su propio perfil)
SELECT * FROM pg_policies 
WHERE tablename = 'user_profiles' 
AND policyname = 'Usuarios pueden ver su propio perfil';

-- Si no existe, crearla:
-- (Ya debería estar creada por ROLE_MANAGEMENT_SETUP.sql, pero por si acaso)
-- DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON user_profiles;
-- CREATE POLICY "Usuarios pueden ver su propio perfil"
--   ON user_profiles FOR SELECT
--   USING (auth.uid() = id);
