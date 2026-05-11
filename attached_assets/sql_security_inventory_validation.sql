-- ═══════════════════════════════════════════════════════════════════════════
-- BEZPIECZEŃSTWO — walidacja serwerowa inwentarzy (owoce + stodoła)
--
-- Zastępuje sync_fruit_inventory i sync_barn_items wersjami z walidacją:
--   (1) whitelist kluczy — tylko znane przedmioty
--   (2) wartości są nieujemnymi liczbami całkowitymi
--   (3) cap per-klucz: max 9999
--   (4) cap łączny
--   (5) sprawdzanie delty — max przyrost per klucz per sync
--       (blokuje wstrzyknięcie dużych wartości z konsoli przeglądarki)
--
-- Uruchomić jednorazowo w Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. sync_fruit_inventory — z walidacją ────────────────────────────────
CREATE OR REPLACE FUNCTION sync_fruit_inventory(p_user_id UUID, p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key      TEXT;
  v_val_txt  TEXT;
  v_val      NUMERIC;
  v_old_val  NUMERIC;
  v_old_inv  JSONB;
  v_total    NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'object' THEN
    RAISE EXCEPTION 'p_items musi być obiektem JSONB';
  END IF;

  -- Pobierz aktualny stan z DB — potrzebny do sprawdzania delty
  SELECT COALESCE(fruit_inventory, '{}'::JSONB) INTO v_old_inv
    FROM profiles WHERE id = p_user_id;

  FOR v_key, v_val_txt IN
    SELECT key, value FROM jsonb_each_text(p_items)
  LOOP
    -- 1) Klucz musi pasować do wzorca: <owoc>_<jakość>
    --    Dozwolone owoce: jablko gruszka sliwka wisnia czeresnia
    --                     brzoskwinia morela pomarancza cytryna
    --    Dozwolone jakości: zwykly soczysty zloty zgnile
    IF v_key !~ '^(jablko|gruszka|sliwka|wisnia|czeresnia|brzoskwinia|morela|pomarancza|cytryna)_(zwykly|soczysty|zloty|zgnile)$' THEN
      RAISE EXCEPTION 'Nieprawidłowy klucz owocu: %', v_key;
    END IF;

    -- 2) Wartość musi być liczbą całkowitą
    BEGIN
      v_val := v_val_txt::NUMERIC;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Wartość nie jest liczbą dla klucza %: %', v_key, v_val_txt;
    END;

    -- 3) Nieujemna liczba całkowita
    IF v_val < 0 OR v_val != FLOOR(v_val) THEN
      RAISE EXCEPTION 'Ilość musi być nieujemną liczbą całkowitą: klucz=%, wartość=%', v_key, v_val;
    END IF;

    -- 4) Cap per-klucz: max 9999 sztuk jednego owocu
    IF v_val > 9999 THEN
      RAISE EXCEPTION 'Ilość % przekracza maksimum 9999 dla klucza %', v_val, v_key;
    END IF;

    -- 5) Delta: max przyrost per klucz per sync = 1000
    --    (8 drzew × 14 drop × 5 cykli × 1,15 bufor sadownika ≈ 644 → zaokrąglone do 1000)
    v_old_val := COALESCE((v_old_inv ->> v_key)::NUMERIC, 0);
    IF (v_val - v_old_val) > 1000 THEN
      RAISE EXCEPTION
        'Przyrost owocu "%" o % przekracza dozwolone max per sync (1000). Możliwa próba oszustwa.',
        v_key, (v_val - v_old_val);
    END IF;

    v_total := v_total + v_val;
  END LOOP;

  -- 6) Cap łączny: max 50 000 sztuk owoców w plecaku
  IF v_total > 50000 THEN
    RAISE EXCEPTION 'Łączna liczba owoców (%) przekracza maksimum 50 000', v_total;
  END IF;

  UPDATE profiles SET fruit_inventory = p_items WHERE id = p_user_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION sync_fruit_inventory(UUID, JSONB) TO authenticated;


-- ─── 2. sync_barn_items — z walidacją ────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_barn_items(p_user_id UUID, p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key      TEXT;
  v_val_txt  TEXT;
  v_val      NUMERIC;
  v_old_val  NUMERIC;
  v_old_inv  JSONB;
  v_total    NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'object' THEN
    RAISE EXCEPTION 'p_items musi być obiektem JSONB';
  END IF;

  -- Pobierz aktualny stan z DB
  SELECT COALESCE(barn_items, '{}'::JSONB) INTO v_old_inv
    FROM profiles WHERE id = p_user_id;

  FOR v_key, v_val_txt IN
    SELECT key, value FROM jsonb_each_text(p_items)
  LOOP
    -- 1) Whitelist produktów zwierzęcych
    IF v_key NOT IN (
      'jajko', 'futro_krolika', 'mleko', 'piora', 'welna',
      'nawoz_naturalny', 'mleko_kozie', 'duze_piora',
      'energia_robocza', 'rogi_byka'
    ) THEN
      RAISE EXCEPTION 'Nieznany produkt zwierzęcy: %', v_key;
    END IF;

    -- 2) Wartość musi być liczbą całkowitą
    BEGIN
      v_val := v_val_txt::NUMERIC;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Wartość nie jest liczbą dla klucza %: %', v_key, v_val_txt;
    END;

    -- 3) Nieujemna liczba całkowita
    IF v_val < 0 OR v_val != FLOOR(v_val) THEN
      RAISE EXCEPTION 'Ilość musi być nieujemną liczbą całkowitą: klucz=%, wartość=%', v_key, v_val;
    END IF;

    -- 4) Cap per-klucz: max 9999 sztuk jednego produktu
    IF v_val > 9999 THEN
      RAISE EXCEPTION 'Ilość % przekracza maksimum 9999 dla klucza %', v_val, v_key;
    END IF;

    -- 5) Delta: max przyrost per klucz per sync = 200
    --    (maks. 12 kur × 6 cykli = 72 jajek, z buforem eq-bonus ≈ 100 → zaokrąglone do 200)
    v_old_val := COALESCE((v_old_inv ->> v_key)::NUMERIC, 0);
    IF (v_val - v_old_val) > 200 THEN
      RAISE EXCEPTION
        'Przyrost produktu "%" o % przekracza dozwolone max per sync (200). Możliwa próba oszustwa.',
        v_key, (v_val - v_old_val);
    END IF;

    v_total := v_total + v_val;
  END LOOP;

  -- 6) Cap łączny: max 20 000 sztuk produktów w stodole
  IF v_total > 20000 THEN
    RAISE EXCEPTION 'Łączna liczba produktów (%) przekracza maksimum 20 000', v_total;
  END IF;

  UPDATE profiles SET barn_items = p_items WHERE id = p_user_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION sync_barn_items(UUID, JSONB) TO authenticated;
