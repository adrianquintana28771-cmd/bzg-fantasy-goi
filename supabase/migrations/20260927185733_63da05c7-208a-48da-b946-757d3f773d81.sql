WITH c(cid, nombre, ape, team) AS (VALUES
 ('66343354-1a84-4b3d-9c8d-26c5296f1ba7'::uuid,'Gorka Garcia','Garcia','4a1b7ed9-13af-4fbd-b142-fbf6da6037a1'),
 ('24098901-5b6a-4cf6-919f-2cf0ff898a32'::uuid,'Iñigo Penacho','Penacho','4a1b7ed9-13af-4fbd-b142-fbf6da6037a1'),
 ('e741fa0a-34e5-40a3-b1e5-d5e587e04d99'::uuid,'Txerra Resa','Resa','3dae4f92-37e4-4a5e-ba0e-407597731a07'),
 ('239842d0-f174-46f7-a7ee-f62f16b3fb33'::uuid,'Liher Gorostola','Gorostola','1b3f9148-468c-4e19-8949-a8f6a806c5df'),
 ('2130c592-4f42-4e69-986b-f7be39c0d7d8'::uuid,'Pablo Aguinaco','Aguinaco','daaed2e1-ac36-44c0-a87c-5ebf7778f5e4'),
 ('c640f1ba-8978-4049-92ea-28c27a414306'::uuid,'Sergio Gondra','Gondra','daaed2e1-ac36-44c0-a87c-5ebf7778f5e4')
), r(suf, rar) AS (VALUES ('', 'normal'::card_rareza), ('-raro','raro'::card_rareza), ('-leg','legendario'::card_rareza))
INSERT INTO public.player_pool (id, nombre, apellido1, team_id, posicion, rating, rareza, estado, club_player_id)
SELECT 'coach_'||left(c.cid::text,8)||r.suf, c.nombre, c.ape, c.team, 'entrenador', 0, r.rar, 'disponible', c.cid
FROM c CROSS JOIN r
WHERE NOT EXISTS (SELECT 1 FROM public.player_pool p WHERE p.club_player_id=c.cid AND p.rareza=r.rar)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.player_pool_positions (player_id, posicion, es_principal)
SELECT p.id, 'entrenador', true FROM public.player_pool p
WHERE p.posicion='entrenador' AND NOT EXISTS (SELECT 1 FROM public.player_pool_positions pp WHERE pp.player_id=p.id);