# Configuración de Creación de Usuarios

Este documento explica cómo funciona la creación de usuarios desde la aplicación.

## 📋 Método Utilizado

La aplicación usa `supabase.auth.signUp()` para crear usuarios, que es el método estándar y más simple de Supabase. Después de crear el usuario, se actualiza automáticamente el perfil con el rol y datos adicionales.

## ⚙️ Configuración Requerida

### 1. Deshabilitar Confirmación de Email (Recomendado para Admin)

Para que los administradores puedan crear usuarios sin necesidad de confirmación de email:

1. Ve al dashboard de Supabase
2. Ve a Authentication > Settings
3. Desactiva "Enable email confirmations" o configura "Confirm email" como opcional
4. Esto permite que los usuarios creados por admin estén listos para usar inmediatamente

**Nota:** Si prefieres mantener la confirmación de email activa, los usuarios creados recibirán un email de confirmación antes de poder iniciar sesión.

### 2. Verificar Trigger de Perfil

Asegúrate de que el trigger `handle_new_user()` esté configurado en tu base de datos. Este trigger crea automáticamente un perfil cuando se crea un usuario. El script `ROLES_SETUP.sql` ya incluye este trigger.

## 🔄 Flujo de Creación

1. El administrador completa el formulario de creación de usuario
2. Se llama a `supabase.auth.signUp()` para crear el usuario en auth.users
3. El trigger `handle_new_user()` crea automáticamente un perfil con rol 'tienda' por defecto
4. La aplicación actualiza inmediatamente el perfil con el rol y datos especificados por el admin
5. El usuario queda listo para usar (si la confirmación de email está deshabilitada)

## 💡 Ventajas de este Método

1. **Simplicidad**: No requiere Edge Functions ni configuración adicional
2. **Seguridad**: Usa el método estándar de Supabase Auth
3. **Automatización**: El trigger crea el perfil automáticamente
4. **Flexibilidad**: Funciona con o sin confirmación de email

## 🔧 Código de Implementación

El código ya está implementado en `src/services/roleManagement.js`:

```javascript
export async function createUser(userData) {
  // 1. Verificar que el rol existe
  // 2. Crear usuario con signUp
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: full_name || '',
        phone: phone || ''
      }
    }
  });

  // 3. Actualizar perfil con rol y datos correctos
  await supabase
    .from('user_profiles')
    .upsert({
      id: authData.user.id,
      role_name: role_name || 'tienda',
      full_name: full_name || null,
      phone: phone || null
    });
}
```

## ⚠️ Notas Importantes

1. **Seguridad:** Nunca expongas el Service Role Key en el cliente
2. **Verificación:** Siempre verifica que el usuario que crea otros usuarios es admin
3. **Validación:** Valida los datos antes de crear el usuario
4. **Errores:** Maneja los errores apropiadamente y muestra mensajes claros al usuario

## 🐛 Solución de Problemas

### Error: "User already registered"

- El email ya está registrado en Supabase
- Usa un email diferente o resetea la contraseña del usuario existente desde el dashboard

### Error: "Email not confirmed"

- Si tienes la confirmación de email habilitada, el usuario debe confirmar su email antes de poder iniciar sesión
- Considera deshabilitar la confirmación de email para usuarios creados por admin
- O envía manualmente el email de confirmación desde el dashboard

### Error: "Error al crear perfil"

- Verifica que el trigger `handle_new_user()` esté configurado correctamente
- Asegúrate de que las políticas RLS permitan la inserción en `user_profiles`
- Verifica que el rol especificado exista en la tabla `user_roles`

### El usuario se crea pero no aparece en la lista

- Si la confirmación de email está habilitada, el usuario puede estar en estado "pending"
- Verifica en el dashboard de Supabase > Authentication > Users
- El usuario aparecerá en la lista una vez que confirme su email o si deshabilitas la confirmación
