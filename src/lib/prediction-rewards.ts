export type RewardRareza = "normal" | "raro" | "legendario";

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
