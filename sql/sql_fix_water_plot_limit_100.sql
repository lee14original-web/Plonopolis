-- ============================================================
-- POPRAWKA: game_water_plot — limit pól 25 → 100
-- Wklej do Supabase SQL Editor i wykonaj
-- ============================================================
--
-- Problem: game_water_plot odrzuca pola > 25 z błędem "Nieprawidłowe pole"
-- Gracz nie może podlewać pól 26–100 mimo że je odblokował.
-- Rozwiązanie: podmień warunek walidacji na p_plot_id > 100
-- ============================================================

DO $$
DECLARE
  v_src text;
  v_new text;
BEGIN
  -- Pobierz aktualną definicję funkcji
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc
  WHERE proname = 'game_water_plot'
    AND pronamespace = 'public'::regnamespace
  ORDER BY oid DESC
  LIMIT 1;

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono funkcji game_water_plot w schemacie public';
  END IF;

  IF v_src LIKE '%p_plot_id > 25%' THEN
    v_new := replace(v_src, 'p_plot_id > 25', 'p_plot_id > 100');
    EXECUTE v_new;
    RAISE NOTICE 'OK: game_water_plot zaktualizowana — limit zmieniony z 25 na 100';
  ELSE
    RAISE NOTICE 'INFO: game_water_plot nie ma limitu 25 — prawdopodobnie już naprawiona';
  END IF;
END;
$$;
