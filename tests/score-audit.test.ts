import { describe, expect, test } from 'bun:test';
import { auditPlayer, type AuditType } from '../src/lib/score-audit';
const types: AuditType[] = [
  { id: 'coach_victoria', nombre: 'Victoria', puntos: 5, activo: true, solo_portero: false, tramos: null },
  { id: 'parada', nombre: 'Parada', puntos: 2.5, activo: true, solo_portero: true, tramos: null },
  { id: 'gol_encajado', nombre: 'Goles', puntos: -1, activo: true, solo_portero: true, tramos: [{ desde: 1, hasta: 10, puntos: -0.1 }, { desde: 11, hasta: 20, puntos: -0.2 }] },
  { id: 'lanzamiento_fuera', nombre: 'Fuera', puntos: 1, activo: true, solo_portero: true, tramos: null },
  { id: 'porcentaje_paradas', nombre: '%', puntos: 0, activo: true, solo_portero: true, tramos: [{ desde: 25, hasta: null, puntos: 0.5 }, { desde: 50, hasta: null, puntos: 8 }] },
];
const action = (match_id: string, action_id: string, cantidad: number, player_id = 'p') => ({ match_id, action_id, cantidad, player_id });
describe('read-only score audit', () => {
  test('coach without recorded performance has 0, not automatic 5', () => expect(auditPlayer('p', [], types).expected).toBe(0));
  test('recorded coach victory keeps 5', () => expect(auditPlayer('p', [action('m','coach_victoria',1)], types).expected).toBe(5));
  test('single goalkeeper tiers are applied per match', () => expect(auditPlayer('p',[action('m1','gol_encajado',10),action('m2','gol_encajado',10)],types).expected).toBe(-2));
  test('multiple goalkeepers use configured linear penalty', () => expect(auditPlayer('p',[action('m','gol_encajado',10),action('m','parada',1,'other')],types).expected).toBe(-10));
  test('10 saves, 5 outside, 20 conceded gives 28.57% and 0.5 bonus', () => {
    const result = auditPlayer('p',[action('m','parada',10),action('m','lanzamiento_fuera',5),action('m','gol_encajado',20)],types);
    expect(result.lines.find(l => l.rule === 'percentage')?.quantity).toBe('28.57 %');
    expect(result.lines.find(l => l.rule === 'percentage')?.points).toBe(0.5);
  });
  test('zero denominator has no percentage bonus', () => expect(auditPlayer('p',[action('m','parada',0)],types).lines).toHaveLength(0));
});