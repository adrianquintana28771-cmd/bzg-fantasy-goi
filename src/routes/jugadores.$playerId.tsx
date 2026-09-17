import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useFantasy } from "@/lib/fantasy/store";
import { aggregatePlayer } from "@/lib/fantasy/queries";
import { supabase } from "@/integrations/supabase/client";
import { CategoryBadge } from "@/components/fantasy-ui";
import { POSITION_LABEL, ESTADO_LABEL, type PlayerEstado } from "@/lib/fantasy/types";

const ESTADO_COLOR: Record<PlayerEstado, string> = {
  disponible: "var(--color-primary)",
  dudoso: "#d4a017",
  no_disponible: "#dc2626",
};


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

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6" style={{ background: "var(--gradient-card)" }}>
        {/* Foto grande con pie de foto (estado) */}
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-elevated">
          <div className="grid h-full w-full place-items-center">
            <span className="font-display text-[8rem] leading-none text-primary-foreground/90">
              {player.dorsal}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <EstadoBadge estado={player.estado} />
            <span className="rounded bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white">
              #{player.dorsal}
            </span>
          </div>
        </div>

        <div className="mt-4 text-center">
          <h1 className="font-display text-2xl leading-tight sm:text-3xl">{player.publicName}</h1>
          {(player.apellido1 || player.apellido2) && (
            <p className="text-sm text-muted-foreground">
              {[player.apellido1, player.apellido2].filter(Boolean).join(" ")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <CategoryBadge category={agg.team.category} />
            <span className="rounded bg-primary/15 px-2 py-0.5 font-medium text-primary">
              {POSITION_LABEL[player.position]}
            </span>
            <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{agg.team.name}</span>
            <span className="rounded bg-[color:var(--gold,#d4a017)]/20 px-2 py-0.5 font-bold text-foreground">
              {agg.totalPoints} pts
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <MiniStat label="Partidos" value={agg.matchesPlayed} />
          <MiniStat label="Media" value={agg.avgPoints.toFixed(1)} />
          <MiniStat label="Goles" value={agg.goals} />
          <MiniStat label="Asist." value={agg.assists} />
          <MiniStat label="Recup." value={agg.steals} />
          <MiniStat label="Paradas" value={agg.saves} />
        </div>
      </div>

      <JornadasChart playerId={player.id} />


      <p className="mt-4 text-xs text-muted-foreground">
        🔒 Mostramos solo alias o nombre + inicial. Los datos personales de menores están protegidos.
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-secondary p-2 text-center">
      <div className="font-display text-lg text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function JornadasChart({ playerId }: { playerId: string }) {
  const q = useQuery({
    queryKey: ["player-jornada-stats", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_jornada_stats")
        .select("jornada_numero, puntos, estado")
        .eq("player_id", playerId)
        .order("jornada_numero");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        jornada: `J${r.jornada_numero}`,
        pts: Number(r.puntos),
        estado: r.estado as PlayerEstado,
      }));
    },
  });
  const rows = q.data ?? [];

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-xl">Puntuación por jornada</h2>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(ESTADO_COLOR) as PlayerEstado[]).map((e) => (
          <span key={e} className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ESTADO_COLOR[e] }} />
            {ESTADO_LABEL[e]}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin jornadas puntuadas aún.</p>
      ) : (
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="jornada" stroke="var(--color-muted-foreground)" />
              <YAxis stroke="var(--color-muted-foreground)" />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
                formatter={(v: number, _n, item) => [
                  `${v} pts · ${ESTADO_LABEL[(item?.payload as { estado: PlayerEstado }).estado]}`,
                  "Jornada",
                ]}
              />
              <Bar dataKey="pts" radius={[6, 6, 0, 0]}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={ESTADO_COLOR[r.estado]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}




function EstadoBadge({ estado }: { estado: PlayerEstado }) {
  const style: Record<PlayerEstado, string> = {
    disponible: "bg-primary text-primary-foreground",
    dudoso: "bg-[color:var(--gold,#d4a017)] text-black",
    no_disponible: "bg-destructive text-white",
  };
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide shadow ${style[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}
