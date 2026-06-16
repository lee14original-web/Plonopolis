-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Skalowanie ilości produktów zwierzęcych od poziomu gracza
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   _npc_pick_item dla kategorii 'animal' używał stałych qty_min/qty_max
--   ze słownika _npc_animal_data(), niezależnie od poziomu gracza.
--   Skutek: gracz na lvl 3 dostawał zamówienia na 5–20 jajek, a endgame
--   gracz na lvl 25 — tylko 1–2 rogi byka.
--
-- Rozwiązanie:
--   Nowy helper _npc_animal_qty_range(p_unlock, p_level) skaluje zakres
--   ilości dwuczynnikowo:
--     1. Poziom gracza → band bazowy (early/mid/late)
--     2. Unlock zwierzęcia → mnożnik rzadkości (item wyższy = rzadszy)
--
-- Tabela zakresów po zmianie:
--   Item              unlock  factor  early(<8)  mid(8–15)  late(≥16)
--   jajko                3    1.00     1–5        5–20       10–40
--   futro_krolika        5    1.00     1–5        5–20       10–40
--   mleko                7    1.00     1–5        5–20       10–40
--   piora                9    1.00      —         5–20       10–40
--   welna               11    0.75      —         4–15        8–30
--   nawoz_naturalny     13    0.75      —         4–15        8–30
--   mleko_kozie         15    0.75      —         4–15        8–30
--   duze_piora          17    0.50      —          —          5–20
--   energia_robocza     20    0.50      —          —          5–20
--   rogi_byka           25    0.25      —          —          3–10
--
-- Idempotentny — można uruchomić wielokrotnie bezpiecznie.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. HELPER: zakres ilości zwierzęcych wg poziomu gracza i unlocku ─────
CREATE OR REPLACE FUNCTION _npc_animal_qty_range(p_unlock INT, p_level INT)
RETURNS TABLE(qmin INT, qmax INT)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT
    -- band bazowy wg poziomu gracza
    CASE
      WHEN p_level < 8  THEN GREATEST(1, round( 1 * factor)::INT)
      WHEN p_level < 16 THEN GREATEST(1, round( 5 * factor)::INT)
      ELSE                   GREATEST(1, round(10 * factor)::INT)
    END AS qmin,
    CASE
      WHEN p_level < 8  THEN GREATEST(1, round( 5 * factor)::INT)
      WHEN p_level < 16 THEN GREATEST(1, round(20 * factor)::INT)
      ELSE                   GREATEST(1, round(40 * factor)::INT)
    END AS qmax
  FROM (
    -- mnożnik rzadkości wg unlock tieru
    SELECT CASE
      WHEN p_unlock <= 10 THEN 1.00
      WHEN p_unlock <= 15 THEN 0.75
      WHEN p_unlock <= 20 THEN 0.50
      ELSE                     0.25
    END AS factor
  ) f
$$;


-- ─── 2. _npc_pick_item — zaktualizowana sekcja 'animal' ───────────────────
-- Pełny DROP+CREATE OR REPLACE konieczny bo funkcja jest VOLATILE (można OR REPLACE).
-- Zmiana: jedna linia w sekcji ELSIF v_cat = 'animal' — używa nowego helpera.
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
  v_weights := ARRAY[
    50.0,
    CASE WHEN p_level >= 10 THEN 25.0 ELSE 0 END,
    CASE WHEN p_level >=  3 THEN 30.0 ELSE 0 END,
    8.0,
    7.0
  ];
  v_cat := _npc_weighted_pick_text(v_categories, v_weights);
  IF v_cat IS NULL THEN RETURN; END IF;

  IF v_cat = 'crop' THEN
    SELECT crop_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_crops_data() WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.crop_id IS NULL THEN RETURN; END IF;
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
    SELECT a.item_id, a.unlock_lvl, a.base_price INTO v_chosen
      FROM _npc_animal_data() a WHERE a.unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.item_id IS NULL THEN RETURN; END IF;
    -- ZMIANA: skalowanie ilości wg poziomu gracza i unlock tieru zwierzęcia
    SELECT qmin, qmax INTO v_qmin, v_qmax
      FROM _npc_animal_qty_range(v_chosen.unlock_lvl, p_level);
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
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


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA:
--   -- Test helpera bezpośrednio:
--   SELECT * FROM _npc_animal_qty_range(3, 5);   -- jajko, lvl 5 → early: 1–5
--   SELECT * FROM _npc_animal_qty_range(3, 10);  -- jajko, lvl 10 → mid: 5–20
--   SELECT * FROM _npc_animal_qty_range(3, 20);  -- jajko, lvl 20 → late: 10–40
--   SELECT * FROM _npc_animal_qty_range(25, 20); -- rogi_byka, lvl 20 → late ×0.25: 3–10
--
--   -- Test przez pełny generator (uruchom kilka razy):
--   SELECT item_id, item_qty, item_value FROM _npc_pick_item(5)
--     WHERE TRUE; -- (wywołaj wielokrotnie, obserwuj item_qty dla animal)
-- ═══════════════════════════════════════════════════════════════════════════
