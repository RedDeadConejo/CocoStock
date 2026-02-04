# Sistema de actualizaciones con Supabase

CocoStock descarga actualizaciones desde **Supabase Storage** y consulta la última versión disponible en la tabla **app_releases**.

## Requisitos en Supabase

### 1. Tabla `app_releases`

Ejecuta el script en tu proyecto de producción:

- `deploy/supabase-production/00_app_releases.sql`

Campos relevantes:

| Campo         | Tipo    | Descripción |
|---------------|---------|-------------|
| version       | VARCHAR | Versión semántica (ej: 1.9.1) |
| platform      | VARCHAR | `win32`, `darwin` o `linux` |
| file_path     | TEXT    | Nombre del archivo en el bucket (ej: `CocoStock-Setup-1.9.1.exe`) |
| file_size     | BIGINT  | Tamaño en bytes (opcional) |
| release_notes | TEXT    | Notas de la versión (opcional) |
| is_active     | BOOLEAN | Si está disponible para descarga |

### 2. Bucket de Storage `app-releases`

1. En el Dashboard de Supabase: **Storage** → **New bucket**.
2. Nombre: **app-releases**.
3. Marca **Public bucket** para que la app pueda descargar sin autenticación.
4. Crea una carpeta o sube directamente los instaladores.

La URL pública de un archivo será:

```
https://<TU_PROJECT_REF>.supabase.co/storage/v1/object/public/app-releases/<file_path>
```

Ejemplo: si `file_path` es `CocoStock-Setup-1.9.1.exe` la URL se genera automáticamente (los caracteres especiales se codifican). **Recomendación:** usa nombres sin espacios en el bucket (ej. `CocoStock-Setup-1.9.1.exe`) para evitar errores.

### 3. Registrar una nueva release

Después de generar el instalador con `npm run electron:build:win`:

1. Sube el `.exe` al bucket **app-releases** (nombre sugerido: `CocoStock-Setup-1.9.1.exe`).
2. Inserta una fila en `app_releases`:

```sql
INSERT INTO app_releases (version, platform, file_path, file_size, release_notes, is_active)
VALUES (
  '1.9.1',
  'win32',
  'CocoStock-Setup-1.9.1.exe',
  123456789,
  'Correcciones y mejoras.',
  true
);
```

Ajusta `file_path` al nombre exacto del archivo en el bucket y `file_size` al tamaño en bytes (opcional).

## Uso en la app

- Solo en la **app de escritorio (Electron)** aparece la sección "Actualizaciones" en **Mi Perfil**.
- El usuario puede pulsar **Buscar actualizaciones**. Si hay una versión mayor en `app_releases` para su plataforma, se muestra la opción de descargar.
- La descarga se hace desde la URL pública del bucket; al finalizar se puede abrir el instalador (y opcionalmente cerrar la app para instalar).

## Solución de problemas

- **Error HTTP 400:** La URL del archivo se codifica automáticamente (espacios y caracteres especiales). Comprueba que el bucket **app-releases** esté en **Public** y que `file_path` en la base de datos coincida exactamente con el nombre del archivo en Storage (mejor sin espacios, ej. `CocoStock-Setup-1.9.1.exe`).
- **Error 404:** El archivo no existe en el bucket o el nombre en `app_releases.file_path` no coincide con el del Storage.

## Seguridad

- La tabla `app_releases` tiene RLS con lectura pública (SELECT) para que el login no sea necesario al comprobar actualizaciones.
- Las escrituras (INSERT/UPDATE/DELETE) deberías restringirlas en producción (por ejemplo solo desde el Dashboard o un rol de servicio).
