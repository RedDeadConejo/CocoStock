/**
 * Actualizaciones: lee app_releases en Supabase y descarga desde Storage (bucket app-releases).
 *
 * En Electron no se firma la URL hasta hacer clic: el main descarga con session.downloadURL (Chromium).
 * En web/navegador se obtiene la URL firmada al comprobar la release (para window.open).
 */

import { supabase } from './supabase';
import { APP_VERSION, compareVersions } from '../constants/version';
import { isNativeAndroidApp } from '../utils/capacitorPlatform';

const BUCKET_NAME = 'app-releases';
const SIGNED_URL_TTL_SEC = 3600;

function isElectronUpdater() {
  return typeof window !== 'undefined' && typeof window.electronAPI?.updater?.download === 'function';
}

function getPlatform() {
  if (typeof window !== 'undefined' && isNativeAndroidApp()) {
    return 'android';
  }
  if (typeof window !== 'undefined' && window.electronAPI?.platform) {
    return window.electronAPI.platform;
  }
  return 'win32';
}

/** No encadenar win32 con win32-win7: son instaladores distintos. */
function getPlatformFallbacks(platform) {
  if (platform === 'android') return [];
  if (platform === 'win32-win7') return ['win32-win7'];
  if (platform === 'darwin-arm64') return ['darwin-arm64', 'darwin-x64'];
  if (platform === 'darwin-x64') return ['darwin-x64'];
  if (platform === 'linux-arm64') return ['linux-arm64', 'linux'];
  return [platform];
}

async function fetchLatestReleaseRow(platformKey) {
  const key = String(platformKey || '').trim();
  const result = await supabase
    .from('app_releases')
    .select('version, file_path, file_size, release_notes, platform')
    .eq('platform', key)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    const benign =
      result.error.code === 'PGRST116' ||
      result.error.code === '42P01' ||
      (result.error.message && result.error.message.includes('Could not find the table'));
    if (benign) return { error: null, data: result.data || null };
    return { error: result.error, data: null };
  }
  return { error: null, data: result.data || null };
}

async function fetchLatestReleaseFirstMatch(platformKeys) {
  let data = null;
  let error = null;

  for (const p of platformKeys) {
    const result = await fetchLatestReleaseRow(p);
    if (result.error) {
      const benign =
        result.error.code === 'PGRST116' ||
        result.error.code === '42P01' ||
        result.error.message?.includes('Could not find the table');
      if (benign) {
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
  return { data, error };
}

/**
 * Común a escritorio (sin URL aún) y web (con downloadUrl).
 * @param {object} data - fila app_releases
 * @param {string} currentVersion
 * @param {Record<string, unknown>} [extra] - hint, newerOnOtherPlatform, etc.
 */
async function buildAvailableUpdatePayload(data, currentVersion, extra = {}) {
  const latestVersion = data.version;
  const common = {
    available: true,
    currentVersion,
    latestVersion,
    releaseNotes: data.release_notes ?? null,
    filePath: data.file_path,
    fileSize: data.file_size ?? null,
    ...extra,
  };

  if (isElectronUpdater()) {
    return common;
  }

  const signed = await getSignedDownloadUrl(data.file_path);
  if (signed.error || !signed.url) {
    return {
      available: false,
      currentVersion,
      latestVersion,
      error:
        signed.error ||
        'No se pudo obtener la URL de descarga. Inicia sesión e inténtalo de nuevo.',
      ...extra,
    };
  }
  return { ...common, downloadUrl: signed.url };
}

/**
 * Windows 7: solo fila win32-win7 para instalador; win32 solo informativa.
 */
async function getLatestReleaseWin7Legacy(currentVersion) {
  const primary = await fetchLatestReleaseRow('win32-win7');
  if (primary.error) {
    return { available: false, currentVersion, error: primary.error.message };
  }

  const win32Channel = await fetchLatestReleaseRow('win32');
  const data =
    primary.data?.version && primary.data?.file_path ? primary.data : null;
  const win32Data =
    win32Channel.data?.version && win32Channel.data?.file_path ? win32Channel.data : null;

  let newerOnOtherPlatform = null;
  if (win32Data && (!data || compareVersions(win32Data.version, data.version) > 0)) {
    newerOnOtherPlatform = { version: win32Data.version, platform: 'win32' };
  }

  if (!data) {
    return {
      available: false,
      currentVersion,
      latestVersion: win32Data?.version,
      newerOnOtherPlatform,
      hint: win32Data
        ? `En el servidor la versión más alta es ${win32Data.version} solo para Windows 10+ (win32). Publica también una release con plataforma win32-win7 y el instalador Win7 para ofrecerla aquí.`
        : 'No hay ninguna release activa para Windows 7 (plataforma win32-win7) en el servidor.',
    };
  }

  const latestVersion = data.version;
  const isNewer = compareVersions(latestVersion, currentVersion) > 0;
  const hintWin32Higher =
    newerOnOtherPlatform &&
    compareVersions(newerOnOtherPlatform.version, latestVersion) > 0
      ? `Hay ${newerOnOtherPlatform.version} para Windows 10+; para Windows 7 la última en servidor es ${latestVersion}. Sube un build win32-win7 de ${newerOnOtherPlatform.version} si debe estar disponible en Win7.`
      : undefined;

  if (!isNewer) {
    return {
      available: false,
      currentVersion,
      latestVersion,
      newerOnOtherPlatform: hintWin32Higher ? newerOnOtherPlatform : undefined,
      hint: hintWin32Higher,
    };
  }

  return await buildAvailableUpdatePayload(data, currentVersion, {
    hint: hintWin32Higher,
    newerOnOtherPlatform: hintWin32Higher ? newerOnOtherPlatform : undefined,
  });
}

function storageReleaseBasename(filePath) {
  if (!filePath) return null;
  return String(filePath).split(/[/\\]/).filter(Boolean).pop() || filePath;
}

/**
 * Descarga en Electron: firma en el renderer al hacer clic; el main usa session.downloadURL.
 */
export async function startElectronReleaseDownload(updateInfo) {
  const api = typeof window !== 'undefined' ? window.electronAPI?.updater : null;
  if (!api?.download) {
    return { error: 'La descarga solo está disponible en la app de escritorio.' };
  }

  const localName = storageReleaseBasename(updateInfo.filePath);

  if (updateInfo.downloadUrl) {
    return { promise: api.download(updateInfo.downloadUrl, localName || updateInfo.filePath || null) };
  }

  if (!updateInfo.filePath) {
    return { error: 'No hay archivo de actualización definido.' };
  }

  await supabase.auth.refreshSession().catch(() => {});
  const signed = await getSignedDownloadUrl(updateInfo.filePath);
  if (signed.error || !signed.url) {
    return {
      error:
        signed.error ||
        'No se pudo generar el enlace de descarga. Inicia sesión e inténtalo de nuevo.',
    };
  }

  return { promise: api.download(signed.url, localName) };
}

/**
 * @deprecated Solo buckets públicos.
 */
export function getDownloadUrl(supabaseUrl, filePath) {
  const base = (supabaseUrl || '').replace(/\/$/, '');
  const path = (filePath || '').replace(/^\//, '');
  const encodedPath = path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${base}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
}

/**
 * URL firmada temporal (RLS Storage: anon/authenticated según proyecto).
 */
export async function getSignedDownloadUrl(filePath) {
  if (!filePath) return { error: 'filePath requerido' };
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SEC);
  if (error) return { error: error.message };
  if (!data?.signedUrl) return { error: 'No se pudo generar la URL de descarga' };
  return { url: data.signedUrl };
}

/**
 * @returns {Promise<{
 *   available: boolean,
 *   currentVersion: string,
 *   latestVersion?: string,
 *   downloadUrl?: string,
 *   releaseNotes?: string | null,
 *   filePath?: string,
 *   fileSize?: number | null,
 *   error?: string,
 *   updateViaPlayStore?: boolean,
 *   hint?: string,
 *   newerOnOtherPlatform?: { version: string, platform: string },
 * }>}
 */
export async function getLatestRelease() {
  const currentVersion = APP_VERSION;
  try {
    const platform = getPlatform();
    if (platform === 'android') {
      return { available: false, currentVersion, updateViaPlayStore: true };
    }

    if (platform === 'win32-win7') {
      return await getLatestReleaseWin7Legacy(currentVersion);
    }

    const { data, error } = await fetchLatestReleaseFirstMatch(getPlatformFallbacks(platform));

    if (error) {
      return { available: false, currentVersion, error: error.message };
    }
    if (!data?.version || !data?.file_path) {
      return { available: false, currentVersion };
    }

    const latestVersion = data.version;
    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return { available: false, currentVersion, latestVersion };
    }

    return await buildAvailableUpdatePayload(data, currentVersion);
  } catch (err) {
    return {
      available: false,
      currentVersion,
      error: err.message || 'Error al comprobar actualizaciones',
    };
  }
}
