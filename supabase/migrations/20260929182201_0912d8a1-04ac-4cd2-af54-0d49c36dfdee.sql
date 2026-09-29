CREATE OR REPLACE FUNCTION private.close_jornada(_jornada_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
declare r record; copia uuid; j record; nxt uuid;
begin
  if not public.has_role(auth.uid(),'super_admin') then
    raise exception 'permiso denegado';
  end if;
  select * into j from public.jornadas where id = _jornada_id for update;
  if j.id is null then raise exception 'jornada no encontrada'; end if;
  if not j.is_active or exists (select 1 from public.jornada_alineaciones_congeladas where jornada_id = _jornada_id) then
    raise exception 'La jornada ya está cerrada';
  end if;

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
end
$fn$;