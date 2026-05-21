-- ============================================================
-- FIX: normalize_unlocked_plots — obsługa pól 1–100
-- Poprzednia wersja najprawdopodobniej filtrowała tylko do 20 lub 25
-- Wklej do Supabase SQL Editor i wykonaj
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_unlocked_plots(p_input jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(plot_id ORDER BY plot_id)
      FROM (
        SELECT DISTINCT (elem::text)::integer AS plot_id
        FROM (
          -- Zawsze odblokowane: pola 1–20
          SELECT to_jsonb(n) AS elem
          FROM generate_series(1, 20) AS n
          UNION ALL
          -- Z inputu gracza
          SELECT elem
          FROM jsonb_array_elements(COALESCE(p_input, '[]'::jsonb)) AS elem
        ) AS combined
        WHERE (elem::text)::integer BETWEEN 1 AND 100
      ) AS t
    ),
    '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]'::jsonb
  );
$$;

-- Sprawdź działanie — powinno zwrócić [1..20, 85]
-- SELECT public.normalize_unlocked_plots('[85]'::jsonb);
