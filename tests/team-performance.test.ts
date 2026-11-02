import { expect, test } from "bun:test";
import { aggregateTeamPerformance, performancePercentages } from "../src/lib/team-performance";

test("every played participant, including call-ups, counts once; unplayed players do not count", () => {
  const result = aggregateTeamPerformance([
    { player_id: "senior", jugado: true }, { player_id: "juvenil", jugado: true },
    { player_id: "juvenil", jugado: true }, { player_id: "bench", jugado: false },
  ], [
    { player_id: "senior", action_id: "gol", cantidad: 4 },
    { player_id: "juvenil", action_id: "gol", cantidad: 3 },
    { player_id: "bench", action_id: "gol", cantidad: 10 },
    { player_id: "outsider", action_id: "gol", cantidad: 9 },
  ]);
  expect(result.totals.gol).toBe(7);
  expect(Object.keys(result.players)).toEqual(["senior", "juvenil"]);
  expect(result.players.juvenil.gol).toBe(3);
});

test("team percentages use total quantities, not individual averages, with 7m counted once", () => {
  const { totals } = aggregateTeamPerformance([
    { player_id: "a", jugado: true }, { player_id: "b", jugado: true },
  ], [
    { player_id: "a", action_id: "gol", cantidad: 1 },
    { player_id: "b", action_id: "gol", cantidad: 6 },
    { player_id: "b", action_id: "gol_7m", cantidad: 2 },
    { player_id: "b", action_id: "falta_ataque", cantidad: 1 },
    { player_id: "a", action_id: "parada", cantidad: 2 },
    { player_id: "b", action_id: "parada", cantidad: 4 },
    { player_id: "b", action_id: "lanzamiento_fuera", cantidad: 2 },
    { player_id: "b", action_id: "gol_encajado", cantidad: 12 },
  ]);
  expect(performancePercentages(totals)).toEqual({ shooting: 90, saves: 30 });
  expect(totals.gol_7m).toBe(2);
});

test("no recorded attempts yields no percentage, not invented zero percent", () => {
  expect(performancePercentages({})).toEqual({ shooting: null, saves: null });
});