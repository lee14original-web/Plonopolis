-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX dla complete_customer_order: bonus 'compost' trafia do seed_inventory
-- Reszta logiki bez zmian — to jest CREATE OR REPLACE całej funkcji.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION complete_customer_order(p_user_id UUID, p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order        RECORD;
  v_profile      RECORD;
  v_item         JSONB;
  v_item_id      TEXT;
  v_item_qty     INT;
  v_seed_inv     JSONB;
  v_barn         JSONB;
  v_fruit        JSONB;
  v_hive         JSONB;
  v_honey_jars   INT;
  v_have         INT;
  v_rewards      JSONB;
  v_gold         NUMERIC;
  v_exp          INT;
  v_bonus        JSONB;
  v_bonus_item   JSONB;
  v_bonus_id     TEXT;
  v_bonus_qty    INT;
  v_bonus_type   TEXT;
  v_new_money    NUMERIC;
BEGIN
  IF p_user_id IS NULL OR p_order_id IS NULL THEN RAISE EXCEPTION 'p_user_id and p_order_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_order FROM customer_orders
    WHERE id = p_order_id AND user_id = p_user_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'order not found or not yours'; END IF;
  IF v_order.expires_at <= NOW() THEN
    DELETE FROM customer_orders WHERE id = p_order_id;
    RAISE EXCEPTION 'order expired';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  v_seed_inv   := COALESCE(v_profile.seed_inventory, '{}'::JSONB);
  v_barn       := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_fruit      := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_hive       := COALESCE(v_profile.hive_data, '{}'::JSONB);
  v_honey_jars := COALESCE((v_hive->>'honey_jars')::INT, 0);

  -- 1) Walidacja
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_item_id  := v_item->>'id';
    v_item_qty := (v_item->>'qty')::INT;
    IF v_item_id = 'honey_jar' THEN
      IF v_honey_jars < v_item_qty THEN RAISE EXCEPTION 'insufficient: honey_jar (have %, need %)', v_honey_jars, v_item_qty; END IF;
    ELSIF v_item_id ~ '_(good|epic|legendary)$' THEN
      v_have := COALESCE((v_seed_inv->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty; END IF;
    ELSIF v_item_id ~ '_(zwykly|soczysty|zloty)$' THEN
      v_have := COALESCE((v_fruit->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty; END IF;
    ELSE
      v_have := COALESCE((v_barn->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty; END IF;
    END IF;
  END LOOP;

  -- 2) Odejmowanie
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_item_id  := v_item->>'id';
    v_item_qty := (v_item->>'qty')::INT;
    IF v_item_id = 'honey_jar' THEN
      v_honey_jars := v_honey_jars - v_item_qty;
    ELSIF v_item_id ~ '_(good|epic|legendary)$' THEN
      v_have := COALESCE((v_seed_inv->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN v_seed_inv := v_seed_inv - v_item_id;
      ELSE v_seed_inv := jsonb_set(v_seed_inv, ARRAY[v_item_id], to_jsonb(v_have)); END IF;
    ELSIF v_item_id ~ '_(zwykly|soczysty|zloty)$' THEN
      v_have := COALESCE((v_fruit->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN v_fruit := v_fruit - v_item_id;
      ELSE v_fruit := jsonb_set(v_fruit, ARRAY[v_item_id], to_jsonb(v_have)); END IF;
    ELSE
      v_have := COALESCE((v_barn->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN v_barn := v_barn - v_item_id;
      ELSE v_barn := jsonb_set(v_barn, ARRAY[v_item_id], to_jsonb(v_have)); END IF;
    END IF;
  END LOOP;

  -- 3) Bonusy (KOMPOST teraz ląduje w seed_inventory)
  v_rewards := COALESCE(v_order.rewards, '{}'::JSONB);
  v_gold    := COALESCE((v_rewards->>'gold')::NUMERIC, 0);
  v_exp     := COALESCE((v_rewards->>'exp')::INT, 0);
  v_bonus   := COALESCE(v_rewards->'bonus', '[]'::JSONB);

  FOR v_bonus_item IN SELECT * FROM jsonb_array_elements(v_bonus) LOOP
    v_bonus_type := v_bonus_item->>'type';
    v_bonus_id   := v_bonus_item->>'id';
    v_bonus_qty  := (v_bonus_item->>'qty')::INT;

    IF v_bonus_type = 'animal' THEN
      v_have := COALESCE((v_barn->>v_bonus_id)::INT, 0);
      v_barn := jsonb_set(v_barn, ARRAY[v_bonus_id], to_jsonb(v_have + v_bonus_qty));
    ELSIF v_bonus_type = 'crop' OR v_bonus_type = 'compost' THEN
      -- Kompost przechowywany jest w seed_inventory pod kluczem typu 'compost_growth_15'
      v_have := COALESCE((v_seed_inv->>v_bonus_id)::INT, 0);
      v_seed_inv := jsonb_set(v_seed_inv, ARRAY[v_bonus_id], to_jsonb(v_have + v_bonus_qty));
    END IF;
  END LOOP;

  v_hive := jsonb_set(v_hive, ARRAY['honey_jars'], to_jsonb(v_honey_jars));
  v_new_money := ROUND((COALESCE(v_profile.money, 0) + v_gold)::NUMERIC, 2);

  UPDATE profiles SET
    money = v_new_money,
    seed_inventory = v_seed_inv,
    barn_items = v_barn,
    fruit_inventory = v_fruit,
    hive_data = v_hive
  WHERE id = p_user_id;

  DELETE FROM customer_orders WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'gold', v_gold,
    'exp', v_exp,
    'bonus', v_bonus,
    'new_money', v_new_money,
    'new_seed_inventory', v_seed_inv,
    'new_barn_items', v_barn,
    'new_fruit_inventory', v_fruit,
    'new_hive_data', v_hive
  );
END $$;

GRANT EXECUTE ON FUNCTION complete_customer_order(UUID, UUID) TO authenticated;
