
DROP FUNCTION IF EXISTS public.open_sobre();

CREATE OR REPLACE FUNCTION public.open_sobre()
RETURNS TABLE(p_id text, p_nombre text, p_posicion public.plantilla_posicion, p_rating int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  saldo int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.user_wallet(user_id) VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sobres INTO saldo FROM public.user_wallet WHERE user_id = uid FOR UPDATE;
  IF saldo IS NULL OR saldo <= 0 THEN
    RAISE EXCEPTION 'sin sobres disponibles';
  END IF;

  UPDATE public.user_wallet SET sobres = sobres - 1 WHERE user_id = uid;

  RETURN QUERY
  WITH nuevos AS (
    SELECT pp.id, pp.nombre, pp.posicion, pp.rating
    FROM public.player_pool pp
    WHERE pp.id NOT IN (SELECT up.player_id FROM public.user_players up WHERE up.user_id = uid)
    ORDER BY random()
    LIMIT 3
  ), ins AS (
    INSERT INTO public.user_players(user_id, player_id)
    SELECT uid, n.id FROM nuevos n
    RETURNING user_players.player_id
  )
  SELECT n.id, n.nombre, n.posicion, n.rating FROM nuevos n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_sobre() TO authenticated;
