import { createFileRoute, Link } from "@tanstack/react-router";
import { useFantasy } from "@/lib/fantasy/store";
import { CategoryBadge, StatusBadge } from "@/components/fantasy-ui";

export const Route = createFileRoute("/partidos")({
  head: () => ({
    meta: [
      { title: "Partidos · BZG Fantasy Eskubaloia" },
      { name: "description", content: "Partidos del club BZG Etxebarri con resultados y estado del acta." },
      { property: "og:title", content: "Partidos · BZG Fantasy" },
      { property: "og:description", content: "Partidos del club BZG Etxebarri." },
    ],
  }),
  component: Partidos,
});

function Partidos() {
  const { matches, teams } = useFantasy((s) => s);
  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-4xl">Partidos</h1>
      <p className="text-sm text-muted-foreground">Resultados, estado y acta de cada partido.</p>

      <div className="mt-6 space-y-2">
        {sorted.map((m) => {
          const team = teams.find((t) => t.id === m.teamId)!;
          return (
            <Link
              key={m.id}
              to="/partidos/$matchId"
              params={{ matchId: m.id }}
              className="block rounded-xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    J{m.round} · {new Date(m.date).toLocaleDateString("es-ES")} · {m.locationType === "local" ? "Local" : "Visitante"}
                  </div>
                  <div className="mt-1 font-semibold">
                    {m.locationType === "local"
                      ? `${team.name} vs ${m.opponent}`
                      : `${m.opponent} vs ${team.name}`}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={team.category} />
                    <StatusBadge status={m.status} />
                  </div>
                </div>
                <div className="text-right font-display">
                  <div className="text-3xl leading-none">
                    {m.locationType === "local"
                      ? `${m.goalsFor}-${m.goalsAgainst}`
                      : `${m.goalsAgainst}-${m.goalsFor}`}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.matchCode}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
