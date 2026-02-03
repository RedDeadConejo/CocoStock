# Implementación de la auditoría Supabase

Resumen de lo implementado según `AUDITORIA_SUPABASE.md` y **orden de ejecución** de los scripts SQL en Supabase.

---

## Orden de ejecución de scripts SQL

Ejecutar en Supabase (SQL Editor) **en este orden**:

| Orden | Archivo | Contenido |
|-------|---------|-----------|
| 1 | `ROLE_MANAGEMENT_SETUP.sql` | `is_user_admin`, políticas base |
| 2 | `ROLES_USERS_RPC.sql` | `user_has_permission`, `rename_role`, `delete_role`, `get_view_permissions_map` |
| 3 | `ORDERS_RPC.sql` | `create_order`, `complete_order` |
| 4 | `PURCHASES_RPC.sql` | `create_purchase`, `complete_purchase` |
| 5 | `PRODUCTS_RPC.sql` | `create_product`, `update_product`, `soft_delete_product` |
| 6 | `VIEWS_ORDERS_PURCHASES_WITH_CREATOR.sql` | `get_orders_with_creators`, `get_purchases_with_creators` |
| 7 | `ROLES_VIEW_PERMISSIONS_UPDATE.sql` | Actualiza permisos por defecto en roles admin, almacen, tienda |

---

## Estado por sección de la auditoría

| Sección | Tema | Estado | Archivos / cambios |
|---------|------|--------|--------------------|
| 1.1 | Renombrar rol | Hecho | RPC `rename_role` en ROLES_USERS_RPC.sql; roleManagement.js usa la RPC |
| 1.2 | Eliminar rol | Hecho | RPC `delete_role` en ROLES_USERS_RPC.sql; roleManagement.js usa la RPC |
| 1.3 | Mapa permisos vistas | Hecho | RPC `get_view_permissions_map` en ROLES_USERS_RPC.sql; roleManagement.js usa la RPC con fallback |
| 1.4 | Crear usuario | Hecho | createUser solo vía Edge Function `create-user`; roleManagement.js |
| 2.1 | Crear pedido con ítems | Hecho | RPC `create_order` en ORDERS_RPC.sql; orders.js usa la RPC con fallback |
| 2.2 | Completar pedido | Hecho | RPC `complete_order` en ORDERS_RPC.sql; orders.js usa la RPC con fallback |
| 3.1 | Crear compra con ítems | Hecho | RPC `create_purchase` en PURCHASES_RPC.sql; purchases.js usa la RPC con fallback |
| 3.2 | Completar compra | Hecho | RPC `complete_purchase` en PURCHASES_RPC.sql; purchases.js usa la RPC con fallback |
| 4.1 | Crear producto + historial | Hecho | RPC `create_product` en PRODUCTS_RPC.sql; products.js usa la RPC con fallback |
| 4.2 | Actualizar producto + historial | Hecho | RPC `update_product` en PRODUCTS_RPC.sql; products.js usa la RPC con fallback |
| 4.3 | Soft delete producto | Hecho | RPC `soft_delete_product` en PRODUCTS_RPC.sql; products.js usa la RPC con fallback |
| 5.1 | Pedidos/Compras con creador | Hecho | RPC `get_orders_with_creators`, `get_purchases_with_creators` en VIEWS_ORDERS_PURCHASES_WITH_CREATOR.sql; orders.js y purchases.js usan RPC con fallback |

---

## Permisos en roles (ROLES_VIEW_PERMISSIONS_UPDATE.sql)

Incluye, entre otros:

- **admin**: vistas, `manage_roles`, `create_orders`, `complete_orders`, `create_purchases`, `complete_purchases`, `edit_inventory`, permisos de Configuración y servidores.
- **almacen**: vistas (sin suppliers/settings completos), `complete_orders`, `create_purchases`, `complete_purchases`, `edit_inventory`.
- **tienda**: vistas, `view_settings` (IPs y servidores locales), `create_server_merma`, `create_orders`, `create_purchases`.

---

## Notas

- Todas las RPCs de negocio tienen **fallback** en el cliente: si la RPC no existe o falla, se usa la lógica anterior (varias consultas o Edge Function).
- Las RPCs de productos y soft delete usan el permiso `edit_inventory`; los roles `admin` y `almacen` lo tienen por defecto y también se comprueba por nombre de rol en la RPC.
- Secciones 6, 7 y 8 de la auditoría son resumen, lo ya bien apoyado en Supabase y nota sobre IPs/servidores locales; no requieren cambios adicionales.
