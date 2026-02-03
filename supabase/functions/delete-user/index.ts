// Edge Function para eliminar usuarios
// Debe desplegarse en Supabase Edge Functions (supabase functions deploy delete-user)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No se proporcionó token de autorización')
    }

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

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Usuario no autenticado')
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('No se pudo verificar el perfil del usuario')
    }

    if (profile.role_name !== 'admin') {
      throw new Error('Solo los administradores pueden eliminar usuarios')
    }

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('El ID del usuario es requerido')
    }

    // No permitir que un admin se elimine a sí mismo
    if (userId === user.id) {
      throw new Error('No puedes eliminar tu propia cuenta')
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Usuario eliminado correctamente' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error en delete-user:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Error desconocido al eliminar usuario'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
