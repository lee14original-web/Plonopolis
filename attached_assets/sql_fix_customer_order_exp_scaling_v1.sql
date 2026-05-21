-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: SKALOWANIE EXP W LADZIE NPC — v1
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   Formuła v_exp = GREATEST(1, round(v_total * mult * 0.05)) daje absurdalnie
--   mało EXP na wysokich levelach, gdzie xp_to_next_level jest bardzo duże.
--
--   Przykład lvl 28 (xp_to_next = 620 000):
--     oferty: 38 EXP, 44 EXP, 307 EXP
--     to 0.006%, 0.007%, 0.050% xp_to_next → praktycznie nic
--
-- Progi xp_to_next_level (z game_xp_to_next_level):
--   lvl  1:        12
--   lvl  5:       600
--   lvl 10:     5 500
--   lvl 20:   400 000
--   lvl 28: 6 200 000
--   lvl 30: 11 500 000
--
-- Rozwiązanie:
--   Zachowamy stary base_exp (v_total × mult × 0.05), ale dodamy minimalny EXP
--   zależny od TYPU KLIENTA i xp_to_next_level gracza w momencie spawnu.
--   final_exp = GREATEST(base_exp, xp_to_next_level × min_exp_pct)
--
-- min_exp_pct per typ klienta:
--   neighbor               0.01%   (najtańszy, najczęstszy → mały, ale nie 0)
--   village_guest          0.015%
--   small_market           0.025%
--   village_shop           0.040%
--   restaurant             0.060%
--   wholesaler             0.100%
--   market_chain           0.140%
--   distribution_center    0.180%
--   international_contract 0.250%  (najdroższy, najrzadszy → sensowna nagroda)
--
-- Porównanie przed/po dla lvl 28 (xp_to_next = 620 000):
-- ─────────────────────────────────────────────────────────────────────────────
--
--  Scenariusz          typ               total  mult  PRZED       PO
--  ─────────────────────────────────────────────────────────────────────────
--  mała oferta         neighbor          200    1.00  10 EXP  →   62 EXP
--  mała oferta         neighbor          760    1.00  38 EXP  →   62 EXP  ← min wins
--  mała oferta         village_guest     880    1.15  50 EXP  →   93 EXP  ← min wins
--  średnia oferta      small_market     2000    1.35 135 EXP  →  155 EXP  ← min wins
--  średnia oferta      restaurant       2000    2.00 200 EXP  →  372 EXP  ← min wins
--  średnia oferta      wholesaler       2000    2.50 250 EXP  →  620 EXP  ← min wins
--  duża oferta         wholesaler      20000    2.50 2500 EXP → 2500 EXP  ← base wins
--  duża oferta         market_chain    20000    3.20 3200 EXP → 3200 EXP  ← base wins
--  duża oferta         int. contract   20000    5.00 5000 EXP → 5000 EXP  ← base wins
--  bardzo duża oferta  int. contract   50000    5.00 12500 EXP →12500 EXP ← base wins
--
--  Kluczowe: min_exp wchodzi tylko gdy base_exp jest za małe (mało itemów).
--  Duże zamówienia nadal bazują na wartości itemów — bez inflacji EXP.
--
-- Zmienia:
--   • spawn_customer_order — odczyt xp_to_next_level + nowa formuła EXP
--   • aktywne customer_orders — UPDATE rewards.exp przez JOIN z profiles
-- Nie zmienia:
--   • gold (0.22 zostaje)
--   • complete_customer_order
--   • frontend / Game.tsx
--   • _npc_customer_types, _npc_pick_item, _npc_animal_data
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── spawn_customer_order — nowa formuła EXP ─────────────────────────────
-- Baza: sql_fix_customer_order_economy_v1.sql (gold=0.22, stara formuła EXP=0.05)
-- Zmiana: czytamy xp_to_next_level z profilu, obliczamy min_exp per typ klienta
CREATE OR REPLACE FUNCTION spawn_customer_order(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_level         INT;
  v_xp_to_next    BIGINT;
  v_types_id      TEXT[];
  v_types_w       NUMERIC[];
  v_ctype         TEXT;
  v_t             RECORD;
  v_n_items       INT;
  v_items         JSONB := '[]'::JSONB;
  v_total         NUMERIC := 0;
  v_pick          RECORD;
  v_gold          NUMERIC;
  v_base_exp      INT;
  v_min_exp       INT;
  v_exp           INT;
  v_min_exp_pct   NUMERIC;
  v_bonus         JSONB;
  v_bonus_id      TEXT;
  v_rewards       JSONB;
  v_order_id      UUID;
  v_existing_ids  JSONB := '[]'::JSONB;
  v_attempts      INT;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Czytamy level + xp_to_next_level z profilu
  SELECT COALESCE(level, 1),
         COALESCE(xp_to_next_level, public.game_xp_to_next_level(COALESCE(level, 1)))
    INTO v_level, v_xp_to_next
    FROM profiles
   WHERE id = p_user_id;
  IF v_level IS NULL THEN RETURN NULL; END IF;

  -- Typy klientów odblokowane dla danego levelu (min_level <= v_level)
  SELECT array_agg(ctype ORDER BY ctype),
         array_agg(_npc_lvl_weight(v_level, weight_min, weight_max) ORDER BY ctype)
    INTO v_types_id, v_types_w
    FROM _npc_customer_types()
   WHERE min_level <= v_level;

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

  -- Scal duplikaty po id
  v_items := _npc_merge_items(v_items);

  -- Gold: 0.22 bez zmian (anti-exploit)
  v_gold := round((v_total * v_t.mult * 0.22)::NUMERIC, 2);

  -- ◆ NOWA FORMUŁA EXP: GREATEST(base_exp, min_exp_for_type)
  --
  --   base_exp   = total × mult × 0.05  (stara formuła — nadal używana)
  --   min_exp    = xp_to_next_level × min_exp_pct  (floor per typ klienta)
  --   final_exp  = GREATEST(base_exp, min_exp)
  --
  --   Efekt: małe zamówienia na wysokim lvl dostają minimalną sensowną nagrodę.
  --   Duże zamówienia (base_exp > min_exp) zachowują stary wynik — brak inflacji.

  v_base_exp := GREATEST(1, round((v_total * v_t.mult * 0.05)::NUMERIC)::INT);

  v_min_exp_pct := CASE v_ctype
    WHEN 'neighbor'               THEN 0.0001    -- 0.01%
    WHEN 'village_guest'          THEN 0.00015   -- 0.015%
    WHEN 'small_market'           THEN 0.00025   -- 0.025%
    WHEN 'village_shop'           THEN 0.0004    -- 0.040%
    WHEN 'restaurant'             THEN 0.0006    -- 0.060%
    WHEN 'wholesaler'             THEN 0.001     -- 0.100%
    WHEN 'market_chain'           THEN 0.0014    -- 0.140%
    WHEN 'distribution_center'    THEN 0.0018    -- 0.180%
    WHEN 'international_contract' THEN 0.0025    -- 0.250%
    ELSE                               0.0001
  END;

  v_min_exp := GREATEST(1, round(v_xp_to_next * v_min_exp_pct)::INT);
  v_exp     := GREATEST(v_base_exp, v_min_exp);

  -- Bonus losowy
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

REVOKE EXECUTE ON FUNCTION spawn_customer_order(UUID) FROM PUBLIC, anon, authenticated;


-- ─── UPDATE aktywnych zamówień ─────────────────────────────────────────────
-- Przelicza rewards.exp dla istniejących, niezrealizowanych zamówień wg nowej
-- formuły. Bezpieczne: zmienia tylko pole JSON rewards.exp, nie dotyka items,
-- total_value, gold, expires_at.
--
-- JOIN z profiles po user_id daje nam xp_to_next_level gracza w tej chwili.
-- (nie jest idealne — gracz mógł awansować między spawnem a teraz — ale lepsze
-- niż pozostawienie 38 EXP w ladzie przez kolejne 36h.)

UPDATE customer_orders co
   SET rewards = jsonb_set(
         rewards,
         '{exp}',
         to_jsonb(
           GREATEST(
             -- base_exp (stara formuła)
             GREATEST(1, round((co.total_value * co.reward_mult * 0.05)::NUMERIC)::INT),
             -- min_exp per typ klienta × xp_to_next gracza
             GREATEST(1, round(
               COALESCE(p.xp_to_next_level,
                        public.game_xp_to_next_level(COALESCE(p.level, 1)))
               * CASE co.customer_type
                   WHEN 'neighbor'               THEN 0.0001
                   WHEN 'village_guest'          THEN 0.00015
                   WHEN 'small_market'           THEN 0.00025
                   WHEN 'village_shop'           THEN 0.0004
                   WHEN 'restaurant'             THEN 0.0006
                   WHEN 'wholesaler'             THEN 0.001
                   WHEN 'market_chain'           THEN 0.0014
                   WHEN 'distribution_center'    THEN 0.0018
                   WHEN 'international_contract' THEN 0.0025
                   ELSE                               0.0001
                 END
             )::INT)
           )
         )
       )
  FROM profiles p
 WHERE co.user_id = p.id
   AND co.expires_at > NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA (uruchom ad hoc w Supabase SQL Editor):
--
-- V1. Nowa formuła dla przykładów z lvl 28 (xp_to_next = 620 000):
--
--   SELECT
--     ctype,
--     total,
--     mult,
--     GREATEST(1, round(total * mult * 0.05)::INT)  AS base_exp,
--     GREATEST(1, round(620000 * pct)::INT)          AS min_exp,
--     GREATEST(
--       GREATEST(1, round(total * mult * 0.05)::INT),
--       GREATEST(1, round(620000 * pct)::INT)
--     )                                               AS final_exp
--   FROM (VALUES
--     ('neighbor',               200::NUMERIC, 1.00::NUMERIC, 0.0001::NUMERIC),
--     ('neighbor',               760,          1.00,          0.0001),
--     ('village_guest',          880,          1.15,          0.00015),
--     ('small_market',          2000,          1.35,          0.00025),
--     ('restaurant',            2000,          2.00,          0.0006),
--     ('wholesaler',            2000,          2.50,          0.001),
--     ('wholesaler',           20000,          2.50,          0.001),
--     ('market_chain',         20000,          3.20,          0.0014),
--     ('international_contract',20000,         5.00,          0.0025),
--     ('international_contract',50000,         5.00,          0.0025)
--   ) AS t(ctype, total, mult, pct);
--
-- V2. Sprawdź aktywne zamówienia po UPDATE:
--
--   SELECT co.customer_type,
--          co.total_value,
--          co.reward_mult,
--          (co.rewards->>'exp')::INT  AS exp_nowe,
--          co.expires_at
--     FROM customer_orders co
--     JOIN profiles p ON p.id = co.user_id
--    WHERE co.expires_at > NOW()
--      AND p.username = 'TWOJ_USERNAME'
--    ORDER BY co.expires_at;
--
-- V3. Min EXP per typ dla różnych poziomów:
--
--   SELECT ctype,
--          round(public.game_xp_to_next_level(5)   * pct) AS min_lvl5,
--          round(public.game_xp_to_next_level(10)  * pct) AS min_lvl10,
--          round(public.game_xp_to_next_level(20)  * pct) AS min_lvl20,
--          round(public.game_xp_to_next_level(28)  * pct) AS min_lvl28,
--          round(public.game_xp_to_next_level(30)  * pct) AS min_lvl30
--   FROM (VALUES
--     ('neighbor',               0.0001::NUMERIC),
--     ('village_guest',          0.00015),
--     ('small_market',           0.00025),
--     ('village_shop',           0.0004),
--     ('restaurant',             0.0006),
--     ('wholesaler',             0.001),
--     ('market_chain',           0.0014),
--     ('distribution_center',    0.0018),
--     ('international_contract', 0.0025)
--   ) AS t(ctype, pct);
-- ═══════════════════════════════════════════════════════════════════════════
