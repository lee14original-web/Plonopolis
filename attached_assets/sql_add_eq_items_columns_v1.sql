-- Dodaje kolumny synchronizacji ekwipunku gracza do tabeli profiles
-- Wcześniej dane były tylko w localStorage (brak synchronizacji na telefonie/nowym urządzeniu)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS owned_eq_items   jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extra_eq_items   jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS item_upg_registry jsonb DEFAULT NULL;
