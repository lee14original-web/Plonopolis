-- ================================================================
-- Kompostownik — server-side batch tracking + claim reward (v2)
-- Nowy system: 5 kompostów zawsze gwarantowanych + osobny roll EQ
-- ================================================================
-- Instrukcja: uruchom w Supabase SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1. Kolumna śledzenia partii po stronie serwera
-- ────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS kompost_batch jsonb
  DEFAULT '{"fill":0,"scoreSum":0.0,"cropIds":[]}'::jsonb;

-- ────────────────────────────────────────────────────────────────
-- 2. game_deposit_to_kompost — odejmuje nasiona ORAZ aktualizuje
--    serwer-side batch (nowe parametry: p_score_delta, p_crop_id)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION game_deposit_to_kompost(
  p_seed_key    text,
  p_amount      int,
  p_score_delta numeric DEFAULT 0,
  p_crop_id     text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_inv       jsonb;
  v_have      int;
  v_batch     jsonb;
  v_fill      int;
  v_score_sum numeric;
  v_crop_ids  jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be > 0');
  END IF;

  SELECT COALESCE(seed_inventory, '{}'),
         COALESCE(kompost_batch, '{"fill":0,"scoreSum":0,"cropIds":[]}'::jsonb)
    INTO v_inv, v_batch
    FROM profiles WHERE id = v_uid;

  v_have := COALESCE((v_inv ->> p_seed_key)::int, 0);
  IF v_have < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Not enough: have %s need %s', v_have, p_amount));
  END IF;

  -- Odejmij z inventory
  IF v_have <= p_amount THEN v_inv := v_inv - p_seed_key;
  ELSE v_inv := jsonb_set(v_inv, ARRAY[p_seed_key], to_jsonb(v_have - p_amount));
  END IF;

  -- Zaktualizuj batch (nie przekraczaj 100)
  v_fill      := COALESCE((v_batch ->> 'fill')::int, 0);
  v_score_sum := COALESCE((v_batch ->> 'scoreSum')::numeric, 0);
  v_crop_ids  := COALESCE(v_batch -> 'cropIds', '[]'::jsonb);

  IF p_crop_id IS NOT NULL AND p_crop_id <> '' THEN
    IF NOT (v_crop_ids @> jsonb_build_array(p_crop_id)) THEN
      v_crop_ids := v_crop_ids || jsonb_build_array(p_crop_id);
    END IF;
  END IF;

  v_batch := jsonb_build_object(
    'fill',     LEAST(100, v_fill + p_amount),
    'scoreSum', v_score_sum + p_score_delta,
    'cropIds',  v_crop_ids
  );

  UPDATE profiles
    SET seed_inventory = v_inv,
        kompost_batch  = v_batch
    WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'seed_inventory', v_inv, 'kompost_batch', v_batch);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. game_update_kompost_batch — aktualizuje tylko batch (dla
--    depozytów owoców i innych źródeł bez odjęcia z seed_inventory)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION game_update_kompost_batch(
  p_fill_delta  int,
  p_score_delta numeric DEFAULT 0,
  p_crop_id     text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_batch     jsonb;
  v_fill      int;
  v_score_sum numeric;
  v_crop_ids  jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF p_fill_delta <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fill_delta must be > 0');
  END IF;

  SELECT COALESCE(kompost_batch, '{"fill":0,"scoreSum":0,"cropIds":[]}'::jsonb)
    INTO v_batch FROM profiles WHERE id = v_uid;

  v_fill      := COALESCE((v_batch ->> 'fill')::int, 0);
  v_score_sum := COALESCE((v_batch ->> 'scoreSum')::numeric, 0);
  v_crop_ids  := COALESCE(v_batch -> 'cropIds', '[]'::jsonb);

  IF p_crop_id IS NOT NULL AND p_crop_id <> '' THEN
    IF NOT (v_crop_ids @> jsonb_build_array(p_crop_id)) THEN
      v_crop_ids := v_crop_ids || jsonb_build_array(p_crop_id);
    END IF;
  END IF;

  v_batch := jsonb_build_object(
    'fill',     LEAST(100, v_fill + p_fill_delta),
    'scoreSum', v_score_sum + p_score_delta,
    'cropIds',  v_crop_ids
  );

  UPDATE profiles SET kompost_batch = v_batch WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'kompost_batch', v_batch);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. game_claim_kompost_reward — server-side rolling nagród
--    Zawsze 5 kompostów + osobny roll jackpot (0.5%) + osobny
--    roll EQ item (10% bazowo + bonus różnorodności).
--    Zwraca: nagrody kompostowe, item_tier (-1/0-4/5=jackpot),
--    zaktualizowane seed_inventory.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION game_claim_kompost_reward(
  p_player_level int DEFAULT 1
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid           uuid    := auth.uid();
  v_batch         jsonb;
  v_fill          int;
  v_score_sum     numeric;
  v_crop_ids      jsonb;
  v_diversity     int;
  v_avg_score     numeric;
  v_quality       text;
  v_tier_idx      int;
  v_inv           jsonb;
  v_compost_type  text;
  v_compost_val   int;
  v_compost_key   text;
  v_rewards       jsonb   := '[]'::jsonb;
  v_item_tier     int     := -1;
  v_item_chance   numeric;
  v_tier_chances  int[];
  v_cum           int;
  v_roll          numeric;
  i               int;
  v_type_roll     int;
  v_empty_batch   jsonb   := '{"fill":0,"scoreSum":0.0,"cropIds":[]}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(kompost_batch, v_empty_batch),
         COALESCE(seed_inventory, '{}')
    INTO v_batch, v_inv
    FROM profiles WHERE id = v_uid;

  v_fill := COALESCE((v_batch ->> 'fill')::int, 0);
  IF v_fill < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Batch not full: %s/100', v_fill));
  END IF;

  v_score_sum := COALESCE((v_batch ->> 'scoreSum')::numeric, 0);
  v_crop_ids  := COALESCE(v_batch -> 'cropIds', '[]'::jsonb);
  v_diversity := jsonb_array_length(v_crop_ids);
  v_avg_score := v_score_sum / 100.0;

  -- Jakość partii (progi z COMPOST_QUALITY_DEFS)
  v_quality := CASE
    WHEN v_avg_score >= 15.0 THEN 'legendary'
    WHEN v_avg_score >= 9.0  THEN 'very_good'
    WHEN v_avg_score >= 5.0  THEN 'good'
    WHEN v_avg_score >= 2.5  THEN 'medium'
    WHEN v_avg_score >= 1.0  THEN 'weak'
    ELSE 'very_weak'
  END;

  -- Tier kompostu: 0=słaby, 1=średni, 2=mocny (COMPOST_TIER_FIXED_BY_QUALITY)
  v_tier_idx := CASE v_quality
    WHEN 'very_weak' THEN 0  WHEN 'weak'      THEN 0
    WHEN 'medium'    THEN 1  WHEN 'good'       THEN 1
    WHEN 'very_good' THEN 2  WHEN 'legendary'  THEN 2
    ELSE 0
  END;

  -- ── 5 gwarantowanych kompostów ──
  FOR i IN 1..5 LOOP
    v_type_roll := floor(random() * 3)::int;
    v_compost_type := CASE v_type_roll
      WHEN 0 THEN 'growth'
      WHEN 1 THEN 'yield'
      ELSE        'exp'
    END;

    v_compost_val := CASE v_compost_type
      WHEN 'growth' THEN CASE v_tier_idx WHEN 0 THEN 5  WHEN 1 THEN 10 ELSE 15 END
      WHEN 'yield'  THEN CASE v_tier_idx WHEN 0 THEN 1  WHEN 1 THEN 2  ELSE 3  END
      WHEN 'exp'    THEN CASE v_tier_idx WHEN 0 THEN 10 WHEN 1 THEN 20 ELSE 30 END
      ELSE 5
    END;
    v_compost_key := 'compost_' || v_compost_type || '_' || v_compost_val;

    v_inv := jsonb_set(
      v_inv,
      ARRAY[v_compost_key],
      to_jsonb(COALESCE((v_inv ->> v_compost_key)::int, 0) + 1)
    );
    v_rewards := v_rewards || jsonb_build_array(
      jsonb_build_object('kind', 'compost', 'type', v_compost_type, 'value', v_compost_val)
    );
  END LOOP;

  -- ── Jackpot 0.5% (niezależny roll) ──
  IF random() * 100 < 0.5 THEN
    v_item_tier := 5;  -- 5 = jackpot (klient losuje legendarny item)
  ELSE
    -- ── Roll na item z ekwipunku (10% + bonus różnorodności, max +5%) ──
    v_item_chance := 10.0 + LEAST(5, floor(v_diversity::numeric / 2));
    IF random() * 100 < v_item_chance THEN
      -- Tabela szans na tier wg jakości (z ITEM_TIER_BY_QUALITY)
      v_tier_chances := CASE v_quality
        WHEN 'very_weak' THEN ARRAY[90, 10,  0,  0,  0]
        WHEN 'weak'      THEN ARRAY[70, 25,  5,  0,  0]
        WHEN 'medium'    THEN ARRAY[45, 35, 17,  3,  0]
        WHEN 'good'      THEN ARRAY[20, 35, 30, 12,  3]
        WHEN 'very_good' THEN ARRAY[ 5, 15, 35, 30, 15]
        WHEN 'legendary' THEN ARRAY[ 0,  5, 20, 40, 35]
        ELSE                  ARRAY[90, 10,  0,  0,  0]
      END;
      v_roll := random() * 100;
      v_cum  := 0;
      v_item_tier := 0;
      FOR i IN 1..5 LOOP
        v_cum := v_cum + v_tier_chances[i];
        IF v_roll < v_cum THEN
          v_item_tier := i - 1;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ── Atomicznie: zapisz seed_inventory + zresetuj batch ──
  UPDATE profiles
    SET seed_inventory = v_inv,
        kompost_batch  = v_empty_batch
    WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok',           true,
    'quality',      v_quality,
    'compost_tier', v_tier_idx,
    'rewards',      v_rewards,
    'item_tier',    v_item_tier,
    'seed_inventory', v_inv
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. game_deposit_honey_to_kompost — wrzuć słoiki miodu do kompostu
--    Każdy słoik = +10 fill, +1 honeyCount (brak odjęcia score — miód nie zmienia jakości)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION game_deposit_honey_to_kompost(
  p_amount int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_hive      jsonb;
  v_have      int;
  v_batch     jsonb;
  v_fill      int;
  v_honey_cnt int;
  v_added     int;
  v_fill_add  int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be > 0');
  END IF;

  SELECT COALESCE(hive_data, '{"honey_jars":0}'),
         COALESCE(kompost_batch, '{"fill":0,"scoreSum":0,"cropIds":[],"honeyCount":0}'::jsonb)
    INTO v_hive, v_batch
    FROM profiles WHERE id = v_uid;

  v_have := COALESCE((v_hive ->> 'honey_jars')::int, 0);
  IF v_have < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Not enough honey jars: have %s need %s', v_have, p_amount));
  END IF;

  v_fill      := COALESCE((v_batch ->> 'fill')::int, 0);
  v_honey_cnt := COALESCE((v_batch ->> 'honeyCount')::int, 0);

  -- Każdy słoik +10 fill, nie przekraczaj 100
  v_added   := LEAST(p_amount, CEIL((100 - v_fill)::numeric / 10)::int);
  IF v_added <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Batch already full');
  END IF;
  v_fill_add := LEAST(100 - v_fill, v_added * 10);

  -- Zaktualizuj hive_data
  v_hive := jsonb_set(v_hive, '{honey_jars}', to_jsonb(v_have - v_added));

  -- Zaktualizuj batch
  v_batch := jsonb_set(v_batch, '{fill}',       to_jsonb(v_fill + v_fill_add));
  v_batch := jsonb_set(v_batch, '{honeyCount}',  to_jsonb(v_honey_cnt + v_added));

  UPDATE profiles
    SET hive_data     = v_hive,
        kompost_batch = v_batch
    WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'added', v_added, 'fill_add', v_fill_add, 'kompost_batch', v_batch);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 6. game_claim_kompost_reward — zaktualizowana wersja z p_honey_count
--    Zastępuje wcześniejszą definicję (DROP + CREATE lub CREATE OR REPLACE)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION game_claim_kompost_reward(
  p_player_level int DEFAULT 1,
  p_honey_count  int DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid           uuid    := auth.uid();
  v_batch         jsonb;
  v_fill          int;
  v_score_sum     numeric;
  v_crop_ids      jsonb;
  v_honey_cnt     int;
  v_diversity     int;
  v_avg_score     numeric;
  v_quality       text;
  v_tier_idx      int;
  v_inv           jsonb;
  v_compost_type  text;
  v_compost_val   int;
  v_compost_key   text;
  v_rewards       jsonb   := '[]'::jsonb;
  v_item_tier     int     := -1;
  v_item_chance   numeric;
  v_tier_chances  int[];
  v_cum           int;
  v_roll          numeric;
  i               int;
  v_type_roll     int;
  v_empty_batch   jsonb   := '{"fill":0,"scoreSum":0.0,"cropIds":[],"honeyCount":0}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(kompost_batch, v_empty_batch),
         COALESCE(seed_inventory, '{}')
    INTO v_batch, v_inv
    FROM profiles WHERE id = v_uid;

  v_fill := COALESCE((v_batch ->> 'fill')::int, 0);
  IF v_fill < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Batch not full: %s/100', v_fill));
  END IF;

  v_score_sum := COALESCE((v_batch ->> 'scoreSum')::numeric, 0);
  v_crop_ids  := COALESCE(v_batch -> 'cropIds', '[]'::jsonb);
  v_honey_cnt := GREATEST(
    COALESCE((v_batch ->> 'honeyCount')::int, 0),
    COALESCE(p_honey_count, 0)
  );
  v_diversity := jsonb_array_length(v_crop_ids);
  v_avg_score := v_score_sum / 100.0;

  v_quality := CASE
    WHEN v_avg_score >= 15.0 THEN 'legendary'
    WHEN v_avg_score >= 9.0  THEN 'very_good'
    WHEN v_avg_score >= 5.0  THEN 'good'
    WHEN v_avg_score >= 2.5  THEN 'medium'
    WHEN v_avg_score >= 1.0  THEN 'weak'
    ELSE 'very_weak'
  END;

  v_tier_idx := CASE v_quality
    WHEN 'very_weak' THEN 0  WHEN 'weak'      THEN 0
    WHEN 'medium'    THEN 1  WHEN 'good'       THEN 1
    WHEN 'very_good' THEN 2  WHEN 'legendary'  THEN 2
    ELSE 0
  END;

  FOR i IN 1..5 LOOP
    v_type_roll := floor(random() * 3)::int;
    v_compost_type := CASE v_type_roll
      WHEN 0 THEN 'growth' WHEN 1 THEN 'yield' ELSE 'exp' END;
    v_compost_val := CASE v_compost_type
      WHEN 'growth' THEN CASE v_tier_idx WHEN 0 THEN 5  WHEN 1 THEN 10 ELSE 15 END
      WHEN 'yield'  THEN CASE v_tier_idx WHEN 0 THEN 1  WHEN 1 THEN 2  ELSE 3  END
      WHEN 'exp'    THEN CASE v_tier_idx WHEN 0 THEN 10 WHEN 1 THEN 20 ELSE 30 END
      ELSE 5
    END;
    v_compost_key := 'compost_' || v_compost_type || '_' || v_compost_val;
    v_inv := jsonb_set(v_inv, ARRAY[v_compost_key],
      to_jsonb(COALESCE((v_inv ->> v_compost_key)::int, 0) + 1));
    v_rewards := v_rewards || jsonb_build_array(
      jsonb_build_object('kind', 'compost', 'type', v_compost_type, 'value', v_compost_val));
  END LOOP;

  -- Jackpot 0.5%
  IF random() * 100 < 0.5 THEN
    v_item_tier := 5;
  ELSE
    -- item drop: 10% base + różnorodność (max +5%) + miód (+1% / słoik)
    v_item_chance := 10.0
      + LEAST(5, floor(v_diversity::numeric / 2))
      + LEAST(50, v_honey_cnt::numeric);  -- miód dodaje max +50% (50 słoików)
    IF random() * 100 < v_item_chance THEN
      v_tier_chances := CASE v_quality
        WHEN 'very_weak' THEN ARRAY[90, 10,  0,  0,  0]
        WHEN 'weak'      THEN ARRAY[70, 25,  5,  0,  0]
        WHEN 'medium'    THEN ARRAY[45, 35, 17,  3,  0]
        WHEN 'good'      THEN ARRAY[20, 35, 30, 12,  3]
        WHEN 'very_good' THEN ARRAY[ 5, 15, 35, 30, 15]
        WHEN 'legendary' THEN ARRAY[ 0,  5, 20, 40, 35]
        ELSE                  ARRAY[90, 10,  0,  0,  0]
      END;
      v_roll := random() * 100;
      v_cum  := 0;
      v_item_tier := 0;
      FOR i IN 1..5 LOOP
        v_cum := v_cum + v_tier_chances[i];
        IF v_roll < v_cum THEN v_item_tier := i - 1; EXIT; END IF;
      END LOOP;
    END IF;
  END IF;

  UPDATE profiles
    SET seed_inventory = v_inv,
        kompost_batch  = v_empty_batch
    WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok',             true,
    'quality',        v_quality,
    'compost_tier',   v_tier_idx,
    'rewards',        v_rewards,
    'item_tier',      v_item_tier,
    'seed_inventory', v_inv
  );
END;
$$;
