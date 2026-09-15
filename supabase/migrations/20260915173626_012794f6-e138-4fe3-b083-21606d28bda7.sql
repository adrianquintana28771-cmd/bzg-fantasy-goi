revoke execute on function public.open_sobre(text) from anon;
revoke execute on function public.claim_mision(uuid) from anon;
revoke execute on function public.claim_qr(text) from anon;
revoke execute on function public.close_jornada(uuid) from anon;
revoke execute on function public.has_role(uuid, app_role) from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.tg_set_updated_at() from anon, authenticated;
revoke execute on function public.tg_check_player_team_sexo() from anon, authenticated;