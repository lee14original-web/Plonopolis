-- ═══════════════════════════════════════════════════════════════
-- Moc farmy — kolumna w profiles + aktualizacja get_player_ranking
-- Uruchom w Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Dodaj kolumnę farm_power do profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS farm_power INTEGER DEFAULT 0;

-- 2. Zaktualizuj get_player_ranking — zwraca farm_power i sortuje po nim
CREATE OR REPLACE FUNCTION public.get_player_ranking()
RETURNS TABLE(
  user_id            uuid,
  player_name        text,
  guild_name         text,
  level              integer,
  money              numeric,
  missions_completed integer,
  farm_power         integer
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    p.id                                                AS user_id,
    COALESCE(p.username, split_part(u.email, '@', 1))  AS player_name,
    COALESCE(p.guild_name, 'Brak')                     AS guild_name,
    COALESCE(p.level, 1)                               AS level,
    COALESCE(p.money::numeric, 0)                      AS money,
    COALESCE(p.missions_completed, 0)                  AS missions_completed,
    COALESCE(p.farm_power, 0)                          AS farm_power
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.farm_power DESC, p.level DESC, p.money DESC, player_name ASC;
$function$;
