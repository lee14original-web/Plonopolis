-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: SKALOWANIE EXP W LADZIE NPC — v2 (zwiększone minimum)
-- ───────────────────────────────────────────────────────────────────────────
-- Zmiana względem v1:
--   min_exp_pct zwiększone ~3× dla wszystkich typów klientów.
--   Cel: komplet 12 klientów na wysokim lvl daje orientacyjnie 2–5% poziomu.
--
-- Formuła (bez zmian względem v1):
--   base_exp  = GREATEST(1, round(v_total × mult × 0.05))
--   min_exp   = GREATEST(1, round(xp_to_next_level × min_exp_pct))
--   final_exp = GREATEST(base_exp, min_exp)
--
-- Gold: 0.22 — BEZ ZMIAN
--
-- ─── Nowe wartości min_exp_pct ────────────────────────────────────────────
--
--   Typ klienta              v1 (stare)   v2 (nowe)    zmiana
--   ─────────────────────────────────────────────────────────
--   neighbor               0.00010      0.00030        ×3.0
--   village_guest          0.00015      0.00050        ×3.3
--   small_market           0.00025      0.00080        ×3.2
--   village_shop           0.00040      0.00120        ×3.0
--   restaurant             0.00060      0.00180        ×3.0
--   wholesaler             0.00100      0.00270        ×2.7
--   market_chain           0.00140      0.00380        ×2.7
--   distribution_center    0.00180      0.00500        ×2.8
--   international_contract 0.00250      0.00700        ×2.8
--
-- ─── Porównanie EXP przed/po dla lvl 31 (xp_to_next = 15 500 000) ────────
--
--   Typ klienta              v1 min_exp     v2 min_exp    zmiana
--   ─────────────────────────────────────────────────────────────────────
--   neighbor                  1 550 EXP →    4 650 EXP    +3 100
--   village_guest             2 325 EXP →    7 750 EXP    +5 425
--   small_market              3 875 EXP →   12 400 EXP    +8 525
--   village_shop              6 200 EXP →   18 600 EXP   +12 400
--   restaurant                9 300 EXP →   27 900 EXP   +18 600
--   wholesaler               15 500 EXP →   41 850 EXP   +26 350
--   market_chain             21 700 EXP →   58 900 EXP   +37 200
--   distribution_center      27 900 EXP →   77 500 EXP   +49 600
--   international_contract   38 750 EXP →  108 500 EXP   +69 750
--
-- ─── Weryfikacja celu: 12 klientów = 2–5% levelu ─────────────────────────
--
--   Realistyczny rozkład na lvl 31 wg wag (neighbor rzadki, wholesaler/chain frequent):
--     2× neighbor          2 × 4 650  =  9 300 EXP
--     1× village_guest     1 × 7 750  =  7 750 EXP
--     1× small_market      1 × 12 400 = 12 400 EXP
--     2× restaurant        2 × 27 900 = 55 800 EXP
--     3× wholesaler        3 × 41 850 = 125 550 EXP
--     2× market_chain      2 × 58 900 = 117 800 EXP
--     1× distribution      1 × 77 500 = 77 500 EXP
--     ─────────────────────────────────────────────
--     SUMA:                           = 406 100 EXP
--     % of xp_to_next:    406 100 / 15 500 000 = 2.62%  ✓ (cel: 2–5%)
--
--   Pessimistyczny (same małe):   12 × 4 650  = 55 800  → 0.36%
--   Optymistyczny (same int):     12 × 108 500 = 1 302 000 → 8.4%
--   (pessimistyczny nie groźny — sąsiad rzadki na lvl 31)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── spawn_customer_order — v2 (nowe min_exp_pct) ─────────────────────────
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

  SELECT COALESCE(level, 1),
         COALESCE(xp_to_next_level, public.game_xp_to_next_level(COALESCE(level, 1)))
    INTO v_level, v_xp_to_next
    FROM profiles
   WHERE id = p_user_id;
  IF v_level IS NULL THEN RETURN NULL; END IF;

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

  v_items := _npc_merge_items(v_items);

  -- Gold: 0.22 — bez zmian
  v_gold := round((v_total * v_t.mult * 0.22)::NUMERIC, 2);

  -- EXP: GREATEST(base_exp, min_exp) — v2 pct
  v_base_exp := GREATEST(1, round((v_total * v_t.mult * 0.05)::NUMERIC)::INT);

  v_min_exp_pct := CASE v_ctype
    WHEN 'neighbor'               THEN 0.00030
    WHEN 'village_guest'          THEN 0.00050
    WHEN 'small_market'           THEN 0.00080
    WHEN 'village_shop'           THEN 0.00120
    WHEN 'restaurant'             THEN 0.00180
    WHEN 'wholesaler'             THEN 0.00270
    WHEN 'market_chain'           THEN 0.00380
    WHEN 'distribution_center'    THEN 0.00500
    WHEN 'international_contract' THEN 0.00700
    ELSE                               0.00030
  END;

  v_min_exp := GREATEST(1, round(v_xp_to_next * v_min_exp_pct)::INT);
  v_exp     := GREATEST(v_base_exp, v_min_exp);

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
UPDATE customer_orders co
   SET rewards = jsonb_set(
         rewards,
         '{exp}',
         to_jsonb(
           GREATEST(
             GREATEST(1, round((co.total_value * co.reward_mult * 0.05)::NUMERIC)::INT),
             GREATEST(1, round(
               COALESCE(p.xp_to_next_level,
                        public.game_xp_to_next_level(COALESCE(p.level, 1)))
               * CASE co.customer_type
                   WHEN 'neighbor'               THEN 0.00030
                   WHEN 'village_guest'          THEN 0.00050
                   WHEN 'small_market'           THEN 0.00080
                   WHEN 'village_shop'           THEN 0.00120
                   WHEN 'restaurant'             THEN 0.00180
                   WHEN 'wholesaler'             THEN 0.00270
                   WHEN 'market_chain'           THEN 0.00380
                   WHEN 'distribution_center'    THEN 0.00500
                   WHEN 'international_contract' THEN 0.00700
                   ELSE                               0.00030
                 END
             )::INT)
           )
         )
       )
  FROM profiles p
 WHERE co.user_id = p.id
   AND co.expires_at > NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA (uruchom po wgraniu):
--
-- V1. Min EXP v2 per typ dla kluczowych poziomów:
--
--   SELECT ctype,
--     round(public.game_xp_to_next_level(10)  * pct) AS min_lvl10,
--     round(public.game_xp_to_next_level(20)  * pct) AS min_lvl20,
--     round(public.game_xp_to_next_level(28)  * pct) AS min_lvl28,
--     round(public.game_xp_to_next_level(31)  * pct) AS min_lvl31
--   FROM (VALUES
--     ('neighbor',               0.00030::NUMERIC),
--     ('village_guest',          0.00050),
--     ('small_market',           0.00080),
--     ('village_shop',           0.00120),
--     ('restaurant',             0.00180),
--     ('wholesaler',             0.00270),
--     ('market_chain',           0.00380),
--     ('distribution_center',    0.00500),
--     ('international_contract', 0.00700)
--   ) AS t(ctype, pct);
--
-- V2. Sprawdź aktywne zamówienia po UPDATE:
--
--   SELECT co.customer_type,
--          co.total_value,
--          (co.rewards->>'exp')::INT AS exp_nowe,
--          p.level,
--          p.xp_to_next_level
--     FROM customer_orders co
--     JOIN profiles p ON p.id = co.user_id
--    WHERE co.expires_at > NOW()
--    ORDER BY p.level DESC, co.expires_at;
-- ═══════════════════════════════════════════════════════════════════════════
