CREATE OR REPLACE FUNCTION public.recalc_player_stats()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  drop table if exists _calc;
  create temp table _calc as
  select x.player_id, x.jornada_numero, round(sum(x.pts)::numeric, 2) as puntos
  from (
    select pp.id as player_id, m.jornada as jornada_numero, sum(a.cantidad * t.puntos) as pts
    from public.club_match_actions a
    join public.club_action_types t on t.id = a.action_id and t.activo and t.id <> 'gol_encajado'
    join public.club_matches m on m.id = a.match_id
    join public.player_pool pp on pp.club_player_id = a.player_id
    group by pp.id, m.jornada
    union all
    select g.player_id, g.jornada_numero,
      - (0.25 * least(g.goles, 10)
       + 0.50 * least(greatest(g.goles - 10, 0), 10)
       + 0.75 * least(greatest(g.goles - 20, 0), 10)
       + 1.00 * greatest(g.goles - 30, 0))
    from (
      select pp.id as player_id, m.jornada as jornada_numero, sum(a.cantidad) as goles
      from public.club_match_actions a
      join public.club_action_types t on t.id = a.action_id and t.activo and t.id = 'gol_encajado'
      join public.club_matches m on m.id = a.match_id
      join public.player_pool pp on pp.club_player_id = a.player_id
      group by pp.id, m.jornada
    ) g
  ) x
  group by x.player_id, x.jornada_numero
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
  join public.club_matches m on m.team_id = pt.team_id and (m.goles_favor + m.goles_contra) > 0
  where not exists (
    select 1 from public.club_match_actions a2
    join public.club_action_types t2 on t2.id = a2.action_id and t2.es_resultado is not null
    where a2.match_id = m.id and a2.player_id = cp.id and a2.cantidad > 0)
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
end $function$;