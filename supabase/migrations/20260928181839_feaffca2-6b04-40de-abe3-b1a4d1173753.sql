CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- Mover funciones privilegiadas al esquema interno (políticas y triggers siguen apuntando a ellas)
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.claim_mision(uuid) SET SCHEMA private;
ALTER FUNCTION public.claim_qr(text) SET SCHEMA private;
ALTER FUNCTION public.close_jornada(uuid) SET SCHEMA private;
ALTER FUNCTION public.dni_exists(text) SET SCHEMA private;
ALTER FUNCTION public.username_exists(text) SET SCHEMA private;
ALTER FUNCTION public.mark_tutorial_visto() SET SCHEMA private;
ALTER FUNCTION public.open_sobre(text) SET SCHEMA private;
ALTER FUNCTION public.user_ranking() SET SCHEMA private;
ALTER FUNCTION public.user_ranking_by_jornada() SET SCHEMA private;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role), private.claim_mision(uuid), private.claim_qr(text),
  private.close_jornada(uuid), private.mark_tutorial_visto(), private.open_sobre(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.dni_exists(text), private.username_exists(text), private.user_ranking(),
  private.user_ranking_by_jornada() TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- Envoltorios públicos sin privilegios (SECURITY INVOKER), misma firma
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ select private.has_role(_user_id, _role) $$;
CREATE FUNCTION public.claim_mision(_mision_id uuid) RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ select private.claim_mision(_mision_id) $$;
CREATE FUNCTION public.claim_qr(_codigo text) RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ select private.claim_qr(_codigo) $$;
CREATE FUNCTION public.close_jornada(_jornada_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ select private.close_jornada(_jornada_id) $$;
CREATE FUNCTION public.dni_exists(_dni text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ select private.dni_exists(_dni) $$;
CREATE FUNCTION public.username_exists(_username text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ select private.username_exists(_username) $$;
CREATE FUNCTION public.mark_tutorial_visto() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ select private.mark_tutorial_visto() $$;
CREATE FUNCTION public.open_sobre(_tipo text DEFAULT 'normal') RETURNS TABLE(p_id text, p_nombre text, p_posicion plantilla_posicion, p_rating integer, p_rareza card_rareza)
LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ select * from private.open_sobre(_tipo) $$;
CREATE FUNCTION public.user_ranking() RETURNS TABLE(user_id uuid, username text, display_name text, puntos numeric, jornadas integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ select * from private.user_ranking() $$;
CREATE FUNCTION public.user_ranking_by_jornada() RETURNS TABLE(user_id uuid, username text, display_name text, jornada integer, puntos numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ select * from private.user_ranking_by_jornada() $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role), public.claim_mision(uuid), public.claim_qr(text), public.close_jornada(uuid),
  public.mark_tutorial_visto(), public.open_sobre(text), public.dni_exists(text), public.username_exists(text),
  public.user_ranking(), public.user_ranking_by_jornada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role), public.claim_mision(uuid), public.claim_qr(text), public.close_jornada(uuid),
  public.mark_tutorial_visto(), public.open_sobre(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dni_exists(text), public.username_exists(text), public.user_ranking(), public.user_ranking_by_jornada()
  TO anon, authenticated, service_role;

-- Limpieza de alineaciones abiertas: interna y solo super_admin
CREATE OR REPLACE FUNCTION private.clear_player_from_open_lineups(_player_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare cards text[];
begin
  if not private.has_role(auth.uid(),'super_admin') then raise exception 'permiso denegado'; end if;
  select array_agg(id) into cards from public.player_pool where club_player_id = _player_id;
  if cards is null then return; end if;
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
end $function$;
REVOKE ALL ON FUNCTION private.clear_player_from_open_lineups(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.clear_player_from_open_lineups(uuid) TO authenticated, service_role;

-- Acciones de administración: sin privilegios extra, sujetas a RLS (staff) + comprobación super_admin
CREATE OR REPLACE FUNCTION public.set_player_activo(_player_id uuid, _activo boolean)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'permiso denegado'; end if;
  update public.club_players set activo = _activo where id = _player_id;
  if not found then raise exception 'jugador/a no encontrado/a'; end if;
  if not _activo then perform private.clear_player_from_open_lineups(_player_id); end if;
end $function$;

ALTER FUNCTION public.admin_save_player(uuid,text,text,text,text,club_sexo,integer,integer,player_estado,boolean,boolean,uuid[],text[],text) SECURITY INVOKER;