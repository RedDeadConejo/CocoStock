# Control de Versiones

Este documento explica cómo funciona el sistema de control de versiones de CocoStock y cómo gestionarlo.

## Descripción

El sistema de control de versiones permite bloquear el acceso a versiones obsoletas de la aplicación, forzando a los usuarios a actualizar antes de poder iniciar sesión.

## Configuración Inicial

### 1. Ejecutar el Script SQL

Ejecuta el script SQL en tu base de datos Supabase:

```sql
-- Ver el archivo: docs/VERSION_CONTROL_SETUP.sql
```

Este script crea:
- La tabla `app_version` para almacenar la versión mínima requerida
- Las políticas RLS necesarias
- Un registro inicial con la versión 1.0.0

### 2. Actualizar la Versión de la Aplicación

La versión de la aplicación se define en **dos lugares** que deben mantenerse sincronizados:

1. **`package.json`** (campo `version`): Usado por Electron Builder para el instalador
2. **`src/constants/version.js`** (constante `APP_VERSION`): Usado por el sistema de control de versiones

#### Sincronización Automática

Para mantener ambas versiones sincronizadas, usa el script incluido:

```bash
# Sincronizar desde package.json a version.js
npm run sync-version

# Actualizar ambas versiones a una nueva versión
npm run version 1.1.0
```

#### Actualización Manual

Si prefieres actualizar manualmente:

1. **Actualizar `package.json`**:
```json
{
  "version": "1.1.0"
}
```

2. **Actualizar `src/constants/version.js`**:
```javascript
export const APP_VERSION = '1.1.0';
```

**Importante**: Las versiones deben coincidir. Si no coinciden, el instalador mostrará una versión diferente a la que verifica el sistema de control de versiones.

## Cómo Funciona

1. **Al iniciar sesión**: La aplicación verifica automáticamente la versión mínima requerida desde Supabase
2. **Comparación**: Se compara la versión actual (`APP_VERSION`) con la versión mínima requerida
3. **Bloqueo**: Si la versión actual es menor que la mínima requerida, se bloquea el acceso y se muestra un mensaje al usuario

## Gestionar Versiones Mínimas Requeridas

### Ver la Versión Actual Configurada

```sql
SELECT * FROM app_version 
WHERE is_active = true 
ORDER BY created_at DESC 
LIMIT 1;
```

### Actualizar la Versión Mínima Requerida

Cuando necesites forzar una actualización:

1. **Desactivar la versión anterior**:
```sql
UPDATE app_version 
SET is_active = false 
WHERE is_active = true;
```

2. **Insertar nueva versión mínima**:
```sql
INSERT INTO app_version (minimum_version, message, is_active)
VALUES (
  '1.1.0',  -- Nueva versión mínima requerida
  'Se requiere actualizar a la versión 1.1.0 o superior para continuar usando la aplicación',
  true
);
```

### Ejemplo: Forzar Actualización a Versión 1.2.0

```sql
-- 1. Desactivar versión anterior
UPDATE app_version SET is_active = false WHERE is_active = true;

-- 2. Configurar nueva versión mínima
INSERT INTO app_version (minimum_version, message, is_active)
VALUES (
  '1.2.0',
  'Esta versión incluye mejoras de seguridad y nuevas funcionalidades. Por favor, actualiza la aplicación.',
  true
);
```

## Estructura de la Tabla

```sql
CREATE TABLE app_version (
  id UUID PRIMARY KEY,
  minimum_version TEXT NOT NULL,  -- Versión mínima requerida (ej: "1.0.0")
  message TEXT,                    -- Mensaje opcional para mostrar al usuario
  is_active BOOLEAN DEFAULT true, -- Solo una versión debe estar activa
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Formato de Versión

El sistema usa **versionado semántico** (SemVer):
- Formato: `MAJOR.MINOR.PATCH` (ej: `1.0.0`, `1.1.0`, `2.0.0`)
- Comparación: `1.0.0` < `1.0.1` < `1.1.0` < `2.0.0`

## Comportamiento en Caso de Error

Si hay un error al verificar la versión (por ejemplo, la tabla no existe o hay problemas de conexión), el sistema **permitirá el acceso** para no bloquear usuarios legítimos. Los errores se registran en la consola.

## Desactivar el Control de Versiones

Para desactivar temporalmente el control de versiones:

```sql
UPDATE app_version 
SET is_active = false 
WHERE is_active = true;
```

O simplemente eliminar todos los registros activos:

```sql
DELETE FROM app_version WHERE is_active = true;
```

## Notas Importantes

1. **Siempre actualiza `APP_VERSION`** en `src/constants/version.js` cuando lances una nueva versión
2. **Solo una versión debe estar activa** a la vez (`is_active = true`)
3. **Prueba antes de activar**: Verifica que la nueva versión funcione correctamente antes de forzar la actualización
4. **Mensajes claros**: Usa mensajes descriptivos en el campo `message` para informar a los usuarios sobre las actualizaciones

## Flujo de Usuario

1. Usuario abre la aplicación
2. La aplicación verifica la versión automáticamente
3. Si la versión es obsoleta:
   - Se muestra un mensaje indicando que debe actualizar
   - El botón de login se deshabilita
   - El usuario no puede iniciar sesión hasta actualizar
4. Si la versión es válida:
   - El usuario puede iniciar sesión normalmente

