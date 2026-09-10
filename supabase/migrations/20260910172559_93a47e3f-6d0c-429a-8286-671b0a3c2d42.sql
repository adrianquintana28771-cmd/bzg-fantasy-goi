-- ENUMS
create type public.club_categoria as enum ('cadete','juvenil','senior');
create type public.club_sexo as enum ('masculino','femenino');

-- SEASONS
create table public.club_seasons (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.club_seasons to authenticated;
grant all on public.club_seasons to service_role;
alter table public.club_seasons enable row level security;
create policy "auth read seasons" on public.club_seasons for select to authenticated using (true);
create policy "super manage seasons" on public.club_seasons for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- TEAMS
create table public.club_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.club_seasons(id) on delete cascade,
  nombre text not null,
  categoria public.club_categoria not null,
  sexo public.club_sexo not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, nombre)
);
grant select on public.club_teams to authenticated;
grant all on public.club_teams to service_role;
alter table public.club_teams enable row level security;
create policy "auth read teams" on public.club_teams for select to authenticated using (true);
create policy "staff manage teams" on public.club_teams for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'));

-- PLAYERS
create table public.club_players (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  alias text,
  sexo public.club_sexo not null,
  anio_nacimiento int,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.club_players to authenticated;
grant all on public.club_players to service_role;
alter table public.club_players enable row level security;
create policy "auth read players" on public.club_players for select to authenticated using (true);
create policy "staff manage players" on public.club_players for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'));

-- PLAYER <-> TEAM (N:M, same sexo)
create table public.club_player_teams (
  player_id uuid not null references public.club_players(id) on delete cascade,
  team_id uuid not null references public.club_teams(id) on delete cascade,
  dorsal int,
  created_at timestamptz not null default now(),
  primary key (player_id, team_id)
);
grant select on public.club_player_teams to authenticated;
grant all on public.club_player_teams to service_role;
alter table public.club_player_teams enable row level security;
create policy "auth read player_teams" on public.club_player_teams for select to authenticated using (true);
create policy "staff manage player_teams" on public.club_player_teams for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'));

create or replace function public.tg_check_player_team_sexo()
returns trigger language plpgsql set search_path = public as $$
declare p_sexo public.club_sexo; t_sexo public.club_sexo;
begin
  select sexo into p_sexo from public.club_players where id = new.player_id;
  select sexo into t_sexo from public.club_teams where id = new.team_id;
  if p_sexo is distinct from t_sexo then
    raise exception 'El sexo del jugador/a (%) no coincide con el del equipo (%)', p_sexo, t_sexo;
  end if;
  return new;
end $$;
create trigger check_player_team_sexo before insert or update on public.club_player_teams
  for each row execute function public.tg_check_player_team_sexo();

-- POSITIONS
create table public.club_positions (
  id text primary key,
  nombre text not null,
  orden int not null default 0
);
grant select on public.club_positions to authenticated;
grant all on public.club_positions to service_role;
alter table public.club_positions enable row level security;
create policy "auth read positions" on public.club_positions for select to authenticated using (true);
create policy "super manage positions" on public.club_positions for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create table public.club_player_positions (
  player_id uuid not null references public.club_players(id) on delete cascade,
  position_id text not null references public.club_positions(id) on delete cascade,
  es_principal boolean not null default false,
  primary key (player_id, position_id)
);
grant select on public.club_player_positions to authenticated;
grant all on public.club_player_positions to service_role;
alter table public.club_player_positions enable row level security;
create policy "auth read player_positions" on public.club_player_positions for select to authenticated using (true);
create policy "staff manage player_positions" on public.club_player_positions for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'));

-- MATCHES
create table public.club_matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.club_seasons(id) on delete cascade,
  team_id uuid not null references public.club_teams(id) on delete cascade,
  rival text not null,
  fecha date not null,
  jornada int not null default 1,
  es_local boolean not null default true,
  goles_favor int not null default 0,
  goles_contra int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.club_matches to authenticated;
grant all on public.club_matches to service_role;
alter table public.club_matches enable row level security;
create policy "auth read matches" on public.club_matches for select to authenticated using (true);
create policy "staff manage matches" on public.club_matches for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'manager'));

-- ACTION CATALOG
create table public.club_action_types (
  id text primary key,
  nombre text not null,
  puntos numeric(4,1) not null default 0,
  grupo text not null default 'ataque',
  solo_portero boolean not null default false,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.club_action_types to authenticated;
grant all on public.club_action_types to service_role;
alter table public.club_action_types enable row level security;
create policy "auth read actions" on public.club_action_types for select to authenticated using (true);
create policy "super manage actions" on public.club_action_types for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- PERFORMANCE
create table public.club_match_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.club_matches(id) on delete cascade,
  player_id uuid not null references public.club_players(id) on delete cascade,
  action_id text not null references public.club_action_types(id) on delete cascade,
  cantidad int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id, action_id)
);
grant select, insert, update, delete on public.club_match_actions to authenticated;
grant all on public.club_match_actions to service_role;
alter table public.club_match_actions enable row level security;
create policy "auth read match actions" on public.club_match_actions for select to authenticated using (true);
create policy "stats staff manage match actions" on public.club_match_actions for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'admin'));

create table public.club_match_players (
  match_id uuid not null references public.club_matches(id) on delete cascade,
  player_id uuid not null references public.club_players(id) on delete cascade,
  jugado boolean not null default true,
  minutos int,
  primary key (match_id, player_id)
);
grant select, insert, update, delete on public.club_match_players to authenticated;
grant all on public.club_match_players to service_role;
alter table public.club_match_players enable row level security;
create policy "auth read match players" on public.club_match_players for select to authenticated using (true);
create policy "stats staff manage match players" on public.club_match_players for all to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'admin'));

-- updated_at triggers
create trigger t1 before update on public.club_seasons for each row execute function public.tg_set_updated_at();
create trigger t2 before update on public.club_teams for each row execute function public.tg_set_updated_at();
create trigger t3 before update on public.club_players for each row execute function public.tg_set_updated_at();
create trigger t4 before update on public.club_matches for each row execute function public.tg_set_updated_at();
create trigger t5 before update on public.club_action_types for each row execute function public.tg_set_updated_at();
create trigger t6 before update on public.club_match_actions for each row execute function public.tg_set_updated_at();

-- POINTS VIEW
create or replace view public.club_player_match_points
with (security_invoker = true) as
select ma.match_id, ma.player_id,
       sum(ma.cantidad * at.puntos)::numeric(8,1) as puntos
from public.club_match_actions ma
join public.club_action_types at on at.id = ma.action_id and at.activo
group by ma.match_id, ma.player_id;
grant select on public.club_player_match_points to authenticated;

-- SEED positions
insert into public.club_positions (id, nombre, orden) values
 ('portero','Portero/a',1),('extremo_izq','Extremo izquierdo',2),('extremo_der','Extremo derecho',3),
 ('lateral_izq','Lateral izquierdo',4),('lateral_der','Lateral derecho',5),
 ('central','Central',6),('pivote','Pivote',7),('defensa','Especialista defensivo',8);

-- SEED action types
insert into public.club_action_types (id, nombre, puntos, grupo, solo_portero, orden) values
 ('gol','Gol',3,'ataque',false,1),
 ('gol_fly','Gol de fly',10,'ataque',false,2),
 ('gol_rosca','Gol de rosca',10,'ataque',false,3),
 ('gol_vaselina','Gol de vaselina',5,'ataque',false,4),
 ('gol_7m','Gol de 7 metros',2,'ataque',false,5),
 ('gol_contraataque','Gol de contraataque',4,'ataque',false,6),
 ('asistencia','Asistencia de gol',1.5,'ataque',false,10),
 ('asistencia_fly','Asistencia de fly',5,'ataque',false,11),
 ('asistencia_rosca','Asistencia de rosca',5,'ataque',false,12),
 ('asistencia_vaselina','Asistencia de vaselina',2.5,'ataque',false,13),
 ('asistencia_portero','Asistencia de portero/a',3,'ataque',true,14),
 ('siete_provocado','7 metros provocado',2,'ataque',false,20),
 ('exclusion_provocada','Exclusión provocada',2,'ataque',false,21),
 ('robo','Robo de balón',2,'defensa',false,30),
 ('corte','Corte de balón',2,'defensa',false,31),
 ('blocaje','Blocaje defensivo',2,'defensa',false,32),
 ('parada','Parada',5,'portería',true,40),
 ('parada_7m','Parada de 7 metros',8,'portería',true,41),
 ('gol_encajado','Gol encajado',-0.5,'portería',true,42),
 ('lanzamiento_fallado','Lanzamiento fallado',-0.5,'negativo',false,50),
 ('pase_fallado','Pase fallado',-0.5,'negativo',false,51),
 ('perdida','Pérdida de balón',-1,'negativo',false,52),
 ('siete_fallado','7 metros fallado',-2,'negativo',false,53),
 ('pasos','Pasos / dobles',-0.5,'negativo',false,54),
 ('falta_en_ataque','Falta en ataque',-1,'negativo',false,55),
 ('exclusion_2min','Exclusión de 2 minutos',-2,'negativo',false,56),
 ('tarjeta_roja','Tarjeta roja',-5,'negativo',false,57),
 ('mvp','MVP del partido',5,'bonus',false,60),
 ('partido_jugado','Partido jugado',2,'bonus',false,61),
 ('victoria','Victoria del equipo',3,'bonus',false,62);

-- SEED season + teams
insert into public.club_seasons (nombre, is_active) values ('2024/25', true);
insert into public.club_teams (season_id, nombre, categoria, sexo)
select s.id, t.nombre, t.categoria::public.club_categoria, t.sexo::public.club_sexo
from public.club_seasons s,
 (values ('BZG Cadete Masculino','cadete','masculino'),
         ('BZG Cadete Femenino','cadete','femenino'),
         ('BZG Juvenil Masculino','juvenil','masculino'),
         ('BZG Juvenil Femenino','juvenil','femenino'),
         ('BZG Senior Masculino','senior','masculino'),
         ('BZG Senior Femenino','senior','femenino')) as t(nombre,categoria,sexo)
where s.nombre = '2024/25';