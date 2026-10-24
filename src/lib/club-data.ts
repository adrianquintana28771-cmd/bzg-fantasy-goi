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
  const out: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("player_jornada_stats")
      .select("player_id,puntos")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) out[r.player_id] = (out[r.player_id] ?? 0) + Number(r.puntos);
    if (!data || data.length < 1000) break;
  }
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

/** Tramo configurable de criterios de portero (mismo formato que la BD). */
export type Tramo = { desde: number; hasta: number | null; puntos: number };

/** Puntos por unidad acumulativos por tramos (paradas, goles en contra). Igual que public.tramo_pts. */
export const tramoPts = (n: number, tramos: Tramo[]) =>
  round2(
    tramos.reduce(
      (acc, t) => acc + t.puntos * Math.max(0, Math.min(n, t.hasta ?? n) - (t.desde - 1)),
      0,
    ),
  );

/** Puntos fijos del tramo de % que contiene el valor. Igual que public.tramo_pct_pts. */
export const tramoPctPts = (pct: number, tramos: Tramo[]) =>
  [...tramos]
    .sort((a, b) => b.desde - a.desde)
    .find((t) => pct >= t.desde && (t.hasta == null || pct <= t.hasta))?.puntos ?? 0;

/** % de paradas = paradas / (paradas + fuera + goles) × 100, o null si no hay lanzamientos. */
export const pctParadas = (par: number, fue: number, gol: number) => {
  const den = par + fue + gol;
  return den > 0 ? round2((par * 100) / den) : null;
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

/** player_pool.id por club_players.id (para enlazar a la ficha de jugador/a). */
async function poolIdsByClubPlayer(playerIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!playerIds.length) return out;
  const { data, error } = await supabase
    .from("player_pool")
    .select("id,club_player_id")
    .in("club_player_id", playerIds);
  if (error) throw error;
  for (const r of (data ?? []) as { id: string; club_player_id: string }[])
    if (r.club_player_id && !out.has(r.club_player_id)) out.set(r.club_player_id, r.id);
  return out;
}

// Top 5 acumulado por acción (cantidades reales, no puntos Fantasy).
export type StatLeader = {
  id: string;
  nombre: string;
  equipo: string | null;
  total: number;
  poolId: string | null;
};
export const STAT_LEADER_ACTIONS = {
  goles: ["gol", "gol_7m"],
  paradas: ["parada"],
  asistencias: ["asistencia"],
  robos: ["robo"],
} as const;
export type StatLeaderKey = keyof typeof STAT_LEADER_ACTIONS;

export async function fetchStatLeaders(): Promise<Record<StatLeaderKey, StatLeader[]>> {
  const ids = Object.values(STAT_LEADER_ACTIONS).flat();
  const rows: { player_id: string; action_id: string; cantidad: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("club_match_actions")
      .select("player_id, action_id, cantidad")
      .in("action_id", ids)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const playerIds = [...new Set(rows.map((r) => r.player_id))];
  const { data: players } = playerIds.length
    ? await supabase
        .from("club_players")
        .select("id, nombre, apellido1, alias, club_player_teams(club_teams(nombre))")
        .in("id", playerIds)
    : { data: [] as any[] };
  const info = new Map<string, { nombre: string; equipo: string | null }>();
  for (const p of (players ?? []) as any[]) {
    info.set(p.id, {
      nombre: p.alias || [p.nombre, p.apellido1].filter(Boolean).join(" "),
      equipo: p.club_player_teams?.[0]?.club_teams?.nombre ?? null,
    });
  }
  const poolIds = await poolIdsByClubPlayer(playerIds);
  const out = {} as Record<StatLeaderKey, StatLeader[]>;
  for (const key of Object.keys(STAT_LEADER_ACTIONS) as StatLeaderKey[]) {
    const acts = STAT_LEADER_ACTIONS[key] as readonly string[];
    const sums = new Map<string, number>();
    for (const r of rows)
      if (acts.includes(r.action_id)) sums.set(r.player_id, (sums.get(r.player_id) ?? 0) + (r.cantidad ?? 0));
    out[key] = [...sums]
      .filter(([id, t]) => t > 0 && info.has(id))
      .map(([id, total]) => ({ id, total, poolId: poolIds.get(id) ?? null, ...info.get(id)! }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }
  return out;
}

// Top 5 por medias (no acumulados): % medio de paradas por jornada y media de puntos por jornada.
export type AvgLeader = {
  id: string;
  nombre: string;
  equipo: string | null;
  valor: number;
  poolId: string | null;
};

/** Media de los % de parada por jornada (solo jornadas con lanzamientos). */
export async function fetchSavePctLeaders(): Promise<AvgLeader[]> {
  const rows: { player_id: string; action_id: string; cantidad: number; jornada: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("club_match_actions")
      .select("player_id, action_id, cantidad, club_matches(jornada)")
      .in("action_id", ["parada", "lanzamiento_fuera", "gol_encajado"])
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as any[])
      rows.push({ player_id: r.player_id, action_id: r.action_id, cantidad: r.cantidad, jornada: r.club_matches?.jornada ?? null });
    if (!data || data.length < 1000) break;
  }
  const playerIds = [...new Set(rows.map((r) => r.player_id))];
  const { data: players } = playerIds.length
    ? await supabase
        .from("club_players")
        .select("id, nombre, apellido1, alias, es_entrenador, club_player_teams(club_teams(nombre))")
        .in("id", playerIds)
    : { data: [] as any[] };
  const info = new Map<string, { nombre: string; equipo: string | null; esEntrenador: boolean }>();
  for (const p of (players ?? []) as any[]) {
    info.set(p.id, {
      nombre: p.alias || [p.nombre, p.apellido1].filter(Boolean).join(" "),
      equipo: p.club_player_teams?.[0]?.club_teams?.nombre ?? null,
      esEntrenador: !!p.es_entrenador,
    });
  }
  const poolIds = await poolIdsByClubPlayer(playerIds);
  // Sumas por jugador y jornada; el % se calcula por jornada y luego se promedia.
  const per = new Map<string, Map<number, { par: number; fue: number; gol: number }>>();
  for (const r of rows) {
    if (r.jornada == null) continue;
    const m = per.get(r.player_id) ?? new Map();
    const j = m.get(r.jornada) ?? { par: 0, fue: 0, gol: 0 };
    if (r.action_id === "parada") j.par += r.cantidad ?? 0;
    else if (r.action_id === "lanzamiento_fuera") j.fue += r.cantidad ?? 0;
    else j.gol += r.cantidad ?? 0;
    m.set(r.jornada, j);
    per.set(r.player_id, m);
  }
  return [...per]
    .map(([id, m]) => {
      const pcts = [...m.values()]
        .map((j) => pctParadas(j.par, j.fue, j.gol))
        .filter((p): p is number => p != null);
      const valor = pcts.length ? round2(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
      const v = valor != null && info.has(id) ? info.get(id)! : null;
      return v && !v.esEntrenador
        ? { id, valor, poolId: poolIds.get(id) ?? null, nombre: v.nombre, equipo: v.equipo }
        : null;
    })
    .filter((x): x is AvgLeader => x != null)
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre))
    .slice(0, 5);
}

/** Media de puntos Fantasy por jornada (solo jornadas con puntos distintos de 0). */
export async function fetchAvgPtsLeaders(): Promise<AvgLeader[]> {
  const ranking = await fetchPlayerRanking();
  return ranking
    .filter((r) => r.jornadas > 0)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      equipo: r.team?.nombre ?? null,
      valor: round2(r.puntos / r.jornadas),
      poolId: r.id,
    }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre))
    .slice(0, 5);
}

/** Media de los % de acierto por jornada: (gol + gol_7m) / (gol + gol_7m + fallados); solo jornadas con más de 5 lanzamientos. */
export async function fetchShootingPctLeaders(): Promise<AvgLeader[]> {
  const rows: { player_id: string; action_id: string; cantidad: number; jornada: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("club_match_actions")
      .select("player_id, action_id, cantidad, club_matches(jornada)")
      .in("action_id", ["gol", "gol_7m", "falta_ataque"])
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as any[])
      rows.push({ player_id: r.player_id, action_id: r.action_id, cantidad: r.cantidad, jornada: r.club_matches?.jornada ?? null });
    if (!data || data.length < 1000) break;
  }
  const per = new Map<string, Map<number, { gol: number; fal: number }>>();
  for (const r of rows) {
    if (r.jornada == null) continue;
    const m = per.get(r.player_id) ?? new Map();
    const j = m.get(r.jornada) ?? { gol: 0, fal: 0 };
    if (r.action_id === "falta_ataque") j.fal += r.cantidad ?? 0;
    else j.gol += r.cantidad ?? 0;
    m.set(r.jornada, j);
    per.set(r.player_id, m);
  }
  const playerIds = [...per.keys()];
  const { data: players } = playerIds.length
    ? await supabase
        .from("club_players")
        .select("id, nombre, apellido1, alias, club_player_teams(club_teams(nombre))")
        .in("id", playerIds)
    : { data: [] as any[] };
  const info = new Map<string, { nombre: string; equipo: string | null }>();
  for (const p of (players ?? []) as any[])
    info.set(p.id, {
      nombre: p.alias || [p.nombre, p.apellido1].filter(Boolean).join(" "),
      equipo: p.club_player_teams?.[0]?.club_teams?.nombre ?? null,
    });
  const poolIds = await poolIdsByClubPlayer(playerIds);
  return [...per]
    .map(([id, m]) => {
      const pcts = [...m.values()].filter((j) => j.gol + j.fal > 5).map((j) => (j.gol * 100) / (j.gol + j.fal));
      const valor = pcts.length ? round2(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
      return valor != null && info.has(id) ? { id, valor, poolId: poolIds.get(id) ?? null, ...info.get(id)! } : null;
    })
    .filter((x): x is AvgLeader => x != null)
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre))
    .slice(0, 5);
}
