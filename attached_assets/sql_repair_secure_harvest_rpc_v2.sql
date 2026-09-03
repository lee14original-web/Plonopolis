-- Naprawa błędu PostgREST:
-- "Could not find the function public.game_harvest_plot_secure(...) in the schema cache"
--
-- Ten skrypt nie zmienia balansu wzrostu:
-- - zwykłe uprawy zachowują minimum 35% czasu bazowego,
-- - uprawy z serwerowym bonusem nowego konta mogą zejść do 25%,
-- - uprawy przewodnika nie korzystają z bonusu nowego konta.

CREATE OR REPLACE FUNCTION public.game_harvest_plot_secure(
  p_plot_id              integer,
  p_effective_grow_ms    bigint  DEFAULT NULL,
  p_zrecznosc            integer DEFAULT 0,
  p_planted_quality      text    DEFAULT 'good',
  p_exp_mult_override    integer DEFAULT 0,
  p_compost_yield_extra  integer DEFAULT 0,
  p_extra_harvest_pct    numeric DEFAULT 0,
  p_bonus_drop_pct       numeric DEFAULT 0,
  p_szczescie            integer DEFAULT 0,
  p_exp_bonus_pct        numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%rowtype;
  v_plot jsonb;
  v_crop public.crop_config%rowtype;
  v_planted_at_ms bigint;
  v_now_ms bigint;
  v_minimum_multiplier numeric;
  v_minimum_growth_ms bigint;
  v_authorized_growth_ms bigint;
  v_has_starter_bonus boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Brak autoryzacji';
  END IF;

  IF p_plot_id < 1 OR p_plot_id > 100 THEN
    RAISE EXCEPTION 'Nieprawidłowe pole';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil nie istnieje';
  END IF;

  v_plot := COALESCE(v_profile.plot_crops, '{}'::jsonb) -> (p_plot_id::text);
  IF v_plot IS NULL OR COALESCE(v_plot ->> 'cropId', '') = '' THEN
    RAISE EXCEPTION 'Na tym polu nie ma uprawy';
  END IF;

  SELECT *
  INTO v_crop
  FROM public.crop_config
  WHERE id = v_plot ->> 'cropId';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono definicji uprawy';
  END IF;

  v_has_starter_bonus :=
    COALESCE((v_plot ->> 'newPlayerGrowthMult')::numeric, 1) = 0.25
    AND COALESCE(v_plot -> 'compostBonus' ->> 'type', '') <> 'guide';

  v_minimum_multiplier := CASE
    WHEN v_has_starter_bonus THEN 0.25
    ELSE 0.35
  END;

  v_minimum_growth_ms := round(v_crop.growth_time_ms * v_minimum_multiplier);
  v_authorized_growth_ms := GREATEST(
    COALESCE(p_effective_grow_ms, v_crop.growth_time_ms),
    v_minimum_growth_ms
  );
  v_authorized_growth_ms := LEAST(v_authorized_growth_ms, v_crop.growth_time_ms);

  v_planted_at_ms := COALESCE((v_plot ->> 'plantedAt')::bigint, 0);
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000);

  IF v_now_ms - v_planted_at_ms < v_authorized_growth_ms THEN
    RAISE EXCEPTION 'Uprawa jeszcze nie dojrzała';
  END IF;

  RETURN public.game_harvest_plot(
    p_plot_id,
    v_authorized_growth_ms,
    p_zrecznosc,
    p_planted_quality,
    p_exp_mult_override,
    p_compost_yield_extra,
    p_extra_harvest_pct,
    p_bonus_drop_pct,
    p_szczescie,
    p_exp_bonus_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.game_harvest_plot_secure(
  integer, bigint, integer, text, integer, integer, numeric, numeric, integer, numeric
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.game_harvest_plot_secure(
  integer, bigint, integer, text, integer, integer, numeric, numeric, integer, numeric
) TO authenticated;

-- Wymuś odświeżenie cache schematu PostgREST/Supabase.
NOTIFY pgrst, 'reload schema';

-- Kontrola: wynik powinien zawierać jeden wiersz z pełną sygnaturą funkcji.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'game_harvest_plot_secure';