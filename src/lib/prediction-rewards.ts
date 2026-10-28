export type RewardRareza = "normal" | "raro" | "legendario";

/** close_jornada bloquea la jornada y deja de marcarla como activa. */
export function isJornadaClosed(jornada: { is_locked: boolean; is_active: boolean } | null | undefined): boolean {
  return jornada?.is_locked === true && jornada.is_active === false;
}

/** Cartas entregadas según aciertos de la predicción (0–8). */
export const REWARD_BY_ACIERTOS: Record<number, RewardRareza[]> = {
  0: [],
  1: ["normal"],
  2: ["normal", "normal"],
  3: ["raro"],
  4: ["raro", "raro"],
  5: ["normal", "normal", "raro"],
  6: ["normal", "normal", "raro", "raro"],
  7: ["legendario"],
  8: ["legendario", "legendario"],
};
