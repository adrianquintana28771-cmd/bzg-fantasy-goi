import type { Match, Player, PlayerMatchStats, Season, Team } from "./types";

export const seasons: Season[] = [
  { id: "s24", name: "2024/25", startDate: "2024-09-01", endDate: "2025-06-30", isActive: true },
  { id: "s23", name: "2023/24", startDate: "2023-09-01", endDate: "2024-06-30", isActive: false },
];

export const teams: Team[] = [
  { id: "t1", seasonId: "s24", name: "BZG Senior Masc.", category: "senior", gender: "masculino" },
  { id: "t2", seasonId: "s24", name: "BZG Senior Fem.", category: "senior", gender: "femenino" },
  { id: "t3", seasonId: "s24", name: "BZG Juvenil Masc.", category: "juvenil", gender: "masculino" },
  { id: "t4", seasonId: "s24", name: "BZG Juvenil Fem.", category: "juvenil", gender: "femenino" },
];

// 20 players, 5 per team, deterministic
const names = [
  "Jon M.", "Iker A.", "Unai B.", "Ander G.", "Aitor R.",
  "Ane G.", "Nora Z.", "Maialen E.", "Leire O.", "Uxue T.",
  "Oihan V.", "Eneko C.", "Danel Q.", "Mikel H.", "Beñat L.",
  "Naia H.", "Irati L.", "June K.", "Amaia P.", "Miren D.",
];
const positions = ["portero", "extremo", "lateral", "central", "pivote"] as const;

export const players: Player[] = names.map((n, i) => {
  const teamIdx = Math.floor(i / 5);
  const pos = positions[i % 5];
  return {
    id: `p${i + 1}`,
    teamId: teams[teamIdx].id,
    publicName: n,
    dorsal: (i % 5) * 3 + 4,
    position: pos,
    isMinor: teamIdx >= 2, // juveniles
    active: true,
  };
});

export const matches: Match[] = [
  { id: "m1", seasonId: "s24", teamId: "t1", opponent: "Anaitasuna", date: "2024-10-05", round: 1, locationType: "local", goalsFor: 28, goalsAgainst: 24, status: "publicado", matchCode: "BZG-M1" },
  { id: "m2", seasonId: "s24", teamId: "t1", opponent: "Barakaldo HC", date: "2024-10-12", round: 2, locationType: "visitante", goalsFor: 22, goalsAgainst: 25, status: "publicado", matchCode: "BZG-M2" },
  { id: "m3", seasonId: "s24", teamId: "t2", opponent: "Zuazo", date: "2024-10-13", round: 1, locationType: "local", goalsFor: 30, goalsAgainst: 18, status: "publicado", matchCode: "BZG-M3" },
  { id: "m4", seasonId: "s24", teamId: "t3", opponent: "Leioa", date: "2024-10-19", round: 1, locationType: "visitante", goalsFor: 25, goalsAgainst: 22, status: "publicado", matchCode: "BZG-M4" },
  { id: "m5", seasonId: "s24", teamId: "t4", opponent: "Getxo", date: "2024-10-20", round: 1, locationType: "local", goalsFor: 23, goalsAgainst: 20, status: "estadisticas", matchCode: "BZG-M5" },
];

// deterministic pseudo-random
function seed(n: number) {
  return ((n * 9301 + 49297) % 233280) / 233280;
}

function makeStats(id: string, matchId: string, playerId: string, i: number, pos: string): PlayerMatchStats {
  const r = (offset: number) => Math.floor(seed(i * 13 + offset) * 6);
  const isPortero = pos === "portero";
  return {
    id,
    matchId,
    playerId,
    played: seed(i) > 0.15,
    goals: isPortero ? 0 : r(1),
    assists: isPortero ? 0 : r(2),
    steals: r(3),
    blocks: r(4),
    turnovers: Math.floor(seed(i * 7) * 3),
    sevenMetersWon: isPortero ? 0 : Math.floor(seed(i * 11) * 2),
    sevenMetersMissed: 0,
    twoMinExclusions: Math.floor(seed(i * 17) * 2),
    redCard: false,
    saves: isPortero ? 8 + r(5) : 0,
    sevenMeterSaves: isPortero ? Math.floor(seed(i * 19) * 2) : 0,
    mvp: false,
    attitudeBonus: seed(i * 23) > 0.85,
    bestDefender: false,
    debut: false,
  };
}

export const playerMatchStats: PlayerMatchStats[] = [];
let statId = 1;
for (const match of matches) {
  const teamPlayers = players.filter((p) => p.teamId === match.teamId);
  const mvpIdx = Math.floor(seed(Number(match.id.slice(1)) * 31) * teamPlayers.length);
  teamPlayers.forEach((p, i) => {
    const st = makeStats(`s${statId++}`, match.id, p.id, statId + i, p.position);
    if (i === mvpIdx) st.mvp = true;
    if (i === (mvpIdx + 1) % teamPlayers.length) st.bestDefender = true;
    playerMatchStats.push(st);
  });
}
