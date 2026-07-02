import { calculateFantasyPoints } from "./rules";
import type { Match, Player, PlayerMatchStats, ScoringRule, Team } from "./types";

export function matchResult(m: Match): "win" | "draw" | "loss" {
  if (m.goalsFor > m.goalsAgainst) return "win";
  if (m.goalsFor === m.goalsAgainst) return "draw";
  return "loss";
}

export function pointsForStat(
  stat: PlayerMatchStats,
  match: Match,
  team: Team,
  rules: ScoringRule[],
): number {
  return calculateFantasyPoints(stat, rules, team.category, matchResult(match), match.goalsAgainst);
}

export interface PlayerAggregate {
  player: Player;
  team: Team;
  matchesPlayed: number;
  totalPoints: number;
  avgPoints: number;
  goals: number;
  assists: number;
  steals: number;
  saves: number;
  perMatch: { round: number; matchId: string; points: number; date: string }[];
}

export function aggregatePlayer(
  player: Player,
  teams: Team[],
  matches: Match[],
  stats: PlayerMatchStats[],
  rules: ScoringRule[],
): PlayerAggregate {
  const team = teams.find((t) => t.id === player.teamId)!;
  const playerStats = stats.filter((s) => s.playerId === player.id);
  let total = 0, played = 0, goals = 0, assists = 0, steals = 0, saves = 0;
  const perMatch: PlayerAggregate["perMatch"] = [];
  for (const s of playerStats) {
    const m = matches.find((mm) => mm.id === s.matchId);
    if (!m) continue;
    const pts = pointsForStat(s, m, team, rules);
    if (s.played) {
      played++;
      goals += s.goals;
      assists += s.assists;
      steals += s.steals;
      saves += s.saves;
    }
    total += pts;
    perMatch.push({ round: m.round, matchId: m.id, points: pts, date: m.date });
  }
  perMatch.sort((a, b) => a.date.localeCompare(b.date));
  return {
    player,
    team,
    matchesPlayed: played,
    totalPoints: total,
    avgPoints: played ? total / played : 0,
    goals, assists, steals, saves,
    perMatch,
  };
}

export interface RankingFilters {
  seasonId?: string;
  category?: string;
  teamId?: string;
  round?: number;
  gender?: string;
  position?: string;
}

export function buildRanking(
  players: Player[],
  teams: Team[],
  matches: Match[],
  stats: PlayerMatchStats[],
  rules: ScoringRule[],
  filters: RankingFilters = {},
): PlayerAggregate[] {
  const eligibleTeams = teams.filter((t) => {
    if (filters.seasonId && t.seasonId !== filters.seasonId) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.gender && t.gender !== filters.gender) return false;
    if (filters.teamId && t.id !== filters.teamId) return false;
    return true;
  });
  const teamIds = new Set(eligibleTeams.map((t) => t.id));
  const eligiblePlayers = players.filter((p) => {
    if (!teamIds.has(p.teamId)) return false;
    if (filters.position && p.position !== filters.position) return false;
    return true;
  });
  const filteredMatches = filters.round
    ? matches.filter((m) => m.round === filters.round)
    : matches;
  const matchIds = new Set(filteredMatches.map((m) => m.id));
  const filteredStats = stats.filter((s) => matchIds.has(s.matchId));
  return eligiblePlayers
    .map((p) => aggregatePlayer(p, teams, filteredMatches, filteredStats, rules))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
