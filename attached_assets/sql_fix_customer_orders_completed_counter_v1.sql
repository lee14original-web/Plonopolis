-- ============================================================
-- FIX: customer_orders_completed nie jest inkrementowane
-- po wykonaniu zamówienia klienta przez ladę.
--
-- Rozwiązanie: trigger AFTER DELETE na customer_orders —
-- za każdym razem gdy zamówienie jest usuwane (= wykonane),
-- licznik gracza rośnie o 1.
--
-- Wgraj w Supabase SQL Editor.
-- ============================================================

-- 1. Upewnij się że kolumna istnieje (idempotentne)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS customer_orders_completed integer NOT NULL DEFAULT 0;

-- 2. Funkcja wywoływana przez trigger
CREATE OR REPLACE FUNCTION public.trg_increment_orders_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET customer_orders_completed = COALESCE(customer_orders_completed, 0) + 1
  WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

-- 3. Trigger: odpala się po każdym DELETE z customer_orders
DROP TRIGGER IF EXISTS trg_order_completed ON customer_orders;
CREATE TRIGGER trg_order_completed
  AFTER DELETE ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_increment_orders_completed();
