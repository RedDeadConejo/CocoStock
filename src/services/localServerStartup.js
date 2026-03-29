/**
 * Arranca un subconjunto de servidores locales (registro de tokens merma + IPC).
 * Compartido por Ajustes y por el auto-inicio tras login en Layout.
 */

import { startLocalServer } from './localServer';
import { registerMermaServerToken, unregisterMermaServerToken } from './merma';

/**
 * @param {Array<{ port: number, mode: string, name?: string, restaurantId?: string }>} serversToStart
 * @param {Array<{ id: string, nombre: string }>} restaurants
 * @returns {Promise<{ success: boolean, tokens: string[], result: object }>}
 */
export async function startConfiguredLocalServers(serversToStart, restaurants = []) {
  if (!Array.isArray(serversToStart) || serversToStart.length === 0) {
    return { success: true, tokens: [], result: { success: true, servers: [] } };
  }

  const tokens = [];
  const config = [];

  try {
    for (const s of serversToStart) {
      const base = { port: s.port, mode: s.mode, name: s.name };
      if (s.mode === 'merma' && s.restaurantId) {
        const token =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await registerMermaServerToken(token, s.restaurantId);
        tokens.push(token);
        const restaurant = restaurants.find((r) => r.id === s.restaurantId);
        config.push({
          ...base,
          token,
          restaurantId: s.restaurantId,
          restaurantName: restaurant?.nombre || '',
        });
      } else {
        config.push(base);
      }
    }

    const result = await startLocalServer(config);

    if (!result.success) {
      for (const t of tokens) {
        try {
          await unregisterMermaServerToken(t);
        } catch (_) {}
      }
      return { success: false, tokens: [], result };
    }

    return { success: true, tokens, result };
  } catch (err) {
    for (const t of tokens) {
      try {
        await unregisterMermaServerToken(t);
      } catch (_) {}
    }
    throw err;
  }
}
