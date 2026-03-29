-- ============================================
-- CocoStock - Sesiones de dispositivo (escritorio)
-- ============================================
-- El cliente Electron envía una huella estable del PC (hash); el servidor
-- registra last_refresh_at y solo considera válida la sesión si ha habido
-- renovación en los últimos 2 días. Así el "paso" lo decide Supabase.
--
-- Nota: las peticiones REST con JWT robado seguirían pasando RLS hasta que
-- el token caduque; esta capa obliga a la app de escritorio a alinearse con
-- el servidor para mantener la sesión en la UI. Para bloquear todo el API
-- por dispositivo haría falta un hook de JWT personalizado o claims extra.

CREATE TABLE IF NOT EXISTS cocostock_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fingerprint_hash text NOT NULL,
  last_refresh_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_cocostock_device_sessions_user_refresh
  ON cocostock_device_sessions (user_id, last_refresh_at DESC);

ALTER TABLE cocostock_device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cocostock_device_sessions_select_own" ON cocostock_device_sessions;
CREATE POLICY "cocostock_device_sessions_select_own"
  ON cocostock_device_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cocostock_device_sessions_insert_own" ON cocostock_device_sessions;
CREATE POLICY "cocostock_device_sessions_insert_own"
  ON cocostock_device_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cocostock_device_sessions_update_own" ON cocostock_device_sessions;
CREATE POLICY "cocostock_device_sessions_update_own"
  ON cocostock_device_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cocostock_device_sessions_delete_own" ON cocostock_device_sessions;
CREATE POLICY "cocostock_device_sessions_delete_own"
  ON cocostock_device_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE cocostock_device_sessions IS 'Registro de dispositivos de escritorio CocoStock; validación en RPC validate_device_session';

-- Registra o renueva el “latido” del dispositivo (máx. validez 2 días sin llamar).
CREATE OR REPLACE FUNCTION register_or_refresh_device_session(p_fingerprint_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_fingerprint_hash IS NULL OR length(trim(p_fingerprint_hash)) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_fingerprint');
  END IF;

  INSERT INTO cocostock_device_sessions (user_id, fingerprint_hash, last_refresh_at)
  VALUES (auth.uid(), trim(p_fingerprint_hash), now())
  ON CONFLICT (user_id, fingerprint_hash)
  DO UPDATE SET last_refresh_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Comprueba si este usuario + huella tienen sesión de dispositivo activa (< 2 días).
CREATE OR REPLACE FUNCTION validate_device_session(p_fingerprint_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_authenticated');
  END IF;
  IF p_fingerprint_hash IS NULL OR length(trim(p_fingerprint_hash)) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'bad_fingerprint');
  END IF;

  IF EXISTS (
    SELECT 1 FROM cocostock_device_sessions
    WHERE user_id = v_uid
      AND fingerprint_hash = trim(p_fingerprint_hash)
      AND last_refresh_at > (now() - interval '2 days')
  ) THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM cocostock_device_sessions
    WHERE user_id = v_uid
      AND fingerprint_hash = trim(p_fingerprint_hash)
  ) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object('valid', false, 'reason', 'not_registered');
END;
$$;

GRANT EXECUTE ON FUNCTION register_or_refresh_device_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_device_session(text) TO authenticated;

-- Obligatorio para que las funciones (SECURITY INVOKER) puedan escribir la tabla.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cocostock_device_sessions TO authenticated;
