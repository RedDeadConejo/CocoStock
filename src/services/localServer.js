/**
 * Servicio de Servidores Locales
 * Comunica con el proceso principal de Electron para manejar uno o varios servidores HTTP locales.
 * Cada servidor puede ser modo "merma" (solo interfaz merma, IPs autorizadas) o "full" (app completa).
 */

function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI;
}

/**
 * Inicia uno o varios servidores locales
 * @param {Array<{ port: number, mode: string, name?: string }>} serversConfig - Ej: [{ port: 8080, mode: 'merma', name: 'Merma' }, { port: 8081, mode: 'full', name: 'App completa' }]
 * @returns {Promise<{ success: boolean, servers?: Array<{ port, mode, name, url }>, errors?: Array<{ port, name, error }>, error?: string }>}
 */
export async function startLocalServer(serversConfig = []) {
  if (!isElectron()) {
    return {
      success: false,
      error: 'Esta funcionalidad solo está disponible en la aplicación de escritorio',
    };
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const result = await window.electronAPI.localServer.start(
      serversConfig,
      supabaseUrl,
      supabaseAnonKey
    );
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Error al iniciar el servidor local',
    };
  }
}

/**
 * Detiene todos los servidores locales
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function stopLocalServer() {
  if (!isElectron()) {
    return {
      success: false,
      error: 'Esta funcionalidad solo está disponible en la aplicación de escritorio',
    };
  }

  try {
    const result = await window.electronAPI.localServer.stop();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Error al detener el servidor local',
    };
  }
}

/**
 * Obtiene el estado de todos los servidores
 * @returns {Promise<{ running: boolean, servers: Array<{ port, mode, name, url }> }>}
 */
export async function getServerStatus() {
  if (!isElectron()) {
    return { running: false, servers: [] };
  }

  try {
    const status = await window.electronAPI.localServer.getStatus();
    return status;
  } catch (error) {
    console.error('Error al obtener estado del servidor:', error);
    return { running: false, servers: [] };
  }
}
