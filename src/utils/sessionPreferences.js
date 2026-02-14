/**
 * Utilidad para gestionar preferencias de sesión del usuario.
 * Los datos se guardan en local cifrados (secureStorage).
 */

import { getItem, setItem } from './secureStorage';

const STORAGE_KEY = 'cocostock_session_preferences';

/**
 * Obtiene las preferencias de sesión del usuario (async, datos descifrados).
 * @returns {Promise<{ keepSessionActive: boolean }>}
 */
export async function getSessionPreferences() {
  try {
    const stored = await getItem(STORAGE_KEY);
    if (stored) {
      const prefs = JSON.parse(stored);
      return {
        keepSessionActive: prefs.keepSessionActive === true,
      };
    }
  } catch (err) {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const prefs = JSON.parse(raw);
        return { keepSessionActive: prefs.keepSessionActive === true };
      } catch (_) {}
    }
    console.error('Error al leer preferencias de sesión:', err);
  }
  return {
    keepSessionActive: false,
  };
}

/**
 * Guarda las preferencias de sesión del usuario (cifradas en local).
 * @param {{ keepSessionActive: boolean }} preferences
 * @returns {Promise<void>}
 */
export async function setSessionPreferences(preferences) {
  try {
    await setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.error('Error al guardar preferencias de sesión:', err);
    throw new Error('No se pudieron guardar las preferencias');
  }
}

/**
 * Actualiza solo la preferencia de mantener sesión activa.
 * @param {boolean} keepActive
 * @returns {Promise<void>}
 */
export async function setKeepSessionActive(keepActive) {
  const prefs = await getSessionPreferences();
  prefs.keepSessionActive = keepActive === true;
  await setSessionPreferences(prefs);
}
