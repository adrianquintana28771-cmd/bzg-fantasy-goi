CREATE OR REPLACE FUNCTION public.user_ranking()
RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
LANGUAGE sql STABLE SET search_path TO public
AS $$ SELECT * FROM private.user_ranking() r WHERE lower(COALESCE(r.username,'')) <> 'lovable' $$;
CREATE OR REPLACE FUNCTION public.user_ranking_by_jornada()
RETURNS TABLE(user_id uuid, username text, display_name text, jornada integer, puntos numeric)
LANGUAGE sql STABLE SET search_path TO public
AS $$ SELECT * FROM private.user_ranking_by_jornada() r WHERE lower(COALESCE(r.username,'')) <> 'lovable' $$;
CREATE POLICY "Test profile visible only to itself" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (lower(COALESCE(username,'')) <> 'lovable' OR id = auth.uid());
CREATE OR REPLACE FUNCTION public.ranking_user_lineup(_user_id uuid, _jornada integer DEFAULT NULL::integer)
RETURNS TABLE(jornada integer, posicion plantilla_posicion, player_id text, nombre text, rareza card_rareza, puntos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public
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
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND lower(COALESCE(p.username,'')) <> 'lovable')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role IN ('admin','manager','super_admin','admin_misiones'))
  ORDER BY e.numero DESC,e.posicion;
$$;