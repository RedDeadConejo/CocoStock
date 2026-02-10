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

Crea un archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

> Las credenciales se obtienen en Supabase: **Project Settings → API**.

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
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Todas las plataformas
npm run electron:build
```

Los instaladores se generan en `release/`.

### Build de macOS desde GitHub Actions

El repositorio incluye un workflow para compilar en macOS sin máquina Mac. Configura en el repo los secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

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
└── vite.config.js
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
