CREATE OR REPLACE FUNCTION public.user_ranking()
RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH lj AS (
    SELECT l.user_id, l.jornada_id FROM public.lineups l
    UNION SELECT f.user_id, f.jornada_id FROM public.jornada_alineaciones_congeladas f
  ), pts AS (
    SELECT e.user_id, SUM(s.puntos * CASE pp.rareza WHEN 'raro' THEN 1.3 WHEN 'legendario' THEN 1.5 ELSE 1 END) AS puntos
    FROM public.effective_lineup_players() e
    JOIN public.player_jornada_stats s ON s.jornada_numero = e.numero AND s.player_id = e.player_id
    JOIN public.player_pool pp ON pp.id = e.player_id
    GROUP BY e.user_id
  )
  SELECT p.id, p.username, p.display_name,
    ROUND(COALESCE(MAX(pts.puntos), 0), 2) AS puntos,
    COUNT(DISTINCT lj.jornada_id)::integer
  FROM public.profiles p
  LEFT JOIN lj ON lj.user_id = p.id
  LEFT JOIN pts ON pts.user_id = p.id
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','manager','super_admin'))
  GROUP BY p.id, p.username, p.display_name
  ORDER BY puntos DESC;
$function$;

CREATE OR REPLACE FUNCTION public.user_ranking_by_jornada()
RETURNS TABLE(user_id uuid, username text, display_name text, jornada integer, puntos numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH lj AS (
    SELECT l.user_id, l.jornada_id FROM public.lineups l
    UNION SELECT f.user_id, f.jornada_id FROM public.jornada_alineaciones_congeladas f
  )
  SELECT p.id, p.username, p.display_name, j.numero,
    ROUND(COALESCE((SELECT SUM(s.puntos * CASE pp.rareza WHEN 'raro' THEN 1.3 WHEN 'legendario' THEN 1.5 ELSE 1 END)
      FROM public.effective_lineup_players() e
      JOIN public.player_jornada_stats s ON s.jornada_numero = e.numero AND s.player_id = e.player_id
      JOIN public.player_pool pp ON pp.id = e.player_id
      WHERE e.user_id = p.id AND e.jornada_id = j.id), 0), 2)
  FROM public.profiles p
  JOIN lj ON lj.user_id = p.id
  JOIN public.jornadas j ON j.id = lj.jornada_id
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','manager','super_admin'));
$function$;