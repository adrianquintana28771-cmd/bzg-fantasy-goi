import { supabase } from "@/integrations/supabase/client";

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
): Partial<Record<PredSlot, { id: string; puntos: number }>> {
  const pts = (id: string) => points.get(id);
  const lists = FIELD_SLOTS.map((slot) =>
    candidates
      .filter((c) => !c.esEntrenador && c.posiciones.includes(slot) && pts(c.id) !== undefined)
      .map((c) => ({ id: c.id, puntos: pts(c.id)! }))
      .sort((a, b) => b.puntos - a.puntos)
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
    .sort((a, b) => b.puntos - a.puntos)[0];
  if (coach) out.entrenador = coach;
  return out;
}

export interface ClubPerson extends Candidate {
  nombre: string;
  estado: string;
  activo: boolean;
}

export async function fetchClubCandidates(): Promise<ClubPerson[]> {
  const [{ data: players, error: e1 }, { data: pos, error: e2 }] = await Promise.all([
    supabase.from("club_players").select("id,nombre,alias,apellido1,estado,activo,es_entrenador"),
    supabase.from("club_player_positions").select("player_id,position_id").range(0, 4999),
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

/** Puntos base por persona del club en una jornada (sin multiplicador de rareza). */
export async function fetchJornadaPoints(numero: number): Promise<Map<string, number>> {
  const rows: { puntos: number; player_pool: { club_player_id: string | null } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("player_jornada_stats")
      .select("puntos, player_pool(club_player_id)")
      .eq("jornada_numero", numero)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const id = r.player_pool?.club_player_id;
    if (!id) return;
    const v = Number(r.puntos);
    m.set(id, Math.max(m.get(id) ?? -Infinity, v));
  });
  return m;
}

export async function fetchIdealSeven(numero: number) {
  const [cands, points] = await Promise.all([fetchClubCandidates(), fetchJornadaPoints(numero)]);
  const ideal = computeIdealSeven(cands, points);
  const nameById = new Map(cands.map((c) => [c.id, c.nombre]));
  return { ideal, nameById };
}
