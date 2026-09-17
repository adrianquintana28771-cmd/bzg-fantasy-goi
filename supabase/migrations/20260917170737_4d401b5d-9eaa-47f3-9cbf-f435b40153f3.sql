CREATE TABLE public.player_pool_positions (
  player_id text NOT NULL REFERENCES public.player_pool(id) ON DELETE CASCADE,
  posicion public.plantilla_posicion NOT NULL,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, posicion)
);

GRANT SELECT ON public.player_pool_positions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_pool_positions TO authenticated;
GRANT ALL ON public.player_pool_positions TO service_role;

ALTER TABLE public.player_pool_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_pool_positions_public_read" ON public.player_pool_positions
  FOR SELECT USING (true);

CREATE POLICY "player_pool_positions_staff_write" ON public.player_pool_positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

INSERT INTO public.player_pool_positions (player_id, posicion, es_principal)
SELECT id, posicion, true FROM public.player_pool
ON CONFLICT DO NOTHING;

INSERT INTO public.player_pool_positions (player_id, posicion, es_principal)
SELECT id,
  CASE posicion
    WHEN 'extremo_izq' THEN 'extremo_der'::public.plantilla_posicion
    WHEN 'extremo_der' THEN 'extremo_izq'::public.plantilla_posicion
    WHEN 'lateral_izq' THEN 'lateral_der'::public.plantilla_posicion
    WHEN 'lateral_der' THEN 'lateral_izq'::public.plantilla_posicion
  END,
  false
FROM public.player_pool
WHERE posicion IN ('extremo_izq','extremo_der','lateral_izq','lateral_der')
ON CONFLICT DO NOTHING;

INSERT INTO public.player_pool_positions (player_id, posicion, es_principal)
SELECT id, 'central'::public.plantilla_posicion, false FROM public.player_pool
WHERE posicion IN ('lateral_izq','lateral_der')
ON CONFLICT DO NOTHING;