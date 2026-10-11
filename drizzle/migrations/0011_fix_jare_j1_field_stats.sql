DELETE FROM public.club_match_actions a USING public.club_action_types t
WHERE t.id = a.action_id
  AND a.player_id = '6193c190-85db-40f4-881d-b8b816870271'
  AND a.match_id = '3efbc7eb-b159-4ef7-a98d-44461cbe4f60'
  AND NOT t.solo_portero AND NOT t.solo_entrenador;
SELECT public.recalc_player_stats();