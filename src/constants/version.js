/**
 * Constantes de versión de la aplicación
 * Actualizar este archivo cuando se lance una nueva versión
 */

export const APP_VERSION = '1.9.5';

/**
 * Compara dos versiones semánticas
 * @param {string} version1 - Primera versión (ej: "1.0.0")
 * @param {string} version2 - Segunda versión (ej: "1.0.1")
 * @returns {number} - -1 si version1 < version2, 0 si son iguales, 1 si version1 > version2
 */
export function compareVersions(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part < v2Part) return -1;
    if (v1Part > v2Part) return 1;
  }

  return 0;
}

/**
 * Verifica si una versión es menor que otra
 * @param {string} currentVersion - Versión actual
 * @param {string} minimumVersion - Versión mínima requerida
 * @returns {boolean} - true si la versión actual es menor que la mínima requerida
 */
export function isVersionOutdated(currentVersion, minimumVersion) {
  return compareVersions(currentVersion, minimumVersion) < 0;
}

