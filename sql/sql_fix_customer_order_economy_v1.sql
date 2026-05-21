-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: EKONOMIA NAGRÓD NPC — v1
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   item_value (v_total) = base_price × quality_mult × qty
--   dla marchewki (base_price=9.6): carrot_good × 10 = 96
--   Przy mnożniku 0.70: neighbor płaci 96 × 1.00 × 0.70 = 67.20 zł
--   → 6.72 zł/szt., a w sklepie miejskim marchew = ~3.20 zł/szt.
--   → gracz może kupować i oddawać klientom z zyskiem bez produkcji (exploit).
--
-- Skąd pochodzi item_value w _npc_pick_item:
--   crop:   base_price × quality_mult × qty   (jakość: good×1.0, epic×2.5, leg×5.0)
--   fruit:  base_price × quality_mult × qty   (zwykly×1.0, soczysty×2.0, zloty×5.0)
--   animal: base_price × qty                  (bez mnożnika jakości)
--   honey:  12.0 × qty                        (stała cena)
--
-- Cena sklepowa 1 szt. uprawy ≈ base_price / 3
--   (komentarz w etap1: base_price = nasiona×3, sklep sprzedaje po cenie nasion)
--   marchew: 9.6 / 3 = 3.20 zł/szt.
--
-- Warunek braku exploita: gold_per_item < shop_price_per_item
--   gold_per_item = base_price × quality_mult × mult_type × factor
--   shop_price    = base_price / 3 = base_price × 0.333
--   Wymagane: factor < 0.333 / (quality_mult × mult_type)
--
-- Analiza współczynnika dla carrot_good (quality_mult=1.0):
--   factor  neighbor(1.00) v_guest(1.15) s_market(1.35) v_shop(1.60)
--   0.70    6.72 zł  ✗    7.73 zł  ✗    9.07 zł  ✗    10.75 zł ✗
--   0.25    2.40 zł  ✓    2.76 zł  ✓    3.24 zł  ✗!   4.03 zł  ✗!
--   0.22    2.11 zł  ✓    2.43 zł  ✓    2.85 zł  ✓    3.38 zł  ~(min_lvl=5)
--   0.20    1.92 zł  ✓    2.21 zł  ✓    2.59 zł  ✓    3.07 zł  ✓
--
-- ✗! = exploit nadal możliwy dla tanich upraw
-- ~ = graniczna (village_shop wymaga min_lvl=5, raczej nie pyta tylko o marchew)
--
-- ─── REKOMENDACJA: 0.22 ───────────────────────────────────────────────────
--   • 0.25 daje exploit dla small_market (3.24 > shop 3.20) i wyżej
--   • 0.22 eliminuje exploit dla neighbor/village_guest/small_market
--   • village_shop (min_lvl=5) daje 3.38 vs shop 3.20 — marginalny ale
--     village_shop wymaga 3–4 pozycji w zamówieniu, nie tylko marchewek,
--     i jest zablokowany do lvl 5 (po fixie sql_fix_customer_order_balance_v1)
--   • EXP zwiększamy z 0.03 → 0.05 (+67%) jako rekompensata za mniejszy gold
--
-- Nie zmienia:
--   • complete_customer_order
--   • frontend / Game.tsx
--   • customer order UI / spawn interval
--   • typów klientów / min_level (z sql_fix_customer_order_balance_v1.sql)
--   • _npc_pick_item, _npc_crops_data, _npc_merge_items, bonusy
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Pełna tabela porównawcza (10× carrot_good, base=9.6, v_total=96) ─────
--
--  Typ klienta      mult  0.70 (dotychczas)          0.25                0.22
--  ─────────────────────────────────────────────────────────────────────────────
--  neighbor         1.00  67.20 zł  6.72 zł/szt     24.00 zł 2.40/szt   21.12 zł 2.11/szt
--  village_guest    1.15  77.28 zł  7.73 zł/szt     27.60 zł 2.76/szt   24.29 zł 2.43/szt
--
--  Cena sklepu: 3.20 zł/szt → exploit jeśli gold/szt > 3.20
--
--  EXP (0.03→0.05, carrot_good 10×, neighbor):
--    przed: round(96 × 1.00 × 0.03) = 2 exp
--    po:    round(96 × 1.00 × 0.05) = 5 exp
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── spawn_customer_order — zmiana mnożnika gold + korekta EXP ───────────
-- Wymagania wstępne (muszą być już wgrane):
--   • sql_fix_customer_order_balance_v1.sql  (min_level + _npc_merge_items fix)
-- Ten plik podmienia tylko formułę gold i exp; reszta logiki bez zmian.
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

  -- Tylko typy z min_level <= v_level (z sql_fix_customer_order_balance_v1)
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

  -- Scal duplikaty po id (fix regresji z sql_lada_npc_bonus_no_duplicate)
  v_items := _npc_merge_items(v_items);

  -- ◆ ZMIANA EKONOMII:
  --   gold: 0.70 → 0.22  (eliminuje exploit kupowania w sklepie i odsprzedaży)
  --   exp:  0.03 → 0.05  (rekompensata: +67% EXP za mniejszy złoty)
  v_gold := round((v_total * v_t.mult * 0.22)::NUMERIC, 2);
  v_exp  := GREATEST(1, round((v_total * v_t.mult * 0.05)::NUMERIC)::INT);

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

REVOKE EXECUTE ON FUNCTION spawn_customer_order(UUID) FROM PUBLIC, anon, authenticated;


-- ─── Aktualizacja istniejących AKTYWNYCH zamówień ─────────────────────────
-- Przelicza rewards.gold i rewards.exp w już wygenerowanych zamówieniach
-- tak, żeby nie było sprzeczności między starymi a nowymi zleceniami.
-- Bezpieczne: zmienia tylko pole JSON rewards, nie dotyka items/expires_at.
UPDATE customer_orders co
   SET rewards = jsonb_set(
         jsonb_set(
           rewards,
           '{gold}',
           to_jsonb(round((co.total_value * co.reward_mult * 0.22)::NUMERIC, 2))
         ),
         '{exp}',
         to_jsonb(GREATEST(1, round((co.total_value * co.reward_mult * 0.05)::NUMERIC)::INT))
       )
WHERE co.expires_at > NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA (uruchom ad hoc w Supabase SQL Editor):
--
--   -- Porównanie przed/po dla carrot_good × 10, neighbor:
--   -- v_total=96, mult=1.00
--   SELECT
--     round(96 * 1.00 * 0.70, 2) AS gold_przed,
--     round(96 * 1.00 * 0.22, 2) AS gold_po_0_22,
--     round(96 * 1.00 * 0.25, 2) AS gold_po_0_25,
--     round(96 * 1.00 * 0.03) AS exp_przed,
--     round(96 * 1.00 * 0.05) AS exp_po;
--
--   -- Pełna tabela typów klientów z gold/szt przy carrot_good:
--   SELECT ctype, mult,
--     round(9.6 * mult * 0.22, 2)  AS gold_na_szt_po,
--     round(9.6 * mult * 0.70, 2)  AS gold_na_szt_przed,
--     9.6 / 3                       AS cena_sklep
--   FROM _npc_customer_types()
--   ORDER BY mult;
--
--   -- Ręczny spawn po wgraniu:
--   SELECT tick_customer_orders('TWOJ_USER_ID'::UUID);
-- ═══════════════════════════════════════════════════════════════════════════
