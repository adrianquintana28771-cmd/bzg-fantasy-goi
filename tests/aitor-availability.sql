-- Read-only regression checks for the explicitly requested historical correction.
WITH expected(jornada, puntos) AS (
  VALUES (1, 15.00), (2, 14.00), (3, 5.50), (4, 12.00),
         (5, 26.00), (6, 4.00), (7, 5.00), (8, 2.50), (9, 3.00)
), actual AS (
  SELECT s.player_id, s.jornada_numero, s.puntos, s.estado
  FROM public.player_jornada_stats s
  JOIN public.player_pool p ON p.id = s.player_id
  WHERE p.club_player_id = 'f76b6b32-7bff-41ec-b9d4-7d4db6df59e8'::uuid
    AND s.jornada_numero BETWEEN 1 AND 9
)
SELECT 'Aitor is doubtful in J1-J9 for all three rarities' AS test,
       count(*) = 27 AND bool_and(a.estado = 'dudoso') AS passed
FROM actual a
UNION ALL
SELECT 'Aitor historical points remain unchanged',
       count(*) = 27 AND bool_and(a.puntos = e.puntos)
FROM actual a JOIN expected e ON e.jornada = a.jornada_numero;