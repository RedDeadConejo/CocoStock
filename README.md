# CocoStock

**Gestión de inventario y stock para restaurantes**

Aplicación de escritorio para el control de inventario, pedidos, compras y mermas en restaurantes. Multi-restaurante, con roles y permisos configurables, y servidor local para registro de mermas desde tabletas en cocina.

---

## Características

- **Inventario** — Control de productos, proveedores, unidades y stock
- **Pedidos** — Gestión de pedidos entre departamentos
- **Compras** — Registro de compras y recepción de mercancía
- **Merma** — Registro de pérdidas y desperdicio con modo servidor local
- **Platos** — Recetas, ingredientes y escandallo
- **Estadísticas** — Gráficos y métricas del negocio
- **Multi-restaurante** — Varios establecimientos con usuarios asignados
- **Roles y permisos** — Sistema flexible (admin, roles personalizados)
- **Actualizaciones** — Descarga de nuevas versiones desde la app

---

## Tecnologías

- **Frontend:** React 19, Vite 7
- **Desktop:** Electron
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **UI:** CSS con variables, diseño responsive

---

## Requisitos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com)
- npm o pnpm

---

## Instalación

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/tu-usuario/cocostock.git
cd cocostock
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env.local` y sustituye los marcadores por tus valores (Supabase: **Project Settings → API**).

```bash
cp .env.example .env.local
# Windows (PowerShell): Copy-Item .env.example .env.local
```

**Repositorio público:** no subas `.env`, `.env.local`, claves `service_role`, certificados ni tokens personales. La `anon key` va en el cliente pero es por proyecto; si hubo filtración, rota claves en Supabase. El workflow de GitHub Actions debe usar **secrets** del repo (`VITE_SUPABASE_*`), nunca valores embebidos en el código.

### 3. Configurar Supabase

Ejecuta los scripts SQL del directorio `deploy/supabase-production/` en el orden indicado por el prefijo numérico. Consulta `deploy/supabase-production/PASOS_PRODUCCION.md` para la guía completa.

Despliega las Edge Functions para gestión de usuarios:

```bash
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

---

## Desarrollo

```bash
# Modo web (solo frontend)
npm run dev

# Modo Electron (app de escritorio)
npm run electron:dev
```

---

## Build

```bash
# Windows (Windows 10+, Electron y Chromium recientes — línea principal)
npm run electron:build:win

# Windows 7 / 8.1 (artefacto aparte: Electron 22, renderer para Chromium 108)
npm run electron:build:win7

# macOS
npm run electron:build:mac

# Todas las plataformas
npm run electron:build
```

Los instaladores **principales** van a `release/`. El paquete **Windows 7** se genera en `release-win7/` (instalador `CocoStock-{versión}-Win7-Setup.exe`). En Win7 hace falta sistema actualizado (p. ej. TLS 1.2) para HTTPS contra Supabase.

La rama principal y `npm run electron:build:win` siguen usando las versiones actuales de **Electron** y **Vite** del `package.json`; el target Win7 no las modifica.

### Build de macOS desde GitHub Actions

El repositorio incluye un workflow para compilar en macOS sin máquina Mac. Genera **ambas arquitecturas** (Intel y Apple Silicon):

- `CocoStock-{version}-x64.dmg` / `.zip` → platform: **darwin-x64** en app_releases
- `CocoStock-{version}-arm64.dmg` / `.zip` → platform: **darwin-arm64** en app_releases

Configura en el repo los secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Tras descargar los artifacts, sube los archivos al bucket `app-releases` y registra cada uno en la tabla `app_releases` con su `platform` correspondiente.

**Interfaz de administración:** Los admins pueden subir releases y cambiar la versión mínima desde Configuración. La sección está oculta: **5 clics** en el título «Configuración» (dentro de 3 segundos) para mostrarla.

---

## Estructura del proyecto

```
├── deploy/supabase-production/   # Scripts SQL para producción
├── docs/                         # Documentación adicional
├── electron/                     # Proceso principal Electron, preload, servidor local
├── public/                       # Assets estáticos
├── src/
│   ├── components/               # Componentes React
│   ├── pages/                    # Páginas principales
│   ├── services/                 # Lógica de negocio y Supabase
│   ├── hooks/                    # Hooks personalizados
│   └── utils/                    # Utilidades
├── supabase/
│   ├── config.toml               # Configuración de Edge Functions
│   └── functions/                # create-user, delete-user
├── vite.config.js
├── vite.config.legacy-win7.mjs   # Solo para electron:build:win7
└── electron-builder.win7.json    # Empaqueta con Electron 22
```

---

## Documentación

- `deploy/supabase-production/PASOS_PRODUCCION.md` — Despliegue en Supabase
- `docs/BUILD.md` — Guía de compilación
- `docs/LOCAL_SERVER.md` — Servidor local y modo merma
- `docs/ROLES_SYSTEM.md` — Sistema de roles y permisos

---

## Licencia

[MIT](LICENSE) — RedDeadConejo
