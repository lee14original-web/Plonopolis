-- ═══════════════════════════════════════════════════════════════════════════
-- PLONOPOLIS — SECURITY PATCH v1
-- Problemy bezpieczeństwa po stronie SQL (wymagają aktualizacji funkcji)
-- WKLEJ do Supabase SQL Editor i uruchom
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- PATCH 1: game_harvest_plot — 2 poprawki bezpieczeństwa:
--   A) p_effective_grow_ms: klient NIE może skrócić czasu wzrostu poniżej
--      60% wartości serwerowej (nawet jeśli wyśle 1ms). Max dopuszczalna
--      redukcja = 40% (więcej niż max bonus eq: ~30% woda + ~kilka% eq).
--   B) p_exp_mult_override: zablokuj wartości powyżej 30 (max legalny
--      mnożnik legendarny: 15–30x). Klient nie może wysłać 9999x EXP.
-- ───────────────────────────────────────────────────────────────────────────

-- Nadpisuje całą funkcję z zachowaniem logiki, tylko zmienia 2 bloki IF:

DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer, integer, numeric, numeric);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer);

CREATE OR REPLACE FUNCTION public.game_harvest_plot(
  p_plot_id              integer,
  p_effective_grow_ms    bigint  DEFAULT NULL,
  p_zrecznosc            integer DEFAULT 0,
  p_planted_quality      text    DEFAULT 'good',
  p_exp_mult_override    integer DEFAULT 0,
  p_compost_yield_extra  integer DEFAULT 0,
  p_extra_harvest_pct    numeric DEFAULT 0,
  p_bonus_drop_pct       numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_profile             public.profiles%rowtype;
  v_plot                jsonb;
  v_crop                public.crop_config%rowtype;
  v_planted_at_ms       bigint;
  v_effective_growth_ms bigint;
  v_server_growth_ms    bigint; -- bazowy czas serwera (bez klienta)
  v_now_ms              bigint;
  v_plot_crops          jsonb;
  v_seed_inventory      jsonb;
  v_seed_amount         integer;
  v_level               integer;
  v_xp                  bigint;
  v_xp_to_next          bigint;
  v_zrecznosc_eff       numeric;
  v_zrecznosc_chance    numeric;
  v_zrecznosc_triggered boolean := false;
  v_exp_mult            numeric;
  v_good_key            text;
  v_epic_key            text;
  v_rotten_key          text;
  v_legacy_key          text;
  v_legacy_amount       integer;
  v_gained_good         integer := 0;
  v_gained_epic         integer := 0;
  v_gained_rotten       integer := 0;
  v_extra_harvest_gain  integer := 0;
  v_bonus_drop_upgrades integer := 0;
  v_loop_i              integer;
  v_target_quality      text;
  v_actual_planted_q    text;
  v_actual_compost_yld  integer;
  v_compost_type        text;
begin
  if auth.uid() is null then raise exception 'Brak autoryzacji'; end if;
  if p_plot_id < 1 or p_plot_id > 25 then raise exception 'Nieprawidłowe pole'; end if;

  -- SECURITY: clamp parametry wejściowe do bezpiecznych zakresów
  p_compost_yield_extra := LEAST(GREATEST(p_compost_yield_extra, 0), 3);   -- max wartość kompostu Urodzaju
  p_extra_harvest_pct   := LEAST(GREATEST(p_extra_harvest_pct,   0), 1);   -- max 100%
  p_bonus_drop_pct      := LEAST(GREATEST(p_bonus_drop_pct,      0), 1);   -- max 100%
  -- p_exp_mult_override: max 30 (legendarne 15–30x), wartości wyższe = cheat
  IF p_exp_mult_override > 30 THEN
    p_exp_mult_override := 30;
  END IF;

  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profil nie istnieje'; end if;

  v_plot_crops     := coalesce(v_profile.plot_crops, '{}'::jsonb);
  v_seed_inventory := coalesce(v_profile.seed_inventory, '{}'::jsonb);
  v_plot           := v_plot_crops -> (p_plot_id::text);

  if v_plot is null or coalesce(v_plot ->> 'cropId', '') = '' then
    raise exception 'Na tym polu nie ma uprawy';
  end if;

  select * into v_crop from public.crop_config where id = (v_plot ->> 'cropId');
  if not found then raise exception 'Nie znaleziono definicji uprawy'; end if;

  v_planted_at_ms := coalesce((v_plot ->> 'plantedAt')::bigint, 0);
  v_now_ms        := floor(extract(epoch from clock_timestamp()) * 1000);

  -- Serwerowy czas wzrostu (woda = -15%)
  if coalesce((v_plot ->> 'watered')::boolean, false) then
    v_server_growth_ms := round(v_crop.growth_time_ms * 0.85);
  else
    v_server_growth_ms := v_crop.growth_time_ms;
  end if;

  -- SECURITY FIX A: klient może skrócić czas maksymalnie o 40% względem serwera
  -- (pokrywa bonusy eq ~30% + margines). Klient NIE może wysłać 1ms → natychmiastowy zbiór.
  if p_effective_grow_ms is not null then
    declare
      v_min_allowed bigint := round(v_server_growth_ms * 0.60); -- min 60% czasu bazowego
    begin
      v_effective_growth_ms := GREATEST(p_effective_grow_ms, v_min_allowed);
      -- i tak nie więcej niż serwer (klient nie może wydłużać)
      v_effective_growth_ms := LEAST(v_effective_growth_ms, v_server_growth_ms);
    end;
  else
    v_effective_growth_ms := v_server_growth_ms;
  end if;

  if (v_now_ms - v_planted_at_ms) < v_effective_growth_ms then
    raise exception 'Uprawa jeszcze nie dojrzała';
  end if;

  -- Klucze z jakością
  v_good_key   := v_crop.id || '_good';
  v_epic_key   := v_crop.id || '_epic';
  v_rotten_key := v_crop.id || '_rotten';
  v_legacy_key := v_crop.id;

  v_legacy_amount := coalesce((v_seed_inventory ->> v_legacy_key)::integer, 0);

  -- Jakość zasadzonego nasiona
  v_actual_planted_q := coalesce(v_plot ->> 'plantedQuality', 'good');
  if v_actual_planted_q not in ('rotten', 'good', 'epic', 'legendary') then
    v_actual_planted_q := 'good';
  end if;

  -- Zamień parametr klienta z jakością — nie ufaj klientowi wprost,
  -- ale zachowaj dla zgodności (walidacja jest w actual_planted_q)
  if p_planted_quality not in ('rotten', 'good', 'epic', 'legendary') then
    p_planted_quality := 'good';
  end if;

  -- Ilość nasion do zwrotu (ze starego klucza, jeśli istnieje)
  if v_legacy_amount > 0 then
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_legacy_key],
      to_jsonb(v_legacy_amount + 1));
  else
    declare
      v_quality_key text := v_crop.id || '_' || v_actual_planted_q;
      v_q_amount    integer;
    begin
      v_q_amount := coalesce((v_seed_inventory ->> v_quality_key)::integer, 0);
      v_seed_inventory := jsonb_set(v_seed_inventory, array[v_quality_key],
        to_jsonb(v_q_amount + 1));
    end;
  end if;

  -- Zrecznosc: chance na brak psucia, cap 90%
  v_zrecznosc_eff   := LEAST(p_zrecznosc, 90);
  v_zrecznosc_chance := v_zrecznosc_eff / 100.0;
  if v_zrecznosc_chance > 0 and random() < v_zrecznosc_chance then
    v_zrecznosc_triggered := true;
  end if;

  -- Zbiór wg jakości zasadzonej
  if v_actual_planted_q = 'rotten' then
    -- Popsute: zawsze rotten, zrecznosc nie pomaga (nie ma psucia do uniknięcia)
    v_gained_rotten := v_crop.base_harvest_amount;
  elsif v_actual_planted_q = 'epic' then
    -- Epickie: zawsze good (bez kompostu/eq bonusów tu)
    v_gained_good := v_crop.base_harvest_amount;
  elsif v_actual_planted_q = 'legendary' then
    -- Legendarne: zawsze good (klient aplikuje drop osobno)
    v_gained_good := v_crop.base_harvest_amount;
  else
    -- Standardowe: szansa na psucie (Słaba Ziemia)
    if v_zrecznosc_triggered or random() > 0.15 then
      -- Dobry zbiór
      v_gained_good := v_crop.base_harvest_amount;
      -- Bonus drop pct (eq): szansa na upgrade GOOD → EPIC
      if p_bonus_drop_pct > 0 then
        v_loop_i := 0;
        while v_loop_i < v_gained_good loop
          if random() < p_bonus_drop_pct then
            v_bonus_drop_upgrades := v_bonus_drop_upgrades + 1;
          end if;
          v_loop_i := v_loop_i + 1;
        end loop;
        v_gained_epic := v_bonus_drop_upgrades;
        v_gained_good := v_gained_good - v_bonus_drop_upgrades;
      end if;
      -- Extra harvest pct (eq): szansa na +1 za każdą GOOD
      if p_extra_harvest_pct > 0 then
        declare v_eg integer := v_gained_good; begin
          v_loop_i := 0;
          while v_loop_i < v_eg loop
            if random() < p_extra_harvest_pct then
              v_extra_harvest_gain := v_extra_harvest_gain + 1;
            end if;
            v_loop_i := v_loop_i + 1;
          end loop;
        end;
        v_gained_good := v_gained_good + v_extra_harvest_gain;
      end if;
      -- Bonus kompostu Urodzaju
      if p_compost_yield_extra > 0 and v_actual_planted_q <> 'rotten' then
        v_actual_compost_yld := LEAST(p_compost_yield_extra, 3);
        v_gained_good := v_gained_good + v_actual_compost_yld;
      end if;
    else
      -- Psuje się (15% szans)
      v_gained_rotten := v_crop.base_harvest_amount;
    end if;
  end if;

  -- Aktualizacja inventory
  if v_gained_good > 0 then
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_good_key],
      to_jsonb(coalesce((v_seed_inventory ->> v_good_key)::integer, 0) + v_gained_good));
  end if;
  if v_gained_epic > 0 then
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_epic_key],
      to_jsonb(coalesce((v_seed_inventory ->> v_epic_key)::integer, 0) + v_gained_epic));
  end if;
  if v_gained_rotten > 0 then
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_rotten_key],
      to_jsonb(coalesce((v_seed_inventory ->> v_rotten_key)::integer, 0) + v_gained_rotten));
  end if;

  -- Wyczyść pole
  v_plot_crops := jsonb_set(v_plot_crops, array[p_plot_id::text], '{}'::jsonb);

  -- SECURITY FIX B: EXP mult override jest już ograniczony do max 30 na początku funkcji
  IF p_exp_mult_override = -1 THEN
    v_exp_mult := 0;
  ELSIF p_exp_mult_override > 0 THEN
    v_exp_mult := p_exp_mult_override; -- max 30 (zclampowane powyżej)
  ELSIF v_actual_planted_q = 'rotten' THEN
    v_exp_mult := 0;
  ELSIF v_actual_planted_q = 'epic' THEN
    v_exp_mult := 3 + floor(random() * 4); -- 3–6x losowo po stronie serwera
  ELSE
    v_exp_mult := 1;
  END IF;

  v_level      := v_profile.level;
  v_xp         := v_profile.xp + ROUND(v_crop.exp_reward * v_exp_mult);
  v_xp_to_next := v_profile.xp_to_next_level;

  while v_level < 50 and v_xp >= v_xp_to_next loop
    v_xp     := v_xp - v_xp_to_next;
    v_level  := v_level + 1;
    if v_level >= 50 then
      v_xp         := 0;
      v_xp_to_next := 0;
    else
      v_xp_to_next := round(100 * power(1.15, v_level - 1));
    end if;
  end loop;

  update public.profiles set
    plot_crops       = v_plot_crops,
    seed_inventory   = v_seed_inventory,
    xp               = v_xp,
    level            = v_level,
    xp_to_next_level = v_xp_to_next,
    last_played_at   = now()
  where id = auth.uid();

  return json_build_object(
    'ok',           true,
    'gained_good',  v_gained_good,
    'gained_epic',  v_gained_epic,
    'gained_rotten',v_gained_rotten,
    'extra_harvest',v_extra_harvest_gain,
    'bonus_drop',   v_bonus_drop_upgrades,
    'compost_yield',coalesce(v_actual_compost_yld, 0),
    'exp_gained',   ROUND(v_crop.exp_reward * v_exp_mult),
    'new_level',    v_level,
    'new_xp',       v_xp,
    'zrecznosc_triggered', v_zrecznosc_triggered
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- PATCH 2: RLS — upewnij się że profiles.money i seed_inventory
-- mogą być aktualizowane tylko przez właściciela (auth.uid() = id)
-- Wykonaj TYLKO jeśli jeszcze nie masz tych polityk
-- ───────────────────────────────────────────────────────────────────────────

-- Sprawdź czy RLS jest włączone na profiles:
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Polityka UPDATE własnego profilu (jeśli nie istnieje):
-- CREATE POLICY "profiles_update_own" ON public.profiles
--   FOR UPDATE USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

-- UWAGA: jeśli polityki już istnieją — poniższe jest zbędne.
-- Supabase domyślnie tworzy polityki UPDATE własnego profilu.
-- Zweryfikuj w panelu: Authentication → Policies → profiles

-- ───────────────────────────────────────────────────────────────────────────
-- PATCH 3: complete_customer_order — dodaj cap na tier eq_item
-- (zapobiega wysłaniu tier=999 z klienta)
-- ───────────────────────────────────────────────────────────────────────────
-- Znajdź w istniejącej funkcji complete_customer_order fragment gdzie
-- generowany jest bonus typu eq_item i dodaj:
--   tier := LEAST(GREATEST(tier, 0), 4);
-- ───────────────────────────────────────────────────────────────────────────
