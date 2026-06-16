-- ═══════════════════════════════════════════════════════════════════
-- FIX: buy_shop_seeds — dzienna promocja nie była stosowana przy zakupie
--
-- Problem: frontend wysyła {crop_id, quality, qty}, SQL liczy cenę
--          po cenie bazowej (bez rabatu). Rabat był TYLKO wizualny.
--
-- Fix: (1) helper _shop_daily_promo_disc — replikuje getDailyPromos()
--          z Game.tsx (ten sam Fisher-Yates z seed UTC-dnia Warszawy)
--      (2) nowa buy_shop_seeds — używa helpera server-side, ignoruje
--          jakikolwiek disc z klienta (bezpieczeństwo)
--
-- Uruchom w: Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Helper: dzienna promocja — replikacja JS getDailyPromos() ───
-- Zwraca: 0.8 (super/20%), 0.9 (normal/10%), 1.0 (brak rabatu)
-- Kolejność CROPS musi być identyczna jak w Game.tsx (linia 1080)
CREATE OR REPLACE FUNCTION _shop_daily_promo_disc(p_crop_id TEXT)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_day   BIGINT;
  v_crops TEXT[] := ARRAY[
    'carrot','potato','tomato','cucumber','onion','garlic',
    'lettuce','radish','beet','pepper','cabbage','broccoli',
    'cauliflower','strawberry','raspberry','blueberry',
    'eggplant','zucchini','watermelon','grape','pumpkin',
    'rapeseed','sunflower','chili','asparagus'
  ];                        -- 25 upraw (bez test_nasiono)
  v_n   INT := 25;
  v_i   INT;
  v_j   INT;
  v_x   FLOAT8;
  v_tmp TEXT;
BEGIN
  -- Replikacja JS getPolandDayNumber():
  --   const dateStr = new Date().toLocaleDateString('en-CA', {timeZone:'Europe/Warsaw'});
  --   return Math.floor(Date.UTC(y, m-1, d) / 86400000);
  -- = epoch sekund północy warszawskiej / 86400
  v_day := EXTRACT(EPOCH FROM (
    date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw')
    AT TIME ZONE 'Europe/Warsaw'
  ))::BIGINT / 86400;

  -- Fisher-Yates (JS):
  --   for (let i = arr.length-1; i > 0; i--) {
  --     const x = Math.sin(day*9301 + i*49297) * 233280;
  --     const j = Math.floor((x - Math.floor(x)) * (i+1));
  --     [arr[i], arr[j]] = [arr[j], arr[i]];
  --   }
  -- SQL: v_i (1-indexed) = JS i + 1, czyli v_i od 25 do 2
  FOR v_i IN REVERSE v_n .. 2 LOOP
    v_x := sin(v_day * 9301.0 + (v_i - 1) * 49297.0) * 233280.0;
    v_x := v_x - floor(v_x);              -- część ułamkowa
    v_j := floor(v_x * v_i)::INT + 1;    -- 0-indexed JS j → 1-indexed SQL
    v_tmp        := v_crops[v_i];
    v_crops[v_i] := v_crops[v_j];
    v_crops[v_j] := v_tmp;
  END LOOP;

  -- super_ = arr[3] (JS, 0-indexed) = v_crops[4] (SQL, 1-indexed)
  -- normal = arr[0..2]               = v_crops[1..3]
  IF    p_crop_id = v_crops[4] THEN RETURN 0.8;
  ELSIF p_crop_id = v_crops[1]
     OR p_crop_id = v_crops[2]
     OR p_crop_id = v_crops[3] THEN RETURN 0.9;
  ELSE  RETURN 1.0;
  END IF;
END;
$$;


-- ─── 2. buy_shop_seeds — z rabatem dzienna promocja ─────────────────
-- Parametry: p_user_id UUID, p_items JSONB (array [{crop_id, quality, qty}])
-- Zwraca:    {ok: true} lub {ok: false, error: "..."}
-- Uwaga: disc liczony server-side — klient nie może go sfałszować
CREATE OR REPLACE FUNCTION buy_shop_seeds(p_user_id UUID, p_items JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile RECORD;
  v_item    JSONB;
  v_crop_id TEXT;
  v_quality TEXT;
  v_qty     INT;
  v_price   NUMERIC;
  v_disc    NUMERIC;
  v_total   NUMERIC := 0;
  v_inv     JSONB;
  v_inv_key TEXT;
  v_cur_qty INT;

  -- Ceny nasion z Game.tsx (CROP_PRICES) — muszą być zsynchronizowane
  v_prices  JSONB := '{
    "carrot":3.2,"potato":4.8,"tomato":6.4,"cucumber":9.6,
    "onion":14.4,"garlic":19.2,"lettuce":25.6,"radish":35.2,
    "beet":48.0,"pepper":64.0,"cabbage":88.0,"broccoli":120.0,
    "cauliflower":160.0,"strawberry":208.0,"raspberry":272.0,
    "blueberry":352.0,"eggplant":448.0,"zucchini":576.0,
    "watermelon":720.0,"grape":880.0,"pumpkin":1040.0,
    "rapeseed":1200.0,"sunflower":1440.0,"chili":1760.0,
    "asparagus":2240.0
  }'::JSONB;
BEGIN
  -- Walidacja wejścia
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Brak przedmiotów w koszyku.');
  END IF;

  -- Blokuj wiersz gracza (atomowość)
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gracz nie znaleziony.');
  END IF;

  v_inv := COALESCE(v_profile.seed_inventory, '{}'::JSONB);

  -- ── Pass 1: suma kosztu z rabatem ────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_crop_id := v_item->>'crop_id';
    v_qty     := COALESCE((v_item->>'qty')::INT, 0);

    IF v_crop_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    IF NOT (v_prices ? v_crop_id) THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Nieznana uprawa: ' || v_crop_id);
    END IF;

    v_price := (v_prices ->> v_crop_id)::NUMERIC;
    v_disc  := _shop_daily_promo_disc(v_crop_id);
    v_total := v_total + ROUND(v_price * v_disc * v_qty, 2);
  END LOOP;

  v_total := ROUND(v_total, 2);

  -- Sprawdź saldo
  IF COALESCE(v_profile.money, 0) < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Za mało środków.');
  END IF;

  -- ── Pass 2: dodaj nasiona do inventory ───────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_crop_id := v_item->>'crop_id';
    v_quality := COALESCE(v_item->>'quality', 'good');
    v_qty     := COALESCE((v_item->>'qty')::INT, 0);

    IF v_crop_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    IF NOT (v_prices ? v_crop_id) THEN CONTINUE; END IF;

    -- Klucz inventory: "carrot_good", "tomato_epic" itp.
    v_inv_key := v_crop_id || '_' || v_quality;
    v_cur_qty := COALESCE((v_inv ->> v_inv_key)::INT, 0);
    v_inv     := jsonb_set(v_inv, ARRAY[v_inv_key],
                           to_jsonb(v_cur_qty + v_qty));
  END LOOP;

  -- ── Atomowy zapis ────────────────────────────────────────────────
  UPDATE profiles
  SET money          = money - v_total,
      seed_inventory = v_inv
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Szybki test: jaka promocja dzisiaj? ─────────────────────────────
-- SELECT _shop_daily_promo_disc('carrot'),
--        _shop_daily_promo_disc('potato'),
--        _shop_daily_promo_disc('tomato');
