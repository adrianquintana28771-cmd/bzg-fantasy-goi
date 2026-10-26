import { describe, expect, test } from "bun:test";
import { computeIdealSeven } from "../src/lib/ideal-seven";

describe("7 ideal", () => {
  test("jugador mejor en dos posiciones va donde el segundo pierde más", () => {
    const c = [
      { id: "mikel", posiciones: ["lateral_izq", "lateral_der"], esEntrenador: false },
      { id: "li2", posiciones: ["lateral_izq"], esEntrenador: false },
      { id: "ld2", posiciones: ["lateral_der"], esEntrenador: false },
    ];
    const pts = new Map([["mikel", 40], ["li2", 30], ["ld2", 32]]);
    const r = computeIdealSeven(c, pts);
    expect(r.lateral_izq?.id).toBe("mikel");
    expect(r.lateral_der?.id).toBe("ld2");
  });
  test("entrenador solo entre entrenadores", () => {
    const c = [
      { id: "coach", posiciones: [], esEntrenador: true },
      { id: "p", posiciones: ["pivote"], esEntrenador: false },
    ];
    const r = computeIdealSeven(c, new Map([["coach", 5], ["p", 50]]));
    expect(r.entrenador?.id).toBe("coach");
    expect(r.pivote?.id).toBe("p");
  });
});
