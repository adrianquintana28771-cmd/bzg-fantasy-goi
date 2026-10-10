CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.cron_tokens (nombre text PRIMARY KEY, token text NOT NULL);
REVOKE ALL ON private.cron_tokens FROM PUBLIC, anon, authenticated;
INSERT INTO private.cron_tokens (nombre, token) VALUES ('sync_partidos', encode(gen_random_bytes(24), 'hex')) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.check_cron_token(_nombre text, _token text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT EXISTS (SELECT 1 FROM private.cron_tokens WHERE nombre = _nombre AND token = _token AND length(_token) > 20)
$$;
REVOKE ALL ON FUNCTION public.check_cron_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_cron_token(text, text) TO service_role;