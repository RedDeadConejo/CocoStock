# Guía del Sistema de Cargos - CocoStock

## 📖 Introducción

Este documento explica cómo funciona el sistema de cargos en CocoStock. El sistema está diseñado para controlar el acceso a diferentes secciones y funcionalidades según el cargo del usuario.

---

## 🎯 Conceptos Básicos

### ¿Qué es un Cargo?

Un **cargo** es una función específica que tiene un usuario en el sistema. Cada cargo tiene permisos asociados que determinan qué puede hacer.

### Diferencias con un Sistema de Niveles

A diferencia de un sistema jerárquico de niveles (1, 2, 3...), este sistema está basado en **funciones/cargos específicos**:

- ❌ **NO es**: Viewer < Operator < Manager < Admin (jerárquico)
- ✅ **ES**: Admin, Almacén, Tienda (funciones específicas)

---

## 👥 Cargos Disponibles

### 1. 👑 Admin (Administrador)

**Cargo en BD**: `admin`

**¿Qué puede hacer?**
- ✅ **TODO** - Acceso completo al sistema
- ✅ Ver y editar inventario
- ✅ Gestionar stock
- ✅ Gestionar proveedores
- ✅ Ver y editar estadísticas
- ✅ Gestionar usuarios y sus cargos
- ✅ Gestionar configuración del sistema

**Cuándo usar**: Para usuarios que necesitan control total del sistema.

---

### 2. 📦 Almacén

**Cargo en BD**: `almacen`

**¿Qué puede hacer?**
- ✅ Ver dashboard
- ✅ Ver y **editar** productos
- ✅ **Gestionar stock** (agregar, restar, establecer)
- ✅ Ver estadísticas
- ❌ **NO** puede gestionar proveedores
- ❌ **NO** puede gestionar usuarios
- ❌ **NO** puede eliminar productos

**Cuándo usar**: Para personal de almacén que necesita gestionar el inventario y stock.

---

### 3. 🏪 Tienda

**Cargo en BD**: `tienda` (cargo por defecto)

**¿Qué puede hacer?**
- ✅ Ver dashboard
- ✅ **Solo ver** productos en inventario (sin editar)
- ✅ Ver estadísticas
- ❌ **NO** puede editar productos
- ❌ **NO** puede gestionar stock
- ❌ **NO** puede crear productos
- ❌ **NO** puede eliminar productos
- ❌ **NO** puede gestionar proveedores

**Cuándo usar**: Para personal de tienda que solo necesita consultar información.

---

## 🔐 Tabla de Permisos por Sección

| Sección | Acción | Admin | Almacén | Tienda |
|---------|--------|-------|---------|--------|
| **Dashboard** | Ver | ✅ | ✅ | ✅ |
| **Inventario** | Ver | ✅ | ✅ | ✅ |
| **Inventario** | Crear/Editar | ✅ | ✅ | ❌ |
| **Inventario** | Eliminar | ✅ | ❌ | ❌ |
| **Stock** | Gestionar | ✅ | ✅ | ❌ |
| **Proveedores** | Ver/Gestionar | ✅ | ❌ | ❌ |
| **Estadísticas** | Ver | ✅ | ✅ | ✅ |
| **Estadísticas** | Editar | ✅ | ❌ | ❌ |
| **Usuarios** | Gestionar | ✅ | ❌ | ❌ |
| **Perfil** | Ver/Editar propio | ✅ | ✅ | ✅ |

---

## 🏗️ Cómo Funciona

### 1. Base de Datos

#### Tabla `user_roles`
Almacena los cargos disponibles y sus permisos:

```sql
user_roles
├── role_name (admin, almacen, tienda)
├── description
└── permissions (JSONB)
    ├── view_dashboard: true/false
    ├── edit_inventory: true/false
    ├── manage_stock: true/false
    └── ...
```

#### Tabla `user_profiles`
Vincula cada usuario con su cargo:

```sql
user_profiles
├── id (UUID) → auth.users
└── role_name → user_roles.role_name
```

### 2. Verificación en el Frontend

```
Usuario accede a una sección
         │
         ▼
Componente verifica cargo del usuario
         │
         ├─► useRole hook
         │       │
         │       ▼
         │   roles.js consulta BD
         │       │
         │       ▼
         │   Retorna cargo: 'admin', 'almacen', 'tienda'
         │
         ▼
Compara con cargos permitidos
         │
         ├─► Coincide → Muestra contenido
         └─► No coincide → Oculta o muestra mensaje de error
```

---

## 🚀 Configuración Inicial

### Paso 1: Ejecutar Script SQL

1. Abre tu proyecto en **Supabase**
2. Ve a **SQL Editor**
3. Copia y pega el contenido de `docs/ROLES_SETUP.sql`
4. Ejecuta el script

Este script creará:
- ✅ Tabla `user_roles` con los 3 cargos
- ✅ Tabla `user_profiles` para vincular usuarios
- ✅ Políticas de seguridad (RLS)
- ✅ Función para crear perfiles automáticamente

### Paso 2: Asignar Cargos a Usuarios

Los nuevos usuarios se crean automáticamente con cargo **"tienda"**.

Para cambiar el cargo de un usuario:

**Opción 1: Desde SQL**
```sql
-- Ver usuarios y sus cargos
SELECT 
  up.id,
  au.email,
  up.role_name
FROM user_profiles up
JOIN auth.users au ON up.id = au.id;

-- Cambiar cargo a "almacen"
UPDATE user_profiles 
SET role_name = 'almacen'
WHERE id = 'uuid-del-usuario';

-- Cambiar cargo a "admin"
UPDATE user_profiles 
SET role_name = 'admin'
WHERE id = 'uuid-del-usuario';
```

**Opción 2: Desde la aplicación (si implementas UI de admin)**
```javascript
import { updateUserRole } from './services/roles';
await updateUserRole(userId, 'almacen');
```

---

## 💻 Uso en el Código

### Ejemplo 1: Proteger una Sección Completa

```javascript
import RoleGuard, { ROLES } from '../RoleGuard/RoleGuard';

// Solo Admin puede ver Proveedores
<RoleGuard allowedRoles={[ROLES.ADMIN]} userId={userId}>
  <Suppliers />
</RoleGuard>

// Admin y Almacén pueden gestionar stock
<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.ALMACEN]} userId={userId}>
  <StockManager />
</RoleGuard>
```

### Ejemplo 2: Ocultar/Mostrar Botones

```javascript
import { useRole } from '../hooks/useRole';

function Inventory({ userId }) {
  const { isAdmin, isAlmacen, isTienda } = useRole(userId);
  
  return (
    <div>
      {/* Botón solo para Admin y Almacén */}
      {(isAdmin || isAlmacen) && (
        <button onClick={handleManageStock}>
          Gestionar Stock
        </button>
      )}
      
      {/* Botón solo para Admin */}
      {isAdmin && (
        <button onClick={handleManageUsers}>
          Gestionar Usuarios
        </button>
      )}
      
      {/* Botón para todos */}
      <button onClick={handleView}>
        Ver Productos
      </button>
    </div>
  );
}
```

### Ejemplo 3: Verificar Permisos Específicos

```javascript
import { useRole } from '../hooks/useRole';

function ProductCard({ product, userId }) {
  const { hasPermission } = useRole(userId);
  const canEdit = hasPermission('edit_inventory');
  const canDelete = hasPermission('manage_settings'); // Solo admin
  
  return (
    <div>
      <h3>{product.nombre}</h3>
      
      {canEdit && (
        <button onClick={() => handleEdit(product)}>
          Editar
        </button>
      )}
      
      {canDelete && (
        <button onClick={() => handleDelete(product.id)}>
          Eliminar
        </button>
      )}
    </div>
  );
}
```

---

## 🔧 Personalización

### Agregar un Nuevo Cargo

#### 1. En la Base de Datos

```sql
INSERT INTO user_roles (role_name, description, permissions)
VALUES (
  'supervisor',
  'Supervisor - Gestión limitada',
  '{
    "view_dashboard": true,
    "view_inventory": true,
    "edit_inventory": true,
    "view_statistics": true
  }'::jsonb
);
```

#### 2. En el Código JavaScript

```javascript
// src/services/roles.js
export const ROLES = {
  ADMIN: 'admin',
  ALMACEN: 'almacen',
  TIENDA: 'tienda',
  SUPERVISOR: 'supervisor', // ← Nuevo cargo
};
```

#### 3. En los Componentes

```javascript
// Permitir acceso a Supervisor
<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]} userId={userId}>
  <Componente />
</RoleGuard>
```

### Modificar Permisos de un Cargo Existente

```sql
-- Agregar permiso a Almacén para ver proveedores
UPDATE user_roles
SET permissions = permissions || '{"view_suppliers": true}'::jsonb
WHERE role_name = 'almacen';
```

---

## 📊 Ejemplos Prácticos

### Escenario 1: Usuario de Tienda

**Cargo**: `tienda`

**Lo que verá**:
- ✅ Dashboard
- ✅ Lista de productos (solo lectura)
- ✅ Estadísticas (solo ver)
- ✅ Su perfil

**Lo que NO verá**:
- ❌ Botón "Gestionar Stock"
- ❌ Botón "Nuevo Producto"
- ❌ Botones "Editar" y "Eliminar" en productos
- ❌ Sección "Proveedores"

### Escenario 2: Usuario de Almacén

**Cargo**: `almacen`

**Lo que verá**:
- ✅ Dashboard
- ✅ Lista de productos (con edición)
- ✅ Botón "Gestionar Stock"
- ✅ Botón "Nuevo Producto"
- ✅ Botones "Editar" en productos
- ✅ Estadísticas (solo ver)

**Lo que NO verá**:
- ❌ Botón "Eliminar" en productos
- ❌ Sección "Proveedores"
- ❌ Gestión de usuarios

### Escenario 3: Administrador

**Cargo**: `admin`

**Lo que verá**:
- ✅ **TODO** - Todas las secciones y funcionalidades
- ✅ Dashboard
- ✅ Inventario completo
- ✅ Gestionar Stock
- ✅ Proveedores
- ✅ Estadísticas
- ✅ Gestión de usuarios (si implementas la UI)

---

## 🐛 Resolución de Problemas

### Problema: El usuario no ve ciertas secciones

**Diagnóstico:**
```sql
-- Verificar el cargo del usuario
SELECT 
  au.email,
  up.role_name,
  ur.description,
  ur.permissions
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
LEFT JOIN user_roles ur ON up.role_name = ur.role_name
WHERE au.email = 'usuario@ejemplo.com';
```

**Solución:**
```sql
-- Cambiar el cargo si es necesario
UPDATE user_profiles
SET role_name = 'almacen'
WHERE id = (SELECT id FROM auth.users WHERE email = 'usuario@ejemplo.com');
```

### Problema: El usuario no tiene perfil

**Diagnóstico:**
```sql
-- Ver si existe el perfil
SELECT * FROM user_profiles WHERE id = 'user-uuid';
```

**Solución:**
```sql
-- Crear perfil manualmente
INSERT INTO user_profiles (id, role_name)
VALUES ('user-uuid', 'tienda')
ON CONFLICT (id) DO NOTHING;
```

### Problema: Error "No se puede leer propiedad 'role_name'"

**Causa**: El hook `useRole` está retornando `null` antes de cargar.

**Solución**: El hook maneja esto automáticamente con valores por defecto. Si persiste, verifica que:
1. El usuario esté autenticado
2. El perfil exista en la base de datos
3. Las políticas RLS permitan lectura

---

## 🔒 Seguridad

### Frontend (Interfaz)
- ✅ Los botones y secciones se ocultan según el cargo
- ✅ Las rutas se protegen con `RoleGuard`
- ✅ El menú se filtra automáticamente

### Backend (Base de Datos)
- ✅ **RLS (Row Level Security)** protege los datos
- ✅ Solo el usuario puede ver su propio perfil
- ✅ Solo administradores pueden cambiar cargos
- ✅ Las funciones SQL verifican permisos

**⚠️ IMPORTANTE**: La protección en el frontend es solo visual. Siempre valida permisos en el backend también.

---

## 📝 Preguntas Frecuentes

### ¿Puedo tener múltiples cargos?

No, cada usuario tiene un solo cargo. Si necesitas combinar permisos, crea un nuevo cargo con los permisos combinados.

### ¿Qué pasa si cambio el cargo de un usuario?

El cambio se refleja inmediatamente. El usuario deberá recargar la página o el sistema detectará el cambio automáticamente.

### ¿Cómo veo qué cargo tiene un usuario?

```sql
SELECT au.email, up.role_name
FROM user_profiles up
JOIN auth.users au ON up.id = au.id;
```

### ¿Puedo crear cargos personalizados?

Sí, puedes agregar nuevos cargos en la base de datos y en el código siguiendo la guía de "Personalización" más arriba.

### ¿El sistema funciona con usuarios existentes?

Sí, pero necesitas crear sus perfiles manualmente si no los tienen:

```sql
-- Crear perfiles para usuarios existentes sin perfil
INSERT INTO user_profiles (id, role_name)
SELECT id, 'tienda'
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles);
```

---

## 📚 Referencias Rápidas

### Cargos Disponibles
```javascript
ROLES.ADMIN    // 'admin'
ROLES.ALMACEN  // 'almacen'
ROLES.TIENDA   // 'tienda'
```

### Helpers del Hook useRole
```javascript
const { 
  roleName,      // 'admin', 'almacen', 'tienda'
  isAdmin,       // true/false
  isAlmacen,     // true/false
  isTienda,      // true/false
  hasPermission, // función para verificar permisos
  canAccess      // función para verificar acceso
} = useRole(userId);
```

### Uso del RoleGuard
```javascript
<RoleGuard 
  allowedRoles={[ROLES.ADMIN, ROLES.ALMACEN]} 
  userId={userId}
  fallback={<div>Sin acceso</div>}
>
  <ContenidoProtegido />
</RoleGuard>
```

---

## 🎓 Ejemplos Completos

### Ejemplo Completo: Página de Inventario Protegida

```javascript
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../services/roles';
import RoleGuard from '../../components/RoleGuard/RoleGuard';

function Inventory({ userId }) {
  const { isAdmin, isAlmacen, isTienda } = useRole(userId);
  const canEdit = isAdmin || isAlmacen;
  
  return (
    <div>
      {/* Botones según cargo */}
      {canEdit && (
        <button onClick={handleCreate}>
          Nuevo Producto
        </button>
      )}
      
      {(isAdmin || isAlmacen) && (
        <button onClick={handleManageStock}>
          Gestionar Stock
        </button>
      )}
      
      {/* Lista de productos */}
      {products.map(product => (
        <div key={product.id}>
          <h3>{product.nombre}</h3>
          
          {/* Botones solo si puede editar */}
          {canEdit && (
            <button onClick={() => handleEdit(product)}>
              Editar
            </button>
          )}
          
          {/* Eliminar solo admin */}
          {isAdmin && (
            <button onClick={() => handleDelete(product.id)}>
              Eliminar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

**Última actualización**: 2024

Para más detalles técnicos, consulta `docs/ROLES_SYSTEM.md`

