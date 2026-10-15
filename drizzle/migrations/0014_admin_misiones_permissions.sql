CREATE OR REPLACE FUNCTION public.admin_create_mission_code(_codigo text)
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _c text := upper(trim(_codigo));
  _exp timestamptz := now() + interval '4 hours';
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin_misiones'::app_role)) THEN
    RAISE EXCEPTION 'Solo super_admin puede crear códigos de misión';
  END IF;
  IF _c IS NULL OR length(_c) < 3 OR length(_c) > 40 OR _c !~ '^[A-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Código no válido: usa entre 3 y 40 caracteres (letras, números, - o _)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.misiones WHERE is_active = true AND lower(codigo_qr) = lower(_c) AND (caduca_at IS NULL OR caduca_at > now())) THEN
    RAISE EXCEPTION 'Ese código ya está activo';
  END IF;
  INSERT INTO public.misiones (nombre, descripcion, recompensa_sobres, tipo_sobre, codigo_qr, semanal, is_active, caduca_at)
  VALUES ('Código ' || _c, 'Código de misión', 1, 'premium', _c, false, true, _exp);
  RETURN _exp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_mission_codes()
 RETURNS TABLE(id uuid, codigo_qr text, caduca_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin_misiones'::app_role)) THEN
    RAISE EXCEPTION 'Solo super_admin';
  END IF;
  RETURN QUERY SELECT m.id, m.codigo_qr, m.caduca_at FROM public.misiones m
    WHERE m.caduca_at IS NOT NULL AND m.caduca_at > now() ORDER BY m.caduca_at;
END;
$function$;

-- Cambia solo la disponibilidad (estado) de un jugador y sus cartas.
CREATE OR REPLACE FUNCTION public.set_player_estado(_club_player_id uuid, _estado player_estado)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin_misiones'::app_role)) THEN
    RAISE EXCEPTION 'permiso denegado';
  END IF;
  UPDATE public.club_players SET estado = _estado WHERE id = _club_player_id;
  UPDATE public.player_pool SET estado = _estado WHERE club_player_id = _club_player_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_player_estado(uuid, player_estado) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_estado(uuid, player_estado) TO authenticated;