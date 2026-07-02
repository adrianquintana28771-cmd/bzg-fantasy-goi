import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useFantasy } from "@/lib/fantasy/store";
import { buildRanking } from "@/lib/fantasy/queries";
import { PlayerCard, CategoryBadge } from "@/components/fantasy-ui";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/equipos/$teamId")({
  component: EquipoDetalle,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="font-display text-3xl">Equipo no encontrado</h1>
      <Link to="/equipos" className="mt-4 inline-block text-primary hover:underline">Volver</Link>
    </div>
  ),
});

function EquipoDetalle() {
  const { teamId } = Route.useParams();
  const { teams, players, matches, stats, rules } = useFantasy((s) => s);
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw notFound();
  const ranking = buildRanking(players, teams, matches, stats, rules, { teamId });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/equipos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Equipos
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{team.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <CategoryBadge category={team.category} />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
              {team.gender}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-primary/10 p-4 text-right">
          <div className="font-display text-3xl text-primary">
            {ranking.reduce((a, p) => a + p.totalPoints, 0)}
          </div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">pts totales</div>
        </div>
      </div>

      <h2 className="mt-8 font-display text-2xl">Ranking interno</h2>
      <div className="mt-3 space-y-2">
        {ranking.map((agg, i) => (
          <PlayerCard key={agg.player.id} agg={agg} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
