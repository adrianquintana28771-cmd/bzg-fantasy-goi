ALTER TABLE public.club_action_types ADD COLUMN IF NOT EXISTS tramos jsonb;
COMMENT ON COLUMN public.club_action_types.tramos IS 'Tramos [{desde,hasta,puntos}] para criterios de portero (parada, gol_encajado: puntos por unidad acumulativos; porcentaje_paradas: puntos fijos por rango de %). NULL = lineal con puntos.';

UPDATE public.club_action_types SET tramos = '[{"desde":1,"hasta":10,"puntos":-0.25},{"desde":11,"hasta":20,"puntos":-0.5},{"desde":21,"hasta":30,"puntos":-0.75},{"desde":31,"hasta":null,"puntos":-1}]'::jsonb
WHERE id = 'gol_encajado' AND tramos IS NULL;

CREATE OR REPLACE FUNCTION public.tramo_pts(_n numeric, _tramos jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  select coalesce(sum((e->>'puntos')::numeric *
    greatest(0, least(_n, coalesce((e->>'hasta')::numeric, _n)) - ((e->>'desde')::numeric - 1))), 0)
  from jsonb_array_elements(coalesce(_tramos, '[]'::jsonb)) e
$$;

CREATE OR REPLACE FUNCTION public.tramo_pct_pts(_pct numeric, _tramos jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  select coalesce((select (e->>'puntos')::numeric
    from jsonb_array_elements(coalesce(_tramos, '[]'::jsonb)) e
    where _pct >= (e->>'desde')::numeric and (e->>'hasta' is null or _pct <= (e->>'hasta')::numeric)
    order by (e->>'desde')::numeric desc limit 1), 0)
$$;

CREATE OR REPLACE FUNCTION public.recalc_player_stats()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  drop table if exists _gk_n;
  create temp table _gk_n as
  select a.match_id, count(distinct a.player_id) as n
  from public.club_match_actions a
  where a.action_id in ('parada','gol_encajado','lanzamiento_fuera') and a.cantidad > 0
  group by a.match_id;

  drop table if exists _calc;
  create temp table _calc as
  select x.player_id, x.jornada_numero, round(sum(x.pts)::numeric, 2) as puntos
  from (
    -- Acciones normales (sin goles en contra ni paradas, que van por tramos)
    select pp.id as player_id, m.jornada as jornada_numero, sum(a.cantidad * t.puntos) as pts
    from public.club_match_actions a
    join public.club_action_types t on t.id = a.action_id and t.activo and t.id not in ('gol_encajado','parada','porcentaje_paradas')
    join public.club_matches m on m.id = a.match_id
    join public.player_pool pp on pp.club_player_id = a.player_id
    group by pp.id, m.jornada
    union all
    -- Paradas: tramos si existen, si no lineal
    select pp.id, m.jornada,
      case when jsonb_array_length(coalesce(t.tramos,'[]'::jsonb)) > 0
           then public.tramo_pts(sum(a.cantidad), t.tramos)
           else sum(a.cantidad) * t.puntos end
    from public.club_match_actions a
    join public.club_action_types t on t.id = a.action_id and t.activo and t.id = 'parada'
    join public.club_matches m on m.id = a.match_id
    join public.player_pool pp on pp.club_player_id = a.player_id
    group by pp.id, m.jornada, t.tramos, t.puntos
    union all
    -- Goles en contra: un único portero -> tramos; dos o más -> puntos por gol
    select g.player_id, g.jornada_numero,
      (case when jsonb_array_length(coalesce(g.tramos,'[]'::jsonb)) > 0
            then public.tramo_pts(g.solo, g.tramos) else g.solo * g.puntos end)
      + g.multi * g.puntos
    from (
      select pp.id as player_id, m.jornada as jornada_numero, t.tramos, t.puntos,
        sum(case when coalesce(n.n,1) <= 1 then a.cantidad else 0 end) as solo,
        sum(case when coalesce(n.n,1) > 1 then a.cantidad else 0 end) as multi
      from public.club_match_actions a
      join public.club_action_types t on t.id = a.action_id and t.activo and t.id = 'gol_encajado'
      join public.club_matches m on m.id = a.match_id
      join public.player_pool pp on pp.club_player_id = a.player_id
      left join _gk_n n on n.match_id = a.match_id
      group by pp.id, m.jornada, t.tramos, t.puntos
    ) g
    union all
    -- Porcentaje de paradas: paradas / (paradas + fuera + goles) * 100
    select s.player_id, s.jornada_numero,
      public.tramo_pct_pts(round(s.par * 100.0 / (s.par + s.fue + s.gol), 2), t.tramos)
    from (
      select pp.id as player_id, m.jornada as jornada_numero,
        sum(case when a.action_id = 'parada' then a.cantidad else 0 end) as par,
        sum(case when a.action_id = 'lanzamiento_fuera' then a.cantidad else 0 end) as fue,
        sum(case when a.action_id = 'gol_encajado' then a.cantidad else 0 end) as gol
      from public.club_match_actions a
      join public.club_matches m on m.id = a.match_id
      join public.player_pool pp on pp.club_player_id = a.player_id
      where a.action_id in ('parada','lanzamiento_fuera','gol_encajado')
      group by pp.id, m.jornada
    ) s
    join public.club_action_types t on t.id = 'porcentaje_paradas' and t.activo
    where (s.par + s.fue + s.gol) > 0
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
  drop table if exists _gk_n;
end $function$;