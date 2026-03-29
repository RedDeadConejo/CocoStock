/**
 * Almacenamiento local cifrado de IPs autorizadas (CommonJS, proceso Electron)
 */
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require('crypto');

const FILENAME = 'authorized_ips.enc';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function deriveKey(userDataPath) {
  const salt = Buffer.from('cocostock-authorized-ips-v1', 'utf8');
  return scryptSync(userDataPath, salt, KEY_LENGTH);
}

function getFilePath(userDataPath) {
  return join(userDataPath, FILENAME);
}

function encrypt(plainText, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(data, key) {
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

function getAuthorizedIps(userDataPath) {
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

function saveAuthorizedIps(userDataPath, list) {
  const key = deriveKey(userDataPath);
  const json = JSON.stringify(Array.isArray(list) ? list : []);
  const encrypted = encrypt(json, key);
  writeFileSync(getFilePath(userDataPath), encrypted);
}

function getActiveAuthorizedIps(userDataPath) {
  const list = getAuthorizedIps(userDataPath);
  return list.filter((item) => item.activo !== false).map((item) => String(item.ip_address).trim());
}

module.exports = {
  getAuthorizedIps,
  saveAuthorizedIps,
  getActiveAuthorizedIps,
};
