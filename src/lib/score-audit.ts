import { type Tramo } from '@/lib/club-data';

export type AuditAction = { match_id: string; player_id: string; action_id: string; cantidad: number };
export type AuditType = { id: string; nombre: string; puntos: number; activo: boolean; solo_portero: boolean; tramos: Tramo[] | null };
export type AuditLine = { match: string; action: string; quantity: string; origin: 'recorded' | 'automatic'; points: number; rule: 'linear' | 'tiers' | 'shared' | 'percentage' | 'goalkeeper' };
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Mirror recalc_player_stats: round the goalkeeper core per match, then the jornada. */
export function auditPlayer(playerId: string, actions: AuditAction[], types: AuditType[]) {
  const byType = new Map(types.map(t => [t.id, t]));
  const participants = new Map<string, Set<string>>();
  for (const a of actions) {
    if (a.cantidad > 0 && byType.get(a.action_id)?.solo_portero) {
      const set = participants.get(a.match_id) ?? new Set<string>();
      set.add(a.player_id); participants.set(a.match_id, set);
    }
  }
  const matches = new Map<string, Map<string, number>>();
  for (const a of actions.filter(a => a.player_id === playerId)) {
    const quantities = matches.get(a.match_id) ?? new Map<string, number>();
    quantities.set(a.action_id, (quantities.get(a.action_id) ?? 0) + a.cantidad);
    matches.set(a.match_id, quantities);
  }
  const lines: AuditLine[] = [];
  let expected = 0;
  for (const [match, quantities] of matches) {
    const par = quantities.get('parada') ?? 0;
    const fue = quantities.get('lanzamiento_fuera') ?? 0;
    const gol = quantities.get('gol_encajado') ?? 0;
    const shots = par + fue + gol;
    const shared = (participants.get(match)?.size ?? 1) >= 2;
    const conceded = shared ? -0.3 * gol : -(0.1 * Math.min(gol, 10) + 0.2 * Math.min(Math.max(gol - 10, 0), 10) + 0.3 * Math.min(Math.max(gol - 20, 0), 10) + 0.4 * Math.max(gol - 30, 0));
    const percentage = shots > 0 ? par * 100 / shots : 0;
    const bonus = shots < 10 ? 0 : Math.min(25, Math.max(0, percentage - 25) * 0.8) * Math.min(1, shots / 20);
    if (shots > 0) {
      expected += round(2.5 * par + 0.5 * fue + conceded + bonus);
      for (const [id, quantity, points, rule] of [
        ['parada', par, 2.5 * par, 'goalkeeper'],
        ['lanzamiento_fuera', fue, 0.5 * fue, 'goalkeeper'],
        ['gol_encajado', gol, conceded, shared ? 'shared' : 'tiers'],
      ] as const) {
        if (quantity !== 0) lines.push({ match, action: byType.get(id)?.nombre ?? id, quantity: String(quantity), origin: 'automatic', points, rule });
      }
      lines.push({ match, action: byType.get('porcentaje_paradas')?.nombre ?? 'porcentaje_paradas', quantity: `${round(percentage)} %`, origin: 'automatic', points: bonus, rule: 'percentage' });
    }
    for (const [id, quantity] of quantities) {
      const type = byType.get(id);
      if (!type?.activo || ['parada', 'lanzamiento_fuera', 'gol_encajado', 'porcentaje_paradas'].includes(id) || quantity === 0) continue;
      const points = quantity * Number(type.puntos);
      expected += points;
      lines.push({ match, action: type.nombre, quantity: String(quantity), origin: 'recorded', points, rule: 'linear' });
    }
  }
  return { lines, expected: round(expected) };
}
