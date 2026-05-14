-- POPRAWKA: losowanie jakości każdej sztuki plonu po stronie SQL (server-side)
-- Eliminuje możliwość manipulacji dropem przez gracza.
-- Nowy format zwracany: { "profile": {...}, "zrecznosc_triggered": true/false }

CREATE OR REPLACE FUNCTION public.game_harvest_plot(
  p_plot_id            integer,
  p_effective_grow_ms  bigint  DEFAULT NULL::bigint,
  p_zrecznosc          integer DEFAULT 0,
  p_planted_quality    text    DEFAULT 'good'::text,
  p_exp_mult_override  integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_profile              public.profiles%rowtype;
  v_plot                 jsonb;
  v_crop                 public.crop_config%rowtype;
  v_planted_at_ms        bigint;
  v_effective_growth_ms  bigint;
  v_now_ms               bigint;
  v_plot_crops           jsonb;
  v_seed_inventory       jsonb;
  v_level                integer;
  v_xp                   bigint;
  v_xp_to_next           bigint;
  v_zrecznosc_eff        numeric;
  v_zrecznosc_chance     numeric;
  v_exp_mult             numeric;
  -- Per-item quality rolling
  v_loop_i               integer;
  v_item_roll            numeric;
  v_item_quality         text;
  v_total_base_items     integer;
  v_zrecznosc_triggered  boolean := false;
begin
  if auth.uid() is null then raise exception 'Brak autoryzacji'; end if;
  if p_plot_id < 1 or p_plot_id > 25 then raise exception 'Nieprawidłowe pole'; end if;

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

  -- Czas wzrostu: bazowy; frontend przekazuje p_effective_grow_ms z bonusami statystyk
  v_effective_growth_ms := v_crop.growth_time_ms;
  if p_effective_grow_ms is not null and p_effective_grow_ms < v_effective_growth_ms then
    v_effective_growth_ms := p_effective_grow_ms;
  end if;

  if (v_now_ms - v_planted_at_ms) < v_effective_growth_ms then
    raise exception 'Uprawa jeszcze nie dojrzała';
  end if;

  -- ─── Losowanie jakości per sztuka (server-side) ───────────────────────────
  -- Tylko dla nie-legendarnych nasion (legenda ma osobną logikę w frontendzie)
  if p_planted_quality <> 'legendary' then

    -- Ile sztuk bazowych?
    if p_planted_quality = 'epic' then
      v_total_base_items := 8 + floor(random() * 13)::integer;  -- 8–20
    else
      v_total_base_items := v_crop.yield_amount;
    end if;

    -- Losuj jakość dla każdej sztuki bazowej
    -- Epickie nasiono: 5% popsuta / 55% zwykła / 35% epicka / 5% legendarna
    -- Zwykłe nasiono:  15% popsuta / 79% zwykła /  5% epicka / 1%  legendarna
    for v_loop_i in 1..v_total_base_items loop
      v_item_roll := random();
      if p_planted_quality = 'epic' then
        -- 0% popsuta / 87% zwykla / 10% epicka / 3% legendarna
        if    v_item_roll < 0.87 then v_item_quality := 'good';
        elsif v_item_roll < 0.97 then v_item_quality := 'epic';

        else                          v_item_quality := 'legendary';
        end if;
      else
        if    v_item_roll < 0.15 then v_item_quality := 'rotten';
        elsif v_item_roll < 0.94 then v_item_quality := 'good';
        elsif v_item_roll < 0.99 then v_item_quality := 'epic';
        else                          v_item_quality := 'legendary';
        end if;
      end if;
      v_seed_inventory := jsonb_set(
        v_seed_inventory,
        array[v_crop.id || '_' || v_item_quality],
        to_jsonb(coalesce((v_seed_inventory ->> (v_crop.id || '_' || v_item_quality))::integer, 0) + 1),
        true
      );
    end loop;

    -- Zręczność: szansa na bonus (kolejne yield_amount sztuk, każda osobno losowana)
    v_zrecznosc_eff    := case when p_zrecznosc <= 50
      then p_zrecznosc::numeric
      else 50.0 + (p_zrecznosc - 50) * 0.5
    end;
    v_zrecznosc_chance := round(v_zrecznosc_eff * 0.004 * 1000) / 10 / 100;

    if p_zrecznosc > 0 and random() < v_zrecznosc_chance then
      v_zrecznosc_triggered := true;
      for v_loop_i in 1..v_crop.yield_amount loop
        v_item_roll := random();
        if p_planted_quality = 'epic' then
          -- 0% popsuta / 87% zwykla / 10% epicka / 3% legendarna
        if    v_item_roll < 0.87 then v_item_quality := 'good';
          elsif v_item_roll < 0.97 then v_item_quality := 'epic';
  
          else                          v_item_quality := 'legendary';
          end if;
        else
          if    v_item_roll < 0.15 then v_item_quality := 'rotten';
          elsif v_item_roll < 0.94 then v_item_quality := 'good';
          elsif v_item_roll < 0.99 then v_item_quality := 'epic';
          else                          v_item_quality := 'legendary';
          end if;
        end if;
        v_seed_inventory := jsonb_set(
          v_seed_inventory,
          array[v_crop.id || '_' || v_item_quality],
          to_jsonb(coalesce((v_seed_inventory ->> (v_crop.id || '_' || v_item_quality))::integer, 0) + 1),
          true
        );
      end loop;
    end if;

  end if;
  -- ─────────────────────────────────────────────────────────────────────────

  v_plot_crops := v_plot_crops - (p_plot_id::text);
  v_level := v_profile.level;

  IF p_exp_mult_override > 0 THEN
    v_exp_mult := p_exp_mult_override;       -- dokładny mnożnik (leg. opcja EXP, epicki)
  ELSIF p_exp_mult_override < 0 THEN
    v_exp_mult := 0;                         -- wymuś 0 EXP (leg. opcja 0/1 — tylko plony)
  ELSIF p_planted_quality = 'rotten' THEN
    v_exp_mult := 0;
  ELSIF p_planted_quality = 'epic' THEN
    v_exp_mult := 3 + floor(random() * 4);
  ELSE
    v_exp_mult := 1;
  END IF;

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

  -- Nowy format zwrotny: { "profile": {...}, "zrecznosc_triggered": bool }
  return json_build_object(
    'profile',             row_to_json(v_profile),
    'zrecznosc_triggered', v_zrecznosc_triggered
  );
end;
$function$
