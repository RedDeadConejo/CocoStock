-- Sistema de Restaurantes - CocoStock
-- Este script crea la estructura de restaurantes y los enlaces con usuarios y pedidos

-- Tabla de restaurantes
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

-- Agregar columna restaurant_id a user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- Agregar columna restaurant_id a orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_restaurants_eliminado ON restaurants(eliminado);
CREATE INDEX IF NOT EXISTS idx_restaurants_nombre ON restaurants(nombre);
CREATE INDEX IF NOT EXISTS idx_user_profiles_restaurant_id ON user_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_restaurants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurants_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para restaurants
-- Todos los usuarios autenticados pueden ver restaurantes activos
CREATE POLICY "Usuarios pueden ver restaurantes activos"
  ON restaurants FOR SELECT
  USING (eliminado = false);

-- Solo admins pueden crear restaurantes
CREATE POLICY "Admins pueden crear restaurantes"
  ON restaurants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

-- Solo admins pueden actualizar restaurantes
CREATE POLICY "Admins pueden actualizar restaurantes"
  ON restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

-- Solo admins pueden eliminar restaurantes (soft delete)
CREATE POLICY "Admins pueden eliminar restaurantes"
  ON restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role_name = 'admin'
    )
  );

-- Función para obtener el restaurant_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_restaurant_id(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restaurant_id UUID;
BEGIN
  SELECT up.restaurant_id INTO restaurant_id
  FROM user_profiles up
  WHERE up.id = user_id;
  RETURN restaurant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_restaurant_id(UUID) TO authenticated;

-- Comentarios en las tablas
COMMENT ON TABLE restaurants IS 'Tabla de restaurantes/tiendas';
COMMENT ON COLUMN user_profiles.restaurant_id IS 'Restaurante al que está asignado el usuario';
COMMENT ON COLUMN orders.restaurant_id IS 'Restaurante al que pertenece el pedido';
