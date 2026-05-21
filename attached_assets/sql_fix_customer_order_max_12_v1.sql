-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Zmiana limitu aktywnych klientów z 5 na 12
-- ───────────────────────────────────────────────────────────────────────────
-- Kontekst:
--   _npc_max_active() zwraca 5 — tick_customer_orders używa tej wartości do
--   ograniczenia spawnu. Zmiana na 12 pozwala każdemu graczowi akumulować
--   do 12 klientów (ok. 24h przy interwale 2h).
--
-- Co się zmienia:
--   • _npc_max_active() → SELECT 12
--
-- Co się NIE zmienia:
--   • Ekonomia, nagrody, typy klientów, czas ważności zamówień
--   • Interwał spawnu (_npc_spawn_interval_minutes() = 120 min)
--   • Istniejące zamówienia (nie są usuwane)
--
-- Idempotentny — można uruchomić wielokrotnie bezpiecznie.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _npc_max_active() RETURNS INT
  LANGUAGE SQL IMMUTABLE AS $$ SELECT 12 $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- WERYFIKACJA:
--   SELECT _npc_max_active();
--   -- Powinno zwrócić: 12
-- ═══════════════════════════════════════════════════════════════════════════
