-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: BEZPIECZEŃSTWO INVENTORY — ETAP BEZPIECZNY (audit + zamknięcie dev fn)
-- ───────────────────────────────────────────────────────────────────────────
-- Kontekst:
--   Konto Yeti9: carrot_good 47 → 1000, changed_by = null, tylko seed_inventory.
--   Audyt wykazał:
--     1. seed_inventory NIE jest chronione przez protect_inventory_columns.
--     2. test_add_barn_items ma GRANT do authenticated bez sprawdzenia
--        auth.uid() = p_user_id → każdy zalogowany gracz może modyfikować
--        barn_items dowolnego użytkownika.
--
-- Ten plik:
--   A. Tworzy tabelę audit_inventory_log + trigger logujący skoki seed_inventory
--   B. Odwołuje granty test_add_barn_items + dodaje auth check do funkcji
--   C. NIE blokuje żadnych legalnych zapisów seed_inventory (tylko loguje)
--
-- Kolejność wdrożenia:
--   1. Ten plik (audit + zamknięcie dev fn)
--   2. Kolejny etap: protect_inventory_columns rozszerzony o seed_inventory
--      (po weryfikacji, że audit_inventory_log nie pokazuje false-positives)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── A.1. TABELA audit_inventory_log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_inventory_log (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      UUID,                              -- profiles.id (czyj inventarz)
  changed_by   UUID,                              -- auth.uid() w momencie zapisu
  action       TEXT,                              -- źródło akcji (app.action)
  column_name  TEXT,                              -- np. 'seed_inventory'
  delta_json   JSONB,                             -- {klucz: {old, new, delta}}
  changed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_inventory_log_user_idx
  ON public.audit_inventory_log(user_id);
CREATE INDEX IF NOT EXISTS audit_inventory_log_changed_at_idx
  ON public.audit_inventory_log(changed_at DESC);

-- RLS: tylko właściciel + service_role może czytać własne logi
ALTER TABLE public.audit_inventory_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_inventory_log_select_own ON public.audit_inventory_log;
CREATE POLICY audit_inventory_log_select_own ON public.audit_inventory_log
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT może tylko SECURITY DEFINER trigger (postgres) — brak polityki dla authenticated
-- DELETE/UPDATE — brak polityki → zablokowane dla authenticated/anon


-- ─── A.2. FUNKCJA audit_seed_inventory_changes() ──────────────────────────
CREATE OR REPLACE FUNCTION public.audit_seed_inventory_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key      TEXT;
  v_old_val  NUMERIC;
  v_new_val  NUMERIC;
  v_delta    NUMERIC;
  v_action   TEXT;
BEGIN
  -- Jeśli seed_inventory się nie zmieniło — nic nie rób
  IF NEW.seed_inventory IS NOT DISTINCT FROM OLD.seed_inventory THEN
    RETURN NEW;
  END IF;

  -- Źródło akcji — ustawiane przez RPC przez set_config('app.action', ..., true)
  -- Jeśli nie ustawione (np. bezpośredni update z SQL Editor / service_role):
  -- current_setting zwraca '' lub rzuca wyjątek — obsługujemy oba przypadki
  BEGIN
    v_action := NULLIF(TRIM(current_setting('app.action', true)), '');
  EXCEPTION WHEN OTHERS THEN
    v_action := NULL;
  END;
  v_action := COALESCE(v_action, 'unknown');

  -- Sprawdź każdy klucz w NEW.seed_inventory
  FOR v_key IN
    SELECT DISTINCT jsonb_object_keys
    FROM (
      SELECT jsonb_object_keys(COALESCE(NEW.seed_inventory, '{}'::JSONB))
      UNION
      SELECT jsonb_object_keys(COALESCE(OLD.seed_inventory, '{}'::JSONB))
    ) AS keys(jsonb_object_keys)
  LOOP
    v_new_val := COALESCE((NEW.seed_inventory ->> v_key)::NUMERIC, 0);
    v_old_val := COALESCE((OLD.seed_inventory ->> v_key)::NUMERIC, 0);
    v_delta   := v_new_val - v_old_val;

    -- Loguj tylko skoki >= 50 szt. (w górę lub w dół)
    -- Normalne akcje: harvest +3–5 szt., plant -1, sklep +5–30 → delta < 50
    -- Podejrzane: bezpośredni update, dev fn, service_role → delta >> 50
    IF ABS(v_delta) >= 50 THEN
      INSERT INTO public.audit_inventory_log(
        user_id, changed_by, action, column_name, delta_json
      ) VALUES (
        NEW.id,
        auth.uid(),   -- NULL jeśli update poza sesją auth (SQL Editor / service_role)
        v_action,
        'seed_inventory',
        jsonb_build_object(
          v_key, jsonb_build_object(
            'old',   v_old_val,
            'new',   v_new_val,
            'delta', v_delta
          )
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END $$;


-- ─── A.3. TRIGGER audit_seed_inventory_trg ────────────────────────────────
DROP TRIGGER IF EXISTS audit_seed_inventory_trg ON public.profiles;

CREATE TRIGGER audit_seed_inventory_trg
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_seed_inventory_changes();


-- ─── B. ZAMKNIĘCIE test_add_barn_items ────────────────────────────────────
-- Odwołanie grantów publicznych — dostęp zostaje TYLKO dla postgres/service_role
-- (wywoływalne z Supabase SQL Editor, ale nie przez zwykłego gracza przez RPC)

REVOKE EXECUTE ON FUNCTION public.test_add_barn_items(UUID, INT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.test_add_barn_items(UUID, INT) FROM anon;

-- Nowa wersja funkcji z auth check — blokuje wywołanie na cudze konto
-- nawet jeśli ktoś jakoś odzyska EXECUTE (np. przez GRANT w przyszłości)
CREATE OR REPLACE FUNCTION public.test_add_barn_items(
  p_user_id UUID,
  p_amount  INT DEFAULT 50
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_keys TEXT[] := ARRAY[
    'jajko', 'futro_krolika', 'mleko', 'piora', 'welna',
    'nawoz_naturalny', 'mleko_kozie', 'duze_piora',
    'energia_robocza', 'rogi_byka'
  ];
  v_key  TEXT;
  v_old  JSONB;
  v_new  JSONB;
BEGIN
  -- ◆ NOWE: blokada wywołania na cudze konto
  -- Funkcja pozostaje dostępna dla service_role/postgres (SQL Editor),
  -- ale zablokowana gdy wywołana jako authenticated z innym user_id.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: test_add_barn_items cannot be called for another user (caller=%, target=%)',
      auth.uid(), p_user_id;
  END IF;

  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id required'; END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN RAISE EXCEPTION 'p_amount must be >= 1'; END IF;

  SELECT COALESCE(barn_items, '{}'::JSONB) INTO v_old
    FROM profiles WHERE id = p_user_id;

  v_new := v_old;
  FOREACH v_key IN ARRAY v_keys LOOP
    v_new := jsonb_set(
      v_new,
      ARRAY[v_key],
      to_jsonb(COALESCE((v_old ->> v_key)::INT, 0) + p_amount)
    );
  END LOOP;

  UPDATE profiles SET barn_items = v_new WHERE id = p_user_id;
  RETURN v_new;
END $$;

-- Brak GRANT — funkcja dostępna tylko dla postgres/service_role
-- (NIE dla authenticated, NIE dla anon)


-- ═══════════════════════════════════════════════════════════════════════════
-- D. ZAPYTANIA KONTROLNE — uruchom po wgraniu w Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- D.1. Sprawdź czy trigger istnieje i jest aktywny:
--
--   SELECT tgname, tgenabled, tgtype
--   FROM pg_trigger
--   WHERE tgrelid = 'public.profiles'::regclass
--     AND tgname = 'audit_seed_inventory_trg';
--   -- Oczekiwany wynik: 1 wiersz, tgenabled = 'O' (enabled)


-- D.2. Sprawdź granty na test_add_barn_items (nie powinno być authenticated/anon):
--
--   SELECT grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_name = 'test_add_barn_items'
--     AND routine_schema = 'public';
--   -- Oczekiwany wynik: tylko postgres / service_role (LUB pusty)


-- D.3. Podgląd ostatnich wpisów audit_inventory_log:
--
--   SELECT
--     al.id,
--     al.user_id,
--     p.username,
--     al.changed_by,
--     al.action,
--     al.delta_json,
--     al.changed_at
--   FROM public.audit_inventory_log al
--   LEFT JOIN public.profiles p ON p.id = al.user_id
--   ORDER BY al.changed_at DESC
--   LIMIT 20;


-- D.4. Test triggera — symulacja ręcznego update przez SQL Editor:
--   (uruchom jako service_role lub w SQL Editorze Supabase)
--
--   UPDATE profiles
--   SET seed_inventory = jsonb_set(
--     COALESCE(seed_inventory, '{}'::jsonb),
--     '{carrot_good}',
--     to_jsonb(COALESCE((seed_inventory ->> 'carrot_good')::int, 0) + 100)
--   )
--   WHERE username = 'TWOJ_USERNAME';
--
--   -- Potem sprawdź:
--   SELECT * FROM audit_inventory_log ORDER BY changed_at DESC LIMIT 5;
--   -- Powinien pojawić się wpis z action='unknown', changed_by=null, delta>=50


-- D.5. Sprawdź czy Yeti9 trigger by rejestrował — wyszukaj historyczne podejrzane logi:
--
--   SELECT *
--   FROM public.audit_inventory_log
--   WHERE user_id = (SELECT id FROM profiles WHERE username = 'Yeti9')
--   ORDER BY changed_at DESC;
--   -- Trigger zadziała dopiero OD TERAZ — historyczne zdarzenie nie będzie w tabeli.

-- ═══════════════════════════════════════════════════════════════════════════
