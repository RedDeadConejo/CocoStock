-- ============================================
-- CocoStock — Merma: unidades enteras + Realtime
-- ============================================
-- 1) Normaliza quantity a entero (trunc) y exige mínimo 1 en INSERT/UPDATE.
-- 2) RPC create_merma_with_token alineada con unidades enteras.
-- 3) REPLICA IDENTITY + publicación supabase_realtime para postgres_changes
--    (la app se suscribe en Merma.jsx; conviene tener Realtime activo en el proyecto).
--
-- Ejecutar en Supabase SQL Editor (una vez por proyecto). Si ADD TABLE falla porque
-- la tabla ya está publicada, puedes ignorar ese paso.

-- ---------- Trigger: solo unidades enteras ----------
CREATE OR REPLACE FUNCTION public.merma_normalize_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.quantity := trunc(COALESCE(NEW.quantity, 0));
  IF NEW.quantity < 1 THEN
    RAISE EXCEPTION 'La cantidad de merma debe ser un entero mayor o igual a 1 (unidades)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merma_normalize_quantity_trigger ON public.merma;
CREATE TRIGGER merma_normalize_quantity_trigger
  BEFORE INSERT OR UPDATE OF quantity ON public.merma
  FOR EACH ROW
  EXECUTE FUNCTION public.merma_normalize_quantity();

-- ---------- RPC: token servidor local ----------
CREATE OR REPLACE FUNCTION create_merma_with_token(
  p_token UUID,
  p_restaurant_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_motivo TEXT DEFAULT NULL,
  p_fecha TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_id UUID;
  v_qty NUMERIC;
BEGIN
  SELECT user_id INTO v_user_id
  FROM merma_server_tokens
  WHERE token = p_token AND restaurant_id = p_restaurant_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Token no válido o no coincide con el restaurante';
  END IF;

  v_qty := trunc(COALESCE(p_quantity, 0));
  IF v_qty < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser un entero mayor o igual a 1 (unidades)';
  END IF;

  INSERT INTO merma (restaurant_id, product_id, quantity, motivo, fecha, created_by)
  VALUES (
    p_restaurant_id,
    p_product_id,
    v_qty,
    NULLIF(trim(p_motivo), ''),
    COALESCE(p_fecha, now()),
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_merma_with_token(UUID, UUID, UUID, NUMERIC, TEXT, TIMESTAMPTZ) TO anon, authenticated;

-- ---------- Realtime: filas visibles según RLS ----------
ALTER TABLE public.merma REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'merma'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.merma;
  END IF;
END $$;
