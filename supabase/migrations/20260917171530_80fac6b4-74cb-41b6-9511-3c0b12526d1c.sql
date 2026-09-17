
REVOKE ALL ON FUNCTION public.recalc_player_stats() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tg_recalc_stats() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.recalc_player_stats() TO service_role;
