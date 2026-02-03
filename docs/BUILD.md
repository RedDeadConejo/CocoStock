# Guía de Compilación - CocoStock

Esta guía explica cómo compilar la aplicación CocoStock para Windows (.exe) y Android (.apk).

## 📋 Requisitos Previos

### Para Windows:
- Node.js instalado (versión 18 o superior)
- npm instalado

### Para Android:
- Node.js instalado (versión 18 o superior)
- npm instalado
- Android Studio instalado
- Java JDK instalado
- Variables de entorno de Android configuradas

---

## 🪟 Compilación para Windows (.exe)

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Construir la aplicación web
```bash
npm run build
```

Este comando genera los archivos optimizados en la carpeta `dist/`.

### Paso 3: Actualizar la versión (opcional)
Si necesitas actualizar la versión antes de compilar:

```bash
# Actualizar a una nueva versión (actualiza ambos archivos)
npm run version 1.1.0

# O sincronizar manualmente desde package.json
npm run sync-version
```

**Nota**: Los scripts de compilación (`electron:build` y `electron:build:win`) sincronizan automáticamente las versiones antes de compilar.

### Paso 4: Compilar el ejecutable
```bash
npm run electron:build:win
```

### Resultado
El instalador se generará en la carpeta `release/` con el nombre:
- `CocoStock Setup x.x.x.exe` (instalador)
- `CocoStock x.x.x.exe` (ejecutable portable)

**Nota importante**: La versión mostrada en el instalador proviene del campo `version` en `package.json`. Si ves `0.0.0`, actualiza la versión en `package.json`.

### Notas:
- El instalador creará accesos directos en el escritorio y menú de inicio
- El usuario podrá elegir el directorio de instalación
- El ejecutable será completamente independiente y no requerirá Node.js en el sistema destino

---

## 🤖 Compilación para Android (.apk)

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Construir la aplicación web
```bash
npm run build
```

### Paso 3: Agregar la plataforma Android (solo la primera vez)
```bash
npx cap add android
```

Este comando crea la carpeta `android/` con el proyecto nativo de Android.

### Paso 4: Sincronizar con Capacitor
```bash
npx cap sync
```

Este comando copia los archivos de `dist/` a la carpeta `android/` y actualiza las dependencias.

### Paso 5: Abrir en Android Studio
```bash
npx cap open android
```

Esto abrirá el proyecto en Android Studio.

### Paso 6: Compilar el APK en Android Studio

1. En Android Studio, espera a que termine la sincronización de Gradle
2. Ve a **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Espera a que termine la compilación
4. Cuando termine, haz clic en **locate** en la notificación para ver el APK generado

### Ubicación del APK
El APK se generará en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Para generar un APK de producción (firmado):

1. En Android Studio, ve a **Build** → **Generate Signed Bundle / APK**
2. Selecciona **APK**
3. Crea o selecciona un keystore
4. Completa el formulario y genera el APK firmado

### Notas:
- El APK de debug se puede instalar directamente en dispositivos Android
- Para publicar en Google Play Store, necesitas generar un APK firmado (release)
- Cada vez que hagas cambios en el código React, ejecuta `npm run build` y luego `npx cap sync`

---

## 🔄 Actualizar la aplicación después de cambios

### Para Windows:
1. Realiza tus cambios en el código
2. Ejecuta `npm run build`
3. Ejecuta `npm run electron:build:win`

### Para Android:
1. Realiza tus cambios en el código
2. Ejecuta `npm run build`
3. Ejecuta `npx cap sync`
4. Abre Android Studio con `npx cap open android`
5. Compila nuevamente el APK

---

## 🐛 Solución de Problemas

### Windows:

#### El instalador no se genera (solo aparece win-unpacked):
Si después de ejecutar `npm run electron:build:win` solo ves la carpeta `win-unpacked` pero no el instalador `.exe`, verifica:

1. **Error de permisos con esbuild**: 
   - Cierra todos los procesos de Node.js y terminales
   - Ejecuta el terminal como administrador
   - O desactiva temporalmente el antivirus que podría estar bloqueando esbuild

2. **El build de Vite falla**:
   - Asegúrate de que la carpeta `dist/` se genera correctamente con `npm run build`
   - Si hay errores, corrígelos antes de ejecutar electron-builder

3. **Verificar que electron-builder se ejecuta**:
   - Si el build de Vite falla, electron-builder nunca se ejecutará
   - Ejecuta manualmente: `npm run build` primero, luego `electron-builder --win`

4. **Problemas con el icono**:
   - El icono debe existir en `public/logo.png`
   - **IMPORTANTE**: NSIS (el instalador) requiere formato `.ico`, no `.png`
   - Si ves el error "invalid icon file", el problema es que estás usando un PNG
   - **Solución**: Convierte `logo.png` a `logo.ico` o remueve las referencias al icono en la configuración NSIS
   - Para convertir PNG a ICO puedes usar herramientas online como:
     - https://convertio.co/png-ico/
     - https://www.icoconverter.com/
   - Luego actualiza `package.json` para usar `public/logo.ico` en lugar de `public/logo.png`

#### Otros problemas:
- **Error al compilar**: Asegúrate de tener todas las dependencias instaladas con `npm install`
- **El ejecutable no se genera**: Verifica que la carpeta `dist/` existe y contiene archivos
- **Error "spawn EPERM"**: Cierra procesos de Node.js, ejecuta como administrador o desactiva temporalmente el antivirus

### Android:
- **Error "SDK not found"**: Configura el Android SDK en Android Studio
- **Error de Gradle**: Asegúrate de tener una conexión a internet para descargar dependencias
- **El APK no se instala**: Verifica que tienes habilitada la opción "Instalar desde fuentes desconocidas" en tu dispositivo Android

---

## 📝 Scripts Disponibles

- `npm run dev` - Ejecutar en modo desarrollo (web)
- `npm run build` - Construir la aplicación web
- `npm run preview` - Previsualizar la build en el navegador
- `npm run electron:dev` - Probar la app en Electron sin compilar
- `npm run electron:build:win` - Compilar ejecutable para Windows
- `npx cap sync` - Sincronizar cambios con las plataformas nativas
- `npx cap open android` - Abrir proyecto Android en Android Studio

---

## 🔐 Variables de Entorno

Asegúrate de tener configurado el archivo `.env` en la raíz del proyecto con:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

Estas variables son necesarias para que la aplicación funcione correctamente.

---

## 📦 Estructura de Carpetas

```
CocoStock/
├── dist/              # Build de la aplicación web
├── release/           # Ejecutables compilados (Windows)
├── android/           # Proyecto nativo de Android
├── electron/          # Archivos de Electron
├── src/               # Código fuente de la aplicación
└── docs/              # Documentación
```

---

**Última actualización**: 2024

