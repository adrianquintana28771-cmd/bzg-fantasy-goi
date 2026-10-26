CREATE TABLE public.prediccion_recompensas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  aciertos integer NOT NULL DEFAULT 0,
  cartas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, jornada_id)
);
GRANT SELECT ON public.prediccion_recompensas TO authenticated;
GRANT ALL ON public.prediccion_recompensas TO service_role;
ALTER TABLE public.prediccion_recompensas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recompensa propia" ON public.prediccion_recompensas FOR SELECT TO authenticated USING (auth.uid() = user_id);