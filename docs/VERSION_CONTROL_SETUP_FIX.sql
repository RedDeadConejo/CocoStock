-- ============================================
-- Fix para Control de Versiones
-- ============================================
-- Este script corrige las políticas RLS para permitir
-- que usuarios NO autenticados puedan leer la versión mínima requerida
-- (necesario porque la verificación se hace antes del login)

-- Eliminar la política existente de lectura
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer versión mínima" ON app_version;

-- Crear nueva política que permite lectura a TODOS (incluyendo no autenticados)
CREATE POLICY "Cualquiera puede leer versión mínima"
  ON app_version
  FOR SELECT
  TO public
  USING (is_active = true);

-- La política de escritura/gestión sigue siendo solo para autenticados
-- (ya existe, no necesita cambios)

