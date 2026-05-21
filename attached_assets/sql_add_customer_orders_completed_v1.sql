-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE: customer_orders_completed — statystyka i ranking
-- ───────────────────────────────────────────────────────────────────────────
-- 1. Dodaje kolumnę customer_orders_completed do profiles
-- 2. complete_customer_order — inkrementuje licznik przy sukcesie
--    (ekonomia Lady, EXP, gold — BEZ ZMIAN; to jest REPLACE całej funkcji
--     bazujący na hotfix etap3 + exp_scaling_v2)
-- 3. get_player_ranking — dodaje customer_orders_completed do wyników
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Kolumna w profiles ─────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS customer_orders_completed integer NOT NULL DEFAULT 0;


-- ─── 2. complete_customer_order — pełny REPLACE (hotfix + licznik) ─────────
-- Podstawa: sql_lada_npc_etap3_hotfix.sql
-- Jedyna zmiana: w UPDATE profiles SET ... dodano:
--   customer_orders_completed = customer_orders_completed + 1
-- Ekonomia (gold ×0.22, EXP, bonusy) — bez zmian.
CREATE OR REPLACE FUNCTION complete_customer_order(p_user_id UUID, p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order        RECORD;
  v_profile      RECORD;
  v_item         JSONB;
  v_item_id      TEXT;
  v_item_qty     INT;
  v_seed_inv     JSONB;
  v_barn         JSONB;
  v_fruit        JSONB;
  v_hive         JSONB;
  v_honey_jars   INT;
  v_have         INT;
  v_rewards      JSONB;
  v_gold         NUMERIC;
  v_exp          INT;
  v_bonus        JSONB;
  v_bonus_item   JSONB;
  v_bonus_id     TEXT;
  v_bonus_qty    INT;
  v_bonus_type   TEXT;
  v_new_money    NUMERIC;
BEGIN
  IF p_user_id IS NULL OR p_order_id IS NULL THEN RAISE EXCEPTION 'p_user_id and p_order_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_order FROM customer_orders
    WHERE id = p_order_id AND user_id = p_user_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'order not found or not yours'; END IF;
  IF v_order.expires_at <= NOW() THEN
    DELETE FROM customer_orders WHERE id = p_order_id;
    RAISE EXCEPTION 'order expired';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  v_seed_inv   := COALESCE(v_profile.seed_inventory, '{}'::JSONB);
  v_barn       := COALESCE(v_profile.barn_items, '{}'::JSONB);
  v_fruit      := COALESCE(v_profile.fruit_inventory, '{}'::JSONB);
  v_hive       := COALESCE(v_profile.hive_data, '{}'::JSONB);
  v_honey_jars := COALESCE((v_hive->>'honey_jars')::INT, 0);

  -- 1) Walidacja
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_item_id  := v_item->>'id';
    v_item_qty := (v_item->>'qty')::INT;
    IF v_item_id = 'honey_jar' THEN
      IF v_honey_jars < v_item_qty THEN RAISE EXCEPTION 'insufficient: honey_jar (have %, need %)', v_honey_jars, v_item_qty; END IF;
    ELSIF v_item_id ~ '_(good|epic|legendary)$' THEN
      v_have := COALESCE((v_seed_inv->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty; END IF;
    ELSIF v_item_id ~ '_(zwykly|soczysty|zloty)$' THEN
      v_have := COALESCE((v_fruit->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty; END IF;
    ELSE
      v_have := COALESCE((v_barn->>v_item_id)::INT, 0);
      IF v_have < v_item_qty THEN RAISE EXCEPTION 'insufficient: % (have %, need %)', v_item_id, v_have, v_item_qty; END IF;
    END IF;
  END LOOP;

  -- 2) Odejmowanie
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_item_id  := v_item->>'id';
    v_item_qty := (v_item->>'qty')::INT;
    IF v_item_id = 'honey_jar' THEN
      v_honey_jars := v_honey_jars - v_item_qty;
    ELSIF v_item_id ~ '_(good|epic|legendary)$' THEN
      v_have := COALESCE((v_seed_inv->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN v_seed_inv := v_seed_inv - v_item_id;
      ELSE v_seed_inv := jsonb_set(v_seed_inv, ARRAY[v_item_id], to_jsonb(v_have)); END IF;
    ELSIF v_item_id ~ '_(zwykly|soczysty|zloty)$' THEN
      v_have := COALESCE((v_fruit->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN v_fruit := v_fruit - v_item_id;
      ELSE v_fruit := jsonb_set(v_fruit, ARRAY[v_item_id], to_jsonb(v_have)); END IF;
    ELSE
      v_have := COALESCE((v_barn->>v_item_id)::INT, 0) - v_item_qty;
      IF v_have <= 0 THEN v_barn := v_barn - v_item_id;
      ELSE v_barn := jsonb_set(v_barn, ARRAY[v_item_id], to_jsonb(v_have)); END IF;
    END IF;
  END LOOP;

  -- 3) Bonusy (KOMPOST ląduje w seed_inventory)
  v_rewards := COALESCE(v_order.rewards, '{}'::JSONB);
  v_gold    := COALESCE((v_rewards->>'gold')::NUMERIC, 0);
  v_exp     := COALESCE((v_rewards->>'exp')::INT, 0);
  v_bonus   := COALESCE(v_rewards->'bonus', '[]'::JSONB);

  FOR v_bonus_item IN SELECT * FROM jsonb_array_elements(v_bonus) LOOP
    v_bonus_type := v_bonus_item->>'type';
    v_bonus_id   := v_bonus_item->>'id';
    v_bonus_qty  := (v_bonus_item->>'qty')::INT;

    IF v_bonus_type = 'animal' THEN
      v_have := COALESCE((v_barn->>v_bonus_id)::INT, 0);
      v_barn := jsonb_set(v_barn, ARRAY[v_bonus_id], to_jsonb(v_have + v_bonus_qty));
    ELSIF v_bonus_type = 'crop' OR v_bonus_type = 'compost' THEN
      v_have := COALESCE((v_seed_inv->>v_bonus_id)::INT, 0);
      v_seed_inv := jsonb_set(v_seed_inv, ARRAY[v_bonus_id], to_jsonb(v_have + v_bonus_qty));
    END IF;
  END LOOP;

  v_hive := jsonb_set(v_hive, ARRAY['honey_jars'], to_jsonb(v_honey_jars));
  v_new_money := ROUND((COALESCE(v_profile.money, 0) + v_gold)::NUMERIC, 2);

  -- 4) Zapis + inkrementacja licznika
  UPDATE profiles SET
    money                      = v_new_money,
    seed_inventory             = v_seed_inv,
    barn_items                 = v_barn,
    fruit_inventory            = v_fruit,
    hive_data                  = v_hive,
    customer_orders_completed  = customer_orders_completed + 1
  WHERE id = p_user_id;

  DELETE FROM customer_orders WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok',                true,
    'gold',              v_gold,
    'exp',               v_exp,
    'bonus',             v_bonus,
    'new_money',         v_new_money,
    'new_seed_inventory', v_seed_inv,
    'new_barn_items',    v_barn,
    'new_fruit_inventory', v_fruit,
    'new_hive_data',     v_hive
  );
END $$;

GRANT EXECUTE ON FUNCTION complete_customer_order(UUID, UUID) TO authenticated;


-- ─── 3. get_player_ranking — dodaje customer_orders_completed ──────────────
DROP FUNCTION IF EXISTS public.get_player_ranking();

CREATE OR REPLACE FUNCTION public.get_player_ranking()
RETURNS TABLE(
  user_id                    uuid,
  player_name                text,
  guild_name                 text,
  level                      integer,
  money                      numeric,
  missions_completed         integer,
  farm_power                 integer,
  ranking_score              float8,
  avatar_skin                integer,
  customer_orders_completed  integer
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    p.id                                                                       AS user_id,
    COALESCE(p.username, split_part(u.email, '@', 1))                         AS player_name,
    COALESCE(p.guild_name, 'Brak')                                            AS guild_name,
    COALESCE(p.level, 1)                                                      AS level,
    COALESCE(p.money::numeric, 0)                                             AS money,
    COALESCE(p.missions_completed, 0)                                         AS missions_completed,
    COALESCE(p.farm_power, 0)                                                 AS farm_power,
    COALESCE(p.farm_power, 0) * 1000.0
      + COALESCE(p.level, 1) * 75000.0
      + SQRT(GREATEST(COALESCE(p.money::float, 0), 0))                       AS ranking_score,
    COALESCE(p.avatar_skin, 0)                                                AS avatar_skin,
    COALESCE(p.customer_orders_completed, 0)                                  AS customer_orders_completed
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY ranking_score DESC, player_name ASC;
$function$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TESTY KONTROLNE (uruchom w Supabase SQL Editor po wgraniu):
--
-- T1. Sprawdź kolumnę w profiles:
--   SELECT id, username, customer_orders_completed
--     FROM profiles
--    LIMIT 5;
--
-- T2. Sprawdź ranking:
--   SELECT player_name, level, farm_power, customer_orders_completed
--     FROM get_player_ranking()
--    LIMIT 3;
--
-- T3. Test inkrementacji (ręcznie):
--   UPDATE profiles
--      SET customer_orders_completed = customer_orders_completed + 1
--    WHERE id = '<twoje_user_id>';
--   -- Potem: SELECT customer_orders_completed FROM profiles WHERE id = '<twoje_user_id>';
--   -- Powinno wzrosnąć o 1.
--
-- T4. Test pełny po wykonaniu zamówienia w grze:
--   -- Przed zamówieniem:
--   SELECT customer_orders_completed FROM profiles WHERE id = auth.uid();
--   -- Wykonaj zamówienie w Ladzie.
--   -- Po zamówieniu (odśwież):
--   SELECT customer_orders_completed FROM profiles WHERE id = auth.uid();
--   -- Wartość powinna wzrosnąć o 1.
-- ═══════════════════════════════════════════════════════════════════════════
