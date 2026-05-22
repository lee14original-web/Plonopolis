-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: game_buy_stat_points — usuń blokadę "Najpierw wykorzystaj wolne punkty"
-- ───────────────────────────────────────────────════════════════════════════
-- ZMIANA: usunięto blok:
--   IF COALESCE(v_profile.free_skill_points, 0) > 0 THEN
--     RETURN jsonb_build_object('ok', false, 'error', 'Najpierw wykorzystaj...');
--   END IF;
--
-- Koszt obliczany jest inline (bez pomocniczej funkcji _stat_upgrade_cost)
-- żeby skrypt był self-contained i nie wymagał osobnego CREATE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

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
  v_lv          int;
  v_cost_pt     numeric;
  v_new_stats   jsonb;

  -- Breakpointy kosztu (ta sama formuła co getStatUpgradeCost w Game.tsx)
  -- [[lv, cost], ...]  — interpolacja liniowa między punktami
  v_bp_lv   int[]     := ARRAY[1, 5, 10, 20, 30, 40, 50, 60, 70, 80,  90,    100];
  v_bp_cost numeric[] := ARRAY[25,45, 78,960,3000,9400,29000,88000,260000,750000,2100000,6000000];
  v_j       int;
BEGIN

  -- ── auth ──────────────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nie jesteś zalogowany.');
  END IF;

  -- ── walidacja klucza stat ─────────────────────────────────────────────────
  IF p_stat_key != ALL(v_valid_keys) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nieprawidłowy klucz statystyki: ' || p_stat_key);
  END IF;

  -- ── walidacja ilości (1..10) ──────────────────────────────────────────────
  IF p_amount < 1 OR p_amount > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ilość punktów musi być z zakresu 1–10.');
  END IF;

  -- ── pobierz profil FOR UPDATE ─────────────────────────────────────────────
  SELECT money, player_stats, free_skill_points
    INTO v_profile
    FROM profiles
   WHERE id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil gracza nie znaleziony.');
  END IF;

  -- ── aktualny poziom stat ──────────────────────────────────────────────────
  v_current_val := COALESCE((v_profile.player_stats ->> p_stat_key)::int, 0);

  -- ── limit 100 ────────────────────────────────────────────────────────────
  IF v_current_val + p_amount > 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Statystyka ' || p_stat_key
               || ' nie może przekroczyć 100 (obecna: ' || v_current_val || ').'
    );
  END IF;

  -- ── oblicz koszt inline (interpolacja liniowa po breakpointach) ──────────
  FOR v_i IN 1..p_amount LOOP
    v_lv := v_current_val + v_i;
    v_lv := GREATEST(1, LEAST(100, v_lv));

    -- znajdź przedział [j-1, j] w którym leży v_lv
    v_cost_pt := v_bp_cost[array_length(v_bp_lv, 1)]; -- fallback = max
    FOR v_j IN 2..array_length(v_bp_lv, 1) LOOP
      IF v_lv <= v_bp_lv[v_j] THEN
        IF v_bp_lv[v_j] = v_bp_lv[v_j-1] THEN
          v_cost_pt := v_bp_cost[v_j-1];
        ELSE
          v_cost_pt := round(
            v_bp_cost[v_j-1]
            + (v_bp_cost[v_j] - v_bp_cost[v_j-1])
              * (v_lv - v_bp_lv[v_j-1])::numeric
              / (v_bp_lv[v_j] - v_bp_lv[v_j-1])::numeric
          );
        END IF;
        EXIT;
      END IF;
    END LOOP;

    v_total_cost := v_total_cost + v_cost_pt;
  END LOOP;

  -- ── sprawdź money ─────────────────────────────────────────────────────────
  IF COALESCE(v_profile.money, 0) < v_total_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Niewystarczające środki. Potrzebujesz '
               || v_total_cost::text || ' 💰, masz '
               || COALESCE(v_profile.money, 0)::text || ' 💰.'
    );
  END IF;

  -- ◆ BLOKADA free_skill_points USUNIĘTA — była tutaj, już jej nie ma

  -- ── zaktualizuj stat i money ──────────────────────────────────────────────
  v_new_stats := COALESCE(v_profile.player_stats, '{}'::jsonb)
    || jsonb_build_object(p_stat_key, v_current_val + p_amount);

  UPDATE profiles
     SET money          = money - v_total_cost,
         player_stats   = v_new_stats,
         last_played_at = now()
   WHERE id = v_uid;

  -- ── zwróć wynik ───────────────────────────────────────────────────────────
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
-- QUERY KONTROLNE (uruchom od razu po wgraniu, w osobnym oknie SQL)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Sprawdź że blokada "Najpierw..." NIE ma w definicji:
SELECT
  CASE
    WHEN prosrc LIKE '%Najpierw wykorzystaj wolne punkty%'
    THEN 'BŁĄD — blokada nadal istnieje!'
    ELSE 'OK — blokada usunięta'
  END AS status_blokady
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
WHERE proname = 'game_buy_stat_points'
  AND ns.nspname = 'public';

-- 2. Sprawdź że funkcja istnieje z właściwą sygnaturą:
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
WHERE proname = 'game_buy_stat_points'
  AND ns.nspname = 'public';

-- 3. Test zakupu gdy fsp > 0 (NIE może zwrócić błędu o wolnych punktach):
--    Podmień <UUID> na swoje auth.uid():
--    UPDATE profiles SET free_skill_points = 3 WHERE id = '<UUID>';
--    SELECT game_buy_stat_points('zrecznosc', 1);
--    Oczekiwane: {"ok": true, "stat_key": "zrecznosc", "amount": 1, ...}
