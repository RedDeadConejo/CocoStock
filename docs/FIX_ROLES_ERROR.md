# Solución de Error: Perfil de Usuario No Encontrado

## 🔴 Problema

Si recibes este error:
```
Error al obtener perfil de usuario: 
{code: 'PGRST116', details: 'The result contains 0 rows', 
hint: null, message: 'Cannot coerce the result to a single JSON object'}
GET .../rest/v1/user_profiles?... 406 (Not Acceptable)
```

Esto significa que el usuario no tiene un perfil en la tabla `user_profiles`.

## ✅ Solución

### Paso 1: Verificar que el usuario tenga perfil

Ejecuta este SQL en Supabase:

```sql
-- Ver todos los usuarios y sus perfiles
SELECT 
  au.id,
  au.email,
  up.role_name,
  up.created_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC;
```

### Paso 2: Crear perfil para usuarios existentes

Si un usuario no tiene perfil, créalo manualmente:

```sql
-- Crear perfil para un usuario específico
INSERT INTO user_profiles (id, role_name)
VALUES ('user-uuid-aqui', 'tienda')
ON CONFLICT (id) DO NOTHING;
```

O crear perfiles para TODOS los usuarios que no lo tengan:

```sql
-- Crear perfiles para todos los usuarios existentes sin perfil
INSERT INTO user_profiles (id, role_name)
SELECT id, 'tienda'
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;
```

### Paso 3: Verificar políticas RLS

Asegúrate de que las políticas RLS estén configuradas correctamente:

```sql
-- Ver políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- Si falta alguna, ejecutar:
CREATE POLICY IF NOT EXISTS "Usuarios pueden ver su propio perfil"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Usuarios pueden crear su propio perfil"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### Paso 4: Verificar el trigger automático

El trigger debería crear perfiles automáticamente para nuevos usuarios:

```sql
-- Verificar que el trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Si no existe, ejecutar el script completo de ROLES_SETUP.sql
```

### Paso 5: Solución Temporal (Código)

El código ya está actualizado para crear el perfil automáticamente si no existe. Sin embargo, si el problema persiste:

1. **Verifica que el usuario esté autenticado**
2. **Revisa la consola del navegador** para ver errores específicos
3. **Verifica las políticas RLS** en Supabase Dashboard → Authentication → Policies

## 🔧 Verificación Rápida

Ejecuta este query para verificar el estado:

```sql
-- Verificar usuarios sin perfil
SELECT 
  au.id,
  au.email,
  au.created_at as usuario_creado,
  up.id as perfil_id,
  up.role_name,
  up.created_at as perfil_creado
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;
```

Si hay usuarios sin perfil, créalos con el paso 2.

## 📝 Notas

- Los **nuevos usuarios** deberían tener perfil automáticamente gracias al trigger
- Los **usuarios existentes** creados antes de configurar el sistema necesitan perfil manual
- El código ahora **intenta crear el perfil automáticamente** si no existe al intentar acceder

## 🚨 Si el Problema Persiste

1. Revisa los logs de Supabase en el Dashboard
2. Verifica que las políticas RLS no estén bloqueando las operaciones
3. Asegúrate de que el usuario tenga sesión activa
4. Verifica que el trigger `on_auth_user_created` esté activo

---

**Última actualización**: Después de corregir el manejo de errores en `src/services/roles.js`

