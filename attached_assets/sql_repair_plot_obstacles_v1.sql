-- ============================================================
-- game_repair_plot_obstacles(p_user_id uuid)
-- Uzupełnia brakujące wpisy w plot_obstacles dla pól 21–100.
-- Działa tylko dla zalogowanego właściciela profilu.
-- Nie zmienia pól odblokowanych (unlocked_plots).
-- Nie zmienia istniejących przeszkód.
-- Wklej do Supabase SQL Editor i wykonaj.
-- ============================================================

CREATE OR REPLACE FUNCTION public.game_repair_plot_obstacles(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile        public.profiles%rowtype;
  v_unlocked       jsonb;
  v_obstacles      jsonb;
  v_pool           text[] := ARRAY[
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty',
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie',
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien',
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'duzy_pien',
    'kret','kret','kret','kret','kret',
    'kret','kret','kret','kret','kret',
    'kret','kret','kret','kret','kret',
    'kret'
  ];
  v_costs          jsonb := '{"chwasty":5,"kamienie":50,"maly_pien":150,"duzy_pien":250,"kret":500}'::jsonb;
  v_shuffled       text[];
  v_i              integer;
  v_j              integer;
  v_tmp            text;
  v_plot_id        integer;
  v_type           text;
  v_changed        boolean := false;
BEGIN
  -- Autoryzacja
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Brak autoryzacji';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Brak uprawnień';
  END IF;

  -- Pobierz profil z blokadą zapisu
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil nie istnieje';
  END IF;

  v_unlocked  := coalesce(v_profile.unlocked_plots, '[]'::jsonb);
  v_obstacles := coalesce(v_profile.plot_obstacles, '{}'::jsonb);

  -- Fisher-Yates shuffle puli (ta sama logika co generate_plot_obstacles)
  v_shuffled := v_pool;
  FOR v_i IN REVERSE array_length(v_shuffled, 1)..2 LOOP
    v_j := 1 + floor(random() * v_i)::integer;
    v_tmp := v_shuffled[v_i];
    v_shuffled[v_i] := v_shuffled[v_j];
    v_shuffled[v_j] := v_tmp;
  END LOOP;

  -- Uzupełnij tylko brakujące pola 21–100
  FOR v_i IN 1..80 LOOP
    v_plot_id := 20 + v_i;
    -- Pomijaj pola odblokowane
    IF v_unlocked @> to_jsonb(v_plot_id) THEN
      CONTINUE;
    END IF;
    -- Pomijaj pola, które już mają przeszkodę
    IF v_obstacles ? v_plot_id::text THEN
      CONTINUE;
    END IF;
    -- Dodaj przeszkodę z przemieszanej puli
    v_type := v_shuffled[v_i];
    v_obstacles := v_obstacles || jsonb_build_object(
      v_plot_id::text,
      jsonb_build_object(
        'type', v_type,
        'cost', (v_costs ->> v_type)::integer
      )
    );
    v_changed := true;
  END LOOP;

  -- Zapisz tylko jeśli coś się zmieniło
  IF v_changed THEN
    UPDATE public.profiles
    SET plot_obstacles = v_obstacles
    WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'changed', v_changed,
    'plot_obstacles', v_obstacles
  );
END;
$$;
