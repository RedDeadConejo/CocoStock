-- ============================================
-- CocoStock Producción - 01: Roles, Perfiles y Restaurantes
-- ============================================
-- Tablas: user_roles, user_profiles, restaurants
-- Funciones: is_user_admin, get_user_role_name, has_user_permission, handle_new_user, get_user_restaurant_id
-- RLS para todas las tablas

-- ========== USER_ROLES ==========
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO user_roles (role_name, description, permissions) VALUES
  ('admin', 'Administrador - Acceso completo', '{"view_dashboard":true,"view_inventory":true,"edit_inventory":true,"manage_stock":true,"manage_suppliers":true,"view_statistics":true,"edit_statistics":true,"manage_users":true,"manage_settings":true}'::jsonb),
  ('almacen', 'Almacén - Gestión de stock', '{"view_dashboard":true,"view_inventory":true,"edit_inventory":true,"manage_stock":true,"view_statistics":true}'::jsonb),
  ('tienda', 'Tienda - Ventas y productos', '{"view_dashboard":true,"view_inventory":true,"view_statistics":true}'::jsonb)
ON CONFLICT (role_name) DO NOTHING;

-- ========== RESTAURANTS (antes de user_profiles por FK restaurant_id) ==========
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  eliminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_restaurants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_restaurants_updated_at();

-- ========== USER_PROFILES ==========
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name VARCHAR(50) REFERENCES user_roles(role_name) DEFAULT 'tienda',
  full_name TEXT,
  phone TEXT,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_restaurant_id ON user_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_name ON user_profiles(role_name);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Función helper para evitar recursión en RLS (DEBE existir antes de políticas que la usan)
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_role VARCHAR(50);
BEGIN
  SELECT role_name INTO user_role FROM user_profiles WHERE id = user_id;
  RETURN COALESCE(user_role = 'admin', false);
END; $$;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;

-- Políticas user_roles
DROP POLICY IF EXISTS "Todos pueden ver cargos" ON user_roles;
CREATE POLICY "Todos pueden ver cargos" ON user_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins pueden crear roles" ON user_roles;
CREATE POLICY "Admins pueden crear roles" ON user_roles FOR INSERT WITH CHECK (is_user_admin((select auth.uid())));
DROP POLICY IF EXISTS "Admins pueden actualizar roles" ON user_roles;
CREATE POLICY "Admins pueden actualizar roles" ON user_roles FOR UPDATE USING (is_user_admin((select auth.uid()))) WITH CHECK (is_user_admin((select auth.uid())));
DROP POLICY IF EXISTS "Admins pueden eliminar roles" ON user_roles;
CREATE POLICY "Admins pueden eliminar roles" ON user_roles FOR DELETE USING (is_user_admin((select auth.uid())) AND role_name != 'admin');

-- Políticas user_profiles (una por acción para evitar multiple_permissive_policies)
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON user_profiles;
DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON user_profiles;
CREATE POLICY "Ver perfil propio o todos si admin" ON user_profiles FOR SELECT USING ((select auth.uid()) = id OR is_user_admin((select auth.uid())));
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON user_profiles;
CREATE POLICY "Usuarios pueden crear su propio perfil" ON user_profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil (excepto cargo)" ON user_profiles;
DROP POLICY IF EXISTS "Admins pueden cambiar cargos de usuarios" ON user_profiles;
CREATE POLICY "Actualizar perfil propio (sin cargo) o cualquiera si admin" ON user_profiles FOR UPDATE USING ((select auth.uid()) = id OR is_user_admin((select auth.uid()))) WITH CHECK (((select auth.uid()) = id AND NOT is_user_admin((select auth.uid()))) OR is_user_admin((select auth.uid())));

-- Funciones auxiliares
CREATE OR REPLACE FUNCTION get_user_role_name(user_id UUID) RETURNS VARCHAR(50) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r VARCHAR(50);
BEGIN SELECT COALESCE(up.role_name, 'tienda') INTO r FROM user_profiles up WHERE up.id = user_id; RETURN COALESCE(r, 'tienda'); END; $$;

-- Admin tiene todos los permisos; el resto por mapeo en user_roles.permissions
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_key TEXT) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role_name TEXT; v_perm_value TEXT;
BEGIN
  IF p_user_id IS NULL OR p_permission_key IS NULL OR trim(p_permission_key) = '' THEN RETURN false; END IF;
  SELECT up.role_name INTO v_role_name FROM user_profiles up WHERE up.id = p_user_id;
  IF v_role_name IS NULL THEN RETURN false; END IF;
  IF v_role_name = 'admin' THEN RETURN true; END IF;
  SELECT (ur.permissions->>p_permission_key) INTO v_perm_value FROM user_roles ur WHERE ur.role_name = v_role_name;
  RETURN (v_perm_value = 'true');
END; $$;
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT) TO authenticated;

-- Trigger: crear perfil al registrar usuario (rol por defecto = primer rol de user_roles, dinámico)
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE default_role TEXT;
BEGIN
  SELECT role_name INTO default_role FROM user_roles ORDER BY role_name LIMIT 1;
  IF default_role IS NULL THEN RAISE EXCEPTION 'No hay roles en user_roles.'; END IF;
  INSERT INTO public.user_profiles (id, role_name) VALUES (NEW.id, default_role);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Restaurantes: función para obtener restaurant_id del usuario
CREATE OR REPLACE FUNCTION get_user_restaurant_id(user_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid UUID; BEGIN SELECT up.restaurant_id INTO rid FROM user_profiles up WHERE up.id = user_id; RETURN rid; END; $$;
GRANT EXECUTE ON FUNCTION get_user_restaurant_id(UUID) TO authenticated;

-- RLS restaurantes (después de user_profiles e is_user_admin)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver restaurantes activos" ON restaurants;
CREATE POLICY "Usuarios pueden ver restaurantes activos" ON restaurants FOR SELECT USING (eliminado = false);
DROP POLICY IF EXISTS "Admins pueden crear restaurantes" ON restaurants;
CREATE POLICY "Admins pueden crear restaurantes" ON restaurants FOR INSERT WITH CHECK (is_user_admin((select auth.uid())));
DROP POLICY IF EXISTS "Admins pueden actualizar restaurantes" ON restaurants;
CREATE POLICY "Admins pueden actualizar restaurantes" ON restaurants FOR UPDATE USING (is_user_admin((select auth.uid())));
