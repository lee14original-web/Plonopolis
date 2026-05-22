-- ─── Kolumna tutorial_skipped w profiles ───
-- Bezpieczne dodanie (idempotentne: IF NOT EXISTS)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tutorial_skipped BOOLEAN NOT NULL DEFAULT FALSE;

-- Uwaga: stare konta mają już tutorial_completed=TRUE z poprzedniej migracji
-- (sql_add_tutorial_state_v1.sql), więc okno przewodnika i tak się dla nich nie pokaże.
-- tutorial_skipped=FALSE dla wszystkich istniejących kont jest właściwe.
