CREATE OR REPLACE FUNCTION public.user_ranking_fichas()
RETURNS TABLE(user_id uuid, jornada integer, fichas integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id, e.numero, COUNT(*)::integer
  FROM public.effective_lineup_players() e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE lower(COALESCE(p.username,'')) <> 'lovable'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = e.user_id AND ur.role IN ('admin','manager','super_admin','admin_misiones'))
  GROUP BY e.user_id, e.numero
$$;
REVOKE ALL ON FUNCTION public.user_ranking_fichas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_ranking_fichas() TO anon, authenticated;