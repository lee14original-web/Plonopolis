-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: NOWA PROGRESJA ZWIERZĄT — v1
-- ───────────────────────────────────────────────────────────────────────────
-- Cel:
--   Uporządkowanie kolejności zwierząt do logicznej progresji.
--   Świnia przeniesiona na lvl 9 (przed Krową), Krowa na lvl 11,
--   Kaczka na lvl 5 (przed Królikiem lvl 7).
--
-- Nowa kolejność unlock_lvl (odpowiada animals.ts):
--   jajko           unlock=3   (Kura,   4h)
--   piora           unlock=5   (Kaczka, 6h)
--   futro_krolika   unlock=7   (Królik, 10h)
--   nawoz_naturalny unlock=9   (Świnia, 14h)
--   mleko           unlock=11  (Krowa,  20h)
--   welna           unlock=13  (Owca,   24h)
--   mleko_kozie     unlock=15  (Koza,   30h)
--   duze_piora      unlock=17  (Indyk,  36h)
--   energia_robocza unlock=20  (Koń,    48h)
--   rogi_byka       unlock=25  (Byk,    72h)
--
-- Zmienione funkcje:
--   1. _npc_animal_data()         — nowe unlock_lvl + base_price + qty ranges
--   2. _npc_animal_unlock_cap()   — village_shop: 5→7
--   3. _npc_animal_qty_cap()      — village_shop nowy tier piora(≤5); restaurant
--                                   nowe progi wg nowego unlock mappingu
--
-- NIE zmienia:
--   • _npc_pick_item, spawn_customer_order, tick_customer_orders
--   • _npc_allowed_categories, _npc_crop_qty_range, _npc_fruit_qty_range
--   • _npc_animal_qty_range (wywoływana wewnątrz _npc_pick_item; progi opierają
--     się na p_level gracza, nie na kolejności zwierząt)
--   • gold/EXP multiplier, schemat tabel, istniejące zamówienia
--   • inventory graczy, posiadane zwierzęta w profilach
--
-- Idempotentny — bezpieczne do wielokrotnego uruchomienia.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. _npc_animal_data() — nowy unlock_lvl, base_price, qty ranges ───────
-- Kolejność wierszy odpowiada nowej progresji frontendowej (animals.ts).
-- qty_min/qty_max skalują się malejąco z pozycją unlock_lvl (wyższy tier = rzadszy)
CREATE OR REPLACE FUNCTION _npc_animal_data()
RETURNS TABLE(item_id TEXT, unlock_lvl INT, base_price NUMERIC, qty_min INT, qty_max INT)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('jajko',            3,   40::NUMERIC, 2, 12),
    ('piora',            5,   70::NUMERIC, 1,  8),
    ('futro_krolika',    7,  120::NUMERIC, 1,  6),
    ('nawoz_naturalny',  9,  190::NUMERIC, 1,  5),
    ('mleko',           11,  320::NUMERIC, 1,  4),
    ('welna',           13,  450::NUMERIC, 1,  3),
    ('mleko_kozie',     15,  650::NUMERIC, 1,  3),
    ('duze_piora',      17,  900::NUMERIC, 1,  2),
    ('energia_robocza', 20, 1400::NUMERIC, 1,  2),
    ('rogi_byka',       25, 2500::NUMERIC, 1,  1)
  ) AS t(item_id, unlock_lvl, base_price, qty_min, qty_max);
$$;

GRANT EXECUTE ON FUNCTION _npc_animal_data() TO anon, authenticated;


-- ─── 2. _npc_animal_unlock_cap() — zaktualizowane progi per typ klienta ────
-- Zmiana względem v1:
--   village_shop: 5 → 7 (teraz widzi jajko + pióra + futro_krolika)
--   Mapowanie unlock → item po nowej progresji:
--     unlock=3:  jajko           (Kura)
--     unlock=5:  piora           (Kaczka)
--     unlock=7:  futro_krolika   (Królik)
--     unlock=9:  nawoz_naturalny (Świnia)
--     unlock=11: mleko           (Krowa)
--     unlock=13: welna           (Owca)
--     unlock=15: mleko_kozie     (Koza)
--     unlock=17: duze_piora      (Indyk)
--     unlock=20: energia_robocza (Koń)
--     unlock=25: rogi_byka       (Byk)
CREATE OR REPLACE FUNCTION _npc_animal_unlock_cap(p_ctype TEXT)
RETURNS INT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_ctype
    WHEN 'neighbor'                 THEN 0    -- zakaz (brak kategorii animal)
    WHEN 'village_guest'            THEN 0    -- zakaz
    WHEN 'small_market'             THEN 3    -- tylko jajko (unlock=3)
    WHEN 'village_shop'             THEN 7    -- jajko + pióra + futro (unlock≤7)
    WHEN 'restaurant'               THEN 15   -- do mleko_kozie (unlock≤15)
    WHEN 'wholesaler'               THEN 20   -- do energia_robocza (unlock≤20)
    WHEN 'market_chain'             THEN 25   -- wszystkie
    WHEN 'distribution_center'      THEN 25
    WHEN 'international_contract'   THEN 25
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION _npc_animal_unlock_cap(TEXT) TO anon, authenticated;


-- ─── 3. _npc_animal_qty_cap() — hard cap ilości wg nowych progów unlock ────
-- Progi dostosowane do nowego mappingu:
--   unlock ≤5:  jajko (3) + pióra (5)
--   unlock ≤10: futro (7) + nawoz (9)
--   unlock ≤15: mleko (11) + welna (13) + mleko_kozie (15)
--   unlock ≤20: duze_piora (17) + energia (20)
--   unlock ≤25: rogi_byka (25)
CREATE OR REPLACE FUNCTION _npc_animal_qty_cap(p_ctype TEXT, p_unlock INT)
RETURNS INT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_ctype

    WHEN 'village_shop' THEN
      CASE WHEN p_unlock <= 3 THEN 5   -- jajko: max 5
           WHEN p_unlock <= 5 THEN 5   -- piora: max 5
           WHEN p_unlock <= 7 THEN 3   -- futro_krolika: max 3
           ELSE 1
      END

    WHEN 'restaurant' THEN
      CASE WHEN p_unlock <=  5 THEN  8  -- jajko (3), piora (5)
           WHEN p_unlock <= 10 THEN  3  -- futro (7), nawoz (9)
           WHEN p_unlock <= 15 THEN  2  -- mleko (11), welna (13), mleko_kozie (15)
           ELSE 1
      END

    WHEN 'wholesaler' THEN
      CASE WHEN p_unlock <=  5 THEN 12  -- jajko, piora
           WHEN p_unlock <= 10 THEN  8  -- futro, nawoz
           WHEN p_unlock <= 15 THEN  5  -- mleko, welna, mleko_kozie
           WHEN p_unlock <= 20 THEN  3  -- duze_piora, energia
           ELSE 1
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

    ELSE 1  -- neighbor/village_guest/small_market: zakaz animal przez unlock_cap

  END;
$$;

GRANT EXECUTE ON FUNCTION _npc_animal_qty_cap(TEXT, INT) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- TESTY WERYFIKACYJNE
-- Wklej każdy blok osobno w Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── TEST 1: Weryfikacja nowej kolejności _npc_animal_data() ───────────────
-- Oczekiwanie: 10 wierszy, unlock_lvl rosnąco: 3,5,7,9,11,13,15,17,20,25
SELECT item_id, unlock_lvl, base_price, qty_min, qty_max
  FROM _npc_animal_data()
 ORDER BY unlock_lvl;

-- Oczekiwany wynik:
--   item_id            | unlock_lvl | base_price | qty_min | qty_max
--   jajko              |          3 |         40 |       2 |      12
--   piora              |          5 |         70 |       1 |       8
--   futro_krolika      |          7 |        120 |       1 |       6
--   nawoz_naturalny    |          9 |        190 |       1 |       5
--   mleko              |         11 |        320 |       1 |       4
--   welna              |         13 |        450 |       1 |       3
--   mleko_kozie        |         15 |        650 |       1 |       3
--   duze_piora         |         17 |        900 |       1 |       2
--   energia_robocza    |         20 |       1400 |       1 |       2
--   rogi_byka          |         25 |       2500 |       1 |       1


-- ─── TEST 2: Unlock cap per typ klienta ───────────────────────────────────
-- Oczekiwanie: village_shop=7 (zmiana z 5), reszta bez zmian
SELECT
  ctype,
  _npc_animal_unlock_cap(ctype) AS unlock_cap,
  CASE _npc_animal_unlock_cap(ctype)
    WHEN 0  THEN 'zakaz'
    WHEN 3  THEN 'tylko jajko'
    WHEN 7  THEN 'jajko + pióra + futro'
    WHEN 15 THEN 'do mleko_kozie'
    WHEN 20 THEN 'do energia_robocza'
    WHEN 25 THEN 'wszystkie'
  END AS opis
FROM _npc_customer_types()
ORDER BY min_level;

-- Oczekiwany wynik (kluczowe):
--   neighbor:        0  → zakaz
--   village_guest:   0  → zakaz
--   small_market:    3  → tylko jajko
--   village_shop:    7  → jajko + pióra + futro  ← zmiana z 5
--   restaurant:     15  → do mleko_kozie
--   wholesaler:     20  → do energia_robocza
--   market_chain:   25  → wszystkie


-- ─── TEST 3: Hard cap ilości — village_shop (3 nowe tiry) ─────────────────
SELECT
  _npc_animal_qty_cap('village_shop', 3)  AS cap_jajko,    -- oczekiwane: 5
  _npc_animal_qty_cap('village_shop', 5)  AS cap_piora,    -- oczekiwane: 5 (NEW)
  _npc_animal_qty_cap('village_shop', 7)  AS cap_futro,    -- oczekiwane: 3 (NEW)
  _npc_animal_qty_cap('village_shop', 9)  AS cap_nawoz,    -- oczekiwane: 1 (poza cap=7)
  _npc_animal_qty_cap('village_shop', 11) AS cap_mleko;    -- oczekiwane: 1


-- ─── TEST 4: Hard cap ilości — restaurant (nowe progi unlock) ─────────────
SELECT
  _npc_animal_qty_cap('restaurant',  3) AS cap_jajko,    -- oczekiwane: 8
  _npc_animal_qty_cap('restaurant',  5) AS cap_piora,    -- oczekiwane: 8
  _npc_animal_qty_cap('restaurant',  7) AS cap_futro,    -- oczekiwane: 3
  _npc_animal_qty_cap('restaurant',  9) AS cap_nawoz,    -- oczekiwane: 3
  _npc_animal_qty_cap('restaurant', 11) AS cap_mleko,    -- oczekiwane: 2
  _npc_animal_qty_cap('restaurant', 13) AS cap_welna,    -- oczekiwane: 2
  _npc_animal_qty_cap('restaurant', 15) AS cap_m_kozie,  -- oczekiwane: 2
  _npc_animal_qty_cap('restaurant', 17) AS cap_duze;     -- oczekiwane: 1 (poza cap=15)


-- ─── TEST 5: Hard cap ilości — market_chain i wyższe (pełna tabela) ───────
SELECT
  ctype,
  _npc_animal_qty_cap(ctype,  3) AS cap_unlock3,   -- jajko
  _npc_animal_qty_cap(ctype,  5) AS cap_unlock5,   -- piora
  _npc_animal_qty_cap(ctype,  9) AS cap_unlock9,   -- nawoz
  _npc_animal_qty_cap(ctype, 11) AS cap_unlock11,  -- mleko
  _npc_animal_qty_cap(ctype, 17) AS cap_unlock17,  -- duze_piora
  _npc_animal_qty_cap(ctype, 25) AS cap_unlock25   -- rogi_byka
FROM _npc_customer_types()
WHERE ctype IN ('wholesaler', 'market_chain', 'distribution_center', 'international_contract')
ORDER BY min_level;

-- Oczekiwany wynik (unlock=3 / 5 / 9 / 11 / 17 / 25):
--   wholesaler:             12 / 12 / 8 / 5 / 3 / 1
--   market_chain:           20 / 20 / 12 / 8 / 5 / 3
--   distribution_center:    30 / 30 / 18 / 12 / 8 / 5
--   international_contract: 40 / 40 / 25 / 16 / 10 / 6


-- ─── TEST 6: small_market — nadal widzi tylko jajko ───────────────────────
SELECT
  a.item_id,
  a.unlock_lvl,
  _npc_animal_unlock_cap('small_market') AS cap,
  a.unlock_lvl <= _npc_animal_unlock_cap('small_market') AS eligible
FROM _npc_animal_data() a
ORDER BY a.unlock_lvl;
-- Oczekiwanie: tylko jajko (unlock=3) eligible=true, reszta false


-- ─── TEST 7: village_shop — widzi jajko + pióra + futro ──────────────────
SELECT
  a.item_id,
  a.unlock_lvl,
  _npc_animal_unlock_cap('village_shop') AS cap,
  a.unlock_lvl <= _npc_animal_unlock_cap('village_shop') AS eligible
FROM _npc_animal_data() a
ORDER BY a.unlock_lvl;
-- Oczekiwanie: jajko(3), piora(5), futro(7) eligible=true; nawoz(9) i wyżej false


-- ─── TEST 8: Próbny spawn (zastąp USER_ID) ───────────────────────────────
-- Uruchom kilka razy po wgraniu SQL, sprawdź typy produktów
-- SELECT tick_customer_orders('TWOJ_USER_ID'::UUID);
-- SELECT customer_type, items FROM customer_orders
--   WHERE user_id = 'TWOJ_USER_ID'::UUID AND expires_at > NOW()
--   ORDER BY created_at DESC LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════════
-- KONIEC
-- Wgrać PO sql_fix_npc_category_filter_v1.sql (wymaga _npc_pick_item z nową
-- sygnaturą (INT, TEXT) i _npc_allowed_categories które już istnieją).
-- ═══════════════════════════════════════════════════════════════════════════
