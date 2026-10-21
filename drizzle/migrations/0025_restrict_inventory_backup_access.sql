REVOKE ALL ON public.inventory_usage_backup FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.inventory_usage_backup FROM service_role;
GRANT SELECT, INSERT ON public.inventory_usage_backup TO service_role;