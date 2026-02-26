-- ============================================
-- CocoStock Producción - 14: Permisos de roles para TPV
-- ============================================
-- Añade permisos view_tpv_sales, create_tpv_sales, manage_tpv_sales a los roles.
-- Ejecutar después de 13_schema_tpv.sql y 11_permisos_roles.sql.

-- view_tpv: ver menú/vista TPV; view_tpv_sales, create_tpv_sales, manage_tpv_sales: uso del punto de venta
UPDATE public.user_roles
SET permissions = permissions || '{"view_tpv":true,"view_tpv_sales":true,"create_tpv_sales":true,"manage_tpv_sales":true}'::jsonb
WHERE role_name = 'admin';

UPDATE public.user_roles
SET permissions = permissions || '{"view_tpv":true,"view_tpv_sales":true,"create_tpv_sales":true,"manage_tpv_sales":true}'::jsonb
WHERE role_name = 'almacen';

UPDATE public.user_roles
SET permissions = permissions || '{"view_tpv":true,"view_tpv_sales":true,"create_tpv_sales":true,"manage_tpv_sales":true}'::jsonb
WHERE role_name = 'tienda';
