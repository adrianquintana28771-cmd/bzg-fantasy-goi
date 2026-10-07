ALTER TABLE public.misiones ADD COLUMN IF NOT EXISTS caduca_at timestamptz;

CREATE OR REPLACE FUNCTION private.claim_qr(_codigo text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  m record;
  nuevo_saldo int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id, recompensa_sobres, caduca_at into m from public.misiones
    where is_active = true and codigo_qr is not null and lower(codigo_qr) = lower(trim(_codigo))
    order by (caduca_at is null or caduca_at > now()) desc, created_at desc limit 1;
  if m is null then raise exception 'código no válido'; end if;
  if m.caduca_at is not null and m.caduca_at <= now() then raise exception 'código caducado'; end if;
  if exists (select 1 from public.user_misiones where user_id = uid and mision_id = m.id) then
    raise exception 'ya has canjeado este código';
  end if;
  insert into public.user_misiones(user_id, mision_id) values (uid, m.id);
  insert into public.user_wallet(user_id) values (uid) on conflict (user_id) do nothing;
  update public.user_wallet set sobres_premium = sobres_premium + m.recompensa_sobres where user_id = uid;
  select sobres_premium into nuevo_saldo from public.user_wallet where user_id = uid;
  return nuevo_saldo;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_create_mission_code(_codigo text)
 RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
declare c text := upper(trim(_codigo)); exp timestamptz := now() + interval '4 hours';
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'no permitido'; end if;
  if c is null or length(c) < 3 or length(c) > 40 or c !~ '^[A-Z0-9_-]+$' then raise exception 'código inválido'; end if;
  if exists (select 1 from public.misiones where is_active and lower(codigo_qr) = lower(c) and (caduca_at is null or caduca_at > now())) then
    raise exception 'código ya activo';
  end if;
  insert into public.misiones(nombre, descripcion, recompensa_sobres, tipo_sobre, codigo_qr, requiere_qr, semanal, is_active, caduca_at)
  values ('Código ' || c, 'Código de misión', 1, 'premium', c, true, false, true, exp);
  return exp;
end $function$;
GRANT EXECUTE ON FUNCTION public.admin_create_mission_code(text) TO authenticated;