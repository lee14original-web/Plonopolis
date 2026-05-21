-- ═══════════════════════════════════════════════════════════════════════════
-- PAKIET 9: SZANSA PRZYJĘCIA PSZCZOŁY DO ULA + ZBIÓR MIODU 100%
--
--   • add_hive_bees: każda kupowana pszczoła rzuca losowo czy zostanie przyjęta.
--     Im wyższy poziom ula, tym mniejsza szansa:
--       lvl 1 = 90%, lvl 2 = 80%, lvl 3 = 70%, lvl 4 = 60%, lvl 5 = 50%
--     Kasa za WSZYSTKIE (przyjęte + odrzucone) zostaje pobrana z konta gracza
--     (porażka = pszczoła ginie, kasa przepada).
--   • collect_honey: szansa na sukces zbioru zawsze 100% (bez losowania).
--   • Honey_start startuje gdy SUMA przyjętych pszczół na danym poziomie >= 5.
-- ═══════════════════════════════════════════════════════════════════════════


-- 1. DOKUPOWANIE PSZCZÓŁ — z losową szansą przyjęcia
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
  -- ARRAY 1-indexed: v_needed_arr[1]=20 (lvl 1→2), [2]=30, [3]=40, [4]=50
  v_needed_arr      int[]   := ARRAY[20, 30, 40, 50];
  -- Szansa przyjęcia pszczoły wg poziomu ula (1-indexed)
  v_chance_arr      float[] := ARRAY[0.90, 0.80, 0.70, 0.60, 0.50];
  v_chance          float;
  v_needed          int;
  v_add             int;
  v_accepted        int := 0;     -- ile pszczół zostało przyjętych
  v_rejected        int := 0;     -- ile pszczół zginęło
  v_cost_per_bee    numeric := 75;
  v_total_cost      numeric;
  v_min_to_produce  int     := 5;
  v_new_bees        int;
  v_new_level       int;
  v_new_honey_start bigint;
  v_new_hive        jsonb;
  i                 int;
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

  v_needed := v_needed_arr[v_level];
  v_chance := v_chance_arr[v_level];

  -- Klampujemy ilość do brakującej liczby pszczół na tym poziomie
  v_add        := LEAST(GREATEST(p_amount, 0), v_needed - v_bees);
  v_total_cost := v_add * v_cost_per_bee;

  IF v_add <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nie ma już potrzeby kupować pszczół na tym poziomie.');
  END IF;

  IF COALESCE(v_money, 0) < v_total_cost THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Brak pieniędzy (potrzeba %s zł na %s pszczół).', v_total_cost, v_add));
  END IF;

  -- Losowanie dla każdej pszczoły osobno (PostgreSQL random() po stronie serwera)
  FOR i IN 1..v_add LOOP
    IF random() < v_chance THEN
      v_accepted := v_accepted + 1;
    ELSE
      v_rejected := v_rejected + 1;
    END IF;
  END LOOP;

  v_new_bees  := v_bees + v_accepted;
  v_new_level := v_level;

  -- Auto-upgrade ula gdy zebrano wystarczająco PRZYJĘTYCH pszczół
  IF v_new_bees >= v_needed THEN
    v_new_level := v_level + 1;
    v_new_bees  := 0;
  END IF;

  -- Timer ula startuje gdy łącznie PRZYJĘTYCH pszczół na tym poziomie >= 5
  v_new_honey_start := v_honey_start;
  IF v_honey_start IS NULL AND (v_bees + v_accepted) >= v_min_to_produce THEN
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

  -- Pełna cena za wszystkie pszczoły zostaje pobrana, niezależnie od wyniku losowania
  UPDATE profiles
  SET money = v_money - v_total_cost,
      hive_data = v_new_hive
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'hive_data',      v_new_hive,
    'spent',          v_total_cost,
    'bees_attempted', v_add,
    'bees_accepted',  v_accepted,
    'bees_rejected',  v_rejected,
    'chance_pct',     ROUND((v_chance * 100)::numeric, 0)
  );
END;
$$;


-- 2. ZBIÓR MIODU — szansa zawsze 100% (bez losowania)
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
  v_hive             jsonb;
  v_level            int;
  v_honey_start      bigint;
  v_suit             int;
  v_empty_jars       int;
  v_honey_jars       int;
  v_bees_progress    int;
  v_now_ms           bigint;
  v_elapsed_ms       bigint;
  v_honey_avail      int;
  v_honey_avail_raw  int;
  v_max_honey        int;
  v_ms_per_pt        bigint := 3600000;
  v_collected        int;
  v_collected_raw    numeric;
  v_collected_raw_ms bigint;
  v_remaining_raw    int;
  v_suit_loss        int;
  v_max_arr          int[]   := ARRAY[0, 8, 10, 12, 14, 16];
  v_new_hive         jsonb;
  v_honey_mult       numeric;
  v_suit_save        numeric;
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

  IF v_honey_avail <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no_honey'); END IF;
  IF v_empty_jars <= 0  THEN RETURN jsonb_build_object('ok', false, 'error', 'no_jars');  END IF;
  IF v_suit <= 0        THEN RETURN jsonb_build_object('ok', false, 'error', 'no_suit');  END IF;

  v_collected := LEAST(v_honey_avail, v_empty_jars);

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

  v_new_hive := jsonb_build_object(
    'level',           v_level,
    'bees_progress',   v_bees_progress,
    'honey_start',     CASE
                         WHEN v_honey_avail_raw >= v_max_honey
                         THEN v_now_ms - (v_remaining_raw::bigint * v_ms_per_pt)
                         ELSE COALESCE(v_honey_start, v_now_ms) + v_collected_raw_ms
                       END,
    'suit_durability', GREATEST(0, v_suit - v_suit_loss),
    'empty_jars',      v_empty_jars - v_collected,
    'honey_jars',      v_honey_jars + v_collected   -- ZAWSZE wpada do słoików (100% sukcesu)
  );

  UPDATE profiles SET hive_data = v_new_hive WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'success',    true,
    'collected',  v_collected,
    'hive_data',  v_new_hive
  );
END;
$$;
