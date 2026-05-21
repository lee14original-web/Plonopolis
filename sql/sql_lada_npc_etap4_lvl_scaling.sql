-- ═══════════════════════════════════════════════════════════════════════════
-- PAKIET 4: SKALOWANIE WAGI TYPÓW KLIENTÓW OD LEVELU GRACZA
-- ───────────────────────────────────────────────────────────────────────────
-- Cel:
--   • Niski lvl  → częściej Sąsiad / Gość (małe zamówienia, łatwy start)
--   • Wysoki lvl → częściej Hurtownik / Sieć / Centrum / Międzynarodowy
--   • Endgame nie jest spamowany "oddaj 5 marchewek"
--
-- Krzywa:
--   factor = power( clamp((lvl - 1) / 24, 0..1), 0.7 )
--   waga   = waga_min + (waga_max - waga_min) * factor
--   ↳ na lvl 1  → factor=0    → waga_min  (rozkład bazowy)
--   ↳ na lvl 25 → factor=1    → waga_max  (rozkład endgame)
--   ↳ na lvl 10 → factor≈0.50 → ok połowa drogi (wykres lekko nieliniowy,
--                              żeby Sąsiad spadł z 35% do ~20% wg specyfikacji)
--
-- Bezpieczeństwo:
--   • Zmiana sygnatury _npc_customer_types() — DROP najpierw (Postgres nie pozwala
--     OR REPLACE jeśli zmienia się typ zwracany).
--   • spawn_customer_order odtworzony z nową logiką (reszta logiki bez zmian).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. NOWA TABLICA TYPÓW (waga_min, waga_max) ───────────────────────────
DROP FUNCTION IF EXISTS _npc_customer_types();

CREATE OR REPLACE FUNCTION _npc_customer_types()
RETURNS TABLE(
  ctype TEXT,
  weight_min NUMERIC,   -- waga przy lvl ≤ 1
  weight_max NUMERIC,   -- waga przy lvl ≥ 25
  mult NUMERIC,
  items_min INT, items_max INT, expires_h INT,
  bonus_chance NUMERIC, bonus_strength TEXT
)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    --                          waga_min  waga_max  mult  imin imax exp_h  bc    strength
    ('neighbor',                  35.0,     5.0,    1.00,  1,   1,   12,  0.05, 'small'),
    ('village_guest',             25.0,     8.0,    1.15,  1,   2,   16,  0.08, 'small'),
    ('small_market',              15.0,    12.0,    1.35,  2,   3,   20,  0.12, 'small_med'),
    ('village_shop',              10.0,    13.0,    1.60,  3,   4,   24,  0.18, 'medium'),
    ('restaurant',                 7.0,    13.0,    2.00,  4,   5,   30,  0.25, 'medium'),
    ('wholesaler',                 4.0,    14.0,    2.50,  5,   6,   36,  0.40, 'med_big'),
    ('market_chain',               2.0,    14.0,    3.20,  6,   8,   42,  0.60, 'big'),
    ('distribution_center',        1.5,    12.0,    4.00,  7,   9,   48,  0.80, 'big'),
    ('international_contract',     0.5,     9.0,    5.00,  8,  10,   48,  1.00, 'premium')
  ) AS t(ctype, weight_min, weight_max, mult, items_min, items_max, expires_h, bonus_chance, bonus_strength);
$$;

-- ─── 2. INTERPOLACJA WAGI WG LVL ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION _npc_lvl_weight(p_level INT, p_weight_min NUMERIC, p_weight_max NUMERIC)
RETURNS NUMERIC LANGUAGE SQL IMMUTABLE AS $$
  SELECT GREATEST(0.01,
    p_weight_min + (p_weight_max - p_weight_min) *
    power(LEAST(1.0, GREATEST(0.0, (COALESCE(p_level, 1) - 1)::NUMERIC / 24.0)), 0.7)
  );
$$;

-- ─── 3. SPAWN_CUSTOMER_ORDER (zaktualizowany — używa weight_min/weight_max) ─
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

GRANT EXECUTE ON FUNCTION _npc_lvl_weight(INT, NUMERIC, NUMERIC) TO anon, authenticated;

-- ─── 4. PODGLĄD: jakie szanse ma TWÓJ poziom? ─────────────────────────────
-- (uruchom ad hoc, zwraca rozkład procentowy dla danego lvl)
CREATE OR REPLACE FUNCTION debug_npc_weights(p_level INT)
RETURNS TABLE(ctype TEXT, weight NUMERIC, percent NUMERIC)
LANGUAGE SQL STABLE AS $$
  WITH w AS (
    SELECT t.ctype, _npc_lvl_weight(p_level, t.weight_min, t.weight_max) AS w
      FROM _npc_customer_types() t
  ), s AS (SELECT sum(w) AS total FROM w)
  SELECT w.ctype,
         round(w.w, 3),
         round(w.w / s.total * 100, 2)
    FROM w, s
    ORDER BY w.w DESC;
$$;

GRANT EXECUTE ON FUNCTION debug_npc_weights(INT) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST:
--   SELECT * FROM debug_npc_weights(1);    -- rozkład bazowy (Sąsiad ~35%)
--   SELECT * FROM debug_npc_weights(10);   -- środek (Sąsiad ~20%)
--   SELECT * FROM debug_npc_weights(20);   -- prawie endgame (Sąsiad ~10%)
--   SELECT * FROM debug_npc_weights(25);   -- endgame (Sąsiad ~5%)
-- ═══════════════════════════════════════════════════════════════════════════
