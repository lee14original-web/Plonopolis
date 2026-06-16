-- ═══════════════════════════════════════════════════════════════════════
-- admin_reset_tutorial_test_account(p_login text)
-- v2 — bez game_repair_plot_obstacles (rzuca Brak autoryzacji przez auth.uid())
--      Frontend wywołuje naprawę przeszkód przy wejściu w Widok pola.
--
-- Resetuje dane gry w public.profiles dla konta o podanym loginie.
-- NIE usuwa auth.users, NIE usuwa profilu.
-- NIE zmienia: id, login, email, created_at.
-- Czyści customer_orders dla danego user_id.
-- SECURITY DEFINER — działa z uprawnieniami właściciela funkcji.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reset_tutorial_test_account(p_login text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE login = p_login;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono profilu dla loginu: %', p_login;
  END IF;

  UPDATE public.profiles
  SET
    level              = 1,
    xp                 = 0,
    xp_to_next_level   = public.game_xp_to_next_level(1),
    money              = 10,
    unlocked_plots     = ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    plot_crops         = '{}'::jsonb,
    seed_inventory     = '{"carrot_good": 3}'::jsonb,
    tutorial_started   = false,
    tutorial_completed = false,
    tutorial_skipped   = false,
    tutorial_step      = 0,
    blocked_users      = ARRAY[]::uuid[]
  WHERE id = v_profile_id;

  DELETE FROM public.customer_orders
  WHERE user_id = v_profile_id;

END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- Użycie (SQL Editor Supabase):
-- SELECT public.admin_reset_tutorial_test_account('zastrzal11');
--
-- Weryfikacja:
-- SELECT login, level, xp, money, tutorial_started, tutorial_completed,
--        tutorial_skipped, tutorial_step
-- FROM public.profiles WHERE login = 'zastrzal11';
-- ═══════════════════════════════════════════════════════════════════════
