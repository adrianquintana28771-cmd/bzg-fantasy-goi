import { expect, test } from "bun:test";
import { buildPlayerChartRows } from "../src/lib/player-chart";

const calendar = [1, 2, 3].map(numero => ({ numero, is_active: numero === 3, is_locked: numero < 3 }));
const matches = [1, 2, 3].map(jornada => ({ jornada, rival: "Rival" }));

test("retains every closed/current jornada even without participation, excluding future jornadas", () => {
  const rows = buildPlayerChartRows([...calendar, { numero: 4, is_active: false, is_locked: false }], matches, [], [], "disponible");
  expect(rows.map(r => r.jornada)).toEqual(["J1", "J2", "J3"]);
  expect(rows.map(r => r.pts)).toEqual([null, null, null]);
});

test("rest is empty even when current player is unavailable", () => {
  const rows = buildPlayerChartRows(calendar, [{ jornada: 3, rival: "Descansa" }], [], [], "no_disponible");
  expect(rows[2]).toMatchObject({ pts: null, estado: null, reason: "rest" });
});

test("unplayed unavailable jornada carries its status rather than invented points", () => {
  const rows = buildPlayerChartRows(calendar, matches, [{ jornada: 1, puntos: 0, estado: "no_disponible" }], [], "no_disponible");
  expect(rows[0]).toMatchObject({ pts: null, reason: "unavailable" });
  expect(rows[2]).toMatchObject({ pts: null, reason: "unavailable" });
});

test("unplayed doubtful jornada carries its distinct status", () => {
  const rows = buildPlayerChartRows(calendar, matches, [{ jornada: 2, puntos: 0, estado: "dudoso" }], [], "dudoso");
  expect(rows[1]?.reason).toBe("doubtful");
  expect(rows[2]?.reason).toBe("doubtful");
});

test("current injury never gets projected onto unknown historical jornadas", () => {
  const rows = buildPlayerChartRows(calendar, matches, [], [], "no_disponible");
  expect(rows[0]?.reason).toBe("unrecorded");
  expect(rows[1]?.estado).toBeNull();
});

test("played zero, negative points and cross-team call-ups remain intact", () => {
  const rows = buildPlayerChartRows(calendar, [], [{ jornada: 2, puntos: -5, estado: "disponible" }], [1, 2], "no_disponible");
  expect(rows[0]).toMatchObject({ pts: 0, reason: "played" });
  expect(rows[1]).toMatchObject({ pts: -5, reason: "played" });
});