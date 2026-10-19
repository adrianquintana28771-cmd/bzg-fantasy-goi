import { type Tramo } from '@/lib/club-data';

export type AuditAction = { match_id: string; player_id: string; action_id: string; cantidad: number };
export type AuditType = { id: string; nombre: string; puntos: number; activo: boolean; solo_portero: boolean; tramos: Tramo[] | null };
export type AuditLine = { match: string; actionId: string; action: string; quantity: string; origin: 'recorded' | 'automatic'; points: number; rule: 'linear' | 'tiers' | 'shared' | 'percentage' | 'goalkeeper' };
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Mirror configured goalkeeper criteria per match, then aggregate the jornada. */
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
    const units = (id: string, quantity: number, useTiers: boolean) => {
      const type = byType.get(id);
      if (!type?.activo) return 0;
      return useTiers && type.tramos?.length
        ? type.tramos.reduce((sum, t) => sum + t.puntos * Math.max(0, Math.min(quantity, t.hasta ?? quantity) - (t.desde - 1)), 0)
        : quantity * type.puntos;
    };
    const saves = units('parada', par, true);
    const outside = units('lanzamiento_fuera', fue, false);
    const conceded = units('gol_encajado', gol, !shared);
    const percentage = shots > 0 ? par * 100 / shots : 0;
    const pctType = byType.get('porcentaje_paradas');
    const bonus = pctType?.activo ? [...(pctType.tramos ?? [])].sort((a,b) => b.desde - a.desde).find(t => percentage >= t.desde && (t.hasta == null || percentage <= t.hasta))?.puntos ?? 0 : 0;
    if (shots > 0) {
      expected += round(saves + outside + conceded + bonus);
      for (const [id, quantity, points, rule] of [
        ['parada', par, saves, byType.get('parada')?.tramos?.length ? 'tiers' : 'linear'],
        ['lanzamiento_fuera', fue, outside, 'linear'],
        ['gol_encajado', gol, conceded, shared ? 'shared' : 'tiers'],
      ] as const) {
        if (quantity !== 0 && byType.get(id)?.activo) lines.push({ match, actionId: id, action: byType.get(id)?.nombre ?? id, quantity: String(quantity), origin: 'automatic', points, rule });
      }
      if (pctType?.activo) lines.push({ match, actionId: 'porcentaje_paradas', action: pctType.nombre, quantity: `${round(percentage)} %`, origin: 'automatic', points: bonus, rule: 'percentage' });
    }
    for (const [id, quantity] of quantities) {
      const type = byType.get(id);
      if (!type?.activo || ['parada', 'lanzamiento_fuera', 'gol_encajado', 'porcentaje_paradas'].includes(id) || quantity === 0) continue;
      const points = quantity * Number(type.puntos);
      expected += points;
      lines.push({ match, actionId: id, action: type.nombre, quantity: String(quantity), origin: 'recorded', points, rule: 'linear' });
    }
  }
  return { lines, expected: round(expected) };
}
