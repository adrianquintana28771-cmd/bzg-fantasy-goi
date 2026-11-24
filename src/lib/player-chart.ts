import type { PlayerEstado } from "./fantasy/types";

export type PlayerChartRow = {
  jornada: string;
  pts: number | null;
  estado: PlayerEstado | null;
  reason: "played" | "rest" | "unavailable" | "doubtful" | "unrecorded";
};

/** Display-only: infer historical unavailability only for closed match jornadas without recorded status or participation. */
export function buildPlayerChartRows(
  calendar: { numero: number; is_active: boolean; is_locked: boolean }[],
  matches: { jornada: number; rival: string }[],
  stats: { jornada: number; puntos: number; estado: PlayerEstado }[],
  playedJornadas: number[],
  currentEstado: PlayerEstado,
  availabilityHistory: { numero: number; estado: PlayerEstado }[] = [],
): PlayerChartRow[] {
  const played = new Set(playedJornadas);
  const numbers = [...new Set([
    ...calendar.filter(j => j.is_active || j.is_locked).map(j => j.numero),
    ...stats.map(j => j.jornada),
    ...playedJornadas,
  ])].sort((a, b) => a - b);
  return numbers.map(numero => {
    const stat = stats.find(s => s.jornada === numero);
    const jornada = `J${numero}`;
    // Includes cross-team call-ups and existing display-only point adjustments.
    if (played.has(numero) || (stat && stat.puntos !== 0)) {
      return { jornada, pts: stat?.puntos ?? 0, estado: stat?.estado ?? "disponible", reason: "played" };
    }
    const fixtures = matches.filter(m => m.jornada === numero);
    const hasMatch = fixtures.some(m => !/^descans[ao]/i.test(m.rival.trim()));
    if (!hasMatch) return { jornada, pts: null, estado: null, reason: "rest" };
    const active = calendar.some(j => j.numero === numero && j.is_active && !j.is_locked);
    const closed = calendar.some(j => j.numero === numero && j.is_locked && !j.is_active);
    const recordedEstado = availabilityHistory.find(j => j.numero === numero)?.estado
      ?? (stat?.estado === "dudoso" || stat?.estado === "no_disponible" ? stat.estado : null);
    const estado = active ? currentEstado : recordedEstado ?? (closed ? "no_disponible" : stat?.estado ?? null);
    const reason = estado === "no_disponible" ? "unavailable" : estado === "dudoso" ? "doubtful" : "unrecorded";
    return { jornada, pts: null, estado, reason };
  });
}