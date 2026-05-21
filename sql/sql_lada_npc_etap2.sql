-- ═══════════════════════════════════════════════════════════════════════════
-- PAKIET 1 (= ETAP 2 SQL): bezpieczeństwo + walidacja serwerowa Lady NPC
--   • migracja barn_items + fruit_inventory do bazy (były tylko w localStorage)
--   • usunięcie kompostu z zamówień (zostaje tylko jako bonus)
--   • RPC mirror'ów dla zapisu z gry (sync_barn_items / sync_fruit_inventory)
--   • RPC complete_customer_order (atomowa realizacja zamówienia, server-side)
--   • Trigger anti-tamper — blokada bezpośredniego UPDATE z DevTools
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. NOWE KOLUMNY DLA INWENTARZY ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS barn_items      JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS fruit_inventory JSONB NOT NULL DEFAULT '{}'::JSONB;

-- ─── 2. USUNIĘCIE KOMPOSTU Z ZAMÓWIEŃ (zostaje tylko jako bonus) ──────────
CREATE OR REPLACE FUNCTION _npc_pick_item(p_level INT)
RETURNS TABLE(item_id TEXT, item_qty INT, item_value NUMERIC)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_categories TEXT[] := ARRAY['crop','fruit','animal','honey'];
  v_weights    NUMERIC[];
  v_cat        TEXT;
  v_qual       TEXT;
  v_chosen     RECORD;
  v_qmin       INT;
  v_qmax       INT;
  v_qty        INT;
  v_base       NUMERIC;
  v_mult       NUMERIC;
BEGIN
  v_weights := ARRAY[
    50.0,
    CASE WHEN p_level >= 10 THEN 25.0 ELSE 0 END,
    CASE WHEN p_level >=  3 THEN 30.0 ELSE 0 END,
    8.0
  ];
  v_cat := _npc_weighted_pick_text(v_categories, v_weights);
  IF v_cat IS NULL THEN RETURN; END IF;

  IF v_cat = 'crop' THEN
    SELECT crop_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_crops_data() WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.crop_id IS NULL THEN RETURN; END IF;
    v_qual := _npc_weighted_pick_text(ARRAY['good','epic','legendary'], ARRAY[75.0,20.0,5.0]);
    SELECT qmin, qmax INTO v_qmin, v_qmax FROM _npc_crop_qty_range(v_qual, v_chosen.unlock_lvl);
    IF v_qmin IS NULL THEN RETURN; END IF;
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
    v_mult := _npc_quality_mult(v_qual);
    v_base := v_chosen.base_price * v_mult;
    RETURN QUERY SELECT v_chosen.crop_id || '_' || v_qual, v_qty, v_base * v_qty;

  ELSIF v_cat = 'fruit' THEN
    SELECT fruit_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_fruits_data() WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.fruit_id IS NULL THEN RETURN; END IF;
    v_qual := _npc_weighted_pick_text(ARRAY['zwykly','soczysty','zloty'], ARRAY[80.0,17.0,3.0]);
    SELECT qmin, qmax INTO v_qmin, v_qmax FROM _npc_fruit_qty_range(v_qual, v_chosen.unlock_lvl);
    IF v_qmin IS NULL THEN RETURN; END IF;
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
    v_mult := _npc_quality_mult(v_qual);
    v_base := v_chosen.base_price * v_mult;
    RETURN QUERY SELECT v_chosen.fruit_id || '_' || v_qual, v_qty, v_base * v_qty;

  ELSIF v_cat = 'animal' THEN
    SELECT a.item_id, a.unlock_lvl, a.base_price, a.qty_min, a.qty_max INTO v_chosen
      FROM _npc_animal_data() a WHERE a.unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.item_id IS NULL THEN RETURN; END IF;
    v_qty  := _npc_rand_int(v_chosen.qty_min, v_chosen.qty_max);
    v_base := v_chosen.base_price;
    RETURN QUERY SELECT v_chosen.item_id, v_qty, v_base * v_qty;

  ELSE  -- honey
    v_qty := _npc_rand_int(1, 8);
    RETURN QUERY SELECT 'honey_jar'::TEXT, v_qty, 12.0 * v_qty;
  END IF;
END $$;

-- ─── 3. RPC MIRROR'ÓW INWENTARZY ──────────────────────────────────────────
-- Używane przez kod gry (Stodoła odbiera produkcję, Sad odbiera owoce, itd.)
-- Trigger anti-tamper (sekcja 5) blokuje bezpośredni UPDATE z PostgREST,
-- więc te RPC są jedyną drogą zapisu z poziomu zalogowanego usera.
CREATE OR REPLACE FUNCTION sync_barn_items(p_user_id UUID, p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'object' THEN
    RAISE EXCEPTION 'p_items must be a jsonb object';
  END IF;
  UPDATE profiles SET barn_items = p_items WHERE id = p_user_id;
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION sync_fruit_inventory(p_user_id UUID, p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'object' THEN
    RAISE EXCEPTION 'p_items must be a jsonb object';
  END IF;
  UPDATE profiles SET fruit_inventory = p_items WHERE id = p_user_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION sync_barn_items(UUID, JSONB)      TO authenticated;
GRANT EXECUTE ON FUNCTION sync_fruit_inventory(UUID, JSONB) TO authenticated;

-- ─── 4. RPC complete_customer_order ──────────────────────────────────────
-- Atomowa realizacja zamówienia NPC.
-- Walidacja serwerowa: czy gracz ma WSZYSTKIE wymagane przedmioty.
-- Jeśli OK: odejmuje przedmioty z odpowiednich inwentarzy (uprawy, owoce,
-- zwierzęce, miód), dodaje gold i bonusy, kasuje order. Wszystko w jednej
-- transakcji.
-- exp i level NIE są aktualizowane w SQL — klient sam doliczy (poziom-up
-- ma animacje + skill points logic w grze).
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

  -- 1) Walidacja: czy gracz ma WSZYSTKIE wymagane przedmioty
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

  -- 2) Odejmowanie itemów (drugi przebieg, po przejściu walidacji)
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

  -- 3) Zastosowanie bonusów
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
    ELSIF v_bonus_type = 'compost' THEN
      -- Kompost — klient sam obsłuży (PAKIET 3 UI). Zwracamy info w response.
      NULL;
    END IF;
  END LOOP;

  -- 4) Zapisz hive_data.honey_jars
  v_hive := jsonb_set(v_hive, ARRAY['honey_jars'], to_jsonb(v_honey_jars));

  -- 5) Aktualizuj money i wszystkie inwentarze
  v_new_money := ROUND((COALESCE(v_profile.money, 0) + v_gold)::NUMERIC, 2);

  UPDATE profiles SET
    money            = v_new_money,
    seed_inventory   = v_seed_inv,
    barn_items       = v_barn,
    fruit_inventory  = v_fruit,
    hive_data        = v_hive
  WHERE id = p_user_id;

  -- 6) Usuń zamówienie
  DELETE FROM customer_orders WHERE id = p_order_id;

  -- 7) Zwróć stan końcowy + nagrody (klient zaktualizuje exp/level po swojemu)
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

-- ─── 5. TRIGGER ANTI-TAMPER ──────────────────────────────────────────────
-- Blokuje bezpośrednie modyfikacje barn_items/fruit_inventory z poziomu
-- zalogowanego usera (PostgREST → rola 'authenticated'). Pozwala na
-- modyfikacje przez nasze RPC z SECURITY DEFINER (uruchomione jako 'postgres').
CREATE OR REPLACE FUNCTION protect_inventory_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.barn_items IS DISTINCT FROM OLD.barn_items THEN
      RAISE EXCEPTION 'Direct update of barn_items not allowed. Use sync_barn_items() RPC.';
    END IF;
    IF NEW.fruit_inventory IS DISTINCT FROM OLD.fruit_inventory THEN
      RAISE EXCEPTION 'Direct update of fruit_inventory not allowed. Use sync_fruit_inventory() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_inventory_columns_trg ON profiles;
CREATE TRIGGER protect_inventory_columns_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_columns();

-- ═══════════════════════════════════════════════════════════════════════════
-- KONIEC PAKIETU 1
-- ═══════════════════════════════════════════════════════════════════════════
