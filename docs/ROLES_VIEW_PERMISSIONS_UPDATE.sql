-- Actualizar permisos de vistas en roles existentes
-- Permite que el acceso a cada pestaña se controle desde Configuración > Roles
-- Ejecutar una vez para que admin, almacen y tienda sigan teniendo el mismo acceso que antes

-- Admin: acceso a todas las vistas y subsecciones de Configuración
UPDATE user_roles
SET permissions = permissions || '{
  "view_dashboard": true,
  "view_inventory": true,
  "view_orders": true,
  "view_platos": true,
  "view_merma": true,
  "view_purchases": true,
  "view_suppliers": true,
  "view_statistics": true,
  "view_account": true,
  "view_settings": true,
  "view_settings_roles": true,
  "view_settings_users": true,
  "view_settings_restaurants": true,
  "view_settings_authorized_ips": true,
  "view_settings_local_servers": true,
  "create_server_merma": true,
  "create_server_full": true,
  "manage_roles": true,
  "create_orders": true,
  "complete_orders": true,
  "create_purchases": true,
  "complete_purchases": true,
  "edit_inventory": true
}'::jsonb
WHERE role_name = 'admin';

-- Almacén: mismo acceso que antes (sin suppliers ni settings)
UPDATE user_roles
SET permissions = permissions || '{
  "view_dashboard": true,
  "view_inventory": true,
  "view_orders": true,
  "view_platos": true,
  "view_merma": true,
  "view_purchases": true,
  "view_statistics": true,
  "view_account": true,
  "complete_orders": true,
  "create_purchases": true,
  "complete_purchases": true,
  "edit_inventory": true
}'::jsonb
WHERE role_name = 'almacen';

-- Tienda (restaurante): vistas + Configuración (IPs y Servidores locales) y crear servidor Merma
UPDATE user_roles
SET permissions = permissions || '{
  "view_dashboard": true,
  "view_inventory": true,
  "view_orders": true,
  "view_platos": true,
  "view_merma": true,
  "view_statistics": true,
  "view_account": true,
  "view_settings": true,
  "view_settings_authorized_ips": true,
  "view_settings_local_servers": true,
  "create_server_merma": true,
  "create_orders": true,
  "create_purchases": true
}'::jsonb
WHERE role_name = 'tienda';
