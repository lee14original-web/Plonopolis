-- ============================================================
-- KROK 1: Utwórz tabelę harvest_history
--
-- Wykonaj jako pierwsze w Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.harvest_history (
  id         bigserial   PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  crop_id    text        NOT NULL,
  quality    text        NOT NULL CHECK (quality IN ('rotten','good','epic','legendary')),
  amount     integer     NOT NULL DEFAULT 0,
  exp_gained integer     NOT NULL DEFAULT 0
);

-- Row Level Security
ALTER TABLE public.harvest_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "harvest_history: select own"
  ON public.harvest_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "harvest_history: insert own"
  ON public.harvest_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indeks: zapytania dzienne (user + zakres dat)
CREATE INDEX IF NOT EXISTS harvest_history_user_created_idx
  ON public.harvest_history(user_id, created_at DESC);
