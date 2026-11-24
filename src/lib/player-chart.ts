import type { PlayerEstado } from "./fantasy/types";

export type PlayerChartRow = {
  jornada: string;
  pts: number | null;
  estado: PlayerEstado | null;
  reason: "played" | "rest" | "unavailable" | "doubtful" | "unrecorded";
};

/** Display-only: missing participation is not evidence of a historical injury. */
export function buildPlayerChartRows(
  calendar: { numero: number; is_active: boolean; is_locked: boolean }[],
  matches: { jornada: number; rival: string }[],
  stats: { jornada: number; puntos: number; estado: PlayerEstado }[],
  playedJornadas: number[],
  currentEstado: PlayerEstado,
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
    const estado = active ? currentEstado : stat?.estado ?? null;
    const reason = estado === "no_disponible" ? "unavailable" : estado === "dudoso" ? "doubtful" : "unrecorded";
    return { jornada, pts: null, estado, reason };
  });
}