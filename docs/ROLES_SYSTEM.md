# Sistema de Cargos - CocoStock

## 📋 Resumen

Sistema de cargos basado en funciones específicas que controla el acceso a diferentes secciones y funcionalidades de la aplicación según el cargo asignado al usuario en la base de datos.

---

## 🎯 Cargos Disponibles

### 1. Admin 👑
- **Cargo**: `admin`
- **Descripción**: Acceso completo a todas las funciones del sistema
- **Permisos**:
  - ✅ Ver Dashboard
  - ✅ Ver y editar Inventario
  - ✅ Gestionar Stock
  - ✅ Gestionar Proveedores
  - ✅ Ver y editar Estadísticas
  - ✅ Gestionar Usuarios
  - ✅ Gestionar Configuración
  - ✅ Acceso a todas las secciones

### 2. Almacén 📦
- **Cargo**: `almacen`
- **Descripción**: Gestión completa de stock e inventario
- **Permisos**:
  - ✅ Ver Dashboard
  - ✅ Ver y editar Inventario
  - ✅ Gestionar Stock (agregar, restar, establecer)
  - ✅ Ver Estadísticas
  - ❌ No puede gestionar proveedores
  - ❌ No puede gestionar usuarios

### 3. Tienda 🏪
- **Cargo**: `tienda` (Rol por defecto)
- **Descripción**: Visualización de productos y estadísticas para tienda
- **Permisos**:
  - ✅ Ver Dashboard
  - ✅ Ver Inventario (solo lectura)
  - ✅ Ver Estadísticas
  - ❌ No puede editar productos
  - ❌ No puede gestionar stock
  - ❌ No puede gestionar proveedores

---

## 🏗️ Arquitectura

### Tablas de Base de Datos

#### `user_roles`
Almacena los cargos disponibles en el sistema.

```sql
- id (SERIAL PRIMARY KEY)
- role_name (VARCHAR(50) UNIQUE) - 'admin', 'almacen', 'tienda'
- description (TEXT)
- permissions (JSONB) - Permisos específicos del cargo
```

#### `user_profiles`
Almacena el perfil y cargo de cada usuario.

```sql
- id (UUID PRIMARY KEY) -> Referencia a auth.users
- role_name (VARCHAR(50)) -> Referencia a user_roles
- full_name (TEXT)
- phone (TEXT)
```

### Componentes Principales

#### 1. `src/services/roles.js`
Servicio para gestionar cargos y permisos:
- `getUserProfile(userId)` - Obtiene el perfil completo del usuario
- `getUserRole(userId)` - Obtiene el cargo del usuario
- `hasRole(userId, roleName)` - Verifica si tiene un cargo específico
- `hasPermission(userId, permission)` - Verifica un permiso específico

#### 2. `src/hooks/useRole.js`
Hook React para obtener y usar cargos:
```javascript
const { roleName, isAdmin, isAlmacen, isTienda, hasPermission } = useRole(userId);
```

#### 3. `src/components/RoleGuard/RoleGuard.jsx`
Componente para proteger secciones:
```javascript
<RoleGuard allowedRoles={[ROLES.ADMIN]} userId={userId}>
  <ComponenteProtegido />
</RoleGuard>
```

---

## 📝 Configuración Inicial

### Paso 1: Ejecutar el Script SQL

Ejecuta el script `docs/ROLES_SETUP.sql` en tu base de datos de Supabase:

1. Ve a tu proyecto en Supabase
2. Abre el SQL Editor
3. Copia y ejecuta el contenido de `docs/ROLES_SETUP.sql`

Este script creará:
- ✅ Tabla `user_roles` con los cargos predefinidos
- ✅ Tabla `user_profiles` para vincular usuarios con cargos
- ✅ Políticas RLS (Row Level Security)
- ✅ Función para crear perfiles automáticamente
- ✅ Función para verificar permisos

### Paso 2: Asignar Cargos a Usuarios

Los nuevos usuarios se crean automáticamente con el cargo **Tienda** (por defecto).

Para cambiar el cargo de un usuario:

```sql
UPDATE user_profiles 
SET role_name = 'admin'
WHERE id = 'user-uuid-aqui';
```

O desde la aplicación (requiere permisos de admin):
```javascript
import { updateUserRole } from './services/roles';
await updateUserRole(userId, 'almacen');
```

---

## 🔐 Acceso por Sección

| Sección | Admin | Almacén | Tienda |
|---------|-------|---------|--------|
| Dashboard | ✅ | ✅ | ✅ |
| Inventario | ✅ Ver/Editar | ✅ Ver/Editar | ✅ Solo Ver |
| Gestionar Stock | ✅ | ✅ | ❌ |
| Proveedores | ✅ | ❌ | ❌ |
| Estadísticas | ✅ Ver/Editar | ✅ Ver | ✅ Ver |
| Perfil | ✅ | ✅ | ✅ |

---

## 💻 Uso en el Código

### Proteger una Sección Completa

```javascript
import RoleGuard, { ROLES } from '../RoleGuard/RoleGuard';

// Solo Admin
<RoleGuard allowedRoles={[ROLES.ADMIN]} userId={userId}>
  <Suppliers />
</RoleGuard>

// Admin y Almacén
<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.ALMACEN]} userId={userId}>
  <StockManager />
</RoleGuard>
```

### Verificar en Componente

```javascript
import { useRole } from '../hooks/useRole';

function MyComponent({ userId }) {
  const { isAdmin, isAlmacen, hasPermission } = useRole(userId);

  if (!isAdmin && !isAlmacen) {
    return <div>No tienes acceso</div>;
  }

  return <div>Contenido protegido</div>;
}
```

### Ocultar Elementos según Cargo

```javascript
const { isAdmin, isAlmacen } = useRole(userId);

{isAdmin && (
  <button onClick={handleManageUsers}>
    Gestionar Usuarios
  </button>
)}

{(isAdmin || isAlmacen) && (
  <button onClick={handleManageStock}>
    Gestionar Stock
  </button>
)}
```

### Verificar Permisos Específicos

```javascript
import { PermissionGuard } from '../RoleGuard/RoleGuard';

<PermissionGuard permission="manage_stock" userId={userId}>
  <StockManager />
</PermissionGuard>
```

---

## 🔧 Personalización

### Agregar un Nuevo Cargo

1. **En la base de datos:**
```sql
INSERT INTO user_roles (role_name, description, permissions)
VALUES ('vendedor', 'Vendedor - Gestión de ventas', '{
  "view_dashboard": true,
  "view_inventory": true
}');
```

2. **En el código:**
```javascript
// src/services/roles.js
export const ROLES = {
  // ... cargos existentes
  VENDEDOR: 'vendedor',
};
```

### Modificar Permisos de un Cargo

```sql
UPDATE user_roles 
SET permissions = permissions || '{"new_permission": true}'::jsonb
WHERE role_name = 'almacen';
```

---

## 📊 Flujo de Verificación

```
Usuario intenta acceder a una sección
         │
         ▼
Layout verifica allowedRoles
         │
         ▼
useRole hook obtiene cargo del usuario
         │
         ▼
roles.js consulta user_profiles + user_roles
         │
         ▼
Retorna role_name del usuario
         │
         ▼
Compara con allowedRoles
         │
         ├─► role_name en allowedRoles → Acceso permitido
         └─► role_name NO en allowedRoles → Acceso denegado
```

---

## 🐛 Resolución de Problemas

### El usuario no ve ciertas secciones

**Verificar:**
1. ¿El perfil existe en `user_profiles`?
2. ¿El `role_name` es correcto? ('admin', 'almacen', 'tienda')
3. ¿Las políticas RLS permiten lectura?

**Solución:**
```sql
-- Ver perfil del usuario
SELECT up.*, ur.description
FROM user_profiles up
LEFT JOIN user_roles ur ON up.role_name = ur.role_name
WHERE up.id = 'user-uuid';

-- Crear perfil si no existe
INSERT INTO user_profiles (id, role_name)
VALUES ('user-uuid', 'tienda')
ON CONFLICT (id) DO NOTHING;

-- Cambiar cargo
UPDATE user_profiles 
SET role_name = 'almacen'
WHERE id = 'user-uuid';
```

---

## 📚 Referencias

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth)

---

**Última actualización**: 2024
