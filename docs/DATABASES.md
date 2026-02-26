# Organización de bases de datos – CocoStock

CocoStock usa **un solo proyecto de Supabase** (PostgreSQL) con los datos separados por **esquemas** para distinguir el **backoffice** (gestión) del **TPV** (punto de venta / front).

## Esquemas

| Schema    | Uso        | Contenido |
|----------|------------|-----------|
| **public** | Backoffice | Usuarios, roles, restaurantes, productos, proveedores, pedidos, compras, platos, merma, historial de stock, versiones de app, etc. |
| **tpv**    | TPV        | Ventas (tickets), líneas de venta, y en el futuro mesas/comandas si se implementan. |

No hay dos bases de datos físicas distintas: es la misma instancia de Supabase con dos esquemas de PostgreSQL. Así se mantiene una sola conexión, un solo Auth y un orden claro entre gestión y caja.

## Tablas del TPV (schema `tpv`)

- **tpv.sales** — Cabecera de cada venta/ticket: restaurante, usuario, total, estado (open/closed/cancelled), notas, fecha cierre.
- **tpv.sale_items** — Líneas de la venta: producto o plato, nombre, cantidad, precio unitario, subtotal. Referencias a `public.products` y `public.dishes`.

El backoffice sigue usando solo el schema **public** (igual que hasta ahora).

## Cómo usar el TPV en código

En el front, para acceder a tablas del TPV se usa el helper que aplica el schema:

```js
import { getTpv, TPV_TABLES } from '../services/tpv/supabaseTpv';

const tpv = getTpv();

// Listar ventas abiertas
const { data: sales } = await tpv.from(TPV_TABLES.SALES).select('*').eq('status', 'open');

// Crear una venta
const { data: sale } = await tpv.from(TPV_TABLES.SALES).insert({ restaurant_id, created_by: userId, status: 'open' }).select().single();
```

La autenticación es la misma que en el backoffice (mismo `supabase` y mismo Auth); solo cambia el schema en las consultas a tablas del TPV.

## Configuración en Supabase

Para que la API de Supabase exponga las tablas del TPV hay que **exponer el schema** en el proyecto:

1. Supabase Dashboard → **Project Settings** (engranaje).
2. **API** → sección **Schema**.
3. En **Exposed schemas** añadir: **tpv** (además de `public`).

Si no se expone el schema `tpv`, las llamadas a `supabase.schema('tpv').from(...)` fallarán por API.

## Migraciones

Los scripts de migración están en `deploy/supabase-production/`:

- **13_schema_tpv.sql** — Crea el schema `tpv`, tablas `sales` y `sale_items`, RLS y permisos básicos.
- **14_tpv_roles_permissions.sql** — Añade los permisos de TPV a los roles (admin, almacen, tienda): `view_tpv_sales`, `create_tpv_sales`, `manage_tpv_sales`.

Orden de aplicación: primero el resto de migraciones de `public` (01–12), luego 13 y 14.

## Permisos TPV (roles)

Los permisos del TPV se comprueban en las políticas RLS del schema `tpv`:

- **view_tpv_sales** — Ver ventas (propias del restaurante o todas según política).
- **create_tpv_sales** — Crear ventas y añadir líneas a ventas abiertas.
- **manage_tpv_sales** — Cerrar/cancelar ventas y editar/eliminar líneas de ventas abiertas.

Por defecto, admin, almacen y tienda tienen los tres permisos (ver 14_tpv_roles_permissions.sql). Si creas nuevos roles, puedes asignarles solo algunos de estos permisos.
