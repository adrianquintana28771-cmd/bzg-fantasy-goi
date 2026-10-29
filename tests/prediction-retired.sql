-- Read-only retirement checks; these queries must return true.
SELECT count(*) = 0 AS no_predictions FROM public.predicciones;
SELECT count(*) = 0 AS no_prediction_rewards FROM public.prediccion_recompensas;
SELECT count(*) = 2 AS retired_write_constraints
FROM pg_constraint
WHERE conname IN ('prediction_game_retired', 'prediction_rewards_retired')
  AND pg_get_constraintdef(oid) = 'CHECK (false) NOT VALID';
SELECT count(*) = 0 AS no_client_privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('predicciones', 'prediccion_recompensas')
  AND grantee IN ('anon', 'authenticated', 'service_role');