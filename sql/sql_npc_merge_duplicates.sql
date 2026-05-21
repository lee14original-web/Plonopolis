-- ═══════════════════════════════════════════════════════════════════════════
-- PAKIET 10: NPC — scalanie duplikatów w zamówieniu
--
-- Problem: gdy spawn_customer_order wylosował kilka razy ten sam item_id
-- (np. dwa razy 'marchew_good'), w items lądowały dwie osobne pozycje:
--   [{id:'marchew_good', qty:10, value:96}, {id:'marchew_good', qty:29, value:278}]
-- Frontend pokazywał 2× "10× Marchew" i "29× Marchew" jako oddzielne wpisy.
--
-- Fix: po wygenerowaniu items, scalamy je po id (sumujemy qty + value).
-- Dla istniejących zamówień fix nakłada też migrację (UPDATE customer_orders).
-- ═══════════════════════════════════════════════════════════════════════════


-- 1. Pomocnicza funkcja: scala duplikaty po 'id' w tablicy JSONB items
CREATE OR REPLACE FUNCTION _npc_merge_items(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_merged JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN COALESCE(p_items, '[]'::JSONB);
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',    id,
      'qty',   qty_sum,
      'value', round(value_sum::NUMERIC, 2)
    )
    ORDER BY id
  ), '[]'::JSONB)
  INTO v_merged
  FROM (
    SELECT
      (elem->>'id')::TEXT                AS id,
      SUM((elem->>'qty')::INT)           AS qty_sum,
      SUM((elem->>'value')::NUMERIC)     AS value_sum
    FROM jsonb_array_elements(p_items) elem
    GROUP BY (elem->>'id')
  ) t;

  RETURN v_merged;
END $$;


-- 2. Nadpisanie spawn_customer_order — scala items przed INSERT
CREATE OR REPLACE FUNCTION spawn_customer_order(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level INT;
  v_types_id TEXT[];
  v_types_w  NUMERIC[];
  v_ctype TEXT;
  v_t RECORD;
  v_n_items INT;
  v_items JSONB := '[]'::JSONB;
  v_total NUMERIC := 0;
  v_pick RECORD;
  v_gold NUMERIC;
  v_exp INT;
  v_bonus JSONB;
  v_rewards JSONB;
  v_order_id UUID;
  v_existing_ids JSONB := '[]'::JSONB;
  v_attempts INT;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(level, 1) INTO v_level FROM profiles WHERE id = p_user_id;
  IF v_level IS NULL THEN RETURN NULL; END IF;

  SELECT array_agg(ctype ORDER BY ctype),
         array_agg(_npc_lvl_weight(v_level, weight_min, weight_max) ORDER BY ctype)
    INTO v_types_id, v_types_w
    FROM _npc_customer_types();
  v_ctype := _npc_weighted_pick_text(v_types_id, v_types_w);

  SELECT * INTO v_t FROM _npc_customer_types() WHERE ctype = v_ctype LIMIT 1;
  v_n_items := _npc_rand_int(v_t.items_min, v_t.items_max);

  FOR i IN 1..v_n_items LOOP
    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      SELECT * INTO v_pick FROM _npc_pick_item(v_level) LIMIT 1;
      EXIT WHEN v_pick.item_id IS NOT NULL AND
                NOT (v_existing_ids @> to_jsonb(v_pick.item_id));
      EXIT WHEN v_attempts >= 10;
    END LOOP;
    IF v_pick.item_id IS NULL THEN CONTINUE; END IF;
    v_existing_ids := v_existing_ids || to_jsonb(v_pick.item_id);
    v_items := v_items || jsonb_build_object(
      'id', v_pick.item_id,
      'qty', v_pick.item_qty,
      'value', round(v_pick.item_value::NUMERIC, 2)
    );
    v_total := v_total + v_pick.item_value;
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN RETURN NULL; END IF;

  -- ★ NOWE: scal duplikaty po id (gdy anti-dup się "poddało" po 10 próbach
  --   i przepuściło ten sam item_id, wpisy zostają zsumowane)
  v_items := _npc_merge_items(v_items);

  v_gold := round((v_total * v_t.mult * 0.70)::NUMERIC, 2);
  v_exp  := round((v_total * v_t.mult * 0.03)::NUMERIC)::INT;

  IF random() < v_t.bonus_chance THEN
    v_bonus := jsonb_build_array(_npc_roll_bonus(v_level, v_t.bonus_strength));
  ELSE
    v_bonus := '[]'::JSONB;
  END IF;

  v_rewards := jsonb_build_object('gold', v_gold, 'exp', v_exp, 'bonus', v_bonus);

  INSERT INTO customer_orders(user_id, customer_type, items, rewards, total_value, reward_mult, expires_at)
    VALUES (p_user_id, v_ctype, v_items, v_rewards,
            round(v_total::NUMERIC, 2), v_t.mult,
            NOW() + (v_t.expires_h || ' hours')::INTERVAL)
    RETURNING id INTO v_order_id;

  RETURN v_order_id;
END $$;


-- 3. Migracja: scal duplikaty w istniejących, jeszcze nieukończonych zamówieniach
UPDATE customer_orders
SET items = _npc_merge_items(items)
WHERE expires_at > NOW();
