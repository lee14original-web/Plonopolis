-- =====================================================
-- FIX: Reset produkcji po odbiorze — Plonopolis
-- Uruchom RAZ w Supabase SQL Editor
-- Po zmianie: po każdym odbiorze timer startuje od v_now_ms
-- (bez leftover — żadna nadwyżka czasu nie przechodzi dalej)
-- =====================================================
-- Dotyczy: harvest_tree, harvest_all_trees,
--          collect_animal, collect_all_animals,
--          collect_honey
-- =====================================================

-- ─── 1. harvest_tree ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION harvest_tree(p_user_id uuid, p_tree_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile        RECORD;
  v_orch           JSONB;
  v_ts             JSONB;
  v_tree           RECORD;
  v_owned          INT;
  v_prod_ms        BIGINT;
  v_now_ms         BIGINT;
  v_elapsed        BIGINT;
  v_cycles         INT;
  v_new_pstart     BIGINT;
  v_added          JSONB := '{}'::JSONB;
  v_fruit_inv      JSONB;
  v_storage_cap    INT := 5;
  v_quality        TEXT;
  v_roll           FLOAT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, orchard_state, fruit_inventory
  INTO v_profile
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  v_orch      := COALESCE(v_profile.orchard_state, '{}'::JSONB);
  v_fruit_inv := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_ts        := COALESCE(v_orch->p_tree_id, '{}'::JSONB);

  SELECT * INTO v_tree FROM orchard_tree_defs WHERE tree_id = p_tree_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_tree'); END IF;

  v_owned   := COALESCE((v_ts->>'owned')::INT, 0);
  IF v_owned = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no_trees'); END IF;

  v_now_ms  := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_prod_ms := COALESCE((v_ts->>'prodStart')::BIGINT, 0);

  IF v_prod_ms = 0 OR v_now_ms < v_prod_ms THEN
    v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_now_ms));
    v_orch := jsonb_set(v_orch, ARRAY[p_tree_id], v_ts);
    UPDATE profiles SET orchard_state = v_orch WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'not_ready',
      'new_prod_start', v_now_ms,
      'new_fruit_inventory', v_fruit_inv);
  END IF;

  v_elapsed := v_now_ms - v_prod_ms;
  v_cycles  := LEAST(FLOOR(v_elapsed / v_tree.growth_time_ms)::INT, v_storage_cap);

  IF v_cycles <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_ready',
      'new_prod_start', v_prod_ms,
      'new_fruit_inventory', v_fruit_inv);
  END IF;

  FOR i IN 1..v_cycles LOOP
    FOR j IN 1..v_owned LOOP
      FOR k IN 1..(v_tree.drop_min + FLOOR(random() * (v_tree.drop_max - v_tree.drop_min + 1))::INT) LOOP
        v_roll := random();
        IF    v_roll < 0.02 THEN v_quality := v_tree.fruit_id || '_zloty';
        ELSIF v_roll < 0.12 THEN v_quality := v_tree.fruit_id || '_soczysty';
        ELSIF v_roll < 0.15 THEN v_quality := v_tree.fruit_id || '_zgnile';
        ELSE                     v_quality := v_tree.fruit_id || '_zwykly';
        END IF;
        v_added := jsonb_set(v_added, ARRAY[v_quality],
          to_jsonb(COALESCE((v_added->>v_quality)::INT, 0) + 1));
        v_fruit_inv := jsonb_set(v_fruit_inv, ARRAY[v_quality],
          to_jsonb(COALESCE((v_fruit_inv->>v_quality)::INT, 0) + 1));
      END LOOP;
    END LOOP;
  END LOOP;

  -- FIX: reset do v_now_ms (bez leftover)
  v_new_pstart := v_now_ms;
  v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_new_pstart));
  v_orch := jsonb_set(v_orch, ARRAY[p_tree_id], v_ts);

  UPDATE profiles SET
    fruit_inventory = v_fruit_inv,
    orchard_state   = v_orch
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',                  true,
    'added',               v_added,
    'new_prod_start',      v_new_pstart,
    'new_fruit_inventory', v_fruit_inv
  );
END $$;

GRANT EXECUTE ON FUNCTION harvest_tree(UUID, TEXT) TO authenticated;


-- ─── 2. harvest_all_trees ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION harvest_all_trees(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile     RECORD;
  v_orch        JSONB;
  v_ts          JSONB;
  v_tree        RECORD;
  v_owned       INT;
  v_prod_ms     BIGINT;
  v_now_ms      BIGINT;
  v_elapsed     BIGINT;
  v_cycles      INT;
  v_new_pstart  BIGINT;
  v_added_t     JSONB;
  v_added_all   JSONB := '{}'::JSONB;
  v_fruit_inv   JSONB;
  v_results     JSONB := '[]'::JSONB;
  v_storage_cap INT   := 5;
  v_quality     TEXT;
  v_roll        FLOAT;
  v_key         TEXT;
  v_val_txt     TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, orchard_state, fruit_inventory
  INTO v_profile
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  v_orch      := COALESCE(v_profile.orchard_state, '{}'::JSONB);
  v_fruit_inv := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_now_ms    := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;

  FOR v_tree IN SELECT * FROM orchard_tree_defs LOOP
    v_ts    := COALESCE(v_orch->v_tree.tree_id, '{}'::JSONB);
    v_owned := COALESCE((v_ts->>'owned')::INT, 0);
    IF v_owned = 0 THEN CONTINUE; END IF;

    v_prod_ms := COALESCE((v_ts->>'prodStart')::BIGINT, 0);

    IF v_prod_ms = 0 OR v_now_ms < v_prod_ms THEN
      v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_now_ms));
      v_orch := jsonb_set(v_orch, ARRAY[v_tree.tree_id], v_ts);
      CONTINUE;
    END IF;

    v_elapsed := v_now_ms - v_prod_ms;
    v_cycles  := LEAST(FLOOR(v_elapsed / v_tree.growth_time_ms)::INT, v_storage_cap);
    IF v_cycles <= 0 THEN CONTINUE; END IF;

    v_added_t := '{}'::JSONB;
    FOR i IN 1..v_cycles LOOP
      FOR j IN 1..v_owned LOOP
        FOR k IN 1..(v_tree.drop_min + FLOOR(random() * (v_tree.drop_max - v_tree.drop_min + 1))::INT) LOOP
          v_roll := random();
          IF    v_roll < 0.02 THEN v_quality := v_tree.fruit_id || '_zloty';
          ELSIF v_roll < 0.12 THEN v_quality := v_tree.fruit_id || '_soczysty';
          ELSIF v_roll < 0.15 THEN v_quality := v_tree.fruit_id || '_zgnile';
          ELSE                     v_quality := v_tree.fruit_id || '_zwykly';
          END IF;
          v_added_t := jsonb_set(v_added_t, ARRAY[v_quality],
            to_jsonb(COALESCE((v_added_t->>v_quality)::INT, 0) + 1));
        END LOOP;
      END LOOP;
    END LOOP;

    FOR v_key, v_val_txt IN SELECT key, value FROM jsonb_each_text(v_added_t) LOOP
      v_fruit_inv  := jsonb_set(v_fruit_inv, ARRAY[v_key],
                       to_jsonb(COALESCE((v_fruit_inv->>v_key)::INT, 0) + v_val_txt::INT));
      v_added_all  := jsonb_set(v_added_all, ARRAY[v_key],
                       to_jsonb(COALESCE((v_added_all->>v_key)::INT, 0) + v_val_txt::INT));
    END LOOP;

    -- FIX: reset do v_now_ms (bez leftover)
    v_new_pstart := v_now_ms;
    v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_new_pstart));
    v_orch := jsonb_set(v_orch, ARRAY[v_tree.tree_id], v_ts);

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'tree_id',        v_tree.tree_id,
        'added',          v_added_t,
        'new_prod_start', v_new_pstart
      )
    );
  END LOOP;

  UPDATE profiles SET
    fruit_inventory = v_fruit_inv,
    orchard_state   = v_orch
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',                  true,
    'results',             v_results,
    'added_all',           v_added_all,
    'new_fruit_inventory', v_fruit_inv
  );
END $$;

GRANT EXECUTE ON FUNCTION harvest_all_trees(UUID) TO authenticated;


-- ─── 3. collect_animal ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION collect_animal(p_user_id uuid, p_animal_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile    RECORD;
  v_bs         JSONB;
  v_ast        JSONB;
  v_animal     RECORD;
  v_owned      INT;
  v_prod_ms    BIGINT;
  v_now_ms     BIGINT;
  v_elapsed    BIGINT;
  v_cycles     INT;
  v_new_pstart BIGINT;
  v_collected  INT;
  v_barn       JSONB;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, barn_state, barn_items
  INTO v_profile
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_animal FROM barn_animal_defs WHERE animal_id = p_animal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_animal'); END IF;

  v_bs  := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_ast := COALESCE(v_bs->p_animal_id, '{}'::JSONB);

  v_owned   := COALESCE((v_ast->>'owned')::INT, 0);
  IF v_owned = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_animals',
      'new_prod_start', 0,
      'new_barn_items', COALESCE(v_profile.barn_items, '{}'::JSONB));
  END IF;

  v_now_ms  := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_prod_ms := COALESCE((v_ast->>'prodStart')::BIGINT, 0);
  v_elapsed := v_now_ms - v_prod_ms;

  IF v_prod_ms = 0 OR v_elapsed < 0 THEN
    v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_now_ms));
    v_bs  := jsonb_set(v_bs, ARRAY[p_animal_id], v_ast);
    UPDATE profiles SET barn_state = v_bs WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'not_ready',
      'new_prod_start', v_now_ms,
      'new_barn_items', COALESCE(v_profile.barn_items, '{}'::JSONB));
  END IF;

  v_cycles := LEAST(FLOOR(v_elapsed / v_animal.prod_ms)::INT, v_animal.storage_max);

  IF v_cycles <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_ready',
      'new_prod_start', v_prod_ms,
      'new_barn_items', COALESCE(v_profile.barn_items, '{}'::JSONB));
  END IF;

  v_collected := v_cycles * LEAST(v_owned, v_animal.max_slots);
  v_barn      := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_barn      := jsonb_set(v_barn, ARRAY[v_animal.item_id],
                   to_jsonb(COALESCE((v_barn->>v_animal.item_id)::INT, 0) + v_collected));

  -- FIX: reset do v_now_ms (bez leftover)
  v_new_pstart := v_now_ms;
  v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_new_pstart));
  v_bs  := jsonb_set(v_bs, ARRAY[p_animal_id], v_ast);

  UPDATE profiles SET
    barn_items = v_barn,
    barn_state = v_bs
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'collected',      v_collected,
    'item_id',        v_animal.item_id,
    'new_prod_start', v_new_pstart,
    'new_barn_items', v_barn
  );
END $$;

GRANT EXECUTE ON FUNCTION collect_animal(UUID, TEXT) TO authenticated;


-- ─── 4. collect_all_animals ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION collect_all_animals(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile    RECORD;
  v_bs         JSONB;
  v_ast        JSONB;
  v_animal     RECORD;
  v_owned      INT;
  v_prod_ms    BIGINT;
  v_now_ms     BIGINT;
  v_elapsed    BIGINT;
  v_cycles     INT;
  v_new_pstart BIGINT;
  v_collected  INT;
  v_total      INT := 0;
  v_barn       JSONB;
  v_results    JSONB := '[]'::JSONB;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, barn_state, barn_items
  INTO v_profile
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  v_bs    := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_barn  := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_now_ms := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;

  FOR v_animal IN SELECT * FROM barn_animal_defs LOOP
    v_ast   := COALESCE(v_bs->v_animal.animal_id, '{}'::JSONB);
    v_owned := COALESCE((v_ast->>'owned')::INT, 0);
    IF v_owned = 0 THEN CONTINUE; END IF;

    v_prod_ms := COALESCE((v_ast->>'prodStart')::BIGINT, 0);
    v_elapsed := v_now_ms - v_prod_ms;

    IF v_prod_ms = 0 OR v_elapsed < 0 THEN
      v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_now_ms));
      v_bs  := jsonb_set(v_bs, ARRAY[v_animal.animal_id], v_ast);
      CONTINUE;
    END IF;

    v_cycles := LEAST(FLOOR(v_elapsed / v_animal.prod_ms)::INT, v_animal.storage_max);
    IF v_cycles <= 0 THEN CONTINUE; END IF;

    v_collected := v_cycles * LEAST(v_owned, v_animal.max_slots);
    v_barn := jsonb_set(v_barn, ARRAY[v_animal.item_id],
               to_jsonb(COALESCE((v_barn->>v_animal.item_id)::INT, 0) + v_collected));

    -- FIX: reset do v_now_ms (bez leftover)
    v_new_pstart := v_now_ms;
    v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_new_pstart));
    v_bs  := jsonb_set(v_bs, ARRAY[v_animal.animal_id], v_ast);
    v_total := v_total + v_collected;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'animal_id',      v_animal.animal_id,
        'item_id',        v_animal.item_id,
        'collected',      v_collected,
        'new_prod_start', v_new_pstart
      )
    );
  END LOOP;

  UPDATE profiles SET
    barn_items = v_barn,
    barn_state = v_bs
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',      true,
    'total',   v_total,
    'results', v_results,
    'new_barn_items', v_barn
  );
END $$;

GRANT EXECUTE ON FUNCTION collect_all_animals(UUID) TO authenticated;


-- ─── 5. collect_honey ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION collect_honey(
  p_user_id          uuid,
  p_honey_bonus_pct  numeric DEFAULT 0,
  p_suit_save_pct    numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hive              jsonb;
  v_level             int;
  v_honey_start       bigint;
  v_suit              int;
  v_empty_jars        int;
  v_honey_jars        int;
  v_bees_progress     int;
  v_now_ms            bigint;
  v_elapsed_ms        bigint;
  v_honey_avail       int;
  v_honey_avail_raw   int;
  v_max_honey         int;
  v_ms_per_pt         bigint := 3600000;
  v_collected         int;
  v_raw_consumed      int;
  v_raw_leftover      int;
  v_new_honey_start   bigint;
  v_suit_loss         int;
  v_success           boolean;
  v_max_arr           int[]   := ARRAY[8, 10, 12, 14, 16];
  v_chance_arr        float[] := ARRAY[0.90, 0.80, 0.70, 0.60, 0.50];
  v_new_hive          jsonb;
  v_honey_mult        numeric;
  v_suit_save         numeric;
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

  v_level         := GREATEST(1, LEAST(5, COALESCE((v_hive->>'level')::int, 1)));
  v_honey_start   := (v_hive->>'honey_start')::bigint;
  v_suit          := COALESCE((v_hive->>'suit_durability')::int, 0);
  v_empty_jars    := COALESCE((v_hive->>'empty_jars')::int, 0);
  v_honey_jars    := COALESCE((v_hive->>'honey_jars')::int, 0);
  v_bees_progress := COALESCE((v_hive->>'bees_progress')::int, 0);

  v_now_ms          := EXTRACT(EPOCH FROM NOW())::bigint * 1000;
  v_elapsed_ms      := GREATEST(0, v_now_ms - COALESCE(v_honey_start, v_now_ms));
  v_max_honey       := v_max_arr[v_level];
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

  -- Zachowaj leftover: niezebrane surowe jednostki miodu wracają do timera
  v_raw_consumed    := LEAST(v_collected, v_honey_avail_raw);
  v_raw_leftover    := GREATEST(0, v_honey_avail_raw - v_raw_consumed);
  v_new_honey_start := CASE
    WHEN v_raw_leftover > 0
    THEN v_now_ms - (v_raw_leftover::bigint * v_ms_per_pt)
    ELSE v_now_ms
  END;

  v_new_hive := jsonb_build_object(
    'level',           v_level,
    'bees_progress',   v_bees_progress,
    'honey_start',     v_new_honey_start,
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
END $$;

GRANT EXECUTE ON FUNCTION collect_honey(UUID, NUMERIC, NUMERIC) TO authenticated;
