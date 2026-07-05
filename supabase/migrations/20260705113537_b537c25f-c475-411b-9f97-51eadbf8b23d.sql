CREATE OR REPLACE FUNCTION public.dni_exists(_dni text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE dni = _dni)
$$;

GRANT EXECUTE ON FUNCTION public.dni_exists(text) TO anon, authenticated;