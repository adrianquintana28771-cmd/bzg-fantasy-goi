create or replace function public.recalc_player_stats()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  drop table if exists pg_temp._gk_n;
  create temp table _gk_n as select a.match_id,count(distinct a.player_id) as n from public.club_match_actions a join public.club_action_types t on t.id=a.action_id and t.solo_portero where a.cantidad>0 group by a.match_id;
  drop table if exists pg_temp._match_gol;
  create temp table _match_gol as select m.id as match_id,m.team_id,m.jornada,sum(a.cantidad) as gol from public.club_matches m join public.club_match_actions a on a.match_id=m.id and a.action_id='gol_encajado' group by m.id,m.team_id,m.jornada;
  drop table if exists pg_temp._calc;
  create temp table _calc as
  select x.player_id,x.jornada_numero,round(sum(x.pts)::numeric,2) as puntos from (
    select pp.id as player_id,m.jornada as jornada_numero,sum(a.cantidad*t.puntos) as pts
    from public.club_match_actions a join public.club_action_types t on t.id=a.action_id and t.activo and t.id not in ('gol_encajado','parada','lanzamiento_fuera','porcentaje_paradas','porcentaje_acierto','bonus_resultado') join public.club_matches m on m.id=a.match_id join public.player_pool pp on pp.club_player_id=a.player_id group by pp.id,m.jornada
    union all
    select s.player_id,s.jornada_numero,round((
      case when p.activo then case when jsonb_array_length(coalesce(p.tramos,'[]'::jsonb))>0 then public.tramo_pts(s.par,p.tramos) else s.par*p.puntos end else 0 end
      + case when f.activo then s.fue*f.puntos else 0 end
      + case when g.activo then case when coalesce(n.n,1)<2 and jsonb_array_length(coalesce(g.tramos,'[]'::jsonb))>0 then public.tramo_pts(s.gol,g.tramos) else s.gol*g.puntos end else 0 end
      + case when pct.activo then public.tramo_pct_pts(s.par*100.0/nullif(s.par+s.fue+s.gol,0),pct.tramos) else 0 end
    )::numeric,2)
    from (select pp.id as player_id,m.jornada as jornada_numero,m.id as match_id,
      sum(case when a.action_id='parada' then a.cantidad else 0 end) as par,
      sum(case when a.action_id='lanzamiento_fuera' then a.cantidad else 0 end) as fue,
      sum(case when a.action_id='gol_encajado' then a.cantidad else 0 end) as gol
      from public.club_match_actions a join public.club_matches m on m.id=a.match_id join public.player_pool pp on pp.club_player_id=a.player_id where a.action_id in ('parada','lanzamiento_fuera','gol_encajado') group by pp.id,m.jornada,m.id) s
    left join _gk_n n on n.match_id=s.match_id
    left join public.club_action_types p on p.id='parada'
    left join public.club_action_types f on f.id='lanzamiento_fuera'
    left join public.club_action_types g on g.id='gol_encajado'
    left join public.club_action_types pct on pct.id='porcentaje_paradas'
    where s.par+s.fue+s.gol>0
    union all
    -- Field shooting percentage per match: (gol + gol_7m) / (gol + gol_7m + lanzamiento fallado); highest tier only.
    select s.player_id,s.jornada_numero,coalesce(public.tramo_pct_pts(s.g*100.0/(s.g+s.fal),acc.tramos),0)
    from (select pp.id as player_id,m.jornada as jornada_numero,m.id as match_id,
      sum(case when a.action_id in ('gol','gol_7m') then a.cantidad else 0 end) as g,
      sum(case when a.action_id='falta_ataque' then a.cantidad else 0 end) as fal
      from public.club_match_actions a join public.club_matches m on m.id=a.match_id join public.player_pool pp on pp.club_player_id=a.player_id where a.action_id in ('gol','gol_7m','falta_ataque') group by pp.id,m.jornada,m.id) s
    join public.club_action_types acc on acc.id='porcentaje_acierto' and acc.activo
    where s.g+s.fal>0
    union all
    -- Bonus por resultado: quien jugó (no entrenadores) suma si el equipo encajó menos goles que su media de jornadas anteriores.
    select pp.id as player_id,g.jornada as jornada_numero,round(coalesce(public.tramo_pct_pts((b.media-g.gol)*100.0/nullif(b.media,0),bt.tramos),0)::numeric,2) as pts
    from _match_gol g
    join lateral (select avg(g2.gol) as media from _match_gol g2 where g2.team_id=g.team_id and g2.jornada<g.jornada) b on true
    join public.club_match_players mp on mp.match_id=g.match_id and mp.jugado
    join public.club_players cp on cp.id=mp.player_id and not cp.es_entrenador
    join public.player_pool pp on pp.club_player_id=mp.player_id
    join public.club_action_types bt on bt.id='bonus_resultado' and bt.activo
    where b.media>0 and g.gol<b.media
  ) x group by x.player_id,x.jornada_numero;
  insert into public.player_jornada_stats(player_id,jornada_numero,puntos,estado)
  select player_id,jornada_numero,puntos,'disponible'::public.player_estado from _calc
  on conflict(player_id,jornada_numero) do update set puntos=case when public.player_jornada_stats.estado='no_disponible' then 0 else excluded.puntos end,updated_at=now();
  update public.player_jornada_stats s set puntos=0,updated_at=now() where not exists(select 1 from _calc c where c.player_id=s.player_id and c.jornada_numero=s.jornada_numero) and s.puntos<>0;
  drop table if exists pg_temp._calc;
  drop table if exists pg_temp._match_gol;
  drop table if exists pg_temp._gk_n;
end $function$;