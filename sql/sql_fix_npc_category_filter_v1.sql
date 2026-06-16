-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: FILTR KATEGORII I LIMITÓW ZWIERZĘCYCH PER TYP KLIENTA — v1
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   _npc_pick_item(p_level) ignoruje typ klienta — każdy (Sąsiad, Hurtownik)
--   dostaje tę samą pulę losowania: crop/fruit/animal/honey.
--   Efekt: Sąsiad (mult=1.00, 1 item) może dostać 17× futro_krolika.
--
-- Zmiany:
--   1. _npc_allowed_categories(p_ctype, p_level) → TABLE TEXT[]
--      Tablica dozwolonych kategorii per typ klienta i poziom gracza.
--
--   2. _npc_animal_unlock_cap(p_ctype) → INT
--      Max unlock_lvl zwierzęcia dozwolonego dla danego typu klienta.
--      Filtruje _npc_animal_data() w _npc_pick_item.
--
--   3. _npc_animal_qty_cap(p_ctype, p_unlock) → INT
--      Hard cap na ilość produktu zwierzęcego — stosowany przez LEAST(qty, cap).
--
--   4. _npc_pick_item(p_level INT, p_ctype TEXT) — nowa sygnatura
--      Stara (INT) jest usuwana przez DROP. Nowa zawiera filtr kategorii,
--      filtr unlock zwierząt i hard cap ilości. Przywraca compost dla
--      market_chain/distribution_center/international_contract.
--
--   5. spawn_customer_order — przekazuje v_ctype do _npc_pick_item.
--      Zachowuje pełną logikę EXP v2 (GREATEST base_exp, min_exp).
--      Zachowuje gold ×0.22.
--
-- NIE zmienia:
--   • gold/EXP multiplier (0.22 / 0.05 / min_exp_pct v2)
--   • frontend / Game.tsx
--   • customer_orders schema
--   • tick_customer_orders, complete_customer_order
--   • _npc_customer_types, _npc_crop_qty_range, _npc_fruit_qty_range
--   • _npc_animal_qty_range (nadal używana wewnątrz nowego _npc_pick_item)
--   • istniejące aktywne zamówienia (nie kasujemy, nie przeliczamy)
--
-- Idempotentny — można uruchomić wielokrotnie bezpiecznie.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. _npc_allowed_categories ────────────────────────────────────────────
-- Zwraca tablicę dozwolonych kategorii dla danego typu klienta i poziomu.
--
-- Reguły:
--   neighbor          → crop only
--   village_guest     → crop only
--   small_market      → crop + animal (tylko jajko via unlock_cap=3)
--   village_shop      → crop + animal (jajko + futro via unlock_cap=5)
--   restaurant        → crop + animal; fruit/honey dopiero od player lvl >= 10
--   wholesaler        → crop + animal + fruit + honey
--   market_chain+     → crop + animal + fruit + honey + compost
CREATE OR REPLACE FUNCTION _npc_allowed_categories(p_ctype TEXT, p_level INT)
RETURNS TEXT[]
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_ctype
    WHEN 'neighbor'
      THEN ARRAY['crop']
    WHEN 'village_guest'
      THEN ARRAY['crop']
    WHEN 'small_market'
      THEN ARRAY['crop', 'animal']
    WHEN 'village_shop'
      THEN ARRAY['crop', 'animal']
    WHEN 'restaurant'
      THEN CASE WHEN p_level >= 10
                THEN ARRAY['crop', 'animal', 'fruit', 'honey']
                ELSE ARRAY['crop', 'animal']
           END
    WHEN 'wholesaler'
      THEN ARRAY['crop', 'animal', 'fruit', 'honey']
    WHEN 'market_chain'
      THEN ARRAY['crop', 'animal', 'fruit', 'honey', 'compost']
    WHEN 'distribution_center'
      THEN ARRAY['crop', 'animal', 'fruit', 'honey', 'compost']
    WHEN 'international_contract'
      THEN ARRAY['crop', 'animal', 'fruit', 'honey', 'compost']
    ELSE ARRAY['crop']  -- bezpieczny fallback
  END;
$$;

GRANT EXECUTE ON FUNCTION _npc_allowed_categories(TEXT, INT) TO anon, authenticated;


-- ─── 2. _npc_animal_unlock_cap ─────────────────────────────────────────────
-- Zwraca maksymalny unlock_lvl zwierzęcia dozwolonego dla danego typu klienta.
-- Używany w WHERE a.unlock_lvl <= _npc_animal_unlock_cap(p_ctype).
--
-- Mapowanie unlock → item:
--   unlock=3:  jajko           (Kura, 4h)
--   unlock=5:  futro_krolika   (Królik, 8h)
--   unlock=7:  mleko           (Krowa, 12h)
--   unlock=9:  piora           (Kaczka, 16h)
--   unlock=11: welna           (Owca, 20h)
--   unlock=13: nawoz_naturalny (Świnia, 24h)
--   unlock=15: mleko_kozie     (Koza, 30h)
--   unlock=17: duze_piora      (Indyk, 36h)
--   unlock=20: energia_robocza (Koń, 48h)
--   unlock=25: rogi_byka       (Byk, 72h)
CREATE OR REPLACE FUNCTION _npc_animal_unlock_cap(p_ctype TEXT)
RETURNS INT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_ctype
    WHEN 'neighbor'                 THEN 0   -- zakaz (i tak brak kategorii animal)
    WHEN 'village_guest'            THEN 0   -- zakaz
    WHEN 'small_market'             THEN 3   -- tylko jajko (unlock=3)
    WHEN 'village_shop'             THEN 5   -- jajko + futro_krolika (unlock≤5)
    WHEN 'restaurant'               THEN 15  -- do mleko_kozie (unlock≤15)
    WHEN 'wholesaler'               THEN 20  -- do energia_robocza (unlock≤20)
    WHEN 'market_chain'             THEN 25  -- wszystkie
    WHEN 'distribution_center'      THEN 25
    WHEN 'international_contract'   THEN 25
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION _npc_animal_unlock_cap(TEXT) TO anon, authenticated;


-- ─── 3. _npc_animal_qty_cap ────────────────────────────────────────────────
-- Zwraca hard cap na ilość produktu zwierzęcego dla danego typu klienta
-- i tieru zwierzęcia (wg unlock_lvl).
-- Stosowanie: v_qty := LEAST(v_qty, _npc_animal_qty_cap(p_ctype, p_unlock))
--
-- Tiers (wg unlock_lvl):
--   ≤5:  jajko(4h) + futro_krolika(8h)
--   ≤10: mleko(12h) + piora(16h)
--   ≤15: welna(20h) + nawoz(24h) + mleko_kozie(30h)
--   ≤20: duze_piora(36h) + energia_robocza(48h)
--   ≤25: rogi_byka(72h)
CREATE OR REPLACE FUNCTION _npc_animal_qty_cap(p_ctype TEXT, p_unlock INT)
RETURNS INT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_ctype

    WHEN 'village_shop' THEN
      CASE WHEN p_unlock <= 3 THEN 5   -- jajko: max 5
           WHEN p_unlock <= 5 THEN 3   -- futro_krolika: max 3
           ELSE 1                      -- zabezpieczenie (unlock_cap=5 nie przepuści)
      END

    WHEN 'restaurant' THEN
      CASE WHEN p_unlock <=  5 THEN  8  -- jajko, futro
           WHEN p_unlock <= 10 THEN  3  -- mleko, piora
           WHEN p_unlock <= 15 THEN  2  -- welna, nawoz, mleko_kozie
           ELSE 1                       -- zabezpieczenie (unlock_cap=15)
      END

    WHEN 'wholesaler' THEN
      CASE WHEN p_unlock <=  5 THEN 12  -- jajko, futro
           WHEN p_unlock <= 10 THEN  8  -- mleko, piora
           WHEN p_unlock <= 15 THEN  5  -- welna, nawoz, mleko_kozie
           WHEN p_unlock <= 20 THEN  3  -- duze_piora, energia_robocza
           ELSE 1                       -- zabezpieczenie (unlock_cap=20)
      END

    WHEN 'market_chain' THEN
      CASE WHEN p_unlock <=  5 THEN 20
           WHEN p_unlock <= 10 THEN 12
           WHEN p_unlock <= 15 THEN  8
           WHEN p_unlock <= 20 THEN  5
           ELSE                      3  -- rogi_byka
      END

    WHEN 'distribution_center' THEN
      CASE WHEN p_unlock <=  5 THEN 30
           WHEN p_unlock <= 10 THEN 18
           WHEN p_unlock <= 15 THEN 12
           WHEN p_unlock <= 20 THEN  8
           ELSE                      5  -- rogi_byka
      END

    WHEN 'international_contract' THEN
      CASE WHEN p_unlock <=  5 THEN 40
           WHEN p_unlock <= 10 THEN 25
           WHEN p_unlock <= 15 THEN 16
           WHEN p_unlock <= 20 THEN 10
           ELSE                      6  -- rogi_byka
      END

    ELSE 1  -- neighbor/village_guest/small_market: zakaz animal przez kategorię

  END;
$$;

GRANT EXECUTE ON FUNCTION _npc_animal_qty_cap(TEXT, INT) TO anon, authenticated;


-- ─── 4. _npc_pick_item(p_level INT, p_ctype TEXT) — nowa sygnatura ─────────
-- Zmiana sygnatury wymaga DROP starej wersji _npc_pick_item(INT).
-- Nowa wersja _npc_pick_item(INT, TEXT) jest tworzona przez OR REPLACE.
--
-- Zmiany względem poprzedniej wersji:
--   • Przyjmuje p_ctype TEXT — typ klienta
--   • Wagi kategorii filtrowane przez _npc_allowed_categories(p_ctype, p_level)
--   • Sekcja animal: filtr unlock_lvl <= _npc_animal_unlock_cap(p_ctype)
--   • Sekcja animal: LEAST(qty, _npc_animal_qty_cap(p_ctype, unlock_lvl))
--   • Przywrócona kategoria compost (była w etap4, usunięta w animal_qty_v1)
--
-- Bez zmian: crop jakość/qty, fruit jakość/qty, honey qty, compost qty.

DROP FUNCTION IF EXISTS _npc_pick_item(INT);

CREATE OR REPLACE FUNCTION _npc_pick_item(p_level INT, p_ctype TEXT)
RETURNS TABLE(item_id TEXT, item_qty INT, item_value NUMERIC)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_allowed    TEXT[];
  v_categories TEXT[] := ARRAY['crop', 'fruit', 'animal', 'honey', 'compost'];
  v_weights    NUMERIC[];
  v_unlock_cap INT;
  v_cat        TEXT;
  v_qual       TEXT;
  v_chosen     RECORD;
  v_qmin       INT;
  v_qmax       INT;
  v_qty        INT;
  v_cap        INT;
  v_base       NUMERIC;
  v_mult       NUMERIC;
BEGIN
  v_allowed    := _npc_allowed_categories(p_ctype, p_level);
  v_unlock_cap := _npc_animal_unlock_cap(p_ctype);

  -- Wagi kategorii: bazowe wartości × czy dozwolona × gate poziomowy
  v_weights := ARRAY[
    CASE WHEN 'crop'    = ANY(v_allowed)                    THEN 50.0 ELSE 0 END,
    CASE WHEN 'fruit'   = ANY(v_allowed) AND p_level >= 10  THEN 25.0 ELSE 0 END,
    CASE WHEN 'animal'  = ANY(v_allowed) AND p_level >=  3  THEN 30.0 ELSE 0 END,
    CASE WHEN 'honey'   = ANY(v_allowed) AND p_level >= 10  THEN  8.0 ELSE 0 END,
    CASE WHEN 'compost' = ANY(v_allowed)                    THEN  7.0 ELSE 0 END
  ];

  v_cat := _npc_weighted_pick_text(v_categories, v_weights);
  IF v_cat IS NULL THEN RETURN; END IF;

  -- ── CROP ──────────────────────────────────────────────────────────────────
  IF v_cat = 'crop' THEN
    SELECT crop_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_crops_data()
      WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.crop_id IS NULL THEN RETURN; END IF;

    v_qual := _npc_weighted_pick_text(
      ARRAY['good', 'epic', 'legendary'],
      ARRAY[
        75.0,
        CASE WHEN p_level >=  8 THEN 20.0 ELSE 0 END,
        CASE WHEN p_level >= 10 THEN  5.0 ELSE 0 END
      ]
    );
    SELECT qmin, qmax INTO v_qmin, v_qmax
      FROM _npc_crop_qty_range(v_qual, v_chosen.unlock_lvl);
    IF v_qmin IS NULL THEN RETURN; END IF;
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
    v_mult := _npc_quality_mult(v_qual);
    v_base := v_chosen.base_price * v_mult;
    RETURN QUERY SELECT v_chosen.crop_id || '_' || v_qual, v_qty, v_base * v_qty;

  -- ── FRUIT ─────────────────────────────────────────────────────────────────
  ELSIF v_cat = 'fruit' THEN
    SELECT fruit_id, unlock_lvl, base_price INTO v_chosen
      FROM _npc_fruits_data()
      WHERE unlock_lvl <= p_level
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.fruit_id IS NULL THEN RETURN; END IF;

    v_qual := _npc_weighted_pick_text(
      ARRAY['zwykly', 'soczysty', 'zloty'],
      ARRAY[
        80.0,
        CASE WHEN p_level >= 14 THEN 17.0 ELSE 0 END,
        CASE WHEN p_level >= 16 THEN  3.0 ELSE 0 END
      ]
    );
    SELECT qmin, qmax INTO v_qmin, v_qmax
      FROM _npc_fruit_qty_range(v_qual, v_chosen.unlock_lvl);
    IF v_qmin IS NULL THEN RETURN; END IF;
    v_qty  := _npc_rand_int(v_qmin, v_qmax);
    v_mult := _npc_quality_mult(v_qual);
    v_base := v_chosen.base_price * v_mult;
    RETURN QUERY SELECT v_chosen.fruit_id || '_' || v_qual, v_qty, v_base * v_qty;

  -- ── ANIMAL ────────────────────────────────────────────────────────────────
  ELSIF v_cat = 'animal' THEN
    SELECT a.item_id, a.unlock_lvl, a.base_price INTO v_chosen
      FROM _npc_animal_data() a
      WHERE a.unlock_lvl <= p_level
        AND a.unlock_lvl <= v_unlock_cap   -- ◆ FILTR: max item dla tego typu klienta
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.item_id IS NULL THEN RETURN; END IF;

    SELECT qmin, qmax INTO v_qmin, v_qmax
      FROM _npc_animal_qty_range(v_chosen.unlock_lvl, p_level);
    v_qty := _npc_rand_int(v_qmin, v_qmax);

    -- ◆ HARD CAP: LEAST(qty, cap_dla_tego_typu_i_tieru)
    v_cap := _npc_animal_qty_cap(p_ctype, v_chosen.unlock_lvl);
    v_qty := LEAST(v_qty, v_cap);

    v_base := v_chosen.base_price;
    RETURN QUERY SELECT v_chosen.item_id, v_qty, v_base * v_qty;

  -- ── HONEY ─────────────────────────────────────────────────────────────────
  ELSIF v_cat = 'honey' THEN
    v_qty := _npc_rand_int(1, 8);
    RETURN QUERY SELECT 'honey_jar'::TEXT, v_qty, 12.0 * v_qty;

  -- ── COMPOST ───────────────────────────────────────────────────────────────
  ELSE
    SELECT c.item_id, c.base_price, c.qty_min, c.qty_max INTO v_chosen
      FROM _npc_compost_data() c
      ORDER BY random() LIMIT 1;
    IF v_chosen IS NULL OR v_chosen.item_id IS NULL THEN RETURN; END IF;
    v_qty := _npc_rand_int(v_chosen.qty_min, v_chosen.qty_max);
    RETURN QUERY SELECT v_chosen.item_id, v_qty, v_chosen.base_price * v_qty;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION _npc_pick_item(INT, TEXT) TO anon, authenticated;


-- ─── 5. spawn_customer_order — przekazuje v_ctype do _npc_pick_item ────────
-- Jedyna logiczna zmiana względem exp_scaling_v2: jedna linia:
--   PRZED: SELECT * INTO v_pick FROM _npc_pick_item(v_level) LIMIT 1;
--   PO:    SELECT * INTO v_pick FROM _npc_pick_item(v_level, v_ctype) LIMIT 1;
--
-- Zachowuje w całości:
--   • gold ×0.22
--   • EXP: GREATEST(base_exp, min_exp) z min_exp_pct v2
--   • _npc_merge_items (anty-duplikaty)
--   • bonus no-duplicate check
--   • blokadę security: auth.uid() check + REVOKE
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

  -- Tylko typy z min_level <= v_level, wagi interpolowane wg poziomu gracza
  SELECT array_agg(ctype ORDER BY ctype),
         array_agg(_npc_lvl_weight(v_level, weight_min, weight_max) ORDER BY ctype)
    INTO v_types_id, v_types_w
    FROM _npc_customer_types()
   WHERE min_level <= v_level;

  IF v_types_id IS NULL OR array_length(v_types_id, 1) = 0 THEN
    RETURN NULL;
  END IF;

  v_ctype   := _npc_weighted_pick_text(v_types_id, v_types_w);
  SELECT * INTO v_t FROM _npc_customer_types() WHERE ctype = v_ctype LIMIT 1;
  v_n_items := _npc_rand_int(v_t.items_min, v_t.items_max);

  -- Generuj N pozycji — anti-dup: max 10 prób na slot
  FOR i IN 1..v_n_items LOOP
    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      -- ◆ ZMIANA: przekazujemy v_ctype do _npc_pick_item
      SELECT * INTO v_pick FROM _npc_pick_item(v_level, v_ctype) LIMIT 1;
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

  -- Gold: 0.22 — bez zmian
  v_gold := round((v_total * v_t.mult * 0.22)::NUMERIC, 2);

  -- EXP: GREATEST(base_exp, min_exp) — zachowana logika v2
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


-- ═══════════════════════════════════════════════════════════════════════════
-- TESTY WERYFIKACYJNE
-- Wklej każdy blok osobno w Supabase SQL Editor i sprawdź wyniki.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── TEST 1: Dozwolone kategorie per typ klienta — poziomy kluczowe ────────
-- Oczekiwania:
--   neighbor/village_guest: zawsze tylko {crop}
--   small_market: {crop,animal} (animal=tylko jajko via unlock_cap)
--   village_shop: {crop,animal}
--   restaurant lvl<10: {crop,animal}; lvl>=10: {crop,animal,fruit,honey}
--   wholesaler: {crop,animal,fruit,honey}
--   market_chain+: {crop,animal,fruit,honey,compost}
SELECT
  ctype,
  _npc_allowed_categories(ctype, 1)  AS lvl1,
  _npc_allowed_categories(ctype, 3)  AS lvl3,
  _npc_allowed_categories(ctype, 5)  AS lvl5,
  _npc_allowed_categories(ctype, 8)  AS lvl8,
  _npc_allowed_categories(ctype, 10) AS lvl10,
  _npc_allowed_categories(ctype, 12) AS lvl12,
  _npc_allowed_categories(ctype, 16) AS lvl16,
  _npc_allowed_categories(ctype, 20) AS lvl20,
  _npc_allowed_categories(ctype, 25) AS lvl25
FROM _npc_customer_types()
ORDER BY min_level;


-- ─── TEST 2: Unlock cap zwierzęcia per typ klienta ────────────────────────
-- Oczekiwania:
--   neighbor=0, village_guest=0
--   small_market=3 (tylko jajko)
--   village_shop=5 (jajko+futro)
--   restaurant=15, wholesaler=20, market_chain+=25
SELECT
  ctype,
  _npc_animal_unlock_cap(ctype) AS unlock_cap,
  CASE _npc_animal_unlock_cap(ctype)
    WHEN 0  THEN 'zakaz'
    WHEN 3  THEN 'jajko only'
    WHEN 5  THEN 'jajko + futro_krolika'
    WHEN 15 THEN 'do mleko_kozie'
    WHEN 20 THEN 'do energia_robocza'
    WHEN 25 THEN 'wszystkie'
  END AS opis
FROM _npc_customer_types()
ORDER BY min_level;


-- ─── TEST 3: Hard cap ilości per typ i tier zwierzęcia ────────────────────
-- Oczekiwania wg zatwierdzonego planu.
SELECT
  ctype,
  _npc_animal_qty_cap(ctype,  3) AS cap_jajko,
  _npc_animal_qty_cap(ctype,  5) AS cap_futro,
  _npc_animal_qty_cap(ctype,  9) AS cap_piora,
  _npc_animal_qty_cap(ctype, 13) AS cap_nawoz,
  _npc_animal_qty_cap(ctype, 20) AS cap_energia,
  _npc_animal_qty_cap(ctype, 25) AS cap_rogi
FROM _npc_customer_types()
ORDER BY min_level;

-- Oczekiwane wartości:
--   village_shop:            5,  3, n/a, n/a, n/a, n/a
--   restaurant:              8,  8,   3,   2, n/a, n/a
--   wholesaler:             12, 12,   8,   5,   3, n/a
--   market_chain:           20, 20,  12,   8,   5,   3
--   distribution_center:    30, 30,  18,  12,   8,   5
--   international_contract: 40, 40,  25,  16,  10,   6


-- ─── TEST 4: Neighbor NIE ma kategorii animal ─────────────────────────────
-- Oczekiwanie: animal = false dla neighbor i village_guest
SELECT
  ctype,
  'animal' = ANY(_npc_allowed_categories(ctype, 1))  AS has_animal_lvl1,
  'animal' = ANY(_npc_allowed_categories(ctype, 10)) AS has_animal_lvl10,
  'animal' = ANY(_npc_allowed_categories(ctype, 25)) AS has_animal_lvl25
FROM _npc_customer_types()
ORDER BY min_level;
-- neighbor: false/false/false ✓
-- village_guest: false/false/false ✓
-- small_market: true/true/true ✓ (ale z unlock_cap=3)
-- restaurant: true/true/true ✓


-- ─── TEST 5: Small_market — animal tylko do unlock_cap=3 ─────────────────
-- Oczekiwanie: small_market może losować z animal, ale unlock_cap=3
-- → tylko jajko (unlock=3); futro_krolika (unlock=5) poza zasięgiem
SELECT
  a.item_id,
  a.unlock_lvl,
  'small_market' AS ctype,
  _npc_animal_unlock_cap('small_market') AS unlock_cap,
  a.unlock_lvl <= _npc_animal_unlock_cap('small_market') AS eligible
FROM _npc_animal_data() a
ORDER BY a.unlock_lvl;
-- jajko (3): eligible=true ✓
-- futro_krolika (5): eligible=false ✓
-- mleko (7) i wyżej: eligible=false ✓


-- ─── TEST 6: Village_shop — animal tylko do unlock_cap=5 ─────────────────
SELECT
  a.item_id,
  a.unlock_lvl,
  'village_shop' AS ctype,
  _npc_animal_unlock_cap('village_shop') AS unlock_cap,
  a.unlock_lvl <= _npc_animal_unlock_cap('village_shop') AS eligible
FROM _npc_animal_data() a
ORDER BY a.unlock_lvl;
-- jajko (3): eligible=true ✓
-- futro_krolika (5): eligible=true ✓
-- mleko (7) i wyżej: eligible=false ✓


-- ─── TEST 7: Weryfikacja że stara sygnatura _npc_pick_item(INT) znikła ────
-- Oczekiwanie: powinien zwrócić 0 wierszy (stara funkcja usunięta)
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = '_npc_pick_item';
-- Powinien być TYLKO wpis z args: 'integer, text'
-- Brak wpisu z args: 'integer'


-- ─── TEST 8: Próbny spawn (zastąp USER_ID) ───────────────────────────────
-- Uruchom kilka razy i sprawdź czy neighbor dostaje tylko crop
-- SELECT tick_customer_orders('TWOJ_USER_ID'::UUID);
-- SELECT customer_type, items FROM customer_orders
--   WHERE user_id = 'TWOJ_USER_ID'::UUID AND expires_at > NOW()
--   ORDER BY created_at DESC LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════════
-- KONIEC
-- ═══════════════════════════════════════════════════════════════════════════
