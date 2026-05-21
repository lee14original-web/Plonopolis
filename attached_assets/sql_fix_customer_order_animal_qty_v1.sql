-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: BALANS ILOŚCI PRODUKTÓW ZWIERZĘCYCH W LADZIE NPC — v1
-- ───────────────────────────────────────────────────────────────────────────
-- Audyt aktualnego stanu:
--
--  _npc_animal_data() (etap1, niezmieniona) — qty_min/qty_max STAŁE niezależnie
--  od poziomu gracza:
--
--    item_id           unlock_lvl  base_price  qty_min  qty_max
--    ─────────────────────────────────────────────────────────
--    jajko                  3        40.0          5       20   ← za dużo dla lvl 3
--    futro_krolika          5        80.0          3       10   ← 10 fur na lvl 5 za dużo
--    mleko                  7       140.0          3       10
--    piora                  9       220.0          4       12
--    welna                 11       320.0          2        8
--    nawoz_naturalny       13       450.0          3       10
--    mleko_kozie           15       650.0          2        6
--    duze_piora            17       900.0          1        4
--    energia_robocza       20      1400.0          1        3
--    rogi_byka             25      2500.0          1        2
--
--  Nie istnieje żaden _npc_animal_qty_range — ilości czytane są z qty_min/qty_max
--  bezpośrednio w _npc_pick_item (linia: v_qty := _npc_rand_int(v_chosen.qty_min, v_chosen.qty_max))
--
-- Problem:
--   gracz na lvl 5 może dostać zamówienie na 10× futro_krolika —
--   przy 1–2 królikach i cyklu produkcji ~kilka godz. to jest nierealne.
--
-- Rozwiązanie:
--   A. Dodać _npc_animal_qty_range(p_unlock, p_level) — dynamiczne zakresy
--   B. Zaktualizować _npc_pick_item (kategorię animal) żeby używał tego helpera
--
-- Nie zmienia:
--   • _npc_animal_data (barn_animal_defs, base_price, unlock_lvl)
--   • collect_animal, complete_customer_order
--   • ekonomia gold/exp (x0.22 / x0.05)
--   • frontend / Game.tsx
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── A. NOWY HELPER: _npc_animal_qty_range ────────────────────────────────
--
-- Dwa czynniki skalowania:
--
--  1. Poziom gracza (p_level) → band bazowy:
--       p_level < 8  → early  (baza 1–5)
--       p_level < 16 → mid    (baza 5–20)
--       p_level ≥ 16 → late   (baza 10–40)
--
--  2. Poziom odblokowania zwierzęcia (p_unlock) → mnożnik rzadkości:
--       unlock ≤ 10  (jajko,futro,mleko,piora)       → factor 1.00 (pospolite)
--       unlock 11–15 (welna,nawoz,mleko_kozie)        → factor 0.75 (średnie)
--       unlock 16–20 (duze_piora,energia_robocza)     → factor 0.50 (rzadkie)
--       unlock > 20  (rogi_byka)                      → factor 0.25 (unikalne)
--
-- Obliczenia: qmin/qmax = round(baza × factor), min 1
--
-- Porównanie przed/po dla futro_krolika (unlock=5, factor=1.0):
--
--   Poziom  | PRZED (stałe) | PO
--   ─────────────────────────────────────────────────────────
--   lvl 5   |   3–10        |  1–5    ← early band
--   lvl 10  |   3–10        |  5–20   ← mid band
--   lvl 16  |   3–10        | 10–40   ← late band
--
-- Porównanie dla rogi_byka (unlock=25, factor=0.25):
--
--   Poziom  | PRZED (stałe) | PO
--   ─────────────────────────────────────────────────────────
--   lvl 25  |   1–2         |  3–10   ← late × 0.25
--                                       (wyższy niż dotąd, ale
--                                        gracz na lvl 25 ma wiele zwierząt)
--
-- Pełna tabela wszystkich zwierząt:
--
--   item             unlock factor | early(<8) | mid(8–15) | late(≥16)
--   ───────────────────────────────────────────────────────────────────
--   jajko               3   1.00  |  1–5      |  5–20     | 10–40
--   futro_krolika       5   1.00  |  1–5      |  5–20     | 10–40
--   mleko               7   1.00  |  1–5      |  5–20     | 10–40
--   piora               9   1.00  |  (n/d*)   |  5–20     | 10–40
--   welna              11   0.75  |  (n/d*)   |  4–15     |  8–30
--   nawoz_naturalny    13   0.75  |  (n/d*)   |  4–15     |  8–30
--   mleko_kozie        15   0.75  |  (n/d*)   |  4–15     |  8–30
--   duze_piora         17   0.50  |  (n/d*)   |  (n/d*)   |  5–20
--   energia_robocza    20   0.50  |  (n/d*)   |  (n/d*)   |  5–20
--   rogi_byka          25   0.25  |  (n/d*)   |  (n/d*)   |  3–10
--
--   *n/d = nie dotyczy (zwierzę nie jest jeszcze dostępne przy tym poziomie gracza)

CREATE OR REPLACE FUNCTION _npc_animal_qty_range(p_unlock INT, p_level INT)
RETURNS TABLE(qmin INT, qmax INT)
LANGUAGE SQL IMMUTABLE AS $$
  WITH base AS (
    SELECT
      CASE WHEN p_level < 8  THEN  1
           WHEN p_level < 16 THEN  5
           ELSE                   10 END AS bmin,
      CASE WHEN p_level < 8  THEN  5
           WHEN p_level < 16 THEN 20
           ELSE                   40 END AS bmax
  ),
  scale AS (
    SELECT
      CASE WHEN p_unlock > 20 THEN 0.25
           WHEN p_unlock > 15 THEN 0.50
           WHEN p_unlock > 10 THEN 0.75
           ELSE                    1.00 END AS factor
  )
  SELECT
    GREATEST(1, round(base.bmin * scale.factor)::INT),
    GREATEST(1, round(base.bmax * scale.factor)::INT)
  FROM base, scale;
$$;

GRANT EXECUTE ON FUNCTION _npc_animal_qty_range(INT, INT) TO anon, authenticated;


-- ─── B. _npc_pick_item — tylko zmiana sekcji animal ───────────────────────
-- Wersja bazuje na aktualnej (sql_npc_fruit_quality_lvl_gate.sql).
-- Jedyna zmiana: v_qty dla animal czytany przez _npc_animal_qty_range
-- zamiast v_chosen.qty_min / v_chosen.qty_max.
CREATE OR REPLACE FUNCTION _npc_pick_item(p_level INT)
RETURNS TABLE(item_id TEXT, item_qty INT, item_value NUMERIC)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_categories TEXT[] := ARRAY['crop','fruit','animal','honey'];
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
  v_weights := ARRAY[
    50.0,
    CASE WHEN p_level >= 10 THEN 25.0 ELSE 0 END,
    CASE WHEN p_level >=  3 THEN 30.0 ELSE 0 END,
    CASE WHEN p_level >= 10 THEN  8.0 ELSE 0 END
  ];
  v_cat := _npc_weighted_pick_text(v_categories, v_weights);
  IF v_cat IS NULL THEN RETURN; END IF;

  IF v_cat = 'crop' THEN
    SELECT crop_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_crops_data() WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.crop_id IS NULL THEN RETURN; END IF;

    v_qual := _npc_weighted_pick_text(
      ARRAY['good','epic','legendary'],
      ARRAY[
        75.0,
        CASE WHEN p_level >=  8 THEN 20.0 ELSE 0 END,
        CASE WHEN p_level >= 10 THEN  5.0 ELSE 0 END
      ]
    );

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

    v_qual := _npc_weighted_pick_text(
      ARRAY['zwykly','soczysty','zloty'],
      ARRAY[
        80.0,
        CASE WHEN p_level >= 14 THEN 17.0 ELSE 0 END,
        CASE WHEN p_level >= 16 THEN  3.0 ELSE 0 END
      ]
    );

    SELECT qmin, qmax INTO v_qmin, v_qmax FROM _npc_fruit_qty_range(v_qual, v_chosen.unlock_lvl);
    IF v_qmin IS NULL THEN RETURN; END IF;
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
    v_mult := _npc_quality_mult(v_qual);
    v_base := v_chosen.base_price * v_mult;
    RETURN QUERY SELECT v_chosen.fruit_id || '_' || v_qual, v_qty, v_base * v_qty;

  ELSIF v_cat = 'animal' THEN
    SELECT a.item_id, a.unlock_lvl, a.base_price INTO v_chosen
      FROM _npc_animal_data() a WHERE a.unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.item_id IS NULL THEN RETURN; END IF;

    -- ◆ ZMIANA: ilość dynamiczna wg poziomu gracza i rzadkości zwierzęcia
    SELECT qmin, qmax INTO v_qmin, v_qmax
      FROM _npc_animal_qty_range(v_chosen.unlock_lvl, p_level);
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
    v_base := v_chosen.base_price;
    RETURN QUERY SELECT v_chosen.item_id, v_qty, v_base * v_qty;

  ELSE  -- honey
    v_qty := _npc_rand_int(1, 8);
    RETURN QUERY SELECT 'honey_jar'::TEXT, v_qty, 12.0 * v_qty;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA (uruchom ad hoc w Supabase SQL Editor):
--
--   -- Zakresy dla futro_krolika (unlock=5) na różnych poziomach:
--   SELECT * FROM _npc_animal_qty_range(5, 5);   -- early: 1–5
--   SELECT * FROM _npc_animal_qty_range(5, 10);  -- mid:   5–20
--   SELECT * FROM _npc_animal_qty_range(5, 16);  -- late: 10–40
--
--   -- Zakresy dla rogi_byka (unlock=25) na lvl 25:
--   SELECT * FROM _npc_animal_qty_range(25, 25); -- late×0.25: 3–10
--
--   -- Pełna tabela wszystkich zwierząt na danym poziomie:
--   SELECT item_id, unlock_lvl,
--     (SELECT qmin || '–' || qmax FROM _npc_animal_qty_range(unlock_lvl, 5))  AS early,
--     (SELECT qmin || '–' || qmax FROM _npc_animal_qty_range(unlock_lvl, 10)) AS mid,
--     (SELECT qmin || '–' || qmax FROM _npc_animal_qty_range(unlock_lvl, 16)) AS late
--   FROM _npc_animal_data();
--
--   -- Test spawnu po wgraniu:
--   SELECT tick_customer_orders('TWOJ_USER_ID'::UUID);
-- ═══════════════════════════════════════════════════════════════════════════
