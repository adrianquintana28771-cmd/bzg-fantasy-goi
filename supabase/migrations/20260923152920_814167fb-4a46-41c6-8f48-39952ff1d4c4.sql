-- 1. Roles: only super_admin manages roles / sees all profiles
drop policy if exists "Admins can manage roles" on public.user_roles;
drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Super admin manages roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Super admin views profiles" on public.profiles for select to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

-- Users may only change display_name/nombre/apellido on their own profile
revoke update on public.profiles from authenticated, anon;
grant update (display_name, nombre, apellido) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
alter table public.profiles add constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 40) not valid;
alter table public.profiles add constraint profiles_nombre_len check (nombre is null or char_length(nombre) <= 60) not valid;
alter table public.profiles add constraint profiles_apellido_len check (apellido is null or char_length(apellido) <= 80) not valid;
alter table public.profiles add constraint profiles_username_fmt check (username ~ '^[A-Za-z0-9_.-]{3,36}$') not valid;

-- 2. Inventory: users can no longer insert/edit cards directly (only via open_sobre)
drop policy if exists "Own inventory write" on public.user_players;
revoke insert, update, delete on public.user_players from anon, authenticated;
alter table public.user_players add constraint user_players_usos_range check (usos between 0 and 3) not valid;
revoke insert, update, delete on public.user_wallet, public.user_misiones, public.player_usage from anon;
alter table public.user_wallet add constraint wallet_non_negative check (sobres >= 0 and sobres_premium >= 0) not valid;

-- 3. Lineups: validated server-side
revoke delete on public.lineups from authenticated;
drop policy if exists "Own lineup all" on public.lineups;
create policy "Own lineup read" on public.lineups for select to authenticated using (auth.uid() = user_id);
create policy "Own lineup insert" on public.lineups for insert to authenticated with check (auth.uid() = user_id);
create policy "Own lineup update" on public.lineups for update to authenticated using (auth.uid() = user_id and not locked) with check (auth.uid() = user_id);

create or replace function public.tg_validate_lineup()
returns trigger language plpgsql security definer set search_path = public as $$
declare j record; slot text; pid text; ids text[]; slots text[] := array['portero','extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote','entrenador'];
begin
  -- staff/service bypass (close_jornada etc.)
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
  return new;
end $$;
drop trigger if exists validate_lineup on public.lineups;
create trigger validate_lineup before insert or update on public.lineups for each row execute function public.tg_validate_lineup();

-- 4. Missions: hide QR codes, block claiming QR missions without the code
revoke select on public.misiones from anon, authenticated;
grant select (id, nombre, descripcion, recompensa_sobres, is_active, created_at, tipo_sobre) on public.misiones to authenticated;
alter table public.misiones add column if not exists requiere_qr boolean generated always as (codigo_qr is not null) stored;
grant select (requiere_qr) on public.misiones to authenticated;

create or replace function public.claim_mision(_mision_id uuid)
 returns integer language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); m record; nuevo_saldo int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if public.has_role(uid,'super_admin') or public.has_role(uid,'manager') or public.has_role(uid,'admin') then raise exception 'no permitido'; end if;
  select recompensa_sobres, tipo_sobre, codigo_qr into m from public.misiones where id = _mision_id and is_active = true;
  if m is null then raise exception 'misión no encontrada'; end if;
  if m.codigo_qr is not null then raise exception 'misión solo por QR'; end if;
  insert into public.user_misiones(user_id, mision_id) values (uid, _mision_id);
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  if m.tipo_sobre = 'premium' then
    update public.user_wallet set sobres_premium = sobres_premium + m.recompensa_sobres where user_id = uid;
    select sobres_premium into nuevo_saldo from public.user_wallet where user_id = uid;
  else
    update public.user_wallet set sobres = sobres + m.recompensa_sobres where user_id = uid;
    select sobres into nuevo_saldo from public.user_wallet where user_id = uid;
  end if;
  return nuevo_saldo;
end $function$;

-- 5. Functions: remove legacy overload, restrict execution
drop function if exists public.open_sobre();
revoke execute on function public.email_for_username(text), public.email_for_dni(text) from public, anon, authenticated;
revoke execute on function public.claim_mision(uuid), public.claim_qr(text), public.open_sobre(text), public.close_jornada(uuid) from public, anon;
revoke execute on function public.handle_new_user(), public.tg_validate_lineup(), public.recalc_player_stats(), public.tg_recalc_stats() from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;