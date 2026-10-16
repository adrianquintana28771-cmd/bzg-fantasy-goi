ALTER TABLE public.misiones ADD COLUMN activa_desde timestamptz, ADD COLUMN match_id uuid REFERENCES public.club_matches(id);
COMMENT ON COLUMN public.misiones.activa_desde IS 'Scheduled code activation; NULL preserves immediate availability of existing codes.';

CREATE OR REPLACE FUNCTION private.mission_code_available(_start timestamptz, _end timestamptz, _at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT (_start IS NULL OR _at >= _start) AND (_end IS NULL OR _at < _end)
$$;
REVOKE ALL ON FUNCTION private.mission_code_available(timestamptz,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_schedule_mission_code(_codigo text, _match_id uuid, _inicio_local timestamp without time zone)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 _c text := upper(trim(_codigo));
 _start timestamptz := _inicio_local AT TIME ZONE 'Europe/Madrid';
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN RAISE EXCEPTION 'Solo super_admin'; END IF;
 IF _c IS NULL OR length(_c) < 3 OR length(_c) > 40 OR _c !~ '^[A-Z0-9_-]+$' THEN RAISE EXCEPTION 'Código no válido: usa entre 3 y 40 caracteres (letras, números, - o _)'; END IF;
 IF _start IS NULL OR _start <= now() THEN RAISE EXCEPTION 'La hora debe ser futura'; END IF;
 IF _match_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.club_matches WHERE id = _match_id AND lower(trim(rival)) <> 'descansa') THEN RAISE EXCEPTION 'Partido no válido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('mission-code:' || _c, 0));
 PERFORM pg_advisory_xact_lock(hashtextextended('mission-match:' || _match_id::text, 0));
 IF EXISTS (SELECT 1 FROM public.misiones WHERE is_active AND lower(codigo_qr) = lower(_c) AND (caduca_at IS NULL OR caduca_at > now())) THEN RAISE EXCEPTION 'Ese código ya está activo o programado'; END IF;
 IF EXISTS (SELECT 1 FROM public.misiones WHERE is_active AND match_id = _match_id AND caduca_at > now()) THEN RAISE EXCEPTION 'Ese partido ya tiene un código activo o programado'; END IF;
 INSERT INTO public.misiones(nombre,descripcion,recompensa_sobres,tipo_sobre,codigo_qr,semanal,is_active,activa_desde,caduca_at,match_id)
 VALUES ('Código ' || _c,'Código de misión',1,'premium',_c,false,true,_start,_start + interval '4 hours',_match_id);
 RETURN _start + interval '4 hours';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_schedule_mission_code(text,uuid,timestamp without time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_schedule_mission_code(text,uuid,timestamp without time zone) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_scheduled_mission_codes()
RETURNS TABLE(id uuid,codigo_qr text,caduca_at timestamptz,activa_desde timestamptz,match_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_misiones'::public.app_role)) THEN RAISE EXCEPTION 'Solo super_admin'; END IF;
 RETURN QUERY SELECT m.id,m.codigo_qr,m.caduca_at,m.activa_desde,m.match_id FROM public.misiones m WHERE m.is_active AND m.caduca_at > now() ORDER BY coalesce(m.activa_desde,m.created_at), m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_scheduled_mission_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_scheduled_mission_codes() TO authenticated;

CREATE OR REPLACE FUNCTION private.claim_qr(_codigo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m record; nuevo_saldo int;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 SELECT id,recompensa_sobres,caduca_at,activa_desde INTO m FROM public.misiones
 WHERE is_active AND codigo_qr IS NOT NULL AND lower(codigo_qr) = lower(trim(_codigo))
 ORDER BY private.mission_code_available(activa_desde,caduca_at,now()) DESC, created_at DESC LIMIT 1;
 IF m IS NULL THEN RAISE EXCEPTION 'código no válido'; END IF;
 IF m.activa_desde IS NOT NULL AND m.activa_desde > now() THEN RAISE EXCEPTION 'código aún no activo'; END IF;
 IF NOT private.mission_code_available(m.activa_desde,m.caduca_at,now()) THEN RAISE EXCEPTION 'código caducado'; END IF;
 IF EXISTS (SELECT 1 FROM public.user_misiones WHERE user_id = uid AND mision_id = m.id) THEN RAISE EXCEPTION 'ya has canjeado este código'; END IF;
 INSERT INTO public.user_misiones(user_id,mision_id) VALUES(uid,m.id);
 INSERT INTO public.user_wallet(user_id) VALUES(uid) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.user_wallet SET sobres_premium = sobres_premium + m.recompensa_sobres WHERE user_id = uid;
 SELECT sobres_premium INTO nuevo_saldo FROM public.user_wallet WHERE user_id = uid;
 RETURN nuevo_saldo;
END;
$$;