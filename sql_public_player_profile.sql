-- ================================================================
-- get_public_player_profile — odczyt publicznych danych profilu gracza
-- SECURITY DEFINER omija RLS i pozwala zalogowanym graczom
-- widzieć statystyki i ekwipunek innych graczy w rankingu.
--
-- Uruchom ten plik w Supabase SQL Editor.
-- ================================================================

CREATE OR REPLACE FUNCTION get_public_player_profile(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'player_stats',       player_stats,
    'char_equipped',      char_equipped,
    'item_upg_registry',  item_upg_registry,
    'avatar_skin',        avatar_skin,
    'level',              level,
    'login',              login
  )
  FROM profiles
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_public_player_profile(uuid) TO authenticated;
