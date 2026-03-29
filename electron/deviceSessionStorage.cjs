/**
 * Sesión Supabase cifrada en disco, ligada a la huella del equipo.
 * Si se copia el archivo a otro PC, la clave derivada no coincide y no se restaura.
 * Si pasan >2 días sin renovar lastRefreshAt, la sesión deja de ser válida.
 */
const { readFileSync, writeFileSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');
const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require('crypto');
const { getMachineFingerprint } = require('./machineFingerprint.cjs');

const FILENAME = 'device_session.enc';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = Buffer.from('cocostock-device-session-v2', 'utf8');
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function deriveKey(userDataPath, machineFingerprint) {
  return scryptSync(`${userDataPath}|${machineFingerprint}`, SALT, KEY_LENGTH);
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

function clearDeviceSession(userDataPath) {
  const fp = getFilePath(userDataPath);
  if (existsSync(fp)) {
    try {
      unlinkSync(fp);
    } catch (_) {}
  }
}

/**
 * @returns {{ ok: true, session: object } | { ok: false, reason: string }}
 */
function restoreDeviceSession(userDataPath) {
  const filePath = getFilePath(userDataPath);
  if (!existsSync(filePath)) {
    return { ok: false, reason: 'missing' };
  }
  const machineFingerprint = getMachineFingerprint();
  const key = deriveKey(userDataPath, machineFingerprint);
  let json;
  try {
    const buf = readFileSync(filePath);
    json = decrypt(buf, key);
  } catch (err) {
    console.warn('CocoStock: sesión de dispositivo ilegible (otro equipo o archivo corrupto):', err.message);
    clearDeviceSession(userDataPath);
    return { ok: false, reason: 'wrong_machine_or_corrupt' };
  }
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    clearDeviceSession(userDataPath);
    return { ok: false, reason: 'corrupt' };
  }
  const { session, lastRefreshAt } = payload;
  if (!session || typeof lastRefreshAt !== 'number') {
    clearDeviceSession(userDataPath);
    return { ok: false, reason: 'invalid_payload' };
  }
  if (Date.now() - lastRefreshAt > TWO_DAYS_MS) {
    clearDeviceSession(userDataPath);
    return { ok: false, reason: 'expired' };
  }
  if (!session.access_token || !session.refresh_token) {
    clearDeviceSession(userDataPath);
    return { ok: false, reason: 'invalid_session' };
  }
  return { ok: true, session };
}

/**
 * @param {object} session - Objeto sesión Supabase (campos mínimos serializables)
 */
function saveDeviceSession(userDataPath, session) {
  if (!session || !session.access_token || !session.refresh_token) return;
  const machineFingerprint = getMachineFingerprint();
  const key = deriveKey(userDataPath, machineFingerprint);
  const payload = JSON.stringify({
    session,
    lastRefreshAt: Date.now(),
  });
  writeFileSync(getFilePath(userDataPath), encrypt(payload, key));
}

/**
 * Extiende la ventana de 2 días mientras el usuario sigue usando la app (sin cambiar tokens).
 */
function touchDeviceSession(userDataPath) {
  const filePath = getFilePath(userDataPath);
  if (!existsSync(filePath)) return false;
  const machineFingerprint = getMachineFingerprint();
  const key = deriveKey(userDataPath, machineFingerprint);
  let payload;
  try {
    const buf = readFileSync(filePath);
    const json = decrypt(buf, key);
    payload = JSON.parse(json);
  } catch {
    return false;
  }
  if (!payload.session || typeof payload.lastRefreshAt !== 'number') return false;
  if (Date.now() - payload.lastRefreshAt > TWO_DAYS_MS) {
    clearDeviceSession(userDataPath);
    return false;
  }
  payload.lastRefreshAt = Date.now();
  writeFileSync(filePath, encrypt(JSON.stringify(payload), key));
  return true;
}

module.exports = {
  restoreDeviceSession,
  saveDeviceSession,
  touchDeviceSession,
  clearDeviceSession,
};
