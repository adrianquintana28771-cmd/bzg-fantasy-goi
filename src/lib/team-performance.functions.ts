import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/club-data";

export const getTeamPerformance = createServerFn({ method: "GET" })
  .inputValidator((input: { match?: string }) => z.object({ match: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const [teams, matches, criteria] = await Promise.all([
      fetchAllRows((from, to) => db.from("club_teams").select("id,nombre,categoria,sexo,season_id,club_seasons!inner(is_active)").eq("club_seasons.is_active", true).order("nombre").range(from, to)),
      fetchAllRows((from, to) => db.from("club_matches").select("id,team_id,jornada,rival,fecha,hora,competicion").order("jornada").order("fecha").order("id").range(from, to)),
      fetchAllRows((from, to) => db.from("club_action_types").select("id,nombre,orden,activo").order("orden").order("id").range(from, to)),
    ]);
    const activeTeamIds = new Set(teams.map(t => t.id));
    const activeMatches = matches.filter(m => activeTeamIds.has(m.team_id));
    const selected = activeMatches.find(m => m.id === data.match);
    if (!selected) return { teams, matches: activeMatches, criteria, participants: [], actions: [], players: [] };
    const [participants, actions] = await Promise.all([
      fetchAllRows((from, to) => db.from("club_match_players").select("player_id,jugado").eq("match_id", selected.id).eq("jugado", true).order("player_id").range(from, to)),
      fetchAllRows((from, to) => db.from("club_match_actions").select("player_id,action_id,cantidad").eq("match_id", selected.id).order("id").range(from, to)),
    ]);
    const ids = [...new Set(participants.map(p => p.player_id))];
    const players = ids.length ? await fetchAllRows((from, to) => db.from("club_players")
      .select("id,nombre,apellido1,apellido2,club_player_teams(team_id,club_teams(id,nombre,categoria,sexo,season_id))")
      .in("id", ids).order("id").range(from, to)) : [];
    return { teams, matches: activeMatches, criteria, participants, actions, players };
  });