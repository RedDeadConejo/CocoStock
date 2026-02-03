# Auditoría: lógica que convendría gestionar desde Supabase

Este documento resume qué partes del código serían más seguras, consistentes o mantenibles si se movieran a Supabase (RPC, triggers, RLS, Edge Functions), sin cambiar el comportamiento actual de la app.

---

## 1. Roles y usuarios (roleManagement.js, roles.js)

### 1.1 Renombrar rol (`updateRole` cuando cambia `role_name`)

**Situación actual:** El cliente hace 4 operaciones seguidas: insertar nuevo rol → actualizar `user_profiles` → borrar rol antiguo → leer rol nuevo. Si falla en medio, pueden quedar datos incoherentes (rol duplicado o perfiles con rol inexistente).

**Recomendación:** Crear una **función RPC** `rename_role(p_old_name, p_new_name, p_description, p_permissions)` con `SECURITY DEFINER` que:

- Compruebe que el usuario es admin.
- No permita renombrar `admin`.
- Compruebe que `p_new_name` no existe.
- En una **transacción**: insertar nuevo rol, actualizar `user_profiles.role_name`, borrar rol antiguo.
- Devolver el rol nuevo.

**Beneficio:** Atomicidad y consistencia; el cliente solo llama a una función.

---

### 1.2 Eliminar rol (`deleteRole`)

**Situación actual:** El cliente hace: 1) SELECT para ver si hay usuarios con ese rol, 2) DELETE del rol. Entre ambas llamadas otro cliente podría asignar el rol a un usuario.

**Recomendación:** RPC `delete_role(p_role_name)` que en una transacción:

- Compruebe que no hay perfiles con ese rol (o que el rol no es `admin`).
- Borre el rol.

O bien un **trigger BEFORE DELETE** en `user_roles` que impida borrar si existe algún perfil con ese `role_name`.

**Beneficio:** Regla de negocio y consistencia FK centralizada en la base de datos.

---

### 1.3 Mapa de permisos por vista (`getViewPermissionsMap`)

**Situación actual:** El cliente carga todos los roles, recorre `VIEW_IDS` y construye en memoria `{ viewId: [roles...] }`. Se ejecuta al cargar Layout y cuando se dispara `viewPermissionsUpdated`.

**Recomendación (opcional):** Una **función RPC** `get_view_permissions_map()` que devuelva el mismo JSON, calculado en PostgreSQL a partir de `user_roles` y `permissions`. El cliente solo haría `supabase.rpc('get_view_permissions_map')`.

**Beneficio:** Una sola consulta, lógica de permisos en un solo sitio (DB). No es crítico si el volumen de roles es bajo.

---

### 1.4 Crear usuario (createUser en cliente vs Edge Function)

**Situación actual:** En el cliente se usa `signUp` + espera 500 ms + upsert de perfil (rol, restaurant_id, etc.). Ya existe una Edge Function `create-user` que hace algo similar con Service Role.

**Recomendación:** Unificar en **una sola vía**: que la app **solo** use la Edge Function `create-user` para crear usuarios (con email, password, role_name, restaurant_id, full_name, phone). Retirar la creación vía `signUp` + upsert en el cliente para evitar dos flujos y depender del “delay” de 500 ms.

**Beneficio:** Un solo flujo, sin race con el trigger de creación de perfil; la Edge Function puede crear/actualizar perfil con rol y restaurant_id de forma controlada.

---

## 2. Pedidos (orders.js)

### 2.1 Crear pedido con ítems

**Situación actual:** Insert del pedido → insert de ítems. Si falla el insert de ítems, el cliente borra el pedido. No es transaccional desde el punto de vista del servidor.

**Recomendación:** RPC `create_order(p_restaurant_id, p_notes, p_items)` con `SECURITY DEFINER` que en una transacción:

- Inserte `orders` (created_by = auth.uid(), restaurant_id, status, notes).
- Inserte todos los `order_items`.
- Devuelva el pedido con ítems (o el id).

**Beneficio:** Todo o nada; no puede quedar pedido sin ítems ni ítems sin pedido.

---

### 2.2 Completar pedido (restar stock + historial)

**Situación actual:** `processOrderCompletion` hace en el cliente, por cada ítem: SELECT producto → UPDATE stock → INSERT en `stock_history`. Luego `updateOrderStatus` hace UPDATE del estado del pedido. Si falla a mitad, el stock puede quedar incoherente con el estado del pedido.

**Recomendación:** RPC `complete_order(p_order_id)` que en una transacción:

- Compruebe que el pedido existe, está en estado “pending”/“processing” y pertenece a un contexto permitido (RLS/permisos).
- Para cada ítem: actualice `products.stock` y registre en `stock_history`.
- Actualice el pedido a estado `completed`.

**Beneficio:** Atomicidad stock + historial + estado del pedido; menos round-trips y lógica crítica en el servidor.

---

## 3. Compras a proveedores (purchases.js)

### 3.1 Crear compra con ítems

**Situación actual:** Igual que pedidos: insert compra → insert ítems; si fallan ítems, el cliente borra la compra.

**Recomendación:** RPC `create_purchase(p_supplier_id, p_notes, p_items)` que en una transacción inserte `purchases` e `purchase_items` y devuelva la compra.

**Beneficio:** Transacción atómica.

---

### 3.2 Completar compra (sumar stock + historial)

**Situación actual:** `processPurchaseCompletion` hace en el cliente, por cada ítem: SELECT producto → UPDATE stock → INSERT en `stock_history`. Luego se actualiza el estado de la compra.

**Recomendación:** RPC `complete_purchase(p_purchase_id)` que en una transacción:

- Valide compra y permisos.
- Por cada ítem: actualice `products.stock` e inserte en `stock_history`.
- Ponga la compra en estado `completed`.

**Beneficio:** Mismo que en completar pedido: consistencia y menos lógica en el cliente.

---

## 4. Productos (products.js)

### 4.1 Crear producto + historial + proveedores

**Situación actual:** Insert producto → varios INSERT en `product_changes_history` → llamada a `setProductSuppliers` (posiblemente más inserts). Si falla el historial o proveedores, el producto ya está creado.

**Recomendación:** RPC `create_product(p_product, p_supplier_ids)` que en una transacción:

- Inserte en `products`.
- Inserte los registros de `product_changes_history` (creación).
- Inserte/actualice `product_suppliers`.
- Devuelva el producto.

**Beneficio:** Historial y relaciones siempre coherentes con el producto.

---

### 4.2 Actualizar producto + historial + proveedores

**Situación actual:** UPDATE producto → varios INSERT en `product_changes_history` (solo campos que cambiaron) → actualización de `product_suppliers`. Misma fragilidad si algo falla después del UPDATE.

**Recomendación:** RPC `update_product(p_id, p_product, p_supplier_ids)` que en una transacción:

- Lea el producto actual.
- Haga el UPDATE.
- Inserte en `product_changes_history` solo los cambios.
- Sincronice `product_suppliers`.
- Devuelva el producto actualizado.

**Beneficio:** Historial de cambios fiable y atómico.

---

### 4.3 Soft delete de producto

**Situación actual:** Se usa `soft_delete_product` por RPC si existe; si no, UPDATE directo. Está bien que el soft delete viva en Supabase; solo asegurar que la RPC exista en todos los entornos y que el cliente no dependa del fallback por RLS.

**Recomendación:** Mantener la RPC como vía principal; documentar que debe existir en el proyecto (por ejemplo en DISHES_SETUP o schema de productos).

---

## 5. Consultas con joins y datos derivados

### 5.1 Pedidos / Compras con “quién creó”

**Situación actual:** Tras obtener pedidos o compras, el cliente hace una segunda consulta a `user_profiles` por los `created_by` y monta el mapa en memoria.

**Recomendación (opcional):** Si en el futuro se usan más vistas complejas, valorar **vistas** en PostgreSQL o RPC que devuelvan ya el pedido/compra con el perfil del creador (por ejemplo con un JOIN a una función que lea de `auth.users` solo lo permitido por RLS). Hoy no es bloqueante; solo reduce round-trips y lógica en el cliente.

---

## 6. Resumen de prioridades

| Prioridad | Área              | Acción en Supabase |
|----------|-------------------|--------------------------------|
| Alta     | Renombrar rol     | RPC `rename_role` en transacción |
| Alta     | Completar pedido  | RPC `complete_order` (stock + historial + estado) |
| Alta     | Completar compra  | RPC `complete_purchase` (stock + historial + estado) |
| Media    | Crear pedido      | RPC `create_order` (pedido + ítems) |
| Media    | Crear compra      | RPC `create_purchase` (compra + ítems) |
| Media    | Eliminar rol      | RPC `delete_role` o trigger BEFORE DELETE |
| Media    | Crear usuario     | Usar solo Edge Function `create-user`, retirar signUp+upsert en cliente |
| Media    | Producto CRUD     | RPC `create_product` y `update_product` con historial y proveedores en transacción |
| Baja     | Mapa de vistas    | RPC `get_view_permissions_map()` (opcional) |
| Baja     | Listas con usuario| Vistas o RPC con JOINs (opcional) |

---

## 7. Lo que ya está bien apoyado en Supabase

- **RLS** en tablas (user_roles, user_profiles, orders, purchases, products, etc.): la seguridad de acceso por fila ya se delega en Supabase.
- **Edge Functions** `create-user` y `delete-user`: operaciones sensibles con Service Role.
- **RPC** `get_all_users_with_profiles`: lista de usuarios con perfiles solo para admin.
- **RPC** de merma: `register_merma_server_token`, `unregister_merma_server_token`, `create_merma_with_token`, `get_products_for_merma`.
- **Trigger** `on_auth_user_created`: creación inicial de perfil al registrarse.
- **RPC** `soft_delete_product` / `soft_delete_supplier` cuando existen: encapsulan el soft delete.

---

## 8. Nota sobre IPs autorizadas y servidores locales

- **authorizedIps.js** usa solo Electron (almacenamiento local cifrado). No aplica moverlo a Supabase; es deliberadamente local.
- **localServer.js** y lógica de “servidores locales” son de la app de escritorio. La parte que ya toca Supabase (tokens de merma) está bien con RPC; el resto puede seguir en cliente/Electron.

Esta auditoría no propone cambios de código; solo indica qué lógica sería mejor gestionar desde Supabase para mejorar seguridad, consistencia y mantenibilidad.
