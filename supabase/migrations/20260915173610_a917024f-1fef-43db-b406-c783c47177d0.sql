-- ============ 1. Jugadores del club ============
create type public.player_estado as enum ('disponible','dudoso','no_disponible');

alter table public.club_players
  add column if not exists apellido1 text,
  add column if not exists apellido2 text,
  add column if not exists dorsal integer,
  add column if not exists estado public.player_estado not null default 'disponible';

-- ============ 2. Rarezas ============
create type public.card_rareza as enum ('normal','raro','legendario');

alter table public.player_pool
  add column if not exists rareza public.card_rareza not null default 'normal',
  add column if not exists apellido1 text,
  add column if not exists dorsal integer,
  add column if not exists estado public.player_estado not null default 'disponible';

update public.player_pool set rating = least(greatest(rating,1),99);
update public.player_pool set rareza = case
  when rating >= 88 then 'legendario'::public.card_rareza
  when rating >= 78 then 'raro'::public.card_rareza
  else 'normal'::public.card_rareza end;

-- ============ 3. Perfiles: username / nombre / apellido ============
alter table public.profiles
  add column if not exists username text,
  add column if not exists nombre text,
  add column if not exists apellido text;

create unique index if not exists profiles_username_key on public.profiles (lower(username));

update public.profiles set username = coalesce(username, display_name, dni);

create or replace function public.username_exists(_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where lower(username) = lower(_username))
$$;

create or replace function public.email_for_username(_username text)
returns text language sql stable security definer set search_path = public as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(_username) limit 1
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, dni, display_name, username, nombre, apellido)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'dni', new.id::text),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'username', new.id::text),
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellido'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.user_wallet (user_id, sobres) values (new.id, 3)
    on conflict (user_id) do nothing;
  return new;
end $$;

-- ============ 4. Monedero: sobres premium ============
alter table public.user_wallet
  add column if not exists sobres_premium integer not null default 0;

-- ============ 5. Misiones: tipo de sobre y QR ============
alter table public.misiones
  add column if not exists tipo_sobre text not null default 'normal',
  add column if not exists codigo_qr text;

-- ============ 6. Inventario con repetidos y 3 usos por copia ============
alter table public.user_players
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists usos integer not null default 0;

alter table public.user_players drop constraint if exists user_players_pkey;
alter table public.user_players add primary key (id);
create index if not exists user_players_user_idx on public.user_players (user_id);

-- ============ 7. Abrir sobre (normal / premium) ============
create or replace function public.open_sobre(_tipo text default 'normal')
returns table(p_id text, p_nombre text, p_posicion plantilla_posicion, p_rating integer, p_rareza card_rareza)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  saldo int;
  i int;
  target public.card_rareza;
  chosen record;
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
      target := case
        when random() < 1.0/13 then 'legendario'::card_rareza
        when random() < 4.0/13 then 'raro'::card_rareza
        else 'normal'::card_rareza end;
    end if;

    select pp.id, pp.nombre, pp.posicion, pp.rating, pp.rareza into chosen
      from public.player_pool pp where pp.rareza = target order by random() limit 1;
    if chosen.id is null then
      select pp.id, pp.nombre, pp.posicion, pp.rating, pp.rareza into chosen
        from public.player_pool pp order by random() limit 1;
    end if;

    insert into public.user_players(user_id, player_id) values (uid, chosen.id);
    insert into _sobre values (chosen.id, chosen.nombre, chosen.posicion, chosen.rating, chosen.rareza);
  end loop;

  return query select s.id, s.nombre, s.posicion, s.rating, s.rareza from _sobre s;
end $$;

-- ============ 8. Reclamar misión (según tipo de sobre) ============
create or replace function public.claim_mision(_mision_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m record;
  nuevo_saldo int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select recompensa_sobres, tipo_sobre into m from public.misiones
    where id = _mision_id and is_active = true;
  if m is null then raise exception 'misión no encontrada'; end if;

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
end $$;

-- ============ 9. Canjear código QR (sobre premium) ============
create or replace function public.claim_qr(_codigo text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m record;
  nuevo_saldo int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id, recompensa_sobres into m from public.misiones
    where is_active = true and codigo_qr is not null and lower(codigo_qr) = lower(trim(_codigo));
  if m is null then raise exception 'código no válido'; end if;
  if exists (select 1 from public.user_misiones where user_id = uid and mision_id = m.id) then
    raise exception 'ya has canjeado este código';
  end if;

  insert into public.user_misiones(user_id, mision_id) values (uid, m.id);
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  update public.user_wallet set sobres_premium = sobres_premium + m.recompensa_sobres where user_id = uid;
  select sobres_premium into nuevo_saldo from public.user_wallet where user_id = uid;
  return nuevo_saldo;
end $$;

-- ============ 10. Cierre de jornada: gasta 1 uso por copia ============
create or replace function public.close_jornada(_jornada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; copia uuid;
begin
  if not (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager')) then
    raise exception 'permiso denegado';
  end if;

  for r in
    select user_id, unnest(array[portero,extremo_izq,extremo_der,lateral_izq,lateral_der,central,pivote]) as pid
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

-- ============ 11. Lectura pública (sin cuenta) ============
grant select on public.club_seasons, public.club_teams, public.club_players,
  public.club_player_teams, public.club_positions, public.club_player_positions,
  public.club_matches, public.club_action_types, public.club_match_actions,
  public.club_match_players, public.player_pool to anon;

create policy "public read seasons" on public.club_seasons for select to anon using (true);
create policy "public read teams" on public.club_teams for select to anon using (true);
create policy "public read players" on public.club_players for select to anon using (true);
create policy "public read player_teams" on public.club_player_teams for select to anon using (true);
create policy "public read positions" on public.club_positions for select to anon using (true);
create policy "public read player_positions" on public.club_player_positions for select to anon using (true);
create policy "public read matches" on public.club_matches for select to anon using (true);
create policy "public read actions" on public.club_action_types for select to anon using (true);
create policy "public read match_actions" on public.club_match_actions for select to anon using (true);
create policy "public read match_players" on public.club_match_players for select to anon using (true);
create policy "public read pool" on public.player_pool for select to anon using (true);