CREATE OR REPLACE FUNCTION private.claim_qr(_codigo text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); m record; nuevo_saldo int; ultimo timestamptz; falta int;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role IN ('admin','manager','super_admin','admin_misiones')) THEN RAISE EXCEPTION 'no permitido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('claim_qr:' || uid::text));
 SELECT id,recompensa_sobres,caduca_at,activa_desde INTO m FROM public.misiones
 WHERE is_active AND codigo_qr IS NOT NULL AND lower(codigo_qr) = lower(trim(_codigo))
 ORDER BY private.mission_code_available(activa_desde,caduca_at,now()) DESC, created_at DESC LIMIT 1;
 IF m IS NULL THEN RAISE EXCEPTION 'código no válido'; END IF;
 IF m.activa_desde IS NOT NULL AND m.activa_desde > now() THEN RAISE EXCEPTION 'código aún no activo'; END IF;
 IF NOT private.mission_code_available(m.activa_desde,m.caduca_at,now()) THEN RAISE EXCEPTION 'código caducado'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_misiones WHERE user_id = uid AND mision_id = m.id) THEN RAISE EXCEPTION 'ya has canjeado este código'; END IF;
 SELECT max(um.claimed_at) INTO ultimo FROM public.user_misiones um
   JOIN public.misiones mm ON mm.id = um.mision_id
   WHERE um.user_id = uid AND mm.codigo_qr IS NOT NULL;
 IF ultimo IS NOT NULL AND ultimo + interval '1 hour' > now() THEN
   falta := ceil(extract(epoch FROM (ultimo + interval '1 hour' - now())))::int;
   RAISE EXCEPTION 'espera_codigo:%', falta;
 END IF;
 INSERT INTO public.user_misiones(user_id,mision_id) VALUES(uid,m.id);
 INSERT INTO public.user_wallet(user_id) VALUES(uid) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.user_wallet SET sobres_premium = sobres_premium + m.recompensa_sobres WHERE user_id = uid;
 SELECT sobres_premium INTO nuevo_saldo FROM public.user_wallet WHERE user_id = uid;
 RETURN nuevo_saldo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_ranking_fichas()
 RETURNS TABLE(user_id uuid, jornada integer, fichas integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.user_id, e.numero, COUNT(*)::integer
  FROM public.effective_lineup_players() e
  JOIN public.profiles p ON p.id = e.user_id
  JOIN public.jornadas j ON j.numero = e.numero AND j.is_locked AND NOT j.is_active
  WHERE auth.uid() IS NOT NULL
    AND lower(COALESCE(p.username,'')) <> 'lovable'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = e.user_id AND ur.role IN ('admin','manager','super_admin','admin_misiones'))
  GROUP BY e.user_id, e.numero
$function$;
REVOKE EXECUTE ON FUNCTION public.user_ranking_fichas() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_ranking_fichas() TO authenticated;