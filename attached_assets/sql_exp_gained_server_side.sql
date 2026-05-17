-- ============================================================
-- PATCH: game_harvest_plot — exp_gained server-side
-- Problem 1: klient liczył actualExp = rpcProf.xp - prevXp.
--   Przy "Zbierz wszystko" rpcProf.xp akumuluje EXP ze WSZYSTKICH
--   poprzednich pól (FOR UPDATE serializacja) → popup zawyżony.
-- Problem 2: bonus EXP (eq %, kompost Nauki %) szedł przez osobny
--   profiles.update klient-side → race condition przy masowym zbiorze.
-- Fix: SQL przyjmuje p_exp_bonus_pct i zwraca exp_gained.
--   Frontend czyta exp_gained bezpośrednio — żadnego diffu, żadnego
--   drugiego profiles.update.
-- Wklej do Supabase SQL Editor i wykonaj (Run).
-- ============================================================

DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer, integer, numeric, numeric, integer, numeric);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer, integer, numeric, numeric, integer);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer, integer, numeric, numeric);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer, integer, numeric);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer, integer);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text, integer);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, numeric);

CREATE OR REPLACE FUNCTION public.game_harvest_plot(
  p_plot_id              integer,
  p_effective_grow_ms    bigint  DEFAULT NULL,
  p_zrecznosc            integer DEFAULT 0,
  p_planted_quality      text    DEFAULT 'good',
  p_exp_mult_override    integer DEFAULT 0,
  p_compost_yield_extra  integer DEFAULT 0,
  p_extra_harvest_pct    numeric DEFAULT 0,
  p_bonus_drop_pct       numeric DEFAULT 0,
  p_szczescie            integer DEFAULT 0,
  p_exp_bonus_pct        numeric DEFAULT 0   -- łączny % bonus EXP (eq + kompost Nauki)
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
  v_legendary_key       text;
  v_legacy_key          text;
  v_legacy_amount       integer;
  v_gained_good         integer := 0;
  v_gained_epic         integer := 0;
  v_gained_rotten       integer := 0;
  v_gained_legendary    integer := 0;
  v_extra_harvest_gain  integer := 0;
  v_bonus_drop_upgrades integer := 0;
  v_loop_i              integer;
  v_target_quality      text;
  v_actual_planted_q    text;
  v_actual_compost_yld  integer;
  v_compost_type        text;
  v_q_roll              numeric;
  v_base_yield          integer;
  v_legendary_exp_mult  integer := 0;
  v_exp_gained          bigint  := 0;   -- dokładne EXP dodane przez to pole (zwracane do klienta)
  -- Szczęście na jakość
  v_luck_eff            numeric;
  v_rotten_thresh       numeric;
  v_epic_chance         numeric;
  v_legendary_chance    numeric;
  v_good_chance         numeric;
begin
  if auth.uid() is null then raise exception 'Brak autoryzacji'; end if;
  if p_plot_id < 1 or p_plot_id > 100 then raise exception 'Nieprawidłowe pole'; end if;

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

  if coalesce((v_plot ->> 'watered')::boolean, false) then
    v_effective_growth_ms := round(v_crop.growth_time_ms * 0.85);
  else
    v_effective_growth_ms := v_crop.growth_time_ms;
  end if;

  if p_effective_grow_ms is not null and p_effective_grow_ms < v_effective_growth_ms then
    v_effective_growth_ms := p_effective_grow_ms;
  end if;

  if (v_now_ms - v_planted_at_ms) < v_effective_growth_ms then
    raise exception 'Uprawa jeszcze nie dojrzała';
  end if;

  -- Klucze z jakością
  v_good_key      := v_crop.id || '_good';
  v_epic_key      := v_crop.id || '_epic';
  v_rotten_key    := v_crop.id || '_rotten';
  v_legendary_key := v_crop.id || '_legendary';
  v_legacy_key    := v_crop.id;

  -- Migracja: stary klucz bez sufiksu → "_good"
  v_legacy_amount := coalesce((v_seed_inventory ->> v_legacy_key)::integer, 0);
  if v_legacy_amount > 0 then
    v_seed_amount    := coalesce((v_seed_inventory ->> v_good_key)::integer, 0);
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_good_key],
      to_jsonb(v_seed_amount + v_legacy_amount), true);
    v_seed_inventory := v_seed_inventory - v_legacy_key;
  end if;

  -- Jakość zasadzonego nasiona z DB (anti-exploit — nie ufamy parametrowi klienta)
  v_actual_planted_q := coalesce(v_plot ->> 'plantedQuality', 'good');
  if v_actual_planted_q not in ('good','epic','rotten','legendary') then
    v_actual_planted_q := 'good';
  end if;

  -- ── Progi jakości (Szczęście) ─────────────────────────────────────────────
  v_luck_eff         := least(100.0, greatest(0.0, p_szczescie::numeric));
  v_rotten_thresh    := greatest(0.05, 0.10 - v_luck_eff * 0.0005);
  v_epic_chance      := least(0.15,   0.04 + v_luck_eff * 0.0011);
  v_legendary_chance := least(0.06,   0.01 + v_luck_eff * 0.0005);
  v_good_chance      := 1.0 - v_rotten_thresh - v_epic_chance - v_legendary_chance;

  -- ── Wybór jakości plonu i bazowy yield ────────────────────────────────────
  if v_actual_planted_q = 'rotten' then
    v_target_quality := 'rotten';
    v_base_yield     := 1 + floor(random() * 3)::integer;
    v_gained_rotten  := v_base_yield;

  elsif v_actual_planted_q = 'legendary' then
    -- LEGENDARNY: atomicznie server-side (eliminuje race condition klient-side)
    v_target_quality := 'legendary';
    if v_crop.yield_amount <= 2 then
      v_gained_good := 20 + floor(random() * 41)::integer;
      v_gained_epic :=  5 + floor(random() *  8)::integer;
    else
      v_gained_good := 30 + floor(random() * 51)::integer;
      v_gained_epic :=  8 + floor(random() * 11)::integer;
    end if;

  elsif v_actual_planted_q = 'epic' then
    v_target_quality := 'epic';
    if v_crop.yield_amount <= 2 then
      v_base_yield := 10 + floor(random() * 13)::integer;
    else
      v_base_yield := 14 + floor(random() * 17)::integer;
    end if;
    for v_loop_i in 1..v_base_yield loop
      v_q_roll := random();
      if v_q_roll < v_rotten_thresh then
        v_gained_rotten    := v_gained_rotten    + 1;
      elsif v_q_roll < v_rotten_thresh + v_good_chance then
        v_gained_good      := v_gained_good      + 1;
      elsif v_q_roll < v_rotten_thresh + v_good_chance + v_epic_chance then
        v_gained_epic      := v_gained_epic      + 1;
      else
        v_gained_legendary := v_gained_legendary + 1;
      end if;
    end loop;

  else
    -- ZWYKŁE: jeden rzut na całą partię
    if v_crop.yield_amount <= 2 then
      v_base_yield := 1 + floor(random() * 3)::integer;
    else
      v_base_yield := 2 + floor(random() * 4)::integer;
    end if;
    v_q_roll := random();
    if v_q_roll < v_rotten_thresh then
      v_target_quality := 'rotten';
    elsif v_q_roll < v_rotten_thresh + v_good_chance then
      v_target_quality := 'good';
    elsif v_q_roll < v_rotten_thresh + v_good_chance + v_epic_chance then
      v_target_quality := 'epic';
    else
      v_target_quality := 'legendary';
    end if;
    v_gained_good      := case when v_target_quality = 'good'      then v_base_yield else 0 end;
    v_gained_epic      := case when v_target_quality = 'epic'      then v_base_yield else 0 end;
    v_gained_rotten    := case when v_target_quality = 'rotten'    then v_base_yield else 0 end;
    v_gained_legendary := case when v_target_quality = 'legendary' then v_base_yield else 0 end;
  end if;

  -- ── Zręczność: szansa na podwojenie finalnego zbioru ─────────────────────
  v_zrecznosc_eff    := case when p_zrecznosc <= 50
    then p_zrecznosc::numeric
    else 50.0 + (p_zrecznosc - 50) * 0.5
  end;
  v_zrecznosc_chance := round(v_zrecznosc_eff * 0.004 * 1000) / 10 / 100;

  if p_zrecznosc > 0 and random() < v_zrecznosc_chance then
    v_zrecznosc_triggered := true;
    v_gained_good      := v_gained_good      * 2;
    v_gained_epic      := v_gained_epic      * 2;
    v_gained_rotten    := v_gained_rotten    * 2;
    v_gained_legendary := v_gained_legendary * 2;
  end if;

  -- ── Bonus z kompostu Urodzaju: dodatkowe sztuki GOOD ─────────────────────
  v_compost_type       := v_plot -> 'compostBonus' ->> 'type';
  v_actual_compost_yld := case
    when v_compost_type = 'yield'
    then least(coalesce((v_plot -> 'compostBonus' ->> 'value')::integer, 0), 3)
    else 0
  end;
  if v_actual_compost_yld > 0 then
    v_gained_good := v_gained_good + v_actual_compost_yld;
  end if;

  -- ── % Extra harvest z eq ──────────────────────────────────────────────────
  if p_extra_harvest_pct > 0 and v_target_quality = 'good' and v_gained_good > 0 then
    for v_loop_i in 1..v_gained_good loop
      if random() < (p_extra_harvest_pct / 100.0) then
        v_extra_harvest_gain := v_extra_harvest_gain + 1;
      end if;
    end loop;
    v_gained_good := v_gained_good + v_extra_harvest_gain;
  end if;

  -- ── % Bonus drop z eq: good → epic ───────────────────────────────────────
  if p_bonus_drop_pct > 0 and v_target_quality = 'good' and v_gained_good > 0 then
    for v_loop_i in 1..v_gained_good loop
      if random() < (p_bonus_drop_pct / 100.0) then
        v_bonus_drop_upgrades := v_bonus_drop_upgrades + 1;
      end if;
    end loop;
    v_gained_good := v_gained_good - v_bonus_drop_upgrades;
    v_gained_epic := v_gained_epic + v_bonus_drop_upgrades;
  end if;

  -- ── Zapis do seed_inventory atomicznie ───────────────────────────────────
  if v_gained_good > 0 then
    v_seed_amount    := coalesce((v_seed_inventory ->> v_good_key)::integer, 0);
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_good_key],
      to_jsonb(v_seed_amount + v_gained_good), true);
  end if;
  if v_gained_epic > 0 then
    v_seed_amount    := coalesce((v_seed_inventory ->> v_epic_key)::integer, 0);
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_epic_key],
      to_jsonb(v_seed_amount + v_gained_epic), true);
  end if;
  if v_gained_rotten > 0 then
    v_seed_amount    := coalesce((v_seed_inventory ->> v_rotten_key)::integer, 0);
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_rotten_key],
      to_jsonb(v_seed_amount + v_gained_rotten), true);
  end if;
  if v_gained_legendary > 0 then
    v_seed_amount    := coalesce((v_seed_inventory ->> v_legendary_key)::integer, 0);
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_legendary_key],
      to_jsonb(v_seed_amount + v_gained_legendary), true);
  end if;

  -- ── Wyczyść pole ─────────────────────────────────────────────────────────
  v_plot_crops := v_plot_crops - (p_plot_id::text);

  -- ── EXP — mnożnik bazowy ─────────────────────────────────────────────────
  IF p_exp_mult_override = -1 THEN
    v_exp_mult := 0;
  ELSIF p_exp_mult_override > 0 THEN
    v_exp_mult := p_exp_mult_override;
  ELSIF v_actual_planted_q = 'rotten' OR v_target_quality = 'rotten' THEN
    v_exp_mult := 0;
  ELSIF v_actual_planted_q = 'legendary' THEN
    if v_crop.yield_amount <= 2 then
      v_legendary_exp_mult := 10 + floor(random() * 11)::integer;  -- 10-20
    else
      v_legendary_exp_mult := 12 + floor(random() * 14)::integer;  -- 12-25
    end if;
    v_exp_mult := v_legendary_exp_mult;
  ELSIF v_actual_planted_q = 'epic' THEN
    v_exp_mult := 3 + floor(random() * 4);
  ELSE
    v_exp_mult := 1;
  END IF;

  -- ── EXP gained: base × mult × (1 + bonus%) ───────────────────────────────
  -- p_exp_bonus_pct = łączny % eq + kompost Nauki (klient przesyła, SQL aplikuje atomicznie).
  -- Cap dla legendarnych: całkowity EXP ≤ exp_reward × 50.
  v_exp_gained := ROUND(v_crop.exp_reward * v_exp_mult * (1.0 + LEAST(p_exp_bonus_pct, 500.0) / 100.0));
  IF v_actual_planted_q = 'legendary' AND v_crop.exp_reward > 0 THEN
    v_exp_gained := LEAST(v_exp_gained, v_crop.exp_reward * 50);
  END IF;

  v_level      := v_profile.level;
  v_xp         := v_profile.xp + v_exp_gained;
  v_xp_to_next := v_profile.xp_to_next_level;

  while v_level < 50 and v_xp >= v_xp_to_next loop
    v_xp     := v_xp - v_xp_to_next;
    v_level  := v_level + 1;
    if v_level >= 50 then
      v_level := 50; v_xp := 0; v_xp_to_next := 0; exit;
    else
      v_xp_to_next := public.game_xp_to_next_level(v_level);
    end if;
  end loop;

  update public.profiles set
    level            = v_level,
    xp               = v_xp,
    xp_to_next_level = v_xp_to_next,
    current_map      = public.game_map_for_level(v_level),
    plot_crops       = v_plot_crops,
    seed_inventory   = v_seed_inventory,
    last_played_at   = now()
  where id = auth.uid()
  returning * into v_profile;

  return json_build_object(
    'profile',             row_to_json(v_profile),
    'zrecznosc_triggered', v_zrecznosc_triggered,
    'gained_good',         v_gained_good,
    'gained_epic',         v_gained_epic,
    'gained_rotten',       v_gained_rotten,
    'gained_legendary',    v_gained_legendary,
    'legendary_exp_mult',  v_legendary_exp_mult,
    'extra_harvest_gain',  v_extra_harvest_gain,
    'bonus_drop_upgrades', v_bonus_drop_upgrades,
    'exp_gained',          v_exp_gained           -- dokładny EXP tego pola (fix inflated popup)
  );
end;
$$;
