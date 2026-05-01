-- ═══════════════════════════════════════════════════════════════════════════
-- HOTFIX: NPC nie żądają epickich/legendarnych UPRAW od początku gry
--   • epickie uprawy (suffix _epic)        — dopiero od poziomu 8 gracza
--   • legendarne uprawy (suffix _legendary)— dopiero od poziomu 10 gracza
--
-- Dotyczy TYLKO upraw warzywnych (kategoria 'crop' w _npc_pick_item).
-- Owoce z drzew (kategoria 'fruit'): bez zmian — sad i tak jest zablokowany
--   do lvl 10, więc soczyste/złote owoce naturalnie pojawiają się dopiero
--   wtedy, gdy gracz ma już dostęp do sadu.
--
-- Dodatkowo: czyścimy aktywne (niewygasłe) zamówienia, w których pojawiły
-- się epickie/legendarne uprawy ponad uprawnieniami gracza, żeby nikt nie
-- został z niemożliwym do zrealizowania zleceniem.
-- ═══════════════════════════════════════════════════════════════════════════

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

    -- ◆ JAKOŚĆ UPRAW Z BRAMĄ POZIOMOWĄ:
    --   epic     — od lvl 8 gracza (waga 20, wcześniej 0)
    --   legendary— od lvl 10 gracza (waga 5, wcześniej 0)
    --   good     — zawsze 75
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

  ELSE  -- honey
    v_qty := _npc_rand_int(1, 8);
    RETURN QUERY SELECT 'honey_jar'::TEXT, v_qty, 12.0 * v_qty;
  END IF;
END $$;


-- ─── CZYSZCZENIE: usuń aktywne zlecenia z ponadpoziomowymi jakościami ─────
-- Usuwa zamówienia które zawierają _legendary u graczy < lvl 10
-- lub _epic u graczy < lvl 8 (po stronie upraw — fruit/animal nie dotyczy).
DELETE FROM customer_orders
WHERE expires_at > NOW()
  AND (
    (user_id IN (SELECT id FROM profiles WHERE COALESCE(level,1) < 10)
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(items) e
         WHERE (e->>'id') ~ '_legendary$'
           AND (e->>'id') !~ '^(jablko|gruszka|sliwka|wisnia|brzoskwinia|mandarynka|cytryna|granat|figa|pomarancza)_'
       )
    )
    OR
    (user_id IN (SELECT id FROM profiles WHERE COALESCE(level,1) < 8)
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(items) e
         WHERE (e->>'id') ~ '_epic$'
           AND (e->>'id') !~ '^(jablko|gruszka|sliwka|wisnia|brzoskwinia|mandarynka|cytryna|granat|figa|pomarancza)_'
       )
    )
  );
