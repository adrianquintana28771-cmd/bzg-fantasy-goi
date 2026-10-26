import { supabase } from '@/integrations/supabase/client';
import { auditPlayer, type AuditAction, type AuditBonus, type AuditType } from './score-audit';
import { fetchAllRows, type Tramo } from './club-data';

/**
 * Goles encajados por el equipo en cada partido y su media en jornadas anteriores.
 * Solo cuentan partidos con gol_encajado registrado; la media usa jornadas estrictamente anteriores del mismo equipo.
 */
export async function fetchBonusByMatch(): Promise<Map<string, AuditBonus>> {
  const [matches, golRows] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('club_matches').select('id,team_id,jornada').range(from, to)),
    fetchAllRows((from, to) => supabase.from('club_match_actions').select('match_id,cantidad').eq('action_id', 'gol_encajado').range(from, to)),
  ]);
  const goles = new Map<string, number>();
  for (const r of golRows) goles.set(r.match_id, (goles.get(r.match_id) ?? 0) + (r.cantidad ?? 0));
  const byTeam = new Map<string, { jornada: number; goles: number }[]>();
  for (const m of matches) {
    const g = goles.get(m.id);
    if (g == null) continue;
    const list = byTeam.get(m.team_id) ?? [];
    list.push({ jornada: m.jornada, goles: g });
    byTeam.set(m.team_id, list);
  }
  const out = new Map<string, AuditBonus>();
  for (const m of matches) {
    const prev = (byTeam.get(m.team_id) ?? []).filter((x) => x.jornada < m.jornada);
    out.set(m.id, {
      goles: goles.get(m.id) ?? null,
      media: prev.length ? prev.reduce((a, x) => a + x.goles, 0) / prev.length : null,
    });
  }
  return out;
}

export async function fetchScoreAudit(jornada: number) {
  const [poolRows, matches, types, stats, bonusByMatch] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('player_pool').select('id,nombre,rareza,posicion,club_player_id,club:club_players(es_entrenador),team_id').order('id').range(from, to)),
    supabase.from('club_matches').select('id,rival,team_id,club_teams(nombre)').eq('jornada', jornada),
    supabase.from('club_action_types').select('id,nombre,puntos,activo,solo_portero,tramos'),
    supabase.from('player_jornada_stats').select('player_id,puntos,estado').eq('jornada_numero', jornada),
    fetchBonusByMatch(),
  ]);
  for (const result of [matches, types, stats]) if (result.error) throw result.error;
  const actions: AuditAction[] = [];
  const ids = (matches.data ?? []).map(m => m.id);
  const playedBy = new Map<string, Set<string>>();
  if (ids.length) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('club_match_actions').select('match_id,player_id,action_id,cantidad').in('match_id', ids).order('id').range(offset, offset + 999);
      if (error) throw error;
      actions.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    const playedRows = await fetchAllRows((from, to) =>
      supabase.from('club_match_players').select('match_id,player_id').in('match_id', ids).eq('jugado', true).range(from, to));
    for (const r of playedRows) {
      const set = playedBy.get(r.player_id) ?? new Set<string>();
      set.add(r.match_id);
      playedBy.set(r.player_id, set);
    }
  }
  const config: AuditType[] = (types.data ?? []).map(t => ({ ...t, puntos: Number(t.puntos), tramos: t.tramos as Tramo[] | null }));
  const saved = new Map((stats.data ?? []).map(s => [s.player_id, s]));
  const matchLabels = new Map((matches.data ?? []).map(m => [m.id, `${m.club_teams?.nombre ?? ''} · ${m.rival}`]));
  return poolRows.map(p => {
    const clubId = p.club_player_id ?? '';
    // Los entrenadores no reciben puntos automáticos por resultado: solo acciones registradas.
    const played = p.club?.es_entrenador ? undefined : playedBy.get(clubId);
    const result = auditPlayer(clubId, actions, config, played, bonusByMatch);
    const stat = saved.get(p.id);
    const expected = stat?.estado === 'no_disponible' ? 0 : result.expected;
    return { ...p, ...result, expected, saved: stat ? Number(stat.puntos) : null, unavailable: stat?.estado === 'no_disponible', difference: Math.round(((stat ? Number(stat.puntos) : 0) - expected) * 100) / 100, lines: result.lines.map(l => ({ ...l, match: matchLabels.get(l.match) ?? l.match })) };
  }).sort((a,b) => Math.abs(b.difference) - Math.abs(a.difference) || a.nombre.localeCompare(b.nombre));
}
