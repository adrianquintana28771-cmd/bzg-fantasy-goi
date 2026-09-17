
CREATE TABLE public.player_jornada_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL REFERENCES public.player_pool(id) ON DELETE CASCADE,
  jornada_numero integer NOT NULL,
  puntos numeric NOT NULL DEFAULT 0,
  estado public.player_estado NOT NULL DEFAULT 'disponible',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, jornada_numero)
);

GRANT SELECT ON public.player_jornada_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_jornada_stats TO authenticated;
GRANT ALL ON public.player_jornada_stats TO service_role;

ALTER TABLE public.player_jornada_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_jornada_stats_public_read" ON public.player_jornada_stats
  FOR SELECT USING (true);

CREATE POLICY "player_jornada_stats_staff_write" ON public.player_jornada_stats
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER player_jornada_stats_updated_at BEFORE UPDATE ON public.player_jornada_stats
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.user_ranking()
RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH alineados AS (
    SELECT l.user_id, j.numero AS jornada_numero,
           unnest(array[l.portero,l.extremo_izq,l.extremo_der,l.lateral_izq,l.lateral_der,l.central,l.pivote]) AS player_id
    FROM public.lineups l
    JOIN public.jornadas j ON j.id = l.jornada_id
  ), pts AS (
    SELECT a.user_id, a.jornada_numero, coalesce(sum(s.puntos), 0) AS puntos
    FROM alineados a
    LEFT JOIN public.player_jornada_stats s
      ON s.player_id = a.player_id AND s.jornada_numero = a.jornada_numero
    WHERE a.player_id IS NOT NULL
    GROUP BY a.user_id, a.jornada_numero
  )
  SELECT p.id, p.username, p.display_name,
         coalesce(sum(pts.puntos), 0) AS puntos,
         count(pts.jornada_numero)::int AS jornadas
  FROM public.profiles p
  JOIN pts ON pts.user_id = p.id
  GROUP BY p.id, p.username, p.display_name
  ORDER BY 4 DESC
$$;

GRANT EXECUTE ON FUNCTION public.user_ranking() TO anon, authenticated;
