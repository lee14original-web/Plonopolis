-- FIX: Bramka poziomowa dla jakości upraw w zamówieniach klientów
-- Problem: _npc_pick_item zawsze 20% epic, 5% legendary bez względu na poziom gracza
-- Fix:    epic tylko od lvl 8, legendary od lvl 12
-- Uruchom w Supabase SQL Editor.

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
    CASE WHEN p_level >= 10 THEN 25.0 ELSE 0 END,   -- fruit od lvl 10
    CASE WHEN p_level >=  3 THEN 30.0 ELSE 0 END,   -- animal od lvl 3
    CASE WHEN p_level >= 10 THEN  8.0 ELSE 0 END    -- honey od lvl 10
  ];
  v_cat := _npc_weighted_pick_text(v_categories, v_weights);
  IF v_cat IS NULL THEN RETURN; END IF;

  IF v_cat = 'crop' THEN
    SELECT crop_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_crops_data() WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.crop_id IS NULL THEN RETURN; END IF;

    -- Jakość: epic od lvl 8, legendary od lvl 12
    v_qual := _npc_weighted_pick_text(
      ARRAY['good','epic','legendary'],
      ARRAY[
        75.0,
        CASE WHEN p_level >=  8 THEN 20.0 ELSE 0 END,
        CASE WHEN p_level >= 12 THEN  5.0 ELSE 0 END
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

    -- Jakość owoców: soczysty od lvl 14, złoty od lvl 16
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

-- Weryfikacja:
-- SELECT * FROM _npc_pick_item(4);   -- powinno zwracać tylko _good (nie epic/legendary)
-- SELECT * FROM _npc_pick_item(8);   -- może zwracać epic
-- SELECT * FROM _npc_pick_item(12);  -- może zwracać legendary
