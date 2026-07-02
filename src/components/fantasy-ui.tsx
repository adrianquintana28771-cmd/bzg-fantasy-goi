import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, POSITION_LABEL } from "@/lib/fantasy/types";
import type { PlayerAggregate } from "@/lib/fantasy/queries";

const POS_COLOR: Record<string, string> = {
  portero: "bg-warning/20 text-warning-foreground",
  extremo: "bg-primary/15 text-primary",
  lateral: "bg-accent/15 text-accent",
  central: "bg-secondary text-secondary-foreground",
  pivote: "bg-success/15 text-success",
  universal: "bg-muted text-muted-foreground",
};

export function PlayerCard({ agg, rank }: { agg: PlayerAggregate; rank?: number }) {
  const { player, team } = agg;
  return (
    <Link
      to="/jugadores/$playerId"
      params={{ playerId: player.id }}
      className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
    >
      {rank !== undefined && (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-display text-lg text-primary-foreground">
          {rank}
        </div>
      )}
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary font-display text-xl text-secondary-foreground">
        {player.dorsal}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{player.publicName}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", POS_COLOR[player.position])}>
            {POSITION_LABEL[player.position]}
          </span>
          <span className="truncate">{team.name}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-2xl leading-none text-primary">{agg.totalPoints}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">pts</div>
      </div>
    </Link>
  );
}

export function CategoryBadge({ category }: { category: keyof typeof CATEGORY_LABEL }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendiente: "bg-muted text-muted-foreground",
    estadisticas: "bg-warning/25 text-warning-foreground",
    validado: "bg-primary/20 text-primary",
    publicado: "bg-success/20 text-success",
  };
  const label: Record<string, string> = {
    pendiente: "Pendiente",
    estadisticas: "Con estadísticas",
    validado: "Validado",
    publicado: "Publicado",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", map[status])}>
      {label[status]}
    </span>
  );
}
