/**
 * Almacenamiento local cifrado de IPs autorizadas
 * Los datos se guardan en un archivo en userData, cifrados con AES-256-GCM
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const FILENAME = 'authorized_ips.enc';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Deriva una clave de 32 bytes a partir del directorio userData (único por instalación)
 * @param {string} userDataPath
 * @returns {Buffer}
 */
function deriveKey(userDataPath) {
  const salt = Buffer.from('cocostock-authorized-ips-v1', 'utf8');
  return scryptSync(userDataPath, salt, KEY_LENGTH);
}

/**
 * @param {string} userDataPath - app.getPath('userData')
 * @returns {string}
 */
function getFilePath(userDataPath) {
  return join(userDataPath, FILENAME);
}

/**
 * Cifra un string con AES-256-GCM
 * @param {string} plainText
 * @param {Buffer} key
 * @returns {Buffer} iv (16) + authTag (16) + ciphertext
 */
function encrypt(plainText, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Descifra un buffer
 * @param {Buffer} data - iv + tag + ciphertext
 * @param {Buffer} key
 * @returns {string}
 */
function decrypt(data, key) {
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Obtiene la lista de IPs autorizadas (descifrada)
 * @param {string} userDataPath
 * @returns {Array<{ id: string, ip_address: string, description: string | null, activo: boolean }>}
 */
export function getAuthorizedIps(userDataPath) {
  const filePath = getFilePath(userDataPath);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const key = deriveKey(userDataPath);
    const data = readFileSync(filePath);
    const json = decrypt(data, key);
    const list = JSON.parse(json);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Error al leer IPs autorizadas:', err);
    return [];
  }
}

/**
 * Guarda la lista de IPs autorizadas (cifrada)
 * @param {string} userDataPath
 * @param {Array<{ id: string, ip_address: string, description?: string | null, activo?: boolean }>} list
 */
export function saveAuthorizedIps(userDataPath, list) {
  const key = deriveKey(userDataPath);
  const json = JSON.stringify(Array.isArray(list) ? list : []);
  const encrypted = encrypt(json, key);
  writeFileSync(getFilePath(userDataPath), encrypted);
}

/**
 * Devuelve las IPs activas (para comprobar en el servidor local)
 * @param {string} userDataPath
 * @returns {string[]}
 */
export function getActiveAuthorizedIps(userDataPath) {
  const list = getAuthorizedIps(userDataPath);
  return list.filter((item) => item.activo !== false).map((item) => String(item.ip_address).trim());
}
