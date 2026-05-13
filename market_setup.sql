-- ═══════════════════════════════════════════════════════════════════
-- TARG GRACZY — Plonopolis Market System
-- Uruchom w Supabase SQL Editor (zakładka SQL w dashboardzie projektu)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. TABELE ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_offers (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type        TEXT          NOT NULL CHECK (item_type IN ('crop','compost','barn_item','fruit','honey','equipment')),
  item_key         TEXT          NOT NULL,
  item_name        TEXT          NOT NULL,
  item_icon        TEXT          NOT NULL DEFAULT '',
  quantity         INTEGER       NOT NULL CHECK (quantity > 0),
  price_per_unit   NUMERIC(14,2) NOT NULL CHECK (price_per_unit > 0),
  duration_hours   INTEGER       NOT NULL CHECK (duration_hours IN (24, 48)),
  status           TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','expired','cancelled')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ   NOT NULL,
  sold_at          TIMESTAMPTZ,
  buyer_id         UUID          REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS market_returns (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  return_type  TEXT          NOT NULL CHECK (return_type IN ('gold','item')),
  item_key     TEXT,
  item_type    TEXT,
  item_name    TEXT,
  item_icon    TEXT,
  quantity     INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  gold_amount  NUMERIC(14,2) DEFAULT 0,
  reason       TEXT          NOT NULL CHECK (reason IN ('sold','expired','cancelled')),
  offer_id     UUID          REFERENCES market_offers(id),
  claimed      BOOLEAN       NOT NULL DEFAULT false,
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_transaction_log (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id         UUID          REFERENCES market_offers(id),
  seller_id        UUID          NOT NULL,
  buyer_id         UUID          NOT NULL,
  item_key         TEXT          NOT NULL,
  item_name        TEXT          NOT NULL,
  quantity         INTEGER       NOT NULL,
  price_total      NUMERIC(14,2) NOT NULL,
  tax_amount       NUMERIC(14,2) NOT NULL,
  seller_receives  NUMERIC(14,2) NOT NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─── 2. INDEKSY ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mo_active       ON market_offers(status, expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mo_seller       ON market_offers(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_mo_type_key     ON market_offers(item_type, item_key, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mr_unclaimed    ON market_returns(user_id, claimed) WHERE claimed = false;

-- ─── 3. RLS ───────────────────────────────────────────────────────────

ALTER TABLE market_offers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_returns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_transaction_log ENABLE ROW LEVEL SECURITY;

-- Oferty: aktywne widoczne dla wszystkich; własne (wszystkie statusy) widoczne tylko dla właściciela
DROP POLICY IF EXISTS "market_offers_select" ON market_offers;
CREATE POLICY "market_offers_select" ON market_offers
  FOR SELECT USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid());

-- Blokujemy bezpośrednie DML — tylko przez SECURITY DEFINER RPC
DROP POLICY IF EXISTS "market_offers_no_insert" ON market_offers;
CREATE POLICY "market_offers_no_insert" ON market_offers FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "market_offers_no_update" ON market_offers;
CREATE POLICY "market_offers_no_update" ON market_offers FOR UPDATE USING (false);
DROP POLICY IF EXISTS "market_offers_no_delete" ON market_offers;
CREATE POLICY "market_offers_no_delete" ON market_offers FOR DELETE USING (false);

-- Odbiory: każdy widzi tylko swoje
DROP POLICY IF EXISTS "market_returns_select" ON market_returns;
CREATE POLICY "market_returns_select" ON market_returns FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "market_returns_no_insert" ON market_returns;
CREATE POLICY "market_returns_no_insert" ON market_returns FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "market_returns_no_update" ON market_returns;
CREATE POLICY "market_returns_no_update" ON market_returns FOR UPDATE USING (false);

-- Logi: gracz widzi swoje transakcje (jako sprzedający lub kupujący)
DROP POLICY IF EXISTS "market_log_select" ON market_transaction_log;
CREATE POLICY "market_log_select" ON market_transaction_log
  FOR SELECT USING (seller_id = auth.uid() OR buyer_id = auth.uid());
DROP POLICY IF EXISTS "market_log_no_insert" ON market_transaction_log;
CREATE POLICY "market_log_no_insert" ON market_transaction_log FOR INSERT WITH CHECK (false);

-- ─── 4. MINIMALNA CENA (walidacja na backendzie) ──────────────────────

CREATE OR REPLACE FUNCTION market_min_price(p_item_type TEXT, p_item_key TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_num INTEGER;
BEGIN
  -- Uprawy, kompost, barn_item, owoce, miod — brak minimalnej ceny
  IF p_item_type IN ('crop','compost','barn_item','fruit','honey') THEN
    RETURN 1;
  END IF;

  -- Ekwipunek: minimalna cena tylko dla T4+ (poziom odblokowania 10+)
  -- Klucze: d1-d25, g1-g25, n1-n25 — numer = poziom odblokowania
  IF p_item_type = 'equipment' THEN
    v_num := (regexp_match(p_item_key, '[0-9]+'))[1]::INTEGER;
    IF    v_num >= 22 THEN RETURN 50000;  -- T8 lv22-25
    ELSIF v_num >= 19 THEN RETURN 25000;  -- T7 lv19-21
    ELSIF v_num >= 16 THEN RETURN 12000;  -- T6 lv16-18
    ELSIF v_num >= 13 THEN RETURN 6000;   -- T5 lv13-15
    ELSIF v_num >= 10 THEN RETURN 3000;   -- T4 lv10-12
    ELSE                    RETURN 1;     -- T1-T3 lv1-9 brak limitu
    END IF;
  END IF;

  RETURN 1;
END;
$$;

-- ─── 4b. ANTI-BOOST: LIMITY WARTOŚCI OFERT I DZIENNEGO ZAROBKU ────────

-- Dodaj kolumny do profiles (idempotentne)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS market_earned_today NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_earned_date  DATE          DEFAULT NULL;

-- Limit łącznej wartości aktywnych ofert wg poziomu (NULL = brak limitu)
CREATE OR REPLACE FUNCTION market_active_value_limit(p_level INTEGER)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_level >= 25 THEN RETURN NULL; END IF;
  IF p_level >= 20 THEN RETURN 500000; END IF;
  IF p_level >= 15 THEN RETURN 150000; END IF;
  IF p_level >= 10 THEN RETURN 50000;  END IF;
  IF p_level >= 7  THEN RETURN 10000;  END IF;
  IF p_level >= 5  THEN RETURN 5000;   END IF;
  IF p_level >= 3  THEN RETURN 2500;   END IF;
  RETURN 1000;
END;
$$;

-- Dzienny limit zarobku z targu wg poziomu (NULL = brak limitu)
CREATE OR REPLACE FUNCTION market_daily_earn_limit(p_level INTEGER)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_level >= 25 THEN RETURN NULL; END IF;
  IF p_level >= 20 THEN RETURN 750000; END IF;
  IF p_level >= 15 THEN RETURN 300000; END IF;
  IF p_level >= 10 THEN RETURN 100000; END IF;
  IF p_level >= 7  THEN RETURN 25000;  END IF;
  IF p_level >= 5  THEN RETURN 10000;  END IF;
  IF p_level >= 3  THEN RETURN 5000;   END IF;
  RETURN 2000;
END;
$$;

-- ─── 5. WYGASANIE OFERT ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION market_expire_offers()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_cnt INTEGER := 0;
BEGIN
  WITH expired AS (
    UPDATE market_offers
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < now()
    RETURNING id, seller_id, item_type, item_key, item_name, item_icon, quantity
  )
  INSERT INTO market_returns (user_id, return_type, item_key, item_type, item_name, item_icon, quantity, gold_amount, reason, offer_id)
  SELECT seller_id, 'item', item_key, item_type, item_name, item_icon, quantity, 0, 'expired', id
  FROM expired;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END;
$$;

-- ─── 6. STWORZENIE OFERTY ─────────────────────────────────────────────
-- Usuwa przedmiot z ekwipunku gracza atomicznie. Walidacja: min cena, limit ofert, ilość.

CREATE OR REPLACE FUNCTION market_create_offer(
  p_item_type       TEXT,
  p_item_key        TEXT,
  p_item_name       TEXT,
  p_item_icon       TEXT,
  p_quantity        INTEGER,
  p_price_per_unit  NUMERIC,
  p_duration_hours  INTEGER DEFAULT 24
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid                UUID    := auth.uid();
  v_level              INTEGER;
  v_max_offers         INTEGER;
  v_active_cnt         INTEGER;
  v_current_qty        NUMERIC;
  v_min_price          NUMERIC;
  v_ext_fee            NUMERIC := 0;
  v_money              NUMERIC;
  v_total              NUMERIC;
  v_offer_id           UUID;
  v_active_value       NUMERIC;
  v_active_value_limit NUMERIC;
  v_earned_today       NUMERIC;
  v_earned_date        DATE;
  v_daily_limit        NUMERIC;
  v_today              DATE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Nie jesteś zalogowany'); END IF;

  -- Walidacja wejść
  IF p_quantity <= 0 THEN RETURN jsonb_build_object('error','Ilość musi być dodatnia'); END IF;
  IF p_price_per_unit <= 0 THEN RETURN jsonb_build_object('error','Cena musi być dodatnia'); END IF;
  IF p_duration_hours NOT IN (24, 48) THEN RETURN jsonb_build_object('error','Czas oferty: 24h lub 48h'); END IF;
  IF p_item_type NOT IN ('crop','compost','barn_item','fruit','honey','equipment') THEN
    RETURN jsonb_build_object('error','Nieznany typ przedmiotu');
  END IF;
  IF p_item_type = 'equipment' AND p_quantity != 1 THEN
    RETURN jsonb_build_object('error','Wyposażenie można wystawić tylko po 1 szt.');
  END IF;

  -- Minimalna cena (backend — frontend nie może tego ominąć)
  v_min_price := market_min_price(p_item_type, p_item_key);
  IF p_price_per_unit < v_min_price THEN
    RETURN jsonb_build_object('error','Cena poniżej minimum (' || v_min_price::TEXT || ' zł/szt)');
  END IF;

  -- Limit ofert wg poziomu gracza
  SELECT COALESCE(level, 1) INTO v_level FROM profiles WHERE id = v_uid;
  v_max_offers := CASE
    WHEN v_level >= 25 THEN 10
    WHEN v_level >= 20 THEN 8
    WHEN v_level >= 10 THEN 5
    ELSE 3
  END;
  SELECT COUNT(*) INTO v_active_cnt FROM market_offers WHERE seller_id = v_uid AND status = 'active';
  IF v_active_cnt >= v_max_offers THEN
    RETURN jsonb_build_object('error','Limit aktywnych ofert: ' || v_max_offers || ' (poziom ' || v_level || ')');
  END IF;

  -- Anti-boost #1: łączna wartość aktywnych ofert
  v_active_value_limit := market_active_value_limit(v_level);
  IF v_active_value_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity * price_per_unit), 0) INTO v_active_value
      FROM market_offers WHERE seller_id = v_uid AND status = 'active';
    IF v_active_value + (p_quantity::NUMERIC * p_price_per_unit) > v_active_value_limit THEN
      RETURN jsonb_build_object('error',
        'Limit wartości aktywnych ofert: ' || v_active_value_limit::BIGINT || ' zł (poziom ' || v_level || ')');
    END IF;
  END IF;

  -- Anti-boost #2: dzienny limit zarobku z targu (reset o północy czasu polskiego)
  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::DATE;
  SELECT COALESCE(market_earned_today, 0), market_earned_date
    INTO v_earned_today, v_earned_date FROM profiles WHERE id = v_uid;
  IF v_earned_date IS DISTINCT FROM v_today THEN
    v_earned_today := 0;
  END IF;
  v_daily_limit := market_daily_earn_limit(v_level);
  IF v_daily_limit IS NOT NULL AND v_earned_today >= v_daily_limit THEN
    RETURN jsonb_build_object('error',
      'Dzienny limit zarobku z targu: ' || v_daily_limit::BIGINT || ' zł. Reset o polnocy czasu polskiego.');
  END IF;

  -- Blokada profilu + sprawdzenie złota
  SELECT money INTO v_money FROM profiles WHERE id = v_uid FOR UPDATE;
  v_total := p_price_per_unit * p_quantity;
  IF p_duration_hours = 48 THEN v_ext_fee := ROUND(v_total * 0.05, 2); END IF;
  IF v_ext_fee > 0 AND v_money < v_ext_fee THEN
    RETURN jsonb_build_object('error','Za mało złota na opłatę 48h (' || v_ext_fee || ' zł)');
  END IF;

  -- Zabierz przedmiot z odpowiedniego pola inventory
  IF p_item_type IN ('crop','compost') THEN
    SELECT COALESCE((seed_inventory->>p_item_key)::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      seed_inventory = CASE
        WHEN (v_current_qty - p_quantity) <= 0 THEN seed_inventory - p_item_key
        ELSE jsonb_set(seed_inventory, ARRAY[p_item_key], to_jsonb((v_current_qty - p_quantity)::INTEGER))
      END,
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'barn_item' THEN
    SELECT COALESCE((barn_items->>p_item_key)::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      barn_items = CASE
        WHEN (v_current_qty - p_quantity) <= 0 THEN barn_items - p_item_key
        ELSE jsonb_set(barn_items, ARRAY[p_item_key], to_jsonb((v_current_qty - p_quantity)::INTEGER))
      END,
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'fruit' THEN
    SELECT COALESCE((fruit_inventory->>p_item_key)::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      fruit_inventory = CASE
        WHEN (v_current_qty - p_quantity) <= 0 THEN fruit_inventory - p_item_key
        ELSE jsonb_set(fruit_inventory, ARRAY[p_item_key], to_jsonb((v_current_qty - p_quantity)::INTEGER))
      END,
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'honey' THEN
    SELECT COALESCE((hive_data->>'honey_jars')::NUMERIC, 0) INTO v_current_qty FROM profiles WHERE id = v_uid;
    IF v_current_qty < p_quantity THEN
      RETURN jsonb_build_object('error','Masz tylko ' || v_current_qty::INTEGER || ' szt. miodu (wystawiasz ' || p_quantity || ')');
    END IF;
    UPDATE profiles SET
      hive_data = jsonb_set(hive_data, '{honey_jars}', to_jsonb(GREATEST(0, (v_current_qty - p_quantity)::INTEGER))),
      money = money - v_ext_fee
    WHERE id = v_uid;

  ELSIF p_item_type = 'equipment' THEN
    -- Własność ekwipunku śledzona po stronie klienta (localStorage/ownedEqItems).
    -- Serwer tworzy ofertę w dobrej wierze; frontend zdejmuje z ownedEqItems po sukcesie.
    IF v_ext_fee > 0 THEN
      UPDATE profiles SET money = money - v_ext_fee WHERE id = v_uid;
    END IF;
  END IF;

  -- Utwórz ofertę
  INSERT INTO market_offers (
    seller_id, item_type, item_key, item_name, item_icon,
    quantity, price_per_unit, duration_hours, expires_at
  ) VALUES (
    v_uid, p_item_type, p_item_key, p_item_name, p_item_icon,
    p_quantity, p_price_per_unit, p_duration_hours,
    now() + (p_duration_hours || ' hours')::INTERVAL
  ) RETURNING id INTO v_offer_id;

  RETURN jsonb_build_object('success', true, 'offer_id', v_offer_id, 'extension_fee', v_ext_fee);
END;
$$;

-- ─── 7. KUPNO OFERTY (ATOMICZNE — blokada wiersza) ────────────────────
-- Zapobiega: kopiowaniu itemów, podwójnemu kupnu, kupowaniu własnych ofert

CREATE OR REPLACE FUNCTION market_buy_offer(p_offer_id UUID, p_quantity INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_buyer_id     UUID    := auth.uid();
  v_offer        market_offers%ROWTYPE;
  v_money        NUMERIC;
  v_total        NUMERIC;
  v_tax          NUMERIC;
  v_seller_gets  NUMERIC;
  v_seller_login TEXT;
  v_qty          INTEGER;
  v_today_pl     DATE;
BEGIN
  IF v_buyer_id IS NULL THEN RETURN jsonb_build_object('error','Nie jesteś zalogowany'); END IF;

  -- Blokada oferty — zapobiega równoczesnemu kupnu przez 2 graczy
  SELECT * INTO v_offer FROM market_offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer.id IS NULL THEN RETURN jsonb_build_object('error','Oferta nie istnieje'); END IF;
  IF v_offer.status != 'active' THEN RETURN jsonb_build_object('error','Oferta nie jest już dostępna'); END IF;

  -- Oferta wygasła?
  IF v_offer.expires_at < now() THEN
    UPDATE market_offers SET status = 'expired' WHERE id = p_offer_id;
    INSERT INTO market_returns (user_id, return_type, item_key, item_type, item_name, item_icon, quantity, gold_amount, reason, offer_id)
    VALUES (v_offer.seller_id, 'item', v_offer.item_key, v_offer.item_type, v_offer.item_name, v_offer.item_icon, v_offer.quantity, 0, 'expired', p_offer_id);
    RETURN jsonb_build_object('error','Oferta wygasła — przedmiot wrócił do właściciela');
  END IF;

  -- Nie można kupić własnej oferty
  IF v_offer.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('error','Nie możesz kupić własnej oferty');
  END IF;

  -- Ilość do kupienia (domyślnie całość)
  v_qty := COALESCE(p_quantity, v_offer.quantity);
  IF v_qty <= 0 THEN RETURN jsonb_build_object('error','Ilość musi być dodatnia'); END IF;
  IF v_qty > v_offer.quantity THEN RETURN jsonb_build_object('error','Dostępne tylko ' || v_offer.quantity || ' szt.'); END IF;

  v_total       := ROUND(v_offer.price_per_unit * v_qty, 2);
  v_tax         := ROUND(v_total * 0.10, 2);
  v_seller_gets := v_total - v_tax;

  -- Sprawdź złoto kupującego
  SELECT money INTO v_money FROM profiles WHERE id = v_buyer_id FOR UPDATE;
  IF v_money < v_total THEN
    RETURN jsonb_build_object('error','Za mało złota. Potrzebujesz ' || v_total || ' zł, masz ' || ROUND(v_money,2) || ' zł');
  END IF;

  -- Odejmij złoto kupującemu
  UPDATE profiles SET money = money - v_total WHERE id = v_buyer_id;

  -- Dodaj przedmiot kupującemu (wg typu)
  IF v_offer.item_type IN ('crop','compost') THEN
    UPDATE profiles SET
      seed_inventory = jsonb_set(
        COALESCE(seed_inventory, '{}'::jsonb),
        ARRAY[v_offer.item_key],
        to_jsonb(COALESCE((seed_inventory->>v_offer.item_key)::INTEGER, 0) + v_qty)
      )
    WHERE id = v_buyer_id;
  ELSIF v_offer.item_type = 'barn_item' THEN
    UPDATE profiles SET
      barn_items = jsonb_set(
        COALESCE(barn_items, '{}'::jsonb),
        ARRAY[v_offer.item_key],
        to_jsonb(COALESCE((barn_items->>v_offer.item_key)::INTEGER, 0) + v_qty)
      )
    WHERE id = v_buyer_id;
  ELSIF v_offer.item_type = 'fruit' THEN
    UPDATE profiles SET
      fruit_inventory = jsonb_set(
        COALESCE(fruit_inventory, '{}'::jsonb),
        ARRAY[v_offer.item_key],
        to_jsonb(COALESCE((fruit_inventory->>v_offer.item_key)::INTEGER, 0) + v_qty)
      )
    WHERE id = v_buyer_id;
  ELSIF v_offer.item_type = 'honey' THEN
    UPDATE profiles SET
      hive_data = jsonb_set(
        COALESCE(hive_data, '{"level":0,"bees_progress":0,"honey_start":null,"suit_durability":0,"empty_jars":0,"honey_jars":0}'::jsonb),
        '{honey_jars}',
        to_jsonb(COALESCE((hive_data->>'honey_jars')::INTEGER, 0) + v_qty)
      )
    WHERE id = v_buyer_id;

  ELSIF v_offer.item_type = 'equipment' THEN
    NULL; -- Własność ekwipunku śledzona w localStorage (ownedEqItems) po stronie klienta.
          -- Frontend odbiera item_key z odpowiedzi i sam dodaje do ownedEqItems.
  END IF;

  -- Aktualizuj ofertę: całkowita sprzedaż → sold, częściowa → zmniejsz ilość
  IF v_qty = v_offer.quantity THEN
    UPDATE market_offers SET status = 'sold', sold_at = now(), buyer_id = v_buyer_id WHERE id = p_offer_id;
  ELSE
    UPDATE market_offers SET quantity = quantity - v_qty WHERE id = p_offer_id;
  END IF;

  -- Złoto dla sprzedającego trafia do "Do Odbioru"
  INSERT INTO market_returns (user_id, return_type, gold_amount, quantity, reason, offer_id)
  VALUES (v_offer.seller_id, 'gold', v_seller_gets, 1, 'sold', p_offer_id);

  -- Anti-boost: aktualizuj dzienny zarobek sprzedającego (reset o północy Warsaw)
  v_today_pl := (now() AT TIME ZONE 'Europe/Warsaw')::DATE;
  UPDATE profiles SET
    market_earned_today = CASE
      WHEN market_earned_date = v_today_pl THEN COALESCE(market_earned_today, 0) + v_seller_gets
      ELSE v_seller_gets
    END,
    market_earned_date = v_today_pl
  WHERE id = v_offer.seller_id;

  -- Log transakcji (dla historii i wykrywania exploitów)
  INSERT INTO market_transaction_log (offer_id, seller_id, buyer_id, item_key, item_name, quantity, price_total, tax_amount, seller_receives)
  VALUES (p_offer_id, v_offer.seller_id, v_buyer_id, v_offer.item_key, v_offer.item_name, v_qty, v_total, v_tax, v_seller_gets);

  -- Wiadomość systemowa do sprzedającego
  BEGIN
    SELECT login INTO v_seller_login FROM profiles WHERE id = v_offer.seller_id;
    PERFORM send_game_message(
      p_to_user_id    := v_offer.seller_id,
      p_from_user_id  := v_buyer_id,
      p_from_username := 'System',
      p_subject       := 'Targ — oferta sprzedana',
      p_body          := 'Twoja oferta na ' || v_offer.item_name || ' (x' || v_qty || ') sprzedana za ' || v_total || ' zł. Odbierz ' || v_seller_gets || ' zł z zakładki Do Odbioru na Targu.',
      p_to_username   := v_seller_login
    );
  EXCEPTION WHEN OTHERS THEN NULL; -- nie blokuj kupna jeśli wiadomość się nie uda
  END;

  RETURN jsonb_build_object(
    'success', true,
    'item_name', v_offer.item_name,
    'item_type', v_offer.item_type,
    'item_key', v_offer.item_key,
    'quantity', v_qty,
    'paid', v_total,
    'tax', v_tax,
    'seller_receives', v_seller_gets
  );
END;
$$;

-- ─── 8. ANULOWANIE OFERTY ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION market_cancel_offer(p_offer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_offer market_offers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Nie jesteś zalogowany'); END IF;
  SELECT * INTO v_offer FROM market_offers WHERE id = p_offer_id AND seller_id = v_uid FOR UPDATE;
  IF v_offer.id IS NULL THEN RETURN jsonb_build_object('error','Oferta nie istnieje lub nie jesteś jej właścicielem'); END IF;
  IF v_offer.status != 'active' THEN RETURN jsonb_build_object('error','Oferta nie jest aktywna'); END IF;

  UPDATE market_offers SET status = 'cancelled' WHERE id = p_offer_id;

  -- Przedmiot wraca do "Do Odbioru" (nie bezpośrednio do ekwipunku — gracz musi kliknąć Odbierz)
  INSERT INTO market_returns (user_id, return_type, item_key, item_type, item_name, item_icon, quantity, gold_amount, reason, offer_id)
  VALUES (v_uid, 'item', v_offer.item_key, v_offer.item_type, v_offer.item_name, v_offer.item_icon, v_offer.quantity, 0, 'cancelled', p_offer_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── 9. ODBIERZ WSZYSTKO Z "DO ODBIORU" ──────────────────────────────

CREATE OR REPLACE FUNCTION market_claim_all_returns()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid          UUID    := auth.uid();
  v_ret          market_returns%ROWTYPE;
  v_gold_total   NUMERIC := 0;
  v_items_cnt    INTEGER := 0;
  v_equip_keys   TEXT[]  := '{}';
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Nie jesteś zalogowany'); END IF;

  FOR v_ret IN
    SELECT * FROM market_returns WHERE user_id = v_uid AND claimed = false FOR UPDATE
  LOOP
    UPDATE market_returns SET claimed = true, claimed_at = now() WHERE id = v_ret.id;

    IF v_ret.return_type = 'gold' THEN
      v_gold_total := v_gold_total + COALESCE(v_ret.gold_amount, 0);

    ELSIF v_ret.return_type = 'item' THEN
      v_items_cnt := v_items_cnt + 1;

      IF v_ret.item_type IN ('crop','compost') THEN
        UPDATE profiles SET
          seed_inventory = jsonb_set(
            COALESCE(seed_inventory, '{}'::jsonb),
            ARRAY[v_ret.item_key],
            to_jsonb(COALESCE((seed_inventory->>v_ret.item_key)::INTEGER, 0) + v_ret.quantity)
          )
        WHERE id = v_uid;

      ELSIF v_ret.item_type = 'barn_item' THEN
        UPDATE profiles SET
          barn_items = jsonb_set(
            COALESCE(barn_items, '{}'::jsonb),
            ARRAY[v_ret.item_key],
            to_jsonb(COALESCE((barn_items->>v_ret.item_key)::INTEGER, 0) + v_ret.quantity)
          )
        WHERE id = v_uid;

      ELSIF v_ret.item_type = 'fruit' THEN
        UPDATE profiles SET
          fruit_inventory = jsonb_set(
            COALESCE(fruit_inventory, '{}'::jsonb),
            ARRAY[v_ret.item_key],
            to_jsonb(COALESCE((fruit_inventory->>v_ret.item_key)::INTEGER, 0) + v_ret.quantity)
          )
        WHERE id = v_uid;

      ELSIF v_ret.item_type = 'honey' THEN
        UPDATE profiles SET
          hive_data = jsonb_set(
            COALESCE(hive_data, '{}'::jsonb),
            '{honey_jars}',
            to_jsonb(COALESCE((hive_data->>'honey_jars')::INTEGER, 0) + v_ret.quantity)
          )
        WHERE id = v_uid;

      ELSIF v_ret.item_type = 'equipment' THEN
        -- Własność ekwipunku śledzona w localStorage — zwracamy klucze do klienta
        v_equip_keys := array_append(v_equip_keys, v_ret.item_key);
      END IF;
    END IF;
  END LOOP;

  -- Dodaj całe zebrane złoto jednym zapytaniem
  IF v_gold_total > 0 THEN
    UPDATE profiles SET money = money + v_gold_total WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'gold_claimed', v_gold_total,
    'items_claimed', v_items_cnt,
    'equipment_keys', v_equip_keys
  );
END;
$$;

-- ─── 10. PRZEGLĄDAJ TARG ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION market_browse(
  p_item_type TEXT    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 50,
  p_offset    INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM market_expire_offers();
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(o)), '[]'::jsonb) FROM (
      SELECT
        mo.id, mo.seller_id, mo.item_type, mo.item_key, mo.item_name, mo.item_icon,
        mo.quantity, mo.price_per_unit, mo.duration_hours, mo.status,
        mo.created_at, mo.expires_at,
        p.login        AS seller_name,
        p.avatar_skin  AS seller_avatar
      FROM market_offers mo
      JOIN profiles p ON p.id = mo.seller_id
      WHERE mo.status = 'active'
        AND mo.expires_at > now()
        AND (p_item_type IS NULL OR mo.item_type = p_item_type)
      ORDER BY mo.price_per_unit ASC
      LIMIT p_limit OFFSET p_offset
    ) o
  );
END;
$$;

-- ─── 11. MOJE OFERTY ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION market_get_my_offers()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  PERFORM market_expire_offers();
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(o)), '[]'::jsonb) FROM (
      SELECT * FROM market_offers
      WHERE seller_id = v_uid
      ORDER BY created_at DESC
      LIMIT 100
    ) o
  );
END;
$$;

-- ─── 12. DO ODBIORU ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION market_get_returns()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM (
      SELECT * FROM market_returns
      WHERE user_id = v_uid AND claimed = false
      ORDER BY created_at DESC
    ) r
  );
END;
$$;
