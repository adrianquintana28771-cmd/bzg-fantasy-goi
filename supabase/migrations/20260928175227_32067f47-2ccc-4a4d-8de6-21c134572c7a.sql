CREATE OR REPLACE FUNCTION public.open_sobre(_tipo text DEFAULT 'normal'::text)
 RETURNS TABLE(p_id text, p_nombre text, p_posicion plantilla_posicion, p_rating integer, p_rareza card_rareza)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); saldo int; i int; target public.card_rareza; chosen record;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  if _tipo = 'premium' then
    select sobres_premium into saldo from public.user_wallet where user_id = uid for update;
    if coalesce(saldo,0) <= 0 then raise exception 'sin sobres premium'; end if;
    update public.user_wallet set sobres_premium = sobres_premium - 1 where user_id = uid;
  else
    select sobres into saldo from public.user_wallet where user_id = uid for update;
    if coalesce(saldo,0) <= 0 then raise exception 'sin sobres disponibles'; end if;
    update public.user_wallet set sobres = sobres - 1 where user_id = uid;
  end if;
  create temp table _sobre(id text, nombre text, posicion plantilla_posicion, rating int, rareza card_rareza) on commit drop;
  for i in 1..3 loop
    if _tipo = 'premium' and i = 1 then
      target := case when random() < 0.25 then 'legendario'::card_rareza else 'raro'::card_rareza end;
    else
      target := case when random() < 1.0/13 then 'legendario'::card_rareza
        when random() < 4.0/13 then 'raro'::card_rareza else 'normal'::card_rareza end;
    end if;
    chosen := null;
    select pp.id, pp.nombre, pp.posicion, pp.rating, pp.rareza into chosen
      from public.player_pool pp left join public.club_players cp on cp.id = pp.club_player_id
      where pp.rareza = target and coalesce(cp.activo, true) order by random() limit 1;
    if chosen.id is null then
      select pp.id, pp.nombre, pp.posicion, pp.rating, pp.rareza into chosen
        from public.player_pool pp left join public.club_players cp on cp.id = pp.club_player_id
        where coalesce(cp.activo, true) order by random() limit 1;
    end if;
    insert into public.user_players(user_id, player_id) values (uid, chosen.id);
    insert into _sobre values (chosen.id, chosen.nombre, chosen.posicion, chosen.rating, chosen.rareza);
  end loop;
  return query select s.id, s.nombre, s.posicion, s.rating, s.rareza from _sobre s;
end $function$;

CREATE OR REPLACE FUNCTION public.tg_validate_lineup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare j record; slot text; pid text; ids text[]; slots text[] := array['portero','extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote','entrenador'];
begin
  if auth.uid() is null or public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager') then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.jornada_id <> old.jornada_id) then
    raise exception 'no permitido';
  end if;
  new.locked := false;
  select is_active, is_locked into j from public.jornadas where id = new.jornada_id;
  if j is null or not j.is_active or j.is_locked then raise exception 'jornada cerrada'; end if;
  ids := array[new.portero,new.extremo_izq,new.extremo_der,new.lateral_izq,new.lateral_der,new.central,new.pivote,new.entrenador];
  for i in 1..8 loop
    pid := ids[i]; slot := slots[i];
    if pid is not null then
      if not exists (select 1 from public.user_players where user_id = new.user_id and player_id = pid and usos < 3) then
        raise exception 'carta no disponible';
      end if;
      if exists (select 1 from public.player_pool pp join public.club_players cp on cp.id = pp.club_player_id
                 where pp.id = pid and not cp.activo) then
        raise exception 'jugador/a no disponible';
      end if;
      if not exists (select 1 from public.player_pool pp where pp.id = pid and pp.posicion::text = slot)
         and not exists (select 1 from public.player_pool_positions p where p.player_id = pid and p.posicion::text = slot) then
        raise exception 'posición no válida';
      end if;
      if (select count(*) from unnest(ids) x where x = pid) > 1 then raise exception 'carta repetida'; end if;
    end if;
  end loop;
  if exists (
    select pp.club_player_id from public.player_pool pp
    where pp.id = any(ids[1:7]) and pp.club_player_id is not null
    group by pp.club_player_id having count(*) > 1
  ) then
    raise exception 'Ese jugador/a ya está alineado/a con otra carta';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_player_activo(_player_id uuid, _activo boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare cards text[];
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'permiso denegado'; end if;
  update public.club_players set activo = _activo where id = _player_id;
  if not _activo then
    select array_agg(id) into cards from public.player_pool where club_player_id = _player_id;
    update public.lineups l set
      portero = case when portero = any(cards) then null else portero end,
      extremo_izq = case when extremo_izq = any(cards) then null else extremo_izq end,
      extremo_der = case when extremo_der = any(cards) then null else extremo_der end,
      lateral_izq = case when lateral_izq = any(cards) then null else lateral_izq end,
      lateral_der = case when lateral_der = any(cards) then null else lateral_der end,
      central = case when central = any(cards) then null else central end,
      pivote = case when pivote = any(cards) then null else pivote end,
      entrenador = case when entrenador = any(cards) then null else entrenador end
    from public.jornadas j
    where j.id = l.jornada_id and not j.is_locked and not l.locked
      and not exists (select 1 from public.jornada_alineaciones_congeladas f where f.jornada_id = l.jornada_id)
      and array[portero,extremo_izq,extremo_der,lateral_izq,lateral_der,central,pivote,entrenador] && cards;
  end if;
end $function$;
REVOKE ALL ON FUNCTION public.set_player_activo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_activo(uuid, boolean) TO authenticated;