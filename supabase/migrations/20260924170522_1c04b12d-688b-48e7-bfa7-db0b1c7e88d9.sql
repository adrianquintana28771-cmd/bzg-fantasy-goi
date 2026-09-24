DROP POLICY IF EXISTS "auth read actions" ON public.club_action_types;
DROP POLICY IF EXISTS "public read actions" ON public.club_action_types;
CREATE POLICY "read active action types"
ON public.club_action_types FOR SELECT TO anon, authenticated
USING (activo = true);

DROP POLICY IF EXISTS "auth read matches" ON public.club_matches;
DROP POLICY IF EXISTS "public read matches" ON public.club_matches;
CREATE POLICY "read matches in active seasons"
ON public.club_matches FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_seasons s
    WHERE s.id = club_matches.season_id AND s.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.club_teams t
    WHERE t.id = club_matches.team_id AND t.season_id = club_matches.season_id
  )
);

DROP POLICY IF EXISTS "auth read teams" ON public.club_teams;
DROP POLICY IF EXISTS "public read teams" ON public.club_teams;
CREATE POLICY "read teams in active seasons"
ON public.club_teams FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_seasons s
    WHERE s.id = club_teams.season_id AND s.is_active = true
  )
);

DROP POLICY IF EXISTS "player_jornada_stats_public_read" ON public.player_jornada_stats;
CREATE POLICY "read stats for public players and valid jornadas"
ON public.player_jornada_stats FOR SELECT TO anon, authenticated
USING (
  jornada_numero > 0
  AND EXISTS (
    SELECT 1
    FROM public.player_pool pp
    JOIN public.club_players cp ON cp.id = pp.club_player_id
    JOIN public.club_teams t ON t.id::text = pp.team_id
    JOIN public.club_seasons s ON s.id = t.season_id
    WHERE pp.id = player_jornada_stats.player_id
      AND cp.activo = true
      AND s.is_active = true
  )
);

DROP POLICY IF EXISTS "Auth read jornadas" ON public.jornadas;
CREATE POLICY "read configured jornadas"
ON public.jornadas FOR SELECT TO authenticated
USING (
  numero > 0
  AND (
    is_active = true
    OR is_locked = true
    OR EXISTS (
      SELECT 1
      FROM public.club_matches m
      JOIN public.club_seasons s ON s.id = m.season_id
      WHERE m.jornada = jornadas.numero AND s.is_active = true
    )
  )
);

DROP POLICY IF EXISTS "auth read match actions" ON public.club_match_actions;
DROP POLICY IF EXISTS "public read match_actions" ON public.club_match_actions;
CREATE POLICY "read actions from public matches"
ON public.club_match_actions FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.club_matches m
    JOIN public.club_seasons s ON s.id = m.season_id
    WHERE m.id = club_match_actions.match_id AND s.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.club_players p
    WHERE p.id = club_match_actions.player_id AND p.activo = true
  )
  AND EXISTS (
    SELECT 1 FROM public.club_action_types a
    WHERE a.id = club_match_actions.action_id AND a.activo = true
  )
);

DROP POLICY IF EXISTS "Auth read pool" ON public.player_pool;
DROP POLICY IF EXISTS "public read pool" ON public.player_pool;
CREATE POLICY "read cards for active public players"
ON public.player_pool FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.club_players cp
    JOIN public.club_player_teams cpt ON cpt.player_id = cp.id
    JOIN public.club_teams t ON t.id = cpt.team_id
    JOIN public.club_seasons s ON s.id = t.season_id
    WHERE cp.id = player_pool.club_player_id
      AND t.id::text = player_pool.team_id
      AND cp.activo = true
      AND s.is_active = true
  )
);

DROP POLICY IF EXISTS "auth read players" ON public.club_players;
DROP POLICY IF EXISTS "public read players" ON public.club_players;
CREATE POLICY "read active club players"
ON public.club_players FOR SELECT TO anon, authenticated
USING (activo = true);

DROP POLICY IF EXISTS "auth read match players" ON public.club_match_players;
DROP POLICY IF EXISTS "public read match_players" ON public.club_match_players;
CREATE POLICY "read players from public matches"
ON public.club_match_players FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.club_matches m
    JOIN public.club_seasons s ON s.id = m.season_id
    WHERE m.id = club_match_players.match_id AND s.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.club_players p
    WHERE p.id = club_match_players.player_id AND p.activo = true
  )
);

DROP POLICY IF EXISTS "auth read player_teams" ON public.club_player_teams;
DROP POLICY IF EXISTS "public read player_teams" ON public.club_player_teams;
CREATE POLICY "read active player team memberships"
ON public.club_player_teams FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_players p
    WHERE p.id = club_player_teams.player_id AND p.activo = true
  )
  AND EXISTS (
    SELECT 1
    FROM public.club_teams t
    JOIN public.club_seasons s ON s.id = t.season_id
    WHERE t.id = club_player_teams.team_id AND s.is_active = true
  )
);

DROP POLICY IF EXISTS "auth read seasons" ON public.club_seasons;
DROP POLICY IF EXISTS "public read seasons" ON public.club_seasons;
CREATE POLICY "read active seasons"
ON public.club_seasons FOR SELECT TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "auth read positions" ON public.club_positions;
DROP POLICY IF EXISTS "public read positions" ON public.club_positions;
CREATE POLICY "read supported club positions"
ON public.club_positions FOR SELECT TO anon, authenticated
USING (id = ANY (ARRAY['portero','extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote','entrenador']::text[]));

DROP POLICY IF EXISTS "player_pool_positions_public_read" ON public.player_pool_positions;
CREATE POLICY "read positions for public cards"
ON public.player_pool_positions FOR SELECT TO anon, authenticated
USING (
  posicion = ANY (ARRAY['portero','extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote','entrenador']::public.plantilla_posicion[])
  AND EXISTS (
    SELECT 1
    FROM public.player_pool pp
    JOIN public.club_players cp ON cp.id = pp.club_player_id
    JOIN public.club_teams t ON t.id::text = pp.team_id
    JOIN public.club_seasons s ON s.id = t.season_id
    WHERE pp.id = player_pool_positions.player_id
      AND cp.activo = true
      AND s.is_active = true
  )
);

DROP POLICY IF EXISTS "auth read player_positions" ON public.club_player_positions;
DROP POLICY IF EXISTS "public read player_positions" ON public.club_player_positions;
CREATE POLICY "read positions for active club players"
ON public.club_player_positions FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_players p
    WHERE p.id = club_player_positions.player_id AND p.activo = true
  )
  AND EXISTS (
    SELECT 1 FROM public.club_positions pos
    WHERE pos.id = club_player_positions.position_id
  )
);