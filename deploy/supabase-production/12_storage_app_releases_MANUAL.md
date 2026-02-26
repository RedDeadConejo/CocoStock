# Políticas de Storage (app-releases) – Crear desde el Panel de Supabase

El esquema `storage` y la tabla `storage.objects` son gestionados por Supabase. Crear o modificar políticas con SQL puede devolver **42501 (debe ser el propietario)**. Hay que definir las políticas desde la interfaz de Storage del Dashboard.

## Requisito previo

- Bucket **app-releases** existente y **privado**.
- Si no existe: **Storage → New bucket** → Name: `app-releases` → **Private**.
- Si es público: **Storage → app-releases → Configuration** → Public = **OFF**.

---

## Cómo crear cada política

Ir a **Storage → app-releases → Policies** (o **New policy** sobre el bucket).

Crear **4 políticas** con la siguiente lógica.

---

### 1. SELECT – Descargar releases (usuarios autenticados)

- **Name:** `Usuarios autenticados pueden descargar releases`
- **Allowed operation:** `SELECT` (Read)
- **Target roles:** `authenticated`
- **Policy definition (USING):**

```sql
bucket_id = 'app-releases'
```

Así cualquier usuario autenticado puede **leer/descargar** archivos del bucket `app-releases`.

---

### 2. INSERT – Subir releases (solo Admin)

- **Name:** `Solo Admin puede subir releases`
- **Allowed operation:** `INSERT` (Create)
- **Target roles:** `authenticated`
- **Policy definition (WITH CHECK):**

```sql
bucket_id = 'app-releases' AND public.is_user_admin(auth.uid())
```

Solo usuarios con rol admin pueden **subir** archivos a `app-releases`.

---

### 3. UPDATE – Actualizar/reemplazar releases (solo Admin)

- **Name:** `Solo Admin puede actualizar releases`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **USING expression:**

```sql
bucket_id = 'app-releases' AND public.is_user_admin(auth.uid())
```

- **WITH CHECK expression:**

```sql
bucket_id = 'app-releases' AND public.is_user_admin(auth.uid())
```

Solo admin puede **actualizar/reemplazar** objetos en `app-releases`.

---

### 4. DELETE – Eliminar releases (solo Admin)

- **Name:** `Solo Admin puede eliminar releases`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **Policy definition (USING):**

```sql
bucket_id = 'app-releases' AND public.is_user_admin(auth.uid())
```

Solo admin puede **eliminar** archivos de `app-releases`.

---

## Resumen

| Operación | Rol        | Condición                          |
|----------|------------|-------------------------------------|
| SELECT   | authenticated | `bucket_id = 'app-releases'`     |
| INSERT   | authenticated | `bucket_id = 'app-releases'` y `public.is_user_admin(auth.uid())` |
| UPDATE   | authenticated | Igual que INSERT (USING y WITH CHECK) |
| DELETE   | authenticated | Igual que INSERT (USING)          |

Si el editor del Dashboard pide **Policy name** y **Definition** en un solo campo, pega la expresión correspondiente (USING o WITH CHECK) según la operación indicada arriba.
