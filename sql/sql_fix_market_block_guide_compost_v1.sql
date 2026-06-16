CREATE OR REPLACE FUNCTION market_create_offer(
  p_item_type       TEXT,
  p_item_key        TEXT,
  p_item_name       TEXT,
  p_item_icon       TEXT,
  p_quantity        INTEGER,
  p_price_per_unit  NUMERIC,
  p_duration_hours  INTEGER DEFAULT 24,
  p_unlock_level    INTEGER DEFAULT 1
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid                UUID    := auth.uid();
  v_level              INTEGER;
  v_max_offers         INTEGER;
  v_active_cnt         INTEGER;
  v_current_qty        NUMERIC;
  v_min_price          NUMERIC;
  v_ext_fee            NUMERIC := 0;
  v_money              NUMERIC;
  v_total              NUMERIC;
  v_offer_id           UUID;
  v_active_value       NUMERIC;
  v_active_value_limit NUMERIC;
  v_earned_today       NUMERIC;
  v_earned_date        DATE;
  v_daily_limit        NUMERIC;
  v_today              DATE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Nie jesteś zalogowany'); END IF;

  -- Walidacja wejść
  IF p_quantity <= 0 THEN RETURN jsonb_build_object('error','Ilość musi być dodatnia'); END IF;
  IF p_price_per_unit <= 0 THEN RETURN jsonb_build_object('error','Cena musi być dodatnia'); END IF;
  IF p_duration_hours NOT IN (24, 48, 72) THEN RETURN jsonb_build_object('error','Czas oferty: 24h, 48h lub 72h'); END IF;
  IF p_item_type NOT IN ('crop','compost','barn_item','fruit','honey','equipment') THEN
    RETURN jsonb_build_object('error','Nieznany typ przedmiotu');
  END IF;
  IF p_item_type = 'equipment' AND p_quantity != 1 THEN
    RETURN jsonb_build_object('error','Wyposażenie można wystawić tylko po 1 szt.');
  END IF;

  -- *** BLOKADA: guide_compost nie może być sprzedany na targu ***
  IF p_item_key = 'guide_compost' THEN
    RETURN jsonb_build_object('error','Tego przedmiotu nie można sprzedać na targu.');
  END IF;

  -- Minimalna cena (backend — frontend nie może tego ominąć)
  v_min_price := market_min_price(p_item_type, p_item_key);
  IF p_price_per_unit < v_min_price THEN
    RETURN jsonb_build_object('error','Cena poniżej minimum (' || v_min_price::TEXT || ' zł/szt)');
  END IF;

  -- Limit ofert wg poziomu gracza
  SELECT COALESCE(level, 1) INTO v_level FROM profiles WHERE id = v_uid;
  v_max_offers := CASE
    WHEN v_level >= 25 THEN 10
    WHEN v_level >= 20 THEN 8
    WHEN v_level >= 10 THEN 5
    ELSE 3
  END;
  SELECT COUNT(*) INTO v_active_cnt FROM market_offers WHERE seller_id = v_uid AND status = 'active';
  IF v_active_cnt >= v_max_offers THEN
    RETURN jsonb_build_object('error','Limit aktywnych ofert: ' || v_max_offers || ' (poziom ' || v_level || ')');
  END IF;

  -- Anti-boost #1: łączna wartość aktywnych ofert
  v_active_value_limit := market_active_value_limit(v_level);
  IF v_active_value_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity * price_per_unit), 0) INTO v_active_value
      FROM market_offers WHERE seller_id = v_uid AND status = 'active';
    IF v_active_value + (p_quantity::NUMERIC * p_price_per_unit) > v_active_value_limit THEN
      RETURN jsonb_build_object('error',
        'Limit wartości aktywnych ofert: ' || v_active_value_limit::BIGINT || ' zł (poziom ' || v_level || ')');
    END IF;
  END IF;

  -- Anti-boost #2: dzienny limit zarobku z targu (reset o północy czasu polskiego)
  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::DATE;
  SELECT COALESCE(market_earned_today, 0), market_earned_date
    INTO v_earned_today, v_earned_date FROM profiles WHERE id = v_uid;
  IF v_earned_date IS DISTINCT FROM v_today THEN
    v_earned_today := 0;
  END IF;
  v_daily_limit := market_daily_earn_limit(v_level);
  IF v_daily_limit IS NOT NULL AND v_earned_today >= v_daily_limit THEN
    RETURN jsonb_build_object('error',
      'Dzienny limit zarobku z targu: ' || v_daily_limit::BIGINT || ' zł. Reset o polnocy czasu polskiego.');
  END IF;

  -- Blokada profilu + sprawdzenie złota
  SELECT money INTO v_money FROM profiles WHERE id = v_uid FOR UPDATE;
  v_total := p_price_per_unit * p_quantity;
  IF p_duration_hours = 48 THEN v_ext_fee := ROUND(v_total * 0.03, 2);
  ELSIF p_duration_hours = 72 THEN v_ext_fee := ROUND(v_total * 0.07, 2);
  END IF;
  IF v_ext_fee > 0 AND v_money < v_ext_fee THEN
    RETURN jsonb_build_object('error','Za mało złota na opłatę ' || p_duration_hours || 'h (' || v_ext_fee || ' zł)');
  END IF;

  -- Zabierz przedmiot z odpowiedniego pola inventory
  IF p_item_type IN ('crop','compost') THEN
    SELECT COALESCE((seed_inventory->>p_item_key)::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      seed_inventory = CASE
        WHEN (v_current_qty - p_quantity) <= 0 THEN seed_inventory - p_item_key
        ELSE jsonb_set(seed_inventory, ARRAY[p_item_key], to_jsonb((v_current_qty - p_quantity)::INTEGER))
      END,
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'barn_item' THEN
    SELECT COALESCE((barn_items->>p_item_key)::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      barn_items = CASE
        WHEN (v_current_qty - p_quantity) <= 0 THEN barn_items - p_item_key
        ELSE jsonb_set(barn_items, ARRAY[p_item_key], to_jsonb((v_current_qty - p_quantity)::INTEGER))
      END,
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'fruit' THEN
    SELECT COALESCE((fruit_inventory->>p_item_key)::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      fruit_inventory = CASE
        WHEN (v_current_qty - p_quantity) <= 0 THEN fruit_inventory - p_item_key
        ELSE jsonb_set(fruit_inventory, ARRAY[p_item_key], to_jsonb((v_current_qty - p_quantity)::INTEGER))
      END,
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'honey' THEN
    SELECT COALESCE((hive_data->>'honey_jars')::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. miodu (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      hive_data = jsonb_set(hive_data, '{honey_jars}', to_jsonb(GREATEST(0, (v_current_qty - p_quantity)::INTEGER))),
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'equipment' THEN
    IF v_ext_fee > 0 THEN
      UPDATE profiles SET money = money - v_ext_fee WHERE id = v_uid;
    END IF;
  END IF;

  -- Utwórz ofertę
  INSERT INTO market_offers (
    seller_id, item_type, item_key, item_name, item_icon,
    quantity, price_per_unit, duration_hours, expires_at, unlock_level
  ) VALUES (
    v_uid, p_item_type, p_item_key, p_item_name, p_item_icon,
    p_quantity, p_price_per_unit, p_duration_hours,
    now() + (p_duration_hours || ' hours')::INTERVAL,
    GREATEST(1, p_unlock_level)
  ) RETURNING id INTO v_offer_id;

  RETURN jsonb_build_object('success', true, 'offer_id', v_offer_id, 'extension_fee', v_ext_fee);
END;
$$;
