import { Link } from "@tanstack/react-router";
import type { RankedPlayer } from "@/lib/club-data";
import { useT } from "@/lib/i18n";

export function RankedPlayerRow({ p, rank }: { p: RankedPlayer; rank: number }) {
  const t = useT();
  return (
    <Link
      to="/jugadores/$playerId"
      params={{ playerId: p.id }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="w-7 text-center font-display text-xl text-muted-foreground">{rank}</div>
      <div className="min-w-0 flex-1">
        <div translate="no" className="truncate font-semibold">{p.nombre}</div>
        <div className="truncate text-xs text-muted-foreground">
          {p.team?.nombre ?? "BZG"}
          {p.esEntrenador ? ` · ${t("Entrenatzailea", "Entrenador/a")}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-2xl text-primary">{p.puntos}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</div>
      </div>
    </Link>
  );
}
