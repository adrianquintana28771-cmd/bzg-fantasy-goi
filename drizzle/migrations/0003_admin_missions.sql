ALTER TABLE public.misiones ADD COLUMN IF NOT EXISTS enlace text, ADD COLUMN IF NOT EXISTS creada_admin boolean NOT NULL DEFAULT false;
GRANT SELECT (enlace, creada_admin) ON public.misiones TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_mision(_id uuid, _nombre text, _descripcion text, _enlace text, _recompensa integer, _semanal boolean, _activa boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare nid uuid; e text := nullif(btrim(coalesce(_enlace,'')),'');
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'Forbidden'; end if;
  if length(btrim(coalesce(_nombre,''))) < 2 or length(_nombre) > 120 then raise exception 'título no válido'; end if;
  if length(coalesce(_descripcion,'')) > 500 then raise exception 'descripción demasiado larga'; end if;
  if e is not null and (e !~* '^https?://' or length(e) > 500) then raise exception 'enlace no válido'; end if;
  if _recompensa is null or _recompensa < 1 or _recompensa > 10 then raise exception 'recompensa no válida'; end if;
  if _id is null then
    insert into public.misiones(nombre, descripcion, recompensa_sobres, tipo_sobre, semanal, espera_segundos, is_active, enlace, creada_admin)
    values (btrim(_nombre), coalesce(btrim(_descripcion),''), _recompensa, 'normal', coalesce(_semanal,false), 0, coalesce(_activa,true), e, true)
    returning id into nid;
  else
    update public.misiones set nombre=btrim(_nombre), descripcion=coalesce(btrim(_descripcion),''), recompensa_sobres=_recompensa,
      semanal=coalesce(_semanal,false), is_active=coalesce(_activa,true), enlace=e
    where id=_id and creada_admin returning id into nid;
    if nid is null then raise exception 'misión no encontrada'; end if;
  end if;
  return nid;
end $$;

CREATE OR REPLACE FUNCTION public.admin_delete_mision(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'Forbidden'; end if;
  delete from public.user_misiones where mision_id=_id and exists (select 1 from public.misiones where id=_id and creada_admin);
  delete from public.misiones where id=_id and creada_admin;
end $$;

REVOKE ALL ON FUNCTION public.admin_save_mision(uuid,text,text,text,integer,boolean,boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_delete_mision(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_mision(uuid,text,text,text,integer,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_mision(uuid) TO authenticated;