-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH: Bonus w zamówieniu klienta nie może pokrywać się z tym, o co pyta
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   _npc_roll_bonus losuje bonus niezależnie od zawartości zamówienia.
--   Skutek: klient prosi o np. "Rogi Byka" i jednocześnie daje je jako bonus.
--
-- Rozwiązanie:
--   Po wygenerowaniu bonusu sprawdzamy, czy jego `id` jest już w v_existing_ids
--   (lista id przedmiotów z zamówienia). Jeśli tak — bonus = [].
--
-- Zastępuje: spawn_customer_order z sql_lada_npc_etap4_lvl_scaling.sql
-- ═══════════════════════════════════════════════════════════════════════════

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
  v_bonus_id TEXT;
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

  -- Wagi już z uwzględnieniem lvl gracza
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

  v_gold := round((v_total * v_t.mult * 0.70)::NUMERIC, 2);
  v_exp  := round((v_total * v_t.mult * 0.03)::NUMERIC)::INT;

  IF random() < v_t.bonus_chance THEN
    v_bonus := jsonb_build_array(_npc_roll_bonus(v_level, v_t.bonus_strength));
    -- Nie dawaj jako bonus tego co klient już zamawia
    IF jsonb_array_length(v_bonus) > 0 THEN
      v_bonus_id := v_bonus->0->>'id';
      IF v_bonus_id IS NOT NULL AND v_existing_ids @> to_jsonb(v_bonus_id) THEN
        v_bonus := '[]'::JSONB;
      END IF;
    END IF;
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
