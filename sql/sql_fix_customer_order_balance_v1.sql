-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: BALANS ZAMÓWIEŃ NPC — v1
-- ───────────────────────────────────────────────────────────────────────────
-- Problemy (wg audytu):
--   1. Hurtownia/market_chain/distribution_center/international mogły pojawić
--      się już na lvl 1 (brak twardego progu poziomu).
--   2. _npc_crop_qty_range 'good'+'low' = 10–40 za dużo dla początkującego.
--   3. spawn_customer_order nie wywołuje _npc_merge_items() (regresja po
--      sql_lada_npc_bonus_no_duplicate.sql).
--
-- Zmiany:
--   A. _npc_customer_types() — dodaje kolumnę min_level (twardy próg levelu)
--   B. spawn_customer_order — filtruje typy wg min_level + przywraca merge
--   C. _npc_crop_qty_range  — good+low: 10–40 → 3–10
--
-- Nie zmienia:
--   • complete_customer_order (ani etap2 ani etap3 wersji)
--   • tick_customer_orders
--   • _npc_pick_item
--   • _npc_lvl_weight
--   • _npc_roll_bonus
--   • frontend / Game.tsx
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── A. _npc_customer_types() — dodano min_level ──────────────────────────
-- Postgres nie pozwala OR REPLACE gdy zmienia się liczba kolumn zwracanej
-- tabeli, dlatego najpierw DROP, potem CREATE.

DROP FUNCTION IF EXISTS _npc_customer_types();

CREATE OR REPLACE FUNCTION _npc_customer_types()
RETURNS TABLE(
  ctype          TEXT,
  min_level      INT,      -- ◆ NOWE: twardy próg — typ nie pojawi się poniżej
  weight_min     NUMERIC,  -- waga przy lvl = min_level
  weight_max     NUMERIC,  -- waga przy lvl ≥ 25
  mult           NUMERIC,
  items_min      INT,
  items_max      INT,
  expires_h      INT,
  bonus_chance   NUMERIC,
  bonus_strength TEXT
)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
  --                             min  waga_min  waga_max  mult  imin imax exp_h  bc    strength
    ('neighbor',                  1,   35.0,     5.0,    1.00,  1,   1,   12,  0.05, 'small'),
    ('village_guest',             1,   25.0,     8.0,    1.15,  1,   2,   16,  0.08, 'small'),
    ('small_market',              3,   15.0,    12.0,    1.35,  2,   3,   20,  0.12, 'small_med'),
    ('village_shop',              5,   10.0,    13.0,    1.60,  3,   4,   24,  0.18, 'medium'),
    ('restaurant',                8,    7.0,    13.0,    2.00,  4,   5,   30,  0.25, 'medium'),
    ('wholesaler',               12,    4.0,    14.0,    2.50,  5,   6,   36,  0.40, 'med_big'),
    ('market_chain',             16,    2.0,    14.0,    3.20,  6,   8,   42,  0.60, 'big'),
    ('distribution_center',      20,    1.5,    12.0,    4.00,  7,   9,   48,  0.80, 'big'),
    ('international_contract',   25,    0.5,     9.0,    5.00,  8,  10,   48,  1.00, 'premium')
  ) AS t(ctype, min_level, weight_min, weight_max, mult, items_min, items_max,
         expires_h, bonus_chance, bonus_strength);
$$;

GRANT EXECUTE ON FUNCTION _npc_customer_types() TO anon, authenticated;

-- ─── Aktualizacja debug_npc_weights — dostosowanie do nowej sygnatury ─────
-- Pomija typy zablokowane dla danego poziomu (min_level > p_level).
CREATE OR REPLACE FUNCTION debug_npc_weights(p_level INT)
RETURNS TABLE(ctype TEXT, min_level INT, weight NUMERIC, percent NUMERIC)
LANGUAGE SQL STABLE AS $$
  WITH w AS (
    SELECT t.ctype,
           t.min_level,
           CASE WHEN t.min_level <= p_level
                THEN _npc_lvl_weight(p_level, t.weight_min, t.weight_max)
                ELSE 0
           END AS w
      FROM _npc_customer_types() t
  ), s AS (SELECT GREATEST(sum(w), 0.0001) AS total FROM w)
  SELECT w.ctype,
         w.min_level,
         round(w.w, 3),
         round(w.w / s.total * 100, 2)
    FROM w, s
    ORDER BY w.w DESC;
$$;

GRANT EXECUTE ON FUNCTION debug_npc_weights(INT) TO anon, authenticated;


-- ─── B. spawn_customer_order — filtr min_level + przywrócenie merge ────────
CREATE OR REPLACE FUNCTION spawn_customer_order(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level        INT;
  v_types_id     TEXT[];
  v_types_w      NUMERIC[];
  v_ctype        TEXT;
  v_t            RECORD;
  v_n_items      INT;
  v_items        JSONB := '[]'::JSONB;
  v_total        NUMERIC := 0;
  v_pick         RECORD;
  v_gold         NUMERIC;
  v_exp          INT;
  v_bonus        JSONB;
  v_bonus_id     TEXT;
  v_rewards      JSONB;
  v_order_id     UUID;
  v_existing_ids JSONB := '[]'::JSONB;
  v_attempts     INT;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(level, 1) INTO v_level FROM profiles WHERE id = p_user_id;
  IF v_level IS NULL THEN RETURN NULL; END IF;

  -- ◆ ZMIANA: tylko typy z min_level <= v_level są kandydatami
  SELECT array_agg(ctype ORDER BY ctype),
         array_agg(_npc_lvl_weight(v_level, weight_min, weight_max) ORDER BY ctype)
    INTO v_types_id, v_types_w
    FROM _npc_customer_types()
    WHERE min_level <= v_level;

  -- Brak dostępnych typów (edge case: nie powinno się zdarzyć bo neighbor=1)
  IF v_types_id IS NULL OR array_length(v_types_id, 1) = 0 THEN
    RETURN NULL;
  END IF;

  v_ctype := _npc_weighted_pick_text(v_types_id, v_types_w);

  SELECT * INTO v_t FROM _npc_customer_types() WHERE ctype = v_ctype LIMIT 1;
  v_n_items := _npc_rand_int(v_t.items_min, v_t.items_max);

  -- Generuj N pozycji (anti-dup: max 10 prób na slot)
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
      'id',    v_pick.item_id,
      'qty',   v_pick.item_qty,
      'value', round(v_pick.item_value::NUMERIC, 2)
    );
    v_total := v_total + v_pick.item_value;
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN RETURN NULL; END IF;

  -- ◆ PRZYWRÓCONE: scal duplikaty po id (regresja z sql_lada_npc_bonus_no_duplicate)
  v_items := _npc_merge_items(v_items);

  v_gold := round((v_total * v_t.mult * 0.70)::NUMERIC, 2);
  v_exp  := round((v_total * v_t.mult * 0.03)::NUMERIC)::INT;

  -- Bonus (nie może pokrywać się z itemem z zamówienia)
  IF random() < v_t.bonus_chance THEN
    v_bonus := jsonb_build_array(_npc_roll_bonus(v_level, v_t.bonus_strength));
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

-- spawn_customer_order: brak GRANT — wywoływana tylko z tick przez SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION spawn_customer_order(UUID) FROM PUBLIC, anon, authenticated;


-- ─── C. _npc_crop_qty_range — early game good+low: 10–40 → 3–10 ───────────
-- Uzasadnienie: marchew=9.6 zł, plon ~5 szt./zbiór, lvl 1 = 1 działka.
-- Żądanie 10–40 szt. było nierealistyczne dla gracza lvl 1.
-- Pozostałe przedziały bez zmian.
CREATE OR REPLACE FUNCTION _npc_crop_qty_range(p_quality TEXT, p_unlock INT)
RETURNS TABLE(qmin INT, qmax INT) LANGUAGE SQL IMMUTABLE AS $$
  SELECT t.qmin, t.qmax FROM (VALUES
    --                                               PRZED → PO
    ('good',      'low',   3, 10),  -- ◆ zmiana: 10–40 → 3–10
    ('good',      'mid',   6, 20),  -- bez zmian
    ('good',      'high',  2,  8),  -- bez zmian
    ('epic',      'low',   4, 10),  -- bez zmian
    ('epic',      'mid',   2,  6),  -- bez zmian
    ('epic',      'high',  1,  3),  -- bez zmian
    ('legendary', 'low',   2,  5),  -- bez zmian
    ('legendary', 'mid',   1,  3),  -- bez zmian
    ('legendary', 'high',  1,  2)   -- bez zmian
  ) AS t(q, band, qmin, qmax)
  WHERE t.q = p_quality AND t.band = _npc_lvl_band(p_unlock);
$$;


-- ─── D. Cleanup: usuń zamówienia z typami powyżej progu dla aktualnego lvl ─
-- Usuwa AKTYWNE zamówienia, które zostały wygenerowane przed tym fixem
-- i dotyczą typów powyżej progu levelu gracza.
-- Bezpieczne — gracz straci tylko zamówienia, których nie powinien dostać.
DELETE FROM customer_orders co
WHERE co.expires_at > NOW()
  AND EXISTS (
    SELECT 1
      FROM _npc_customer_types() t
      JOIN profiles p ON p.id = co.user_id
     WHERE t.ctype = co.customer_type
       AND t.min_level > COALESCE(p.level, 1)
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA (uruchom ad hoc po wgraniu):
--
--   -- Rozkład typów dla lvl 1 (powinien mieć: neighbor, village_guest):
--   SELECT * FROM debug_npc_weights(1);
--
--   -- Rozkład dla lvl 5 (powinien dodać: small_market, village_shop):
--   SELECT * FROM debug_npc_weights(5);
--
--   -- Rozkład dla lvl 12 (dodaje wholesaler):
--   SELECT * FROM debug_npc_weights(12);
--
--   -- Zakres qty dla marchew_good (powinno być 3–10):
--   SELECT * FROM _npc_crop_qty_range('good', 1);
--
--   -- Ręczny spawn dla konkretnego gracza (zamień UUID):
--   SELECT spawn_customer_order('TWOJ_USER_ID'::UUID);
--   SELECT tick_customer_orders('TWOJ_USER_ID'::UUID);
-- ═══════════════════════════════════════════════════════════════════════════
