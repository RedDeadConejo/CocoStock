# Sesiones de dispositivo (escritorio) — estado actual y endurecimiento futuro

## Estado actual (implementado)

- **SQL:** `15_device_sessions.sql` — tabla `cocostock_device_sessions`, RLS y RPCs:
  - `register_or_refresh_device_session(p_fingerprint_hash)`
  - `validate_device_session(p_fingerprint_hash)`
- **App Electron:** registra la huella del PC, renueva `last_refresh_at` en el servidor y valida periódicamente. Si Supabase indica que la sesión de dispositivo no es válida (p. ej. más de 2 días sin renovar), la aplicación **cierra sesión** en el cliente y borra la fila correspondiente.

Esto asegura que **la propia app de escritorio** solo mantenga al usuario logueado si el **servidor** acepta ese dispositivo para ese usuario.

## Limitación importante

El **JWT de Supabase Auth** que usa PostgREST/RLS **no incluye** la huella del dispositivo ni el resultado de `validate_device_session`.

Por tanto, si alguien obtiene un **access token válido** (por fuga, malware, etc.), puede llamar a la **API REST de Supabase** (`.from()`, RPCs públicas según permisos) **sin pasar** por la lógica de dispositivo de la app, **hasta que el token caduque** o se revoque la sesión en Auth.

En otras palabras: el modelo actual es **“servidor autoriza el dispositivo para la experiencia en la app de escritorio”**, no **“ninguna petición al backend sin dispositivo aprobado”**.

## Direcciones posibles para el futuro

Orden aproximado de complejidad / impacto:

### 1. Custom Access Token Hook (Supabase Auth)

- Supabase permite hooks que **modifican o enriquecen** el JWT en el momento de emitirlo.
- **Idea:** incluir en el JWT un claim derivado del dispositivo (p. ej. id de sesión de dispositivo firmado o un hash acordado) **solo** tras comprobar en base de datos que `cocostock_device_sessions` está vigente para ese usuario.
- **RLS:** políticas que exijan `auth.jwt() ->> 'claim_name' = ...` o comparación con filas en tablas, según diseño.
- **Requisitos:** revisar documentación y plan de Supabase (disponibilidad del hook en tu proyecto), y diseñar rotación/revocación si el usuario cambia de PC.

### 2. Tokens de acceso muy cortos + refresco solo por canal controlado

- Reducir la vida del access token al mínimo razonable.
- Hacer que el **refresh** pase por un **Edge Function** (o RPC dedicada con `service_role` muy acotada) que valide dispositivo y solo entonces devuelva/renueve sesión.
- **Nota:** la integración con el flujo nativo de `refreshSession()` de `@supabase/supabase-js` puede forzar un diseño híbrido o custom; hay que valorar esfuerzo frente al riesgo residual.

### 3. Backend propio o Edge Function como única puerta (BFF)

- El cliente **no** usa la anon key contra PostgREST para datos sensibles; solo llama a tu API (Edge Function, etc.), que valida JWT + dispositivo (o sesión de servidor) y luego consulta Supabase con **service role** o políticas muy restrictas.
- **Coste:** reescribir o encapsular gran parte del acceso a datos.

### 4. Endurecimiento operativo (complementario, no sustituto)

- Políticas de contraseña, MFA en Supabase Auth, revisión de RLS en todas las tablas sensibles, auditoría de uso de `service_role`, rotación de claves, etc.

## Referencias en código

- Migración SQL: `15_device_sessions.sql`
- Cliente: `src/services/deviceSessionServer.js`, `src/services/deviceSession.js`, `src/hooks/useAuth.js`, `src/services/authSignOut.js`
- Huella del equipo (main process): `electron/machineFingerprint.cjs`

Cuando se aborde el endurecimiento, conviene actualizar este archivo con la opción elegida y enlaces a la documentación oficial de Supabase vigente en esa fecha.
