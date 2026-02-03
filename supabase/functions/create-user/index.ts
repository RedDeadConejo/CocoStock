// Edge Function para crear usuarios
// Esta función debe desplegarse en Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Obtener el token de autorización
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No se proporcionó token de autorización')
    }

    // Crear cliente con Service Role Key para operaciones admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar que el usuario actual está autenticado
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Usuario no autenticado')
    }

    // Verificar que el usuario es admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('No se pudo verificar el perfil del usuario')
    }

    if (profile.role_name !== 'admin') {
      throw new Error('Solo los administradores pueden crear usuarios')
    }

    // Obtener datos del request
    const { email, password, role_name: roleNameFromBody, restaurant_id, full_name, phone } = await req.json()

    if (!email || !password) {
      throw new Error('El email y la contraseña son requeridos')
    }

    // Resolver rol: si no viene o está vacío, usar el primero disponible en user_roles (dinámico)
    let role_name = (typeof roleNameFromBody === 'string' && roleNameFromBody.trim()) ? roleNameFromBody.trim() : null
    if (!role_name) {
      const { data: firstRoles, error: firstRoleError } = await supabaseAdmin
        .from('user_roles')
        .select('role_name')
        .order('role_name', { ascending: true })
        .limit(1)
      if (firstRoleError || !firstRoles?.length) {
        throw new Error('No hay roles configurados en user_roles. Crea al menos un rol en Configuración.')
      }
      role_name = firstRoles[0].role_name
    }

    // Verificar que el rol existe
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role_name')
      .eq('role_name', role_name)
      .single()

    if (roleError || !roleData) {
      throw new Error(`El rol "${role_name}" no existe en user_roles`)
    }

    // Verificar que el email no existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(u => u.email === email)
    
    if (emailExists) {
      throw new Error('Ya existe un usuario con ese email')
    }

    // Crear el usuario usando el Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        phone: phone || ''
      }
    })

    if (createError) {
      const msg = createError.message || ''
      if (msg.toLowerCase().includes('database error')) {
        throw new Error(
          'Error de base de datos al crear el usuario en Auth. Suele deberse a un TRIGGER en auth.users que crea el perfil automáticamente y falla (p. ej. rol por defecto no existe en user_roles). Revisa en SQL Editor: SELECT * FROM pg_trigger WHERE tgrelid = \'auth.users\'::regclass; y la función que llama ese trigger.'
        )
      }
      throw createError
    }

    // Crear el perfil del usuario (role_name ya resuelto dinámicamente)
    const { data: profileData, error: profileCreateError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: newUser.user.id,
        role_name,
        restaurant_id: restaurant_id || null,
        full_name: full_name || null,
        phone: phone || null
      }, {
        onConflict: 'id'
      })
      .select()
      .single()

    if (profileCreateError) {
      console.error('Error al crear perfil:', profileCreateError)
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      } catch (_) {}
      throw new Error(
        profileCreateError.message ||
        `Error en base de datos al crear el perfil: ${profileCreateError.code || 'desconocido'}. Revisa que la tabla user_profiles exista y que el rol "${role_name}" esté en user_roles.`
      )
    }

    // Retornar éxito
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role_name,
          full_name: full_name || null,
          phone: phone || null
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error en create-user:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error desconocido al crear usuario' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
