import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useFantasy } from "@/lib/fantasy/store";
import { aggregatePlayer } from "@/lib/fantasy/queries";
import { CategoryBadge } from "@/components/fantasy-ui";
import { POSITION_LABEL } from "@/lib/fantasy/types";

export const Route = createFileRoute("/jugadores/$playerId")({
  component: Jugador,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="font-display text-3xl">Jugador/a no encontrado/a</h1>
      <Link to="/equipos" className="mt-4 inline-block text-primary hover:underline">Volver</Link>
    </div>
  ),
});

function Jugador() {
  const { playerId } = Route.useParams();
  const { teams, players, matches, stats, rules } = useFantasy((s) => s);
  const player = players.find((p) => p.id === playerId);
  if (!player) throw notFound();
  const agg = aggregatePlayer(player, teams, matches, stats, rules);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/equipos/$teamId"
        params={{ teamId: agg.team.id }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {agg.team.name}
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-card" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center gap-5">
          <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 font-display text-5xl text-primary-foreground shadow-elevated">
            {player.dorsal}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-4xl">{player.publicName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <CategoryBadge category={agg.team.category} />
              <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {POSITION_LABEL[player.position]}
              </span>
              <span className="text-muted-foreground">{agg.team.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl text-primary">{agg.totalPoints}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">puntos Fantasy</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Partidos" value={agg.matchesPlayed} />
          <MiniStat label="Media/partido" value={agg.avgPoints.toFixed(1)} />
          <MiniStat label="Goles" value={agg.goals} />
          <MiniStat label="Asistencias" value={agg.assists} />
          <MiniStat label="Recuperaciones" value={agg.steals} />
          <MiniStat label="Paradas" value={agg.saves} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-xl">Evolución por jornada</h2>
        {agg.perMatch.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin partidos aún.</p>
        ) : (
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={agg.perMatch.map((m) => ({ jornada: `J${m.round}`, pts: m.points }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="jornada" stroke="var(--color-muted-foreground)" />
                <YAxis stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pts"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "var(--color-primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        🔒 Mostramos solo alias o nombre + inicial. Los datos personales de menores están protegidos.
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-secondary p-3 text-center">
      <div className="font-display text-2xl text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
