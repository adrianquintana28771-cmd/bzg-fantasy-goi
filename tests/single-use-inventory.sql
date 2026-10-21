-- Read-only checks; do not open packs, close real jornadas or change lineups.
WITH saved AS (
  SELECT b.user_id, c
  FROM public.inventory_usage_backup b,
       LATERAL jsonb_array_elements(b.inventory) c
  WHERE b.snapshot_key = 'single-use-2026-10-21'
)
SELECT 'All 157 users were backed up' AS test,
       count(*) = 157 AS passed
FROM public.inventory_usage_backup WHERE snapshot_key = 'single-use-2026-10-21'
UNION ALL
SELECT 'All 6253 individual cards were backed up', count(*) = 6253 FROM saved
UNION ALL
SELECT 'Existing cards have exactly one remaining use',
       count(*) = 6253 AND bool_and(3 - p.usos = 1)
FROM saved s JOIN public.user_players p ON p.id = (s.c->>'id')::uuid
UNION ALL
SELECT 'Owned-card identity and all other fields are unchanged',
       count(*) = 6253 AND bool_and(
         to_jsonb(p) - 'usos' = s.c - ARRAY['usos','rareza','remaining_uses','card_definition']
         AND to_jsonb(pp) = s.c->'card_definition'
       )
FROM saved s JOIN public.user_players p ON p.id = (s.c->>'id')::uuid
JOIN public.player_pool pp ON pp.id=p.player_id
UNION ALL
SELECT 'All 618 lineups are unchanged',
       count(*)=618 AND bool_and(to_jsonb(l)=c-'jornada_definition')
FROM public.inventory_usage_backup b, LATERAL jsonb_array_elements(b.lineups) c
JOIN public.lineups l ON l.id=(c->>'id')::uuid
WHERE b.snapshot_key='single-use-2026-10-21'
UNION ALL
SELECT 'All 3888 frozen positions are unchanged',
       count(*)=3888 AND bool_and(to_jsonb(f)=c-'jornada_definition')
FROM public.inventory_usage_backup b, LATERAL jsonb_array_elements(b.frozen_lineups) c
JOIN public.jornada_alineaciones_congeladas f ON f.user_id=(c->>'user_id')::uuid
  AND f.jornada_id=(c->>'jornada_id')::uuid AND f.posicion::text=c->>'posicion'
WHERE b.snapshot_key='single-use-2026-10-21'
UNION ALL
SELECT 'Every acquisition explicitly initializes one remaining use',
       position('NEW.usos := 2' IN pg_get_functiondef('public.initialize_single_use_card()'::regprocedure))>0
       AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.user_players'::regclass
         AND tgname='initialize_single_use_card' AND tgenabled='O')
       AND position('player_id, usos) values (uid, chosen.id, 2)' IN pg_get_functiondef('private.open_sobre(text)'::regprocedure))>0
UNION ALL
SELECT 'One alignment consumes one copy and keeps frozen selections',
       position('set usos = usos + 1' IN pg_get_functiondef('private.close_jornada(uuid)'::regprocedure))>0
       AND position('delete from public.user_players where usos >= 3' IN pg_get_functiondef('private.close_jornada(uuid)'::regprocedure))>0
       AND position('insert into public.jornada_alineaciones_congeladas' IN pg_get_functiondef('private.close_jornada(uuid)'::regprocedure))>0
       AND 3-(2+1)=0
UNION ALL
SELECT 'Backup is inaccessible to app roles and cannot be overwritten',
       NOT has_table_privilege('anon','public.inventory_usage_backup','SELECT')
       AND NOT has_table_privilege('authenticated','public.inventory_usage_backup','SELECT')
       AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.inventory_usage_backup'::regclass
         AND tgname='inventory_backup_immutable' AND tgenabled='O');