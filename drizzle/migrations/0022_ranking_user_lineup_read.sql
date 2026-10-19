CREATE OR REPLACE FUNCTION public.ranking_user_lineup(_user_id uuid, _jornada integer DEFAULT NULL)
RETURNS TABLE(jornada integer, posicion public.plantilla_posicion, player_id text, nombre text, rareza public.card_rareza, puntos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH selections AS (
    SELECT j.numero, f.posicion, f.player_id
    FROM public.jornada_alineaciones_congeladas f JOIN public.jornadas j ON j.id = f.jornada_id
    WHERE f.user_id = _user_id AND (_jornada IS NULL OR j.numero = _jornada)
    UNION ALL
    SELECT j.numero, v.pos::public.plantilla_posicion, v.pid
    FROM public.lineups l JOIN public.jornadas j ON j.id = l.jornada_id
    CROSS JOIN LATERAL (VALUES ('portero',l.portero),('extremo_izq',l.extremo_izq),('extremo_der',l.extremo_der),('lateral_izq',l.lateral_izq),('lateral_der',l.lateral_der),('central',l.central),('pivote',l.pivote),('entrenador',l.entrenador)) v(pos,pid)
    WHERE l.user_id = _user_id AND (_jornada IS NULL OR j.numero = _jornada)
    AND NOT EXISTS (SELECT 1 FROM public.jornada_alineaciones_congeladas f WHERE f.jornada_id = l.jornada_id)
  )
  SELECT e.numero, e.posicion, e.player_id, pp.nombre, pp.rareza,
    ROUND(COALESCE(s.puntos,0) * CASE pp.rareza WHEN 'raro' THEN 1.3 WHEN 'legendario' THEN 1.5 ELSE 1 END,2)
  FROM selections e LEFT JOIN public.player_pool pp ON pp.id = e.player_id
  LEFT JOIN (SELECT player_id,jornada_numero,SUM(puntos) AS puntos FROM public.player_jornada_stats GROUP BY player_id,jornada_numero) s ON s.player_id = e.player_id AND s.jornada_numero = e.numero
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id)
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role IN ('admin','manager','super_admin'))
  ORDER BY e.numero DESC,e.posicion;
$$;
REVOKE ALL ON FUNCTION public.ranking_user_lineup(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_user_lineup(uuid,integer) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.ranking_user_lineup(uuid,integer) IS 'Read-only public ranking detail: only effective player selections and scores for accounts included in the public ranking. Frozen selections take precedence; no account/profile data exposed.';