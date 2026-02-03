-- Sistema de Cargos/Funciones - CocoStock
-- Este script crea la estructura de cargos y permisos basada en funciones

-- Tabla de cargos disponibles
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar cargos por defecto
INSERT INTO user_roles (role_name, description, permissions) VALUES
  ('admin', 'Administrador - Acceso completo a todas las funciones', '{
    "view_dashboard": true,
    "view_inventory": true,
    "edit_inventory": true,
    "manage_stock": true,
    "manage_suppliers": true,
    "view_statistics": true,
    "edit_statistics": true,
    "manage_users": true,
    "manage_settings": true
  }'),
  ('almacen', 'Almacén - Gestión de stock e inventario', '{
    "view_dashboard": true,
    "view_inventory": true,
    "edit_inventory": true,
    "manage_stock": true,
    "view_statistics": true
  }'),
  ('tienda', 'Tienda - Gestión de ventas y productos para tienda', '{
    "view_dashboard": true,
    "view_inventory": true,
    "view_statistics": true
  }')
ON CONFLICT (role_name) DO NOTHING;

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name VARCHAR(50) REFERENCES user_roles(role_name) DEFAULT 'tienda',
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Función para obtener el cargo del usuario actual
CREATE OR REPLACE FUNCTION get_user_role_name(user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  user_role_name VARCHAR(50);
BEGIN
  SELECT COALESCE(up.role_name, 'tienda') INTO user_role_name
  FROM user_profiles up
  WHERE up.id = user_id;
  
  RETURN COALESCE(user_role_name, 'tienda'); -- Default: tienda
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si el usuario tiene un permiso
CREATE OR REPLACE FUNCTION has_user_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_name VARCHAR(50);
  role_permissions JSONB;
  has_permission BOOLEAN;
BEGIN
  -- Obtener el cargo del usuario
  SELECT up.role_name INTO user_role_name
  FROM user_profiles up
  WHERE up.id = user_id;
  
  -- Si no tiene perfil, usar cargo por defecto
  IF user_role_name IS NULL THEN
    user_role_name := 'tienda';
  END IF;
  
  -- Obtener permisos del cargo
  SELECT permissions INTO role_permissions
  FROM user_roles
  WHERE role_name = user_role_name;
  
  -- Verificar el permiso
  has_permission := COALESCE((role_permissions->permission_name)::boolean, false);
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_roles (todos pueden ver los cargos)
CREATE POLICY "Todos pueden ver cargos"
  ON user_roles FOR SELECT
  USING (true);

-- Políticas RLS para user_profiles
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Política para que los usuarios puedan crear su propio perfil si no existe
CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil (excepto cargo)"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Solo administradores pueden cambiar cargos
CREATE POLICY "Admins pueden cambiar cargos de usuarios"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

-- Función para crear perfil automáticamente cuando se crea un usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role_name)
  VALUES (NEW.id, 'tienda'); -- Default: tienda
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
