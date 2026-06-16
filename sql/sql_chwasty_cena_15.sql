-- ============================================================
--  Chwasty: zmiana ceny 5 PLN → 15 PLN
--  Uruchom jako Service Role w SQL Editorze Supabase
-- ============================================================

-- 1. Aktualizuj funkcję generującą przeszkody (dla nowych kont)
CREATE OR REPLACE FUNCTION public.generate_plot_obstacles()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_types text[] := ARRAY[
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty','chwasty','chwasty','chwasty','chwasty',
    'chwasty',
    'kamienie','kamienie','kamienie','kamienie','kamienie',
    'kamienie','kamienie','kamienie',
    'maly_pien','maly_pien','maly_pien','maly_pien','maly_pien',
    'maly_pien','maly_pien','maly_pien',
    'duzy_pien','duzy_pien','duzy_pien','duzy_pien',
    'kret','kret','kret','kret','kret',
    'kret','kret','kret','kret','kret',
    'kret','kret','kret','kret','kret',
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
BEGIN
  v_shuffled := v_types;
  FOR v_i IN REVERSE array_length(v_shuffled,1)..2 LOOP
    v_j := floor(random()*(v_i))+1;
    v_tmp := v_shuffled[v_i];
    v_shuffled[v_i] := v_shuffled[v_j];
    v_shuffled[v_j] := v_tmp;
  END LOOP;

  FOR v_i IN 1..array_length(v_shuffled,1) LOOP
    v_plot_id := 20 + v_i;
    v_result := v_result || jsonb_build_object(
      v_plot_id::text,
      jsonb_build_object('type', v_shuffled[v_i], 'cost', (v_costs ->> v_shuffled[v_i])::integer)
    );
  END LOOP;

  RETURN v_result;
END;
$$;

-- 2. Zaktualizuj istniejące wiersze — zmień cost z 5 na 15 dla wszystkich chwastów
UPDATE public.profiles
SET plot_obstacles = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN (value->>'type') = 'chwasty' AND (value->>'cost')::int = 5
        THEN jsonb_build_object('type', 'chwasty', 'cost', 15)
      ELSE value
    END
  )
  FROM jsonb_each(plot_obstacles)
)
WHERE plot_obstacles IS NOT NULL
  AND plot_obstacles != '{}'::jsonb
  AND plot_obstacles::text LIKE '%chwasty%';

-- 3. Sprawdź wynik (powinny pokazać 0 wierszy z cost=5)
SELECT id, email,
       (
         SELECT count(*)
         FROM jsonb_each(plot_obstacles)
         WHERE (value->>'type') = 'chwasty'
           AND (value->>'cost')::int = 5
       ) AS stara_cena_5_pozostala
FROM public.profiles
WHERE plot_obstacles::text LIKE '%chwasty%'
HAVING (
  SELECT count(*)
  FROM jsonb_each(plot_obstacles)
  WHERE (value->>'type') = 'chwasty'
    AND (value->>'cost')::int = 5
) > 0;
