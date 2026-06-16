-- ============================================================
-- Patch: game_change_avatar_skin
-- - zakres 0-40 (21 epickich avatarów)
-- - pierwsze 2 zmiany gratis, każda kolejna 50 zł + cooldown 5 min
-- Wgraj w Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.game_change_avatar_skin(p_avatar_skin integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid                uuid := auth.uid();
  v_profile            public.profiles%rowtype;
  v_change_count       integer;
  v_last_change_at     bigint;
  v_now_ms             bigint;
  v_cost               numeric;
  v_cooldown_ms        bigint;
  v_remaining_ms       bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  -- Walidacja zakresu (0-19 normalne, 20-40 epickie)
  IF p_avatar_skin < 0 OR p_avatar_skin > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_avatar_skin');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- Dla epickich skinów: sprawdź czy odblokowany
  IF p_avatar_skin >= 20 THEN
    IF NOT (p_avatar_skin = ANY(COALESCE(v_profile.unlocked_epic_avatars, ARRAY[]::integer[]))) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'epic_not_unlocked');
    END IF;
  END IF;

  v_change_count   := COALESCE(v_profile.avatar_change_count, 0);
  v_last_change_at := COALESCE(v_profile.last_avatar_change_at, 0);
  v_now_ms         := EXTRACT(EPOCH FROM now())::bigint * 1000;

  -- Pierwsze 2 zmiany gratis i bez cooldownu
  -- Od 3. zmiany: 50 zł + cooldown 5 minut
  IF v_change_count < 2 THEN
    v_cost        := 0;
    v_cooldown_ms := 0;
  ELSE
    v_cost        := 50;
    v_cooldown_ms := 300000; -- 5 minut w ms
  END IF;

  -- Sprawdź cooldown
  IF v_cooldown_ms > 0 THEN
    v_remaining_ms := (v_last_change_at + v_cooldown_ms) - v_now_ms;
    IF v_remaining_ms > 0 THEN
      RETURN jsonb_build_object('ok', false, 'remaining_ms', v_remaining_ms);
    END IF;
  END IF;

  -- Sprawdź kasę
  IF v_cost > 0 AND COALESCE(v_profile.money, 0) < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enough_money');
  END IF;

  -- Dokonaj zmiany
  UPDATE public.profiles SET
    avatar_skin           = p_avatar_skin,
    avatar_change_count   = v_change_count + 1,
    last_avatar_change_at = v_now_ms,
    money                 = CASE WHEN v_cost > 0 THEN money - v_cost ELSE money END
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok',                    true,
    'avatar_skin',           p_avatar_skin,
    'avatar_change_count',   v_change_count + 1,
    'last_avatar_change_at', v_now_ms,
    'spent',                 v_cost
  );
END;
$$;
