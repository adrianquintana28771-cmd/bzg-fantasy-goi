CREATE OR REPLACE FUNCTION public.recalc_player_stats()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  -- Porteros que han jugado cada partido = tienen alguna acción de portero con cantidad > 0
  drop table if exists _gk_n;
  create temp table _gk_n as
  select a.match_id, count(distinct a.player_id) as n
  from public.club_match_actions a
  join public.club_action_types t on t.id = a.action_id and t.solo_portero
  where a.cantidad > 0
  group by a.match_id;

  drop table if exists _calc;
  create temp table _calc as
  select x.player_id, x.jornada_numero, round(sum(x.pts)::numeric, 2) as puntos
  from (
    -- Resto de acciones (sin las de portero, que usan la fórmula propia)
    select pp.id as player_id, m.jornada as jornada_numero, sum(a.cantidad * t.puntos) as pts
    from public.club_match_actions a
    join public.club_action_types t on t.id = a.action_id and t.activo and t.id not in ('gol_encajado','parada','lanzamiento_fuera','porcentaje_paradas')
    join public.club_matches m on m.id = a.match_id
    join public.player_pool pp on pp.club_player_id = a.player_id
    group by pp.id, m.jornada
    union all
    -- Porteros por partido: 2.5*P + 0.5*F + golesPts + bonus, redondeo a 2 decimales
    select s.player_id, s.jornada_numero,
      round((
        2.5 * s.par + 0.5 * s.fue
        + case when coalesce(n.n, 1) >= 2 then -0.3 * s.gol
               else -(0.1 * least(s.gol, 10)
                    + 0.2 * least(greatest(s.gol - 10, 0), 10)
                    + 0.3 * least(greatest(s.gol - 20, 0), 10)
                    + 0.4 * greatest(s.gol - 30, 0)) end
        + case when (s.par + s.fue + s.gol) < 10 then 0
               else least(25, greatest(0, s.par * 100.0 / (s.par + s.fue + s.gol) - 25) * 0.8)
                  * least(1, (s.par + s.fue + s.gol) / 20.0) end
      )::numeric, 2)
    from (
      select pp.id as player_id, m.jornada as jornada_numero, m.id as match_id,
        sum(case when a.action_id = 'parada' then a.cantidad else 0 end) as par,
        sum(case when a.action_id = 'lanzamiento_fuera' then a.cantidad else 0 end) as fue,
        sum(case when a.action_id = 'gol_encajado' then a.cantidad else 0 end) as gol
      from public.club_match_actions a
      join public.club_matches m on m.id = a.match_id
      join public.player_pool pp on pp.club_player_id = a.player_id
      where a.action_id in ('parada','lanzamiento_fuera','gol_encajado')
      group by pp.id, m.jornada, m.id
    ) s
    left join _gk_n n on n.match_id = s.match_id
    where (s.par + s.fue + s.gol) > 0
  ) x
  group by x.player_id, x.jornada_numero;

  -- Coaches receive recorded actions only, never an implicit match-result award.
  -- Preserve the existing merge by player and jornada.
  insert into public.player_jornada_stats (player_id, jornada_numero, puntos, estado)
  select c.player_id, c.jornada_numero, sum(c.puntos), 'disponible'::public.player_estado
  from _calc c
  group by c.player_id, c.jornada_numero
  on conflict (player_id, jornada_numero) do update
    set puntos = case when public.player_jornada_stats.estado = 'no_disponible' then 0 else excluded.puntos end,
        updated_at = now();

  update public.player_jornada_stats s set puntos = 0, updated_at = now()
  where not exists (select 1 from _calc c where c.player_id = s.player_id and c.jornada_numero = s.jornada_numero)
    and s.puntos <> 0;

  drop table if exists _calc;
  drop table if exists _gk_n;
end $function$;