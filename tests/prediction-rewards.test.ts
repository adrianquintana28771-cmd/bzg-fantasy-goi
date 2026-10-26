import { describe, expect, test } from "bun:test";
import { REWARD_BY_ACIERTOS } from "../src/lib/prediction-rewards";
import { computeIdealSeven, countAciertos } from "../src/lib/ideal-seven";

describe("recompensas de predicción", () => {
  test("5 aciertos = 2 comunes y 1 raro", () => {
    expect(REWARD_BY_ACIERTOS[5]).toEqual(["normal", "normal", "raro"]);
  });
  test("6 aciertos = 2 comunes y 2 raros", () => {
    expect(REWARD_BY_ACIERTOS[6]).toEqual(["normal", "normal", "raro", "raro"]);
  });
  test("8 aciertos = 2 legendarios", () => {
    expect(REWARD_BY_ACIERTOS[8]).toEqual(["legendario", "legendario"]);
  });
  test("0 aciertos no da cartas", () => {
    expect(REWARD_BY_ACIERTOS[0]).toEqual([]);
  });
});

describe("empates", () => {
  const cands = [
    { id: "c1", posiciones: [], esEntrenador: true },
    { id: "c2", posiciones: [], esEntrenador: true },
    { id: "c3", posiciones: [], esEntrenador: true },
  ];
  const pts = new Map([["c1", 5], ["c2", 5], ["c3", 3]]);
  test("cualquier entrenador con el máximo cuenta como acierto", () => {
    const ideal = computeIdealSeven(cands, pts);
    expect(countAciertos({ entrenador: "c2" }, ideal, cands, pts)).toEqual(["entrenador"]);
    expect(countAciertos({ entrenador: "c1" }, ideal, cands, pts)).toEqual(["entrenador"]);
    expect(countAciertos({ entrenador: "c3" }, ideal, cands, pts)).toEqual([]);
  });
  test("el 7 ideal muestra al de mejor media de temporada", () => {
    const ideal = computeIdealSeven(cands, pts, new Map([["c1", 2], ["c2", 4]]));
    expect(ideal.entrenador?.id).toBe("c2");
  });
});
