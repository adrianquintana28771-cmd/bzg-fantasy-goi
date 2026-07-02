import type { Category, PlayerMatchStats, ScoringRule, StatKey } from "./types";
import { EDUCATIONAL_CATEGORIES } from "./types";

export const DEFAULT_RULES: ScoringRule[] = [
  { key: "goal", label: "Gol", points: 3, active: true, isNegative: false },
  { key: "assist", label: "Asistencia", points: 2, active: true, isNegative: false },
  { key: "steal", label: "Recuperación", points: 2, active: true, isNegative: false },
  { key: "block", label: "Bloqueo defensivo", points: 2, active: true, isNegative: false },
  { key: "seven_won", label: "Provocar 7 metros", points: 2, active: true, isNegative: false },
  { key: "provoke_exclusion", label: "Provocar exclusión", points: 2, active: true, isNegative: false },
  { key: "played", label: "Partido jugado", points: 2, active: true, isNegative: false },
  { key: "win", label: "Victoria del equipo", points: 3, active: true, isNegative: false },
  { key: "draw", label: "Empate", points: 1, active: true, isNegative: false },
  { key: "save", label: "Parada (portero/a)", points: 1, active: true, isNegative: false },
  { key: "seven_save", label: "Parada de 7m (portero/a)", points: 4, active: true, isNegative: false },
  { key: "clean_sheet_20", label: "Menos de 20 goles encajados", points: 3, active: true, isNegative: false },
  { key: "turnover", label: "Pérdida de balón", points: -1, active: true, isNegative: true },
  { key: "seven_missed", label: "7m fallado", points: -2, active: true, isNegative: true },
  { key: "two_min", label: "Exclusión 2 min", points: -2, active: true, isNegative: true },
  { key: "red_card", label: "Tarjeta roja", points: -5, active: true, isNegative: true },
  { key: "mvp", label: "MVP del partido", points: 5, active: true, isNegative: false },
  { key: "best_defender", label: "Mejor defensor/a", points: 3, active: true, isNegative: false },
  { key: "attitude", label: "Mejor actitud/esfuerzo", points: 3, active: true, isNegative: false },
  { key: "debut", label: "Debut oficial", points: 2, active: true, isNegative: false },
];

export function getEffectiveRules(rules: ScoringRule[], category: Category): ScoringRule[] {
  const isEducational = EDUCATIONAL_CATEGORIES.includes(category);
  return rules.map((r) => {
    if (isEducational && r.isNegative) {
      return { ...r, points: 0 };
    }
    return r;
  });
}

function statCount(stats: PlayerMatchStats, key: StatKey, matchResult: "win" | "draw" | "loss"): number {
  switch (key) {
    case "goal": return stats.goals;
    case "assist": return stats.assists;
    case "steal": return stats.steals;
    case "block": return stats.blocks;
    case "seven_won": return stats.sevenMetersWon;
    case "provoke_exclusion": return 0; // future
    case "played": return stats.played ? 1 : 0;
    case "win": return stats.played && matchResult === "win" ? 1 : 0;
    case "draw": return stats.played && matchResult === "draw" ? 1 : 0;
    case "save": return stats.saves;
    case "seven_save": return stats.sevenMeterSaves;
    case "clean_sheet_20": return 0; // computed externally
    case "turnover": return stats.turnovers;
    case "seven_missed": return stats.sevenMetersMissed;
    case "two_min": return stats.twoMinExclusions;
    case "red_card": return stats.redCard ? 1 : 0;
    case "mvp": return stats.mvp ? 1 : 0;
    case "best_defender": return stats.bestDefender ? 1 : 0;
    case "attitude": return stats.attitudeBonus ? 1 : 0;
    case "debut": return stats.debut ? 1 : 0;
  }
}

export function calculateFantasyPoints(
  stats: PlayerMatchStats,
  rules: ScoringRule[],
  category: Category,
  matchResult: "win" | "draw" | "loss",
  goalsAgainst?: number,
): number {
  if (!stats.played) return 0;
  const effective = getEffectiveRules(rules, category);
  let total = 0;
  for (const rule of effective) {
    if (!rule.active) continue;
    let count = statCount(stats, rule.key, matchResult);
    if (rule.key === "clean_sheet_20" && goalsAgainst !== undefined) {
      count = goalsAgainst < 20 && stats.saves > 0 ? 1 : 0;
    }
    total += count * rule.points;
  }
  return total;
}
