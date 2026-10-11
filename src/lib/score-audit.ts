import { pctParadas, tramoPctPts, type Tramo } from '@/lib/club-data';

export type AuditAction = { match_id: string; player_id: string; action_id: string; cantidad: number };
export type AuditType = { id: string; nombre: string; puntos: number; activo: boolean; solo_portero: boolean; tramos: Tramo[] | null };
export type AuditLine = { match: string; action: string; quantity: string; origin: 'recorded' | 'automatic'; points: number; rule: 'linear' | 'tiers' | 'shared' | 'percentage' };
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Read-only reconciliation: preserve per-match precision until the jornada total. */
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
  for (const [match, quantities] of matches) {
    for (const [id, quantity] of quantities) {
      const type = byType.get(id);
      if (!type?.activo || id === 'porcentaje_paradas' || quantity === 0) continue;
      const shared = id === 'gol_encajado' && (participants.get(match)?.size ?? 1) > 1;
      const tiered = !shared && (id === 'parada' || id === 'gol_encajado') && !!type.tramos?.length;
      const points = tiered ? (type.tramos ?? []).reduce((sum, t) => sum + Number(t.puntos) * Math.max(0, Math.min(quantity, t.hasta ?? quantity) - (t.desde - 1)), 0) : quantity * Number(type.puntos);
      lines.push({ match, action: type.nombre, quantity: String(quantity), origin: tiered || shared ? 'automatic' : 'recorded', points, rule: shared ? 'shared' : tiered ? 'tiers' : 'linear' });
    }
    const percentage = pctParadas(quantities.get('parada') ?? 0, quantities.get('lanzamiento_fuera') ?? 0, quantities.get('gol_encajado') ?? 0);
    const type = byType.get('porcentaje_paradas');
    if (type?.activo && percentage != null) {
      lines.push({ match, action: type.nombre, quantity: `${percentage} %`, origin: 'automatic', points: Number(tramoPctPts(percentage, type.tramos ?? [])), rule: 'percentage' });
    }
  }
  return { lines, expected: round(lines.reduce((sum, l) => sum + l.points, 0)) };
}
