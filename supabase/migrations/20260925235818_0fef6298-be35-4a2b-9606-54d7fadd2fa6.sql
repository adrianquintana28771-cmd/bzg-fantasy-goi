ALTER TABLE public.misiones ADD COLUMN IF NOT EXISTS semanal boolean NOT NULL DEFAULT false;
ALTER TABLE public.misiones ADD COLUMN IF NOT EXISTS espera_segundos integer NOT NULL DEFAULT 0;
UPDATE public.misiones SET semanal = true WHERE id IN ('a8d4a002-7985-4f2a-a23b-b2079a97bd02','a8d4a003-7985-4f2a-a23b-b2079a97bd03');
INSERT INTO public.misiones (id,nombre,descripcion,recompensa_sobres,tipo_sobre,is_active,semanal,espera_segundos,created_at) VALUES
('a8d4a004-7985-4f2a-a23b-b2079a97bd04','Sigue a BerdeZuriGorri en TikTok','Sigue a BerdeZuriGorri en TikTok',1,'normal',true,false,60, now()+interval '1 second'),
('a8d4a005-7985-4f2a-a23b-b2079a97bd05','Sigue a BerdeZuriGorri en Instagram','Sigue a BerdeZuriGorri en Instagram',1,'normal',true,false,60, now()+interval '2 second'),
('a8d4a006-7985-4f2a-a23b-b2079a97bd06','Da like a la última publicación de TikTok','Da like a la última publicación de TikTok',1,'normal',true,true,60, now()+interval '3 second'),
('a8d4a007-7985-4f2a-a23b-b2079a97bd07','Da like a la última publicación de Instagram','Da like a la última publicación de Instagram',1,'normal',true,true,60, now()+interval '4 second')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_mision(_mision_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); m record; nuevo_saldo int; prev timestamptz;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if public.has_role(uid,'super_admin') or public.has_role(uid,'manager') or public.has_role(uid,'admin') then raise exception 'no permitido'; end if;
  select recompensa_sobres, tipo_sobre, codigo_qr, semanal into m from public.misiones where id = _mision_id and is_active = true;
  if m is null then raise exception 'misión no encontrada'; end if;
  if m.codigo_qr is not null then raise exception 'misión solo por QR'; end if;
  select claimed_at into prev from public.user_misiones where user_id = uid and mision_id = _mision_id;
  if prev is null then
    insert into public.user_misiones(user_id, mision_id) values (uid, _mision_id);
  elsif m.semanal and prev < (date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') then
    update public.user_misiones set claimed_at = now() where user_id = uid and mision_id = _mision_id;
  else
    raise exception 'misión ya completada';
  end if;
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