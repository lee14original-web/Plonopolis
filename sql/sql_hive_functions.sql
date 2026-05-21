-- =====================================================
-- HIVE SERVER-SIDE FUNCTIONS — Plonopolis
-- Uruchom raz w Supabase SQL Editor
-- =====================================================

-- 1. ZBIERANIE MIODU (server-side: czas, losowość, walidacja)
CREATE OR REPLACE FUNCTION collect_honey(p_user_id uuid)
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
  v_max_honey       int;
  v_ms_per_pt       bigint := 3600000;
  v_collected       int;
  v_success         boolean;
  v_max_arr         int[]   := ARRAY[0, 8, 10, 12, 14, 16];
  v_chance_arr      float[] := ARRAY[0, 0.90, 0.80, 0.70, 0.60, 0.50];
  v_new_hive        jsonb;
BEGIN
  -- Blokada wiersza — zapobiega równoległym żądaniom
  SELECT hive_data INTO v_hive
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hive IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_hive');
  END IF;

  v_level         := COALESCE((v_hive->>'level')::int, 1);
  v_honey_start   := (v_hive->>'honey_start')::bigint;
  v_suit          := COALESCE((v_hive->>'suit_durability')::int, 0);
  v_empty_jars    := COALESCE((v_hive->>'empty_jars')::int, 0);
  v_honey_jars    := COALESCE((v_hive->>'honey_jars')::int, 0);
  v_bees_progress := COALESCE((v_hive->>'bees_progress')::int, 0);

  -- Czas liczony przez SERWER, nie klienta
  v_now_ms     := EXTRACT(EPOCH FROM NOW())::bigint * 1000;
  v_elapsed_ms := GREATEST(0, v_now_ms - COALESCE(v_honey_start, v_now_ms));
  v_max_honey  := v_max_arr[v_level];
  v_honey_avail := LEAST((v_elapsed_ms / v_ms_per_pt)::int, v_max_honey);

  IF v_honey_avail <= 0   THEN RETURN jsonb_build_object('ok', false, 'error', 'no_honey');  END IF;
  IF v_empty_jars <= 0    THEN RETURN jsonb_build_object('ok', false, 'error', 'no_jars');   END IF;
  IF v_suit <= 0          THEN RETURN jsonb_build_object('ok', false, 'error', 'no_suit');   END IF;

  v_collected := LEAST(v_honey_avail, v_empty_jars);
  -- Losowość po stronie serwera
  v_success   := random() < v_chance_arr[v_level];

  -- honey_start: jeśli miód był capped (timer przekroczył limit) — reset do teraz minus niezebrane godziny
  -- jeśli timer jeszcze nie dobił do limitu — przesuń o zebrane godziny (zachowuje ułamkowy postęp)
  v_new_hive := jsonb_build_object(
    'level',           v_level,
    'bees_progress',   v_bees_progress,
    'honey_start',     CASE
                         WHEN (v_elapsed_ms / v_ms_per_pt)::int >= v_max_honey
                         THEN v_now_ms - ((v_honey_avail - v_collected)::bigint * v_ms_per_pt)
                         ELSE v_honey_start + v_collected::bigint * v_ms_per_pt
                       END,
    'suit_durability', GREATEST(0, v_suit - v_collected),
    'empty_jars',      v_empty_jars - v_collected,
    'honey_jars',      CASE WHEN v_success THEN v_honey_jars + v_collected ELSE v_honey_jars END
  );

  UPDATE profiles SET hive_data = v_new_hive WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'success',   v_success,
    'collected', v_collected,
    'hive_data', v_new_hive
  );
END;
$$;


-- 2. DOKUPOWANIE PSZCZÓŁ + automatyczne ulepszenie poziomu
CREATE OR REPLACE FUNCTION add_hive_bees(p_user_id uuid, p_amount int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hive          jsonb;
  v_level         int;
  v_bees          int;
  v_honey_start   bigint;
  v_suit          int;
  v_empty_jars    int;
  v_honey_jars    int;
  v_needed_arr    int[] := ARRAY[0, 20, 30, 40, 50];
  v_needed        int;
  v_add           int;
  v_new_bees      int;
  v_new_level     int;
  v_new_hive      jsonb;
BEGIN
  SELECT hive_data INTO v_hive
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hive IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_hive'); END IF;

  v_level       := COALESCE((v_hive->>'level')::int, 1);
  v_bees        := COALESCE((v_hive->>'bees_progress')::int, 0);
  v_honey_start := (v_hive->>'honey_start')::bigint;
  v_suit        := COALESCE((v_hive->>'suit_durability')::int, 0);
  v_empty_jars  := COALESCE((v_hive->>'empty_jars')::int, 0);
  v_honey_jars  := COALESCE((v_hive->>'honey_jars')::int, 0);

  IF v_level >= 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'max_level'); END IF;

  v_needed    := v_needed_arr[v_level];
  v_add       := LEAST(GREATEST(p_amount, 0), v_needed - v_bees);
  v_new_bees  := v_bees + v_add;
  v_new_level := v_level;

  IF v_new_bees >= v_needed THEN
    v_new_level := v_level + 1;
    v_new_bees  := 0;
  END IF;

  v_new_hive := jsonb_build_object(
    'level',           v_new_level,
    'bees_progress',   v_new_bees,
    'honey_start',     v_honey_start,
    'suit_durability', v_suit,
    'empty_jars',      v_empty_jars,
    'honey_jars',      v_honey_jars
  );

  UPDATE profiles SET hive_data = v_new_hive WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'hive_data', v_new_hive);
END;
$$;


-- 3. SPRZEDAŻ MIODU (serwer sprawdza ile gracz naprawdę ma)
CREATE OR REPLACE FUNCTION sell_honey(p_user_id uuid, p_qty int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hive         jsonb;
  v_level        int;
  v_honey_jars   int;
  v_money        numeric;
  v_price_arr    int[] := ARRAY[0, 8, 9, 11, 13, 15];
  v_price        int;
  v_sell_qty     int;
  v_earned       numeric;
  v_new_hive     jsonb;
BEGIN
  SELECT hive_data, money INTO v_hive, v_money
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_hive IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_hive'); END IF;

  v_level      := COALESCE((v_hive->>'level')::int, 1);
  v_honey_jars := COALESCE((v_hive->>'honey_jars')::int, 0);
  v_price      := v_price_arr[v_level];
  -- Serwer sam ogranicza do faktycznego stanu
  v_sell_qty   := LEAST(GREATEST(p_qty, 0), v_honey_jars);

  IF v_sell_qty <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no_jars'); END IF;

  v_earned   := v_sell_qty * v_price;
  v_new_hive := v_hive || jsonb_build_object('honey_jars', v_honey_jars - v_sell_qty);

  UPDATE profiles
  SET money = v_money + v_earned, hive_data = v_new_hive
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'sold',      v_sell_qty,
    'earned',    v_earned,
    'hive_data', v_new_hive
  );
END;
$$;
