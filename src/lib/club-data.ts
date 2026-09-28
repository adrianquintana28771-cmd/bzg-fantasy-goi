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
  const { data, error } = await supabase
    .from("player_pool")
    .select(POOL_SELECT.replace("club:club_players(", "club:club_players!inner(activo,"))
    .eq("rareza", "normal")
    .eq("club.activo", true);
  if (error) throw error;
  return (data ?? []) as unknown as PoolPlayer[];
}

export async function fetchPoolPlayer(id: string): Promise<PoolPlayer | null> {
  const { data, error } = await supabase
    .from("player_pool")
    .select(POOL_SELECT)
    .eq("id", id)
    .maybeSingle();
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

// Penalización de porteros por goles encajados, acumulativa por tramos:
// 1-10: -0,25/gol · 11-20: -0,50/gol · 21-30: -0,75/gol · 31+: -1/gol
export const golEncajadoPts = (goles: number) => {
  const g = Math.max(0, Math.floor(goles));
  const t1 = Math.min(g, 10) * 0.25;
  const t2 = Math.min(Math.max(g - 10, 0), 10) * 0.5;
  const t3 = Math.min(Math.max(g - 20, 0), 10) * 0.75;
  const t4 = Math.max(g - 30, 0) * 1;
  return -round2(t1 + t2 + t3 + t4);
};

export type RankedPlayer = {
  id: string;
  nombre: string;
  posicion: string;
  dorsal: number | null;
  esEntrenador: boolean;
  team: ClubTeam | null;
  puntos: number;
  jornadas: number;
  porJornada: Record<number, number>;
};

/** Ranking público de jugadores/as con datos reales (una fila por persona). */
export async function fetchPlayerRanking(): Promise<RankedPlayer[]> {
  const [teams, pool, stats] = await Promise.all([
    fetchTeams(),
    fetchPool(),
    supabase.from("player_jornada_stats").select("player_id,puntos,jornada_numero"),
  ]);
  if (stats.error) throw stats.error;
  const agg: Record<string, { puntos: number; jornadas: Set<number>; por: Record<number, number> }> = {};
  for (const r of stats.data ?? []) {
    const a = (agg[r.player_id] ??= { puntos: 0, jornadas: new Set(), por: {} });
    a.puntos += Number(r.puntos);
    a.por[r.jornada_numero] = round2((a.por[r.jornada_numero] ?? 0) + Number(r.puntos));
    if (Number(r.puntos) !== 0) a.jornadas.add(r.jornada_numero);
  }
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return pool
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      posicion: p.posicion,
      dorsal: p.club?.dorsal ?? null,
      esEntrenador: !!p.club?.es_entrenador,
      team: (p.team_id && teamById.get(p.team_id)) || null,
      puntos: round2(agg[p.id]?.puntos ?? 0),
      jornadas: agg[p.id]?.jornadas.size ?? 0,
      porJornada: agg[p.id]?.por ?? {},
    }))
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
}
