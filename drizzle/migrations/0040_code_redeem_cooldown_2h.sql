CREATE OR REPLACE FUNCTION private.claim_qr(_codigo text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); m record; nuevo_saldo int; ultimo timestamptz; falta int;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
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
 IF ultimo IS NOT NULL AND ultimo + interval '2 hours' > now() THEN
   falta := ceil(extract(epoch FROM (ultimo + interval '2 hours' - now())))::int;
   RAISE EXCEPTION 'espera_codigo:%', falta;
 END IF;
 INSERT INTO public.user_misiones(user_id,mision_id) VALUES(uid,m.id);
 INSERT INTO public.user_wallet(user_id) VALUES(uid) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.user_wallet SET sobres_premium = sobres_premium + m.recompensa_sobres WHERE user_id = uid;
 SELECT sobres_premium INTO nuevo_saldo FROM public.user_wallet WHERE user_id = uid;
 RETURN nuevo_saldo;
END;
$function$;