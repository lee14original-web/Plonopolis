-- ════════════════════════════════════════════════════════════════════════
-- FIX: Synchronizacja xp_to_next_level — 3-częściowa naprawa
--
-- Problem: game_harvest_plot czyta v_profile.xp_to_next_level (stara wartość
--          z kolumny = 100) zamiast wywołać game_xp_to_next_level(v_level)=12.
--          Konta z domyślnym xp_to_next_level=100 nigdy nie awansują na level 2
--          mimo zebrania wystarczającego EXP (próg to 12, nie 100).
--
-- Fix składa się z 3 kroków:
--   1. game_harvest_plot: używaj game_xp_to_next_level(v_level) zamiast stored value
--   2. game_start_tutorial: ustaw xp_to_next_level = game_xp_to_next_level(1) = 12
--   3. Migracja istniejących kont: popraw xp_to_next_level + ewentualny level-up
--
-- Wklej całość do Supabase SQL Editor i wykonaj (Run).
-- ════════════════════════════════════════════════════════════════════════

-- ── Krok 1: Zmień DEFAULT kolumny ─────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN xp_to_next_level SET DEFAULT 12;

-- ── Krok 2: game_harvest_plot — zawsze używaj funkcji, nie stored value ───
-- (tylko sekcja EXP/level-up; reszta funkcji bez zmian)
-- UWAGA: poniżej pełna funkcja z jedną zmianą: linia "v_xp_to_next := v_profile.xp_to_next_level"
-- zastąpiona przez "v_xp_to_next := public.game_xp_to_next_level(v_level)"

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
  p_exp_bonus_pct        numeric DEFAULT 0
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
  v_exp_gained          bigint  := 0;
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

  v_good_key      := v_crop.id || '_good';
  v_epic_key      := v_crop.id || '_epic';
  v_rotten_key    := v_crop.id || '_rotten';
  v_legendary_key := v_crop.id || '_legendary';
  v_legacy_key    := v_crop.id;

  v_legacy_amount := coalesce((v_seed_inventory ->> v_legacy_key)::integer, 0);
  if v_legacy_amount > 0 then
    v_seed_amount    := coalesce((v_seed_inventory ->> v_good_key)::integer, 0);
    v_seed_inventory := jsonb_set(v_seed_inventory, array[v_good_key],
      to_jsonb(v_seed_amount + v_legacy_amount), true);
    v_seed_inventory := v_seed_inventory - v_legacy_key;
  end if;

  v_actual_planted_q := coalesce(v_plot ->> 'plantedQuality', 'good');
  if v_actual_planted_q not in ('good','epic','rotten','legendary') then
    v_actual_planted_q := 'good';
  end if;

  v_luck_eff         := least(100.0, greatest(0.0, p_szczescie::numeric));
  v_rotten_thresh    := greatest(0.05, 0.10 - v_luck_eff * 0.0005);
  v_epic_chance      := least(0.15,   0.04 + v_luck_eff * 0.0011);
  v_legendary_chance := least(0.06,   0.01 + v_luck_eff * 0.0005);
  v_good_chance      := 1.0 - v_rotten_thresh - v_epic_chance - v_legendary_chance;

  if v_actual_planted_q = 'rotten' then
    v_target_quality := 'rotten';
    v_base_yield     := 1 + floor(random() * 3)::integer;
    v_gained_rotten  := v_base_yield;

  elsif v_actual_planted_q = 'legendary' then
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

  v_compost_type       := v_plot -> 'compostBonus' ->> 'type';
  v_actual_compost_yld := case
    when v_compost_type = 'yield'
    then least(coalesce((v_plot -> 'compostBonus' ->> 'value')::integer, 0), 3)
    else 0
  end;
  if v_actual_compost_yld > 0 then
    v_gained_good := v_gained_good + v_actual_compost_yld;
  end if;

  if p_extra_harvest_pct > 0 and v_target_quality = 'good' and v_gained_good > 0 then
    for v_loop_i in 1..v_gained_good loop
      if random() < (p_extra_harvest_pct / 100.0) then
        v_extra_harvest_gain := v_extra_harvest_gain + 1;
      end if;
    end loop;
    v_gained_good := v_gained_good + v_extra_harvest_gain;
  end if;

  if p_bonus_drop_pct > 0 and v_target_quality = 'good' and v_gained_good > 0 then
    for v_loop_i in 1..v_gained_good loop
      if random() < (p_bonus_drop_pct / 100.0) then
        v_bonus_drop_upgrades := v_bonus_drop_upgrades + 1;
      end if;
    end loop;
    v_gained_good := v_gained_good - v_bonus_drop_upgrades;
    v_gained_epic := v_gained_epic + v_bonus_drop_upgrades;
  end if;

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

  v_plot_crops := v_plot_crops - (p_plot_id::text);

  IF p_exp_mult_override = -1 THEN
    v_exp_mult := 0;
  ELSIF p_exp_mult_override > 0 THEN
    v_exp_mult := p_exp_mult_override;
  ELSIF v_actual_planted_q = 'rotten' OR v_target_quality = 'rotten' THEN
    v_exp_mult := 0;
  ELSIF v_actual_planted_q = 'legendary' THEN
    v_legendary_exp_mult := 2;
    v_exp_mult := 2.0;
  ELSIF v_actual_planted_q = 'epic' THEN
    v_exp_mult := 1.5;
  ELSE
    v_exp_mult := 1.0;
  END IF;

  v_exp_gained := ROUND(
    v_crop.exp_reward * LEAST(v_exp_mult * (1.0 + p_exp_bonus_pct / 100.0), 4.0)
  );

  v_level      := v_profile.level;
  v_xp         := v_profile.xp + v_exp_gained;
  -- ── FIX: zawsze używaj funkcji game_xp_to_next_level zamiast stored value ──
  -- Stara linia: v_xp_to_next := v_profile.xp_to_next_level;
  -- Problem: stare konta mają xp_to_next_level=100 (stary DEFAULT kolumny),
  --          ale game_xp_to_next_level(1)=12 — SQL używał stale stored value
  --          i nigdy nie wchodził w pętlę level-up.
  v_xp_to_next := public.game_xp_to_next_level(v_level);

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
    'exp_gained',          v_exp_gained
  );
end;
$$;

-- ── Krok 3: game_start_tutorial — ustaw xp_to_next_level = 12 przy starcie ─
CREATE OR REPLACE FUNCTION public.game_start_tutorial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid    := auth.uid();
  v_profile profiles%rowtype;
  v_inv     jsonb;
  v_current integer;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF COALESCE(v_profile.tutorial_started,   false) = TRUE
  OR COALESCE(v_profile.tutorial_completed, false) = TRUE
  OR COALESCE(v_profile.tutorial_skipped,   false) = TRUE
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  v_inv     := COALESCE(v_profile.seed_inventory, '{}'::jsonb);
  v_current := COALESCE((v_inv->>'guide_compost')::integer, 0);
  v_inv     := jsonb_set(v_inv, '{guide_compost}', to_jsonb(v_current + 3));

  UPDATE profiles
  SET
    tutorial_started   = TRUE,
    tutorial_completed = FALSE,
    tutorial_skipped   = FALSE,
    tutorial_step      = 1,
    seed_inventory     = v_inv,
    -- FIX: ustaw poprawny próg XP przy starcie tutoriala
    xp_to_next_level   = public.game_xp_to_next_level(COALESCE(level, 1))
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'guide_compost_granted', 3);
END;
$$;

GRANT EXECUTE ON FUNCTION public.game_start_tutorial() TO authenticated;

-- ── Krok 4: Migracja istniejących kont ────────────────────────────────────
-- Naprawia konta, które mają niepoprawny xp_to_next_level (np. stary DEFAULT 100).
-- Dla kont z level=1 i xp >= 12 — przeprowadza zaległy level-up.

-- 4a. Napraw xp_to_next_level bez level-up (konta które NIE powinny awansować)
UPDATE public.profiles
SET xp_to_next_level = public.game_xp_to_next_level(COALESCE(level, 1))
WHERE
  level IS NOT NULL AND level BETWEEN 1 AND 49
  AND xp < public.game_xp_to_next_level(COALESCE(level, 1))
  AND xp_to_next_level != public.game_xp_to_next_level(COALESCE(level, 1));

-- 4b. Napraw konta z level=1 i xp >= 12 — przeprowadź zaległy level-up do level 2
--     (xp=18 po 3 marchewkach tutorialowych → powinno być level=2, xp=6)
UPDATE public.profiles
SET
  level            = 2,
  xp               = xp - public.game_xp_to_next_level(1),
  xp_to_next_level = public.game_xp_to_next_level(2),
  current_map      = public.game_map_for_level(2)
WHERE
  level = 1
  AND xp >= public.game_xp_to_next_level(1)  -- xp >= 12
  AND xp < public.game_xp_to_next_level(2);  -- ale < 150 (nie przeskakuj więcej niż 1 level)

-- ── Weryfikacja po wgraniu ─────────────────────────────────────────────────
-- SELECT id, level, xp, xp_to_next_level
-- FROM public.profiles
-- WHERE level = 1
-- ORDER BY created_at DESC
-- LIMIT 10;
-- Oczekiwane: xp_to_next_level = 12 dla wszystkich kont na poziomie 1
