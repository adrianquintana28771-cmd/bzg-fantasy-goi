import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Users, ClipboardList, Shield, ArrowRight, Sparkles } from "lucide-react";
import { useFantasy } from "@/lib/fantasy/store";
import { buildRanking } from "@/lib/fantasy/queries";
import { PlayerCard, StatusBadge, CategoryBadge } from "@/components/fantasy-ui";
import { CATEGORY_LABEL } from "@/lib/fantasy/types";

const SITE = "https://bzg-fantasy-goi.lovable.app";
const HOME_TITLE = "BZG Fantasy Eskubaloia | Fantasy de balonmano de Etxebarri";
const HOME_DESC =
  "BZG Fantasy Eskubaloia: sigue los rankings, jugadores, equipos, partidos y estadísticas del fantasy de balonmano de Etxebarri.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SportsOrganization",
          name: "BZG Etxebarri · Berdezurigorri",
          sport: "Balonmano",
          url: SITE,
          areaServed: "Etxebarri, Bizkaia",
          description: HOME_DESC,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "BZG Fantasy Eskubaloia",
          url: SITE,
          inLanguage: "es-ES",
        }),
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { seasons, teams, players, matches, stats, rules } = useFantasy((s) => s);
  const activeSeason = seasons.find((s) => s.isActive);
  const ranking = buildRanking(players, teams, matches, stats, rules, {
    seasonId: activeSeason?.id,
  });
  const top5 = ranking.slice(0, 5);
  const playerOfWeek = ranking[0];
  const teamTotals = teams
    .filter((t) => t.seasonId === activeSeason?.id)
    .map((t) => ({
      team: t,
      pts: buildRanking(players, teams, matches, stats, rules, { teamId: t.id }).reduce(
        (a, p) => a + p.totalPoints,
        0,
      ),
    }))
    .sort((a, b) => b.pts - a.pts);
  const topTeam = teamTotals[0];
  const recent = [...matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_35%),radial-gradient(circle_at_80%_60%,white_0,transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-primary-foreground md:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Temporada {activeSeason?.name}
          </div>
          <h1 className="mt-4 font-display text-5xl leading-none md:text-7xl">
            BZG Fantasy<br />Eskubaloia
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/90">
            El Fantasy del balonmano de Etxebarri. Sigue a tus jugadores/as, revisa
            rankings y disfruta cada jornada con toda la familia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/rankings"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-primary shadow-lg transition hover:-translate-y-0.5"
            >
              <Trophy className="h-4 w-4" /> Ver rankings
            </Link>
            <Link
              to="/equipos"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Users className="h-4 w-4" /> Ver equipos
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <ClipboardList className="h-4 w-4" /> Acceso delegado/a
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Shield className="h-4 w-4" /> Administración
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Player of the week */}
          {playerOfWeek && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Jugador/a de la jornada
                </span>
                <Trophy className="h-5 w-5 text-gold" style={{ color: "var(--gold)" }} />
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 font-display text-3xl text-primary-foreground">
                  {playerOfWeek.player.dorsal}
                </div>
                <div className="flex-1">
                  <div className="font-display text-2xl">{playerOfWeek.player.publicName}</div>
                  <div className="text-sm text-muted-foreground">
                    {playerOfWeek.team.name} · {CATEGORY_LABEL[playerOfWeek.team.category]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl text-primary">{playerOfWeek.totalPoints}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    pts totales
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <Stat label="Goles" value={playerOfWeek.goals} />
                <Stat label="Asist." value={playerOfWeek.assists} />
                <Stat label="Recup." value={playerOfWeek.steals} />
                <Stat label="Paradas" value={playerOfWeek.saves} />
              </div>
            </div>
          )}
          {/* Top team */}
          {topTeam && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-accent">
                  Equipo destacado
                </span>
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-3 font-display text-2xl">{topTeam.team.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                <CategoryBadge category={topTeam.team.category} />
              </div>
              <div className="mt-4 rounded-xl bg-secondary p-4 text-center">
                <div className="font-display text-4xl text-primary">{topTeam.pts}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  puntos Fantasy acumulados
                </div>
              </div>
              <Link
                to="/equipos/$teamId"
                params={{ teamId: topTeam.team.id }}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Ver plantilla <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Top 5 & recent matches */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl">Top 5 Fantasy</h2>
              <Link to="/rankings" className="text-sm font-medium text-primary hover:underline">
                Ver ranking completo
              </Link>
            </div>
            <div className="space-y-2">
              {top5.map((agg, i) => (
                <PlayerCard key={agg.player.id} agg={agg} rank={i + 1} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl">Últimos partidos</h2>
              <Link to="/partidos" className="text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="space-y-2">
              {recent.map((m) => {
                const team = teams.find((t) => t.id === m.teamId)!;
                return (
                  <Link
                    key={m.id}
                    to="/partidos/$matchId"
                    params={{ matchId: m.id }}
                    className="block rounded-xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          J{m.round} · {new Date(m.date).toLocaleDateString("es-ES")}
                        </div>
                        <div className="mt-1 font-semibold">
                          {m.locationType === "local"
                            ? `${team.name} vs ${m.opponent}`
                            : `${m.opponent} vs ${team.name}`}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <CategoryBadge category={team.category} />
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                      <div className="text-right font-display">
                        <div className="text-3xl leading-none text-foreground">
                          {m.locationType === "local"
                            ? `${m.goalsFor}-${m.goalsAgainst}`
                            : `${m.goalsAgainst}-${m.goalsFor}`}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2">
      <div className="font-display text-xl text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
