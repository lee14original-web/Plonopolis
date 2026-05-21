-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: get_player_ranking — poprawka player_name + wykluczenie ról technicznych
-- ───────────────────────────────────────────────────────────────────────────
-- Bug 1: player_name używał p.username (nieistniejące pole) → fallback na email.
--        Poprawka: COALESCE(p.login, 'Gracz') — bez emaila.
-- Bug 2: Brak filtra ról → testerzy/adminowie widoczni w rankingu.
--        Poprawka: WHERE p.role NOT IN ('tester','admin','owner','system')
--        Gracze z rolą 'player' i 'moderator' pozostają w rankingu.
-- Reszta (farm_power, ranking_score, customer_orders_completed) — bez zmian.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_player_ranking();

CREATE OR REPLACE FUNCTION public.get_player_ranking()
RETURNS TABLE(
  user_id                    uuid,
  player_name                text,
  guild_name                 text,
  level                      integer,
  money                      numeric,
  missions_completed         integer,
  farm_power                 integer,
  ranking_score              float8,
  avatar_skin                integer,
  customer_orders_completed  integer
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    p.id                                                                       AS user_id,
    COALESCE(NULLIF(TRIM(p.login), ''), 'Gracz')                             AS player_name,
    COALESCE(p.guild_name, 'Brak')                                            AS guild_name,
    COALESCE(p.level, 1)                                                      AS level,
    COALESCE(p.money::numeric, 0)                                             AS money,
    COALESCE(p.missions_completed, 0)                                         AS missions_completed,
    COALESCE(p.farm_power, 0)                                                 AS farm_power,
    COALESCE(p.farm_power, 0) * 1000.0
      + COALESCE(p.level, 1) * 75000.0
      + SQRT(GREATEST(COALESCE(p.money::float, 0), 0))                       AS ranking_score,
    COALESCE(p.avatar_skin, 0)                                                AS avatar_skin,
    COALESCE(p.customer_orders_completed, 0)                                  AS customer_orders_completed
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE COALESCE(p.role, 'player') NOT IN ('tester', 'admin', 'owner', 'system')
  ORDER BY ranking_score DESC, player_name ASC;
$function$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TESTY KONTROLNE (uruchom po wgraniu):
--
-- T1. Podstawowy podgląd rankingu:
--   SELECT player_name, level, customer_orders_completed
--     FROM get_player_ranking()
--    LIMIT 20;
--   → Nie powinno być adresów email ani 'tymek_spisak' zamiast 'zastrzal11'.
--
-- T2. Sprawdź, czy tester nie wchodzi do rankingu:
--   SELECT COUNT(*) FROM get_player_ranking() r
--     JOIN profiles p ON p.id = r.user_id
--    WHERE p.role IN ('tester', 'admin', 'owner', 'system');
--   → Wynik: 0
--
-- T3. Sprawdź konkretne konto:
--   SELECT player_name, level FROM get_player_ranking()
--    WHERE player_name ILIKE '%zastrzal%' OR player_name ILIKE '%tymek%';
--   → Powinno zwrócić: zastrzal11 (jeśli ma rolę player/moderator).
--   → Nie powinno zwrócić: tymek_spisak (to był email fallback).
--
-- T4. Sprawdź profile z pustym loginem (czy fallback działa):
--   SELECT player_name FROM get_player_ranking()
--    WHERE player_name = 'Gracz';
-- ═══════════════════════════════════════════════════════════════════════════
