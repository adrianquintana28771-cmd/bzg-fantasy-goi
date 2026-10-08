REVOKE SELECT ON public.misiones FROM anon, authenticated;
GRANT SELECT (id, nombre, descripcion, recompensa_sobres, is_active, created_at, tipo_sobre, requiere_qr, semanal, espera_segundos, caduca_at) ON public.misiones TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_mission_codes()
RETURNS TABLE(id uuid, codigo_qr text, caduca_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Solo super_admin';
  END IF;
  RETURN QUERY SELECT m.id, m.codigo_qr, m.caduca_at FROM public.misiones m
    WHERE m.caduca_at IS NOT NULL AND m.caduca_at > now() ORDER BY m.caduca_at;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_mission_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_mission_codes() TO authenticated;