/**
 * Servicio de actualizaciones
 * Obtiene la última release desde Supabase (tabla app_releases) y construye la URL de descarga (Storage)
 */

import { supabase } from './supabase';
import { APP_VERSION, compareVersions } from '../constants/version';

const BUCKET_NAME = 'app-releases';

/**
 * Obtiene la plataforma actual (solo en Electron)
 * @returns {string} 'win32' | 'darwin-x64' | 'darwin-arm64' | 'linux' | 'linux-arm64'
 */
function getPlatform() {
  if (typeof window !== 'undefined' && window.electronAPI?.platform) {
    return window.electronAPI.platform;
  }
  return 'win32';
}

/**
 * Plataformas alternativas para fallback (ej: darwin-arm64 puede usar darwin-x64 vía Rosetta)
 */
function getPlatformFallbacks(platform) {
  if (platform === 'darwin-arm64') return ['darwin-arm64', 'darwin-x64'];
  if (platform === 'darwin-x64') return ['darwin-x64'];
  if (platform === 'linux-arm64') return ['linux-arm64', 'linux'];
  return [platform];
}

/**
 * Construye la URL pública de descarga (solo si el bucket es público).
 * @deprecated Usar getSignedDownloadUrl para buckets privados con RLS.
 */
export function getDownloadUrl(supabaseUrl, filePath) {
  const base = (supabaseUrl || '').replace(/\/$/, '');
  const path = (filePath || '').replace(/^\//, '');
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${base}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
}

/**
 * Obtiene una URL firmada de descarga para un archivo en el bucket app-releases.
 * Requiere usuario autenticado (RLS: solo authenticated pueden descargar).
 * La URL expira en 1 hora.
 * @param {string} filePath - Nombre o ruta del archivo en el bucket
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function getSignedDownloadUrl(filePath) {
  if (!filePath) return { error: 'filePath requerido' };
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 1 hora
  if (error) return { error: error.message };
  if (!data?.signedUrl) return { error: 'No se pudo generar la URL de descarga' };
  return { url: data.signedUrl };
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
    const platformsToTry = getPlatformFallbacks(platform);

    let data = null;
    let error = null;

    for (const p of platformsToTry) {
      const result = await supabase
        .from('app_releases')
        .select('version, file_path, file_size, release_notes, platform')
        .eq('platform', p)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        if (result.error.code === 'PGRST116' || result.error.code === '42P01' || result.error.message?.includes('Could not find the table')) {
          error = null;
          break;
        }
        error = result.error;
        break;
      }
      if (result.data?.version && result.data?.file_path) {
        data = result.data;
        break;
      }
    }

    if (error) {
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

    // URL firmada: requiere usuario autenticado (RLS Storage)
    const signedResult = await getSignedDownloadUrl(data.file_path);
    if (signedResult.error || !signedResult.url) {
      return {
        available: false,
        currentVersion,
        latestVersion,
        error: signedResult.error || 'No se pudo obtener la URL de descarga. Inicia sesión e inténtalo de nuevo.',
      };
    }

    return {
      available: true,
      currentVersion,
      latestVersion,
      downloadUrl: signedResult.url,
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
