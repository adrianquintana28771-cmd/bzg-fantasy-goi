CREATE OR REPLACE FUNCTION public.ranking_user_lineup(_user_id uuid, _jornada integer DEFAULT NULL::integer)
 RETURNS TABLE(jornada integer, posicion plantilla_posicion, player_id text, nombre text, rareza card_rareza, puntos numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    -- Open lineups are secret: only closed jornadas, the owner, or super_admin.
    AND (j.is_locked OR auth.uid() = _user_id OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  )
  SELECT e.numero, e.posicion, e.player_id, pp.nombre, pp.rareza,
    ROUND(COALESCE(s.puntos,0) * CASE pp.rareza WHEN 'raro' THEN 1.3 WHEN 'legendario' THEN 1.5 ELSE 1 END,2)
  FROM selections e LEFT JOIN public.player_pool pp ON pp.id = e.player_id
  LEFT JOIN (SELECT player_id,jornada_numero,SUM(puntos) AS puntos FROM public.player_jornada_stats GROUP BY player_id,jornada_numero) s ON s.player_id = e.player_id AND s.jornada_numero = e.numero
  WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND lower(COALESCE(p.username,'')) <> 'lovable')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role IN ('admin','manager','super_admin','admin_misiones'))
  ORDER BY e.numero DESC,e.posicion;
$function$;
REVOKE EXECUTE ON FUNCTION public.ranking_user_lineup(uuid, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_user_lineup(uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dni_exists(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.dni_exists(text) TO service_role;

CREATE TABLE IF NOT EXISTS private.auth_attempts (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_bucket_time ON private.auth_attempts(bucket, created_at);
REVOKE ALL ON private.auth_attempts FROM PUBLIC, anon, authenticated;

-- Returns true when the bucket is under the limit and records the attempt.
CREATE OR REPLACE FUNCTION public.auth_rate_check(_bucket text, _max integer, _window_seconds integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'private', 'public'
AS $function$
DECLARE n integer;
BEGIN
  DELETE FROM private.auth_attempts WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO n FROM private.auth_attempts WHERE bucket = _bucket AND created_at > now() - make_interval(secs => _window_seconds);
  IF n >= _max THEN RETURN false; END IF;
  INSERT INTO private.auth_attempts(bucket) VALUES (_bucket);
  RETURN true;
END $function$;
CREATE OR REPLACE FUNCTION public.auth_rate_clear(_bucket text)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'private', 'public'
AS $function$ DELETE FROM private.auth_attempts WHERE bucket = _bucket $function$;
REVOKE EXECUTE ON FUNCTION public.auth_rate_check(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_rate_clear(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_check(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_rate_clear(text) TO service_role;