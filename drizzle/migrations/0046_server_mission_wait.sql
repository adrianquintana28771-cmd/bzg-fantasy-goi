ALTER TABLE public.user_wallet ADD COLUMN IF NOT EXISTS mision_starts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION private.start_mision(_mision_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.misiones where id = _mision_id and is_active and codigo_qr is null) then raise exception 'misión no encontrada'; end if;
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  update public.user_wallet set mision_starts = mision_starts || jsonb_build_object(_mision_id::text, extract(epoch from now()))
   where user_id = uid;
end $f$;
REVOKE ALL ON FUNCTION private.start_mision(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.start_mision(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_mision(_mision_id uuid)
 RETURNS void LANGUAGE sql SET search_path TO 'public'
AS $f$ select private.start_mision(_mision_id) $f$;
REVOKE ALL ON FUNCTION public.start_mision(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_mision(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.claim_mision(_mision_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); m record; nuevo_saldo int; prev timestamptz; started numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.user_roles where user_id = uid and role in ('admin','manager','super_admin','admin_misiones')) then raise exception 'no permitido'; end if;
  select recompensa_sobres, tipo_sobre, codigo_qr, semanal, coalesce(espera_segundos,0) as espera into m from public.misiones where id = _mision_id and is_active = true;
  if m is null then raise exception 'misión no encontrada'; end if;
  if m.codigo_qr is not null then raise exception 'misión solo por QR'; end if;
  perform pg_advisory_xact_lock(hashtext('claim_mision:' || uid::text));
  if m.espera > 0 then
    select (mision_starts ->> _mision_id::text)::numeric into started from public.user_wallet where user_id = uid;
    if started is null or extract(epoch from now()) - started > 86400 then raise exception 'espera_mision'; end if;
    if extract(epoch from now()) - started < m.espera - 2 then raise exception 'espera_mision_pendiente'; end if;
  end if;
  select claimed_at into prev from public.user_misiones where user_id = uid and mision_id = _mision_id;
  if prev is null then
    insert into public.user_misiones(user_id, mision_id) values (uid, _mision_id);
  elsif m.semanal and prev < (date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') then
    update public.user_misiones set claimed_at = now() where user_id = uid and mision_id = _mision_id;
  else
    raise exception 'misión ya completada';
  end if;
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  update public.user_wallet set mision_starts = mision_starts - _mision_id::text where user_id = uid;
  if m.tipo_sobre = 'premium' then
    update public.user_wallet set sobres_premium = sobres_premium + m.recompensa_sobres where user_id = uid;
    select sobres_premium into nuevo_saldo from public.user_wallet where user_id = uid;
  else
    update public.user_wallet set sobres = sobres + m.recompensa_sobres where user_id = uid;
    select sobres into nuevo_saldo from public.user_wallet where user_id = uid;
  end if;
  return nuevo_saldo;
end $function$;