import { createFileRoute, Link } from "@tanstack/react-router";
import { useFantasy } from "@/lib/fantasy/store";
import { buildRanking } from "@/lib/fantasy/queries";
import { CategoryBadge } from "@/components/fantasy-ui";
import { CATEGORY_LABEL, type Category } from "@/lib/fantasy/types";
import { Users } from "lucide-react";

export const Route = createFileRoute("/equipos")({
  head: () => ({
    meta: [
      { title: "Equipos · BZG Fantasy Eskubaloia" },
      { name: "description", content: "Todos los equipos del club BZG Etxebarri por categoría." },
      { property: "og:title", content: "Equipos · BZG Fantasy" },
      { property: "og:description", content: "Equipos del club BZG Etxebarri por categoría." },
    ],
  }),
  component: Equipos,
});

const ORDER: Category[] = ["senior", "juvenil", "cadete", "infantil", "alevin", "benjamin"];

function Equipos() {
  const { seasons, teams, players, matches, stats, rules } = useFantasy((s) => s);
  const activeSeason = seasons.find((s) => s.isActive);
  const seasonTeams = teams.filter((t) => t.seasonId === activeSeason?.id);

  const grouped = ORDER.map((cat) => ({
    category: cat,
    teams: seasonTeams.filter((t) => t.category === cat),
  })).filter((g) => g.teams.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-4xl">Equipos</h1>
      <p className="text-sm text-muted-foreground">Temporada {activeSeason?.name}</p>

      <div className="mt-8 space-y-10">
        {grouped.map(({ category, teams: cts }) => (
          <div key={category}>
            <h2 className="mb-3 font-display text-2xl">{CATEGORY_LABEL[category]}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cts.map((t) => {
                const roster = players.filter((p) => p.teamId === t.id);
                const teamPts = buildRanking(players, teams, matches, stats, rules, { teamId: t.id })
                  .reduce((a, p) => a + p.totalPoints, 0);
                return (
                  <Link
                    key={t.id}
                    to="/equipos/$teamId"
                    params={{ teamId: t.id }}
                    className="group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
                    style={{ background: "var(--gradient-card)" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-display text-xl">{t.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <CategoryBadge category={t.category} />
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-secondary-foreground">
                            {t.gender}
                          </span>
                        </div>
                      </div>
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div className="text-sm text-muted-foreground">
                        {roster.length} jugadores/as
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl text-primary">{teamPts}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pts equipo</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
