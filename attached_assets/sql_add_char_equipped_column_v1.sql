-- Dodaje kolumnę char_equipped do tabeli profiles
-- Przechowuje które przedmioty są ubrane na postaci (synchronizacja między urządzeniami)
-- Wcześniej dane były tylko w localStorage (brak synchronizacji na telefonie/nowym urządzeniu)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS char_equipped jsonb DEFAULT NULL;
