-- Dodaje city_liga (i farm30) do dozwolonych map w game_change_map
-- Wklej w Supabase → SQL Editor → uruchom

CREATE OR REPLACE FUNCTION public.game_change_map(p_target_map text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_valid text[] := ARRAY[
    'farm1', 'farm5', 'farm10', 'farm15', 'farm20', 'farm25', 'farm30',
    'city', 'city_shop', 'city_market', 'city_bank', 'city_townhall', 'city_liga'
  ];
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nie jesteś zalogowany';
  END IF;

  IF NOT (p_target_map = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Nieprawidłowa mapa';
  END IF;

  UPDATE profiles
  SET current_map = p_target_map
  WHERE id = v_uid;

  SELECT to_jsonb(p.*)
  INTO v_result
  FROM profiles p
  WHERE p.id = v_uid;

  RETURN v_result;
END;
$$;
