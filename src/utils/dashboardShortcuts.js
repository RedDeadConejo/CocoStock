/**
 * Preferencias de atajos del dashboard por usuario (almacenamiento local cifrado).
 * Cada usuario puede ocultar atajos que no quiera ver.
 */

import { getItem, setItem } from './secureStorage';

const STORAGE_KEY = 'cocostock_dashboard_shortcuts';

/**
 * Obtiene la lista de IDs de atajos ocultos para un usuario (async, datos descifrados).
 * @param {string|null} userId - ID del usuario
 * @returns {Promise<string[]>} Array de IDs ocultos
 */
export async function getHiddenShortcuts(userId) {
  if (!userId || typeof localStorage === 'undefined') return [];
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const hidden = data[userId];
    return Array.isArray(hidden) ? hidden : [];
  } catch (err) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const hidden = data[userId];
        return Array.isArray(hidden) ? hidden : [];
      }
    } catch (_) {}
    console.warn('[dashboardShortcuts] Error al leer preferencias:', err);
    return [];
  }
}

/**
 * Guarda la lista de atajos ocultos para un usuario (cifrado en local).
 * @param {string|null} userId - ID del usuario
 * @param {string[]} hidden - Array de IDs a ocultar
 * @returns {Promise<void>}
 */
export async function setHiddenShortcuts(userId, hidden) {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    const raw = await getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[userId] = Array.isArray(hidden) ? hidden : [];
    await setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[dashboardShortcuts] Error al guardar preferencias:', err);
  }
}

/**
 * Conmuta un atajo: si está oculto lo muestra, si está visible lo oculta.
 * @param {string} userId - ID del usuario
 * @param {string} shortcutId - ID del atajo
 * @returns {Promise<string[]>} Nueva lista de ocultos
 */
export async function toggleShortcutVisibility(userId, shortcutId) {
  const hidden = await getHiddenShortcuts(userId);
  const next = hidden.includes(shortcutId)
    ? hidden.filter((id) => id !== shortcutId)
    : [...hidden, shortcutId];
  await setHiddenShortcuts(userId, next);
  return next;
}
