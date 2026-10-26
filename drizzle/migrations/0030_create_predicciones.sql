CREATE TABLE public.predicciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id),
  portero uuid REFERENCES public.club_players(id),
  extremo_izq uuid REFERENCES public.club_players(id),
  extremo_der uuid REFERENCES public.club_players(id),
  lateral_izq uuid REFERENCES public.club_players(id),
  lateral_der uuid REFERENCES public.club_players(id),
  central uuid REFERENCES public.club_players(id),
  pivote uuid REFERENCES public.club_players(id),
  entrenador uuid REFERENCES public.club_players(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, jornada_id)
);
GRANT SELECT, INSERT, UPDATE ON public.predicciones TO authenticated;
GRANT ALL ON public.predicciones TO service_role;
ALTER TABLE public.predicciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own predicciones select" ON public.predicciones FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "own predicciones insert" ON public.predicciones FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own predicciones update" ON public.predicciones FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_prediccion_open()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM jornadas WHERE id = NEW.jornada_id AND is_locked) THEN
    RAISE EXCEPTION 'Jornada cerrada';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.jornada_id <> OLD.jornada_id THEN
    RAISE EXCEPTION 'No se puede cambiar la jornada';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER predicciones_open BEFORE INSERT OR UPDATE ON public.predicciones
FOR EACH ROW EXECUTE FUNCTION public.tg_prediccion_open();