-- Read-only checks against the real predicate used by claim_qr.
SELECT 'Scheduled code cannot be used before its activation' AS test,
 NOT private.mission_code_available('2026-10-17 18:00:00+02', '2026-10-17 22:00:00+02', '2026-10-17 17:59:59+02') AS passed
UNION ALL
SELECT 'Code is available exactly at the chosen time',
 private.mission_code_available('2026-10-17 18:00:00+02', '2026-10-17 22:00:00+02', '2026-10-17 18:00:00+02')
UNION ALL
SELECT 'Code remains available for four hours, not from creation time',
 private.mission_code_available('2026-10-17 18:00:00+02', '2026-10-17 18:00:00+02'::timestamptz + interval '4 hours', '2026-10-17 21:59:59+02')
UNION ALL
SELECT 'Code expires exactly four hours after activation',
 NOT private.mission_code_available('2026-10-17 18:00:00+02', '2026-10-17 18:00:00+02'::timestamptz + interval '4 hours', '2026-10-17 22:00:00+02')
UNION ALL
SELECT 'Existing immediately available codes keep working',
 private.mission_code_available(NULL, '2026-10-17 22:00:00+02', '2026-10-17 18:00:00+02')
UNION ALL
SELECT 'Madrid summer time converts to UTC correctly',
 ('2026-10-17 18:00:00'::timestamp AT TIME ZONE 'Europe/Madrid') = '2026-10-17 16:00:00+00'::timestamptz
UNION ALL
SELECT 'Madrid winter time converts to UTC correctly',
 ('2026-11-17 18:00:00'::timestamp AT TIME ZONE 'Europe/Madrid') = '2026-11-17 17:00:00+00'::timestamptz;