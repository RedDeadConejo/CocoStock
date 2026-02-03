/**
 * Servicio de Supabase
 * Configuración y exportación del cliente de Supabase para autenticación y base de datos
 */

import { createClient } from '@supabase/supabase-js';

// Variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar configuradas');
}

// Crear y exportar el cliente de Supabase con configuración de autenticación
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
    // Configurar tiempo de expiración más corto para mejor seguridad
    flowType: 'pkce',
  },
});

// Exportar el cliente de autenticación para compatibilidad
export const supaAuthClient = supabase;

