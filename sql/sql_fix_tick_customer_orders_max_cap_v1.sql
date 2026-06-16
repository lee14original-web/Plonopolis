-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: tick_customer_orders — pauza timera gdy lada pełna (12/12)
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   Gdy gracz ma 12/12 klientów i jest offline przez N godzin, w profilu
--   kumuluje się "dług" (v_passed = N interwałów). Po powrocie i obsłużeniu
--   1 klienta → natychmiastowy spawn (v_to_spawn = LEAST(N, 1) = 1).
--   Po obsłużeniu kolejnych: v_passed maleje o 1 za każdym razem, ale wciąż
--   > 0 → klientki pojawiają się natychmiast, nie po 2h.
--
-- Root cause:
--   Kiedy v_to_spawn = 0 (bo v_active >= v_max), last_customer_spawn_at
--   NIE jest aktualizowany → dług rośnie w nieskończoność.
--
-- Fix (krok 3b):
--   Jeśli v_active >= v_max, przesuń last_customer_spawn_at = v_now.
--   Efekt: v_passed = 0, v_to_spawn = 0 — dług wyczyszczony.
--   Po obsłużeniu klienta (→ 11/12) zegar 2h startuje od tego momentu.
--   Gracz musi poczekać pełne 2h na kolejnego klienta.
--
-- Co się NIE zmienia:
--   Ekonomia, nagrody, spawn_customer_order, interwał, _npc_max_active
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION tick_customer_orders(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last         TIMESTAMPTZ;
  v_active       INT;
  v_max          INT := _npc_max_active();
  v_interval     INT := _npc_spawn_interval_minutes();
  v_passed       INT;
  v_to_spawn     INT;
  v_real_spawned INT := 0;
  v_now          TIMESTAMPTZ := NOW();
  v_orders       JSONB;
  v_oid          UUID;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- 1. Usuń wygasłe
  DELETE FROM customer_orders WHERE user_id = p_user_id AND expires_at <= v_now;

  -- 2. Pobierz last_customer_spawn_at z BLOKADĄ (anty-wyścig równoległych ticków)
  SELECT last_customer_spawn_at INTO v_last FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_last IS NULL THEN
    v_last := v_now - (v_interval || ' minutes')::INTERVAL;
    UPDATE profiles SET last_customer_spawn_at = v_last WHERE id = p_user_id;
  END IF;

  -- 3. Sprawdź ile aktywnych (po cleanupie)
  SELECT COUNT(*) INTO v_active FROM customer_orders WHERE user_id = p_user_id AND expires_at > v_now;

  -- 3b. *** FIX *** Gdy lada pełna — wyczyść dług czasowy.
  --     Bez tego gracz offline przy 12/12 przez N interwałów wróci z "długiem"
  --     i klienci będą pojawiali się natychmiast przez N obsługiwań.
  --     Po tej zmianie: timer 2h startuje od momentu gdy lada przestaje być pełna.
  IF v_active >= v_max THEN
    v_last := v_now;
    UPDATE profiles SET last_customer_spawn_at = v_now WHERE id = p_user_id;
  END IF;

  -- 4. Oblicz ile interwałów minęło i ilu trzeba spawnować
  v_passed   := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_now - v_last)) / 60 / v_interval)::INT);
  v_to_spawn := LEAST(v_passed, v_max - v_active);

  IF v_to_spawn > 0 THEN
    FOR i IN 1..v_to_spawn LOOP
      v_oid := spawn_customer_order(p_user_id);
      IF v_oid IS NOT NULL THEN v_real_spawned := v_real_spawned + 1; END IF;
    END LOOP;
    IF v_real_spawned > 0 THEN
      UPDATE profiles
        SET last_customer_spawn_at = v_last + (v_real_spawned * v_interval || ' minutes')::INTERVAL
        WHERE id = p_user_id;
    END IF;
  END IF;

  -- 5. Zwróć ŚWIEŻĄ listę — SELECT PO pętli spawn, filtr expires_at > v_now
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',            id,
      'user_id',       user_id,
      'customer_type', customer_type,
      'items',         items,
      'rewards',       rewards,
      'total_value',   total_value,
      'reward_mult',   reward_mult,
      'created_at',    created_at,
      'expires_at',    expires_at
    ) ORDER BY created_at
  ), '[]'::JSONB) INTO v_orders
    FROM customer_orders
    WHERE user_id = p_user_id
      AND expires_at > v_now;

  RETURN jsonb_build_object(
    'orders',      v_orders,
    'order_count', jsonb_array_length(v_orders),
    'spawned',     v_real_spawned,
    'active',      jsonb_array_length(v_orders),
    'max',         v_max,
    'next_spawn_at',
      (v_last + ((v_real_spawned + 1) * v_interval || ' minutes')::INTERVAL)
  );
END $$;

GRANT EXECUTE ON FUNCTION tick_customer_orders(UUID) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA (uruchom w Supabase SQL Editor):
--
--   -- Sprawdź stan przed:
--   SELECT id, last_customer_spawn_at FROM profiles WHERE id = 'TWOJE_USER_ID';
--   SELECT COUNT(*) FROM customer_orders WHERE user_id = 'TWOJE_USER_ID';
--
--   -- Tick przy 12/12 → powinien wyczyścić dług, last_customer_spawn_at ≈ NOW()
--   SELECT tick_customer_orders('TWOJE_USER_ID'::UUID);
--
--   -- Po tiku: last_customer_spawn_at powinno być ≈ NOW()
--   SELECT id, last_customer_spawn_at FROM profiles WHERE id = 'TWOJE_USER_ID';
-- ═══════════════════════════════════════════════════════════════════════════
