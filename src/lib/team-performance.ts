export type MatchParticipant = { player_id: string; jugado: boolean };
export type RecordedAction = { player_id: string; action_id: string; cantidad: number };

/** Only explicitly played participants count; roster membership never implies participation. */
export function aggregateTeamPerformance(participants: MatchParticipant[], actions: RecordedAction[]) {
  const players: Record<string, Record<string, number>> = {};
  for (const p of participants) if (p.jugado) players[p.player_id] ??= {};
  const totals: Record<string, number> = {};
  for (const a of actions) {
    const player = players[a.player_id];
    if (!player) continue;
    player[a.action_id] = (player[a.action_id] ?? 0) + a.cantidad;
    totals[a.action_id] = (totals[a.action_id] ?? 0) + a.cantidad;
  }
  return { players, totals };
}

export function performancePercentages(counts: Record<string, number>) {
  const goals = (counts.gol ?? 0) + (counts.gol_7m ?? 0);
  const shots = goals + (counts.falta_ataque ?? 0);
  const saves = counts.parada ?? 0;
  const faced = saves + (counts.lanzamiento_fuera ?? 0) + (counts.gol_encajado ?? 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    shooting: shots > 0 ? round(goals * 100 / shots) : null,
    saves: faced > 0 ? round(saves * 100 / faced) : null,
  };
}