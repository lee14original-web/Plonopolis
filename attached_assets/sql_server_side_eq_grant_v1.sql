-- Serwerowa funkcja przyznawania przedmiotów ekwipunku (batch)
-- Gracz NIE może nadpisać własności przedmiotów po stronie klienta.
-- Tylko ten RPC może dodawać przedmioty do owned_eq_items i extra_eq_items.

CREATE OR REPLACE FUNCTION game_grant_eq_items(p_item_ids text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid     uuid   := auth.uid();
  v_owned   jsonb;
  v_extra   jsonb;
  v_item_id text;
  v_new_uid text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT owned_eq_items, extra_eq_items
  INTO   v_owned, v_extra
  FROM   profiles
  WHERE  id = v_uid;

  v_owned := COALESCE(v_owned, '{}'::jsonb);
  v_extra := COALESCE(v_extra, '[]'::jsonb);

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    CONTINUE WHEN v_item_id IS NULL OR length(trim(v_item_id)) = 0;

    IF v_owned ? v_item_id THEN
      -- Gracz już posiada → duplikat
      v_new_uid := to_hex(extract(epoch from now())::bigint)
                   || '_' || substr(md5(random()::text || v_item_id), 1, 8);
      v_extra := v_extra || jsonb_build_array(
        jsonb_build_object('uid', v_new_uid, 'id', v_item_id, 'upg', 0)
      );
    ELSE
      -- Nowy przedmiot
      v_owned := v_owned || jsonb_build_object(v_item_id, true);
    END IF;
  END LOOP;

  UPDATE profiles
  SET    owned_eq_items = v_owned,
         extra_eq_items = v_extra
  WHERE  id = v_uid;

  RETURN json_build_object(
    'owned_eq_items', v_owned,
    'extra_eq_items', v_extra
  );
END;
$$;
