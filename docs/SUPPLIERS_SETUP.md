# Configuración de Base de Datos - Proveedores (Suppliers)

Este documento explica cómo configurar la tabla de proveedores en Supabase.

## 📋 Tabla: suppliers

### Estructura de la Tabla

Crea una tabla llamada `suppliers` en Supabase con los siguientes campos:

| Campo | Tipo | Descripción | Restricciones |
|-------|------|-------------|---------------|
| `id` | uuid | Identificador único | PRIMARY KEY, DEFAULT gen_random_uuid() |
| `nombre` | text | Nombre del proveedor | NOT NULL |
| `contacto` | text | Nombre de contacto | |
| `telefono` | text | Teléfono del proveedor | |
| `email` | text | Email del proveedor | |
| `direccion` | text | Dirección del proveedor | |
| `notas` | text | Notas adicionales | |
| `eliminado` | boolean | Indica si está eliminado (soft delete) | DEFAULT false |
| `created_at` | timestamp | Fecha de creación | DEFAULT now() |
| `updated_at` | timestamp | Fecha de actualización | DEFAULT now() |

### SQL para Crear la Tabla

**IMPORTANTE:** Ejecuta el archivo `SUPPLIERS_SETUP.sql` en el editor SQL de Supabase, o copia y pega el siguiente código:

```sql
-- Crear la tabla suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  eliminado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_suppliers_eliminado ON suppliers(eliminado);
CREATE INDEX IF NOT EXISTS idx_suppliers_nombre ON suppliers(nombre);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Políticas de Seguridad (RLS)

Configura las políticas de Row Level Security (RLS) en Supabase:

1. **Habilitar RLS:**
```sql
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
```

2. **Política para SELECT (lectura):**
```sql
CREATE POLICY "Users can view suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (eliminado = false);
```

3. **Política para INSERT (crear):**
```sql
CREATE POLICY "Users can create suppliers"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (true);
```

4. **Política para UPDATE (actualizar y soft delete):**
```sql
CREATE POLICY "Users can update suppliers"
ON suppliers FOR UPDATE
TO authenticated
USING (eliminado = false)
WITH CHECK (true);  -- Permite cualquier cambio, incluyendo eliminado = true
```

5. **Función para soft delete (opcional):**
```sql
CREATE OR REPLACE FUNCTION soft_delete_supplier(supplier_id UUID)
RETURNS suppliers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result suppliers;
BEGIN
  UPDATE suppliers
  SET eliminado = true
  WHERE id = supplier_id AND eliminado = false
  RETURNING * INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_supplier(UUID) TO authenticated;
```

### Notas Importantes

- El campo `eliminado` DEBE ser **BOOLEAN** (no string) para que funcionen las políticas RLS
- El campo `eliminado` se usa para soft delete (no se eliminan físicamente)
- Solo el campo `nombre` es requerido, todos los demás son opcionales
- La tabla incluye timestamps automáticos para `created_at` y `updated_at`

### Verificación

Después de crear la tabla, verifica que:

1. ✅ La tabla `suppliers` existe en Supabase
2. ✅ RLS está habilitado
3. ✅ Las políticas están configuradas correctamente
4. ✅ Puedes insertar un registro de prueba desde la aplicación

