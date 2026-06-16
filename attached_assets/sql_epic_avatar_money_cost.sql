-- ============================================================
-- Aktualizacja funkcji buy_epic_avatar
-- Dodaje obsługę avatarów 25-40 z kosztem 10 zł (money)
-- Wgraj w Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.buy_epic_avatar(p_avatar_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile        public.profiles%rowtype;
  v_seed_inventory jsonb;
  v_unlocked       integer[];
  v_cost_items     jsonb;
  v_cost_money     numeric;
  k                text;
  v                integer;
  have             integer;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil nie znaleziony');
  END IF;

  v_seed_inventory := COALESCE(v_profile.seed_inventory, '{}'::jsonb);
  v_unlocked       := COALESCE(v_profile.unlocked_epic_avatars, ARRAY[]::integer[]);

  IF p_avatar_id = ANY(v_unlocked) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Avatar juz odblokowany',
      'unlocked_epic_avatars', to_jsonb(v_unlocked));
  END IF;

  -- Koszty przedmiotami (oryginalne avatary 20-24)
  IF    p_avatar_id = 20 THEN v_cost_items := '{"carrot_good": 500}'::jsonb;
  ELSIF p_avatar_id = 21 THEN v_cost_items := '{"carrot_epic": 20}'::jsonb;
  ELSIF p_avatar_id = 22 THEN v_cost_items := '{"carrot_legendary": 1}'::jsonb;
  ELSIF p_avatar_id = 23 THEN v_cost_items := '{"potato_epic": 5, "carrot_epic": 5}'::jsonb;
  ELSIF p_avatar_id = 24 THEN v_cost_items := '{"potato_legendary": 1}'::jsonb;
  -- Koszty pieniędzmi (nowe avatary 25-40, cena tymczasowa 10 zł)
  ELSIF p_avatar_id >= 25 AND p_avatar_id <= 40 THEN v_cost_money := 10;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Nieznane ID avatara');
  END IF;

  -- Sprawdź i pobierz koszt przedmiotami
  IF v_cost_items IS NOT NULL THEN
    FOR k, v IN SELECT key, value::integer FROM jsonb_each_text(v_cost_items) LOOP
      have := COALESCE((v_seed_inventory ->> k)::integer, 0);
      IF have < v THEN
        RETURN jsonb_build_object('ok', false,
          'error', format('Za malo %s (masz %s, potrzeba %s)', k, have, v));
      END IF;
    END LOOP;
    FOR k, v IN SELECT key, value::integer FROM jsonb_each_text(v_cost_items) LOOP
      have := COALESCE((v_seed_inventory ->> k)::integer, 0);
      v_seed_inventory := jsonb_set(v_seed_inventory, ARRAY[k], to_jsonb(have - v));
    END LOOP;
  END IF;

  -- Sprawdź koszt pieniężny
  IF v_cost_money IS NOT NULL THEN
    IF COALESCE(v_profile.money, 0) < v_cost_money THEN
      RETURN jsonb_build_object('ok', false,
        'error', format('Za malo pieniedzy (masz %.2f zl, potrzeba %.2f zl)',
          v_profile.money, v_cost_money));
    END IF;
  END IF;

  v_unlocked := array_append(v_unlocked, p_avatar_id);

  IF v_cost_items IS NOT NULL THEN
    UPDATE public.profiles SET
      seed_inventory        = v_seed_inventory,
      unlocked_epic_avatars = v_unlocked
    WHERE id = auth.uid();
    RETURN jsonb_build_object(
      'ok', true,
      'avatar_id', p_avatar_id,
      'seed_inventory', v_seed_inventory,
      'unlocked_epic_avatars', to_jsonb(v_unlocked)
    );
  ELSE
    UPDATE public.profiles SET
      money                 = money - v_cost_money,
      unlocked_epic_avatars = v_unlocked
    WHERE id = auth.uid();
    RETURN jsonb_build_object(
      'ok', true,
      'avatar_id', p_avatar_id,
      'unlocked_epic_avatars', to_jsonb(v_unlocked)
    );
  END IF;
END;
$$;
