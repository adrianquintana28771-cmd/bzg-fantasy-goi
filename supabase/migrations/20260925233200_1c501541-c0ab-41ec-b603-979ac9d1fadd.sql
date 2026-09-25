alter table public.profiles add column if not exists tutorial_visto boolean not null default false;
create or replace function public.mark_tutorial_visto() returns void language sql security definer set search_path = public as $$
  update public.profiles set tutorial_visto = true where id = auth.uid();
$$;
revoke all on function public.mark_tutorial_visto() from public, anon;
grant execute on function public.mark_tutorial_visto() to authenticated;