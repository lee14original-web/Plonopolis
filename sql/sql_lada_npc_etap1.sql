-- ═══════════════════════════════════════════════════════════════════════════
-- LADA DLA KLIENTÓW — SYSTEM ZAMÓWIEŃ NPC
-- ETAP 1: Schemat DB + Generator + Spawner (server-side)
-- ═══════════════════════════════════════════════════════════════════════════
-- Idempotentny — można uruchomić wielokrotnie bezpiecznie.
--
-- Po wgraniu, klient wywołuje:
--   • SELECT * FROM tick_customer_orders(p_user_id);  -- co wejście do gry/lady
-- Zwraca aktualną listę zamówień (po cleanupie wygasłych i spawnie nowych).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. SCHEMAT ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_type   TEXT NOT NULL,
  items           JSONB NOT NULL,        -- [{"id":"carrot_good","qty":15}, ...]
  rewards         JSONB NOT NULL,        -- {"gold":1400, "exp":60, "bonus":[{...}]}
  total_value     NUMERIC NOT NULL DEFAULT 0,
  reward_mult     NUMERIC NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_orders_user_idx    ON customer_orders(user_id);
CREATE INDEX IF NOT EXISTS customer_orders_expires_idx ON customer_orders(expires_at);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_customer_spawn_at TIMESTAMPTZ;

-- ─── 2. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_orders_select_own ON customer_orders;
CREATE POLICY customer_orders_select_own ON customer_orders FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT/DELETE robione tylko przez funkcje SECURITY DEFINER (bez polityk dla anonów).

-- ─── 3. STAŁE KONFIGURACYJNE ──────────────────────────────────────────────
-- Czas między próbami spawnu nowego klienta (spec: 2h, można obniżyć do testów)
CREATE OR REPLACE FUNCTION _npc_spawn_interval_minutes() RETURNS INT
  LANGUAGE SQL IMMUTABLE AS $$ SELECT 120 $$;

-- Maksymalna liczba aktywnych klientów jednocześnie
CREATE OR REPLACE FUNCTION _npc_max_active() RETURNS INT
  LANGUAGE SQL IMMUTABLE AS $$ SELECT 5 $$;

-- ─── 4. POMOCNICZE — losowanie z wagami ───────────────────────────────────
CREATE OR REPLACE FUNCTION _npc_weighted_pick_text(p_items TEXT[], p_weights NUMERIC[])
RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  total NUMERIC; r NUMERIC; cum NUMERIC := 0; i INT; n INT;
BEGIN
  n := array_length(p_items, 1);
  IF n IS NULL OR n = 0 THEN RETURN NULL; END IF;
  IF array_length(p_weights, 1) IS DISTINCT FROM n THEN RETURN NULL; END IF;
  total := (SELECT sum(COALESCE(w, 0)) FROM unnest(p_weights) AS w);
  IF total IS NULL OR total <= 0 THEN RETURN NULL; END IF;
  r := random() * total;
  FOR i IN 1..n LOOP
    cum := cum + COALESCE(p_weights[i], 0);
    IF cum >= r THEN RETURN p_items[i]; END IF;
  END LOOP;
  RETURN p_items[n];
END $$;

-- Losowy int z zakresu [a, b]
CREATE OR REPLACE FUNCTION _npc_rand_int(a INT, b INT)
RETURNS INT LANGUAGE SQL VOLATILE AS $$
  SELECT a + floor(random() * (b - a + 1))::INT;
$$;

-- ─── 5. SŁOWNIKI ───────────────────────────────────────────────────────────
-- Uprawy: id, lvl odblokowania, cena bazowa (= cena nasiona × 3, plon ma ~3× wartość siewu)
CREATE OR REPLACE FUNCTION _npc_crops_data()
RETURNS TABLE(crop_id TEXT, unlock_lvl INT, base_price NUMERIC)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('carrot',1,9.6),('potato',2,14.4),('tomato',3,19.2),('cucumber',4,28.8),
    ('onion',5,43.2),('garlic',6,57.6),('lettuce',7,76.8),('radish',8,105.6),
    ('beet',9,144.0),('pepper',10,192.0),('cabbage',11,264.0),('broccoli',12,360.0),
    ('cauliflower',13,480.0),('strawberry',14,624.0),('raspberry',15,816.0),
    ('blueberry',16,1056.0),('eggplant',17,1344.0),('zucchini',18,1728.0),
    ('watermelon',19,2160.0),('grape',20,2640.0),('pumpkin',21,3120.0),
    ('rapeseed',22,3600.0),('sunflower',23,4320.0),('chili',24,5280.0),
    ('asparagus',25,6720.0)
  ) AS t(crop_id, unlock_lvl, base_price);
$$;

-- Drzewa/owoce: id, lvl, cena owocu zwykłego
CREATE OR REPLACE FUNCTION _npc_fruits_data()
RETURNS TABLE(fruit_id TEXT, unlock_lvl INT, base_price NUMERIC)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('jablko',10,20.0),('gruszka',12,35.0),('sliwka',14,55.0),('wisnia',16,80.0),
    ('czeresnia',18,110.0),('brzoskwinia',20,150.0),('morela',22,220.0),
    ('pomarancza',23,320.0),('cytryna',25,500.0)
  ) AS t(fruit_id, unlock_lvl, base_price);
$$;

-- Produkty zwierzęce M1–M10
CREATE OR REPLACE FUNCTION _npc_animal_data()
RETURNS TABLE(item_id TEXT, unlock_lvl INT, base_price NUMERIC, qty_min INT, qty_max INT)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('jajko',3,40.0,5,20),
    ('futro_krolika',5,80.0,3,10),
    ('mleko',7,140.0,3,10),
    ('piora',9,220.0,4,12),
    ('welna',11,320.0,2,8),
    ('nawoz_naturalny',13,450.0,3,10),
    ('mleko_kozie',15,650.0,2,6),
    ('duze_piora',17,900.0,1,4),
    ('energia_robocza',20,1400.0,1,3),
    ('rogi_byka',25,2500.0,1,2)
  ) AS t(item_id, unlock_lvl, base_price, qty_min, qty_max);
$$;

-- Komposty: 3 typy × 3 tiery (Słaby/Średni/Mocny)
CREATE OR REPLACE FUNCTION _npc_compost_data()
RETURNS TABLE(item_id TEXT, base_price NUMERIC, qty_min INT, qty_max INT)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('compost_growth_5',150.0,2,6),  ('compost_growth_10',400.0,1,4),  ('compost_growth_15',900.0,1,2),
    ('compost_yield_1',150.0,2,6),   ('compost_yield_2',400.0,1,4),    ('compost_yield_3',900.0,1,2),
    ('compost_exp_10',150.0,2,6),    ('compost_exp_20',400.0,1,4),     ('compost_exp_30',900.0,1,2)
  ) AS t(item_id, base_price, qty_min, qty_max);
$$;

-- Typy klientów
CREATE OR REPLACE FUNCTION _npc_customer_types()
RETURNS TABLE(
  ctype TEXT, weight NUMERIC, mult NUMERIC,
  items_min INT, items_max INT, expires_h INT,
  bonus_chance NUMERIC, bonus_strength TEXT
)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('neighbor',              35.0, 1.00, 1, 1,  12, 0.05, 'small'),
    ('village_guest',         25.0, 1.15, 1, 2,  16, 0.08, 'small'),
    ('small_market',          15.0, 1.35, 2, 3,  20, 0.12, 'small_med'),
    ('village_shop',          10.0, 1.60, 3, 4,  24, 0.18, 'medium'),
    ('restaurant',             7.0, 2.00, 4, 5,  30, 0.25, 'medium'),
    ('wholesaler',             4.0, 2.50, 5, 6,  36, 0.40, 'med_big'),
    ('market_chain',           2.0, 3.20, 6, 8,  42, 0.60, 'big'),
    ('distribution_center',    1.5, 4.00, 7, 9,  48, 0.80, 'big'),
    ('international_contract', 0.5, 5.00, 8,10,  48, 1.00, 'premium')
  ) AS t(ctype, weight, mult, items_min, items_max, expires_h, bonus_chance, bonus_strength);
$$;

-- ─── 6. POMOC: kategoria poziomowa (low/mid/high) dla zakresu ilości ──────
CREATE OR REPLACE FUNCTION _npc_lvl_band(p_unlock INT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE WHEN p_unlock <= 8 THEN 'low'
              WHEN p_unlock <= 16 THEN 'mid'
              ELSE 'high' END;
$$;

-- Zakres ilości dla uprawy wg jakości i poziomu
CREATE OR REPLACE FUNCTION _npc_crop_qty_range(p_quality TEXT, p_unlock INT)
RETURNS TABLE(qmin INT, qmax INT) LANGUAGE SQL IMMUTABLE AS $$
  SELECT t.qmin, t.qmax FROM (VALUES
    ('good',      'low',  10, 40),
    ('good',      'mid',   6, 20),
    ('good',      'high',  2,  8),
    ('epic',      'low',   4, 10),
    ('epic',      'mid',   2,  6),
    ('epic',      'high',  1,  3),
    ('legendary', 'low',   2,  5),
    ('legendary', 'mid',   1,  3),
    ('legendary', 'high',  1,  2)
  ) AS t(q, band, qmin, qmax)
  WHERE t.q = p_quality AND t.band = _npc_lvl_band(p_unlock);
$$;

-- Zakres ilości dla owocu wg jakości i poziomu (low=10-16, high=17-25)
CREATE OR REPLACE FUNCTION _npc_fruit_qty_range(p_quality TEXT, p_unlock INT)
RETURNS TABLE(qmin INT, qmax INT) LANGUAGE SQL IMMUTABLE AS $$
  SELECT t.qmin, t.qmax FROM (VALUES
    ('zwykly',   'low',  6, 20), ('zwykly',   'high', 1, 6),
    ('soczysty', 'low',  3,  8), ('soczysty', 'high', 1, 3),
    ('zloty',    'low',  1,  3), ('zloty',    'high', 1, 1)
  ) AS t(q, band, qmin, qmax)
  WHERE t.q = p_quality AND t.band = (CASE WHEN p_unlock <= 16 THEN 'low' ELSE 'high' END);
$$;

-- Mnożnik wartości jakości
CREATE OR REPLACE FUNCTION _npc_quality_mult(p_q TEXT)
RETURNS NUMERIC LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_q
    WHEN 'good' THEN 1.0
    WHEN 'epic' THEN 2.5
    WHEN 'legendary' THEN 5.0
    WHEN 'zwykly' THEN 1.0
    WHEN 'soczysty' THEN 2.0
    WHEN 'zloty' THEN 5.0
    ELSE 1.0
  END;
$$;

-- ─── 7. GENEROWANIE POJEDYNCZEJ POZYCJI ZAMÓWIENIA ────────────────────────
-- Zwraca: id (klucz inventory np. "carrot_good"), qty, value
CREATE OR REPLACE FUNCTION _npc_pick_item(p_level INT)
RETURNS TABLE(item_id TEXT, item_qty INT, item_value NUMERIC)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_categories TEXT[] := ARRAY['crop','fruit','animal','honey','compost'];
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
  -- Wagi kategorii (uprawy najczęściej, miód/kompost rzadko)
  -- Owoce/zwierzęta tylko jeśli odblokowane
  v_weights := ARRAY[
    50.0,                                          -- crop
    CASE WHEN p_level >= 10 THEN 25.0 ELSE 0 END,  -- fruit
    CASE WHEN p_level >=  3 THEN 30.0 ELSE 0 END,  -- animal
    8.0,                                           -- honey
    7.0                                            -- compost
  ];
  v_cat := _npc_weighted_pick_text(v_categories, v_weights);

  IF v_cat IS NULL THEN RETURN; END IF;

  IF v_cat = 'crop' THEN
    -- Wylosuj odblokowaną uprawę
    SELECT crop_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_crops_data() WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.crop_id IS NULL THEN RETURN; END IF;
    -- Jakość: 75% good, 20% epic, 5% legendary
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

  ELSIF v_cat = 'honey' THEN
    v_qty := _npc_rand_int(1, 8);
    RETURN QUERY SELECT 'honey_jar'::TEXT, v_qty, 12.0 * v_qty;

  ELSE -- compost
    SELECT c.item_id, c.base_price, c.qty_min, c.qty_max INTO v_chosen
      FROM _npc_compost_data() c ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.item_id IS NULL THEN RETURN; END IF;
    v_qty := _npc_rand_int(v_chosen.qty_min, v_chosen.qty_max);
    RETURN QUERY SELECT v_chosen.item_id, v_qty, v_chosen.base_price * v_qty;
  END IF;
END $$;

-- ─── 8. GENEROWANIE BONUSU ────────────────────────────────────────────────
-- Strength: 'small' | 'small_med' | 'medium' | 'med_big' | 'big' | 'premium'
CREATE OR REPLACE FUNCTION _npc_roll_bonus(p_level INT, p_strength TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_pool TEXT[];
  v_pool_q NUMERIC[];
  v_pick TEXT;
  v_qty INT;
  v_animal RECORD;
BEGIN
  -- Pula bazowa: produkty zwierząt M1-M10 (tylko odblokowane), kompost (zawsze), losowy item
  -- Skala ilości zależy od strength
  CASE p_strength
    WHEN 'small'     THEN v_qty := _npc_rand_int(1, 1);
    WHEN 'small_med' THEN v_qty := _npc_rand_int(1, 2);
    WHEN 'medium'    THEN v_qty := _npc_rand_int(1, 3);
    WHEN 'med_big'   THEN v_qty := _npc_rand_int(2, 4);
    WHEN 'big'       THEN v_qty := _npc_rand_int(3, 6);
    WHEN 'premium'   THEN v_qty := _npc_rand_int(5, 10);
    ELSE v_qty := 1;
  END CASE;

  -- 60% szans: produkt zwierzęcy, 30% kompost, 10% losowy item (epic uprawa)
  v_pool := ARRAY['animal','compost','random_item'];
  v_pool_q := ARRAY[60.0, 30.0, 10.0];
  v_pick := _npc_weighted_pick_text(v_pool, v_pool_q);

  IF v_pick = 'animal' THEN
    -- Tylko odblokowane produkty zwierząt; dla wyższych strength preferuj wyższe tiery
    SELECT a.item_id INTO v_pick
      FROM _npc_animal_data() a WHERE a.unlock_lvl <= p_level
      ORDER BY random() * CASE WHEN p_strength IN ('big','premium') THEN a.unlock_lvl ELSE 1 END DESC
      LIMIT 1;
    IF v_pick IS NULL THEN v_pick := 'jajko'; END IF;
    RETURN jsonb_build_object('type','animal','id',v_pick,'qty',v_qty);

  ELSIF v_pick = 'compost' THEN
    -- Tier kompostu wg strength
    IF p_strength IN ('big','premium') THEN
      v_pick := _npc_weighted_pick_text(
        ARRAY['compost_growth_15','compost_yield_3','compost_exp_30'],
        ARRAY[1.0,1.0,1.0]);
      v_qty := GREATEST(1, v_qty / 2);  -- mocny kompost = mniejsza ilość
    ELSIF p_strength IN ('medium','med_big') THEN
      v_pick := _npc_weighted_pick_text(
        ARRAY['compost_growth_10','compost_yield_2','compost_exp_20'],
        ARRAY[1.0,1.0,1.0]);
    ELSE
      v_pick := _npc_weighted_pick_text(
        ARRAY['compost_growth_5','compost_yield_1','compost_exp_10'],
        ARRAY[1.0,1.0,1.0]);
    END IF;
    RETURN jsonb_build_object('type','compost','id',v_pick,'qty',v_qty);

  ELSE -- random_item: epic/legendary uprawa odblokowana
    SELECT crop_id INTO v_pick FROM _npc_crops_data()
      WHERE unlock_lvl <= p_level ORDER BY random() LIMIT 1;
    IF v_pick IS NULL THEN
      RETURN jsonb_build_object('type','animal','id','jajko','qty',v_qty);
    END IF;
    -- premium → legendary, big → epic, reszta → epic
    IF p_strength = 'premium' THEN
      v_pick := v_pick || '_legendary';
      v_qty := GREATEST(1, v_qty / 3);
    ELSE
      v_pick := v_pick || '_epic';
      v_qty := GREATEST(1, v_qty / 2);
    END IF;
    RETURN jsonb_build_object('type','crop','id',v_pick,'qty',v_qty);
  END IF;
END $$;

-- ─── 9. GENEROWANIE CAŁEGO ZAMÓWIENIA ─────────────────────────────────────
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
  v_existing JSONB;
  v_existing_ids JSONB := '[]'::JSONB;
  v_attempts INT;
BEGIN
  -- Walidacja: tylko właściciel LUB wywołanie z innej funkcji SECURITY DEFINER (auth.uid()=NULL w kontekście service)
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Pobierz lvl gracza
  SELECT COALESCE(level, 1) INTO v_level FROM profiles WHERE id = p_user_id;
  IF v_level IS NULL THEN RETURN NULL; END IF;

  -- Wylosuj typ klienta
  SELECT array_agg(ctype ORDER BY ctype), array_agg(weight ORDER BY ctype)
    INTO v_types_id, v_types_w FROM _npc_customer_types();
  v_ctype := _npc_weighted_pick_text(v_types_id, v_types_w);

  -- Pobierz parametry typu
  SELECT * INTO v_t FROM _npc_customer_types() WHERE ctype = v_ctype LIMIT 1;
  v_n_items := _npc_rand_int(v_t.items_min, v_t.items_max);

  -- Generuj N pozycji (bez duplikatów ID — max 10 prób na pozycję)
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

  -- Brak pozycji = anuluj
  IF jsonb_array_length(v_items) = 0 THEN RETURN NULL; END IF;

  -- Oblicz nagrody
  v_gold := round((v_total * v_t.mult * 0.70)::NUMERIC, 2);
  v_exp  := round((v_total * v_t.mult * 0.03)::NUMERIC)::INT;  -- 0.30 / 10

  -- Bonus (z szansą)
  IF random() < v_t.bonus_chance THEN
    v_bonus := jsonb_build_array(_npc_roll_bonus(v_level, v_t.bonus_strength));
  ELSE
    v_bonus := '[]'::JSONB;
  END IF;

  v_rewards := jsonb_build_object('gold', v_gold, 'exp', v_exp, 'bonus', v_bonus);

  -- Wstaw zamówienie
  INSERT INTO customer_orders(user_id, customer_type, items, rewards, total_value, reward_mult, expires_at)
    VALUES (p_user_id, v_ctype, v_items, v_rewards,
            round(v_total::NUMERIC, 2), v_t.mult,
            NOW() + (v_t.expires_h || ' hours')::INTERVAL)
    RETURNING id INTO v_order_id;

  RETURN v_order_id;
END $$;

-- ─── 10. TICK: cleanup wygasłych + spawn nowych + zwrot listy ─────────────
CREATE OR REPLACE FUNCTION tick_customer_orders(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last         TIMESTAMPTZ;
  v_active       INT;
  v_max          INT := _npc_max_active();
  v_interval     INT := _npc_spawn_interval_minutes();
  v_passed       INT;     -- ile pełnych interwałów minęło
  v_to_spawn     INT;
  v_real_spawned INT := 0;
  v_now          TIMESTAMPTZ := NOW();
  v_orders       JSONB;
  v_oid          UUID;
BEGIN
  -- Walidacja właściciela
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 1. Usuń wygasłe
  DELETE FROM customer_orders WHERE user_id = p_user_id AND expires_at <= v_now;

  -- 2. Pobierz last_customer_spawn_at z BLOKADĄ wiersza (anty-wyścig równoległych ticków)
  SELECT last_customer_spawn_at INTO v_last FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_last IS NULL THEN
    v_last := v_now - (v_interval || ' minutes')::INTERVAL; -- pozwól od razu na 1 spawn
    UPDATE profiles SET last_customer_spawn_at = v_last WHERE id = p_user_id;
  END IF;

  -- 3. Sprawdź ile aktywnych (po cleanupie)
  SELECT COUNT(*) INTO v_active FROM customer_orders WHERE user_id = p_user_id;

  -- 4. Oblicz ile interwałów minęło i ilu trzeba spawnować
  v_passed := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_last)) / 60 / v_interval)::INT);
  v_to_spawn := LEAST(v_passed, v_max - v_active);

  IF v_to_spawn > 0 THEN
    FOR i IN 1..v_to_spawn LOOP
      v_oid := spawn_customer_order(p_user_id);
      IF v_oid IS NOT NULL THEN v_real_spawned := v_real_spawned + 1; END IF;
    END LOOP;
    -- Update tylko o tyle interwałów ile faktycznie utworzonych zamówień
    IF v_real_spawned > 0 THEN
      UPDATE profiles SET last_customer_spawn_at = v_last + (v_real_spawned * v_interval || ' minutes')::INTERVAL
        WHERE id = p_user_id;
    END IF;
  END IF;

  -- 5. Zwróć aktualną listę zamówień
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'customer_type', customer_type,
      'items', items,
      'rewards', rewards,
      'total_value', total_value,
      'reward_mult', reward_mult,
      'created_at', created_at,
      'expires_at', expires_at
    ) ORDER BY created_at
  ), '[]'::JSONB) INTO v_orders
    FROM customer_orders WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'orders', v_orders,
    'spawned', v_real_spawned,
    'active', v_active + v_real_spawned,
    'max', v_max,
    'next_spawn_at', (v_last + ((v_real_spawned + 1) * v_interval || ' minutes')::INTERVAL)
  );
END $$;

-- ─── 11. UPRAWNIENIA ──────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION tick_customer_orders(UUID) TO anon, authenticated;
-- spawn_customer_order: brak GRANT — wywoływana tylko z tick (przez SECURITY DEFINER bypass)
REVOKE EXECUTE ON FUNCTION spawn_customer_order(UUID) FROM PUBLIC, anon, authenticated;
-- (helper'y _npc_* nie mają GRANT — dostępne tylko wewnątrz funkcji SECURITY DEFINER)

-- ═══════════════════════════════════════════════════════════════════════════
-- KONIEC ETAPU 1
-- Test: SELECT tick_customer_orders('TWOJE_USER_ID'::UUID);
-- ═══════════════════════════════════════════════════════════════════════════
