export type Category =
  | "benjamin"
  | "alevin"
  | "infantil"
  | "cadete"
  | "juvenil"
  | "senior";

export const CATEGORY_LABEL: Record<Category, string> = {
  benjamin: "Benjamín",
  alevin: "Alevín",
  infantil: "Infantil",
  cadete: "Cadete",
  juvenil: "Juvenil",
  senior: "Senior",
};

export const EDUCATIONAL_CATEGORIES: Category[] = ["benjamin", "alevin"];

export type Gender = "masculino" | "femenino" | "mixto";
export type Position = "portero" | "extremo" | "lateral" | "central" | "pivote" | "universal";

export const POSITION_LABEL: Record<Position, string> = {
  portero: "Portero/a",
  extremo: "Extremo",
  lateral: "Lateral",
  central: "Central",
  pivote: "Pivote",
  universal: "Universal",
};

export type MatchStatus = "pendiente" | "estadisticas" | "validado" | "publicado";

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Team {
  id: string;
  seasonId: string;
  name: string;
  category: Category;
  gender: Gender;
  color?: string;
}

export interface Player {
  id: string;
  teamId: string;
  publicName: string; // alias or "Ane G."
  dorsal: number;
  position: Position;
  isMinor: boolean;
  active: boolean;
}

export interface Match {
  id: string;
  seasonId: string;
  teamId: string;
  opponent: string;
  date: string;
  round: number;
  locationType: "local" | "visitante";
  goalsFor: number;
  goalsAgainst: number;
  status: MatchStatus;
  matchCode: string;
  actaFileUrl?: string;
}

export interface PlayerMatchStats {
  id: string;
  matchId: string;
  playerId: string;
  played: boolean;
  goals: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  sevenMetersWon: number;
  sevenMetersMissed: number;
  twoMinExclusions: number;
  redCard: boolean;
  saves: number;
  sevenMeterSaves: number;
  mvp: boolean;
  attitudeBonus: boolean;
  bestDefender: boolean;
  debut: boolean;
}

export type StatKey =
  | "goal"
  | "assist"
  | "steal"
  | "block"
  | "seven_won"
  | "provoke_exclusion"
  | "played"
  | "win"
  | "draw"
  | "save"
  | "seven_save"
  | "clean_sheet_20"
  | "turnover"
  | "seven_missed"
  | "two_min"
  | "red_card"
  | "mvp"
  | "best_defender"
  | "attitude"
  | "debut";

export interface ScoringRule {
  key: StatKey;
  label: string;
  points: number;
  active: boolean;
  isNegative: boolean;
}
