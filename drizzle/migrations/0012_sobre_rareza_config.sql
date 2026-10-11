CREATE TABLE private.sobre_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  pct_normal numeric NOT NULL,
  pct_raro numeric NOT NULL,
  pct_legendario numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Valores iniciales = probabilidades efectivas actuales (1/13 legendario; 12/13·4/13 raro)
INSERT INTO private.sobre_config VALUES (true, 69.53, 22.78, 7.69, now());
REVOKE ALL ON private.sobre_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_sobre_config()
RETURNS TABLE(pct_normal numeric, pct_raro numeric, pct_legendario numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'permiso denegado'; end if;
  return query select c.pct_normal, c.pct_raro, c.pct_legendario from private.sobre_config c;
end $$;

CREATE OR REPLACE FUNCTION public.admin_save_sobre_config(_normal numeric, _raro numeric, _legendario numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'permiso denegado'; end if;
  if _normal is null or _raro is null or _legendario is null or _normal < 0 or _raro < 0 or _legendario < 0 then
    raise exception 'porcentajes no válidos'; end if;
  if abs(_normal + _raro + _legendario - 100) > 0.001 then raise exception 'deben sumar 100'; end if;
  update private.sobre_config set pct_normal=_normal, pct_raro=_raro, pct_legendario=_legendario, updated_at=now();
end $$;
REVOKE ALL ON FUNCTION public.admin_get_sobre_config() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_sobre_config(numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_sobre_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_sobre_config(numeric,numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION private.open_sobre(_tipo text DEFAULT 'normal'::text)
 RETURNS TABLE(p_id text, p_nombre text, p_posicion plantilla_posicion, p_rating integer, p_rareza card_rareza)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); saldo int; i int; target public.card_rareza; chosen record; cfg record; r numeric;
  mmin numeric; mmax numeric;
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
  select * into cfg from private.sobre_config limit 1;
  -- Media de puntos por jornada (jornadas con puntos ≠ 0) por carta; sin datos = 0
  create temp table _media on commit drop as
    select pp.id, coalesce((select avg(s.puntos) from public.player_jornada_stats s
      where s.player_id = pp.id and s.puntos <> 0), 0) as media
    from public.player_pool pp left join public.club_players cp on cp.id = pp.club_player_id
    where coalesce(cp.activo, true);
  select min(media), max(media) into mmin, mmax from _media;
  create temp table _sobre(id text, nombre text, posicion plantilla_posicion, rating int, rareza card_rareza) on commit drop;
  for i in 1..3 loop
    if _tipo = 'premium' and i = 1 then
      target := case when random() < 0.25 then 'legendario'::card_rareza else 'raro'::card_rareza end;
    else
      r := random() * 100;
      target := case when r < cfg.pct_legendario then 'legendario'::card_rareza
        when r < cfg.pct_legendario + cfg.pct_raro then 'raro'::card_rareza else 'normal'::card_rareza end;
    end if;
    chosen := null;
    -- Selección ponderada: factor = 1 - 0,10·(media-min)/(max-min)
    select pp.id, pp.nombre, pp.posicion, pp.rating, pp.rareza into chosen
      from public.player_pool pp join _media m on m.id = pp.id
      where pp.rareza = target
      order by -ln(1 - random()) / (case when mmax > mmin then 1 - 0.10 * (m.media - mmin) / (mmax - mmin) else 1 end)
      limit 1;
    if chosen.id is null then
      select pp.id, pp.nombre, pp.posicion, pp.rating, pp.rareza into chosen
        from public.player_pool pp join _media m on m.id = pp.id order by random() limit 1;
    end if;
    insert into public.user_players(user_id, player_id) values (uid, chosen.id);
    insert into _sobre values (chosen.id, chosen.nombre, chosen.posicion, chosen.rating, chosen.rareza);
  end loop;
  return query select s.id, s.nombre, s.posicion, s.rating, s.rareza from _sobre s;
end $function$;