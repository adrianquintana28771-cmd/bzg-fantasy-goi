ALTER TABLE public.jornadas ADD COLUMN player_availability_snapshot jsonb;
ALTER TABLE public.jornadas ADD COLUMN availability_captured_at timestamptz;
COMMENT ON COLUMN public.jornadas.player_availability_snapshot IS 'Immutable club_player_id -> player_estado snapshot taken at first final closure; NULL means no historical availability was captured.';

CREATE OR REPLACE FUNCTION public.capture_jornada_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.player_availability_snapshot IS NOT NULL THEN
    NEW.player_availability_snapshot := OLD.player_availability_snapshot;
    NEW.availability_captured_at := OLD.availability_captured_at;
  ELSIF NEW.is_locked AND NOT NEW.is_active AND (NOT OLD.is_locked OR OLD.is_active) THEN
    SELECT COALESCE(jsonb_object_agg(p.id::text, p.estado::text), '{}'::jsonb)
      INTO NEW.player_availability_snapshot FROM public.club_players p;
    NEW.availability_captured_at := clock_timestamp();
  ELSE
    NEW.player_availability_snapshot := NULL;
    NEW.availability_captured_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_jornada_availability() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_jornada_availability BEFORE UPDATE ON public.jornadas
FOR EACH ROW EXECUTE FUNCTION public.capture_jornada_availability();

CREATE OR REPLACE FUNCTION public.player_availability_history(_club_player_id uuid)
RETURNS TABLE(numero integer, estado public.player_estado)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT j.numero, (j.player_availability_snapshot ->> _club_player_id::text)::public.player_estado
  FROM public.jornadas j
  WHERE j.is_locked AND NOT j.is_active
    AND j.player_availability_snapshot ? _club_player_id::text
  ORDER BY j.numero;
$$;
REVOKE ALL ON FUNCTION public.player_availability_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_availability_history(uuid) TO anon, authenticated, service_role;