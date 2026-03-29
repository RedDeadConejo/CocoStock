/**
 * Lista de servidores locales (Electron): lectura/escritura cifrada cuando secureStorage está disponible.
 */

export const LOCAL_SERVERS_STORAGE_KEY = 'cocostock_local_servers';

export async function loadLocalServersFromStorage() {
  try {
    const { getItem } = await import('./secureStorage');
    const stored = await getItem(LOCAL_SERVERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_SERVERS_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('Error al cargar servidores locales:', e);
  }
  return [];
}

export async function saveLocalServersToStorage(list) {
  try {
    const { setItem } = await import('./secureStorage');
    await setItem(LOCAL_SERVERS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error al guardar servidores locales:', e);
  }
}
