-- ═══════════════════════════════════════════════════════════════════════════
-- PEŁNE BEZPIECZEŃSTWO v2 — SERWEROWE ZBIORY, ODBIORY I SPRZEDAŻ
-- Plonopolis Anti-Cheat: ZERO tolerancji na dodanie nawet 1 sztuki
--
-- Uruchomić JEDNORAZOWO w Supabase SQL Editor.
-- Zastępuje poprzednie wersje sync_fruit_inventory i sync_barn_items.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. NOWE KOLUMNY ────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS orchard_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS barn_state    JSONB NOT NULL DEFAULT '{}'::JSONB;

-- ─── 2. TRIGGER ANTI-TAMPER (rozszerzony o nowe kolumny) ────────────────────
-- Blokuje bezpośrednie modyfikacje chronionych kolumn z poziomu
-- authenticated/anon (PostgREST). Nasze SECURITY DEFINER RPCs działają
-- jako 'postgres' — trigger je przepuszcza.
CREATE OR REPLACE FUNCTION protect_inventory_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.barn_items IS DISTINCT FROM OLD.barn_items THEN
      RAISE EXCEPTION 'Direct update of barn_items not allowed. Use collect_animal() or collect_all_animals() RPC.';
    END IF;
    IF NEW.fruit_inventory IS DISTINCT FROM OLD.fruit_inventory THEN
      RAISE EXCEPTION 'Direct update of fruit_inventory not allowed. Use harvest_tree() or harvest_all_trees() RPC.';
    END IF;
    IF NEW.orchard_state IS DISTINCT FROM OLD.orchard_state THEN
      RAISE EXCEPTION 'Direct update of orchard_state not allowed. Use sync_orchard_owned() RPC.';
    END IF;
    IF NEW.barn_state IS DISTINCT FROM OLD.barn_state THEN
      RAISE EXCEPTION 'Direct update of barn_state not allowed. Use sync_barn_owned() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_inventory_columns_trg ON profiles;
CREATE TRIGGER protect_inventory_columns_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_columns();


-- ─── 3. HELPER: dane drzew ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _trees_data_srv()
RETURNS TABLE(tree_id TEXT, fruit_id TEXT, growth_time_ms BIGINT, drop_min INT, drop_max INT, price_per_fruit NUMERIC)
LANGUAGE SQL STABLE SET search_path = public AS $$
  SELECT * FROM (VALUES
    ('jablon',      'jablko',       (4*3600000)::BIGINT,  10, 14,  20::NUMERIC),
    ('grusza',      'gruszka',      (6*3600000)::BIGINT,   9, 12,  35::NUMERIC),
    ('sliwa',       'sliwka',       (8*3600000)::BIGINT,   8, 10,  55::NUMERIC),
    ('wisnia',      'wisnia',      (10*3600000)::BIGINT,   7,  9,  80::NUMERIC),
    ('czeresnia',   'czeresnia',   (12*3600000)::BIGINT,   6,  8, 110::NUMERIC),
    ('brzoskwinia', 'brzoskwinia', (14*3600000)::BIGINT,   5,  7, 150::NUMERIC),
    ('morela',      'morela',      (16*3600000)::BIGINT,   4,  6, 220::NUMERIC),
    ('pomarancza',  'pomarancza',  (18*3600000)::BIGINT,   3,  5, 320::NUMERIC),
    ('cytryna',     'cytryna',     (24*3600000)::BIGINT,   2,  4, 500::NUMERIC)
  ) AS t(tree_id, fruit_id, growth_time_ms, drop_min, drop_max, price_per_fruit)
$$;

-- ─── 4. HELPER: dane zwierząt ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _animals_data_srv()
RETURNS TABLE(animal_id TEXT, item_id TEXT, prod_ms BIGINT, storage_max INT, max_slots INT)
LANGUAGE SQL STABLE SET search_path = public AS $$
  SELECT * FROM (VALUES
    ('kura',   'jajko',            (4*3600000)::BIGINT, 6, 12),
    ('krolik', 'futro_krolika',    (8*3600000)::BIGINT, 5, 10),
    ('krowa',  'mleko',           (12*3600000)::BIGINT, 4,  8),
    ('kaczka', 'piora',           (16*3600000)::BIGINT, 4,  8),
    ('owca',   'welna',           (20*3600000)::BIGINT, 3,  6),
    ('swinia', 'nawoz_naturalny', (24*3600000)::BIGINT, 3,  5),
    ('koza',   'mleko_kozie',     (30*3600000)::BIGINT, 2,  4),
    ('indyk',  'duze_piora',      (36*3600000)::BIGINT, 2,  4),
    ('kon',    'energia_robocza', (48*3600000)::BIGINT, 2,  3),
    ('byk',    'rogi_byka',       (72*3600000)::BIGINT, 1,  2)
  ) AS t(animal_id, item_id, prod_ms, storage_max, max_slots)
$$;

-- ─── 5. HELPER: limit drzew wg poziomu ────────────────────────────────────
CREATE OR REPLACE FUNCTION _get_max_tree_slots_srv(p_level INT)
RETURNS INT LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_level >= 25 THEN 8
    WHEN p_level >= 20 THEN 6
    WHEN p_level >= 15 THEN 4
    WHEN p_level >= 10 THEN 2
    ELSE 0
  END
$$;

-- ─── 6. HELPER: rzut jakości owocu ────────────────────────────────────────
-- Replikacja rollFruitQuality(luckPct) z klienta (Game.tsx linia ~735).
-- luckPct = calcStatEffect(szczescie, 0.0025) — liczba procentowa, np. 5.0
CREATE OR REPLACE FUNCTION _roll_fruit_quality_srv(p_luck_pct NUMERIC DEFAULT 0)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  v_r        NUMERIC;
  v_lf       NUMERIC;
  v_zloty    NUMERIC;
  v_soczysty NUMERIC;
BEGIN
  v_r := random();
  IF v_r < 0.10 THEN RETURN 'zgnile'; END IF;
  v_lf       := 1.0 + GREATEST(0, p_luck_pct) / 100.0;
  v_zloty    := LEAST(0.50, 0.03 * v_lf);
  v_soczysty := LEAST(0.60, 0.12 * v_lf);
  -- rr = znormalizowany wynik po odjęciu zgniłego
  IF (v_r - 0.10) / 0.90 < v_zloty              THEN RETURN 'zloty';    END IF;
  IF (v_r - 0.10) / 0.90 < v_zloty + v_soczysty THEN RETURN 'soczysty'; END IF;
  RETURN 'zwykly';
END $$;

-- ─── 7. HELPER: mnożnik ceny jakości ──────────────────────────────────────
CREATE OR REPLACE FUNCTION _fruit_quality_mult_srv(p_quality TEXT)
RETURNS NUMERIC LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_quality
    WHEN 'zloty'    THEN 5
    WHEN 'soczysty' THEN 2
    WHEN 'zwykly'   THEN 1
    ELSE 0
  END::NUMERIC
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. harvest_tree — serwerowy zbiór owoców z jednego drzewa
-- ═══════════════════════════════════════════════════════════════════════════
-- Czyta orchardState z DB, liczy czas z CLOCK_TIMESTAMP() serwera,
-- losuje owoce (z bonusami Sadownik i Szczęście ze stats gracza),
-- dodaje do fruit_inventory, aktualizuje prodStart.
-- Equip bonusy (% speed drzew, % bonus drop) są ignorowane server-side
-- (charEquipped nie jest w DB) — kompromis: bezpieczeństwo > bonusy eq.
CREATE OR REPLACE FUNCTION harvest_tree(p_user_id UUID, p_tree_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tree       RECORD;
  v_profile    RECORD;
  v_orch       JSONB;
  v_ts         JSONB;
  v_owned      INT;
  v_prod_ms    BIGINT;
  v_now_ms     BIGINT;
  v_elapsed    BIGINT;
  v_sadownik   NUMERIC;
  v_luck_val   NUMERIC;
  v_sadown_bon NUMERIC;
  v_luck_pct   NUMERIC;
  v_cycles     INT;
  v_c          INT;
  v_tn         INT;
  v_base_drop  INT;
  v_total_drop INT;
  v_fi         INT;
  v_quality    TEXT;
  v_fkey       TEXT;
  v_added      JSONB;
  v_fruit_inv  JSONB;
  v_new_pstart BIGINT;
  v_key        TEXT;
  v_val_txt    TEXT;
  STORAGE_CAP  CONSTANT INT := 5;
BEGIN
  -- Autoryzacja
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Dane drzewa (hardkodowane w SQL)
  SELECT * INTO v_tree FROM _trees_data_srv() WHERE tree_id = p_tree_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nieznany gatunek drzewa: %', p_tree_id;
  END IF;

  -- Profil z blokadą wierszową (zapobiega równoległym modyfikacjom)
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_orch    := COALESCE(v_profile.orchard_state, '{}'::JSONB);
  v_ts      := COALESCE(v_orch->p_tree_id, '{}'::JSONB);
  v_owned   := COALESCE((v_ts->>'owned')::INT, 0);
  v_prod_ms := COALESCE((v_ts->>'prodStart')::BIGINT, 0);

  IF v_owned = 0 THEN
    RAISE EXCEPTION 'Brak drzew gatunku "%" w bazie danych. Wywołaj sync_orchard_owned() po zakupie drzewa.', p_tree_id;
  END IF;

  v_now_ms  := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_elapsed := v_now_ms - v_prod_ms;

  -- prodStart = 0 oznacza nowe drzewo bez uruchomionego timera
  IF v_prod_ms = 0 OR v_elapsed < 0 THEN
    v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_now_ms));
    v_orch := jsonb_set(v_orch, ARRAY[p_tree_id], v_ts);
    UPDATE profiles SET orchard_state = v_orch WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'ok', true, 'added', '{}'::JSONB,
      'new_prod_start', v_now_ms,
      'new_fruit_inventory', COALESCE(v_profile.fruit_inventory, '{}'::JSONB)
    );
  END IF;

  -- Statystyki gracza (player_stats JSONB z profilu)
  -- calcStatEffect(val, rate): eff = val<=50 ? val : 50+(val-50)*0.5; return round(eff*rate*1000)/10
  v_sadownik   := COALESCE((v_profile.player_stats->>'sadownik')::NUMERIC, 0);
  v_luck_val   := COALESCE((v_profile.player_stats->>'szczescie')::NUMERIC, 0);
  v_sadown_bon := (CASE WHEN v_sadownik <= 50 THEN v_sadownik
                        ELSE 50 + (v_sadownik - 50) * 0.5 END
                  * 0.005 * 1000.0 / 10.0) / 100.0;
  v_luck_pct   := CASE WHEN v_luck_val <= 50 THEN v_luck_val
                        ELSE 50 + (v_luck_val - 50) * 0.5 END
                  * 0.0025 * 1000.0 / 10.0;

  -- Liczba pełnych cykli (max STORAGE_CAP = 5)
  v_cycles := LEAST(FLOOR(v_elapsed / v_tree.growth_time_ms)::INT, STORAGE_CAP);

  IF v_cycles <= 0 THEN
    RETURN jsonb_build_object(
      'ok', true, 'added', '{}'::JSONB,
      'new_prod_start', v_prod_ms,
      'new_fruit_inventory', COALESCE(v_profile.fruit_inventory, '{}'::JSONB)
    );
  END IF;

  -- Generuj owoce (cykl × drzewa × losowy drop × rzut jakości)
  v_added     := '{}'::JSONB;
  v_fruit_inv := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);

  FOR v_c IN 1..v_cycles LOOP
    FOR v_tn IN 1..v_owned LOOP
      v_base_drop  := v_tree.drop_min
                      + (FLOOR(random() * (v_tree.drop_max - v_tree.drop_min + 1)))::INT;
      v_total_drop := GREATEST(1, ROUND(v_base_drop * (1.0 + v_sadown_bon))::INT);
      FOR v_fi IN 1..v_total_drop LOOP
        v_quality := _roll_fruit_quality_srv(v_luck_pct);
        v_fkey    := v_tree.fruit_id || '_' || v_quality;
        v_added   := jsonb_set(v_added, ARRAY[v_fkey],
                       to_jsonb(COALESCE((v_added->>v_fkey)::INT, 0) + 1));
      END LOOP;
    END LOOP;
  END LOOP;

  -- Dodaj zebrane owoce do fruit_inventory
  FOR v_key, v_val_txt IN SELECT key, value FROM jsonb_each_text(v_added) LOOP
    v_fruit_inv := jsonb_set(v_fruit_inv, ARRAY[v_key],
                    to_jsonb(COALESCE((v_fruit_inv->>v_key)::INT, 0) + v_val_txt::INT));
  END LOOP;

  -- Zaktualizuj prodStart (zachowaj resztę nieskończonego cyklu)
  v_new_pstart := v_prod_ms + v_cycles::BIGINT * v_tree.growth_time_ms;
  v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_new_pstart));
  v_orch := jsonb_set(v_orch, ARRAY[p_tree_id], v_ts);

  UPDATE profiles SET
    fruit_inventory = v_fruit_inv,
    orchard_state   = v_orch
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',                  true,
    'added',               v_added,
    'new_prod_start',      v_new_pstart,
    'new_fruit_inventory', v_fruit_inv
  );
END $$;

GRANT EXECUTE ON FUNCTION harvest_tree(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. harvest_all_trees — zbiór ze wszystkich drzew naraz
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION harvest_all_trees(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tree       RECORD;
  v_profile    RECORD;
  v_orch       JSONB;
  v_ts         JSONB;
  v_owned      INT;
  v_prod_ms    BIGINT;
  v_now_ms     BIGINT;
  v_elapsed    BIGINT;
  v_sadownik   NUMERIC;
  v_luck_val   NUMERIC;
  v_sadown_bon NUMERIC;
  v_luck_pct   NUMERIC;
  v_cycles     INT;
  v_c          INT;
  v_tn         INT;
  v_base_drop  INT;
  v_total_drop INT;
  v_fi         INT;
  v_quality    TEXT;
  v_fkey       TEXT;
  v_added_t    JSONB;
  v_added_all  JSONB;
  v_fruit_inv  JSONB;
  v_new_pstart BIGINT;
  v_key        TEXT;
  v_val_txt    TEXT;
  v_results    JSONB;
  STORAGE_CAP  CONSTANT INT := 5;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_orch      := COALESCE(v_profile.orchard_state, '{}'::JSONB);
  v_fruit_inv := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_now_ms    := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_results   := '[]'::JSONB;
  v_added_all := '{}'::JSONB;

  v_sadownik   := COALESCE((v_profile.player_stats->>'sadownik')::NUMERIC, 0);
  v_luck_val   := COALESCE((v_profile.player_stats->>'szczescie')::NUMERIC, 0);
  v_sadown_bon := (CASE WHEN v_sadownik <= 50 THEN v_sadownik
                        ELSE 50 + (v_sadownik - 50) * 0.5 END
                  * 0.005 * 1000.0 / 10.0) / 100.0;
  v_luck_pct   := CASE WHEN v_luck_val <= 50 THEN v_luck_val
                        ELSE 50 + (v_luck_val - 50) * 0.5 END
                  * 0.0025 * 1000.0 / 10.0;

  FOR v_tree IN SELECT * FROM _trees_data_srv() LOOP
    v_ts      := COALESCE(v_orch->v_tree.tree_id, '{}'::JSONB);
    v_owned   := COALESCE((v_ts->>'owned')::INT, 0);
    v_prod_ms := COALESCE((v_ts->>'prodStart')::BIGINT, 0);

    IF v_owned = 0 THEN CONTINUE; END IF;

    v_elapsed := v_now_ms - v_prod_ms;

    IF v_prod_ms = 0 OR v_elapsed < 0 THEN
      v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_now_ms));
      v_orch := jsonb_set(v_orch, ARRAY[v_tree.tree_id], v_ts);
      CONTINUE;
    END IF;

    v_cycles := LEAST(FLOOR(v_elapsed / v_tree.growth_time_ms)::INT, STORAGE_CAP);
    IF v_cycles <= 0 THEN CONTINUE; END IF;

    v_added_t := '{}'::JSONB;

    FOR v_c IN 1..v_cycles LOOP
      FOR v_tn IN 1..v_owned LOOP
        v_base_drop  := v_tree.drop_min
                        + (FLOOR(random() * (v_tree.drop_max - v_tree.drop_min + 1)))::INT;
        v_total_drop := GREATEST(1, ROUND(v_base_drop * (1.0 + v_sadown_bon))::INT);
        FOR v_fi IN 1..v_total_drop LOOP
          v_quality  := _roll_fruit_quality_srv(v_luck_pct);
          v_fkey     := v_tree.fruit_id || '_' || v_quality;
          v_added_t  := jsonb_set(v_added_t, ARRAY[v_fkey],
                          to_jsonb(COALESCE((v_added_t->>v_fkey)::INT, 0) + 1));
          v_added_all := jsonb_set(v_added_all, ARRAY[v_fkey],
                          to_jsonb(COALESCE((v_added_all->>v_fkey)::INT, 0) + 1));
        END LOOP;
      END LOOP;
    END LOOP;

    FOR v_key, v_val_txt IN SELECT key, value FROM jsonb_each_text(v_added_t) LOOP
      v_fruit_inv := jsonb_set(v_fruit_inv, ARRAY[v_key],
                      to_jsonb(COALESCE((v_fruit_inv->>v_key)::INT, 0) + v_val_txt::INT));
    END LOOP;

    v_new_pstart := v_prod_ms + v_cycles::BIGINT * v_tree.growth_time_ms;
    v_ts   := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_new_pstart));
    v_orch := jsonb_set(v_orch, ARRAY[v_tree.tree_id], v_ts);

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'tree_id', v_tree.tree_id,
        'added',   v_added_t,
        'new_prod_start', v_new_pstart
      )
    );
  END LOOP;

  UPDATE profiles SET
    fruit_inventory = v_fruit_inv,
    orchard_state   = v_orch
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',                  true,
    'results',             v_results,
    'added_all',           v_added_all,
    'new_fruit_inventory', v_fruit_inv
  );
END $$;

GRANT EXECUTE ON FUNCTION harvest_all_trees(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. sell_fruits — atomowa sprzedaż wszystkich nie-zgniłych owoców
-- ═══════════════════════════════════════════════════════════════════════════
-- Czyta fruit_inventory z DB, liczy wartość po serwerowych cenach,
-- atomowo aktualizuje money i czyści inventory (zachowuje zgniłe).
CREATE OR REPLACE FUNCTION sell_fruits(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile   RECORD;
  v_fruit_inv JSONB;
  v_zgnile    JSONB;
  v_total_val NUMERIC;
  v_key       TEXT;
  v_qty_txt   TEXT;
  v_qty       INT;
  v_quality   TEXT;
  v_fruit_id  TEXT;
  v_tree      RECORD;
  v_new_money NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_fruit_inv := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_zgnile    := '{}'::JSONB;
  v_total_val := 0;

  FOR v_key, v_qty_txt IN SELECT key, value FROM jsonb_each_text(v_fruit_inv) LOOP
    v_qty := COALESCE(v_qty_txt::INT, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    -- Parsuj klucz: "owocId_jakosc" (ostatnie podkreślenie = separator)
    v_quality  := regexp_replace(v_key, '^.+_', '');
    v_fruit_id := regexp_replace(v_key, '_[^_]+$', '');

    IF v_quality = 'zgnile' THEN
      -- Zachowaj zgniłe — nie sprzedajemy
      v_zgnile := jsonb_set(v_zgnile, ARRAY[v_key], to_jsonb(v_qty));
      CONTINUE;
    END IF;

    SELECT price_per_fruit INTO v_tree FROM _trees_data_srv() WHERE fruit_id = v_fruit_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_total_val := v_total_val + v_qty * v_tree.price_per_fruit * _fruit_quality_mult_srv(v_quality);
  END LOOP;

  IF v_total_val = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Brak owoców do sprzedaży (zgniłe nie mają wartości)');
  END IF;

  v_new_money := ROUND((COALESCE(v_profile.money, 0) + v_total_val)::NUMERIC, 2);

  UPDATE profiles SET
    money           = v_new_money,
    fruit_inventory = v_zgnile
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',                  true,
    'sold_value',          v_total_val,
    'new_money',           v_new_money,
    'new_fruit_inventory', v_zgnile
  );
END $$;

GRANT EXECUTE ON FUNCTION sell_fruits(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. collect_animal — serwerowy odbiór produktów z jednego zwierzęcia
-- ═══════════════════════════════════════════════════════════════════════════
-- Serwer używa BASE prodMs (bez modyfikatora głodu) — konserwatywne i
-- bezpieczne. Czyta barn_state z DB, liczy czas serwera, dodaje do barn_items.
CREATE OR REPLACE FUNCTION collect_animal(p_user_id UUID, p_animal_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_animal     RECORD;
  v_profile    RECORD;
  v_bs         JSONB;
  v_ast        JSONB;
  v_owned      INT;
  v_prod_ms    BIGINT;
  v_now_ms     BIGINT;
  v_elapsed    BIGINT;
  v_cycles     INT;
  v_collected  INT;
  v_barn       JSONB;
  v_new_pstart BIGINT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_animal FROM _animals_data_srv() WHERE animal_id = p_animal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nieznane zwierzę: %', p_animal_id; END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_bs      := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_ast     := COALESCE(v_bs->p_animal_id, '{}'::JSONB);
  v_owned   := COALESCE((v_ast->>'owned')::INT, 0);
  v_prod_ms := COALESCE((v_ast->>'prodStart')::BIGINT, 0);

  IF v_owned = 0 THEN
    RAISE EXCEPTION 'Brak zwierząt gatunku "%" w bazie danych. Wywołaj sync_barn_owned() po zakupie zwierzęcia.', p_animal_id;
  END IF;

  v_now_ms  := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_elapsed := v_now_ms - v_prod_ms;

  IF v_prod_ms = 0 OR v_elapsed < 0 THEN
    v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_now_ms));
    v_bs  := jsonb_set(v_bs, ARRAY[p_animal_id], v_ast);
    UPDATE profiles SET barn_state = v_bs WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'ok', true, 'collected', 0, 'item_id', v_animal.item_id,
      'new_prod_start', v_now_ms,
      'new_barn_items', COALESCE(v_profile.barn_items, '{}'::JSONB)
    );
  END IF;

  -- Używamy BASE prodMs (bez głodu) — gracz nie może sfałszować timera
  v_cycles := LEAST(FLOOR(v_elapsed / v_animal.prod_ms)::INT, v_animal.storage_max);

  IF v_cycles <= 0 THEN
    RETURN jsonb_build_object(
      'ok', true, 'collected', 0, 'item_id', v_animal.item_id,
      'new_prod_start', v_prod_ms,
      'new_barn_items', COALESCE(v_profile.barn_items, '{}'::JSONB)
    );
  END IF;

  v_collected := v_cycles * LEAST(v_owned, v_animal.max_slots);
  v_barn      := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_barn      := jsonb_set(v_barn, ARRAY[v_animal.item_id],
                   to_jsonb(COALESCE((v_barn->>v_animal.item_id)::INT, 0) + v_collected));

  v_new_pstart := v_prod_ms + v_cycles::BIGINT * v_animal.prod_ms;
  v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_new_pstart));
  v_bs  := jsonb_set(v_bs, ARRAY[p_animal_id], v_ast);

  UPDATE profiles SET
    barn_items = v_barn,
    barn_state = v_bs
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'collected',      v_collected,
    'item_id',        v_animal.item_id,
    'new_prod_start', v_new_pstart,
    'new_barn_items', v_barn
  );
END $$;

GRANT EXECUTE ON FUNCTION collect_animal(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 12. collect_all_animals — odbiór produktów ze wszystkich zwierząt naraz
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION collect_all_animals(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_animal     RECORD;
  v_profile    RECORD;
  v_bs         JSONB;
  v_ast        JSONB;
  v_owned      INT;
  v_prod_ms    BIGINT;
  v_now_ms     BIGINT;
  v_elapsed    BIGINT;
  v_cycles     INT;
  v_collected  INT;
  v_barn       JSONB;
  v_new_pstart BIGINT;
  v_results    JSONB;
  v_total      INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_bs      := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_barn    := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_now_ms  := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_results := '[]'::JSONB;
  v_total   := 0;

  FOR v_animal IN SELECT * FROM _animals_data_srv() LOOP
    v_ast     := COALESCE(v_bs->v_animal.animal_id, '{}'::JSONB);
    v_owned   := COALESCE((v_ast->>'owned')::INT, 0);
    v_prod_ms := COALESCE((v_ast->>'prodStart')::BIGINT, 0);

    IF v_owned = 0 THEN CONTINUE; END IF;

    v_elapsed := v_now_ms - v_prod_ms;

    IF v_prod_ms = 0 OR v_elapsed < 0 THEN
      v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_now_ms));
      v_bs  := jsonb_set(v_bs, ARRAY[v_animal.animal_id], v_ast);
      CONTINUE;
    END IF;

    v_cycles := LEAST(FLOOR(v_elapsed / v_animal.prod_ms)::INT, v_animal.storage_max);
    IF v_cycles <= 0 THEN CONTINUE; END IF;

    v_collected := v_cycles * LEAST(v_owned, v_animal.max_slots);
    v_barn := jsonb_set(v_barn, ARRAY[v_animal.item_id],
               to_jsonb(COALESCE((v_barn->>v_animal.item_id)::INT, 0) + v_collected));

    v_new_pstart := v_prod_ms + v_cycles::BIGINT * v_animal.prod_ms;
    v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_new_pstart));
    v_bs  := jsonb_set(v_bs, ARRAY[v_animal.animal_id], v_ast);
    v_total := v_total + v_collected;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'animal_id',      v_animal.animal_id,
        'item_id',        v_animal.item_id,
        'collected',      v_collected,
        'new_prod_start', v_new_pstart
      )
    );
  END LOOP;

  UPDATE profiles SET
    barn_items = v_barn,
    barn_state = v_bs
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'results',        v_results,
    'total',          v_total,
    'new_barn_items', v_barn
  );
END $$;

GRANT EXECUTE ON FUNCTION collect_all_animals(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 13. sync_orchard_owned — synchronizacja liczby drzew po zakupie
-- ═══════════════════════════════════════════════════════════════════════════
-- Wywoływana gdy gracz kupuje drzewo. Aktualizuje owned w DB.
-- Server ustawia prodStart = NOW() jeśli był 0.
-- Nie można zmniejszyć owned (brak opcji sprzedaży drzew).
-- Walidacja: łączna liczba drzew <= limit wg poziomu.
CREATE OR REPLACE FUNCTION sync_orchard_owned(p_user_id UUID, p_tree_id TEXT, p_new_owned INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tree_ok    BOOLEAN;
  v_profile    RECORD;
  v_orch       JSONB;
  v_ts         JSONB;
  v_old_owned  INT;
  v_now_ms     BIGINT;
  v_prod_ms    BIGINT;
  v_total_now  INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_new_owned < 0 THEN RAISE EXCEPTION 'p_new_owned nie może być ujemny'; END IF;

  SELECT EXISTS(SELECT 1 FROM _trees_data_srv() WHERE tree_id = p_tree_id) INTO v_tree_ok;
  IF NOT v_tree_ok THEN RAISE EXCEPTION 'Nieznany gatunek drzewa: %', p_tree_id; END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_orch      := COALESCE(v_profile.orchard_state, '{}'::JSONB);
  v_ts        := COALESCE(v_orch->p_tree_id, '{}'::JSONB);
  v_old_owned := COALESCE((v_ts->>'owned')::INT, 0);
  v_prod_ms   := COALESCE((v_ts->>'prodStart')::BIGINT, 0);

  IF p_new_owned < v_old_owned THEN
    RAISE EXCEPTION 'Nie można zmniejszyć liczby drzew (% → %)', v_old_owned, p_new_owned;
  END IF;

  -- Sprawdź łączny limit (sumarycznie wszystkie gatunki + nowe)
  SELECT COALESCE(SUM(
    CASE WHEN (value->>'owned') IS NOT NULL
         THEN (value->>'owned')::INT ELSE 0 END
  ), 0) INTO v_total_now
  FROM jsonb_each(v_orch) WHERE key <> p_tree_id;
  v_total_now := v_total_now + p_new_owned;

  IF v_total_now > _get_max_tree_slots_srv(COALESCE(v_profile.level, 1)) THEN
    RAISE EXCEPTION 'Przekroczono limit drzew (%) dla poziomu %',
      _get_max_tree_slots_srv(COALESCE(v_profile.level, 1)), v_profile.level;
  END IF;

  v_now_ms := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_ts := jsonb_set(v_ts, ARRAY['owned'], to_jsonb(p_new_owned));
  IF v_prod_ms = 0 AND p_new_owned > 0 THEN
    v_ts := jsonb_set(v_ts, ARRAY['prodStart'], to_jsonb(v_now_ms));
  END IF;
  v_orch := jsonb_set(v_orch, ARRAY[p_tree_id], v_ts);
  UPDATE profiles SET orchard_state = v_orch WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'tree_id', p_tree_id, 'new_owned', p_new_owned);
END $$;

GRANT EXECUTE ON FUNCTION sync_orchard_owned(UUID, TEXT, INT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 14. sync_barn_owned — synchronizacja liczby zwierząt / slotów po zakupie
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sync_barn_owned(p_user_id UUID, p_animal_id TEXT, p_new_owned INT, p_new_slots INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_animal    RECORD;
  v_profile   RECORD;
  v_bs        JSONB;
  v_ast       JSONB;
  v_old_owned INT;
  v_now_ms    BIGINT;
  v_prod_ms   BIGINT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_animal FROM _animals_data_srv() WHERE animal_id = p_animal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nieznane zwierzę: %', p_animal_id; END IF;

  IF p_new_owned < 0 OR p_new_slots < 0 THEN
    RAISE EXCEPTION 'p_new_owned i p_new_slots nie mogą być ujemne';
  END IF;
  IF p_new_owned > v_animal.max_slots THEN
    RAISE EXCEPTION 'p_new_owned (%) > max_slots (%) dla %', p_new_owned, v_animal.max_slots, p_animal_id;
  END IF;
  IF p_new_slots > v_animal.max_slots THEN
    RAISE EXCEPTION 'p_new_slots (%) > max_slots (%) dla %', p_new_slots, v_animal.max_slots, p_animal_id;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie znaleziony'; END IF;

  v_bs        := COALESCE(v_profile.barn_state, '{}'::JSONB);
  v_ast       := COALESCE(v_bs->p_animal_id, '{}'::JSONB);
  v_old_owned := COALESCE((v_ast->>'owned')::INT, 0);
  v_prod_ms   := COALESCE((v_ast->>'prodStart')::BIGINT, 0);

  IF p_new_owned < v_old_owned THEN
    RAISE EXCEPTION 'Nie można zmniejszyć liczby zwierząt (% → %)', v_old_owned, p_new_owned;
  END IF;

  v_now_ms := EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT * 1000;
  v_ast := jsonb_set(v_ast, ARRAY['owned'], to_jsonb(p_new_owned));
  v_ast := jsonb_set(v_ast, ARRAY['slots'], to_jsonb(p_new_slots));
  IF v_prod_ms = 0 AND p_new_owned > 0 THEN
    v_ast := jsonb_set(v_ast, ARRAY['prodStart'], to_jsonb(v_now_ms));
  END IF;
  v_bs := jsonb_set(v_bs, ARRAY[p_animal_id], v_ast);
  UPDATE profiles SET barn_state = v_bs WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'animal_id', p_animal_id,
                             'new_owned', p_new_owned, 'new_slots', p_new_slots);
END $$;

GRANT EXECUTE ON FUNCTION sync_barn_owned(UUID, TEXT, INT, INT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 15. sync_fruit_inventory — TYLKO ZMNIEJSZANIE (DECREASE-ONLY)
-- ═══════════════════════════════════════════════════════════════════════════
-- Owoce mogą być TYLKO odejmowane (kompost, zamówienia).
-- Wzrost jest NIEMOŻLIWY przez ten RPC — blokujemy nawet przyrost o 1.
-- Jedyna droga dodania owoców: harvest_tree / harvest_all_trees (serwer).
CREATE OR REPLACE FUNCTION sync_fruit_inventory(p_user_id UUID, p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key     TEXT;
  v_val_txt TEXT;
  v_val     NUMERIC;
  v_old_val NUMERIC;
  v_old_inv JSONB;
  v_total   NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'object' THEN
    RAISE EXCEPTION 'p_items musi być obiektem JSONB';
  END IF;

  SELECT COALESCE(fruit_inventory, '{}'::JSONB) INTO v_old_inv
    FROM profiles WHERE id = p_user_id;

  FOR v_key, v_val_txt IN SELECT key, value FROM jsonb_each_text(p_items) LOOP
    -- Whitelist kluczy
    IF v_key !~ '^(jablko|gruszka|sliwka|wisnia|czeresnia|brzoskwinia|morela|pomarancza|cytryna)_(zwykly|soczysty|zloty|zgnile)$' THEN
      RAISE EXCEPTION 'Nieprawidłowy klucz owocu: %', v_key;
    END IF;

    BEGIN v_val := v_val_txt::NUMERIC;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Wartość nie jest liczbą dla klucza %: %', v_key, v_val_txt;
    END;

    IF v_val < 0 OR v_val != FLOOR(v_val) THEN
      RAISE EXCEPTION 'Wartość musi być nieujemną liczbą całkowitą: %=%', v_key, v_val;
    END IF;

    v_old_val := COALESCE((v_old_inv->>v_key)::NUMERIC, 0);

    -- DECREASE-ONLY: blokuje KAŻDY wzrost, nawet o 1 sztukę
    IF v_val > v_old_val THEN
      RAISE EXCEPTION
        'sync_fruit_inventory: wzrost klucza "%" (% → %) jest BEZWZGLĘDNIE niedozwolony. '
        'Owoce dodaje WYŁĄCZNIE serwer przez harvest_tree() / harvest_all_trees().',
        v_key, v_old_val, v_val;
    END IF;

    v_total := v_total + v_val;
  END LOOP;

  IF v_total > 50000 THEN
    RAISE EXCEPTION 'Łączna liczba owoców (%) przekracza maksimum 50 000', v_total;
  END IF;

  UPDATE profiles SET fruit_inventory = p_items WHERE id = p_user_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION sync_fruit_inventory(UUID, JSONB) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 16. sync_barn_items — TYLKO ZMNIEJSZANIE (DECREASE-ONLY)
-- ═══════════════════════════════════════════════════════════════════════════
-- Produkty zwierzęce mogą być TYLKO odejmowane (zamówienia, użycie).
-- Wzrost możliwy WYŁĄCZNIE przez collect_animal / collect_all_animals.
-- Bonusy z complete_customer_order (v_barn) są dodawane bezpośrednio
-- przez SECURITY DEFINER RPC — nie przez ten sync.
CREATE OR REPLACE FUNCTION sync_barn_items(p_user_id UUID, p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key     TEXT;
  v_val_txt TEXT;
  v_val     NUMERIC;
  v_old_val NUMERIC;
  v_old_inv JSONB;
  v_total   NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'object' THEN
    RAISE EXCEPTION 'p_items musi być obiektem JSONB';
  END IF;

  SELECT COALESCE(barn_items, '{}'::JSONB) INTO v_old_inv
    FROM profiles WHERE id = p_user_id;

  FOR v_key, v_val_txt IN SELECT key, value FROM jsonb_each_text(p_items) LOOP
    IF v_key NOT IN (
      'jajko', 'futro_krolika', 'mleko', 'piora', 'welna',
      'nawoz_naturalny', 'mleko_kozie', 'duze_piora',
      'energia_robocza', 'rogi_byka'
    ) THEN
      RAISE EXCEPTION 'Nieznany produkt zwierzęcy: %', v_key;
    END IF;

    BEGIN v_val := v_val_txt::NUMERIC;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Wartość nie jest liczbą dla klucza %: %', v_key, v_val_txt;
    END;

    IF v_val < 0 OR v_val != FLOOR(v_val) THEN
      RAISE EXCEPTION 'Wartość musi być nieujemną liczbą całkowitą: %=%', v_key, v_val;
    END IF;

    v_old_val := COALESCE((v_old_inv->>v_key)::NUMERIC, 0);

    -- DECREASE-ONLY: blokuje KAŻDY wzrost, nawet o 1 sztukę
    IF v_val > v_old_val THEN
      RAISE EXCEPTION
        'sync_barn_items: wzrost klucza "%" (% → %) jest BEZWZGLĘDNIE niedozwolony. '
        'Produkty dodaje WYŁĄCZNIE serwer przez collect_animal() / collect_all_animals().',
        v_key, v_old_val, v_val;
    END IF;

    v_total := v_total + v_val;
  END LOOP;

  IF v_total > 20000 THEN
    RAISE EXCEPTION 'Łączna liczba produktów (%) przekracza maksimum 20 000', v_total;
  END IF;

  UPDATE profiles SET barn_items = p_items WHERE id = p_user_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION sync_barn_items(UUID, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- KONIEC — uruchomić jednorazowo w Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
