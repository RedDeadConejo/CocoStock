/**
 * Almacenamiento local cifrado con AES-GCM (Web Crypto API).
 * Todo lo que se guarde en local con esta utilidad se persiste cifrado.
 */

const KEY_SALT = 'CocoStock-SecureStorage-Salt-V1';
const KEY_SECRET = 'CocoStock-LocalStorage-Key-V1';

let cachedKey = null;

function getKey() {
  if (cachedKey) return Promise.resolve(cachedKey);
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return Promise.reject(new Error('Web Crypto no disponible'));
  }
  const enc = new TextEncoder();
  const secret = enc.encode(KEY_SECRET);
  const salt = enc.encode(KEY_SALT);
  return crypto.subtle
    .importKey('raw', secret, { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey'])
    .then((keyMaterial) =>
      crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    )
    .then((key) => {
      cachedKey = key;
      return key;
    });
}

function generateIv() {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Cifra una cadena y devuelve base64 (IV + ciphertext).
 * @param {string} plainText
 * @returns {Promise<string>}
 */
export async function encrypt(plainText) {
  const key = await getKey();
  const enc = new TextEncoder();
  const iv = generateIv();
  const encoded = enc.encode(plainText);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < combined.length; i += chunk) {
    binary += String.fromCharCode(...combined.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Descifra una cadena en base64 (IV + ciphertext).
 * @param {string} base64Cipher
 * @returns {Promise<string>}
 */
export async function decrypt(base64Cipher) {
  const key = await getKey();
  const bin = atob(base64Cipher);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  const iv = raw.slice(0, 12);
  const cipher = raw.slice(12);
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    cipher
  );
  return new TextDecoder().decode(dec);
}

/**
 * Obtiene un valor del almacenamiento local (descifrado).
 * Si no existe o falla el descifrado, devuelve null.
 * @param {string} key - Clave de localStorage
 * @returns {Promise<string|null>}
 */
export async function getItem(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    if (!stored.startsWith('c0c0:')) return stored;
    const cipher = stored.slice(5);
    const plain = await decrypt(cipher);
    return plain;
  } catch (err) {
    console.warn('[secureStorage] Error al leer:', key, err);
    return null;
  }
}

/**
 * Guarda un valor en almacenamiento local (cifrado).
 * @param {string} key - Clave de localStorage
 * @param {string} value - Valor en texto plano
 * @returns {Promise<void>}
 */
export async function setItem(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    const cipher = await encrypt(value);
    localStorage.setItem(key, 'c0c0:' + cipher);
  } catch (err) {
    console.warn('[secureStorage] Error al guardar:', key, err);
    throw err;
  }
}

/**
 * Elimina un valor del almacenamiento local.
 * @param {string} key - Clave de localStorage
 */
export function removeItem(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * Detecta si un valor en localStorage está cifrado (prefijo c0c0:).
 * Útil para migrar datos antiguos en texto plano.
 */
export function isEncrypted(storedValue) {
  return typeof storedValue === 'string' && storedValue.startsWith('c0c0:');
}
