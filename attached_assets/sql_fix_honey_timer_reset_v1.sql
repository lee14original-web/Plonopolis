-- =====================================================
-- FIX: honey_start nie resetuje się do NOW po pełnym zbiorze
-- 
-- Problem: gdy zegar klienta wyprzedza serwer (~13 min),
-- frontend pokazuje 8/8 a serwer liczy 7. Po zbiorze 7 słoików
-- honey_start przesuwa się o +7h — zostaje 13 min "reszty",
-- przez co timer startuje od 46:37 zamiast od 01:00:00.
--
-- Fix: gdy v_remaining_raw = 0 (zużyto wszystkie dostępne
-- godziny miodu), zawsze resetuj honey_start = NOW() niezależnie
-- od tego czy byliśmy na capie czy nie.
-- =====================================================

CREATE OR REPLACE FUNCTION collect_honey(
  p_user_id          uuid,
  p_honey_bonus_pct  numeric DEFAULT 0,
  p_suit_save_pct    numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hive            jsonb;
  v_level           int;
  v_honey_start     bigint;
  v_suit            int;
  v_empty_jars      int;
  v_honey_jars      int;
  v_bees_progress   int;
  v_now_ms          bigint;
  v_elapsed_ms      bigint;
  v_honey_avail     int;
  v_honey_avail_raw int;
  v_max_honey       int;
  v_ms_per_pt       bigint := 3600000;
  v_collected       int;
  v_collected_raw   numeric;
  v_collected_raw_ms bigint;
  v_remaining_raw   int;
  v_suit_loss       int;
  v_success         boolean;
  v_max_arr         int[]   := ARRAY[0, 8, 10, 12, 14, 16];
  v_chance_arr      float[] := ARRAY[0, 0.90, 0.80, 0.70, 0.60, 0.50];
  v_new_hive        jsonb;
  v_honey_mult      numeric;
  v_suit_save       numeric;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_honey_mult := 1 + GREATEST(0, LEAST(200, COALESCE(p_honey_bonus_pct, 0))) / 100.0;
  v_suit_save  := GREATEST(0, LEAST(95,  COALESCE(p_suit_save_pct,   0))) / 100.0;

  SELECT hive_data INTO v_hive
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hive IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_hive');
  END IF;

  v_level         := COALESCE((v_hive->>'level')::int, 1);
  v_level         := GREATEST(1, LEAST(5, v_level));
  v_honey_start   := (v_hive->>'honey_start')::bigint;
  v_suit          := COALESCE((v_hive->>'suit_durability')::int, 0);
  v_empty_jars    := COALESCE((v_hive->>'empty_jars')::int, 0);
  v_honey_jars    := COALESCE((v_hive->>'honey_jars')::int, 0);
  v_bees_progress := COALESCE((v_hive->>'bees_progress')::int, 0);

  v_now_ms     := EXTRACT(EPOCH FROM NOW())::bigint * 1000;
  v_elapsed_ms := GREATEST(0, v_now_ms - COALESCE(v_honey_start, v_now_ms));
  v_max_honey  := v_max_arr[v_level];

  v_honey_avail_raw := LEAST((v_elapsed_ms / v_ms_per_pt)::int, v_max_honey);
  v_honey_avail     := FLOOR(v_honey_avail_raw * v_honey_mult)::int;

  IF v_honey_avail <= 0   THEN RETURN jsonb_build_object('ok', false, 'error', 'no_honey');  END IF;
  IF v_empty_jars <= 0    THEN RETURN jsonb_build_object('ok', false, 'error', 'no_jars');   END IF;
  IF v_suit <= 0          THEN RETURN jsonb_build_object('ok', false, 'error', 'no_suit');   END IF;

  v_collected := LEAST(v_honey_avail, v_empty_jars);
  v_success   := random() < v_chance_arr[v_level];

  v_suit_loss := GREATEST(
    CASE WHEN v_collected > 0 THEN 1 ELSE 0 END,
    ROUND(v_collected * (1 - v_suit_save))::int
  );

  v_collected_raw    := v_collected::numeric / v_honey_mult;
  v_collected_raw_ms := CEIL(v_collected_raw * v_ms_per_pt)::bigint;
  IF v_collected_raw_ms > v_honey_avail_raw::bigint * v_ms_per_pt THEN
    v_collected_raw_ms := v_honey_avail_raw::bigint * v_ms_per_pt;
  END IF;

  v_remaining_raw := v_honey_avail_raw - LEAST(v_honey_avail_raw, FLOOR(v_collected_raw)::int);

  -- FIX: gdy v_remaining_raw = 0 (wszystkie dostępne godziny miodu zużyte),
  -- zawsze reset do NOW() — eliminuje efekt "resztki" z różnicy zegarów
  -- klient/serwer (np. klient wyprzedza serwer o ~13 min).
  v_new_hive := jsonb_build_object(
    'level',           v_level,
    'bees_progress',   v_bees_progress,
    'honey_start',     CASE
                         WHEN v_remaining_raw = 0
                         THEN v_now_ms
                         WHEN v_honey_avail_raw >= v_max_honey
                         THEN v_now_ms - (v_remaining_raw::bigint * v_ms_per_pt)
                         ELSE COALESCE(v_honey_start, v_now_ms) + v_collected_raw_ms
                       END,
    'suit_durability', GREATEST(0, v_suit - v_suit_loss),
    'empty_jars',      v_empty_jars - v_collected,
    'honey_jars',      CASE WHEN v_success THEN v_honey_jars + v_collected ELSE v_honey_jars END
  );

  UPDATE profiles SET hive_data = v_new_hive WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'success',    v_success,
    'collected',  v_collected,
    'suit_loss',  v_suit_loss,
    'hive_data',  v_new_hive
  );
END;
$$;
