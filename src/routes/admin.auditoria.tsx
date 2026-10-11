import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminGuard } from '@/components/admin-guard';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { fetchScoreAudit } from '@/lib/score-audit-data';

export const Route = createFileRoute('/admin/auditoria')({
  head: () => ({ meta: [{ title: 'Auditoría de puntuaciones · BZG Fantasy' }, { name: 'description', content: 'Revisión por jornada del origen de los puntos registrados y autocalculados de BZG Fantasy.' }, { property: 'og:title', content: 'Auditoría de puntuaciones · BZG Fantasy' }, { property: 'og:description', content: 'Puntos por jornada, acciones registradas y diferencias de puntuación.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <AdminGuard><AuditPage /></AdminGuard>,
});
const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
function AuditPage() {
  const t = useT();
  const { isSuperAdmin } = useAuth();
  const [jornada, setJornada] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [rarity, setRarity] = useState('normal');
  const [unexpected, setUnexpected] = useState(false);
  const calendar = useQuery({ queryKey: ['audit-jornadas'], enabled: isSuperAdmin, queryFn: async () => {
    const { data, error } = await supabase.from('jornadas').select('numero,is_active').order('numero', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } });
  const selected = jornada ?? calendar.data?.find(j => j.is_active)?.numero ?? calendar.data?.[0]?.numero;
  const audit = useQuery({ queryKey: ['score-audit', selected], enabled: isSuperAdmin && selected != null, queryFn: () => fetchScoreAudit(selected ?? 0) });
  if (!isSuperAdmin) return <p className="p-8">{t('super_admin bakarrik.', 'Solo super_admin.')}</p>;
  const rows = (audit.data ?? []).filter(p => {
    const kind = p.club?.es_entrenador ? 'coach' : p.posicion === 'portero' ? 'goalkeeper' : 'player';
    return p.nombre.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (role === 'all' || role === kind) && (rarity === 'all' || p.rareza === rarity) && (!unexpected || p.difference !== 0 || (p.saved == null && p.lines.length > 0));
  });
  const control = 'rounded-md border border-border bg-background p-2 text-sm';
  return <main className="mx-auto max-w-6xl px-4 py-8">
    <BackButton />
    <div className="mt-4 flex items-center justify-between gap-3"><h1 className="font-display text-2xl">{t('Puntuazioen auditoria', 'Auditoría de puntuaciones')}</h1><Button variant="outline" size="icon" title={t('Eguneratu', 'Actualizar')} aria-label={t('Eguneratu', 'Actualizar')} disabled={audit.isFetching} onClick={() => audit.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
    <div className="my-5 flex flex-wrap items-center gap-3">
      <select aria-label={t('Jardunaldia', 'Jornada')} className={control} value={selected ?? ''} onChange={e => setJornada(Number(e.target.value))}>{calendar.data?.map(j => <option key={j.numero} value={j.numero}>J{j.numero}</option>)}</select>
      <Input className="w-48" aria-label={t('Izena', 'Nombre')} placeholder={t('Izena', 'Nombre')} value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label={t('Rola', 'Rol')} className={control} value={role} onChange={e => setRole(e.target.value)}><option value="all">{t('Rol guztiak', 'Todos los roles')}</option><option value="player">{t('Jokalariak', 'Jugadores/as')}</option><option value="goalkeeper">{t('Atezainak', 'Porteros/as')}</option><option value="coach">{t('Entrenatzaileak', 'Entrenadores/as')}</option></select>
      <select aria-label={t('Bitxitasuna', 'Rareza')} className={control} value={rarity} onChange={e => setRarity(e.target.value)}><option value="normal">{t('Arrunta', 'Común')}</option><option value="raro">{t('Bitxia', 'Raro')}</option><option value="legendario">{t('Legendarioa', 'Legendario')}</option><option value="all">{t('Guztiak', 'Todas')}</option></select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unexpected} onChange={e => setUnexpected(e.target.checked)} />{t('Desberdintasunak bakarrik', 'Solo diferencias')}</label>
    </div>
    {(audit.isPending || calendar.isPending) && <p>{t('Kargatzen…', 'Cargando…')}</p>}
    {(audit.error || calendar.error) && <p role="alert" className="text-destructive">{t('Ezin izan dira datuak irakurri.', 'No se han podido consultar los datos.')}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-3">{t('Jokalaria / jatorria', 'Jugador/a / origen')}</th><th className="p-3">{t('Gordeta', 'Guardados')}</th><th className="p-3">{t('Espero dena', 'Esperados')}</th><th className="p-3">{t('Aldea', 'Diferencia')}</th></tr></thead><tbody>{rows.map(p => <tr key={p.id} className="border-b border-border align-top"><td className="p-3"><details><summary className="cursor-pointer"><Link to="/jugadores/$playerId" params={{ playerId: p.id }} translate="no" className="font-semibold text-primary">{p.nombre}</Link> <span className="text-xs text-muted-foreground">· {p.club?.es_entrenador ? t('Entrenatzailea', 'Entrenador/a') : p.posicion === 'portero' ? t('Atezaina', 'Portero/a') : t('Jokalaria', 'Jugador/a')}</span></summary>
      {p.unavailable && <p className="mt-2 text-warning">{t('Ez eskuragarri: 0 puntu.', 'No disponible: 0 puntos.')}</p>}
      {p.saved == null && p.lines.length > 0 && <p className="mt-2 text-destructive">{t('Puntuazioa gorde gabe.', 'Falta la puntuación guardada.')}</p>}
      {p.lines.length === 0 && <p className="mt-2 text-muted-foreground">{t('Ez dago ekintzarik erregistratuta.', 'Sin acciones registradas.')}</p>}
      <ul className="mt-3 space-y-3">{p.lines.map((l,i) => <li key={i}><div translate="no" className="text-xs text-muted-foreground">{l.match}</div><div>{l.action} · {l.quantity} → <strong>{fmt(l.points)} pts</strong></div><div className="text-xs text-muted-foreground">{l.origin === 'recorded' ? t('Erregistratua', 'Registrado') : t('Autokalkulatua', 'Autocalculado')} · {l.rule === 'shared' ? t('Atezain bat baino gehiago: irizpidearen puntu linealak', 'Varios porteros: puntos lineales del criterio') : l.rule === 'tiers' ? t('Partidako tarteak', 'Tramos por partido') : l.rule === 'percentage' ? t('Paraden ehunekoaren tartea', 'Tramo de porcentaje de paradas') : t('Kopurua × irizpidearen puntuak', 'Cantidad × puntos del criterio')}</div></li>)}</ul>
    </details></td><td className="p-3 tabular-nums">{p.saved == null ? '—' : fmt(p.saved)}</td><td className="p-3 tabular-nums">{fmt(p.expected)}</td><td className={`p-3 font-semibold tabular-nums ${p.difference !== 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{fmt(p.difference)}</td></tr>)}</tbody></table></div>
    {!audit.isPending && rows.length === 0 && <p className="py-8 text-center text-muted-foreground">{t('Ez dago emaitzarik.', 'Sin resultados.')}</p>}
  </main>;
}
