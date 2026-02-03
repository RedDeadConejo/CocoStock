-- =============================================================================
-- "Database error creating new user" - Arreglo del trigger en auth.users
-- El trigger on_auth_user_created llama a handle_new_user() que insertaba
-- role_name = 'tienda'. Si ese rol ya no existe (ej. lo renombraste a restaurante),
-- el INSERT falla. Esta función usa el PRIMER rol de user_roles (dinámico).
-- =============================================================================
-- Ejecuta TODO este bloque en Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- Reemplazar la función para que use un rol que exista en user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role TEXT;
BEGIN
  -- Obtener el primer rol disponible (orden alfabético)
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

-- No hace falta tocar el trigger; ya existe y seguirá llamando a handle_new_user().
-- A partir de ahora el trigger usará el primer rol de user_roles (ej. admin, almacen, restaurante).
