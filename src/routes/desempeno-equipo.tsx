import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { getTeamPerformance } from "@/lib/team-performance.functions";
import { aggregateTeamPerformance, performancePercentages } from "@/lib/team-performance";
import { useT, useLang } from "@/lib/i18n";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Search = { equipo: string; jornada: number; partido: string };
const performanceQuery = (match?: string) => queryOptions({
  queryKey: ["team-performance", match ?? "calendar"],
  queryFn: () => getTeamPerformance({ data: { match } }),
});
type Performance = Awaited<ReturnType<typeof getTeamPerformance>>;

function selection(data: Performance, search: Search) {
  const team = data.teams.find(t => t.id === search.equipo) ?? data.teams[0];
  const matches = data.matches.filter(m => m.team_id === team?.id);
  const jornadas = [...new Set(matches.map(m => m.jornada))].sort((a, b) => b - a);
  const jornada = jornadas.includes(search.jornada) ? search.jornada : jornadas[0];
  const options = matches.filter(m => m.jornada === jornada);
  const match = options.find(m => m.id === search.partido) ?? options[0];
  return { team, jornadas, jornada, options, match };
}

export const Route = createFileRoute("/desempeno-equipo")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    equipo: typeof search.equipo === "string" ? search.equipo : "",
    jornada: typeof search.jornada === "number" && Number.isFinite(search.jornada) ? search.jornada : 0,
    partido: typeof search.partido === "string" ? search.partido : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const calendar = await context.queryClient.ensureQueryData(performanceQuery());
    const { match } = selection(calendar, deps);
    if (match) await context.queryClient.ensureQueryData(performanceQuery(match.id));
  },
  head: () => {
    const title = "Desempeño por equipo · BZG Fantasy";
    const description = "Estadísticas por equipo, jornada y partido de BZG Etxebarri, con participantes y convocados de otras categorías.";
    return {
      meta: [{ title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
      links: [{ rel: "canonical", href: "https://bzgfantasy.app/desempeno-equipo" }],
    };
  },
  component: TeamPerformancePage,
  errorComponent: PerformanceError,
  notFoundComponent: PerformanceNotFound,
});

function PerformanceError() {
  const t = useT();
  const router = useRouter();
  return <div className="mx-auto max-w-5xl px-4 py-8" role="alert">
    <p>{t("Ezin izan dira estatistikak kargatu.", "No se han podido cargar las estadísticas.")}</p>
    <Button className="mt-4" onClick={() => router.invalidate()}>{t("Berriro saiatu", "Reintentar")}</Button>
  </div>;
}

function PerformanceNotFound() {
  const t = useT();
  return <p className="p-8">{t("Ez da partida aurkitu.", "No se ha encontrado el partido.")}</p>;
}

function TeamPerformancePage() {
  const t = useT();
  const { td, lang } = useLang();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: calendar } = useSuspenseQuery(performanceQuery());
  const selected = selection(calendar, search);
  const { data } = useSuspenseQuery(performanceQuery(selected.match?.id));
  const { players: counts, totals } = aggregateTeamPerformance(data.participants, data.actions);
  const recorded = new Set(data.actions.filter(a => counts[a.player_id]).map(a => a.action_id));
  const criteria = data.criteria.filter(c => c.activo || recorded.has(c.id));
  const percentages = performancePercentages(totals);
  const number = (n: number | null) => n === null ? "—" : `${n.toLocaleString(lang === "eu" ? "eu-ES" : "es-ES", { maximumFractionDigits: 2 })}%`;
  const matchLabel = (m: Performance["matches"][number]) => `${m.fecha.split("-").reverse().join("/")}${m.hora ? ` · ${m.hora}` : ""} · ${m.competicion ?? `J${m.jornada}`}`;
  const people = data.players.filter(p => counts[p.id]).sort((a, b) =>
    `${a.apellido1 ?? ""} ${a.nombre}`.localeCompare(`${b.apellido1 ?? ""} ${b.nombre}`));
  const memberships = (p: Performance["players"][number]) => p.club_player_teams
    .map(link => link.club_teams)
    .filter(team => team !== null && team.season_id === selected.team?.season_id);
  const isCallUp = (p: Performance["players"][number]) => {
    const teams = memberships(p);
    return teams.length > 0 && !teams.some(team => team.id === selected.team?.id);
  };
  const callUps = people.filter(isCallUp);

  return <main className="mx-auto max-w-6xl px-4 py-8">
    <BackButton />
    <h1 className="mt-3 flex items-start gap-3 font-display text-3xl sm:text-4xl">
      <BarChart3 className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden />
      {t("Errendimendua taldeka", "Desempeño por equipo")}
    </h1>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="min-w-0 space-y-2">
        <label id="team-label" className="text-sm font-semibold">{t("Taldea", "Equipo")}</label>
        <Select value={selected.team?.id ?? ""} onValueChange={equipo => navigate({ search: { equipo, jornada: 0, partido: "" } })}>
          <SelectTrigger aria-labelledby="team-label" translate="no"><SelectValue placeholder={t("Aukeratu taldea", "Seleccionar equipo")} /></SelectTrigger>
          <SelectContent>{calendar.teams.map(team => <SelectItem key={team.id} value={team.id}><span translate="no">{team.nombre}</span></SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-2">
        <label id="jornada-label" className="text-sm font-semibold">{t("Jardunaldia", "Jornada")}</label>
        <Select value={selected.jornada === undefined ? "" : String(selected.jornada)} disabled={!selected.jornadas.length}
          onValueChange={value => navigate({ search: { equipo: selected.team?.id ?? "", jornada: Number(value), partido: "" } })}>
          <SelectTrigger aria-labelledby="jornada-label"><SelectValue placeholder={t("Aukeratu jardunaldia", "Seleccionar jornada")} /></SelectTrigger>
          <SelectContent>{selected.jornadas.map(j => <SelectItem key={j} value={String(j)}>J{j}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {selected.options.length > 1 && <div className="min-w-0 space-y-2">
        <label id="match-label" className="text-sm font-semibold">{t("Partida", "Partido")}</label>
        <Select value={selected.match?.id ?? ""} onValueChange={partido => navigate({ search: { equipo: selected.team?.id ?? "", jornada: selected.jornada ?? 0, partido } })}>
          <SelectTrigger aria-labelledby="match-label"><SelectValue /></SelectTrigger>
          <SelectContent>{selected.options.map(m => <SelectItem key={m.id} value={m.id}>{matchLabel(m)}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
    </div>
    {!selected.match ? <p className="mt-8 text-muted-foreground">{t("Ez dago partidarik.", "No hay partidos.")}</p> : <>
      <section className="mt-8 border-y border-border py-5">
        <h2 className="font-display text-2xl" translate="no">{selected.team?.nombre}</h2>
        <p className="mt-1 text-sm text-muted-foreground">J{selected.match.jornada} · {matchLabel(selected.match)}</p>
        <p className="mt-1 text-sm"><span translate="no">{selected.match.rival}</span></p>
        <p className="mt-3 text-sm font-semibold">{people.length} {t("parte-hartzaile", "participantes")}</p>
      </section>
      {!people.length ? <p className="mt-6 text-muted-foreground">{t("Ez dago parte-hartzerik erregistratuta partida honetan.", "No hay participaciones registradas en este partido.")}</p> : <>
        <section className="mt-7">
          <h2 className="font-display text-2xl">{t("Taldearen estatistikak", "Estadísticas del equipo")}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
            {criteria.map(c => <div key={c.id} className="border-b border-border py-3">
              <dt className="text-sm text-muted-foreground">{td(c.nombre)}</dt>
              <dd className="mt-1 font-display text-2xl tabular-nums">{totals[c.id] ?? 0}</dd>
            </div>)}
            <div className="border-b border-border py-3"><dt className="text-sm text-muted-foreground">{t("Jaurtiketen asmatze-ehunekoa", "Porcentaje de acierto de lanzamiento")}</dt><dd className="mt-1 font-display text-2xl text-primary tabular-nums">{number(percentages.shooting)}</dd></div>
            <div className="border-b border-border py-3"><dt className="text-sm text-muted-foreground">{t("Geldiketen ehunekoa", "Porcentaje de paradas")}</dt><dd className="mt-1 font-display text-2xl text-primary tabular-nums">{number(percentages.saves)}</dd></div>
          </dl>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl">{t("Beste taldeetako deituak", "Convocados de otros equipos")}</h2>
          {callUps.length ? <ul className="mt-3 divide-y divide-border">{callUps.map(p => <li key={p.id} className="py-3">
            <span className="font-semibold" translate="no">{[p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(" ")}</span>
            <div className="mt-1 text-sm text-muted-foreground">{memberships(p).map(team => <span key={team.id} className="mr-4"><span translate="no">{team.nombre}</span> · {td(team.categoria)} · {td(team.sexo)}</span>)}</div>
          </li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{t("Ez dago beste taldeetako deiturik erregistratuta.", "No hay convocados de otros equipos registrados.")}</p>}
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl">{t("Banakako estatistikak", "Estadísticas individuales")}</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={t("Parte-hartzaileen estatistikak", "Estadísticas de participantes")}>
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground"><tr>
                <th className="min-w-48 p-3 text-left">{t("Jokalaria", "Jugador/a")}</th>
                <th className="min-w-52 p-3 text-left">{t("Ohiko taldea / kategoria", "Equipo / categoría habitual")}</th>
                {criteria.map(c => <th key={c.id} className="min-w-28 p-3 text-right font-medium">{td(c.nombre)}</th>)}
                <th className="min-w-28 p-3 text-right">{t("Asmatze %", "% de acierto")}</th><th className="min-w-28 p-3 text-right">{t("Geldiketa %", "% de paradas")}</th>
              </tr></thead>
              <tbody>{people.map(p => {
                const individual = performancePercentages(counts[p.id]);
                return <tr key={p.id} className="border-t border-border">
                  <th scope="row" className="p-3 text-left font-semibold"><span translate="no">{[p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(" ")}</span>{isCallUp(p) && <span className="mt-1 block text-xs font-normal text-primary">{t("Deitua", "Convocado/a")}</span>}</th>
                  <td className="p-3 text-muted-foreground">{memberships(p).length ? memberships(p).map(team => <div key={team.id}><span translate="no">{team.nombre}</span><div className="text-xs">{td(team.categoria)} · {td(team.sexo)}</div></div>) : t("Ez dago talderik erregistratuta", "Sin equipo habitual registrado")}</td>
                  {criteria.map(c => <td key={c.id} className="p-3 text-right tabular-nums">{counts[p.id][c.id] ?? 0}</td>)}
                  <td className="p-3 text-right tabular-nums">{number(individual.shooting)}</td><td className="p-3 text-right tabular-nums">{number(individual.saves)}</td>
                </tr>;
              })}</tbody>
              <tfoot className="border-t border-border bg-secondary font-semibold"><tr>
                <th scope="row" className="p-3 text-left">{t("Guztira", "Total")}</th><td />
                {criteria.map(c => <td key={c.id} className="p-3 text-right tabular-nums">{totals[c.id] ?? 0}</td>)}
                <td className="p-3 text-right">{number(percentages.shooting)}</td><td className="p-3 text-right">{number(percentages.saves)}</td>
              </tr></tfoot>
            </table>
          </div>
        </section>
      </>}
    </>}
  </main>;
}