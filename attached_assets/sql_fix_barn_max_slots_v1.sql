-- =====================================================
-- FIX: max_slots w barn_animal_defs
-- Problem: wszystkie zwierzęta mają max_slots=1 zamiast
--          prawidłowych wartości z klienta (Game.tsx).
-- Efekt błędu: collect_animal zwraca LEAST(owned, 1)=1
--              niezależnie od liczby posiadanych zwierząt.
-- Uruchom RAZ w Supabase SQL Editor.
-- =====================================================

UPDATE barn_animal_defs SET max_slots = 24 WHERE animal_id = 'kura';
UPDATE barn_animal_defs SET max_slots = 20 WHERE animal_id = 'krolik';
UPDATE barn_animal_defs SET max_slots = 16 WHERE animal_id = 'krowa';
UPDATE barn_animal_defs SET max_slots = 16 WHERE animal_id = 'kaczka';
UPDATE barn_animal_defs SET max_slots = 12 WHERE animal_id = 'owca';
UPDATE barn_animal_defs SET max_slots = 10 WHERE animal_id = 'swinia';
UPDATE barn_animal_defs SET max_slots =  8 WHERE animal_id = 'koza';
UPDATE barn_animal_defs SET max_slots =  8 WHERE animal_id = 'indyk';
UPDATE barn_animal_defs SET max_slots =  6 WHERE animal_id = 'kon';
UPDATE barn_animal_defs SET max_slots =  4 WHERE animal_id = 'byk';

-- Weryfikacja po wykonaniu:
SELECT animal_id, max_slots FROM barn_animal_defs ORDER BY animal_id;
