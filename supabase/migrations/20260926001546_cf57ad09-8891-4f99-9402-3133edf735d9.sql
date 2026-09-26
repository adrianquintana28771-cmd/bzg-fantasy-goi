CREATE TABLE public.jornada_alineaciones_congeladas (
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id),
  user_id uuid NOT NULL,
  posicion public.plantilla_posicion NOT NULL,
  player_id text REFERENCES public.player_pool(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jornada_id, user_id, posicion)
);
GRANT SELECT ON public.jornada_alineaciones_congeladas TO authenticated;
GRANT ALL ON public.jornada_alineaciones_congeladas TO service_role;
ALTER TABLE public.jornada_alineaciones_congeladas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own frozen lineups" ON public.jornada_alineaciones_congeladas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.tg_frozen_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'La alineación congelada no se puede modificar'; END $$;
CREATE TRIGGER frozen_immutable BEFORE UPDATE OR DELETE ON public.jornada_alineaciones_congeladas
  FOR EACH ROW EXECUTE FUNCTION public.tg_frozen_immutable();

CREATE OR REPLACE FUNCTION public.close_jornada(_jornada_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r record; copia uuid; j record; nxt uuid;
begin
  if not public.has_role(auth.uid(),'super_admin') then
    raise exception 'permiso denegado';
  end if;
  select * into j from public.jornadas where id = _jornada_id for update;
  if j.id is null then raise exception 'jornada no encontrada'; end if;
  if j.is_locked or exists (select 1 from public.jornada_alineaciones_congeladas where jornada_id = _jornada_id) then
    raise exception 'La jornada ya está cerrada';
  end if;

  -- Foto definitiva (huecos vacíos = null)
  insert into public.jornada_alineaciones_congeladas (jornada_id, user_id, posicion, player_id)
  select l.jornada_id, l.user_id, v.pos::public.plantilla_posicion, v.pid
  from public.lineups l,
  lateral (values ('portero',l.portero),('extremo_izq',l.extremo_izq),('extremo_der',l.extremo_der),
    ('lateral_izq',l.lateral_izq),('lateral_der',l.lateral_der),('central',l.central),
    ('pivote',l.pivote),('entrenador',l.entrenador)) v(pos,pid)
  where l.jornada_id = _jornada_id;

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

  -- Siguiente jornada: los usuarios siguen con su alineación actual
  select id into nxt from public.jornadas where numero = j.numero + 1;
  if nxt is null then
    insert into public.jornadas (numero, nombre, is_active, is_locked)
    values (j.numero + 1, 'Jornada ' || (j.numero + 1), true, false) returning id into nxt;
  else
    update public.jornadas set is_active = true, is_locked = false where id = nxt;
  end if;

  insert into public.lineups (user_id, jornada_id, portero, extremo_izq, extremo_der, lateral_izq, lateral_der, central, pivote, entrenador, locked)
  select l.user_id, nxt,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.portero) then l.portero end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.extremo_izq) then l.extremo_izq end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.extremo_der) then l.extremo_der end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.lateral_izq) then l.lateral_izq end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.lateral_der) then l.lateral_der end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.central) then l.central end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.pivote) then l.pivote end,
    case when exists (select 1 from public.user_players u where u.user_id=l.user_id and u.player_id=l.entrenador) then l.entrenador end,
    false
  from public.lineups l where l.jornada_id = _jornada_id
  on conflict (user_id, jornada_id) do nothing;
end $function$;
REVOKE ALL ON FUNCTION public.close_jornada(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_jornada(uuid) TO authenticated;

-- Alineación efectiva: congelada si la jornada está cerrada, actual si está abierta
CREATE OR REPLACE FUNCTION public.effective_lineup_players()
 RETURNS TABLE(user_id uuid, jornada_id uuid, numero integer, player_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT f.user_id, f.jornada_id, j.numero, f.player_id
  FROM public.jornada_alineaciones_congeladas f JOIN public.jornadas j ON j.id = f.jornada_id
  WHERE f.player_id IS NOT NULL
  UNION ALL
  SELECT l.user_id, l.jornada_id, j.numero, x.pid
  FROM public.lineups l JOIN public.jornadas j ON j.id = l.jornada_id,
  unnest(array[l.portero,l.extremo_izq,l.extremo_der,l.lateral_izq,l.lateral_der,l.central,l.pivote,l.entrenador]) x(pid)
  WHERE x.pid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.jornada_alineaciones_congeladas f2 WHERE f2.jornada_id = l.jornada_id);
$$;
REVOKE ALL ON FUNCTION public.effective_lineup_players() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.user_ranking()
 RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH lj AS (
    SELECT l.user_id, l.jornada_id FROM public.lineups l
    UNION SELECT f.user_id, f.jornada_id FROM public.jornada_alineaciones_congeladas f
  ), pts AS (
    SELECT e.user_id, SUM(s.puntos) AS puntos
    FROM public.effective_lineup_players() e
    JOIN public.player_jornada_stats s ON s.jornada_numero = e.numero AND s.player_id = e.player_id
    GROUP BY e.user_id
  )
  SELECT p.id, p.username, p.display_name,
    ROUND(COALESCE(MAX(pts.puntos), 0), 2) AS puntos,
    COUNT(DISTINCT lj.jornada_id)::integer
  FROM public.profiles p
  LEFT JOIN lj ON lj.user_id = p.id
  LEFT JOIN pts ON pts.user_id = p.id
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','manager','super_admin'))
  GROUP BY p.id, p.username, p.display_name
  ORDER BY puntos DESC;
$function$;

CREATE OR REPLACE FUNCTION public.user_ranking_by_jornada()
 RETURNS TABLE(user_id uuid, username text, display_name text, jornada integer, puntos numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH lj AS (
    SELECT l.user_id, l.jornada_id FROM public.lineups l
    UNION SELECT f.user_id, f.jornada_id FROM public.jornada_alineaciones_congeladas f
  )
  SELECT p.id, p.username, p.display_name, j.numero,
    ROUND(COALESCE((SELECT SUM(s.puntos) FROM public.effective_lineup_players() e
      JOIN public.player_jornada_stats s ON s.jornada_numero = e.numero AND s.player_id = e.player_id
      WHERE e.user_id = p.id AND e.jornada_id = j.id), 0), 2)
  FROM public.profiles p
  JOIN lj ON lj.user_id = p.id
  JOIN public.jornadas j ON j.id = lj.jornada_id
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','manager','super_admin'));
$function$;