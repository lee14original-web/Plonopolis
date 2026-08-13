-- ================================================================
-- FIX: Klienci startowi z nazw "Gość" → "neighbor"
-- ================================================================
-- Problem: game_give_starter_customers tworzy klientów z
--   customer_type = 'Gość' (lub inny nieznany frontend-owi typ).
--   Frontend nie rozpoznaje tego typu → brak grafiki, wyświetla "Gość".
--
-- Zmiany:
--   1. UPDATE istniejących zamówień z nieznanymi typami → 'neighbor'
--   2. Redefine game_give_starter_customers żeby używała 'neighbor' / 'village_guest'
--
-- Bezpieczny do wielokrotnego uruchomienia (idempotentny).
-- ================================================================

-- ─── 1. Napraw istniejące zamówienia z nieznanymi customer_type ───
UPDATE customer_orders
SET customer_type = 'neighbor'
WHERE customer_type NOT IN (
  'neighbor', 'village_guest', 'small_market', 'village_shop',
  'restaurant', 'wholesaler', 'market_chain',
  'distribution_center', 'international_contract'
);

-- ─── 2. Redefine game_give_starter_customers ─────────────────────
-- Daje 5× neighbor + 4× village_guest na starcie (razem 9 klientów).
-- Sprawdza lada_starter_given żeby nie dawać dwa razy.
CREATE OR REPLACE FUNCTION game_give_starter_customers()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID;
  v_given     BOOLEAN;
  v_level     INT;
  v_expires_h INT;
  i           INT;
BEGIN
  -- Pobierz bieżącego użytkownika
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Sprawdź czy już dano starterów
  SELECT COALESCE(lada_starter_given, false), COALESCE(level, 1)
    INTO v_given, v_level
    FROM profiles WHERE id = v_user_id;

  IF v_given THEN
    RETURN json_build_object('ok', true, 'skipped', true);
  END IF;

  -- Wyczyść ewentualne stare zamówienia ze złymi typami
  DELETE FROM customer_orders
  WHERE user_id = v_user_id
    AND customer_type NOT IN (
      'neighbor', 'village_guest', 'small_market', 'village_shop',
      'restaurant', 'wholesaler', 'market_chain',
      'distribution_center', 'international_contract'
    );

  -- Wstaw 5 zamówień Sąsiad (neighbor)
  FOR i IN 1..5 LOOP
    v_expires_h := 12 + (i * 2); -- 14..22h — zróżnicowanie
    INSERT INTO customer_orders(
      user_id, customer_type, items, rewards,
      total_value, reward_mult, expires_at
    ) VALUES (
      v_user_id,
      'neighbor',
      jsonb_build_array(
        jsonb_build_object('id', 'carrot_good', 'qty', 3 + i, 'value', (3 + i) * 5)
      ),
      jsonb_build_object(
        'gold', 15 + i * 5,
        'exp', 5 + i * 2,
        'bonus', '[]'::jsonb
      ),
      (15 + i * 5)::numeric,
      1.00,
      NOW() + (v_expires_h || ' hours')::interval
    );
  END LOOP;

  -- Wstaw 4 zamówienia Gospodyni (village_guest)
  FOR i IN 1..4 LOOP
    v_expires_h := 16 + i;
    INSERT INTO customer_orders(
      user_id, customer_type, items, rewards,
      total_value, reward_mult, expires_at
    ) VALUES (
      v_user_id,
      'village_guest',
      jsonb_build_array(
        jsonb_build_object('id', 'carrot_good', 'qty', 2 + i, 'value', (2 + i) * 6)
      ),
      jsonb_build_object(
        'gold', 20 + i * 6,
        'exp', 8 + i * 2,
        'bonus', '[]'::jsonb
      ),
      (20 + i * 6)::numeric,
      1.15,
      NOW() + (v_expires_h || ' hours')::interval
    );
  END LOOP;

  -- Oznacz jako rozdane
  UPDATE profiles
  SET lada_starter_given = true
  WHERE id = v_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION game_give_starter_customers() TO authenticated;
