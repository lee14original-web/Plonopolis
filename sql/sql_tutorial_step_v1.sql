-- ═══════════════════════════════════════════════════════════════════════
-- KROK 1: Dodaj kolumnę tutorial_step (idempotentne)
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_step integer NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════
-- KROK 2: Zaktualizuj game_start_tutorial() — ustawia tutorial_step=1
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.game_start_tutorial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid    := auth.uid();
  v_profile profiles%rowtype;
  v_inv     jsonb;
  v_current integer;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- Idempotencja
  IF COALESCE(v_profile.tutorial_started,   false) = TRUE
  OR COALESCE(v_profile.tutorial_completed, false) = TRUE
  OR COALESCE(v_profile.tutorial_skipped,   false) = TRUE
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  -- Dodaj x3 guide_compost
  v_inv     := COALESCE(v_profile.seed_inventory, '{}'::jsonb);
  v_current := COALESCE((v_inv->>'guide_compost')::integer, 0);
  v_inv     := jsonb_set(v_inv, '{guide_compost}', to_jsonb(v_current + 3));

  UPDATE profiles
  SET
    tutorial_started   = TRUE,
    tutorial_completed = FALSE,
    tutorial_skipped   = FALSE,
    tutorial_step      = 1,
    seed_inventory     = v_inv
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'guide_compost_granted', 3);
END;
$$;

GRANT EXECUTE ON FUNCTION public.game_start_tutorial() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- WERYFIKACJA po wgraniu:
-- SELECT public.game_start_tutorial();
-- → { ok: true, guide_compost_granted: 3 } + tutorial_step=1
-- Ponowne: → { ok: false, error: "already_started" }
-- ═══════════════════════════════════════════════════════════════════════
