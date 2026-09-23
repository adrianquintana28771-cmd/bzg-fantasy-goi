create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  insert into public.user_wallet (user_id, sobres, sobres_premium) values (new.id, 3, 1)
    on conflict (user_id) do nothing;
  return new;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;