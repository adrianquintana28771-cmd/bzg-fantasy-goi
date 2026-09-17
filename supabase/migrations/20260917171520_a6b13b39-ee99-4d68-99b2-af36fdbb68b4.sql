
-- 1) nuevo valor de posición para entrenadores
ALTER TYPE public.plantilla_posicion ADD VALUE IF NOT EXISTS 'entrenador';

-- 2) entrenadores en el club
ALTER TABLE public.club_players ADD COLUMN IF NOT EXISTS es_entrenador boolean NOT NULL DEFAULT false;

-- 3) enlace carta <-> ficha real
ALTER TABLE public.player_pool ADD COLUMN IF NOT EXISTS club_player_id uuid REFERENCES public.club_players(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_player_pool_club_player ON public.player_pool(club_player_id);

-- 4) hueco de entrenador en la alineación
ALTER TABLE public.lineups ADD COLUMN IF NOT EXISTS entrenador text REFERENCES public.player_pool(id);

-- 5) unicidad para poder recalcular con upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_pjs_player_jornada ON public.player_jornada_stats(player_id, jornada_numero);

-- 6) criterios de puntuación editables por el super admin
ALTER TABLE public.club_action_types ADD COLUMN IF NOT EXISTS solo_entrenador boolean NOT NULL DEFAULT false;
ALTER TABLE public.club_action_types ADD COLUMN IF NOT EXISTS es_resultado text; -- 'victoria' | 'empate' | 'derrota'

DROP POLICY IF EXISTS "super admin gestiona criterios" ON public.club_action_types;
CREATE POLICY "super admin gestiona criterios" ON public.club_action_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 7) recálculo global de puntos
CREATE OR REPLACE FUNCTION public.recalc_player_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  create temp table _calc on commit drop as
  -- jugadores/as: suma de acciones x puntos del criterio
  select pp.id as player_id, m.jornada as jornada_numero,
         round(sum(a.cantidad * t.puntos)::numeric, 1) as puntos
  from public.club_match_actions a
  join public.club_action_types t on t.id = a.action_id and t.activo
  join public.club_matches m on m.id = a.match_id
  join public.player_pool pp on pp.club_player_id = a.player_id
  group by pp.id, m.jornada
  union all
  -- entrenadores/as: según el resultado del partido de su equipo
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

  -- los que ya no tienen datos quedan a 0
  update public.player_jornada_stats s set puntos = 0, updated_at = now()
  where not exists (select 1 from _calc c where c.player_id = s.player_id and c.jornada_numero = s.jornada_numero)
    and s.puntos <> 0;
end $$;

CREATE OR REPLACE FUNCTION public.tg_recalc_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform public.recalc_player_stats();
  return null;
end $$;

DROP TRIGGER IF EXISTS recalc_on_action_types ON public.club_action_types;
CREATE TRIGGER recalc_on_action_types
AFTER INSERT OR UPDATE OR DELETE ON public.club_action_types
FOR EACH STATEMENT EXECUTE FUNCTION public.tg_recalc_stats();

DROP TRIGGER IF EXISTS recalc_on_match_actions ON public.club_match_actions;
CREATE TRIGGER recalc_on_match_actions
AFTER INSERT OR UPDATE OR DELETE ON public.club_match_actions
FOR EACH STATEMENT EXECUTE FUNCTION public.tg_recalc_stats();

DROP TRIGGER IF EXISTS recalc_on_matches ON public.club_matches;
CREATE TRIGGER recalc_on_matches
AFTER INSERT OR UPDATE OR DELETE ON public.club_matches
FOR EACH STATEMENT EXECUTE FUNCTION public.tg_recalc_stats();

-- 8) ranking de usuarios incluyendo al entrenador alineado
CREATE OR REPLACE FUNCTION public.user_ranking()
RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH alineados AS (
    SELECT l.user_id, j.numero AS jornada_numero,
           unnest(array[l.portero,l.extremo_izq,l.extremo_der,l.lateral_izq,l.lateral_der,l.central,l.pivote,l.entrenador]) AS player_id
    FROM public.lineups l
    JOIN public.jornadas j ON j.id = l.jornada_id
  ), pts AS (
    SELECT a.user_id, a.jornada_numero, coalesce(sum(s.puntos), 0) AS puntos
    FROM alineados a
    LEFT JOIN public.player_jornada_stats s
      ON s.player_id = a.player_id AND s.jornada_numero = a.jornada_numero
    WHERE a.player_id IS NOT NULL
    GROUP BY a.user_id, a.jornada_numero
  )
  SELECT p.id, p.username, p.display_name,
         coalesce(sum(pts.puntos), 0) AS puntos,
         count(pts.jornada_numero)::int AS jornadas
  FROM public.profiles p
  JOIN pts ON pts.user_id = p.id
  GROUP BY p.id, p.username, p.display_name
  ORDER BY 4 DESC
$$;

-- 9) cierre de jornada contando también al entrenador
CREATE OR REPLACE FUNCTION public.close_jornada(_jornada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare r record; copia uuid;
begin
  if not (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager')) then
    raise exception 'permiso denegado';
  end if;

  for r in
    select user_id, unnest(array[portero,extremo_izq,extremo_der,lateral_izq,lateral_der,central,pivote,entrenador]) as pid
    from public.lineups where jornada_id = _jornada_id and not locked
  loop
    if r.pid is not null then
      select id into copia from public.user_players
        where user_id = r.user_id and player_id = r.pid and usos < 3
        order by usos desc limit 1;
      if copia is not null then
        update public.user_players set usos = usos + 1 where id = copia;
      end if;
    end if;
  end loop;

  delete from public.user_players where usos >= 3;

  update public.lineups set locked = true where jornada_id = _jornada_id;
  update public.jornadas set is_locked = true, is_active = false where id = _jornada_id;
end $$;
