-- ============================================
-- CocoStock Producción - 11: Permisos por defecto en roles (todo por mapeo; admin excepción)
-- ============================================
-- view_all_*: ver todos los registros. view_platos / view_merma: ver/editar solo del propio restaurante.

UPDATE user_roles SET permissions = permissions || '{"view_dashboard":true,"view_inventory":true,"view_orders":true,"view_all_orders":true,"view_platos":true,"view_platos_all":true,"view_merma":true,"view_merma_all":true,"view_purchases":true,"view_all_purchases":true,"view_suppliers":true,"view_statistics":true,"view_account":true,"view_settings":true,"view_settings_roles":true,"view_settings_users":true,"view_settings_restaurants":true,"view_settings_authorized_ips":true,"view_settings_local_servers":true,"create_server_merma":true,"create_server_full":true,"manage_roles":true,"create_orders":true,"complete_orders":true,"create_purchases":true,"complete_purchases":true,"edit_inventory":true}'::jsonb WHERE role_name = 'admin';

UPDATE user_roles SET permissions = permissions || '{"view_dashboard":true,"view_inventory":true,"view_orders":true,"view_all_orders":true,"view_platos":true,"view_platos_all":true,"view_merma":true,"view_merma_all":true,"view_purchases":true,"view_all_purchases":true,"view_statistics":true,"view_account":true,"complete_orders":true,"create_purchases":true,"complete_purchases":true,"edit_inventory":true}'::jsonb WHERE role_name = 'almacen';

UPDATE user_roles SET permissions = permissions || '{"view_dashboard":true,"view_inventory":true,"view_orders":true,"view_platos":true,"view_merma":true,"view_statistics":true,"view_account":true,"view_settings":true,"view_settings_authorized_ips":true,"view_settings_local_servers":true,"create_server_merma":true,"create_orders":true,"create_purchases":true}'::jsonb WHERE role_name = 'tienda';
