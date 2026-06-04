-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Deterministyczny układ przeszkód pól 21–100 (jednakowy dla wszystkich)
-- + jednorazowy reset wszystkich graczy
-- ───────────────────────────────────────────────────────────────────────────
-- Nowy układ:
--   21–30, 31,32,33, 38,39,40  → chwasty   (16 pól, 15 zł)
--   34,35,36,37, 41–50         → maly_pien (14 pól, 150 zł)
--   51–70                      → duzy_pien (20 pól, 250 zł)
--   71–90                      → kamienie  (20 pól, 50 zł)
--   91–100                     → kret      (10 pól, 500 zł)
--
-- CZĘŚĆ 1: Pomocnicza funkcja zwracająca typ dla danego pola
-- CZĘŚĆ 2: Zaktualizowana game_repair_plot_obstacles (deterministyczna)
-- CZĘŚĆ 3: Jednorazowy reset wszystkich graczy (usuwa pola 21–100
--          z unlocked_plots i nadpisuje plot_obstacles nowym układem)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── CZĘŚĆ 1: Pomocnicza funkcja typu przeszkody ─────────────────────────

CREATE OR REPLACE FUNCTION public._plot_obstacle_type(p_plot_id integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_plot_id BETWEEN 21 AND 30  THEN 'chwasty'
    WHEN p_plot_id IN (31,32,33)       THEN 'chwasty'
    WHEN p_plot_id IN (38,39,40)       THEN 'chwasty'
    WHEN p_plot_id IN (34,35,36,37)    THEN 'maly_pien'
    WHEN p_plot_id BETWEEN 41 AND 50   THEN 'maly_pien'
    WHEN p_plot_id BETWEEN 51 AND 70   THEN 'duzy_pien'
    WHEN p_plot_id BETWEEN 71 AND 90   THEN 'kamienie'
    WHEN p_plot_id BETWEEN 91 AND 100  THEN 'kret'
    ELSE NULL
  END;
$$;


-- ─── CZĘŚĆ 2: Zaktualizowana game_repair_plot_obstacles ──────────────────
-- Deterministyczna — brak shuffle, każde pole ma zawsze ten sam typ.
-- Wywoływana przez grę przy naprawie brakujących przeszkód.

CREATE OR REPLACE FUNCTION public.game_repair_plot_obstacles(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile   public.profiles%rowtype;
  v_unlocked  jsonb;
  v_obstacles jsonb;
  v_plot_id   integer;
  v_type      text;
  v_cost      integer;
  v_changed   boolean := false;
  v_costs     jsonb := '{"chwasty":15,"kamienie":50,"maly_pien":150,"duzy_pien":250,"kret":500}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Brak autoryzacji'; END IF;
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Brak uprawnień'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie istnieje'; END IF;

  v_unlocked  := coalesce(v_profile.unlocked_plots, '[]'::jsonb);
  v_obstacles := coalesce(v_profile.plot_obstacles, '{}'::jsonb);

  FOR v_plot_id IN 21..100 LOOP
    -- Pomijaj odblokowane
    IF v_unlocked @> to_jsonb(v_plot_id) THEN CONTINUE; END IF;
    -- Pomijaj już istniejące przeszkody
    IF v_obstacles ? v_plot_id::text THEN CONTINUE; END IF;

    v_type := public._plot_obstacle_type(v_plot_id);
    IF v_type IS NULL THEN CONTINUE; END IF;

    v_cost := (v_costs ->> v_type)::integer;
    v_obstacles := v_obstacles || jsonb_build_object(
      v_plot_id::text,
      jsonb_build_object('type', v_type, 'cost', v_cost)
    );
    v_changed := true;
  END LOOP;

  IF v_changed THEN
    UPDATE public.profiles SET plot_obstacles = v_obstacles WHERE id = p_user_id;
  END IF;

  RETURN json_build_object('changed', v_changed, 'plot_obstacles', v_obstacles);
END;
$$;

GRANT EXECUTE ON FUNCTION public.game_repair_plot_obstacles(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._plot_obstacle_type(integer) TO anon, authenticated;


-- ─── CZĘŚĆ 3: Jednorazowy reset WSZYSTKICH graczy ────────────────────────
-- Usuwa pola 21–100 z unlocked_plots i nadpisuje plot_obstacles nowym układem.
-- Pola 1–20 zostają bez zmian.

DO $$
DECLARE
  v_new_obstacles jsonb;
  v_costs         jsonb := '{"chwasty":15,"kamienie":50,"maly_pien":150,"duzy_pien":250,"kret":500}'::jsonb;
  v_plot_id       integer;
  v_type          text;
  v_row           record;
  v_unlocked_kept jsonb;
BEGIN
  -- Zbuduj nowy deterministyczny plot_obstacles (pola 21–100)
  v_new_obstacles := '{}'::jsonb;
  FOR v_plot_id IN 21..100 LOOP
    v_type := public._plot_obstacle_type(v_plot_id);
    v_new_obstacles := v_new_obstacles || jsonb_build_object(
      v_plot_id::text,
      jsonb_build_object(
        'type', v_type,
        'cost', (v_costs ->> v_type)::integer
      )
    );
  END LOOP;

  -- Dla każdego gracza: zachowaj odblokowane pola 1–20, usuń 21–100
  FOR v_row IN SELECT id, unlocked_plots FROM public.profiles LOOP
    -- Zostaw tylko pola 1–20 z unlocked_plots
    SELECT COALESCE(
      jsonb_agg(el) FILTER (WHERE (el#>>'{}')::integer BETWEEN 1 AND 20),
      '[]'::jsonb
    ) INTO v_unlocked_kept
    FROM jsonb_array_elements(COALESCE(v_row.unlocked_plots, '[]'::jsonb)) AS el;

    UPDATE public.profiles
    SET
      plot_obstacles = v_new_obstacles,
      unlocked_plots = v_unlocked_kept
    WHERE id = v_row.id;
  END LOOP;

  RAISE NOTICE 'Reset zakończony. Nowy układ przeszkód zastosowany dla wszystkich graczy.';
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA:
--   SELECT id, unlocked_plots, plot_obstacles FROM profiles LIMIT 3;
--   -- unlocked_plots powinno zawierać tylko pola 1–20 (lub podzbiór)
--   -- plot_obstacles["34"] powinno być {"type":"maly_pien","cost":150}
--   -- plot_obstacles["55"] powinno być {"type":"duzy_pien","cost":250}
--   -- plot_obstacles["80"] powinno być {"type":"kamienie","cost":50}
--   -- plot_obstacles["95"] powinno być {"type":"kret","cost":500}
-- ═══════════════════════════════════════════════════════════════════════════
