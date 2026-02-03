/**
 * Utilidad para gestionar preferencias de sesión del usuario
 */

const STORAGE_KEY = 'cocostock_session_preferences';

/**
 * Obtiene las preferencias de sesión del usuario
 * @returns {{ keepSessionActive: boolean }}
 */
export function getSessionPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const prefs = JSON.parse(stored);
      return {
        keepSessionActive: prefs.keepSessionActive === true,
      };
    }
  } catch (err) {
    console.error('Error al leer preferencias de sesión:', err);
  }
  return {
    keepSessionActive: false, // Por defecto: sesión expira normalmente
  };
}

/**
 * Guarda las preferencias de sesión del usuario
 * @param {{ keepSessionActive: boolean }} preferences
 */
export function setSessionPreferences(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.error('Error al guardar preferencias de sesión:', err);
    throw new Error('No se pudieron guardar las preferencias');
  }
}

/**
 * Actualiza solo la preferencia de mantener sesión activa
 * @param {boolean} keepActive
 */
export function setKeepSessionActive(keepActive) {
  const prefs = getSessionPreferences();
  prefs.keepSessionActive = keepActive === true;
  setSessionPreferences(prefs);
}
