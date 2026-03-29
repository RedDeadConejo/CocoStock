/**
 * Cierre de sesión coherente: fila en Supabase (dispositivo) + archivo local + signOut.
 */

import { supabase } from './supabase';
import { clearElectronDeviceSessionFile } from './deviceSession';
import { deleteSupabaseDeviceSessionRowIfElectron } from './deviceSessionServer';

export async function signOutDesktopCleanup() {
  await deleteSupabaseDeviceSessionRowIfElectron();
  await clearElectronDeviceSessionFile();
  await supabase.auth.signOut();
}

/**
 * Limpieza agresiva si la app se queda colgada en "Cargando…" (cada paso aislado en try).
 * Borra sesión en Supabase (local), archivo device_session, fila de dispositivo y claves sb-* en localStorage.
 */
export async function forceResetAuthToLogin() {
  try {
    await deleteSupabaseDeviceSessionRowIfElectron();
  } catch (_) {}
  try {
    await clearElectronDeviceSessionFile();
  } catch (_) {}
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (_) {}
  try {
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase')) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch (_) {}
  try {
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase')) {
          sessionStorage.removeItem(k);
        }
      });
    }
  } catch (_) {}
}
