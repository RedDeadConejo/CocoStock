/**
 * Sesión persistente en Electron: cifrado en disco + huella del equipo + caducidad 2 días sin uso.
 */

import { supabase } from './supabase';

const IPC_TIMEOUT_MS = 12000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`IPC timeout ${ms}ms`)), ms);
    }),
  ]);
}

function hasDeviceSessionApi() {
  return typeof window !== 'undefined' && !!window.electronAPI?.deviceSession;
}

export function pickSerializableSession(session) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: session.user,
  };
}

/**
 * Al arranque (solo una vez): restaura desde disco o limpia sesión local huérfana.
 * No bloquea indefinidamente si el IPC del main falla; no re-guarda en disco aquí (evita colgarse en save).
 */
export async function applyElectronDeviceSessionOnStartup() {
  if (!hasDeviceSessionApi()) return;

  let result;
  try {
    result = await withTimeout(window.electronAPI.deviceSession.restore(), IPC_TIMEOUT_MS);
  } catch (e) {
    console.warn('CocoStock: restore deviceSession:', e?.message || e);
    return;
  }

  if (result?.ok === true && result.session) {
    const { error } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    if (error) {
      console.warn('CocoStock: sesión guardada inválida:', error.message);
      try {
        await withTimeout(window.electronAPI.deviceSession.clear(), IPC_TIMEOUT_MS);
      } catch (_) {}
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }
    return;
  }

  await supabase.auth.signOut({ scope: 'local' });
}

export async function persistElectronDeviceSession(session) {
  if (!hasDeviceSessionApi() || !session?.refresh_token) return;
  const serial = pickSerializableSession(session);
  if (!serial) return;
  try {
    await withTimeout(window.electronAPI.deviceSession.save(serial), IPC_TIMEOUT_MS);
  } catch (err) {
    console.warn('CocoStock: no se pudo guardar sesión en disco:', err?.message || err);
  }
}

export async function touchElectronDeviceSession() {
  if (!hasDeviceSessionApi()) return;
  try {
    await withTimeout(window.electronAPI.deviceSession.touch(), IPC_TIMEOUT_MS);
  } catch (_) {}
}

export async function clearElectronDeviceSessionFile() {
  if (!hasDeviceSessionApi()) return;
  try {
    await withTimeout(window.electronAPI.deviceSession.clear(), IPC_TIMEOUT_MS);
  } catch (_) {}
}

/** En escritorio, la sesión debe renovarse aunque el usuario no marcó "mantener activa" (JWT corto). */
export function shouldAutoRefreshJwtForElectron() {
  return hasDeviceSessionApi();
}
