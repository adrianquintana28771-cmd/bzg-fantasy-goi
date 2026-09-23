import { supabase } from "@/integrations/supabase/client";
import type { PlayerEstado } from "@/lib/fantasy/types";

export type ClubTeam = { id: string; nombre: string; categoria: string; sexo: string };
export type PoolPlayer = {
  id: string;
  nombre: string;
  posicion: string;
  rareza: string;
  estado: PlayerEstado;
  team_id: string | null;
  club_player_id: string | null;
  club: {
    nombre: string;
    apellido1: string | null;
    apellido2: string | null;
    dorsal: number | null;
    estado: PlayerEstado;
    es_entrenador: boolean;
  } | null;
};

const POOL_SELECT =
  "id,nombre,posicion,rareza,estado,team_id,club_player_id,club:club_players(nombre,apellido1,apellido2,dorsal,estado,es_entrenador)";

export async function fetchTeams(): Promise<ClubTeam[]> {
  const { data, error } = await supabase
    .from("club_teams")
    .select("id,nombre,categoria,sexo,club_seasons!inner(is_active)")
    .eq("club_seasons.is_active", true);
  if (error) throw error;
  return (data ?? []).map(({ id, nombre, categoria, sexo }) => ({ id, nombre, categoria, sexo }));
}

export async function fetchPool(): Promise<PoolPlayer[]> {
  const { data, error } = await supabase.from("player_pool").select(POOL_SELECT).eq("rareza", "normal");
  if (error) throw error;
  return (data ?? []) as unknown as PoolPlayer[];
}

export async function fetchPoolPlayer(id: string): Promise<PoolPlayer | null> {
  const { data, error } = await supabase.from("player_pool").select(POOL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as PoolPlayer | null;
}

export async function fetchPointsByPlayer(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("player_jornada_stats").select("player_id,puntos");
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.player_id] = (out[r.player_id] ?? 0) + Number(r.puntos);
  return out;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
