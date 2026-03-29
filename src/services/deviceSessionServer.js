/**
 * Sincroniza la sesión de dispositivo con Supabase (RPC).
 * El servidor decide si la huella del PC sigue autorizada (< 2 días desde último refresh).
 */

import { supabase } from './supabase';

const RPC_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} (${ms}ms)`)), ms);
    }),
  ]);
}

function hasFingerprintApi() {
  return typeof window !== 'undefined' && !!window.electronAPI?.deviceSession?.getFingerprint;
}

export async function getElectronFingerprintHash() {
  if (!hasFingerprintApi()) return null;
  try {
    const res = await window.electronAPI.deviceSession.getFingerprint();
    return res?.fingerprint || null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, skipped?: boolean, softError?: boolean, reason?: string }>}
 */
export async function syncElectronDeviceSessionWithSupabase() {
  try {
    if (!hasFingerprintApi()) {
      return { ok: true, skipped: true };
    }

    const fingerprint = await getElectronFingerprintHash();
    if (!fingerprint) {
      return { ok: true, skipped: true };
    }

    const { data: sessWrap } = await supabase.auth.getSession();
    if (!sessWrap?.session?.user) {
      return { ok: true, skipped: true };
    }

    let regResult;
    try {
      regResult = await withTimeout(
        supabase.rpc('register_or_refresh_device_session', {
          p_fingerprint_hash: fingerprint,
        }),
        RPC_TIMEOUT_MS,
        'register_or_refresh_device_session'
      );
    } catch (e) {
      console.warn('register_or_refresh_device_session:', e?.message || e);
      return { ok: true, softError: true };
    }

    const { data: regData, error: regErr } = regResult;

    if (regErr) {
      console.warn('register_or_refresh_device_session:', regErr.message);
      return { ok: true, softError: true };
    }

    const regParsed =
      typeof regData === 'string'
        ? (() => {
            try {
              return JSON.parse(regData);
            } catch {
              return null;
            }
          })()
        : regData;
    if (regParsed && regParsed.ok === false) {
      return { ok: false, reason: regParsed.error || 'register_rejected' };
    }

    let valResult;
    try {
      valResult = await withTimeout(
        supabase.rpc('validate_device_session', {
          p_fingerprint_hash: fingerprint,
        }),
        RPC_TIMEOUT_MS,
        'validate_device_session'
      );
    } catch (e) {
      console.warn('validate_device_session:', e?.message || e);
      return { ok: true, softError: true };
    }

    const { data: valData, error: valErr } = valResult;

    if (valErr) {
      console.warn('validate_device_session:', valErr.message);
      return { ok: true, softError: true };
    }

    const val =
      typeof valData === 'string'
        ? (() => {
            try {
              return JSON.parse(valData);
            } catch {
              return null;
            }
          })()
        : valData;

    if (val?.valid === true) {
      return { ok: true };
    }

    return { ok: false, reason: val?.reason || 'invalid' };
  } catch (e) {
    console.warn('syncElectronDeviceSessionWithSupabase:', e?.message || e);
    return { ok: true, softError: true };
  }
}

/** Borra la fila del dispositivo actual (llamar con JWT aún válido, antes de signOut). */
export async function deleteSupabaseDeviceSessionRowIfElectron() {
  if (!hasFingerprintApi()) return;
  const fingerprint = await getElectronFingerprintHash();
  if (!fingerprint) return;
  const { error } = await supabase
    .from('cocostock_device_sessions')
    .delete()
    .eq('fingerprint_hash', fingerprint);
  if (error) {
    console.warn('delete cocostock_device_sessions:', error.message);
  }
}

export async function heartbeatElectronDeviceSession() {
  if (!hasFingerprintApi()) {
    return { ok: true, skipped: true };
  }
  try {
    await window.electronAPI.deviceSession.touch();
  } catch (_) {}
  return syncElectronDeviceSessionWithSupabase();
}
