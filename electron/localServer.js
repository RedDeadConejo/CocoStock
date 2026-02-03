/**
 * Servidor HTTP Local (múltiples instancias)
 * Sirve la aplicación desde la carpeta dist para acceso remoto en la red local.
 * Soporta varios servidores: uno para merma (IPs autorizadas), otro para app completa, etc.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {Map<number, { server: import('http').Server, mode: string, name: string }>} */
const servers = new Map();

let supabaseUrl = null;
let supabaseAnonKey = null;
let supabaseClient = null;

/**
 * Configura el cliente de Supabase (para otras funciones si se necesitan)
 */
export function configureSupabase(url, anonKey) {
  supabaseUrl = url;
  supabaseAnonKey = anonKey;
  if (url && anonKey) {
    supabaseClient = createClient(url, anonKey);
  }
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Comprueba si la IP está en la lista local (cifrada en disco, pasada al iniciar el servidor)
 * @param {string} ipAddress
 * @param {string[]} authorizedIpsList - Lista de IPs autorizadas (solo activas)
 */
function isIpAuthorized(ipAddress, authorizedIpsList) {
  if (!ipAddress || ipAddress === 'unknown' || !Array.isArray(authorizedIpsList)) {
    return false;
  }
  const ip = String(ipAddress).trim();
  return authorizedIpsList.some((allowed) => String(allowed).trim() === ip);
}

/**
 * Obtiene la IP local de la máquina
 */
export function getLocalIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Crea una app Express para un puerto y modo dados
 * @param {string} distPath
 * @param {number} port
 * @param {string} mode - 'merma' | 'full'
 * @param {{ token?: string, restaurantId?: string, restaurantName?: string, authorizedIpsList?: string[] }} mermaContext - Solo para mode 'merma'
 */
function createAppForMode(distPath, port, mode, mermaContext = {}) {
  const authorizedIpsList = mermaContext.authorizedIpsList || [];
  const token = mermaContext.token || '';
  const restaurantId = mermaContext.restaurantId || '';
  const restaurantName = mermaContext.restaurantName || '';
  /** @type {Map<string, { token: string, restaurantId: string }>} */
  const mermaSessionMap = mode === 'merma' ? new Map() : null;

  const app = express();

  app.use((req, res, next) => {
    req.clientIP = getClientIP(req);
    next();
  });

  app.use(express.json());

  // API merma: todos los datos pasan por el servidor local (el cliente nunca tiene el token)
  if (mode === 'merma' && mermaSessionMap) {
    app.get('/api/products', async (req, res) => {
      if (!isIpAuthorized(req.clientIP, authorizedIpsList)) {
        res.status(403).json({ error: 'IP no autorizada' });
        return;
      }
      if (!supabaseClient) {
        res.status(503).json({ error: 'Servicio no disponible' });
        return;
      }
      try {
        const { data, error } = await supabaseClient.rpc('get_products_for_merma');
        if (error) throw error;
        res.json(data || []);
      } catch (err) {
        console.error('Error /api/products:', err);
        res.status(500).json({ error: err.message || 'Error al cargar productos' });
      }
    });

    app.post('/api/merma', async (req, res) => {
      if (!isIpAuthorized(req.clientIP, authorizedIpsList)) {
        res.status(403).json({ error: 'IP no autorizada' });
        return;
      }
      const { session_id, product_id, quantity, motivo, fecha } = req.body || {};
      if (!session_id || !product_id) {
        res.status(400).json({ error: 'Faltan session_id o product_id' });
        return;
      }
      const session = mermaSessionMap.get(String(session_id));
      if (!session) {
        res.status(401).json({ error: 'Sesión no válida o expirada' });
        return;
      }
      if (!supabaseClient) {
        res.status(503).json({ error: 'Servicio no disponible' });
        return;
      }
      try {
        const { data, error } = await supabaseClient.rpc('create_merma_with_token', {
          p_token: session.token,
          p_restaurant_id: session.restaurantId,
          p_product_id: product_id,
          p_quantity: parseFloat(quantity) || 0,
          p_motivo: motivo ? String(motivo).trim() : null,
          p_fecha: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
        });
        if (error) throw error;
        res.json({ success: true, id: data });
      } catch (err) {
        console.error('Error /api/merma:', err);
        res.status(500).json({ error: err.message || 'Error al registrar merma' });
      }
    });
  }

  app.use(express.static(distPath, {
    index: false,
    setHeaders: (res, path) => {
      if (path.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  app.get('*', async (req, res) => {
    const indexPath = join(distPath, 'index.html');
    if (!existsSync(indexPath)) {
      res.status(404).send('Archivo no encontrado');
      return;
    }

    if (mode === 'full') {
      // App completa: servir index.html sin comprobar IP
      try {
        const html = readFileSync(indexPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(html);
      } catch (err) {
        console.error('Error al leer index.html:', err);
        res.status(500).send('Error al cargar la aplicación');
      }
      return;
    }

    // mode === 'merma': verificar IP contra lista local (cifrada en disco)
    const clientIP = req.clientIP;
    const isAuthorized = isIpAuthorized(clientIP, authorizedIpsList);

    if (isAuthorized) {
      try {
        let html = readFileSync(indexPath, 'utf8');
        const sessionId = mermaSessionMap ? randomUUID() : '';
        if (mermaSessionMap && sessionId) {
          mermaSessionMap.set(sessionId, { token, restaurantId });
        }
        const sessionIdEscaped = (sessionId || '').replace(/'/g, "\\'").replace(/</g, '\\u003c');
        const restaurantNameEscaped = (restaurantName || '').replace(/'/g, "\\'").replace(/</g, '\\u003c');
        const localScript = `
            <script>
              (function() {
                sessionStorage.setItem('merma_local_access', 'true');
                sessionStorage.setItem('merma_session_id', '${sessionIdEscaped}');
                sessionStorage.setItem('merma_restaurant_name', '${restaurantNameEscaped}');
                if (!window.location.search.includes('local=true')) {
                  window.history.replaceState({}, '', window.location.pathname + '?local=true');
                }
              })();
            </script>
          `;
        html = html.replace('</head>', `${localScript}</head>`);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(html);
      } catch (err) {
        console.error('Error al leer index.html:', err);
        res.status(500).send('Error al cargar la aplicación');
      }
    } else {
      res.status(403).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Acceso Denegado</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 2rem; }
              .error-container { text-align: center; max-width: 500px; }
              h1 { color: #DC2626; margin-bottom: 1rem; }
              p { color: #D1D5DB; line-height: 1.6; }
              .ip-info { color: #9CA3AF; font-size: 0.9rem; margin-top: 1rem; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>🔒 Acceso Denegado</h1>
              <p>Tu dirección IP no está autorizada para acceder a esta interfaz.</p>
              <p class="ip-info">IP detectada: ${clientIP}</p>
              <p style="margin-top: 1.5rem; font-size: 0.9rem;">Contacta con un administrador para solicitar acceso.</p>
            </div>
          </body>
        </html>
      `);
    }
  });

  return app;
}

/**
 * Inicia uno o varios servidores locales
 * @param {Array<{ port: number, mode: string, name?: string }>} serversConfig
 * @param {string} supabaseUrl
 * @param {string} supabaseAnonKey
 * @param {string[]} authorizedIpsList - IPs autorizadas para merma (almacenadas localmente cifradas)
 * @returns {Promise<{ success: boolean, servers?: Array<...>, errors?: Array<...> }>}
 */
export async function startLocalServer(serversConfig = [], supabaseUrlArg = null, supabaseAnonKeyArg = null, authorizedIpsList = []) {
  if (serversConfig.length === 0) {
    return { success: true, servers: [] };
  }

  if (supabaseUrlArg && supabaseAnonKeyArg) {
    configureSupabase(supabaseUrlArg, supabaseAnonKeyArg);
  }

  const distPath = join(__dirname, '../dist');
  if (!existsSync(join(distPath, 'index.html'))) {
    return {
      success: false,
      error: 'No se encontró dist/index.html. Compila la aplicación primero.',
    };
  }

  const results = [];
  const errors = [];

  for (const config of serversConfig) {
    const port = Number(config.port) || 8080;
    const mode = (config.mode === 'full' ? 'full' : 'merma');
    const name = config.name || (mode === 'merma' ? 'Merma' : 'App completa');
    const mermaContext = mode === 'merma' ? {
      token: config.token || '',
      restaurantId: config.restaurantId || '',
      restaurantName: config.restaurantName || '',
      authorizedIpsList: Array.isArray(authorizedIpsList) ? authorizedIpsList : [],
    } : {};

    if (servers.has(port)) {
      errors.push({ port, name, error: `El puerto ${port} ya está en uso por otro servidor.` });
      continue;
    }

    const app = createAppForMode(distPath, port, mode, mermaContext);

    try {
      const serverInstance = await new Promise((resolve, reject) => {
        const srv = app.listen(port, '0.0.0.0', () => {
          const ip = getLocalIP();
          const url = `http://${ip}:${port}`;
          console.log(`Servidor local [${name}] en ${url} (modo: ${mode})`);
          resolve(srv);
        });
        srv.on('error', (err) => {
          let msg = err.message || 'Error al iniciar';
          if (err.code === 'EADDRINUSE') msg = `El puerto ${port} ya está en uso.`;
          else if (err.code === 'EACCES') msg = `Sin permisos para el puerto ${port}.`;
          reject(new Error(msg));
        });
      });

      servers.set(port, { server: serverInstance, mode, name });
      const ip = getLocalIP();
      results.push({ port, mode, name, url: `http://${ip}:${port}` });
    } catch (err) {
      errors.push({ port, name, error: err.message || 'Error al iniciar' });
    }
  }

  return {
    success: errors.length === 0,
    servers: results,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Detiene todos los servidores locales
 * @returns {Promise<boolean>}
 */
export async function stopLocalServer() {
  const closePromises = [];
  for (const [port, { server: srv }] of servers.entries()) {
    closePromises.push(
      new Promise((resolve) => {
        srv.close(() => {
          console.log(`Servidor local en puerto ${port} detenido`);
          resolve();
        });
      })
    );
  }
  servers.clear();
  if (closePromises.length > 0) {
    await Promise.all(closePromises);
  }
  return true;
}

/**
 * Estado de todos los servidores
 * @returns {{ running: boolean, servers: Array<{ port: number, mode: string, name: string, url: string }> }}
 */
export function getServerStatus() {
  const ip = getLocalIP();
  const list = [];
  for (const [port, { mode, name }] of servers.entries()) {
    list.push({
      port,
      mode,
      name,
      url: `http://${ip}:${port}`,
    });
  }
  return {
    running: servers.size > 0,
    servers: list,
  };
}
