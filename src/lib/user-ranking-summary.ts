type RankingRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  puntos: number;
};

/** Same total-score ordering and rounding as the user leaderboard. */
export function userRankingSummary(rows: RankingRow[], userId: string, fallbackName: string) {
  const ordered = rows.map((row) => ({
    ...row,
    puntos: Math.round(Number(row.puntos) * 100) / 100,
    nombre: row.username ?? row.display_name ?? fallbackName,
  })).sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
  const index = ordered.findIndex((row) => row.user_id === userId);
  const row = ordered[index];
  return row ? { posicion: index + 1, puntos: row.puntos } : null;
}