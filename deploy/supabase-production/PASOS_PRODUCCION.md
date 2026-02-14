# Despliegue de Supabase en producción (CocoStock)

Guía para crear el proyecto Supabase en una **cuenta nueva** (producción) y montar el servidor con los scripts consolidados de esta carpeta. Los archivos SQL están **limpios**, con todas las correcciones ya aplicadas y en el **orden correcto** de ejecución.

---

## Requisitos previos

- Cuenta en [Supabase](https://supabase.com) (la de producción, distinta a la de desarrollo).
- Proyecto CocoStock clonado o el código listo para apuntar a la nueva URL/anon key.

---

## Paso 1: Crear el proyecto en Supabase

1. Entra en [app.supabase.com](https://app.supabase.com) con la cuenta de **producción**.
2. **New project**: elige organización, nombre (ej. `cocostock-prod`), contraseña de base de datos (guárdala en un gestor de contraseñas).
3. Elige región cercana a tus usuarios.
4. Espera a que el proyecto esté listo (verde).

---

## Paso 2: Ejecutar los scripts SQL en orden

En el panel del proyecto: **SQL Editor** → New query. Ejecuta **cada archivo** de esta carpeta **en este orden**, uno tras otro (o pega el contenido de cada archivo y ejecuta).

| Orden | Archivo | Contenido |
|-------|---------|-----------|
| 0 | `00_app_releases.sql` | Tabla `app_releases` (actualizaciones). Platform: win32, darwin-x64, darwin-arm64, linux. |
| 0a | `00a_app_releases_mac_arch.sql` | (Opcional) Migración si tenías releases con platform='darwin'. |
| 0b | `00_app_version.sql` | Tabla `app_version` (control de versión mínima en login). RLS lectura pública. |
| 0c | `00b_app_version_admin_only.sql` | Restringe escritura en app_version a solo Admin. |
| 1 | `01_roles_perfiles_restaurantes.sql` | Tablas `user_roles`, `user_profiles`, `restaurants`. Trigger perfil nuevo usuario. Función `is_user_admin`. RLS. |
| 2 | `02_productos_inventario.sql` | Tablas `products`, `suppliers`, `product_suppliers`, `product_changes_history`, `stock_history`. RLS. `soft_delete_supplier`. |
| 3 | `03_pedidos_compras.sql` | Tablas `orders`, `order_items`, `purchases`, `purchase_items` (con `restaurant_id`, `quantity_requested`, `quantity_sent`). RLS. |
| 4 | `04_platos_merma.sql` | Tablas `dishes`, `dish_ingredients`, `merma`, `merma_server_tokens`. RLS. RPCs merma. |
| 4b | `04b_dish_ingredients_unit.sql` | Columna `unit` en `dish_ingredients` (unidad por ingrediente en recetas). |
| 5 | `05_rpc_usuarios.sql` | `get_all_users_with_profiles`. |
| 6 | `06_rpc_roles_usuarios.sql` | `user_has_permission`, `rename_role`, `delete_role`, `get_view_permissions_map`. |
| 7 | `07_rpc_pedidos.sql` | `create_order`, `complete_order`. |
| 8 | `08_rpc_compras.sql` | `create_purchase`, `complete_purchase`. |
| 9 | `09_rpc_productos.sql` | `create_product`, `update_product`, `soft_delete_product`. |
| 10 | `10_rpc_listas_creador.sql` | `get_orders_with_creators`, `get_purchases_with_creators`. |
| 11 | `11_permisos_roles.sql` | Permisos por defecto para roles `admin`, `almacen`, `tienda`. |
| 12 | `12_storage_app_releases.sql` | Políticas de Storage: solo usuarios autenticados pueden descargar; solo Admin puede subir releases. |

**Importante:** No cambies el orden. Cada script depende del anterior (tablas, funciones o permisos).

**Storage (app-releases):** Tras ejecutar `12_storage_app_releases.sql`, el bucket `app-releases` debe ser **privado**. Si no existe, créalo en Storage → New bucket → id: `app-releases` → Private. Si ya existe como público, configúralo como privado en la configuración del bucket.

---

## Paso 3: Configurar Auth (obligatorio para invitaciones y restablecer contraseña)

Si **no puedes invitar usuarios** o **reiniciar contraseñas** y los enlaces del correo llevan a `localhost`, es porque Supabase está usando la URL de desarrollo para generar esos enlaces. Hay que apuntar a la URL real de tu app.

### 3.1 Site URL y Redirect URLs

1. En el proyecto de Supabase: **Authentication** → **URL Configuration**.
2. **Site URL:** pon la URL pública de tu aplicación (producción), por ejemplo:
   - `https://tudominio.com`
   - o `https://cocostock.tudominio.com`
   - No uses `http://localhost:5173` ni una IP local si la app ya está en producción.
3. **Redirect URLs:** añade las URLs a las que Supabase puede redirigir tras login, invitación o reset de contraseña. Debe incluir al menos:
   - La misma que pusiste en Site URL, p. ej. `https://tudominio.com`
   - Y si quieres seguir probando en local: `http://localhost:5173` (o el puerto que uses).
   - Puedes usar comodín para rutas: `https://tudominio.com/**`

Ejemplo si tu app en producción es `https://app.cocostock.com`:

| Campo          | Valor                          |
|----------------|---------------------------------|
| **Site URL**   | `https://app.cocostock.com`     |
| **Redirect URLs** | `https://app.cocostock.com/**` y, si usas local, `http://localhost:5173/**` |

Guarda los cambios. A partir de ahí, los correos de **invitación** y de **restablecer contraseña** llevarán a tu dominio real y no a localhost.

### 3.2 No tengo dominio propio (solo Supabase + app)

Si **no tienes un dominio** (solo usas Supabase como backend y tu app en local o en un servicio gratuito), necesitas una **URL pública** donde esté tu frontend para que los enlaces de invitación y de restablecer contraseña funcionen. Sin esa URL, los correos seguirán apuntando a localhost y no servirán para otros usuarios.

**Opciones gratuitas (te dan una URL tipo subdominio):**

1. **Vercel** – Subes tu proyecto (Vite/React) y te dan una URL como `https://cocostock.vercel.app`.
2. **Netlify** – Igual: despliegas la app y obtienes `https://cocostock.netlify.app` (o un nombre que elijas).
3. **Cloudflare Pages** – Similar: `https://cocostock.pages.dev`.

**Qué hacer:**

1. Despliega tu app en uno de esos servicios (o en el que ya uses).
2. Anota la URL pública que te den (ej. `https://cocostock.vercel.app`).
3. En Supabase: **Authentication** → **URL Configuration**:
   - **Site URL:** esa URL (ej. `https://cocostock.vercel.app`).
   - **Redirect URLs:** la misma con `/**`, ej. `https://cocostock.vercel.app/**`. Si además usas la app en local, añade `http://localhost:5173/**`.
4. Guarda.

A partir de ahí, los enlaces de los correos (invitar, restablecer contraseña) llevarán a tu app en esa URL pública y no a localhost. No necesitas comprar un dominio; el subdominio que te da Vercel/Netlify/Cloudflare vale.

**Si la app solo corre en tu PC (localhost):** los enlaces solo funcionarán si quien hace clic está en esa misma máquina con la app abierta. Para que otros usuarios puedan aceptar invitaciones o restablecer contraseña, la app tiene que estar publicada en una URL accesible (por ejemplo con uno de los servicios de arriba).

### 3.2.1 No quiero tener webapp (solo app de escritorio o local)

Si **no quieres publicar la app en internet** (solo la usas en local o como app de escritorio), no hace falta tener dominio ni URL pública. Puedes seguir así:

- **Dar de alta usuarios:** no uses “Invitar por correo” (ese flujo necesita un enlace web). Usa **crear usuario** desde tu app: en Configuración → Usuarios, creas el usuario con email y contraseña (tu flujo con la Edge Function `create-user`). La contraseña se la pasas al usuario por otro canal (en persona, por otro medio, etc.). Así no dependes de ningún enlace en el correo.
- **Restablecer contraseña:** como no hay web a la que redirigir, el usuario no puede usar “He olvidado mi contraseña” del correo. El admin puede:
  - En **Supabase:** Authentication → Users → elegir usuario → menú (⋯) → **Send password recovery** solo si tienes Site URL; si no, mejor usar la opción de abajo.
  - O en **Supabase:** Authentication → Users → elegir usuario → **Reset password** (o editar y poner una contraseña temporal) y comunicársela al usuario.

Resumen: sin webapp, evitas los enlaces de invitación y de “recuperar contraseña”. Creas usuarios desde la app con contraseña y la compartes tú; si alguien pierde la contraseña, un admin la resetea desde el Dashboard de Supabase (o desde tu app si añades esa función para admins).

### 3.3 Otros ajustes de Auth

- En **Authentication → Providers** deja habilitado **Email** (y los que uses).
- Revisa **Email Templates** (Authentication → Email Templates) si quieres personalizar el texto de los correos; la URL del enlace la sigue generando Supabase con la Site URL anterior.

---

## Paso 4: Desplegar Edge Functions

La app usa las Edge Functions **create-user** y **delete-user**. Hay que desplegarlas en el proyecto de producción.

Desde la raíz del repo (donde está `supabase/functions/`):

```bash
# Enlazar el proyecto de producción (te pedirá login y elegir proyecto)
npx supabase link --project-ref <REF_DEL_PROYECTO_PRODUCCION>

# Desplegar las funciones
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
```

El **Project ref** lo ves en Supabase: Project Settings → General → Reference ID.

Para que las funciones puedan crear/eliminar usuarios necesitan la **service_role key**. En **Project Settings → API** copia la `service_role` (secret) y configúrala como secret de las funciones:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key>
```

(O el nombre de variable que usen tus funciones; revisa `supabase/functions/create-user/index.ts` y `delete-user/index.ts`.)

---

## Paso 5: Variables de entorno de la app

En tu app (`.env` o entorno de producción) usa la URL y la clave **anon** del proyecto de producción:

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key_produccion>
```

No expongas la `service_role` en el front; solo en el servidor o en las Edge Functions.

---

## Paso 6: Primer usuario admin

Tras el despliegue no hay usuarios. Opciones:

1. **Registro desde la app:** Si tienes registro público, crea una cuenta y luego en Supabase (**SQL Editor**) asígnale el rol admin:
   ```sql
   UPDATE user_profiles SET role_name = 'admin' WHERE id = '<uuid_del_usuario>';
   ```
   El UUID lo ves en **Authentication → Users** (copiar el `id` del usuario).

2. **Crear usuario desde el Dashboard:** Authentication → Add user → Invite (o Create). Luego el mismo `UPDATE` anterior para hacerlo admin.

3. **Edge Function create-user:** Si la app ya usa la función `create-user` con rol, crea el primer usuario desde la propia app (Configuración → Usuarios) una vez que tengas al menos un admin (por ejemplo creado con el paso 1 o 2).

---

## Resumen de archivos de esta carpeta

- **PASOS_PRODUCCION.md** (este archivo): pasos y orden de ejecución.
- **00_app_version.sql**, **01_roles_perfiles_restaurantes.sql** … **11_permisos_roles.sql**: esquema y RPCs listos para producción, sin “fix” ni scripts intermedios; todo en el orden indicado.

Si algo falla al ejecutar un script, revisa el mensaje de error (normalmente falta ejecutar un script anterior o hay un conflicto de nombres de políticas). Puedes ejecutar de nuevo un script que use `CREATE OR REPLACE` o `DROP POLICY IF EXISTS` sin problema.
