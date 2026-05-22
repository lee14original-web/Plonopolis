-- ═══════════════════════════════════════════════════════════════════════
-- RPC: game_start_tutorial
-- Atomicznie ustawia tutorial_started=true i przyznaje x3 guide_compost.
-- Idempotentne: jeśli tutorial był już started/completed/skipped
-- → zwraca { ok: false, error: "already_started" } i NIE dodaje kompostu.
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
  -- Zablokuj wiersz gracza (FOR UPDATE chroni przed równoległymi wywołaniami)
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- Idempotencja: jeśli tutorial był już w jakimkolwiek stanie — odmów
  IF COALESCE(v_profile.tutorial_started,   false) = TRUE
  OR COALESCE(v_profile.tutorial_completed, false) = TRUE
  OR COALESCE(v_profile.tutorial_skipped,   false) = TRUE
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  -- Dodaj x3 guide_compost do seed_inventory
  v_inv     := COALESCE(v_profile.seed_inventory, '{}'::jsonb);
  v_current := COALESCE((v_inv->>'guide_compost')::integer, 0);
  v_inv     := jsonb_set(v_inv, '{guide_compost}', to_jsonb(v_current + 3));

  -- Zaktualizuj profil atomicznie
  UPDATE profiles
  SET
    tutorial_started   = TRUE,
    tutorial_completed = FALSE,
    tutorial_skipped   = FALSE,
    seed_inventory     = v_inv
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'guide_compost_granted', 3);
END;
$$;

-- Uprawnienia dla zalogowanych graczy
GRANT EXECUTE ON FUNCTION public.game_start_tutorial() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- MARKET GUARD: zablokuj sprzedaż guide_compost w market_create_offer
-- ═══════════════════════════════════════════════════════════════════════
-- Wstaw poniższy blok NA POCZĄTKU funkcji market_create_offer,
-- zaraz po sprawdzeniu p_item_type (po linii "IF p_item_type NOT IN (...)"):
--
--   IF p_item_key = 'guide_compost' THEN
--     RETURN jsonb_build_object('error', 'Ten przedmiot nie może być wystawiony na sprzedaż.');
--   END IF;
--
-- Docelowo: przebuduj całą funkcję market_create_offer przez CREATE OR REPLACE
-- z tym guardem wewnątrz — patrz market_setup.sql linia ~224.
-- ═══════════════════════════════════════════════════════════════════════
