-- ═══════════════════════════════════════════════════════════════
-- Nowa formuła rankingu: farmPower*1000 + level*75000 + sqrt(money)
-- POPRAWKA: dodano avatar_skin do zwracanych kolumn
-- Uruchom w Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_player_ranking();

CREATE OR REPLACE FUNCTION public.get_player_ranking()
RETURNS TABLE(
  user_id            uuid,
  player_name        text,
  guild_name         text,
  level              integer,
  money              numeric,
  missions_completed integer,
  farm_power         integer,
  ranking_score      float8,
  avatar_skin        integer
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    p.id                                                                                                    AS user_id,
    COALESCE(p.username, split_part(u.email, '@', 1))                                                      AS player_name,
    COALESCE(p.guild_name, 'Brak')                                                                         AS guild_name,
    COALESCE(p.level, 1)                                                                                    AS level,
    COALESCE(p.money::numeric, 0)                                                                          AS money,
    COALESCE(p.missions_completed, 0)                                                                      AS missions_completed,
    COALESCE(p.farm_power, 0)                                                                              AS farm_power,
    COALESCE(p.farm_power, 0) * 1000.0
      + COALESCE(p.level, 1) * 75000.0
      + SQRT(GREATEST(COALESCE(p.money::float, 0), 0))                                                    AS ranking_score,
    COALESCE(p.avatar_skin, 0)                                                                             AS avatar_skin
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY ranking_score DESC, player_name ASC;
$function$;
