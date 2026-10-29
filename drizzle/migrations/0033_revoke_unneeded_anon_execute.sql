REVOKE EXECUTE ON FUNCTION public.admin_create_mission_code(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_mission_code(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.close_jornada(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_jornada(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_prediccion_open() FROM anon, authenticated, PUBLIC;