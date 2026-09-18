CREATE OR REPLACE FUNCTION public.user_ranking()
RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.user_id,
    p.username,
    p.display_name,
    ROUND(COALESCE(SUM(s.puntos), 0), 2) AS puntos,
    COUNT(DISTINCT l.jornada_id)::integer AS jornadas
  FROM public.lineups l
  JOIN public.profiles p ON p.id = l.user_id
  LEFT JOIN public.jornadas j ON j.id = l.jornada_id
  LEFT JOIN public.player_jornada_stats s ON s.jornada_numero = j.numero
    AND s.player_id IN (l.portero, l.extremo_izq, l.extremo_der, l.lateral_izq, l.lateral_der, l.central, l.pivote, l.entrenador)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = l.user_id
  )
  GROUP BY l.user_id, p.username, p.display_name
  ORDER BY puntos DESC;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.player_jornada_stats;