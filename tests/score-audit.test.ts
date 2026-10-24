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
  test('performance corrections replace previous points for a closed jornada match', () => {
    expect(auditPlayer('p', [action('closed-j1', 'parada', 16), action('closed-j1', 'gol_encajado', 19)], types).expected).toBe(37.7);
    expect(auditPlayer('p', [action('closed-j1', 'parada', 0), action('closed-j1', 'gol_encajado', 0)], types).expected).toBe(0);
  });
  test('audit uses edited recorded-action points without automatic coach results', () => {
    const changed = types.map(t => t.id === 'coach_victoria' ? { ...t, puntos: 7 } : t);
    expect(auditPlayer('p', [action('closed-j1', 'coach_victoria', 1)], changed).expected).toBe(7);
    expect(auditPlayer('p', [], changed).expected).toBe(0);
  });
  test('coach without recorded performance has 0, not automatic 5', () => expect(auditPlayer('p', [], types).expected).toBe(0));
  test('recorded coach victory keeps 5', () => expect(auditPlayer('p', [action('m','coach_victoria',1)], types).expected).toBe(5));
  test('single goalkeeper tiers are applied per match', () => expect(auditPlayer('p',[action('m1','gol_encajado',10),action('m2','gol_encajado',10)],types).expected).toBe(-2));
  test('multiple goalkeepers use configured conceded unit points', () => expect(auditPlayer('p',[action('m','gol_encajado',10),action('m','parada',1,'other')],types).expected).toBe(-10));
  test('10 saves, 5 outside, 20 conceded applies configured percentage tier', () => {
    const result = auditPlayer('p',[action('m','parada',10),action('m','lanzamiento_fuera',5),action('m','gol_encajado',20)],types);
    expect(result.lines.find(l => l.rule === 'percentage')?.quantity).toBe('28.57 %');
    expect(result.expected).toBe(27.5);
  });
  test('zero denominator has no percentage bonus', () => expect(auditPlayer('p',[action('m','parada',0)],types).expected).toBe(0));
  test('edited save points update closed jornada total', () => {
    const actions = [action('closed-j1','parada',10)];
    expect(auditPlayer('p',actions,types).expected).toBe(33);
    expect(auditPlayer('p',actions,types.map(t => t.id === 'parada' ? {...t,puntos:1.5} : t)).expected).toBe(23);
  });
  test('save tiers replace linear save points', () => expect(auditPlayer('p',[action('m','parada',10)],types.map(t => t.id === 'parada' ? {...t,tramos:[{desde:1,hasta:5,puntos:1},{desde:6,hasta:null,puntos:2}]} : t)).expected).toBe(23));
  test('edited 3-point saves and outside unit values agree with breakdown', () => {
    const edited = types.map(t => t.id === 'parada' ? {...t,puntos:3} : t.id === 'lanzamiento_fuera' ? {...t,puntos:0.75} : t);
    const result = auditPlayer('p',[action('m','parada',10),action('m','lanzamiento_fuera',5)],edited);
    expect(result.lines.find(l => l.actionId === 'parada')?.points).toBe(30);
    expect(result.lines.find(l => l.actionId === 'lanzamiento_fuera')?.points).toBe(3.75);
    expect(result.expected).toBe(41.75);
  });
  test('edited conceded tiers and shared unit value agree with breakdown', () => {
    const edited = types.map(t => t.id === 'gol_encajado' ? {...t,puntos:-0.5,tramos:[{desde:1,hasta:10,puntos:-0.25},{desde:11,hasta:null,puntos:-0.75}]} : t);
    const single = auditPlayer('p',[action('m','gol_encajado',12)],edited);
    expect(single.lines.find(l => l.actionId === 'gol_encajado')?.points).toBe(-4);
    expect(single.expected).toBe(-4);
    const shared = auditPlayer('p',[action('m','gol_encajado',12),action('m','parada',1,'other')],edited);
    expect(shared.lines.find(l => l.actionId === 'gol_encajado')?.points).toBe(-6);
    expect(shared.expected).toBe(-6);
  });
  test('disabled goalkeeper criteria do not score', () => expect(auditPlayer('p',[action('m','parada',10)],types.map(t => ({...t,activo:false}))).expected).toBe(0));
  test('missing inputs count as zero', () => expect(auditPlayer('p',[action('m','parada',10)],types).expected).toBe(33));
  test('percentage uses raw value before selecting tier', () => expect(auditPlayer('p',[action('m','parada',1),action('m','gol_encajado',2)],types.map(t => t.id === 'porcentaje_paradas' ? {...t,tramos:[{desde:33.334,hasta:null,puntos:8}]} : t)).expected).toBe(2.3));
  test('round each match before adding jornada', () => expect(auditPlayer('p',[action('m1','parada',1),action('m2','parada',1)],types.map(t => t.id === 'parada' ? {...t,puntos:1.235} : t.id === 'porcentaje_paradas' ? {...t,tramos:[]} : t)).expected).toBe(2.48));
});

test("field shooting percentage: highest tier only, 7m counted once, no points without shots", async () => {
  const { auditPlayer } = await import("../src/lib/score-audit");
  const tramos = [50, 60, 70, 80, 90, 100].map((desde, i) => ({ desde, hasta: null, puntos: [0.5, 1, 1.5, 2, 3.5, 5][i] }));
  const types = [
    { id: "gol", nombre: "Gol", puntos: 0, activo: true, solo_portero: false, tramos: null },
    { id: "gol_7m", nombre: "7m", puntos: 0, activo: true, solo_portero: false, tramos: null },
    { id: "falta_ataque", nombre: "Fallo", puntos: 0, activo: true, solo_portero: false, tramos: null },
    { id: "porcentaje_acierto", nombre: "Acierto", puntos: 0, activo: true, solo_portero: false, tramos },
  ];
  const a = (action_id: string, cantidad: number) => ({ match_id: "m", player_id: "p", action_id, cantidad });
  expect(auditPlayer("p", [a("gol", 7), a("falta_ataque", 4)], types).expected).toBe(1); // 63,64 %
  expect(auditPlayer("p", [a("gol", 2), a("gol_7m", 2)], types).expected).toBe(5); // 100 %
  expect(auditPlayer("p", [a("gol", 0)], types).expected).toBe(0);
});
