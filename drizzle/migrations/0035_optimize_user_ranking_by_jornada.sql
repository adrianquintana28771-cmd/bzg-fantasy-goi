CREATE OR REPLACE FUNCTION private.user_ranking_by_jornada()
RETURNS TABLE(user_id uuid, username text, display_name text, jornada integer, puntos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH lj AS (
    SELECT l.user_id, l.jornada_id FROM public.lineups l
    UNION SELECT f.user_id, f.jornada_id FROM public.jornada_alineaciones_congeladas f
  ), pts AS (
    SELECT e.user_id, e.jornada_id,
      SUM(s.puntos * CASE pp.rareza WHEN 'raro' THEN 1.3 WHEN 'legendario' THEN 1.5 ELSE 1 END) AS puntos
    FROM public.effective_lineup_players() e
    JOIN public.player_jornada_stats s ON s.jornada_numero = e.numero AND s.player_id = e.player_id
    JOIN public.player_pool pp ON pp.id = e.player_id
    GROUP BY e.user_id, e.jornada_id
  )
  SELECT p.id, p.username, p.display_name, j.numero, ROUND(COALESCE(pts.puntos, 0), 2)
  FROM public.profiles p
  JOIN lj ON lj.user_id = p.id
  JOIN public.jornadas j ON j.id = lj.jornada_id
  LEFT JOIN pts ON pts.user_id = p.id AND pts.jornada_id = lj.jornada_id
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','manager','super_admin','admin_misiones'));
$$;
CREATE INDEX IF NOT EXISTS idx_cma_action ON public.club_match_actions (action_id);
CREATE INDEX IF NOT EXISTS idx_cma_player ON public.club_match_actions (player_id);
CREATE INDEX IF NOT EXISTS idx_jac_user ON public.jornada_alineaciones_congeladas (user_id);