-- ============================================================
-- POPRAWKA: game_plant_crop — zachowanie compostBonus i plantedQuality
-- Wklej do Supabase SQL Editor i wykonaj
--
-- BUG: stara wersja całkowicie nadpisywała pole obiektem
-- {cropId, plantedAt, watered}, niszcząc istniejący compostBonus
-- (wcześniej nałożony przez gracza na puste pole).
--
-- POPRAWKA:
--   1. Wyciąga istniejący compostBonus z pola przed sadzeniem
--   2. Akceptuje p_planted_quality (potrzebne do EXP przy zbiorze)
--   3. Buduje nowy obiekt z zachowanym compostBonus i plantedQuality
-- ============================================================

-- Usuń stare wersje (jeśli istnieją różne sygnatury):
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

  if p_plot_id < 1 or p_plot_id > 25 then
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

  -- ── KLUCZOWA POPRAWKA: zachowaj istniejący compostBonus z pola ────────────
  v_existing_compost := v_plot -> 'compostBonus';

  -- Klucz nasiona w inwentarzu: użyj p_seed_key (np. carrot_legendary), albo p_crop_id (legacy)
  v_seed_lookup_key := coalesce(nullif(p_seed_key, ''), p_crop_id);
  v_seed_amount := coalesce((v_seed_inventory ->> v_seed_lookup_key)::integer, 0);

  if v_seed_amount <= 0 then
    raise exception 'Brak nasion';
  end if;

  -- Walidacja jakości
  v_quality := coalesce(nullif(p_planted_quality, ''), 'good');
  if v_quality not in ('good', 'epic', 'legendary', 'rotten') then
    v_quality := 'good';
  end if;
  if v_quality = 'rotten' then
    raise exception 'Zepsute nasiono nie nadaje się do sadzenia';
  end if;

  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000);

  -- Buduj nowy obiekt pola — z zachowaniem compostBonus i plantedQuality
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
