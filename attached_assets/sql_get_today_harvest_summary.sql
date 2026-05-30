-- ============================================================
-- KROK 2: Utwórz RPC get_today_harvest_summary
--
-- Wykonaj po KROKU 1 w Supabase SQL Editor.
-- Zwraca { items: [...], total_exp: N } dla bieżącego dnia
-- w strefie Europe/Warsaw (00:00–23:59:59).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_today_harvest_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_today_start timestamptz;
  v_today_end   timestamptz;
  v_result      json;
begin
  if auth.uid() is null then raise exception 'Brak autoryzacji'; end if;

  -- Zakres bieżącego dnia w strefie Europe/Warsaw
  v_today_start := date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw';
  v_today_end   := v_today_start + interval '1 day';

  SELECT json_build_object(
    'items', (
      SELECT coalesce(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT
          crop_id,
          quality,
          SUM(amount) AS amount
        FROM public.harvest_history
        WHERE user_id    = auth.uid()
          AND created_at >= v_today_start
          AND created_at <  v_today_end
        GROUP BY crop_id, quality
        ORDER BY
          CASE quality
            WHEN 'legendary' THEN 4
            WHEN 'epic'      THEN 3
            WHEN 'good'      THEN 2
            ELSE 1
          END DESC,
          crop_id ASC
      ) s
    ),
    'total_exp', coalesce((
      SELECT SUM(exp_gained)
      FROM public.harvest_history
      WHERE user_id    = auth.uid()
        AND created_at >= v_today_start
        AND created_at <  v_today_end
    ), 0)
  )
  INTO v_result;

  RETURN coalesce(v_result, json_build_object('items', '[]'::json, 'total_exp', 0));
end;
$$;
