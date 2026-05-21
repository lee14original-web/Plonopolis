-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: complete_customer_order — dodaje EXP, level-up, xp_to_next_level
-- ───────────────────────────────────────────────────────────────────────────
-- Zmiany względem etap2:
--   • Po aktualizacji money SQL teraz RÓWNIEŻ aktualizuje xp, level,
--     xp_to_next_level i current_map (pattern identyczny z game_harvest_plot).
--   • Usunięty stary komentarz "exp i level NIE są aktualizowane w SQL".
--   • Zwraca dodatkowo: new_xp, new_level, new_xp_to_next_level.
--   • Frontend po sukcesie wywołuje loadProfile() — nie potrzebuje dev_add_exp.
--
-- Wklej całość w SQL Editor Supabase i wykonaj.
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
  -- EXP / level-up (wzorzec jak w game_harvest_plot)
  v_level        INT;
  v_xp           INT;
  v_xp_to_next   INT;
BEGIN
  IF p_user_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id and p_order_id required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Pobierz zamówienie z BLOKADĄ (atomowość przy równoległych próbach)
  SELECT * INTO v_order FROM customer_orders
    WHERE id = p_order_id AND user_id = p_user_id
    FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'order not found or not yours'; END IF;
  IF v_order.expires_at <= NOW() THEN
    DELETE FROM customer_orders WHERE id = p_order_id;
    RAISE EXCEPTION 'order expired';
  END IF;

  -- Pobierz profil z BLOKADĄ
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  v_seed_inv   := COALESCE(v_profile.seed_inventory, '{}'::JSONB);
  v_barn       := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_fruit      := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_hive       := COALESCE(v_profile.hive_data, '{}'::JSONB);
  v_honey_jars := COALESCE((v_hive->>'honey_jars')::INT, 0);

  -- ── 1) Walidacja: czy gracz ma WSZYSTKIE wymagane przedmioty ───────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_item_id  := v_item->>'id';
    v_item_qty := (v_item->>'qty')::INT;

    IF v_item_id = 'honey_jar' THEN
      IF v_honey_jars < v_item_qty THEN
        RAISE EXCEPTION 'insufficient: honey_jar (have %, need %)', v_honey_jars, v_item_qty;
      END IF;
    ELSIF v_item_id ~ '_(good|epic|legendary)$' THEN
      v_have := COALESCE((v_seed_inv->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN
        RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty;
      END IF;
    ELSIF v_item_id ~ '_(zwykly|soczysty|zloty)$' THEN
      v_have := COALESCE((v_fruit->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN
        RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty;
      END IF;
    ELSE
      -- animal item (jajko, mleko, futro_krolika, ...)
      v_have := COALESCE((v_barn->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN
        RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty;
      END IF;
    END IF;
  END LOOP;

  -- ── 2) Odejmowanie itemów (drugi przebieg, po przejściu walidacji) ─────
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_item_id  := v_item->>'id';
    v_item_qty := (v_item->>'qty')::INT;

    IF v_item_id = 'honey_jar' THEN
      v_honey_jars := v_honey_jars - v_item_qty;
    ELSIF v_item_id ~ '_(good|epic|legendary)$' THEN
      v_have := COALESCE((v_seed_inv->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN
        v_seed_inv := v_seed_inv - v_item_id;
      ELSE
        v_seed_inv := jsonb_set(v_seed_inv, ARRAY[v_item_id], to_jsonb(v_have));
      END IF;
    ELSIF v_item_id ~ '_(zwykly|soczysty|zloty)$' THEN
      v_have := COALESCE((v_fruit->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN
        v_fruit := v_fruit - v_item_id;
      ELSE
        v_fruit := jsonb_set(v_fruit, ARRAY[v_item_id], to_jsonb(v_have));
      END IF;
    ELSE
      v_have := COALESCE((v_barn->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN
        v_barn := v_barn - v_item_id;
      ELSE
        v_barn := jsonb_set(v_barn, ARRAY[v_item_id], to_jsonb(v_have));
      END IF;
    END IF;
  END LOOP;

  -- ── 3) Bonusy z zamówienia (animal / crop / compost / eq_item) ─────────
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
    ELSIF v_bonus_type = 'crop' THEN
      v_have := COALESCE((v_seed_inv->>v_bonus_id)::INT, 0);
      v_seed_inv := jsonb_set(v_seed_inv, ARRAY[v_bonus_id], to_jsonb(v_have + v_bonus_qty));
    ELSIF v_bonus_type IN ('compost', 'eq_item') THEN
      -- compost i eq_item: obsługa po stronie klienta (modal loot drop).
      -- SQL tylko zwraca bonus w odpowiedzi — nie modyfikuje inwentarza tutaj.
      NULL;
    END IF;
  END LOOP;

  -- ── 4) Zapisz hive_data.honey_jars ────────────────────────────────────
  v_hive := jsonb_set(v_hive, ARRAY['honey_jars'], to_jsonb(v_honey_jars));

  -- ── 5) Oblicz nowe money ───────────────────────────────────────────────
  v_new_money := ROUND((COALESCE(v_profile.money, 0) + v_gold)::NUMERIC, 2);

  -- ── 6) Oblicz EXP i level-up (wzorzec identyczny z game_harvest_plot) ─
  v_level      := COALESCE(v_profile.level, 1);
  v_xp         := COALESCE(v_profile.xp, 0) + v_exp;
  v_xp_to_next := COALESCE(v_profile.xp_to_next_level, 12);

  WHILE v_level < 50 AND v_xp >= v_xp_to_next LOOP
    v_xp    := v_xp - v_xp_to_next;
    v_level := v_level + 1;
    IF v_level >= 50 THEN
      v_level      := 50;
      v_xp         := 0;
      v_xp_to_next := 0;
      EXIT;
    ELSE
      v_xp_to_next := public.game_xp_to_next_level(v_level);
    END IF;
  END LOOP;

  -- ── 7) Aktualizuj profil: money + EXP + level + inventory ─────────────
  UPDATE profiles SET
    money            = v_new_money,
    xp               = v_xp,
    level            = v_level,
    xp_to_next_level = v_xp_to_next,
    current_map      = public.game_map_for_level(v_level),
    seed_inventory   = v_seed_inv,
    barn_items       = v_barn,
    fruit_inventory  = v_fruit,
    hive_data        = v_hive
  WHERE id = p_user_id;

  -- ── 8) Usuń zamówienie ─────────────────────────────────────────────────
  DELETE FROM customer_orders WHERE id = p_order_id;

  -- ── 9) Zwróć wynik (frontend wywołuje loadProfile po sukcesie) ─────────
  RETURN jsonb_build_object(
    'ok',                true,
    'gold',              v_gold,
    'exp',               v_exp,
    'bonus',             v_bonus,
    'new_money',         v_new_money,
    'new_xp',            v_xp,
    'new_level',         v_level,
    'new_xp_to_next_level', v_xp_to_next,
    'new_seed_inventory', v_seed_inv,
    'new_barn_items',    v_barn,
    'new_fruit_inventory', v_fruit,
    'new_hive_data',     v_hive
  );
END $$;

GRANT EXECUTE ON FUNCTION complete_customer_order(UUID, UUID) TO authenticated;
