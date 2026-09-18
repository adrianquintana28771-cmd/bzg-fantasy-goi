CREATE OR REPLACE FUNCTION public.user_ranking()
 RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS user_id,
    p.username,
    p.display_name,
    ROUND(COALESCE(SUM(s.puntos), 0), 2) AS puntos,
    COUNT(DISTINCT l.jornada_id)::integer AS jornadas
  FROM public.profiles p
  LEFT JOIN public.lineups l ON l.user_id = p.id
  LEFT JOIN public.jornadas j ON j.id = l.jornada_id
  LEFT JOIN public.player_jornada_stats s ON s.jornada_numero = j.numero
    AND s.player_id IN (l.portero, l.extremo_izq, l.extremo_der, l.lateral_izq, l.lateral_der, l.central, l.pivote, l.entrenador)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role IN ('admin','manager','super_admin')
  )
  GROUP BY p.id, p.username, p.display_name
  ORDER BY puntos DESC;
$function$;