# Servidor Local - Documentación Técnica

## 📋 Resumen

La aplicación CocoStock incluye una funcionalidad para convertir la instancia local de Electron en un servidor HTTP accesible desde la red local. Esto permite que otros dispositivos (computadoras, tablets, smartphones) en la misma red puedan acceder a la aplicación mediante un navegador web, utilizando la IP local y un puerto configurable, mientras se mantiene toda la funcionalidad con Supabase.

### Características Principales

- ✅ **Acceso desde la red local**: Cualquier dispositivo en la misma red puede acceder a la aplicación
- ✅ **Interfaz en el login**: Opción fácil de habilitar/deshabilitar desde la pantalla de inicio de sesión
- ✅ **Configuración de puerto**: Puerto personalizable (por defecto: 8080)
- ✅ **Indicadores de estado**: Visualización clara del estado del servidor y URL de acceso
- ✅ **Compatibilidad con Supabase**: Todas las llamadas a Supabase funcionan correctamente desde dispositivos remotos
- ✅ **Detención automática**: El servidor se detiene automáticamente al cerrar la aplicación
- ✅ **Manejo de errores**: Gestión adecuada de puertos ocupados y errores de permisos

---

## 🏗️ Arquitectura del Sistema

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         electron/localServer.js                        │  │
│  │  - startLocalServer()                                  │  │
│  │  - stopLocalServer()                                   │  │
│  │  - getServerStatus()                                   │  │
│  │  - getLocalIP()                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         │ IPC                                │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         electron/preload.js                            │  │
│  │  - contextBridge (window.electronAPI)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ window.electronAPI
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Renderer Process (React)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         src/services/localServer.js                    │  │
│  │  - startLocalServer()                                  │  │
│  │  - stopLocalServer()                                   │  │
│  │  - getServerStatus()                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         │ Props/State                        │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      src/components/Auth/Auth.jsx                      │  │
│  │  - UI de control del servidor                          │  │
│  │  - Estado y manejo de eventos                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Dispositivos en la Red Local                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Computadora │  │   Tablet     │  │  Smartphone  │      │
│  │  Navegador   │  │  Navegador   │  │  Navegador   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Supabase API Calls (directas)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Cloud                            │
│  - Autenticación                                             │
│  - Base de datos                                             │
│  - Storage                                                   │
└─────────────────────────────────────────────────────────────┘
```

### Capas del Sistema

#### 1. **Capa de Servidor (Main Process)**
- **Ubicación**: `electron/localServer.js`
- **Responsabilidades**:
  - Iniciar/detener servidor Express
  - Servir archivos estáticos desde `dist/`
  - Detectar IP local de la máquina
  - Manejar errores y puertos ocupados

#### 2. **Capa de IPC (Inter-Process Communication)**
- **Ubicación**: `electron/preload.js`, `electron/main.js`
- **Responsabilidades**:
  - Exponer APIs seguras desde el proceso principal
  - Manejar comunicación bidireccional entre procesos
  - Mantener aislamiento de contexto (security)

#### 3. **Capa de Servicio (Renderer Process)**
- **Ubicación**: `src/services/localServer.js`
- **Responsabilidades**:
  - Abstracción de las APIs de Electron
  - Detección de entorno (Electron vs Web)
  - Manejo de errores en el contexto React

#### 4. **Capa de UI (Componente React)**
- **Ubicación**: `src/components/Auth/Auth.jsx`
- **Responsabilidades**:
  - Interfaz de usuario para control del servidor
  - Gestión de estado local
  - Actualización periódica del estado del servidor
  - Validación de entrada de usuario

---

## 📁 Estructura de Archivos

```
CocoStock/
├── electron/
│   ├── main.js                 # Proceso principal de Electron
│   ├── preload.js              # Script de preload para IPC
│   └── localServer.js          # Servidor HTTP con Express
│
├── src/
│   ├── services/
│   │   └── localServer.js      # Servicio React para comunicación con Electron
│   ├── components/
│   │   └── Auth/
│   │       ├── Auth.jsx        # Componente de login (actualizado)
│   │       └── Auth.css        # Estilos (actualizado)
│   └── types/
│       └── electron.d.ts       # Declaraciones TypeScript
│
└── docs/
    └── LOCAL_SERVER.md         # Esta documentación
```

---

## 🔄 Flujo de Funcionamiento

### 1. Inicio del Servidor

```
Usuario activa toggle en Auth.jsx
         │
         ▼
handleToggleLocalServer(enabled=true)
         │
         ▼
localServer.start(port)
         │
         ▼
IPC: 'local-server:start'
         │
         ▼
electron/localServer.js: startLocalServer()
         │
         ├─► Express app creado
         ├─► Servir archivos desde dist/
         ├─► Detectar IP local
         └─► Escuchar en 0.0.0.0:port
         │
         ▼
Retornar {success: true, url, port, ip}
         │
         ▼
Actualizar estado en Auth.jsx
         │
         ▼
Mostrar URL de acceso al usuario
```

### 2. Acceso desde Dispositivo Remoto

```
Dispositivo remoto navega a http://IP:PORT
         │
         ▼
Express sirve index.html desde dist/
         │
         ▼
Navegador carga aplicación React
         │
         ├─► Cargar assets (JS, CSS, imágenes)
         ├─► Inicializar aplicación
         └─► Cargar componentes
         │
         ▼
Aplicación hace llamadas a Supabase
         │
         ▼
Llamadas van directamente a Supabase Cloud
         │
         └─► (No pasan por el servidor local)
```

### 3. Detención del Servidor

```
Usuario desactiva toggle O App se cierra
         │
         ▼
handleToggleLocalServer(enabled=false)
         │
         ▼
localServer.stop()
         │
         ▼
IPC: 'local-server:stop'
         │
         ▼
electron/localServer.js: stopLocalServer()
         │
         ▼
server.close()
         │
         ▼
Servidor detenido
```

---

## 🔧 Componentes Técnicos

### electron/localServer.js

#### Funciones Principales

```javascript
// Inicia el servidor HTTP
async function startLocalServer(port = 8080)
  → Promise<{success, url, port, ip, error}>

// Detiene el servidor HTTP
async function stopLocalServer()
  → Promise<boolean>

// Obtiene el estado actual
function getServerStatus()
  → {running, port, url, ip}

// Obtiene la IP local
function getLocalIP()
  → string
```

#### Detalles de Implementación

- **Framework**: Express.js
- **Puerto por defecto**: 8080
- **Host binding**: `0.0.0.0` (accesible desde cualquier interfaz de red)
- **Archivos servidos**: Carpeta `dist/` (construcción de producción)
- **SPA Support**: Todas las rutas redirigen a `index.html` para soportar React Router

#### Manejo de Errores

- **EADDRINUSE**: Puerto ya en uso → Mensaje claro al usuario
- **EACCES**: Sin permisos → Sugerencia de usar puerto > 1024
- **Otros errores**: Mensaje genérico con detalles del error

### electron/preload.js

#### Propósito

Exponer de forma segura las APIs del proceso principal al proceso de renderizado usando `contextBridge`.

#### API Expuesta

```javascript
window.electronAPI = {
  localServer: {
    start: (port) => Promise<{...}>,
    stop: () => Promise<{...}>,
    getStatus: () => Promise<{...}>
  }
}
```

### src/services/localServer.js

#### Funcionalidad

Abstracción de las APIs de Electron con verificación de entorno.

#### Características

- **Detección de Electron**: Verifica si `window.electronAPI` existe
- **Fallback graceful**: Retorna errores apropiados si no está en Electron
- **Misma interfaz**: API idéntica independientemente del entorno

### src/components/Auth/Auth.jsx

#### Estado Agregado

```javascript
const [enableLocalServer, setEnableLocalServer] = useState(false);
const [serverStatus, setServerStatus] = useState({ running: false });
const [serverPort, setServerPort] = useState('8080');
const [serverError, setServerError] = useState('');
```

#### Funcionalidades

1. **Toggle de servidor**: Checkbox para habilitar/deshabilitar
2. **Input de puerto**: Campo numérico para configurar puerto
3. **Indicadores de estado**:
   - Servidor iniciando
   - Servidor activo (con URL)
   - Errores
4. **Actualización periódica**: Verifica estado cada 2 segundos cuando está activo

---

## 🔐 Seguridad

### Consideraciones de Seguridad

#### ✅ Implementado

1. **Context Isolation**: Habilitado en Electron (protege contra acceso directo a Node.js)
2. **No Node Integration**: Deshabilitado en el renderer process
3. **Web Security**: Habilitado en Electron
4. **Supabase Auth**: Las credenciales no se exponen (autenticación directa con Supabase)

#### ⚠️ Consideraciones

1. **Red Local**: El servidor es accesible solo en la red local (no expuesto a internet)
2. **Sin Autenticación HTTP**: El servidor local no tiene autenticación propia (depende de Supabase)
3. **Firewall**: El usuario debe permitir conexiones entrantes en el puerto configurado

### Recomendaciones

- **Producción**: Considerar agregar autenticación adicional si se expone fuera de la red local
- **Firewall**: Asegurar que el firewall permita conexiones en el puerto configurado
- **Red Privada**: Solo usar en redes privadas confiables

---

## 📝 Uso

### Para el Usuario Final

1. **Iniciar la aplicación Electron**
2. **En la pantalla de login**:
   - Activar el toggle "Habilitar acceso web local"
   - (Opcional) Cambiar el puerto si el 8080 está ocupado
3. **Copiar la URL mostrada** (ej: `http://192.168.1.100:8080`)
4. **Acceder desde otro dispositivo**:
   - Abrir navegador
   - Navegar a la URL proporcionada
   - Usar la aplicación normalmente

### Ejemplo de URL

```
http://192.168.1.100:8080
│       │            │
│       │            └─ Puerto configurado
│       └─ IP local de la máquina
└─ Protocolo HTTP
```

---

## 🐛 Resolución de Problemas

### El servidor no inicia

**Síntoma**: Mensaje de error al activar el toggle

**Posibles causas**:
- Puerto ocupado por otra aplicación
- Permisos insuficientes (puerto < 1024 en algunos sistemas)

**Solución**:
- Cambiar a otro puerto (ej: 8081, 3000, 5000)
- Usar puertos > 1024 para evitar problemas de permisos

### No puedo acceder desde otro dispositivo

**Síntoma**: La URL no carga en otros dispositivos

**Posibles causas**:
- Firewall bloqueando conexiones
- Dispositivos en redes diferentes
- IP incorrecta mostrada

**Solución**:
1. Verificar que ambos dispositivos están en la misma red WiFi
2. Verificar configuración de firewall en Windows
3. Probar acceder desde el mismo dispositivo primero (localhost)

### Supabase no funciona desde dispositivo remoto

**Síntoma**: La aplicación carga pero las llamadas a Supabase fallan

**Posibles causas**:
- Problemas de conectividad a internet en el dispositivo remoto
- Variables de entorno no configuradas correctamente

**Solución**:
- Verificar conectividad a internet en el dispositivo remoto
- Verificar que las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están configuradas

---

## 🔄 Flujo de Datos con Supabase

```
┌─────────────────┐
│  Dispositivo    │
│    Remoto       │
└────────┬────────┘
         │ HTTP (App React)
         ▼
┌─────────────────┐
│ Servidor Local  │
│  (Express)      │ ── Solo sirve archivos estáticos
└─────────────────┘    NO intercepta llamadas a Supabase
         │
         │
         │ (No pasa por aquí)
         │
         ▼
┌─────────────────┐
│   Navegador     │ ── JavaScript ejecutado en el navegador
│  del Cliente    │
└────────┬────────┘
         │ HTTPS (Supabase API)
         ▼
┌─────────────────┐
│   Supabase      │
│     Cloud       │
└─────────────────┘
```

**Punto importante**: Las llamadas a Supabase se realizan directamente desde el navegador del dispositivo remoto, NO pasan por el servidor local. Esto garantiza:
- ✅ Seguridad: Credenciales nunca pasan por el servidor local
- ✅ Performance: Conexión directa a Supabase
- ✅ Funcionalidad completa: Todas las features de Supabase funcionan

---

## 🛠️ Desarrollo y Mantenimiento

### Agregar Nuevas Funcionalidades

Para agregar nuevas funcionalidades al servidor local:

1. **Modificar `electron/localServer.js`** si es funcionalidad del servidor
2. **Agregar handlers IPC en `electron/main.js`** para nuevas APIs
3. **Exponer en `electron/preload.js`** si necesita acceso desde React
4. **Crear/actualizar servicio en `src/services/localServer.js`**
5. **Actualizar UI si es necesario**

### Testing

#### Manual
1. Compilar la aplicación: `npm run build`
2. Ejecutar Electron: `npm run electron:dev`
3. Activar servidor local en login
4. Acceder desde otro dispositivo o navegador

#### Automatizado
- Considerar agregar tests para:
  - Inicio/detención del servidor
  - Detección de IP local
  - Manejo de errores
  - IPC communication

---

## 📊 Rendimiento

### Recursos Utilizados

- **Memoria**: Express + archivos estáticos en memoria (~50-100MB)
- **CPU**: Mínimo (solo al servir archivos)
- **Red**: Ancho de banda según uso de la aplicación

### Optimizaciones

- **Caching**: Express sirve archivos estáticos con headers de cache apropiados
- **Compresión**: Considerar agregar compresión gzip para archivos grandes
- **Límite de conexiones**: Express maneja múltiples conexiones concurrentes eficientemente

---

## 🔮 Mejoras Futuras

### Posibles Mejoras

1. **Autenticación HTTP**: Agregar autenticación básica HTTP opcional
2. **HTTPS Local**: Configurar certificado SSL para conexión segura
3. **Discovery**: Detección automática de dispositivos en la red
4. **Puerto automático**: Buscar puerto disponible automáticamente
5. **Historial de conexiones**: Guardar últimas configuraciones
6. **QR Code**: Mostrar código QR con la URL para fácil acceso desde móviles

---

## 📚 Referencias

- [Express.js Documentation](https://expressjs.com/)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

---

## 📝 Changelog

### Versión 1.1.0 (Actual)
- ✅ Implementación inicial del servidor local
- ✅ Interfaz en pantalla de login
- ✅ Configuración de puerto
- ✅ Detección automática de IP local
- ✅ Manejo de errores
- ✅ Compatibilidad con Supabase

---

**Última actualización**: 2024

