CREATE OR REPLACE FUNCTION private.ensure_weekend_codes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := (now() AT TIME ZONE 'Europe/Madrid')::date; dd date; s timestamptz; c text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('ensure_weekend_codes'));
 FOR dd IN SELECT (d + g)::date FROM generate_series(0,7) g LOOP
  CONTINUE WHEN extract(isodow FROM dd) NOT IN (6,7);
  CONTINUE WHEN EXISTS (SELECT 1 FROM public.misiones WHERE nombre = 'Código diario ' || dd::text);
  s := dd::timestamp AT TIME ZONE 'Europe/Madrid';
  c := 'BZG-' || upper(substr(translate(encode(decode(md5(gen_random_uuid()::text),'hex'),'base64'),'+/=0O1IL','XYZ'),1,6));
  INSERT INTO public.misiones(nombre,descripcion,recompensa_sobres,tipo_sobre,codigo_qr,semanal,is_active,activa_desde,caduca_at)
  VALUES ('Código diario ' || dd::text,'Código de misión',1,'premium',c,false,true,s,s + interval '1 day' - interval '1 second');
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.ensure_weekend_codes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_scheduled_mission_codes()
RETURNS TABLE(id uuid,codigo_qr text,caduca_at timestamptz,activa_desde timestamptz,match_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_misiones'::public.app_role)) THEN RAISE EXCEPTION 'Solo super_admin'; END IF;
 PERFORM private.ensure_weekend_codes();
 RETURN QUERY SELECT m.id,m.codigo_qr,m.caduca_at,m.activa_desde,m.match_id FROM public.misiones m WHERE m.is_active AND m.caduca_at > now() ORDER BY coalesce(m.activa_desde,m.created_at), m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_scheduled_mission_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_scheduled_mission_codes() TO authenticated;

CREATE OR REPLACE FUNCTION private.claim_qr(_codigo text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); m record; nuevo_saldo int; ultimo timestamptz; falta int;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role IN ('admin','manager','super_admin','admin_misiones')) THEN RAISE EXCEPTION 'no permitido'; END IF;
 PERFORM private.ensure_weekend_codes();
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