-- Read-only regression checks against recorded performance. Every row must pass.
WITH recorded AS (
  SELECT pp.id AS player_id, m.jornada,
         round(sum(a.cantidad * t.puntos), 2) AS puntos
  FROM public.player_pool pp
  JOIN public.club_players cp ON cp.id = pp.club_player_id AND cp.es_entrenador
  JOIN public.club_match_actions a ON a.player_id = cp.id
  JOIN public.club_matches m ON m.id = a.match_id
  JOIN public.club_action_types t ON t.id = a.action_id AND t.activo
  GROUP BY pp.id, m.jornada
)
SELECT 'Eneko coach J3 has no automatic 5 points' AS test,
       count(*) = 3 AND bool_and(s.puntos = 0) AS passed
FROM public.player_jornada_stats s
JOIN public.player_pool pp ON pp.id = s.player_id
WHERE pp.club_player_id = '94e2ef8b-fc33-48b9-b679-84364caa2b1d' AND s.jornada_numero = 3
UNION ALL
SELECT 'Eneko recorded J1 defeat remains -2', count(*) = 3 AND bool_and(s.puntos = -2)
FROM public.player_jornada_stats s
JOIN public.player_pool pp ON pp.id = s.player_id
WHERE pp.club_player_id = '94e2ef8b-fc33-48b9-b679-84364caa2b1d' AND s.jornada_numero = 1
UNION ALL
SELECT 'Every coach jornada equals recorded actions only',
       count(*) > 0 AND bool_and(s.puntos = CASE WHEN s.estado = 'no_disponible' THEN 0 ELSE coalesce(r.puntos, 0) END)
FROM public.player_jornada_stats s
JOIN public.player_pool pp ON pp.id = s.player_id
JOIN public.club_players cp ON cp.id = pp.club_player_id AND cp.es_entrenador
LEFT JOIN recorded r ON r.player_id = s.player_id AND r.jornada = s.jornada_numero;