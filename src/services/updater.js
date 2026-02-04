/**
 * Servicio de actualizaciones
 * Obtiene la última release desde Supabase (tabla app_releases) y construye la URL de descarga (Storage)
 */

import { supabase } from './supabase';
import { APP_VERSION, compareVersions } from '../constants/version';

const BUCKET_NAME = 'app-releases';

/**
 * Obtiene la plataforma actual (solo en Electron)
 * @returns {string} 'win32' | 'darwin' | 'linux'
 */
function getPlatform() {
  if (typeof window !== 'undefined' && window.electronAPI?.platform) {
    return window.electronAPI.platform;
  }
  return 'win32';
}

/**
 * Construye la URL pública de descarga de un archivo en el bucket app-releases.
 * Codifica cada segmento del path para que nombres con espacios (ej. "CocoStock Setup 1.9.1.exe") funcionen.
 * @param {string} supabaseUrl - URL del proyecto (ej: https://xxx.supabase.co)
 * @param {string} filePath - Nombre o ruta del archivo en el bucket
 * @returns {string}
 */
export function getDownloadUrl(supabaseUrl, filePath) {
  const base = (supabaseUrl || '').replace(/\/$/, '');
  const path = (filePath || '').replace(/^\//, '');
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${base}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
}

/**
 * Obtiene la última release disponible para la plataforma actual desde Supabase
 * @returns {Promise<{
 *   available: boolean,
 *   currentVersion: string,
 *   latestVersion?: string,
 *   downloadUrl?: string,
 *   releaseNotes?: string,
 *   filePath?: string,
 *   fileSize?: number,
 *   error?: string
 * }>}
 */
export async function getLatestRelease() {
  const currentVersion = APP_VERSION;
  try {
    const platform = getPlatform();
    const { data, error } = await supabase
      .from('app_releases')
      .select('version, file_path, file_size, release_notes')
      .eq('platform', platform)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('Could not find the table')) {
        return { available: false, currentVersion, error: null };
      }
      return { available: false, currentVersion, error: error.message };
    }

    if (!data || !data.version || !data.file_path) {
      return { available: false, currentVersion };
    }

    const latestVersion = data.version;
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    if (!isNewer) {
      return { available: false, currentVersion, latestVersion };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const downloadUrl = getDownloadUrl(supabaseUrl, data.file_path);

    return {
      available: true,
      currentVersion,
      latestVersion,
      downloadUrl,
      releaseNotes: data.release_notes || null,
      filePath: data.file_path,
      fileSize: data.file_size || null,
    };
  } catch (err) {
    return {
      available: false,
      currentVersion,
      error: err.message || 'Error al comprobar actualizaciones',
    };
  }
}
