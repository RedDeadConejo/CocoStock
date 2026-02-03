# Gestión de Roles y Configuración

Este documento explica cómo usar el nuevo panel de configuración para gestionar roles, usuarios y permisos.

## 📋 Características

El panel de configuración permite a los administradores:

1. **Gestionar Roles**: Crear, editar y eliminar roles del sistema
2. **Gestionar Usuarios**: Cambiar el rol de los usuarios
3. **Configurar Permisos**: Asignar permisos específicos a cada rol

## 🚀 Configuración Inicial

### 1. Actualizar Políticas RLS en Supabase

Antes de usar el panel de configuración, ejecuta el script SQL en Supabase:

```sql
-- Ejecuta el archivo: docs/ROLE_MANAGEMENT_SETUP.sql
```

Este script actualiza las políticas de Row Level Security (RLS) para permitir que los administradores gestionen roles y usuarios.

### 2. Verificar Permisos

Asegúrate de que:
- ✅ RLS está habilitado en `user_roles` y `user_profiles`
- ✅ Las políticas están correctamente configuradas
- ✅ Tienes un usuario con rol `admin`

## 📖 Uso del Panel de Configuración

### Acceder al Panel

1. Inicia sesión con una cuenta de administrador
2. En el menú lateral, haz clic en "⚙️ Configuración"
3. Solo los administradores pueden ver esta opción

### Gestión de Roles

#### Crear un Nuevo Rol

1. Ve a la pestaña "Roles"
2. Haz clic en "+ Nuevo Rol"
3. Completa el formulario:
   - **Nombre del Rol**: Nombre único (ej: "gerente", "supervisor")
   - **Descripción**: Descripción opcional del rol
   - **Permisos**: Selecciona los permisos que tendrá este rol
4. Haz clic en "Crear"

#### Editar un Rol

1. En la lista de roles, haz clic en el botón "✏️" del rol que deseas editar
2. Modifica la descripción y/o permisos
3. Haz clic en "Actualizar"

**Nota**: No se puede cambiar el nombre de un rol existente. Si necesitas cambiar el nombre, crea un nuevo rol y asigna los usuarios.

#### Eliminar un Rol

1. En la lista de roles, haz clic en el botón "🗑️" del rol que deseas eliminar
2. Confirma la eliminación

**Restricciones**:
- No se puede eliminar el rol `admin`
- No se puede eliminar un rol que tiene usuarios asignados

### Gestión de Usuarios

#### Cambiar el Rol de un Usuario

1. Ve a la pestaña "Usuarios"
2. En la columna "Nuevo Rol", selecciona el rol deseado para cada usuario
3. Haz clic en "Guardar Cambios" para aplicar todos los cambios

**Nota**: Los cambios se aplican en lote, por lo que puedes cambiar varios usuarios a la vez.

## 🔐 Permisos Disponibles

El sistema incluye los siguientes permisos:

- **view_dashboard**: Ver Dashboard
- **view_inventory**: Ver Inventario
- **edit_inventory**: Editar Inventario
- **manage_stock**: Gestionar Stock
- **manage_suppliers**: Gestionar Proveedores
- **view_statistics**: Ver Estadísticas
- **edit_statistics**: Editar Estadísticas
- **manage_users**: Gestionar Usuarios
- **manage_settings**: Gestionar Configuración
- **manage_roles**: Gestionar Roles

## ⚠️ Consideraciones Importantes

1. **Rol Admin**: El rol `admin` no puede ser eliminado y siempre tiene todos los permisos
2. **Usuarios sin Rol**: Si un usuario no tiene un rol asignado, se le asigna automáticamente el rol `tienda` por defecto
3. **Cambios en Tiempo Real**: Los cambios en roles y permisos pueden requerir que los usuarios cierren sesión y vuelvan a iniciar sesión para que surtan efecto
4. **Backup**: Antes de hacer cambios importantes, considera hacer un backup de la base de datos

## 🐛 Solución de Problemas

### No puedo ver el panel de configuración

- Verifica que tu usuario tenga el rol `admin`
- Asegúrate de que las políticas RLS estén correctamente configuradas
- Revisa la consola del navegador para errores

### No puedo crear/editar roles

- Verifica que tengas el rol `admin`
- Revisa que las políticas RLS para `user_roles` estén configuradas
- Verifica que el nombre del rol no esté duplicado

### No puedo cambiar roles de usuarios

- Verifica que tengas el rol `admin`
- Revisa que las políticas RLS para `user_profiles` estén configuradas
- Asegúrate de que el rol al que quieres cambiar exista en la base de datos

## 📝 Estructura de la Base de Datos

### Tabla: user_roles

```sql
- id: SERIAL PRIMARY KEY
- role_name: VARCHAR(50) UNIQUE NOT NULL
- description: TEXT
- permissions: JSONB DEFAULT '{}'
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Tabla: user_profiles

```sql
- id: UUID PRIMARY KEY (referencia a auth.users)
- role_name: VARCHAR(50) (referencia a user_roles.role_name)
- full_name: TEXT
- phone: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 🔄 Actualización del Icono de Electron

El icono de la aplicación Electron ahora usa el logo de la aplicación (`public/logo.png`).

Para generar un archivo `.ico` para Windows (opcional):

1. Usa una herramienta como [ICO Convert](https://icoconvert.com/) o [CloudConvert](https://cloudconvert.com/png-to-ico)
2. Sube `public/logo.png`
3. Genera el archivo `.ico`
4. Guárdalo como `build/icon.ico`
5. Actualiza `package.json` para usar `build/icon.ico` en lugar de `public/logo.png`
