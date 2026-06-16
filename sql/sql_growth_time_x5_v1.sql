-- ============================================================
-- BALANS: Czas wzrostu upraw ×5
-- Wklej do Supabase SQL Editor i wykonaj
--
-- ZMIANY:
--   1. Dostosowuje plantedAt dla aktywnych upraw (zachowuje % postępu)
--      new_planted_at = now_ms − (elapsed_ms × 5)
--      → uprawa w 40% zostaje w 40%, nie wymagamy ponownego sadzenia
--   2. Aktualizuje crop_config.growth_time_ms × 5 dla wszystkich upraw
--      (drzewa w tabeli orchard_config/tree_config NIE są zmieniane)
--
-- DOTYCZY crop IDs:
--   test_nasiono, carrot, potato, tomato, cucumber, onion, garlic,
--   lettuce, radish, beet, pepper, cabbage, broccoli, cauliflower,
--   strawberry, raspberry, blueberry, eggplant, zucchini, watermelon,
--   grape, pumpkin, rapeseed, sunflower, chili, asparagus
--
-- UWAGA: Krok 1 musi zostać wykonany PRZED krokiem 2,
--        ponieważ krok 2 zmienia growth_time_ms w crop_config.
-- ============================================================

BEGIN;

-- ─── KROK 1: Dostosuj plantedAt dla aktywnych upraw ────────────────────────
-- Dla każdego gracza, dla każdego pola z aktywną uprawą:
--   elapsed_old = now_ms − planted_at
--   new_planted_at = now_ms − (elapsed_old × 5)
-- Zachowuje ten sam % ukończenia po zmianie growth_time_ms × 5.
-- Uprawy już gotowe (elapsed >= old_growth_ms) pozostają gotowe.

DO $$
DECLARE
  v_now_ms        bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_rec           record;
  v_plot_crops    jsonb;
  v_updated       jsonb;
  v_plot_key      text;
  v_plot          jsonb;
  v_crop_id       text;
  v_planted_at    bigint;
  v_elapsed       bigint;
  v_new_planted   bigint;
  v_changed       boolean;
  v_count         integer := 0;
BEGIN
  FOR v_rec IN
    SELECT id, plot_crops
    FROM public.profiles
    WHERE plot_crops IS NOT NULL
      AND plot_crops <> '{}'::jsonb
  LOOP
    v_plot_crops := v_rec.plot_crops;
    v_updated    := v_plot_crops;
    v_changed    := false;

    FOR v_plot_key IN SELECT jsonb_object_keys(v_plot_crops) LOOP
      v_plot    := v_plot_crops -> v_plot_key;
      v_crop_id := v_plot ->> 'cropId';

      -- Pomiń puste pola
      IF v_crop_id IS NULL OR v_crop_id = '' THEN
        CONTINUE;
      END IF;

      -- Tylko uprawy w crop_config (nie drzewa, nie inne obiekty)
      IF NOT EXISTS (
        SELECT 1 FROM public.crop_config WHERE id = v_crop_id
      ) THEN
        CONTINUE;
      END IF;

      v_planted_at := coalesce((v_plot ->> 'plantedAt')::bigint, 0);
      IF v_planted_at = 0 THEN CONTINUE; END IF;

      v_elapsed     := v_now_ms - v_planted_at;
      IF v_elapsed <= 0 THEN CONTINUE; END IF;

      -- Skaluj elapsed ×5 → plantedAt przesuwa się wstecz o 4× elapsed
      v_new_planted := v_now_ms - (v_elapsed * 5);

      v_updated := jsonb_set(
        v_updated,
        array[v_plot_key, 'plantedAt'],
        to_jsonb(v_new_planted),
        false
      );
      v_changed := true;
    END LOOP;

    IF v_changed THEN
      UPDATE public.profiles
      SET plot_crops = v_updated
      WHERE id = v_rec.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Krok 1: zaktualizowano % profili z aktywnymi uprawami', v_count;
END;
$$;

-- ─── KROK 2: Aktualizuj growth_time_ms × 5 w crop_config ──────────────────

UPDATE public.crop_config
SET growth_time_ms = growth_time_ms * 5
WHERE id IN (
  'test_nasiono',
  'carrot',
  'potato',
  'tomato',
  'cucumber',
  'onion',
  'garlic',
  'lettuce',
  'radish',
  'beet',
  'pepper',
  'cabbage',
  'broccoli',
  'cauliflower',
  'strawberry',
  'raspberry',
  'blueberry',
  'eggplant',
  'zucchini',
  'watermelon',
  'grape',
  'pumpkin',
  'rapeseed',
  'sunflower',
  'chili',
  'asparagus'
);

-- Weryfikacja — pokaż nowe wartości
SELECT id, growth_time_ms,
       round(growth_time_ms / 60000.0, 1) AS minutes,
       round(growth_time_ms / 3600000.0, 2) AS hours
FROM public.crop_config
WHERE id IN (
  'test_nasiono','carrot','potato','tomato','cucumber','onion','garlic',
  'lettuce','radish','beet','pepper','cabbage','broccoli','cauliflower',
  'strawberry','raspberry','blueberry','eggplant','zucchini','watermelon',
  'grape','pumpkin','rapeseed','sunflower','chili','asparagus'
)
ORDER BY growth_time_ms;

COMMIT;
