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