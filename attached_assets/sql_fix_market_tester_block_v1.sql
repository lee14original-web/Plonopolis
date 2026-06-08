-- ============================================================
-- BLOKADA TARGU DLA KONTA tester (role = 'tester')
-- Wgraj w Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Oba bloki możesz wgrać razem w jednym uruchomieniu.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. market_create_offer — pełna funkcja z blokadą testera
--    Blokada sprawdza profiles.role = 'tester' (nie login).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.market_create_offer(
  p_item_type      text,
  p_item_key       text,
  p_item_name      text,
  p_item_icon      text,
  p_quantity       integer,
  p_price_per_unit numeric,
  p_duration_hours integer,
  p_unlock_level   integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            uuid    := auth.uid();
  v_role           text;
  v_level          integer;
  v_max_offers     integer;
  v_active_count   integer;
  v_active_val     numeric;
  v_active_val_lim numeric;
  v_daily_limit    numeric;
  v_earned_today   numeric;
  v_earned_date    date;
  v_today_warsaw   date;
  v_min_price      numeric := 1;
  v_listing_fee    numeric := 0;
  v_existing_id    uuid;
  v_new_id         uuid;
  v_expires_at     timestamptz;
BEGIN
  -- ── Autoryzacja ──────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Nie jesteś zalogowany.');
  END IF;

  -- ── Blokada dla roli tester ──────────────────────────────────────────────
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role = 'tester' THEN
    RETURN jsonb_build_object('error', 'Targ jest zablokowany dla tego konta.');
  END IF;

  -- ── Walidacja podstawowa ─────────────────────────────────────────────────
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('error', 'Ilość musi być dodatnia.');
  END IF;
  IF p_price_per_unit < v_min_price THEN
    RETURN jsonb_build_object('error', 'Cena za sztukę jest zbyt niska.');
  END IF;
  IF p_duration_hours NOT IN (24, 48, 72) THEN
    RETURN jsonb_build_object('error', 'Czas oferty musi wynosić 24, 48 lub 72 godziny.');
  END IF;

  -- ── Blokada guide_compost ─────────────────────────────────────────────────
  IF p_item_key = 'guide_compost' THEN
    RETURN jsonb_build_object('error', 'Tego przedmiotu nie można sprzedać na targu.');
  END IF;

  -- ── Profil gracza ─────────────────────────────────────────────────────────
  SELECT level,
         COALESCE(market_earned_today, 0),
         market_earned_date
  INTO   v_level, v_earned_today, v_earned_date
  FROM   profiles
  WHERE  id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profil gracza nie istnieje.');
  END IF;

  -- ── Limity slotów wg poziomu ──────────────────────────────────────────────
  v_max_offers := CASE
    WHEN v_level >= 25 THEN 10
    WHEN v_level >= 20 THEN 8
    WHEN v_level >= 10 THEN 5
    ELSE 3
  END;

  -- ── Limity wartości aktywnych ofert ───────────────────────────────────────
  v_active_val_lim := CASE
    WHEN v_level >= 25 THEN NULL
    WHEN v_level >= 20 THEN 500000
    WHEN v_level >= 15 THEN 150000
    WHEN v_level >= 10 THEN 50000
    WHEN v_level >= 7  THEN 10000
    WHEN v_level >= 5  THEN 5000
    WHEN v_level >= 3  THEN 2500
    ELSE 1000
  END;

  -- ── Limit dziennego zarobku ───────────────────────────────────────────────
  v_daily_limit := CASE
    WHEN v_level >= 25 THEN NULL
    WHEN v_level >= 20 THEN 750000
    WHEN v_level >= 15 THEN 300000
    WHEN v_level >= 10 THEN 100000
    WHEN v_level >= 7  THEN 25000
    WHEN v_level >= 5  THEN 10000
    WHEN v_level >= 3  THEN 5000
    ELSE 2000
  END;

  -- Reset dziennego zarobku o północy Warsaw
  v_today_warsaw := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  IF v_earned_date IS DISTINCT FROM v_today_warsaw THEN
    v_earned_today := 0;
    UPDATE profiles SET market_earned_today = 0, market_earned_date = v_today_warsaw WHERE id = v_uid;
  END IF;

  IF v_daily_limit IS NOT NULL AND v_earned_today >= v_daily_limit THEN
    RETURN jsonb_build_object('error', 'Osiągnąłeś dzienny limit zarobku z targu. Spróbuj jutro po północy (czas polski).');
  END IF;

  -- ── Policz aktywne oferty gracza ──────────────────────────────────────────
  SELECT COUNT(*), COALESCE(SUM(quantity * price_per_unit), 0)
  INTO   v_active_count, v_active_val
  FROM   market_offers
  WHERE  seller_id = v_uid
    AND  status    = 'active';

  -- ── Sprawdź czy można scalić (tylko dla typów innych niż equipment) ───────
  IF p_item_type <> 'equipment' THEN
    SELECT id INTO v_existing_id
    FROM   market_offers
    WHERE  seller_id      = v_uid
      AND  status         = 'active'
      AND  item_type      = p_item_type
      AND  item_key       = p_item_key
      AND  price_per_unit = p_price_per_unit
      AND  duration_hours = p_duration_hours
      AND  COALESCE(unlock_level, 1) = GREATEST(1, p_unlock_level)
      AND  expires_at     > now()
    LIMIT 1;
  END IF;

  -- ── Scalenie: zwiększ quantity istniejącej oferty ─────────────────────────
  IF v_existing_id IS NOT NULL THEN
    IF v_active_val_lim IS NOT NULL
       AND (v_active_val + p_quantity * p_price_per_unit) > v_active_val_lim THEN
      RETURN jsonb_build_object('error',
        'Przekroczyłbyś limit łącznej wartości aktywnych ofert (' || v_active_val_lim::text || ' zł).');
    END IF;

    UPDATE market_offers
    SET    quantity = quantity + p_quantity
    WHERE  id = v_existing_id;

    RETURN jsonb_build_object('success', true, 'merged', true, 'offer_id', v_existing_id);
  END IF;

  -- ── Nowa oferta: sprawdź limit slotów ────────────────────────────────────
  IF v_active_count >= v_max_offers THEN
    RETURN jsonb_build_object('error',
      'Osiągnąłeś limit aktywnych ofert (' || v_max_offers::text || '). Anuluj lub poczekaj na sprzedaż.');
  END IF;

  IF v_active_val_lim IS NOT NULL
     AND (v_active_val + p_quantity * p_price_per_unit) > v_active_val_lim THEN
    RETURN jsonb_build_object('error',
      'Przekroczyłbyś limit łącznej wartości aktywnych ofert (' || v_active_val_lim::text || ' zł).');
  END IF;

  -- ── Opłata za wystawienie 48h / 72h ──────────────────────────────────────
  IF p_duration_hours = 48 THEN
    v_listing_fee := ROUND(p_quantity * p_price_per_unit * 0.03, 2);
  ELSIF p_duration_hours = 72 THEN
    v_listing_fee := ROUND(p_quantity * p_price_per_unit * 0.07, 2);
  END IF;

  IF v_listing_fee > 0 THEN
    UPDATE profiles SET money = money - v_listing_fee WHERE id = v_uid AND money >= v_listing_fee;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error',
        'Za mało złota na opłatę ' || p_duration_hours || 'h (' || v_listing_fee || ' zł).');
    END IF;
  END IF;

  -- ── INSERT nowej oferty ───────────────────────────────────────────────────
  v_expires_at := now() + (p_duration_hours || ' hours')::interval;

  INSERT INTO market_offers (
    seller_id, item_type, item_key, item_name, item_icon,
    quantity, price_per_unit, duration_hours, status,
    expires_at, unlock_level
  ) VALUES (
    v_uid, p_item_type, p_item_key, p_item_name, p_item_icon,
    p_quantity, p_price_per_unit, p_duration_hours, 'active',
    v_expires_at, GREATEST(1, p_unlock_level)
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'merged', false, 'offer_id', v_new_id);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 2. market_buy_offer — dynamiczny patch blokady testera
--
--    Ten blok DO automatycznie:
--    a) pobiera obecną definicję market_buy_offer z Supabase,
--    b) wstrzykuje blokadę po pierwszym END IF (auth check),
--    c) wywołuje CREATE OR REPLACE z patchowaną funkcją.
--
--    Nie wymaga ręcznej edycji. Jeśli blokada już istnieje,
--    skrypt wypisze NOTICE i nie wykona żadnych zmian.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def        text;
  v_marker     text := 'END IF;';
  v_inject     text := E'END IF;\n\n  -- blokada tester (role)\n  IF (SELECT role FROM profiles WHERE id = auth.uid()) = ''tester'' THEN\n    RETURN jsonb_build_object(''error'', ''Targ jest zablokowany dla tego konta.'');\n  END IF;';
  v_pos        integer;
BEGIN
  -- Pobierz definicję
  SELECT pg_get_functiondef(oid)
  INTO   v_def
  FROM   pg_proc
  WHERE  proname = 'market_buy_offer'
  LIMIT  1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Funkcja market_buy_offer nie istnieje w tej bazie!';
  END IF;

  -- Idempotentność: nie patchuj dwa razy
  IF v_def LIKE '%blokada tester%' THEN
    RAISE NOTICE 'market_buy_offer: blokada testera już istnieje — pomijam.';
    RETURN;
  END IF;

  -- Wstrzyknij blokadę po pierwszym END IF; (auth check)
  v_pos := position(v_marker IN v_def);
  IF v_pos = 0 THEN
    RAISE EXCEPTION 'Nie znaleziono END IF w market_buy_offer — skontaktuj się z deweloperem.';
  END IF;

  v_def :=
    left(v_def, v_pos - 1)
    || v_inject
    || right(v_def, -(v_pos - 1 + length(v_marker)));

  EXECUTE v_def;

  RAISE NOTICE 'market_buy_offer: blokada testera dodana pomyślnie.';
END;
$$;


-- ────────────────────────────────────────────────────────────
-- WERYFIKACJA (opcjonalne — uruchom oddzielnie po wgraniu)
-- ────────────────────────────────────────────────────────────
--
-- Sprawdź że blokada jest w obu funkcjach:
-- SELECT proname, prosrc
-- FROM   pg_proc
-- WHERE  proname IN ('market_create_offer','market_buy_offer')
--   AND  prosrc LIKE '%blokada tester%';
--
-- Powinny pojawić się 2 wiersze.
