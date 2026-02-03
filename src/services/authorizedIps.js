/**
 * Servicio de IPs Autorizadas
 * En la app de escritorio (Electron): almacenamiento local cifrado vía IPC.
 * En el navegador: no disponible (solo en Electron).
 */

function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI?.authorizedIps;
}

/**
 * Obtiene todas las IPs autorizadas (desde almacenamiento local cifrado en Electron)
 */
export async function getAuthorizedIps() {
  if (!isElectron()) {
    return [];
  }
  try {
    const list = await window.electronAPI.authorizedIps.get();
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Error al obtener IPs autorizadas:', err);
    throw new Error(err.message || 'Error al obtener IPs autorizadas');
  }
}

/**
 * Crea una IP autorizada (guardada localmente cifrada)
 */
export async function createAuthorizedIp(ipData) {
  if (!isElectron()) {
    throw new Error('Las IPs autorizadas solo están disponibles en la aplicación de escritorio');
  }
  const list = await getAuthorizedIps();
  const id = crypto.randomUUID?.() || `ip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newItem = {
    id,
    ip_address: String(ipData.ip_address || '').trim(),
    description: ipData.description ? String(ipData.description).trim() : null,
    activo: ipData.activo !== false,
  };
  list.unshift(newItem);
  const result = await window.electronAPI.authorizedIps.save(list);
  if (result?.success === false) {
    throw new Error(result.error || 'Error al guardar');
  }
  return newItem;
}

/**
 * Actualiza una IP autorizada
 */
export async function updateAuthorizedIp(id, ipData) {
  if (!isElectron()) {
    throw new Error('Las IPs autorizadas solo están disponibles en la aplicación de escritorio');
  }
  const list = await getAuthorizedIps();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('IP no encontrada');
  }
  list[index] = {
    ...list[index],
    ip_address: String(ipData.ip_address || '').trim(),
    description: ipData.description ? String(ipData.description).trim() : null,
    activo: ipData.activo !== false,
  };
  const result = await window.electronAPI.authorizedIps.save(list);
  if (result?.success === false) {
    throw new Error(result.error || 'Error al guardar');
  }
  return list[index];
}

/**
 * Elimina una IP autorizada
 */
export async function deleteAuthorizedIp(id) {
  if (!isElectron()) {
    throw new Error('Las IPs autorizadas solo están disponibles en la aplicación de escritorio');
  }
  const list = await getAuthorizedIps();
  const filtered = list.filter((item) => item.id !== id);
  if (filtered.length === list.length) {
    throw new Error('IP no encontrada');
  }
  const result = await window.electronAPI.authorizedIps.save(filtered);
  if (result?.success === false) {
    throw new Error(result.error || 'Error al guardar');
  }
}
