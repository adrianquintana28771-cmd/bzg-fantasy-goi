import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

export const PRED_SLOTS = [
  "portero",
  "extremo_izq",
  "lateral_izq",
  "central",
  "lateral_der",
  "extremo_der",
  "pivote",
  "entrenador",
] as const;
export type PredSlot = (typeof PRED_SLOTS)[number];
export const FIELD_SLOTS = PRED_SLOTS.filter((s) => s !== "entrenador");

export const SLOT_LABEL: Record<PredSlot, [string, string]> = {
  portero: ["Atezaina", "Portero/a"],
  extremo_izq: ["Ezker hegala", "Extremo izq."],
  lateral_izq: ["Ezker alboa", "Lateral izq."],
  central: ["Erdikoa", "Central"],
  lateral_der: ["Eskuin alboa", "Lateral der."],
  extremo_der: ["Eskuin hegala", "Extremo der."],
  pivote: ["Pibotea", "Pivote"],
  entrenador: ["Entrenatzailea", "Entrenador/a"],
};

export interface Candidate {
  id: string;
  posiciones: string[];
  esEntrenador: boolean;
}

/**
 * Mejor alineación posible: cada jugador/a solo una vez, maximizando el total.
 * Si alguien es el mejor en varias posiciones, queda donde menos se pierde
 * respecto al siguiente mejor de las otras posiciones.
 */
export function computeIdealSeven(
  candidates: Candidate[],
  points: Map<string, number>,
  avg: Map<string, number> = new Map(),
): Partial<Record<PredSlot, { id: string; puntos: number }>> {
  const pts = (id: string) => points.get(id);
  // Empate a puntos: mejor media de temporada, luego id estable.
  const byPts = (a: { id: string; puntos: number }, b: { id: string; puntos: number }) =>
    b.puntos - a.puntos || (avg.get(b.id) ?? 0) - (avg.get(a.id) ?? 0) || a.id.localeCompare(b.id);
  const lists = FIELD_SLOTS.map((slot) =>
    candidates
      .filter((c) => !c.esEntrenador && c.posiciones.includes(slot) && pts(c.id) !== undefined)
      .map((c) => ({ id: c.id, puntos: pts(c.id)! }))
      .sort(byPts)
      .slice(0, FIELD_SLOTS.length + 1),
  );
  let best: { total: number; pick: ({ id: string; puntos: number } | null)[] } = { total: -Infinity, pick: [] };
  const used = new Set<string>();
  const cur: ({ id: string; puntos: number } | null)[] = [];
  const dfs = (i: number, total: number) => {
    if (i === FIELD_SLOTS.length) {
      if (total > best.total) best = { total, pick: [...cur] };
      return;
    }
    let any = false;
    for (const c of lists[i]) {
      if (used.has(c.id)) continue;
      any = true;
      used.add(c.id);
      cur.push(c);
      dfs(i + 1, total + c.puntos);
      cur.pop();
      used.delete(c.id);
    }
    if (!any) {
      cur.push(null);
      dfs(i + 1, total);
      cur.pop();
    }
  };
  dfs(0, 0);
  const out: Partial<Record<PredSlot, { id: string; puntos: number }>> = {};
  FIELD_SLOTS.forEach((s, i) => {
    const p = best.pick[i];
    if (p) out[s] = p;
  });
  const coach = candidates
    .filter((c) => c.esEntrenador && pts(c.id) !== undefined)
    .map((c) => ({ id: c.id, puntos: pts(c.id)! }))
    .sort(byPts)[0];
  if (coach) out.entrenador = coach;
  return out;
}

export interface ClubPerson extends Candidate {
  nombre: string;
  estado: string;
  activo: boolean;
}

export async function fetchClubCandidates(db: Db = supabase): Promise<ClubPerson[]> {
  const [{ data: players, error: e1 }, { data: pos, error: e2 }] = await Promise.all([
    db.from("club_players").select("id,nombre,alias,apellido1,estado,activo,es_entrenador"),
    db.from("club_player_positions").select("player_id,position_id").range(0, 4999),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const byPlayer = new Map<string, string[]>();
  (pos ?? []).forEach((p) => byPlayer.set(p.player_id, [...(byPlayer.get(p.player_id) ?? []), p.position_id]));
  return (players ?? []).map((p) => ({
    id: p.id,
    nombre: p.alias || [p.nombre, p.apellido1].filter(Boolean).join(" "),
    estado: p.estado,
    activo: p.activo,
    esEntrenador: p.es_entrenador,
    posiciones: byPlayer.get(p.id) ?? [],
  }));
}

/** Puntos base por persona del club en una jornada (sin multiplicador de rareza) y media de temporada. */
export async function fetchJornadaPoints(numero: number, db: Db = supabase) {
  const rows: { puntos: number; jornada_numero: number; player_pool: { club_player_id: string | null } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("player_jornada_stats")
      .select("puntos, jornada_numero, player_pool(club_player_id)")
      .lte("jornada_numero", numero)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const per = new Map<string, Map<number, number>>();
  rows.forEach((r) => {
    const id = r.player_pool?.club_player_id;
    if (!id) return;
    const m = per.get(id) ?? new Map<number, number>();
    m.set(r.jornada_numero, Math.max(m.get(r.jornada_numero) ?? -Infinity, Number(r.puntos)));
    per.set(id, m);
  });
  const points = new Map<string, number>();
  const avg = new Map<string, number>();
  per.forEach((m, id) => {
    if (m.has(numero)) points.set(id, m.get(numero)!);
    const v = [...m.values()];
    avg.set(id, v.reduce((a, b) => a + b, 0) / v.length);
  });
  return { points, avg };
}

/** Aciertos: vale cualquier persona con la puntuación del 7 ideal en ese puesto (empates incluidos). */
export function countAciertos(
  pick: Partial<Record<PredSlot, string | null>>,
  ideal: Partial<Record<PredSlot, { id: string; puntos: number }>>,
  candidates: Candidate[],
  points: Map<string, number>,
): PredSlot[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return PRED_SLOTS.filter((s) => {
    const id = pick[s];
    const best = ideal[s];
    const c = id ? byId.get(id) : undefined;
    if (!c || !best || points.get(c.id) !== best.puntos) return false;
    return s === "entrenador" ? c.esEntrenador : !c.esEntrenador && c.posiciones.includes(s);
  });
}

export async function fetchIdealSeven(numero: number, db: Db = supabase) {
  const [cands, { points, avg }] = await Promise.all([fetchClubCandidates(db), fetchJornadaPoints(numero, db)]);
  const ideal = computeIdealSeven(cands, points, avg);
  const nameById = new Map(cands.map((c) => [c.id, c.nombre]));
  return { ideal, nameById, cands, points };
}
