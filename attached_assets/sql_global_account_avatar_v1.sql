-- ============================================================
-- Plonopolis: globalny avatar konta + przyszła waluta premium
--
-- GLOBALNE:
--   avatar_skin, unlocked_epic_avatars, premium_currency,
--   licznik i cooldown zmian avatara.
--
-- SERWEROWE:
--   cały obecny public.profiles (Testy): level, xp, money,
--   uprawy, pola, itemy, ekwipunek, stodoła, sad itd.
--
-- Uruchom cały plik w Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_skin integer,
  unlocked_epic_avatars integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  premium_currency bigint NOT NULL DEFAULT 0,
  avatar_change_count integer NOT NULL DEFAULT 0,
  last_avatar_change_at bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_profiles_avatar_range
    CHECK (avatar_skin IS NULL OR avatar_skin BETWEEN 0 AND 40),
  CONSTRAINT account_profiles_premium_nonnegative
    CHECK (premium_currency >= 0),
  CONSTRAINT account_profiles_change_count_nonnegative
    CHECK (avatar_change_count >= 0)
);

ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_profiles_select_own" ON public.account_profiles;
CREATE POLICY "account_profiles_select_own"
  ON public.account_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.account_profiles FROM anon, authenticated;
GRANT SELECT ON public.account_profiles TO authenticated;

-- Zablokuj klientom dalsze modyfikowanie starych pól avatara zanim zostaną
-- odczytane przez jednorazową migrację poniżej. Funkcje SECURITY DEFINER
-- działające jako właściciel bazy nadal mogą utrzymywać kompatybilny mirror.
CREATE OR REPLACE FUNCTION public.block_direct_legacy_avatar_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    (
      TG_OP = 'INSERT'
      AND (
        COALESCE(NEW.avatar_skin, -1) <> -1
        OR cardinality(COALESCE(NEW.unlocked_epic_avatars, ARRAY[]::integer[])) > 0
        OR COALESCE(NEW.avatar_change_count, 0) <> 0
        OR COALESCE(NEW.last_avatar_change_at, 0) <> 0
      )
    )
    OR (
      TG_OP = 'UPDATE'
      AND (
        NEW.avatar_skin IS DISTINCT FROM OLD.avatar_skin
        OR NEW.unlocked_epic_avatars IS DISTINCT FROM OLD.unlocked_epic_avatars
        OR NEW.avatar_change_count IS DISTINCT FROM OLD.avatar_change_count
        OR NEW.last_avatar_change_at IS DISTINCT FROM OLD.last_avatar_change_at
      )
    )
  ) THEN
    RAISE EXCEPTION 'Global avatar state can only be changed through approved RPC functions.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_legacy_avatar_fields ON public.profiles;
CREATE TRIGGER protect_legacy_avatar_fields
BEFORE UPDATE OF
  avatar_skin,
  unlocked_epic_avatars,
  avatar_change_count,
  last_avatar_change_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.block_direct_legacy_avatar_writes();

DROP TRIGGER IF EXISTS protect_legacy_avatar_fields_on_insert ON public.profiles;
CREATE TRIGGER protect_legacy_avatar_fields_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.block_direct_legacy_avatar_writes();

-- Migracja obecnych kont z serwera Testy. Nie przenosi żadnego postępu gry.
INSERT INTO public.account_profiles (
  user_id,
  avatar_skin,
  unlocked_epic_avatars,
  avatar_change_count,
  last_avatar_change_at
)
SELECT
  p.id,
  CASE
    WHEN p.avatar_skin BETWEEN 0 AND 19 THEN p.avatar_skin
    WHEN p.avatar_skin BETWEEN 20 AND 40
    AND p.avatar_skin = ANY(COALESCE(p.unlocked_epic_avatars, ARRAY[]::integer[]))
      THEN p.avatar_skin
    ELSE NULL
  END,
  ARRAY(
    SELECT DISTINCT avatar_id
    FROM unnest(COALESCE(p.unlocked_epic_avatars, ARRAY[]::integer[])) AS legacy(avatar_id)
    WHERE avatar_id BETWEEN 20 AND 40
    ORDER BY avatar_id
  ),
  COALESCE(p.avatar_change_count, 0),
  COALESCE(p.last_avatar_change_at, 0)
FROM public.profiles p
-- Celowo nie aktualizuj istniejących rekordów: ponowne uruchomienie pliku
-- nie może ponownie promować danych ze starego profilu do części globalnej.
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.game_get_global_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.account_profiles%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  -- Import z legacy profiles odbywa się tylko raz w migracji powyżej.
  -- Ten runtime path nigdy nie promuje klientowo edytowalnego profilu serwera
  -- do globalnych odblokowań.
  INSERT INTO public.account_profiles (user_id)
  VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_account
  FROM public.account_profiles
  WHERE user_id = v_uid;

  -- Mirror dla istniejących rankingów, wiadomości i kodu serwera Testy.
  UPDATE public.profiles
  SET
    avatar_skin = v_account.avatar_skin,
    unlocked_epic_avatars = v_account.unlocked_epic_avatars,
    avatar_change_count = v_account.avatar_change_count,
    last_avatar_change_at = v_account.last_avatar_change_at
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'avatar_skin', v_account.avatar_skin,
    'unlocked_epic_avatars', to_jsonb(v_account.unlocked_epic_avatars),
    'premium_currency', v_account.premium_currency,
    'avatar_change_count', v_account.avatar_change_count,
    'last_avatar_change_at', v_account.last_avatar_change_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.game_set_initial_avatar(p_avatar_skin integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.account_profiles%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  IF p_avatar_skin < 0 OR p_avatar_skin > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_avatar_skin');
  END IF;

  PERFORM public.game_get_global_account();

  SELECT * INTO v_account
  FROM public.account_profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_account.avatar_skin IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'avatar_already_selected');
  END IF;

  IF p_avatar_skin >= 20 AND NOT (
    p_avatar_skin = ANY(COALESCE(v_account.unlocked_epic_avatars, ARRAY[]::integer[]))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'epic_not_unlocked');
  END IF;

  UPDATE public.account_profiles
  SET avatar_skin = p_avatar_skin, updated_at = now()
  WHERE user_id = v_uid;

  UPDATE public.profiles
  SET avatar_skin = p_avatar_skin
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'avatar_skin', p_avatar_skin,
    'avatar_change_count', v_account.avatar_change_count,
    'last_avatar_change_at', v_account.last_avatar_change_at,
    'unlocked_epic_avatars', to_jsonb(v_account.unlocked_epic_avatars)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.game_change_avatar_skin(p_avatar_skin integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.account_profiles%rowtype;
  v_profile public.profiles%rowtype;
  v_now_ms bigint;
  v_cost numeric;
  v_cooldown_ms bigint;
  v_remaining_ms bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  IF p_avatar_skin < 0 OR p_avatar_skin > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_avatar_skin');
  END IF;

  PERFORM public.game_get_global_account();

  SELECT * INTO v_account
  FROM public.account_profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF p_avatar_skin >= 20 AND NOT (
    p_avatar_skin = ANY(COALESCE(v_account.unlocked_epic_avatars, ARRAY[]::integer[]))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'epic_not_unlocked');
  END IF;

  IF v_account.avatar_skin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'initial_avatar_required');
  END IF;

  v_now_ms := EXTRACT(EPOCH FROM clock_timestamp())::bigint * 1000;

  IF v_account.avatar_change_count < 2 THEN
    v_cost := 0;
    v_cooldown_ms := 0;
  ELSE
    v_cost := 50;
    v_cooldown_ms := 300000;
  END IF;

  IF v_cooldown_ms > 0 THEN
    v_remaining_ms := (v_account.last_avatar_change_at + v_cooldown_ms) - v_now_ms;
    IF v_remaining_ms > 0 THEN
      RETURN jsonb_build_object('ok', false, 'remaining_ms', v_remaining_ms);
    END IF;
  END IF;

  IF v_cost > 0 AND COALESCE(v_profile.money, 0) < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_money');
  END IF;

  UPDATE public.account_profiles
  SET
    avatar_skin = p_avatar_skin,
    avatar_change_count = avatar_change_count + 1,
    last_avatar_change_at = v_now_ms,
    updated_at = now()
  WHERE user_id = v_uid;

  -- Koszt zmiany jest opłacany wyłącznie z bieżącego serwera.
  UPDATE public.profiles
  SET
    avatar_skin = p_avatar_skin,
    avatar_change_count = v_account.avatar_change_count + 1,
    last_avatar_change_at = v_now_ms,
    money = CASE WHEN v_cost > 0 THEN money - v_cost ELSE money END
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'avatar_skin', p_avatar_skin,
    'avatar_change_count', v_account.avatar_change_count + 1,
    'last_avatar_change_at', v_now_ms,
    'spent', v_cost
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_epic_avatar(p_avatar_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.account_profiles%rowtype;
  v_profile public.profiles%rowtype;
  v_seed_inventory jsonb;
  v_unlocked integer[];
  v_cost_items jsonb;
  v_cost_money numeric;
  k text;
  v integer;
  have integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  PERFORM public.game_get_global_account();

  SELECT * INTO v_account
  FROM public.account_profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  v_seed_inventory := COALESCE(v_profile.seed_inventory, '{}'::jsonb);
  v_unlocked := COALESCE(v_account.unlocked_epic_avatars, ARRAY[]::integer[]);

  IF p_avatar_id = ANY(v_unlocked) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'avatar_already_unlocked',
      'unlocked_epic_avatars', to_jsonb(v_unlocked)
    );
  END IF;

  IF p_avatar_id = 20 THEN v_cost_items := '{"carrot_good": 500}'::jsonb;
  ELSIF p_avatar_id = 21 THEN v_cost_items := '{"carrot_epic": 20}'::jsonb;
  ELSIF p_avatar_id = 22 THEN v_cost_items := '{"carrot_legendary": 1}'::jsonb;
  ELSIF p_avatar_id = 23 THEN v_cost_items := '{"potato_epic": 5, "carrot_epic": 5}'::jsonb;
  ELSIF p_avatar_id = 24 THEN v_cost_items := '{"potato_legendary": 1}'::jsonb;
  ELSIF p_avatar_id BETWEEN 25 AND 40 THEN v_cost_money := 10;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_avatar');
  END IF;

  IF v_cost_items IS NOT NULL THEN
    FOR k, v IN SELECT key, value::integer FROM jsonb_each_text(v_cost_items) LOOP
      have := COALESCE((v_seed_inventory ->> k)::integer, 0);
      IF have < v THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_enough_items');
      END IF;
    END LOOP;

    FOR k, v IN SELECT key, value::integer FROM jsonb_each_text(v_cost_items) LOOP
      have := COALESCE((v_seed_inventory ->> k)::integer, 0);
      v_seed_inventory := jsonb_set(v_seed_inventory, ARRAY[k], to_jsonb(have - v));
    END LOOP;
  END IF;

  IF v_cost_money IS NOT NULL AND COALESCE(v_profile.money, 0) < v_cost_money THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_money');
  END IF;

  v_unlocked := array_append(v_unlocked, p_avatar_id);

  UPDATE public.account_profiles
  SET unlocked_epic_avatars = v_unlocked, updated_at = now()
  WHERE user_id = v_uid;

  -- Koszt odblokowania schodzi wyłącznie z profilu bieżącego serwera.
  UPDATE public.profiles
  SET
    seed_inventory = CASE
      WHEN v_cost_items IS NOT NULL THEN v_seed_inventory
      ELSE seed_inventory
    END,
    money = CASE
      WHEN v_cost_money IS NOT NULL THEN money - v_cost_money
      ELSE money
    END,
    unlocked_epic_avatars = v_unlocked
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'avatar_id', p_avatar_id,
    'seed_inventory', v_seed_inventory,
    'unlocked_epic_avatars', to_jsonb(v_unlocked)
  );
END;
$$;

-- Backendowa bramka: klient nie może rozpocząć przewodnika bez globalnego
-- avatara, nawet wywołując RPC poza interfejsem.
CREATE OR REPLACE FUNCTION public.game_start_tutorial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_account account_profiles%rowtype;
  v_inv jsonb;
  v_current integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  SELECT * INTO v_account
  FROM account_profiles
  WHERE user_id = v_uid;

  IF NOT FOUND OR v_account.avatar_skin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'avatar_required');
  END IF;

  SELECT * INTO v_profile
  FROM profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF COALESCE(v_profile.tutorial_started, false) = TRUE
  OR COALESCE(v_profile.tutorial_completed, false) = TRUE
  OR COALESCE(v_profile.tutorial_skipped, false) = TRUE
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  v_inv := COALESCE(v_profile.seed_inventory, '{}'::jsonb);
  v_current := COALESCE((v_inv->>'guide_compost')::integer, 0);
  v_inv := jsonb_set(v_inv, '{guide_compost}', to_jsonb(v_current + 3));

  UPDATE profiles
  SET
    tutorial_started = TRUE,
    tutorial_completed = FALSE,
    tutorial_skipped = FALSE,
    tutorial_step = 1,
    seed_inventory = v_inv,
    xp_to_next_level = public.game_xp_to_next_level(COALESCE(level, 1))
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'guide_compost_granted', 3);
END;
$$;

GRANT EXECUTE ON FUNCTION public.game_get_global_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_set_initial_avatar(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_change_avatar_skin(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_epic_avatar(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_start_tutorial() TO authenticated;