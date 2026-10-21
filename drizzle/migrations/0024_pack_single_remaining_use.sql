DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('private.open_sobre(text)'::regprocedure) INTO definition;
  IF position('insert into public.user_players(user_id, player_id) values (uid, chosen.id);' IN definition) = 0 THEN
    RAISE EXCEPTION 'Pack acquisition statement differs; refusing to change unrelated pack logic';
  END IF;
  EXECUTE replace(definition,
    'insert into public.user_players(user_id, player_id) values (uid, chosen.id);',
    'insert into public.user_players(user_id, player_id, usos) values (uid, chosen.id, 2);');
END;
$$;