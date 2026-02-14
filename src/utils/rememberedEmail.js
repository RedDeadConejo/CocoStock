/**
 * Utilidad para recordar el email del login.
 * Los datos se guardan en local cifrados (secureStorage).
 */

import { getItem, setItem, removeItem } from './secureStorage';

const STORAGE_KEY = 'cocostock_auth_remembered_email';

/**
 * Obtiene el email recordado (descifrado).
 * @returns {Promise<string|null>}
 */
export async function getRememberedEmail() {
  try {
    const email = await getItem(STORAGE_KEY);
    return email && typeof email === 'string' && email.includes('@') ? email : null;
  } catch (err) {
    console.warn('[rememberedEmail] Error al leer:', err);
    return null;
  }
}

/**
 * Guarda el email recordado (cifrado).
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function setRememberedEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return;
  await setItem(STORAGE_KEY, email.trim());
}

/**
 * Elimina el email recordado.
 */
export function clearRememberedEmail() {
  removeItem(STORAGE_KEY);
}
