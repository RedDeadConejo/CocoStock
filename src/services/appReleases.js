/**
 * Servicio de releases de la app (actualizaciones)
 * Subida a Storage, registros en app_releases, versión mínima en app_version
 * Usa Supabase con RLS: solo Admin puede subir (Storage policy is_user_admin)
 */

import { supabase } from './supabase';

const BUCKET_NAME = 'app-releases';

const PLATFORM_OPTIONS = [
  { value: 'win32', label: 'Windows (x64)' },
  { value: 'darwin-x64', label: 'Mac Intel (x64)' },
  { value: 'darwin-arm64', label: 'Mac Apple Silicon (arm64)' },
  { value: 'linux', label: 'Linux (x64)' },
  { value: 'linux-arm64', label: 'Linux (arm64)' },
];

/**
 * Obtiene la versión mínima requerida (activa)
 */
export async function getMinimumVersion() {
  const { data, error } = await supabase
    .from('app_version')
    .select('id, minimum_version, is_active, updated_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Actualiza la versión mínima requerida
 * Crea o actualiza el registro activo
 */
export async function updateMinimumVersion(minimumVersion) {
  const v = String(minimumVersion || '').trim();
  if (!v) throw new Error('La versión mínima es obligatoria');

  const { data: existing } = await supabase
    .from('app_version')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('app_version')
      .update({ minimum_version: v })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  const { error } = await supabase
    .from('app_version')
    .insert({ minimum_version: v, is_active: true });
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Lista releases (todos, para administración)
 */
export async function getAppReleases() {
  const { data, error } = await supabase
    .from('app_releases')
    .select('id, version, platform, file_path, file_size, release_notes, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Sube un archivo al bucket app-releases y crea el registro en app_releases
 * @param {object} params
 * @param {string} params.version - Ej: 1.9.5
 * @param {string} params.platform - win32, darwin-x64, darwin-arm64, linux, linux-arm64
 * @param {File} params.file - Archivo a subir (.exe, .dmg, .zip)
 * @param {string} [params.releaseNotes] - Notas de la versión
 */
export async function createAppRelease({ version, platform, file, releaseNotes }) {
  const v = String(version || '').trim();
  const p = String(platform || '').trim();
  if (!v) throw new Error('La versión es obligatoria');
  if (!p) throw new Error('La plataforma es obligatoria');
  if (!file || !(file instanceof File)) throw new Error('Selecciona un archivo');

  const filePath = file.name || `release-${v}-${p}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) throw new Error('Error al subir: ' + uploadError.message);

  const { error: insertError } = await supabase
    .from('app_releases')
    .insert({
      version: v,
      platform: p,
      file_path: filePath,
      file_size: file.size || null,
      release_notes: releaseNotes?.trim() || null,
      is_active: true,
    });

  if (insertError) {
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    throw new Error('Error al registrar: ' + insertError.message);
  }

  return { success: true, filePath };
}

/**
 * Desactiva un release (soft disable)
 */
export async function deactivateAppRelease(id) {
  const { error } = await supabase
    .from('app_releases')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Reactiva un release
 */
export async function activateAppRelease(id) {
  const { error } = await supabase
    .from('app_releases')
    .update({ is_active: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export { PLATFORM_OPTIONS };
