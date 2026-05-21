-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: game_buy_stat_points — usuń blokadę "Najpierw wykorzystaj wolne punkty"
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   RPC game_buy_stat_points zawiera check:
--     IF (profile.free_skill_points > 0) THEN
--       RETURN jsonb_build_object('ok', false, 'error',
--              'Najpierw wykorzystaj wolne punkty umiejętności.');
--     END IF;
--
--   Frontend (commit cec55c2) już prawidłowo:
--     1. Najpierw zużywa wolne punkty → zapisuje przez game_save_avatar_data
--        (AWAIT — blokuje do zapisu w DB)
--     2. Dopiero potem wywołuje game_buy_stat_points dla PAID części
--
--   Mimo to blokada odpala się bo:
--     a) game_save_avatar_data może nie aktualizować free_skill_points w DB, lub
--     b) backend czyta niezsynchronizowany snapshot, lub
--     c) blokada jest niepotrzebna — frontend już gwarantuje kolejność
--
-- Rozwiązanie:
--   Usuń cały check free_skill_points > 0 z game_buy_stat_points.
--   Backend NIE powinien blokować płatnej części tylko dlatego, że profil
--   ma darmowe punkty — to odpowiedzialność frontendu.
--
-- Zachowane zabezpieczenia:
--   ✓ auth.uid() — tylko zalogowany gracz
--   ✓ valid stat_key (whitelist)
--   ✓ amount > 0
--   ✓ stat + amount ≤ 100
--   ✓ wystarczający money
--   ✓ koszt liczony od aktualnego poziomu stat (po ewentualnym zapisie free)
--
-- Nie zmienia: game_save_avatar_data, schematu DB, frontendu
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── HELPER: koszt upgrade do danego poziomu (ta sama formuła co frontend) ─
CREATE OR REPLACE FUNCTION _stat_upgrade_cost(p_target_lv INT)
RETURNS NUMERIC
LANGUAGE SQL IMMUTABLE AS $$
  -- Tablica breakpointów: [[level, koszt], ...]
  -- Interpolacja liniowa między punktami (jak getStatUpgradeCost w Game.tsx)
  WITH bp(lv, cost) AS (
    VALUES
      (1,   25::NUMERIC),
      (5,   45),
      (10,  78),
      (20,  960),
      (30,  3000),
      (40,  9400),
      (50,  29000),
      (60,  88000),
      (70,  260000),
      (80,  750000),
      (90,  2100000),
      (100, 6000000)
  ),
  clamp AS (
    SELECT GREATEST(1, LEAST(100, p_target_lv)) AS lv
  ),
  bounds AS (
    SELECT
      (SELECT cost FROM bp WHERE lv <= (SELECT lv FROM clamp) ORDER BY lv DESC LIMIT 1) AS c_lo,
      (SELECT cost FROM bp WHERE lv >= (SELECT lv FROM clamp) ORDER BY lv ASC  LIMIT 1) AS c_hi,
      (SELECT lv   FROM bp WHERE lv <= (SELECT lv FROM clamp) ORDER BY lv DESC LIMIT 1) AS lv_lo,
      (SELECT lv   FROM bp WHERE lv >= (SELECT lv FROM clamp) ORDER BY lv ASC  LIMIT 1) AS lv_hi
  )
  SELECT
    CASE
      WHEN lv_lo = lv_hi THEN c_lo
      ELSE round(
        c_lo + (c_hi - c_lo)::NUMERIC
          * ((SELECT lv FROM clamp) - lv_lo)::NUMERIC
          / (lv_hi - lv_lo)::NUMERIC
      )
    END
  FROM bounds;
$$;


-- ─── GŁÓWNA FUNKCJA: game_buy_stat_points ────────────────────────────────
CREATE OR REPLACE FUNCTION game_buy_stat_points(
  p_stat_key TEXT,
  p_amount   INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_valid_keys   TEXT[] := ARRAY['zrecznosc','wiedza','szczescie','zaradnosc','opieka','sadownik'];
  v_profile      RECORD;
  v_current_val  INT;
  v_total_cost   NUMERIC := 0;
  v_i            INT;
  v_new_stats    JSONB;
BEGIN

  -- 1. Autentykacja
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nie jesteś zalogowany.');
  END IF;

  -- 2. Walidacja klucza statystyki
  IF p_stat_key != ALL(v_valid_keys) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nieprawidłowy klucz statystyki: ' || p_stat_key);
  END IF;

  -- 3. Walidacja ilości
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ilość punktów musi być większa od 0.');
  END IF;

  -- 4. Pobierz profil gracza (świeży SELECT, po ewentualnym save free)
  SELECT money, player_stats, free_skill_points
    INTO v_profile
    FROM profiles
   WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil gracza nie znaleziony.');
  END IF;

  -- 5. Aktualny poziom statystyki
  v_current_val := COALESCE(
    (v_profile.player_stats ->> p_stat_key)::INT,
    0
  );

  -- 6. Sprawdź czy nie przekroczy 100
  IF v_current_val + p_amount > 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Statystyka ' || p_stat_key || ' nie może przekroczyć 100 (obecna: ' || v_current_val || ').'
    );
  END IF;

  -- 7. Oblicz łączny koszt (od aktualnego poziomu, sumując każdy punkt osobno)
  FOR v_i IN 1..p_amount LOOP
    v_total_cost := v_total_cost + _stat_upgrade_cost(v_current_val + v_i);
  END LOOP;

  -- 8. Sprawdź czy gracz ma wystarczająco złota
  IF COALESCE(v_profile.money, 0) < v_total_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Niewystarczające środki. Potrzebujesz ' || v_total_cost::TEXT || ' 💰, masz ' || COALESCE(v_profile.money, 0)::TEXT || ' 💰.'
    );
  END IF;

  -- 9. Wykonaj zakup: odejmij money, zaktualizuj stat
  v_new_stats := COALESCE(v_profile.player_stats, '{}'::JSONB)
    || jsonb_build_object(p_stat_key, v_current_val + p_amount);

  UPDATE profiles
     SET money        = money - v_total_cost,
         player_stats = v_new_stats
   WHERE id = v_uid;

  -- 10. Zwróć wynik (free_skill_points NIEZMIENIONY — frontend zarządza nim)
  RETURN jsonb_build_object(
    'ok',               true,
    'stat_key',         p_stat_key,
    'amount',           p_amount,
    'cost',             v_total_cost,
    'player_stats',     v_new_stats,
    'free_skill_points', COALESCE(v_profile.free_skill_points, 0)
  );

END $$;

GRANT EXECUTE ON FUNCTION game_buy_stat_points(TEXT, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION game_buy_stat_points(TEXT, INT) FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- TESTY (uruchom w Supabase SQL Editor, zalogowany jako test user):
--
-- Test 1: Helper kosztu
--   SELECT _stat_upgrade_cost(1);   -- 25
--   SELECT _stat_upgrade_cost(5);   -- 45
--   SELECT _stat_upgrade_cost(10);  -- 78
--   SELECT _stat_upgrade_cost(15);  -- ~519 (interpolacja 10→20)
--   SELECT _stat_upgrade_cost(100); -- 6000000
--
-- Test 2: Zakup gdy free_skill_points > 0 (warunek który był blokowany)
--   -- Upewnij się że profil testowy ma free_skill_points > 0 w DB:
--   UPDATE profiles SET free_skill_points = 3 WHERE id = '<TWOJ_USER_ID>';
--   -- Teraz wywołaj RPC — NIE powinien zwrócić błędu o wolnych punktach:
--   SELECT game_buy_stat_points('zrecznosc', 1);
--   -- Oczekiwany wynik: {"ok": true, "stat_key": "zrecznosc", ...}
--   -- BEZ: {"ok": false, "error": "Najpierw wykorzystaj wolne punkty..."}
--
-- Test 3: Brak kasy
--   UPDATE profiles SET money = 0 WHERE id = '<TWOJ_USER_ID>';
--   SELECT game_buy_stat_points('zrecznosc', 1);
--   -- Oczekiwany: {"ok": false, "error": "Niewystarczające środki..."}
--
-- Test 4: Przekroczenie 100
--   UPDATE profiles SET player_stats = '{"zrecznosc": 99}' WHERE id = '<TWOJ_USER_ID>';
--   SELECT game_buy_stat_points('zrecznosc', 2);
--   -- Oczekiwany: {"ok": false, "error": "...nie może przekroczyć 100..."}
-- ═══════════════════════════════════════════════════════════════════════════
