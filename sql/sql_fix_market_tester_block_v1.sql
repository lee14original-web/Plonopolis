-- ============================================================
-- BLOKADA TARGU DLA KONTA tester (profiles.role = 'tester')
-- Obejmuje WSZYSTKIE overloady:
--   market_buy_offer(uuid)
--   market_buy_offer(uuid, integer)
--   market_create_offer(...7 args)
--   market_create_offer(...8 args)
--
-- Wgraj w Supabase SQL Editor → Run.
-- Nie wymaga ręcznej edycji. Skrypt jest idempotentny —
-- jeśli blokada już istnieje w danym overloadzie, pomija go.
-- ============================================================

DO $$
DECLARE
  v_oid    oid;
  v_name   text;
  v_args   text;
  v_def    text;
  v_pos    integer;
  v_marker text := 'END IF;';

  -- Blokada wstrzykiwana PO pierwszym END IF; (= blok auth/null check).
  -- Używa profiles.role, nie loginu.
  v_inject text :=
    E'END IF;\n\n'
    '  -- blokada tester (role) v1\n'
    E'  IF (SELECT role FROM profiles WHERE id = auth.uid()) = ''tester'' THEN\n'
    E'    RETURN jsonb_build_object(''error'', ''Targ jest zablokowany dla tego konta.'');\n'
    '  END IF;';

BEGIN
  FOR v_oid IN
    SELECT oid
    FROM   pg_proc
    WHERE  proname   IN ('market_buy_offer', 'market_create_offer')
      AND  pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    SELECT proname,
           pg_catalog.pg_get_function_arguments(v_oid)
    INTO   v_name, v_args
    FROM   pg_proc
    WHERE  oid = v_oid;

    SELECT pg_get_functiondef(v_oid) INTO v_def;

    -- Idempotentność: nie patchuj dwa razy
    IF v_def LIKE '%blokada tester%' THEN
      RAISE NOTICE '[SKIP] %(%) — blokada już istnieje', v_name, v_args;
      CONTINUE;
    END IF;

    -- Znajdź pierwsze END IF; (auth check)
    v_pos := position(v_marker IN v_def);
    IF v_pos = 0 THEN
      RAISE EXCEPTION
        '[ERROR] Nie znaleziono END IF w %(%) — skontaktuj się z deweloperem.',
        v_name, v_args;
    END IF;

    -- Wstrzyknij blokadę
    v_def :=
        left(v_def, v_pos - 1)
      || v_inject
      || right(v_def, -(v_pos - 1 + length(v_marker)));

    EXECUTE v_def;

    RAISE NOTICE '[OK] %(%) — blokada testera dodana', v_name, v_args;
  END LOOP;
END;
$$;


-- ============================================================
-- WERYFIKACJA (uruchom oddzielnie po wgraniu powyższego)
-- Powinny pojawić się 4 wiersze (jeden na każdy overload).
-- ============================================================
--
-- SELECT
--   proname,
--   pg_get_function_arguments(oid) AS args
-- FROM pg_proc
-- WHERE proname IN ('market_buy_offer','market_create_offer')
--   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
--   AND prosrc LIKE '%blokada tester%';
