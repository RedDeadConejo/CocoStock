# Estructura del Proyecto CocoStock

Este documento describe la organización y estructura del proyecto.

## 📁 Estructura de Carpetas

```
src/
├── components/          # Componentes reutilizables
│   ├── Auth/           # Componente de autenticación
│   │   ├── Auth.jsx
│   │   └── Auth.css
│   └── Layout/         # Layout principal con sidebar
│       ├── Layout.jsx
│       ├── Layout.css
│       └── Sidebar.jsx
│
├── pages/               # Páginas/Vistas de la aplicación
│   ├── Dashboard/      # Página principal
│   │   ├── Dashboard.jsx
│   │   └── Dashboard.css
│   └── Account/        # Página de perfil
│       ├── Account.jsx
│       └── Account.css
│
├── hooks/               # Hooks personalizados de React
│   └── useAuth.js      # Hook para manejar autenticación
│
├── services/            # Servicios externos (APIs, BD, etc.)
│   └── supabase.js     # Cliente de Supabase
│
├── constants/           # Constantes y configuraciones
│   └── colors.js       # Paleta de colores de la aplicación
│
├── styles/              # Estilos globales
│   └── index.css        # Estilos base de la aplicación
│
├── App.jsx              # Componente raíz de la aplicación
└── main.jsx             # Punto de entrada
```

## 🎯 Descripción de Carpetas

### `/components`
Componentes reutilizables que pueden ser utilizados en múltiples partes de la aplicación.

- **Auth/**: Formulario de inicio de sesión
- **Layout/**: Contenedor principal con sidebar y área de contenido

### `/pages`
Páginas o vistas principales de la aplicación. Cada página tiene su propia carpeta con su componente y estilos.

- **Dashboard/**: Vista principal con tarjetas de información
- **Account/**: Vista de perfil de usuario

### `/hooks`
Hooks personalizados de React para lógica reutilizable.

- **useAuth.js**: Maneja el estado de autenticación y sesión

### `/services`
Servicios que interactúan con APIs externas o bases de datos.

- **supabase.js**: Configuración y cliente de Supabase

### `/constants`
Constantes y configuraciones globales.

- **colors.js**: Paleta de colores (negro y rojo)

### `/styles`
Estilos globales de la aplicación.

- **index.css**: Estilos base y reset

## 🔄 Flujo de la Aplicación

1. **main.jsx** → Punto de entrada, renderiza `App`
2. **App.jsx** → Usa `useAuth` para verificar sesión
   - Si no hay sesión → Muestra `Auth`
   - Si hay sesión → Muestra `Layout`
3. **Layout** → Contiene `Sidebar` y renderiza páginas según navegación
   - Dashboard (por defecto)
   - Account

## 📝 Convenciones de Código

- **Componentes**: PascalCase (ej: `Auth.jsx`, `Dashboard.jsx`)
- **Hooks**: camelCase con prefijo `use` (ej: `useAuth.js`)
- **Servicios**: camelCase (ej: `supabase.js`)
- **Constantes**: camelCase (ej: `colors.js`)
- **Estilos**: kebab-case (ej: `Auth.css`)

## 🎨 Paleta de Colores

La aplicación usa una paleta basada en **negro** y **rojo** como colores primarios. Los colores están definidos en `/constants/colors.js`.

## 🔐 Autenticación

La autenticación se maneja mediante:
- **Hook**: `useAuth` - Gestiona el estado de sesión
- **Servicio**: `supabase` - Cliente de Supabase para autenticación
- **Componente**: `Auth` - Formulario de inicio de sesión

## 📦 Dependencias Principales

- React 19.2.0
- Supabase (@supabase/supabase-js)
- Vite (build tool)

