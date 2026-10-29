import { expect, test } from "bun:test";
import { userRankingSummary } from "../src/lib/user-ranking-summary";

const rows = [
  { user_id: "b", username: "B", display_name: null, puntos: 100.25 },
  { user_id: "a", username: "A", display_name: null, puntos: 100.25 },
  { user_id: "c", username: "C", display_name: null, puntos: 200.5 },
];

test("position and total match the total user leaderboard, including alphabetical ties", () => {
  expect(userRankingSummary(rows, "b", "Usuario")).toEqual({ posicion: 3, puntos: 100.25 });
  expect(userRankingSummary(rows, "c", "Usuario")).toEqual({ posicion: 1, puntos: 200.5 });
});

test("excluded users do not receive an invented rank or score", () => {
  expect(userRankingSummary(rows, "hidden", "Usuario")).toBeNull();
});