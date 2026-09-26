CREATE OR REPLACE FUNCTION public.tg_check_player_team_sexo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare p_sexo public.club_sexo; t_sexo public.club_sexo; p_entrenador boolean;
begin
  select sexo, es_entrenador into p_sexo, p_entrenador from public.club_players where id = new.player_id;
  if p_entrenador then
    return new;
  end if;
  select sexo into t_sexo from public.club_teams where id = new.team_id;
  if p_sexo is distinct from t_sexo then
    raise exception 'El sexo del jugador/a (%) no coincide con el del equipo (%)', p_sexo, t_sexo;
  end if;
  return new;
end $function$;