CREATE TABLE public.inventory_usage_backup (
  snapshot_key text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  inventory jsonb NOT NULL DEFAULT '[]'::jsonb,
  lineups jsonb NOT NULL DEFAULT '[]'::jsonb,
  frozen_lineups jsonb NOT NULL DEFAULT '[]'::jsonb,
  player_usage jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (snapshot_key, user_id)
);
GRANT SELECT, INSERT ON public.inventory_usage_backup TO service_role;
ALTER TABLE public.inventory_usage_backup ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.inventory_usage_backup IS 'Immutable per-user inventory and lineup snapshot before the single-remaining-use change; includes original consumed uses, remaining uses and full card definitions. No auth credentials or foreign keys to live users.';
CREATE FUNCTION public.prevent_inventory_backup_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'La copia de inventarios es inmutable';
END;
$$;
CREATE TRIGGER inventory_backup_immutable BEFORE UPDATE OR DELETE ON public.inventory_usage_backup
FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_backup_mutation();
ALTER TABLE public.user_players ALTER COLUMN usos SET DEFAULT 2;
CREATE FUNCTION public.initialize_single_use_card()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- usos counts consumed uses; the existing exhaustion limit is three.
  -- Every acquisition therefore begins with exactly one remaining use.
  NEW.usos := 2;
  RETURN NEW;
END;
$$;
CREATE TRIGGER initialize_single_use_card BEFORE INSERT ON public.user_players
FOR EACH ROW EXECUTE FUNCTION public.initialize_single_use_card();