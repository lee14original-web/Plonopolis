-- ═══════════════════════════════════════════════════════════════════════════
-- FUNKCJA TESTOWA: test_add_barn_items
-- Uruchomić JEDNORAZOWO w Supabase SQL Editor (Panel testowy → produkty zwierząt).
-- Działa jako SECURITY DEFINER (postgres) — omija trigger protect_inventory_columns
-- i blokadę DECREASE-ONLY w sync_barn_items.
-- WYŁĄCZNIE do użytku deweloperskiego. NIE dodawać do produkcji.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION test_add_barn_items(p_user_id UUID, p_amount INT DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_keys TEXT[] := ARRAY[
    'jajko', 'futro_krolika', 'mleko', 'piora', 'welna',
    'nawoz_naturalny', 'mleko_kozie', 'duze_piora',
    'energia_robocza', 'rogi_byka'
  ];
  v_key  TEXT;
  v_old  JSONB;
  v_new  JSONB;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF p_amount  IS NULL OR p_amount < 1 THEN RAISE EXCEPTION 'p_amount must be >= 1'; END IF;

  SELECT COALESCE(barn_items, '{}'::JSONB) INTO v_old
    FROM profiles WHERE id = p_user_id;

  v_new := v_old;
  FOREACH v_key IN ARRAY v_keys LOOP
    v_new := jsonb_set(
      v_new,
      ARRAY[v_key],
      to_jsonb(COALESCE((v_old ->> v_key)::INT, 0) + p_amount)
    );
  END LOOP;

  UPDATE profiles SET barn_items = v_new WHERE id = p_user_id;
  RETURN v_new;
END $$;

GRANT EXECUTE ON FUNCTION test_add_barn_items(UUID, INT) TO authenticated;
