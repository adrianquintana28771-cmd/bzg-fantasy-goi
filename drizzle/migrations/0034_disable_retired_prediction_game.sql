COMMENT ON TABLE public.predicciones IS 'DEPRECATED: prediction participation retired; keep empty and inaccessible.';
COMMENT ON TABLE public.prediccion_recompensas IS 'DEPRECATED: prediction rewards retired; keep empty and inaccessible.';
REVOKE ALL ON TABLE public.predicciones, public.prediccion_recompensas FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.predicciones ADD CONSTRAINT prediction_game_retired CHECK (false) NOT VALID;
ALTER TABLE public.prediccion_recompensas ADD CONSTRAINT prediction_rewards_retired CHECK (false) NOT VALID;
CREATE OR REPLACE FUNCTION public.tg_prediccion_open() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Predicción retirada'; END; $$;
COMMENT ON FUNCTION public.tg_prediccion_open() IS 'DEPRECATED: reject writes from retired prediction clients.';