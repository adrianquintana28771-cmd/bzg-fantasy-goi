import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CategoryBadge } from "@/components/fantasy-ui";
import { ArrowLeft } from "lucide-react";
import { POSITION_LABEL, type Category } from "@/lib/fantasy/types";
import { fetchPool, fetchPointsByPlayer, fetchTeams, round2 } from "@/lib/club-data";

export const Route = createFileRoute("/equipos/$teamId")({
  head: ({ params }) => {
    const title = "Equipo de balonmano | BZG Fantasy Eskubaloia";
    const description =
      "Plantilla, ranking interno y estadísticas de balonmano de este equipo del club BZG Etxebarri en el fantasy de balonmano.";
    const url = `https://bzg-fantasy-goi.lovable.app/equipos/${params.teamId}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: EquipoDetalle,
});

function EquipoDetalle() {
  const { teamId } = Route.useParams();
  const q = useQuery({
    queryKey: ["club-equipo", teamId],
    queryFn: async () => {
      const [teams, pool, pts] = await Promise.all([fetchTeams(), fetchPool(), fetchPointsByPlayer()]);
      return { team: teams.find((t) => t.id === teamId), pool: pool.filter((p) => p.team_id === teamId), pts };
    },
  });

  if (q.isLoading) return <p className="p-10 text-center text-sm text-muted-foreground">Cargando…</p>;
  const team = q.data?.team;
  if (!team)
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="font-display text-3xl">Equipo no encontrado</h1>
        <Link to="/equipos" className="mt-4 inline-block text-primary hover:underline">Volver</Link>
      </div>
    );
  const pts = q.data!.pts;
  const ranking = [...q.data!.pool].sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0));
  const total = round2(ranking.filter((p) => !p.club?.es_entrenador).reduce((a, p) => a + (pts[p.id] ?? 0), 0));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/equipos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Equipos
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{team.nombre}</h1>
          <div className="mt-2 flex items-center gap-2">
            <CategoryBadge category={team.categoria as Category} />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
              {team.sexo}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-primary/10 p-4 text-right">
          <div className="font-display text-3xl text-primary">{total}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">pts totales</div>
        </div>
      </div>

      <h2 className="mt-8 font-display text-2xl">Ranking interno</h2>
      <div className="mt-3 space-y-2">
        {ranking.map((p, i) => (
          <Link
            key={p.id}
            to="/jugadores/$playerId"
            params={{ playerId: p.id }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition hover:shadow-elevated"
          >
            <span className="w-6 text-center font-display text-lg text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.nombre}</div>
              <div className="text-xs text-muted-foreground">
                {POSITION_LABEL[p.posicion as keyof typeof POSITION_LABEL] ?? p.posicion}
              </div>
            </div>
            <span className="font-display text-xl text-primary">{round2(pts[p.id] ?? 0)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
