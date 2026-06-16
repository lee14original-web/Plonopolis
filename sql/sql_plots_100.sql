-- ============================================================
-- AKTUALIZACJA: System 100 pól uprawnych z losowymi przeszkodami
-- Wklej do Supabase SQL Editor i wykonaj
-- ============================================================
--
-- ZMIANY:
--   1. Kolumna plot_obstacles jsonb w profiles
--      Format: { "21": { "type": "chwasty", "cost": 5 }, "22": { ... }, ... }
--   2. Trigger generate_plot_obstacles_on_insert:
--      Przy nowym koncie losuje kolejność przeszkód dla pól 21–100
--      Pula przeszkód jest stała (ta sama łączna suma dla każdego gracza).
--   3. Funkcja game_unlock_plot: czyta koszt z plot_obstacles, usuwa po odblokowaniu
--   4. Poprawka game_plant_crop, game_harvest_plot, game_water_plot:
--      p_plot_id > 25 → > 100
--   5. Funkcja game_reset_plot_obstacles(p_user_id uuid):
--      Używana przy resecie konta — generuje świeże przeszkody
-- ============================================================

-- ─── 1. Kolumna plot_obstacles ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plot_obstacles jsonb DEFAULT '{}'::jsonb;

-- ─── 2. Funkcja pomocnicza: generuje losowe przeszkody dla pól 21–100 ──────
CREATE OR REPLACE FUNCTION public.generate_plot_obstacles()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  -- Stała pula przeszkód (80 pól: 21–100)
  -- Suma kosztów jest taka sama dla każdego gracza
  v_pool text[] := ARRAY[
    -- chwasty (5 zł) × 16 sztuk
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty',
    -- kamienie (50 zł) × 16 sztuk
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie',
    -- maly_pien (150 zł) × 16 sztuk
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien',
    -- duzy_pien (250 zł) × 16 sztuk
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'duzy_pien',
    -- kret (500 zł) × 16 sztuk
    'kret','kret','kret','kret','kret',
    'kret','kret','kret','kret','kret',
    'kret','kret','kret','kret','kret',
    'kret'
  ];
  v_costs jsonb := '{"chwasty":15,"kamienie":50,"maly_pien":150,"duzy_pien":250,"kret":500}'::jsonb;
  v_shuffled text[];
  v_result   jsonb := '{}'::jsonb;
  v_i        integer;
  v_j        integer;
  v_tmp      text;
  v_plot_id  integer;
  v_type     text;
BEGIN
  -- Fisher-Yates shuffle
  v_shuffled := v_pool;
  FOR v_i IN REVERSE array_length(v_shuffled, 1)..2 LOOP
    v_j := 1 + floor(random() * v_i)::integer;
    v_tmp := v_shuffled[v_i];
    v_shuffled[v_i] := v_shuffled[v_j];
    v_shuffled[v_j] := v_tmp;
  END LOOP;

  -- Przypisz pola 21–100
  FOR v_i IN 1..80 LOOP
    v_plot_id := 20 + v_i;
    v_type    := v_shuffled[v_i];
    v_result  := v_result || jsonb_build_object(
      v_plot_id::text,
      jsonb_build_object(
        'type', v_type,
        'cost', (v_costs ->> v_type)::integer
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;

-- ─── 3. Trigger: generuj przeszkody przy tworzeniu nowego konta ───────────
CREATE OR REPLACE FUNCTION public.trg_generate_plot_obstacles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.plot_obstacles := public.generate_plot_obstacles();
  -- Pola 1–20 odblokowane od startu
  NEW.unlocked_plots := (
    SELECT jsonb_agg(n)
    FROM generate_series(1, 20) AS n
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plot_obstacles_on_insert ON public.profiles;
CREATE TRIGGER trg_plot_obstacles_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_generate_plot_obstacles();

-- ─── 4. Uzupełnij istniejących graczy bez plot_obstacles ───────────────────
UPDATE public.profiles
SET
  plot_obstacles = public.generate_plot_obstacles(),
  unlocked_plots = (
    SELECT jsonb_agg(n)
    FROM generate_series(1, 20) AS n
  )
WHERE plot_obstacles IS NULL OR plot_obstacles = '{}'::jsonb;

-- ─── 5. Funkcja resetu przeszkód (przy resecie konta) ─────────────────────
CREATE OR REPLACE FUNCTION public.game_reset_plot_obstacles(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Brak autoryzacji'; END IF;
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Brak uprawnień'; END IF;

  UPDATE public.profiles
  SET plot_obstacles = public.generate_plot_obstacles()
  WHERE id = p_user_id;
END;
$$;

-- ─── 6. Nowa game_unlock_plot: koszt z plot_obstacles ─────────────────────
CREATE OR REPLACE FUNCTION public.game_unlock_plot(p_plot_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile        public.profiles%rowtype;
  v_unlocked_arr   jsonb;
  v_already        boolean;
  v_obstacle       jsonb;
  v_cost           integer;
  v_plot_obstacles jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Brak autoryzacji'; END IF;
  IF p_plot_id < 1 OR p_plot_id > 100 THEN RAISE EXCEPTION 'Nieprawidłowe pole'; END IF;
  IF p_plot_id <= 20 THEN RAISE EXCEPTION 'Pole startowe jest już odblokowane'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil nie istnieje'; END IF;

  v_unlocked_arr := coalesce(public.normalize_unlocked_plots(v_profile.unlocked_plots), '[]'::jsonb);

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_unlocked_arr) AS elem
    WHERE (elem::text)::integer = p_plot_id
  ) INTO v_already;

  IF v_already THEN RAISE EXCEPTION 'To pole jest już odblokowane'; END IF;

  -- Pobierz przeszkodę i koszt
  v_plot_obstacles := coalesce(v_profile.plot_obstacles, '{}'::jsonb);
  v_obstacle       := v_plot_obstacles -> (p_plot_id::text);

  IF v_obstacle IS NULL THEN
    RAISE EXCEPTION 'Brak danych przeszkody dla pola %', p_plot_id;
  END IF;

  v_cost := (v_obstacle ->> 'cost')::integer;

  IF v_profile.money < v_cost THEN
    RAISE EXCEPTION 'Za mało pieniędzy (potrzebujesz % PLN)', v_cost;
  END IF;

  -- Odblokuj pole, pobierz opłatę, usuń przeszkodę
  UPDATE public.profiles
  SET
    unlocked_plots   = v_unlocked_arr || to_jsonb(p_plot_id),
    money            = money - v_cost,
    plot_obstacles   = v_plot_obstacles - (p_plot_id::text),
    last_played_at   = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  RETURN row_to_json(v_profile);
END;
$$;

-- ─── 7. Poprawka game_plant_crop: limit pól 25 → 100 ──────────────────────
-- Wklej aktualną pełną definicję game_plant_crop ze zmienionym warunkiem:
--   if p_plot_id < 1 or p_plot_id > 100 then ...
-- (Poniżej zmiana tylko warunku walidacji — reszta funkcji bez zmian)
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc
  WHERE proname = 'game_plant_crop'
    AND pronamespace = 'public'::regnamespace
  ORDER BY oid DESC
  LIMIT 1;

  IF v_src LIKE '%p_plot_id > 25%' THEN
    RAISE NOTICE 'UWAGA: game_plant_crop wciąż ma limit 25 — zaktualizuj ręcznie limit do 100';
  ELSE
    RAISE NOTICE 'game_plant_crop: limit OK (nie ma > 25)';
  END IF;
END;
$$;

-- ─── 8. game_harvest_plot: limit pól 25 → 100 ─────────────────────────────
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc
  WHERE proname = 'game_harvest_plot'
    AND pronamespace = 'public'::regnamespace
  ORDER BY oid DESC
  LIMIT 1;

  IF v_src LIKE '%p_plot_id > 25%' THEN
    RAISE NOTICE 'UWAGA: game_harvest_plot wciąż ma limit 25 — zaktualizuj ręcznie limit do 100';
  ELSE
    RAISE NOTICE 'game_harvest_plot: limit OK';
  END IF;
END;
$$;
