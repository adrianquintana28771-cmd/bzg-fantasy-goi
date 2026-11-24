-- Isolated database test: run against a disposable database, never production.
BEGIN;
INSERT INTO public.club_players (id, estado) VALUES
  ('00000000-0000-0000-0000-000000000001', 'no_disponible'),
  ('00000000-0000-0000-0000-000000000002', 'dudoso');
INSERT INTO public.jornadas (numero, is_active, is_locked) VALUES (1, true, false);

-- A temporary selection lock must not capture availability.
UPDATE public.jornadas SET is_locked = true WHERE numero = 1;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.jornadas WHERE numero = 1 AND player_availability_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'Selection lock captured availability too early';
  END IF;
END $$;

-- Final closure captures both statuses, even without any performance rows.
UPDATE public.jornadas SET is_active = false WHERE numero = 1;
DO $$ BEGIN
  IF (SELECT estado FROM public.player_availability_history('00000000-0000-0000-0000-000000000001')) IS DISTINCT FROM 'no_disponible'::public.player_estado THEN
    RAISE EXCEPTION 'Closure failed to capture unavailable player';
  END IF;
  IF (SELECT estado FROM public.player_availability_history('00000000-0000-0000-0000-000000000002')) IS DISTINCT FROM 'dudoso'::public.player_estado THEN
    RAISE EXCEPTION 'Closure failed to capture doubtful player';
  END IF;
END $$;

UPDATE public.club_players SET estado = 'disponible';
UPDATE public.jornadas SET player_availability_snapshot = '{}'::jsonb, availability_captured_at = NULL WHERE numero = 1;
DO $$ BEGIN
  IF (SELECT estado FROM public.player_availability_history('00000000-0000-0000-0000-000000000001')) IS DISTINCT FROM 'no_disponible'::public.player_estado
     OR (SELECT availability_captured_at FROM public.jornadas WHERE numero = 1) IS NULL THEN
    RAISE EXCEPTION 'Later updates changed the historical snapshot';
  END IF;
END $$;

-- Pre-existing closed jornadas stay unknown, including after ordinary edits.
INSERT INTO public.jornadas (numero, is_active, is_locked) VALUES (2, false, true);
UPDATE public.jornadas SET numero = 2 WHERE numero = 2;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.jornadas WHERE numero = 2 AND player_availability_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'Invented history for an already closed jornada';
  END IF;
END $$;
ROLLBACK;