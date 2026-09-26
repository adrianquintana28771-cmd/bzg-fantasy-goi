CREATE OR REPLACE FUNCTION public.mark_tutorial_visto()
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ update public.profiles set tutorial_visto = true where id = auth.uid() and tutorial_visto = false; $$;

CREATE OR REPLACE FUNCTION public.tg_tutorial_mision_visto()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ begin
  if NEW.mision_id::text like 'a8d4a001%' then
    update public.profiles set tutorial_visto = true where id = NEW.user_id and tutorial_visto = false;
  end if;
  return NEW;
end $$;
REVOKE ALL ON FUNCTION public.tg_tutorial_mision_visto() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS user_misiones_tutorial_visto ON public.user_misiones;
CREATE TRIGGER user_misiones_tutorial_visto AFTER INSERT ON public.user_misiones
FOR EACH ROW EXECUTE FUNCTION public.tg_tutorial_mision_visto();

UPDATE public.profiles p SET tutorial_visto = true
WHERE tutorial_visto = false AND EXISTS (
  SELECT 1 FROM public.user_misiones um WHERE um.user_id = p.id AND um.mision_id::text LIKE 'a8d4a001%');