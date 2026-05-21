-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: game_buy_stat_points — usuń blokadę "Najpierw wykorzystaj wolne punkty"
-- ───────────────────────────────────────────────────────────────────────────
-- Potwierdzona blokada w Supabase (do usunięcia):
--
--   IF COALESCE(v_profile.free_skill_points, 0) > 0 THEN
--     RETURN jsonb_build_object(
--       'ok', false,
--       'error', 'Najpierw wykorzystaj wolne punkty umiejętności.'
--     );
--   END IF;
--
-- Frontend (commit cec55c2) najpierw AWAIT-uje game_save_avatar_data z fsp=0,
-- a dopiero potem wywołuje game_buy_stat_points — blokada jest więc zbędna
-- i powoduje błąd w edge case gdzie DB jeszcze widzi stary fsp > 0.
--
-- NIE zmieniono:
--   • koszty (_stat_upgrade_cost — ta sama formuła)
--   • dozwolone klucze stat
--   • limit 100
--   • SELECT FOR UPDATE
--   • last_played_at
--   • zwracany shape (ok/stat_key/amount/cost/player_stats/free_skill_points)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── HELPER kosztu (replika getStatUpgradeCost z Game.tsx) ────────────────
CREATE OR REPLACE FUNCTION public._stat_upgrade_cost(p_target_lv INT)
RETURNS NUMERIC
LANGUAGE SQL IMMUTABLE AS $$
  WITH bp(lv, cost) AS (
    VALUES
      (1,   25::NUMERIC),(5,   45),(10,  78),(20,  960),
      (30,  3000),(40,  9400),(50,  29000),(60,  88000),
      (70,  260000),(80,  750000),(90,  2100000),(100, 6000000)
  ),
  clamped AS (SELECT GREATEST(1, LEAST(100, p_target_lv)) AS lv),
  lo AS (SELECT lv, cost FROM bp WHERE lv <= (SELECT lv FROM clamped) ORDER BY lv DESC LIMIT 1),
  hi AS (SELECT lv, cost FROM bp WHERE lv >= (SELECT lv FROM clamped) ORDER BY lv ASC  LIMIT 1)
  SELECT
    CASE WHEN lo.lv = hi.lv THEN lo.cost
         ELSE round(lo.cost + (hi.cost - lo.cost)
                    * ((SELECT lv FROM clamped) - lo.lv)::NUMERIC
                    / (hi.lv - lo.lv)::NUMERIC)
    END
  FROM lo, hi;
$$;


-- ─── GŁÓWNA FUNKCJA ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.game_buy_stat_points(
  p_stat_key text,
  p_amount   integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid    := auth.uid();
  v_valid_keys  text[]  := ARRAY['zrecznosc','wiedza','szczescie','zaradnosc','opieka','sadownik'];
  v_profile     RECORD;
  v_current_val int;
  v_total_cost  numeric := 0;
  v_i           int;
  v_new_stats   jsonb;
BEGIN

  -- auth
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nie jesteś zalogowany.');
  END IF;

  -- walidacja klucza
  IF p_stat_key != ALL(v_valid_keys) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nieprawidłowy klucz statystyki: ' || p_stat_key);
  END IF;

  -- walidacja ilości (1..10)
  IF p_amount < 1 OR p_amount > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ilość punktów musi być z zakresu 1–10.');
  END IF;

  -- pobierz profil (FOR UPDATE — blokada wiersza)
  SELECT money, player_stats, free_skill_points
    INTO v_profile
    FROM profiles
   WHERE id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil gracza nie znaleziony.');
  END IF;

  -- aktualny poziom stat
  v_current_val := COALESCE(
    (v_profile.player_stats ->> p_stat_key)::int,
    0
  );

  -- limit 100
  IF v_current_val + p_amount > 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Statystyka ' || p_stat_key
               || ' nie może przekroczyć 100 (obecna: ' || v_current_val || ').'
    );
  END IF;

  -- koszt od aktualnego poziomu
  FOR v_i IN 1..p_amount LOOP
    v_total_cost := v_total_cost + _stat_upgrade_cost(v_current_val + v_i);
  END LOOP;

  -- sprawdź money
  IF COALESCE(v_profile.money, 0) < v_total_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Niewystarczające środki. Potrzebujesz '
               || v_total_cost::text || ' 💰, masz '
               || COALESCE(v_profile.money, 0)::text || ' 💰.'
    );
  END IF;

  -- ◆ USUNIĘTO blokadę free_skill_points > 0
  -- (blokada była tutaj — teraz już jej nie ma)

  -- zaktualizuj stat i money
  v_new_stats := COALESCE(v_profile.player_stats, '{}'::jsonb)
    || jsonb_build_object(p_stat_key, v_current_val + p_amount);

  UPDATE profiles
     SET money           = money - v_total_cost,
         player_stats    = v_new_stats,
         last_played_at  = now()
   WHERE id = v_uid;

  -- zwróć wynik (free_skill_points niezmieniony — frontend zarządza nim)
  RETURN jsonb_build_object(
    'ok',                true,
    'stat_key',          p_stat_key,
    'amount',            p_amount,
    'cost',              v_total_cost,
    'player_stats',      v_new_stats,
    'free_skill_points', COALESCE(v_profile.free_skill_points, 0)
  );

END $$;

GRANT EXECUTE ON FUNCTION public.game_buy_stat_points(text, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.game_buy_stat_points(text, integer) FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY KONTROLNE — uruchom po wgraniu:
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Sprawdź, że blokada "Najpierw..." NIE istnieje już w definicji funkcji:
SELECT
  CASE
    WHEN prosrc LIKE '%Najpierw wykorzystaj wolne punkty%'
    THEN 'BŁĄD — blokada nadal jest w funkcji!'
    ELSE 'OK — blokada usunięta'
  END AS status_blokady
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
WHERE proname = 'game_buy_stat_points'
  AND ns.nspname = 'public';

-- 2. Sprawdź, że funkcja w ogóle istnieje po CREATE OR REPLACE:
SELECT proname, pronargs, prorettype::regtype AS returns
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
WHERE proname = 'game_buy_stat_points'
  AND ns.nspname = 'public';

-- 3. Test kosztu (porównaj z Game.tsx getStatUpgradeCost):
SELECT
  _stat_upgrade_cost(1)   AS lv1_expect_25,
  _stat_upgrade_cost(5)   AS lv5_expect_45,
  _stat_upgrade_cost(10)  AS lv10_expect_78,
  _stat_upgrade_cost(100) AS lv100_expect_6000000;

-- 4. Test zakupu gdy free_skill_points > 0 (NIE może zwrócić błędu o wolnych punktach):
--    UPDATE profiles SET free_skill_points = 3 WHERE id = auth.uid();
--    SELECT game_buy_stat_points('zrecznosc', 1);
--    Oczekiwane: {"ok": true, "stat_key": "zrecznosc", ...}
-- ═══════════════════════════════════════════════════════════════════════════
