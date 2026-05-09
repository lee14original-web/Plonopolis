-- ============================================================
-- PATCH: Zmiana limitu p_plot_id z 25 → 100 w funkcjach sadzenia i zbioru
-- Wklej do Supabase SQL Editor i wykonaj PO sql_plots_100.sql
-- ============================================================

-- ─── game_plant_crop: limit 25 → 100 ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.game_plant_crop(integer, text);
DROP FUNCTION IF EXISTS public.game_plant_crop(integer, text, text);
DROP FUNCTION IF EXISTS public.game_plant_crop(integer, text, text, text);

CREATE OR REPLACE FUNCTION public.game_plant_crop(
  p_plot_id          integer,
  p_crop_id          text,
  p_seed_key         text DEFAULT NULL,
  p_planted_quality  text DEFAULT 'good'
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_profile          public.profiles%rowtype;
  v_crop             public.crop_config%rowtype;
  v_plot             jsonb;
  v_existing_compost jsonb;
  v_seed_amount      integer;
  v_now_ms           bigint;
  v_plot_crops       jsonb;
  v_seed_inventory   jsonb;
  v_is_unlocked      boolean;
  v_seed_lookup_key  text;
  v_quality          text;
begin
  if auth.uid() is null then
    raise exception 'Brak autoryzacji';
  end if;

  if p_plot_id < 1 or p_plot_id > 100 then
    raise exception 'Nieprawidłowe pole';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profil nie istnieje'; end if;

  select exists (
    select 1 from jsonb_array_elements(public.normalize_unlocked_plots(v_profile.unlocked_plots)) as elem
    where (elem::text)::integer = p_plot_id
  ) into v_is_unlocked;

  if not v_is_unlocked then
    raise exception 'To pole nie jest odblokowane';
  end if;

  select * into v_crop from public.crop_config where id = p_crop_id;
  if not found then raise exception 'Nieznana uprawa'; end if;

  if v_profile.level < v_crop.unlock_level then
    raise exception 'Ta uprawa nie jest jeszcze odblokowana';
  end if;

  v_plot_crops     := coalesce(v_profile.plot_crops, '{}'::jsonb);
  v_seed_inventory := coalesce(v_profile.seed_inventory, '{}'::jsonb);

  v_plot := v_plot_crops -> (p_plot_id::text);

  if v_plot is not null and coalesce(v_plot ->> 'cropId', '') <> '' then
    raise exception 'Na tym polu już coś rośnie';
  end if;

  v_existing_compost := v_plot -> 'compostBonus';

  v_seed_lookup_key := coalesce(nullif(p_seed_key, ''), p_crop_id);
  v_seed_amount := coalesce((v_seed_inventory ->> v_seed_lookup_key)::integer, 0);

  if v_seed_amount <= 0 then
    raise exception 'Brak nasion';
  end if;

  v_quality := coalesce(nullif(p_planted_quality, ''), 'good');
  if v_quality not in ('good', 'epic', 'legendary', 'rotten') then
    v_quality := 'good';
  end if;
  if v_quality = 'rotten' then
    raise exception 'Zepsute nasiono nie nadaje się do sadzenia';
  end if;

  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000);

  v_plot_crops := jsonb_set(
    v_plot_crops,
    array[p_plot_id::text],
    jsonb_build_object(
      'cropId',         p_crop_id,
      'plantedAt',      v_now_ms,
      'watered',        false,
      'plantedQuality', v_quality,
      'compostBonus',   coalesce(v_existing_compost, 'null'::jsonb)
    ),
    true
  );

  if v_seed_amount - 1 <= 0 then
    v_seed_inventory := v_seed_inventory - v_seed_lookup_key;
  else
    v_seed_inventory := jsonb_set(
      v_seed_inventory,
      array[v_seed_lookup_key],
      to_jsonb(v_seed_amount - 1),
      true
    );
  end if;

  update public.profiles set
    plot_crops     = v_plot_crops,
    seed_inventory = v_seed_inventory,
    last_played_at = now()
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$function$;

-- ─── game_harvest_plot: limit 25 → 100 ────────────────────────────────────
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, numeric);
DROP FUNCTION IF EXISTS public.game_harvest_plot(integer, bigint, integer, text);
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

  v_good_key   := v_crop.id || '_good';
  v_epic_key   := v_crop.id || '_epic';
  v_rotten_key := v_crop.id || '_rotten';
  v_legacy_key := v_crop.id;

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

  if v_actual_planted_q = 'rotten' then
    v_target_quality := 'rotten';
  elsif v_actual_planted_q = 'epic' then
    v_target_quality := 'epic';
  else
    v_target_quality := 'good';
  end if;

  v_gained_good   := case when v_target_quality = 'good'   then v_crop.yield_amount else 0 end;
  v_gained_epic   := case when v_target_quality = 'epic'   then v_crop.yield_amount else 0 end;
  v_gained_rotten := case when v_target_quality = 'rotten' then v_crop.yield_amount else 0 end;

  v_zrecznosc_eff    := case when p_zrecznosc <= 50
    then p_zrecznosc::numeric
    else 50.0 + (p_zrecznosc - 50) * 0.5
  end;
  v_zrecznosc_chance := round(v_zrecznosc_eff * 0.004 * 1000) / 10 / 100;

  if p_zrecznosc > 0 and random() < v_zrecznosc_chance then
    v_zrecznosc_triggered := true;
    if v_target_quality = 'good' then
      v_gained_good := v_gained_good + v_crop.yield_amount;
    elsif v_target_quality = 'epic' then
      v_gained_epic := v_gained_epic + v_crop.yield_amount;
    else
      v_gained_rotten := v_gained_rotten + v_crop.yield_amount;
    end if;
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

  v_plot_crops := v_plot_crops - (p_plot_id::text);

  IF p_exp_mult_override = -1 THEN
    v_exp_mult := 0;
  ELSIF p_exp_mult_override > 0 THEN
    v_exp_mult := p_exp_mult_override;
  ELSIF v_actual_planted_q = 'rotten' THEN
    v_exp_mult := 0;
  ELSIF v_actual_planted_q = 'epic' THEN
    v_exp_mult := 3 + floor(random() * 4);
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
    'profile',              row_to_json(v_profile),
    'zrecznosc_triggered',  v_zrecznosc_triggered,
    'gained_good',          v_gained_good,
    'gained_epic',          v_gained_epic,
    'gained_rotten',        v_gained_rotten,
    'extra_harvest_gain',   v_extra_harvest_gain,
    'bonus_drop_upgrades',  v_bonus_drop_upgrades
  );
end;
$$;
