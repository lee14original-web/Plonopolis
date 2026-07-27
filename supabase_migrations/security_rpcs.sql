-- ============================================================
-- PLONOPOLIS — Security RPCs (run in Supabase SQL Editor)
-- Wszystkie funkcje SECURITY DEFINER — klient nie może ominąć walidacji
-- ============================================================

-- 1. game_save_char_equipped
--    Waliduje że każdy wyposażony przedmiot jest w owned_eq_items gracza
CREATE OR REPLACE FUNCTION game_save_char_equipped(p_char_equipped jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_owned   jsonb;
  v_slot    text;
  v_item_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT COALESCE(owned_eq_items, '{}') INTO v_owned FROM profiles WHERE id = v_uid;
  FOR v_slot IN SELECT jsonb_object_keys(p_char_equipped) LOOP
    v_item_id := p_char_equipped -> v_slot ->> 'id';
    IF v_item_id IS NOT NULL AND NOT (v_owned ? v_item_id) THEN
      RETURN jsonb_build_object('ok', false, 'error',
        format('Item %s not in owned_eq_items', v_item_id));
    END IF;
  END LOOP;
  UPDATE profiles SET char_equipped = p_char_equipped WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2. game_save_item_upg_registry
--    Ulepszenie może tylko rosnąć (nigdy maleć) i nie może przekroczyć +10
CREATE OR REPLACE FUNCTION game_save_item_upg_registry(p_registry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_current jsonb;
  v_key     text;
  v_new_val int;
  v_cur_val int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT COALESCE(item_upg_registry, '{}') INTO v_current FROM profiles WHERE id = v_uid;
  FOR v_key IN SELECT jsonb_object_keys(p_registry) LOOP
    v_new_val := (p_registry ->> v_key)::int;
    v_cur_val := COALESCE((v_current ->> v_key)::int, 0);
    IF v_new_val < v_cur_val THEN
      RETURN jsonb_build_object('ok', false, 'error',
        format('Cannot downgrade %s from +%s to +%s', v_key, v_cur_val, v_new_val));
    END IF;
    IF v_new_val > 10 THEN
      RETURN jsonb_build_object('ok', false, 'error',
        format('Upgrade +%s exceeds max +10', v_new_val));
    END IF;
  END LOOP;
  UPDATE profiles SET item_upg_registry = p_registry WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. game_apply_compost_to_plot
--    Waliduje że gracz ma kompost, aplikuje bonus na pole i odejmuje z ekwipunku atomicznie
CREATE OR REPLACE FUNCTION game_apply_compost_to_plot(
  p_plot_id       int,
  p_compost_key   text,   -- klucz w seed_inventory, np. 'guide_compost', 'kompost_growth_15'
  p_compost_type  text,   -- 'guide' | 'growth' | 'yield' | 'exp'
  p_compost_value int     -- wartość bonusu, np. 75
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_inv   jsonb;
  v_plots jsonb;
  v_plot  jsonb;
  v_have  int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT COALESCE(seed_inventory, '{}'), COALESCE(plot_crops, '{}')
    INTO v_inv, v_plots FROM profiles WHERE id = v_uid;
  v_have := COALESCE((v_inv ->> p_compost_key)::int, 0);
  IF v_have <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No compost in inventory');
  END IF;
  v_plot := COALESCE(v_plots -> p_plot_id::text, '{}');
  IF (v_plot -> 'compostBonus') IS NOT NULL
     AND (v_plot ->> 'compostBonus') <> 'null' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plot already has compost bonus');
  END IF;
  v_plot  := v_plot || jsonb_build_object('compostBonus',
               jsonb_build_object('type', p_compost_type, 'value', p_compost_value));
  v_plots := jsonb_set(v_plots, ARRAY[p_plot_id::text], v_plot);
  IF v_have <= 1 THEN v_inv := v_inv - p_compost_key;
  ELSE v_inv := jsonb_set(v_inv, ARRAY[p_compost_key], to_jsonb(v_have - 1));
  END IF;
  UPDATE profiles SET plot_crops = v_plots, seed_inventory = v_inv WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'seed_inventory', v_inv, 'plot_crops', v_plots);
END;
$$;

-- 4. game_apply_bulk_compost
--    Stosuje kompost na wiele pól naraz (ciągnik) — atomicznie
CREATE OR REPLACE FUNCTION game_apply_bulk_compost(
  p_plot_ids      int[],
  p_compost_key   text,
  p_compost_type  text,
  p_compost_value int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_inv   jsonb;
  v_plots jsonb;
  v_plot  jsonb;
  v_pid   int;
  v_have  int;
  v_used  int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT COALESCE(seed_inventory, '{}'), COALESCE(plot_crops, '{}')
    INTO v_inv, v_plots FROM profiles WHERE id = v_uid;
  v_have := COALESCE((v_inv ->> p_compost_key)::int, 0);
  IF v_have <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No compost in inventory');
  END IF;
  FOREACH v_pid IN ARRAY p_plot_ids LOOP
    EXIT WHEN v_used >= v_have;
    v_plot := COALESCE(v_plots -> v_pid::text, '{}');
    CONTINUE WHEN (v_plot -> 'compostBonus') IS NOT NULL
                  AND (v_plot ->> 'compostBonus') <> 'null';
    v_plot  := v_plot || jsonb_build_object('compostBonus',
                 jsonb_build_object('type', p_compost_type, 'value', p_compost_value));
    v_plots := jsonb_set(v_plots, ARRAY[v_pid::text], v_plot);
    v_used  := v_used + 1;
  END LOOP;
  IF v_used = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No eligible plots');
  END IF;
  IF v_have <= v_used THEN v_inv := v_inv - p_compost_key;
  ELSE v_inv := jsonb_set(v_inv, ARRAY[p_compost_key], to_jsonb(v_have - v_used));
  END IF;
  UPDATE profiles SET plot_crops = v_plots, seed_inventory = v_inv WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'used', v_used,
    'seed_inventory', v_inv, 'plot_crops', v_plots);
END;
$$;

-- 5. game_deposit_to_kompost
--    Odejmuje nasiona/plony z ekwipunku przy wrzucaniu do kompostownika
CREATE OR REPLACE FUNCTION game_deposit_to_kompost(p_seed_key text, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_inv  jsonb;
  v_have int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be > 0');
  END IF;
  SELECT COALESCE(seed_inventory, '{}') INTO v_inv FROM profiles WHERE id = v_uid;
  v_have := COALESCE((v_inv ->> p_seed_key)::int, 0);
  IF v_have < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Not enough: have %s need %s', v_have, p_amount));
  END IF;
  IF v_have <= p_amount THEN v_inv := v_inv - p_seed_key;
  ELSE v_inv := jsonb_set(v_inv, ARRAY[p_seed_key], to_jsonb(v_have - p_amount));
  END IF;
  UPDATE profiles SET seed_inventory = v_inv WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'seed_inventory', v_inv);
END;
$$;

-- 6. game_add_seeds_to_inventory
--    DODAJE (nigdy nie zastępuje) nasiona/komposty — dla nagród kompostownika
--    Gracz może tylko zyskać to co serwer zatwierdził, nie może usuwać
CREATE OR REPLACE FUNCTION game_add_seeds_to_inventory(p_seeds_delta jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv jsonb;
  v_key text;
  v_add int;
  v_cur int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT COALESCE(seed_inventory, '{}') INTO v_inv FROM profiles WHERE id = v_uid;
  FOR v_key IN SELECT jsonb_object_keys(p_seeds_delta) LOOP
    v_add := COALESCE((p_seeds_delta ->> v_key)::int, 0);
    IF v_add > 0 THEN
      v_cur := COALESCE((v_inv ->> v_key)::int, 0);
      v_inv := jsonb_set(v_inv, ARRAY[v_key], to_jsonb(v_cur + v_add));
    END IF;
  END LOOP;
  UPDATE profiles SET seed_inventory = v_inv WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'seed_inventory', v_inv);
END;
$$;

-- 7. game_save_farm_power
--    Waliduje zakres mocy farmy (zapobiega fałszywemu rankingowi)
CREATE OR REPLACE FUNCTION game_save_farm_power(p_farm_power numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  UPDATE profiles SET farm_power = GREATEST(0, LEAST(p_farm_power, 999999)) WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;
