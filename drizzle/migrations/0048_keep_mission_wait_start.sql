CREATE OR REPLACE FUNCTION private.start_mision(_mision_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); started numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.misiones where id = _mision_id and is_active and codigo_qr is null) then raise exception 'misión no encontrada'; end if;
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  select (mision_starts ->> _mision_id::text)::numeric into started from public.user_wallet where user_id = uid;
  if started is not null and extract(epoch from now()) - started <= 86400 then return; end if;
  update public.user_wallet set mision_starts = mision_starts || jsonb_build_object(_mision_id::text, extract(epoch from now()))
   where user_id = uid;
end $function$;