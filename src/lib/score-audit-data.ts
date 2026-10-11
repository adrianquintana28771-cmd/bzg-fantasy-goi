import { supabase } from '@/integrations/supabase/client';
import { auditPlayer, type AuditAction, type AuditType } from './score-audit';
import type { Tramo } from './club-data';

export async function fetchScoreAudit(jornada: number) {
  const [pool, matches, types, stats] = await Promise.all([
    supabase.from('player_pool').select('id,nombre,rareza,posicion,club_player_id,club:club_players(es_entrenador),team_id').order('id'),
    supabase.from('club_matches').select('id,rival,team_id,club_teams(nombre)').eq('jornada', jornada),
    supabase.from('club_action_types').select('id,nombre,puntos,activo,solo_portero,tramos'),
    supabase.from('player_jornada_stats').select('player_id,puntos,estado').eq('jornada_numero', jornada),
  ]);
  for (const result of [pool, matches, types, stats]) if (result.error) throw result.error;
  const actions: AuditAction[] = [];
  const ids = (matches.data ?? []).map(m => m.id);
  if (ids.length) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('club_match_actions').select('match_id,player_id,action_id,cantidad').in('match_id', ids).order('id').range(offset, offset + 999);
      if (error) throw error;
      actions.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  const config: AuditType[] = (types.data ?? []).map(t => ({ ...t, puntos: Number(t.puntos), tramos: t.tramos as Tramo[] | null }));
  const saved = new Map((stats.data ?? []).map(s => [s.player_id, s]));
  const matchLabels = new Map((matches.data ?? []).map(m => [m.id, `${m.club_teams?.nombre ?? ''} · ${m.rival}`]));
  return (pool.data ?? []).map(p => {
    const result = auditPlayer(p.club_player_id ?? '', actions, config);
    const stat = saved.get(p.id);
    const expected = stat?.estado === 'no_disponible' ? 0 : result.expected;
    return { ...p, ...result, expected, saved: stat ? Number(stat.puntos) : null, unavailable: stat?.estado === 'no_disponible', difference: Math.round(((stat ? Number(stat.puntos) : 0) - expected) * 100) / 100, lines: result.lines.map(l => ({ ...l, match: matchLabels.get(l.match) ?? l.match })) };
  }).sort((a,b) => Math.abs(b.difference) - Math.abs(a.difference) || a.nombre.localeCompare(b.nombre));
}
