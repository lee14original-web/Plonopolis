-- ─── Tutorial state dla profili gracza ───
-- Bezpieczne dodanie kolumn (idempotentne: IF NOT EXISTS)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tutorial_started   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Migracja starych kont ───
-- Gracze z postępem (level > 1 LUB xp > 0) traktowani jako "ukończyli onboarding"
-- — okno NIE pojawi się dla nich ponownie.
-- Nowe konta (level=1, xp=0) zostaną z tutorial_completed=FALSE i zobaczą okno przewodnika.
-- Uwaga: money celowo pominięte — może być nagrodą startową lub testowo dodane.

UPDATE profiles
SET
  tutorial_started   = TRUE,
  tutorial_completed = TRUE
WHERE
  level > 1
  OR xp > 0;

-- ─── Indeks pomocniczy (opcjonalny, przydatny przy rankingach/filtrach) ───
-- CREATE INDEX IF NOT EXISTS idx_profiles_tutorial_completed ON profiles (tutorial_completed);
