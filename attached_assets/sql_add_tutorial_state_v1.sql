-- ─── Tutorial state dla profili gracza ───
-- Bezpieczne dodanie kolumn (idempotentne: IF NOT EXISTS)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tutorial_started   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Migracja starych kont ───
-- Gracze, którzy mają już postęp (level > 1 LUB doświadczenie > 0 LUB pieniądze powyżej startowych)
-- traktowani jako "ukończyli onboarding" — okno NIE pojawi się dla nich ponownie.
-- Gracze z level=1, xp=0, money<=500 są traktowani jako nowi i zobaczą okno przewodnika.

UPDATE profiles
SET
  tutorial_started   = TRUE,
  tutorial_completed = TRUE
WHERE
  level > 1
  OR xp   > 0
  OR money > 500;

-- ─── Indeks pomocniczy (opcjonalny, przydatny przy rankingach/filtrach) ───
-- CREATE INDEX IF NOT EXISTS idx_profiles_tutorial_completed ON profiles (tutorial_completed);
