-- =============================================================================
-- HOTFIX: Roles, Perfiles y Restaurantes
-- Ejecutar en Supabase Dashboard → SQL Editor → Run
-- =============================================================================
-- 1) Asegura que el rol 'restaurante' existe en user_roles
-- 2) Migra perfiles que tengan role_name 'tienda' → 'restaurante'
-- 3) Trigger handle_new_user() usa rol dinámico (primer rol de user_roles)
-- 4) Opcional: quitar rol 'tienda' de user_roles si ya no se usa
-- =============================================================================

-- 1) Rol 'restaurante' en user_roles (si no existe)
INSERT INTO user_roles (role_name, description, permissions)
VALUES (
  'restaurante',
  'Restaurante - Gestión de ventas y productos',
  '{"view_dashboard":true,"view_orders":true,"view_platos":true,"view_merma":true,"view_account":true,"view_settings":true}'::jsonb
)
ON CONFLICT (role_name) DO NOTHING;

-- 2) Migrar perfiles que sigan con 'tienda' a 'restaurante'
UPDATE user_profiles
SET role_name = 'restaurante'
WHERE role_name = 'tienda';

-- 3) Función handle_new_user: rol por defecto = primer rol de user_roles (dinámico)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role TEXT;
BEGIN
  SELECT role_name INTO default_role
  FROM user_roles
  ORDER BY role_name
  LIMIT 1;

  IF default_role IS NULL THEN
    RAISE EXCEPTION 'No hay roles en user_roles. Crea al menos un rol en Configuración.';
  END IF;

  INSERT INTO public.user_profiles (id, role_name)
  VALUES (NEW.id, default_role);
  RETURN NEW;
END;
$$;

-- 4) Opcional: eliminar el rol 'tienda' de user_roles (solo si ya no hay perfiles con ese rol)
-- Descomenta la línea siguiente si quieres borrar el rol 'tienda':
-- DELETE FROM user_roles WHERE role_name = 'tienda';

-- 5) Ajustar default de la columna user_profiles.role_name si sigue siendo 'tienda'
-- (evita errores en INSERTs que no especifiquen role_name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE role_name = 'restaurante') THEN
    ALTER TABLE user_profiles ALTER COLUMN role_name SET DEFAULT 'restaurante';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL; -- ignorar si el default ya es correcto o no aplica
END $$;
