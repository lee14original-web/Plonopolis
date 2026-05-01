-- ═══════════════════════════════════════════════════════════════════════════
-- PAKIET 8: UL ODBLOKOWANY OD LVL 10 + PŁATNY (250 zł) + PSZCZOŁY 75 zł/szt
--
--   • Nowy startowy poziom ula = 0 (brak ula, brak grafiki).
--   • Funkcja buy_hive: lvl 0 → lvl 1 za 250 zł, wymaga player_level >= 10.
--   • add_hive_bees: pobiera 75 zł za każdą pszczołę.
--   • Timer (honey_start) startuje dopiero gdy bees_progress osiągnie >= 5.
--   • Ulepszanie ula (lvl 1→2 → 5) bez zmian w mechanice (20/30/40/50 pszczół).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Domyślna wartość hive_data — startowy poziom 0 (brak ula)
ALTER TABLE profiles ALTER COLUMN hive_data SET DEFAULT
  '{"level":0,"bees_progress":0,"honey_start":null,"suit_durability":0,"empty_jars":0,"honey_jars":0}'::jsonb;


-- 2. ZAKUP ULA (lvl 0 → 1)
CREATE OR REPLACE FUNCTION buy_hive(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hive       jsonb;
  v_level      int;
  v_money      numeric;
  v_player_lvl int;
  v_cost       numeric := 250;
  v_unlock_lvl int     := 10;
  v_new_hive   jsonb;
BEGIN
  SELECT hive_data, money, level
    INTO v_hive, v_money, v_player_lvl
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hive IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  v_level := COALESCE((v_hive->>'level')::int, 0);

  IF COALESCE(v_player_lvl, 1) < v_unlock_lvl THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Wymaga %s poziomu gracza (masz %s).', v_unlock_lvl, COALESCE(v_player_lvl,1)));
  END IF;

  IF v_level >= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ul jest już kupiony.');
  END IF;

  IF COALESCE(v_money, 0) < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Brak pieniędzy (potrzeba %s zł).', v_cost));
  END IF;

  v_new_hive := jsonb_build_object(
    'level',           1,
    'bees_progress',   0,
    'honey_start',     NULL,
    'suit_durability', COALESCE((v_hive->>'suit_durability')::int, 0),
    'empty_jars',      COALESCE((v_hive->>'empty_jars')::int, 0),
    'honey_jars',      COALESCE((v_hive->>'honey_jars')::int, 0)
  );

  UPDATE profiles
  SET money = v_money - v_cost,
      hive_data = v_new_hive
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'hive_data', v_new_hive, 'spent', v_cost);
END;
$$;


-- 3. DOKUPOWANIE PSZCZÓŁ — 75 zł/szt + start timera dopiero przy 5 pszczołach
CREATE OR REPLACE FUNCTION add_hive_bees(p_user_id uuid, p_amount int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hive            jsonb;
  v_level           int;
  v_bees            int;
  v_honey_start     bigint;
  v_suit            int;
  v_empty_jars      int;
  v_honey_jars      int;
  v_money           numeric;
  -- UWAGA: PostgreSQL ARRAY jest 1-indexed.
  -- v_needed_arr[1] = 20 (lvl 1→2), v_needed_arr[2] = 30 (lvl 2→3), itd.
  -- Frontend `HIVE_UPGRADE_BEES = [0, 20, 30, 40, 50]` jest 0-indexed,
  -- więc `HIVE_UPGRADE_BEES[1] = 20` — wartości muszą być spójne!
  v_needed_arr      int[]   := ARRAY[20, 30, 40, 50];     -- pszczoły do upgrade z lvl X→X+1
  v_needed          int;
  v_add             int;
  v_cost_per_bee    numeric := 75;
  v_total_cost      numeric;
  v_min_to_produce  int     := 5;
  v_new_bees        int;
  v_new_level       int;
  v_new_honey_start bigint;
  v_new_hive        jsonb;
BEGIN
  SELECT hive_data, money INTO v_hive, v_money
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hive IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_profile'); END IF;

  v_level       := COALESCE((v_hive->>'level')::int, 0);
  v_bees        := COALESCE((v_hive->>'bees_progress')::int, 0);
  v_honey_start := (v_hive->>'honey_start')::bigint;
  v_suit        := COALESCE((v_hive->>'suit_durability')::int, 0);
  v_empty_jars  := COALESCE((v_hive->>'empty_jars')::int, 0);
  v_honey_jars  := COALESCE((v_hive->>'honey_jars')::int, 0);

  IF v_level < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Najpierw kup ul (250 zł).');
  END IF;

  IF v_level >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ul ma już maksymalny poziom.');
  END IF;

  v_needed     := v_needed_arr[v_level];
  v_add        := LEAST(GREATEST(p_amount, 0), v_needed - v_bees);
  v_total_cost := v_add * v_cost_per_bee;

  IF v_add <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nie ma już potrzeby kupować pszczół na tym poziomie.');
  END IF;

  IF COALESCE(v_money, 0) < v_total_cost THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Brak pieniędzy (potrzeba %s zł na %s pszczół).', v_total_cost, v_add));
  END IF;

  v_new_bees  := v_bees + v_add;
  v_new_level := v_level;

  IF v_new_bees >= v_needed THEN
    v_new_level := v_level + 1;
    v_new_bees  := 0;
  END IF;

  -- Timer ula startuje dopiero gdy łącznie kupiono >= 5 pszczół.
  -- (v_bees + v_add to suma kupionych pszczół na tym poziomie ula PRZED auto-resetem
  --  po upgrade. Wystarcza, bo upgrade z lvl 1 wymaga 20 pszczół ≥ 5.)
  v_new_honey_start := v_honey_start;
  IF v_honey_start IS NULL AND (v_bees + v_add) >= v_min_to_produce THEN
    v_new_honey_start := EXTRACT(EPOCH FROM NOW())::bigint * 1000;
  END IF;

  v_new_hive := jsonb_build_object(
    'level',           v_new_level,
    'bees_progress',   v_new_bees,
    'honey_start',     v_new_honey_start,
    'suit_durability', v_suit,
    'empty_jars',      v_empty_jars,
    'honey_jars',      v_honey_jars
  );

  UPDATE profiles
  SET money = v_money - v_total_cost,
      hive_data = v_new_hive
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'hive_data', v_new_hive, 'spent', v_total_cost, 'bees_added', v_add);
END;
$$;


-- 4. RESET dla obecnych graczy: kto ma honey_start ustawiony bez 5 pszczół, wyzeruj go.
--    (chroni przed sytuacją, w której ktoś już ma honey_start z buggy poprzedniej wersji)
UPDATE profiles
SET hive_data = jsonb_set(hive_data, '{honey_start}', 'null'::jsonb)
WHERE COALESCE((hive_data->>'bees_progress')::int, 0) < 5
  AND hive_data->>'honey_start' IS NOT NULL
  AND hive_data->>'honey_start' <> 'null';


-- ─── RESET TWOJEGO KONTA ─────────────────────────────────────────────────────
--   żebyś mógł od razu testować ścieżkę: brak ula → kup za 250 zł → kup pszczoły
-- UWAGA: zachowuje słoiki, miód i strój — kasuje tylko poziom ula, pszczoły i timer.
-- Odkomentuj jeśli chcesz wyzerować swój ul:
--
-- UPDATE profiles
-- SET hive_data = jsonb_build_object(
--   'level',           0,
--   'bees_progress',   0,
--   'honey_start',     NULL,
--   'suit_durability', COALESCE((hive_data->>'suit_durability')::int, 0),
--   'empty_jars',      COALESCE((hive_data->>'empty_jars')::int, 0),
--   'honey_jars',      COALESCE((hive_data->>'honey_jars')::int, 0)
-- )
-- WHERE id = 'c68b84c6-335a-4832-af86-477bcb09fc16';
