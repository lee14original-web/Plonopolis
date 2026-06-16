-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: tick_customer_orders — zwrot świeżej listy po spawnie
-- ───────────────────────────────────────────────────────────────────────────
-- Problem:
--   Frontend widzi "Dodaję klienta..." przez 10–40s mimo że backend stworzył
--   klienta. Przyczyny:
--   1. v_orders nie zawierał pola user_id — mismatch z CustomerOrder{} w TS
--   2. Brak filtra expires_at > v_now na końcowym SELECT (belt-and-suspenders)
--   3. Brak order_count w odpowiedzi — frontend nie może łatwo porównać długości
--
-- Co się zmienia:
--   • jsonb_build_object w v_orders: dodano "user_id"
--   • SELECT v_orders: dodano AND expires_at > v_now
--   • RETURN: dodano order_count = jsonb_array_length(v_orders)
--   • active: zmieniono na jsonb_array_length(v_orders) — realna liczba z listy
--
-- Co się NIE zmienia:
--   • Ekonomia, nagrody, limity, spawn_customer_order, interwał, next_spawn_at
--   • _npc_max_active() = 12 (nie nadpisywane tutaj)
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
  --    Zawiera user_id, żeby pasował do CustomerOrder{} w TypeScript.
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
-- WERYFIKACJA:
--   SELECT tick_customer_orders('TWOJE_USER_ID'::UUID);
--   -- Sprawdź: orders zawiera user_id, order_count = jsonb_array_length(orders)
--   -- Jeśli spawned > 0: orders powinny zawierać nowy wiersz natychmiast
-- ═══════════════════════════════════════════════════════════════════════════
