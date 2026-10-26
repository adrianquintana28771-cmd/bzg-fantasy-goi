-- Read-only regression checks for the assistant-only account.
SELECT 'Exactly one lovable account exists' AS test,
  count(*) = 1 AS passed FROM public.profiles WHERE username = 'lovable'
UNION ALL
SELECT 'lovable has only the user role', count(*) = 1 AND bool_and(r.role = 'user')
FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id WHERE p.username = 'lovable'
UNION ALL
SELECT 'lovable is absent from the overall ranking',
  NOT EXISTS (SELECT 1 FROM public.user_ranking() WHERE username = 'lovable')
UNION ALL
SELECT 'lovable is absent from all jornada rankings',
  NOT EXISTS (SELECT 1 FROM public.user_ranking_by_jornada() WHERE username = 'lovable')
UNION ALL
SELECT 'lovable lineup details are hidden',
  NOT EXISTS (SELECT 1 FROM public.profiles p CROSS JOIN LATERAL public.ranking_user_lineup(p.id) r WHERE p.username = 'lovable')
UNION ALL
SELECT 'Other users cannot list the test profile',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Test profile visible only to itself' AND permissive = 'RESTRICTIVE'
    AND cmd = 'SELECT' AND qual LIKE '%lovable%' AND qual LIKE '%auth.uid()%');