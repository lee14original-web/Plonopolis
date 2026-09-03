-- ============================================================================
-- PLONOPOLIS — bonus wzrostu dla nowego konta
--
-- Przez 15 minut od utworzenia użytkownika w auth.users uprawy zasadzone poza
-- przewodnikiem otrzymują utrwalony mnożnik 0.25 (czas skrócony o 75%).
-- Uprawy z Kompostem Przewodnika nigdy nie otrzymują tego bonusu.
--
-- Skrypt nie ufa parametrom klienta. Trigger sam rozpoznaje nowe zasiewy,
-- sprawdza serwerowy czas rejestracji i zapisuje znacznik w konkretnym polu.
--
-- Uruchom cały plik w Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.growth_bonus_tutorial_exemptions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plot_id integer NOT NULL CHECK (plot_id BETWEEN 1 AND 100),
  pending boolean NOT NULL DEFAULT true,
  marked_at timestamptz NOT NULL DEFAULT now(),
  planted_at_ms bigint,
  PRIMARY KEY (user_id, plot_id)
);

ALTER TABLE public.growth_bonus_tutorial_exemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_bonus_tutorial_exemptions FROM PUBLIC, anon, authenticated;

-- Zachowaj już przygotowane puste pola z Kompostem Przewodnika.
INSERT INTO public.growth_bonus_tutorial_exemptions (user_id, plot_id, pending)
SELECT p.id, plot.plot_id, true
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN entry.key ~ '^[0-9]{1,3}$' THEN entry.key::integer
      ELSE NULL
    END AS plot_id,
    entry.value
  FROM jsonb_each(COALESCE(p.plot_crops, '{}'::jsonb)) AS entry(key, value)
) AS plot
WHERE COALESCE(plot.value ->> 'cropId', '') = ''
  AND COALESCE(plot.value -> 'compostBonus' ->> 'type', '') = 'guide'
  AND plot.plot_id BETWEEN 1 AND 100
ON CONFLICT (user_id, plot_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.stamp_new_account_growth_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_registered_at timestamptz;
  v_bonus_active boolean := false;
  v_plot_key text;
  v_new_plot jsonb;
  v_old_plot jsonb;
  v_new_crop_id text;
  v_old_crop_id text;
  v_is_new_planting boolean;
  v_is_tutorial_planting boolean;
  v_old_has_valid_bonus boolean;
  v_same_planting boolean;
  v_server_now_ms bigint;
  v_has_pending_tutorial_exemption boolean;
  v_crop_growth_ms bigint;
BEGIN
  SELECT created_at
  INTO v_registered_at
  FROM auth.users
  WHERE id = NEW.id;

  v_bonus_active :=
    v_registered_at IS NOT NULL
    AND clock_timestamp() < v_registered_at + interval '15 minutes';
  v_server_now_ms := floor(extract(epoch from clock_timestamp()) * 1000);

  NEW.plot_crops := COALESCE(NEW.plot_crops, '{}'::jsonb);

  FOR v_plot_key, v_new_plot IN
    SELECT key, value
    FROM jsonb_each(NEW.plot_crops)
  LOOP
    IF v_plot_key !~ '^[0-9]{1,3}$'
    OR v_plot_key::integer < 1
    OR v_plot_key::integer > 100 THEN
      CONTINUE;
    END IF;

    v_old_plot := CASE
      WHEN TG_OP = 'UPDATE'
        THEN COALESCE(OLD.plot_crops, '{}'::jsonb) -> v_plot_key
      ELSE NULL
    END;

    v_new_crop_id := COALESCE(v_new_plot ->> 'cropId', '');
    v_old_crop_id := COALESCE(v_old_plot ->> 'cropId', '');
    v_is_new_planting :=
      v_new_crop_id <> ''
      AND v_new_crop_id IS DISTINCT FROM v_old_crop_id;
    v_is_tutorial_planting :=
      COALESCE(v_old_plot -> 'compostBonus' ->> 'type', '') = 'guide'
      OR COALESCE(v_new_plot -> 'compostBonus' ->> 'type', '') = 'guide';

    -- Puste pole oznaczone kompostem przewodnika dostaje serwerowy, niewidoczny
    -- dla klienta znacznik. Usunięcie compostBonus z JSON nie usuwa wyjątku.
    IF v_new_crop_id = '' AND v_is_tutorial_planting THEN
      INSERT INTO public.growth_bonus_tutorial_exemptions (
        user_id, plot_id, pending, marked_at, planted_at_ms
      )
      VALUES (NEW.id, v_plot_key::integer, true, now(), NULL)
      ON CONFLICT (user_id, plot_id) DO UPDATE SET
        pending = true,
        marked_at = now(),
        planted_at_ms = NULL;
    END IF;

    SELECT COALESCE(bool_or(pending), false)
    INTO v_has_pending_tutorial_exemption
    FROM public.growth_bonus_tutorial_exemptions
    WHERE user_id = NEW.id
      AND plot_id = v_plot_key::integer;

    IF v_is_new_planting AND v_has_pending_tutorial_exemption THEN
      v_is_tutorial_planting := true;
    END IF;

    v_old_has_valid_bonus :=
      COALESCE((v_old_plot ->> 'newPlayerGrowthMult')::numeric, 1) = 0.25;
    v_same_planting :=
      v_old_crop_id <> ''
      AND v_old_crop_id = v_new_crop_id;

    -- Najpierw usuń każdą wartość dostarczoną przez klienta.
    v_new_plot := v_new_plot - 'newPlayerGrowthMult';

    IF v_is_new_planting THEN
      -- Każdy nowy zasiew dostaje czas serwera. Klient nie może podać
      -- plantedAt z przeszłości i od razu zebrać uprawy.
      v_new_plot := jsonb_set(
        v_new_plot,
        '{plantedAt}',
        to_jsonb(v_server_now_ms),
        true
      );

      IF v_is_tutorial_planting THEN
        INSERT INTO public.growth_bonus_tutorial_exemptions (
          user_id, plot_id, pending, marked_at, planted_at_ms
        )
        VALUES (NEW.id, v_plot_key::integer, false, now(), v_server_now_ms)
        ON CONFLICT (user_id, plot_id) DO UPDATE SET
          pending = false,
          planted_at_ms = EXCLUDED.planted_at_ms;
      ELSIF v_bonus_active THEN
        v_new_plot := jsonb_set(
          v_new_plot,
          '{newPlayerGrowthMult}',
          to_jsonb(0.25::numeric),
          true
        );
      END IF;
    ELSIF v_same_planting THEN
      IF (
        v_new_crop_id = 'carrot'
        AND COALESCE(v_old_plot -> 'compostBonus' ->> 'type', '') = 'guide'
        AND COALESCE((v_new_plot ->> 'watered')::boolean, false)
        AND COALESCE(NEW.tutorial_step, 0) = 9
      ) THEN
        -- Jedyny dozwolony wyjątek zmiany czasu istniejącej uprawy:
        -- krok 9 przewodnika po podlaniu. Serwer sam wylicza dokładny czas.
        SELECT growth_time_ms
        INTO v_crop_growth_ms
        FROM public.crop_config
        WHERE id = v_new_crop_id;

        v_new_plot := jsonb_set(
          v_new_plot,
          '{plantedAt}',
          to_jsonb(
            v_server_now_ms - GREATEST(round(COALESCE(v_crop_growth_ms, 900000) * 0.35) - 15000, 0)
          ),
          true
        );
      ELSE
        -- Istniejącej uprawie nie można zmienić serwerowego czasu posadzenia.
        v_new_plot := jsonb_set(
          v_new_plot,
          '{plantedAt}',
          COALESCE(v_old_plot -> 'plantedAt', to_jsonb(v_server_now_ms)),
          true
        );
      END IF;

      IF v_old_has_valid_bonus THEN
        -- Podlewanie i odświeżenie zachowują bonus nadany przy sadzeniu,
        -- niezależnie od późniejszego stanu przewodnika.
        v_new_plot := jsonb_set(
          v_new_plot,
          '{newPlayerGrowthMult}',
          to_jsonb(0.25::numeric),
          true
        );
      END IF;
    END IF;

    NEW.plot_crops := jsonb_set(
      NEW.plot_crops,
      ARRAY[v_plot_key],
      v_new_plot,
      true
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_new_account_growth_bonus_on_profiles
  ON public.profiles;

CREATE TRIGGER stamp_new_account_growth_bonus_on_profiles
BEFORE INSERT OR UPDATE OF plot_crops
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.stamp_new_account_growth_bonus();

-- Bezpieczna bramka zbioru. Stara funkcja zachowuje pełną logikę nagród,
-- jakości i EXP, ale klient nie ma już prawa wywoływać jej bezpośrednio.
-- Bramka akceptuje 25% bazy wyłącznie dla znacznika nadanego przez trigger.
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

-- Odbierz klientom dostęp do wszystkich historycznych przeciążeń starego RPC.
-- Wrapper SECURITY DEFINER nadal może wywołać bieżącą 10-parametrową funkcję.
DO $revoke$
DECLARE
  v_identity_args text;
BEGIN
  FOR v_identity_args IN
    SELECT pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'game_harvest_plot'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.game_harvest_plot(%s) FROM PUBLIC, anon, authenticated',
      v_identity_args
    );
  END LOOP;
END;
$revoke$;

REVOKE ALL ON FUNCTION public.stamp_new_account_growth_bonus() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.game_harvest_plot_secure(
  integer, bigint, integer, text, integer, integer, numeric, numeric, integer, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_harvest_plot_secure(
  integer, bigint, integer, text, integer, integer, numeric, numeric, integer, numeric
) TO authenticated;

-- Kontrola po wdrożeniu:
-- SELECT tgname
-- FROM pg_trigger
-- WHERE tgrelid = 'public.profiles'::regclass
--   AND tgname = 'stamp_new_account_growth_bonus_on_profiles'
--   AND NOT tgisinternal;