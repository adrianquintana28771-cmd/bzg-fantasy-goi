CREATE OR REPLACE FUNCTION public.admin_save_player(
  _id uuid, _nombre text, _apellido1 text, _apellido2 text, _alias text, _sexo club_sexo,
  _anio_nacimiento integer, _dorsal integer, _estado player_estado, _es_entrenador boolean,
  _activo boolean, _team_ids uuid[], _positions text[], _principal text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare pid uuid := _id; base text; main_team text; card_pos plantilla_posicion; pos_list text[]; full_name text; was_activo boolean;
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'permiso denegado'; end if;
  if coalesce(trim(_nombre),'') = '' then raise exception 'nombre obligatorio'; end if;
  _team_ids := coalesce(_team_ids, '{}'); _positions := coalesce(_positions, '{}');

  if pid is null then
    insert into public.club_players(nombre, apellido1, apellido2, alias, sexo, anio_nacimiento, dorsal, estado, es_entrenador, activo)
    values (trim(_nombre), nullif(trim(_apellido1),''), nullif(trim(_apellido2),''), nullif(trim(_alias),''), _sexo, _anio_nacimiento, _dorsal, _estado, _es_entrenador, true)
    returning id into pid;
    was_activo := true;
  else
    select activo into was_activo from public.club_players where id = pid;
    if was_activo is null then raise exception 'jugador/a no encontrado/a'; end if;
    update public.club_players set nombre = trim(_nombre), apellido1 = nullif(trim(_apellido1),''),
      apellido2 = nullif(trim(_apellido2),''), alias = nullif(trim(_alias),''), sexo = _sexo,
      anio_nacimiento = _anio_nacimiento, dorsal = _dorsal, estado = _estado, es_entrenador = _es_entrenador
    where id = pid;
  end if;

  -- Equipos
  delete from public.club_player_teams where player_id = pid and team_id <> all(_team_ids);
  insert into public.club_player_teams(player_id, team_id, dorsal)
    select pid, t, _dorsal from unnest(_team_ids) t on conflict do nothing;
  update public.club_player_teams set dorsal = _dorsal where player_id = pid;

  -- Posiciones (por persona)
  delete from public.club_player_positions where player_id = pid;
  insert into public.club_player_positions(player_id, position_id, es_principal)
    select pid, p, p = coalesce(_principal, _positions[1]) from (select distinct unnest(_positions) p) s
    where exists (select 1 from public.club_positions cp where cp.id = s.p);

  -- Cartas
  full_name := trim(trim(_nombre) || ' ' || coalesce(trim(_apellido1),''));
  if _es_entrenador then
    pos_list := array['entrenador'];
  else
    select array_agg(distinct x) into pos_list from (
      select case when p = 'universal' then unnest(array['extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote']) else p end x
      from unnest(_positions) p) s
    where x in ('portero','extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote');
  end if;
  pos_list := coalesce(pos_list, array['central']);
  card_pos := (case when _es_entrenador then 'entrenador'
    when coalesce(_principal, _positions[1]) = any(pos_list) then coalesce(_principal, _positions[1])
    else pos_list[1] end)::plantilla_posicion;

  select pp.team_id into main_team from public.player_pool pp where pp.club_player_id = pid limit 1;
  if main_team is null or not (main_team::uuid = any(_team_ids)) then main_team := (_team_ids[1])::text; end if;

  if not exists (select 1 from public.player_pool where club_player_id = pid) then
    base := 'p_' || replace(pid::text, '-', '');
    insert into public.player_pool(id, nombre, apellido1, team_id, posicion, rating, rareza, dorsal, estado, club_player_id)
    values (base, full_name, nullif(trim(_apellido1),''), main_team, card_pos, 0, 'normal', _dorsal, _estado, pid),
           (base || '-raro', full_name, nullif(trim(_apellido1),''), main_team, card_pos, 0, 'raro', _dorsal, _estado, pid),
           (base || '-leg', full_name, nullif(trim(_apellido1),''), main_team, card_pos, 0, 'legendario', _dorsal, _estado, pid);
  else
    update public.player_pool set nombre = full_name, apellido1 = nullif(trim(_apellido1),''), team_id = main_team,
      posicion = card_pos, dorsal = _dorsal, estado = _estado
    where club_player_id = pid;
  end if;

  delete from public.player_pool_positions where player_id in (select id from public.player_pool where club_player_id = pid);
  insert into public.player_pool_positions(player_id, posicion, es_principal)
    select pp.id, x::plantilla_posicion, x::plantilla_posicion = card_pos
    from public.player_pool pp, unnest(pos_list) x where pp.club_player_id = pid;

  if coalesce(_activo, true) <> was_activo then
    perform public.set_player_activo(pid, coalesce(_activo, true));
  end if;
  return pid;
end $function$;
REVOKE ALL ON FUNCTION public.admin_save_player(uuid,text,text,text,text,club_sexo,integer,integer,player_estado,boolean,boolean,uuid[],text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_player(uuid,text,text,text,text,club_sexo,integer,integer,player_estado,boolean,boolean,uuid[],text[],text) TO authenticated;