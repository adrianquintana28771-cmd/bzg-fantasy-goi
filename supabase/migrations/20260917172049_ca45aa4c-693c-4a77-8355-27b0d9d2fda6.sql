
CREATE OR REPLACE FUNCTION public.recalc_player_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  drop table if exists _calc;
  create temp table _calc as
  select pp.id as player_id, m.jornada as jornada_numero,
         round(sum(a.cantidad * t.puntos)::numeric, 1) as puntos
  from public.club_match_actions a
  join public.club_action_types t on t.id = a.action_id and t.activo
  join public.club_matches m on m.id = a.match_id
  join public.player_pool pp on pp.club_player_id = a.player_id
  group by pp.id, m.jornada
  union all
  select pp.id, m.jornada,
         round(sum(
           case
             when m.goles_favor > m.goles_contra then coalesce((select t.puntos from public.club_action_types t where t.es_resultado = 'victoria' and t.activo), 0)
             when m.goles_favor < m.goles_contra then coalesce((select t.puntos from public.club_action_types t where t.es_resultado = 'derrota' and t.activo), 0)
             else coalesce((select t.puntos from public.club_action_types t where t.es_resultado = 'empate' and t.activo), 0)
           end)::numeric, 1)
  from public.player_pool pp
  join public.club_players cp on cp.id = pp.club_player_id and cp.es_entrenador
  join public.club_player_teams pt on pt.player_id = cp.id
  join public.club_matches m on m.team_id = pt.team_id
  group by pp.id, m.jornada;

  insert into public.player_jornada_stats (player_id, jornada_numero, puntos, estado)
  select c.player_id, c.jornada_numero, c.puntos, 'disponible'::public.player_estado
  from _calc c
  on conflict (player_id, jornada_numero) do update
    set puntos = case when public.player_jornada_stats.estado = 'no_disponible' then 0 else excluded.puntos end,
        updated_at = now();

  update public.player_jornada_stats s set puntos = 0, updated_at = now()
  where not exists (select 1 from _calc c where c.player_id = s.player_id and c.jornada_numero = s.jornada_numero)
    and s.puntos <> 0;

  drop table if exists _calc;
end $$;
REVOKE ALL ON FUNCTION public.recalc_player_stats() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.recalc_player_stats() TO service_role;
