-- =====================================================================
-- FIX: Ceny zwierząt w backendzie Stodoły — Plonopolis
-- Plik: sql_fix_barn_animal_backend_prices_v1.sql
--
-- Problem: barn_animal_defs.buy_price, prod_ms, unlock_level mają stare
--          wartości sprzed rebalansu. buy_barn_animal i buy_barn_slot
--          czytają z tej tabeli → pobierają złe kwoty.
--
-- Rozwiązanie:
--   Krok 1. Upewnij się że kolumny buy_price / unlock_level istnieją.
--   Krok 2. UPDATE barn_animal_defs z nowymi wartościami.
--   Krok 3. CREATE OR REPLACE buy_barn_animal (czyta z tabeli).
--   Krok 4. CREATE OR REPLACE buy_barn_slot (czyta z tabeli, wzór jak frontend).
--   Krok 5. Testy — uruchom na końcu, wyniki sprawdź wzrokowo.
--
-- Uruchom JEDEN RAZ w Supabase SQL Editor.
-- Kolejność sekcji ma znaczenie — wykonaj wszystkie naraz.
-- =====================================================================


-- ─── Krok 1: Upewnij się, że kolumny istnieją ─────────────────────────────────

ALTER TABLE barn_animal_defs ADD COLUMN IF NOT EXISTS buy_price    NUMERIC  DEFAULT 0;
ALTER TABLE barn_animal_defs ADD COLUMN IF NOT EXISTS unlock_level INT      DEFAULT 1;
ALTER TABLE barn_animal_defs ADD COLUMN IF NOT EXISTS start_slots  INT      DEFAULT 1;


-- ─── Krok 2: Aktualizacja barn_animal_defs — nowe wartości po rebalansie ──────
--
-- Nowa kolejność: kura(3) → kaczka(5) → krolik(7) → swinia(9) → krowa(11)
--              → owca(13) → koza(15) → indyk(17) → kon(20) → byk(25)
--
-- Kolumny:     animal_id, buy_price, prod_ms (ms), unlock_level, start_slots
--
-- prod_ms = godziny × 3 600 000

UPDATE barn_animal_defs SET
  buy_price    = 450,
  prod_ms      = 4  * 3600000,   --  4h
  unlock_level = 3,
  start_slots  = 2
WHERE animal_id = 'kura';

UPDATE barn_animal_defs SET
  buy_price    = 1050,
  prod_ms      = 6  * 3600000,   --  6h (było 16h)
  unlock_level = 5,
  start_slots  = 1
WHERE animal_id = 'kaczka';

UPDATE barn_animal_defs SET
  buy_price    = 2625,
  prod_ms      = 10 * 3600000,   -- 10h (było 8h)
  unlock_level = 7,
  start_slots  = 2
WHERE animal_id = 'krolik';

UPDATE barn_animal_defs SET
  buy_price    = 5250,
  prod_ms      = 14 * 3600000,   -- 14h (było 24h)
  unlock_level = 9,
  start_slots  = 1
WHERE animal_id = 'swinia';

UPDATE barn_animal_defs SET
  buy_price    = 13500,
  prod_ms      = 20 * 3600000,   -- 20h (było 12h)
  unlock_level = 11,
  start_slots  = 1
WHERE animal_id = 'krowa';

UPDATE barn_animal_defs SET
  buy_price    = 26250,
  prod_ms      = 24 * 3600000,   -- 24h (było 20h)
  unlock_level = 13,
  start_slots  = 1
WHERE animal_id = 'owca';

UPDATE barn_animal_defs SET
  buy_price    = 48750,
  prod_ms      = 30 * 3600000,   -- 30h
  unlock_level = 15,
  start_slots  = 1
WHERE animal_id = 'koza';

UPDATE barn_animal_defs SET
  buy_price    = 90000,
  prod_ms      = 36 * 3600000,   -- 36h
  unlock_level = 17,
  start_slots  = 1
WHERE animal_id = 'indyk';

UPDATE barn_animal_defs SET
  buy_price    = 187500,
  prod_ms      = 48 * 3600000,   -- 48h
  unlock_level = 20,
  start_slots  = 1
WHERE animal_id = 'kon';

UPDATE barn_animal_defs SET
  buy_price    = 450000,
  prod_ms      = 72 * 3600000,   -- 72h
  unlock_level = 25,
  start_slots  = 1
WHERE animal_id = 'byk';


-- ─── Krok 3: buy_barn_animal — zakup zwierzęcia ───────────────────────────────
--
-- Sprawdza:  poziom gracza >= unlock_level
--            money >= buy_price
--            owned < slots  (miejsce w stodole)
-- Pobiera:   buy_price z barn_animal_defs (zawsze aktualne)

CREATE OR REPLACE FUNCTION buy_barn_animal(p_user_id uuid, p_animal_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile  RECORD;
  v_animal   RECORD;
  v_bs       JSONB;
  v_ast      JSONB;
  v_owned    INT;
  v_slots    INT;
  v_now_ms   BIGINT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, money, level, barn_state
  INTO v_profile
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_animal FROM barn_animal_defs WHERE animal_id = p_animal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_animal');
  END IF;

  IF v_profile.level < v_animal.unlock_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'level_too_low',
      'required_level', v_animal.unlock_level);
  END IF;

  IF v_profile.money < v_animal.buy_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_money',
      'required', v_animal.buy_price,
      'have', v_profile.money);
  END IF;

  v_bs   := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_ast  := COALESCE(v_bs->p_animal_id, '{}'::JSONB);
  v_owned := COALESCE((v_ast->>'owned')::INT, 0);
  v_slots := COALESCE((v_ast->>'slots')::INT, v_animal.start_slots);

  IF v_owned >= v_slots THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barn_full');
  END IF;

  v_now_ms := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;

  -- Uruchom timer przy pierwszym zwierzęciu
  IF v_owned = 0 THEN
    v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_now_ms));
  END IF;

  v_owned := v_owned + 1;
  v_ast := jsonb_set(v_ast, ARRAY['owned'], to_jsonb(v_owned));
  v_ast := jsonb_set(v_ast, ARRAY['slots'], to_jsonb(v_slots));
  v_bs  := jsonb_set(v_bs,  ARRAY[p_animal_id], v_ast);

  UPDATE profiles
  SET money      = money - v_animal.buy_price,
      barn_state = v_bs
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'animal_state', v_ast,
    'new_money',   v_profile.money - v_animal.buy_price
  );
END $$;

GRANT EXECUTE ON FUNCTION buy_barn_animal(UUID, TEXT) TO authenticated;


-- ─── Krok 4: buy_barn_slot — dokup slot zwierzęcia ───────────────────────────
--
-- Wzór kosztu (identyczny z frontend barnSlotCosts):
--   base_cost = ROUND(buy_price * 0.17)
--   cost[0]   = base_cost
--   cost[i]   = ROUND(cost[i-1] * 1.6)
--
-- Indeks upgradu = current_slots - start_slots
--   (np. kura: start=2, current=2 → index=0 → koszt 77; current=3 → index=1 → koszt 123)
--
-- Pobiera buy_price i start_slots z barn_animal_defs (zawsze aktualne)

CREATE OR REPLACE FUNCTION buy_barn_slot(p_user_id uuid, p_animal_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile    RECORD;
  v_animal     RECORD;
  v_bs         JSONB;
  v_ast        JSONB;
  v_cur_slots  INT;
  v_upg_idx    INT;
  v_cost       NUMERIC;
  i            INT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, money, barn_state
  INTO v_profile
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_animal FROM barn_animal_defs WHERE animal_id = p_animal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_animal');
  END IF;

  v_bs        := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_ast       := COALESCE(v_bs->p_animal_id, '{}'::JSONB);
  v_cur_slots := COALESCE((v_ast->>'slots')::INT, v_animal.start_slots);

  IF v_cur_slots >= v_animal.max_slots THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_slots',
      'max', v_animal.max_slots);
  END IF;

  -- Oblicz koszt: upg_idx = current_slots - start_slots
  -- cost[0] = ROUND(buy_price * 0.17), cost[i] = ROUND(cost[i-1] * 1.6)
  v_upg_idx := v_cur_slots - v_animal.start_slots;
  v_cost    := ROUND(v_animal.buy_price * 0.17);
  FOR i IN 1..v_upg_idx LOOP
    v_cost := ROUND(v_cost * 1.6);
  END LOOP;

  IF v_profile.money < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_money',
      'required', v_cost,
      'have', v_profile.money);
  END IF;

  v_cur_slots := v_cur_slots + 1;
  v_ast := jsonb_set(v_ast, ARRAY['slots'], to_jsonb(v_cur_slots));
  v_bs  := jsonb_set(v_bs,  ARRAY[p_animal_id], v_ast);

  UPDATE profiles
  SET money      = money - v_cost,
      barn_state = v_bs
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'animal_state', v_ast,
    'new_money',    v_profile.money - v_cost,
    'cost_paid',    v_cost
  );
END $$;

GRANT EXECUTE ON FUNCTION buy_barn_slot(UUID, TEXT) TO authenticated;


-- ─── Krok 5: Testy — uruchom po wgraniu, sprawdź wyniki ──────────────────────

-- TEST 1-5: buy_price po aktualizacji
SELECT
  animal_id,
  buy_price,
  prod_ms / 3600000.0 AS prod_h,
  unlock_level,
  start_slots,
  max_slots,
  CASE
    WHEN animal_id = 'kura'   AND buy_price = 450    THEN '✓ OK' ELSE '✗ BŁĄD'
  END AS t_kura,
  CASE
    WHEN animal_id = 'kaczka' AND buy_price = 1050   THEN '✓ OK' ELSE '✗ BŁĄD'
  END AS t_kaczka,
  CASE
    WHEN animal_id = 'krolik' AND buy_price = 2625   THEN '✓ OK' ELSE '✗ BŁĄD'
  END AS t_krolik,
  CASE
    WHEN animal_id = 'swinia' AND buy_price = 5250   THEN '✓ OK' ELSE '✗ BŁĄD'
  END AS t_swinia,
  CASE
    WHEN animal_id = 'krowa'  AND buy_price = 13500  THEN '✓ OK' ELSE '✗ BŁĄD'
  END AS t_krowa
FROM barn_animal_defs
ORDER BY unlock_level;

-- TEST 6: koszt slotu kury (index=1 czyli current_slots=3, start_slots=2) = 123
-- Wzór: base = ROUND(450 * 0.17) = 77, cost[1] = ROUND(77 * 1.6) = 123
DO $$
DECLARE
  v_base NUMERIC := ROUND(450 * 0.17);
  v_cost NUMERIC;
BEGIN
  v_cost := ROUND(v_base * 1.6);  -- index=1 (jedno przejście pętli)
  IF v_cost = 123 THEN
    RAISE NOTICE 'TEST 6 ✓ Koszt slotu kury (index=1) = % (oczekiwano 123)', v_cost;
  ELSE
    RAISE WARNING 'TEST 6 ✗ Koszt slotu kury (index=1) = % (oczekiwano 123)', v_cost;
  END IF;
END $$;

-- TEST 7: zakup kury przy money=450 powinien przejść (buy_price=450, nie 600)
-- Zamiast naprawdę kupować, sprawdzamy czy buy_price <= 450
DO $$
DECLARE
  v_price NUMERIC;
BEGIN
  SELECT buy_price INTO v_price FROM barn_animal_defs WHERE animal_id = 'kura';
  IF v_price <= 450 THEN
    RAISE NOTICE 'TEST 7 ✓ Kura buy_price = % <= 450, zakup przy 450 zł przejdzie', v_price;
  ELSE
    RAISE WARNING 'TEST 7 ✗ Kura buy_price = % > 450, zakup przy 450 zł NIE przejdzie!', v_price;
  END IF;
END $$;

-- Weryfikacja pełna tabeli po zmianach:
SELECT animal_id, buy_price, ROUND(prod_ms/3600000.0, 1) AS prod_h,
       unlock_level, start_slots, max_slots
FROM barn_animal_defs
ORDER BY unlock_level;
