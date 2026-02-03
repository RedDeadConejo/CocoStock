# Edge Functions desde el panel web de Supabase

Puedes crear y desplegar las Edge Functions **directamente desde el panel web de Supabase**, sin instalar la CLI. Es la forma más sencilla.

## Requisitos

- Un proyecto en [Supabase](https://supabase.com/dashboard)
- Acceso como administrador al proyecto

---

## Crear la función `create-user` (crear usuarios)

### 1. Ir a Edge Functions

1. Entra en tu [Dashboard de Supabase](https://supabase.com/dashboard).
2. Selecciona tu proyecto.
3. En el menú izquierdo, haz clic en **Edge Functions**.

### 2. Nueva función

1. Pulsa **Deploy a new function**.
2. Elige **Via Editor** (o **Via AI Assistant** si prefieres describirla).
3. Si usas editor: pon **Nombre de la función**: `create-user`.
4. Borra el código de plantilla y pega el código que está en `supabase/functions/create-user/index.ts` de este proyecto (o el que ves abajo).

### 3. Código de `create-user`

Copia y pega este código en el editor del panel:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No se proporcionó token de autorización')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) throw new Error('Usuario no autenticado')

    const { data: profile } = await supabaseAdmin.from('user_profiles').select('role_name').eq('id', user.id).single()
    if (!profile || profile.role_name !== 'admin') throw new Error('Solo los administradores pueden crear usuarios')

    const { email, password, role_name, full_name, phone } = await req.json()
    if (!email || !password) throw new Error('El email y la contraseña son requeridos')

    const { data: roleData, error: roleError } = await supabaseAdmin.from('user_roles').select('role_name').eq('role_name', role_name || 'tienda').single()
    if (roleError || !roleData) throw new Error('El rol especificado no existe')

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    if (existingUsers?.users?.some(u => u.email === email)) throw new Error('Ya existe un usuario con ese email')

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: full_name || '', phone: phone || '' }
    })
    if (createError) throw createError

    await supabaseAdmin.from('user_profiles').upsert({
      id: newUser.user.id, role_name: role_name || 'tienda', full_name: full_name || null, phone: phone || null
    }, { onConflict: 'id' })

    return new Response(JSON.stringify({ success: true, user: { id: newUser.user.id, email: newUser.user.email, role_name: role_name || 'tienda', full_name: full_name || null, phone: phone || null } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error al crear usuario' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

### 4. Desplegar

1. Abajo del editor, pulsa **Deploy function** (o **Deploy**).
2. Espera a que termine (unos 10–30 segundos).

La función quedará en: `https://TU_PROJECT_REF.supabase.co/functions/v1/create-user`

---

## Crear la función `delete-user` (eliminar usuarios)

### 1. Otra función nueva

1. En **Edge Functions**, pulsa otra vez **Deploy a new function**.
2. Elige **Via Editor**.
3. Nombre: `delete-user`.
4. Pega el código siguiente.

### 2. Código de `delete-user`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No se proporcionó token de autorización')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) throw new Error('Usuario no autenticado')

    const { data: profile } = await supabaseAdmin.from('user_profiles').select('role_name').eq('id', user.id).single()
    if (!profile || profile.role_name !== 'admin') throw new Error('Solo los administradores pueden eliminar usuarios')

    const { userId } = await req.json()
    if (!userId) throw new Error('El ID del usuario es requerido')
    if (userId === user.id) throw new Error('No puedes eliminar tu propia cuenta')

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true, message: 'Usuario eliminado correctamente' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error al eliminar usuario' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

### 3. Desplegar

Pulsa **Deploy function** y espera a que termine.

---

## Variables de entorno en el panel

Las funciones usan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. En el panel suelen estar ya configuradas. Para comprobarlo:

1. **Project Settings** (icono de engranaje).
2. **Edge Functions** (o **Functions**) y revisa **Secrets** / variables.
3. Si hace falta, añade `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (el Service Role Key está en **Settings → API → Service role key**).

---

## Probar desde el panel

En la página de cada función puedes usar **Test** para enviar una petición:

- **create-user**: método POST, body JSON con `email`, `password`, `role_name`, `full_name`, `phone`. Header `Authorization: Bearer <tu_jwt_de_admin>`.
- **delete-user**: método POST, body JSON con `userId`. Mismo header de autorización.

---

## Resumen

| Función       | Uso en la app                                      |
|---------------|----------------------------------------------------|
| **create-user** | Configuración → Crear nuevo usuario               |
| **delete-user** | Configuración → Usuarios → botón eliminar (🗑️)   |

No necesitas instalar la CLI: todo se hace desde el panel web de Supabase.

---

## Alternativa: CLI (opcional)

Si más adelante quieres usar la CLI de Supabase, no uses `npm install -g supabase` (no está soportado). Usa uno de los métodos oficiales:

- **Windows**: [Scoop](https://scoop.sh/) o descarga desde [GitHub Releases](https://github.com/supabase/cli/releases)
- **macOS**: `brew install supabase/tap/supabase`
- Guía oficial: [Supabase CLI – Install](https://supabase.com/docs/guides/cli)

Luego, desde la raíz del proyecto:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy create-user
supabase functions deploy delete-user
```

El código de las funciones está en `supabase/functions/create-user/index.ts` y `supabase/functions/delete-user/index.ts`.
