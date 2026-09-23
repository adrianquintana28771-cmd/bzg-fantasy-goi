import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { CategoryBadge } from "@/components/fantasy-ui";
import { POSITION_LABEL, POSITION_LABEL_EU, ESTADO_LABEL, ESTADO_LABEL_EU, type PlayerEstado, type Category } from "@/lib/fantasy/types";
import { useT, useLang } from "@/lib/i18n";
import { fetchPoolPlayer, fetchTeams, round2 } from "@/lib/club-data";

const ESTADO_COLOR: Record<PlayerEstado, string> = {
  disponible: "var(--color-primary)",
  dudoso: "#d4a017",
  no_disponible: "#dc2626",
};

export const Route = createFileRoute("/jugadores/$playerId")({
  head: ({ params }) => {
    const title = "Ficha de jugador/a | BZG Fantasy Eskubaloia";
    const description =
      "Estadísticas de balonmano y puntuación fantasy por jornada de este jugador o jugadora del club BZG Etxebarri.";
    const url = `https://bzg-fantasy-goi.lovable.app/jugadores/${params.playerId}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Jugador,
});

type ActionRow = { jornada: number; action_id: string; nombre: string; puntos: number; cantidad: number; orden: number };
type JStat = { jornada: number; puntos: number; estado: PlayerEstado };

function Jugador() {
  const t = useT();
  const { lang } = useLang();
  const POS_LABEL = lang === "eu" ? POSITION_LABEL_EU : POSITION_LABEL;
  const EST_LABEL = lang === "eu" ? ESTADO_LABEL_EU : ESTADO_LABEL;
  const { playerId } = Route.useParams();
  const q = useQuery({
    queryKey: ["jugador-real", playerId],
    queryFn: async () => {
      const player = await fetchPoolPlayer(playerId);
      if (!player) return null;
      const teams = await fetchTeams();
      const team = teams.find((t) => t.id === player.team_id) ?? null;
      const { data: st, error: e1 } = await supabase
        .from("player_jornada_stats")
        .select("jornada_numero,puntos,estado")
        .eq("player_id", playerId)
        .order("jornada_numero");
      if (e1) throw e1;
      let actions: ActionRow[] = [];
      if (player.club_player_id) {
        const { data, error } = await supabase
          .from("club_match_actions")
          .select("cantidad,action_id,club_matches(jornada),club_action_types(nombre,puntos,orden,activo)")
          .eq("player_id", player.club_player_id);
        if (error) throw error;
        actions = (data ?? [])
          .filter((r: any) => r.club_action_types?.activo)
          .map((r: any) => ({
            jornada: r.club_matches?.jornada ?? 0,
            action_id: r.action_id,
            nombre: r.club_action_types.nombre,
            puntos: Number(r.club_action_types.puntos),
            orden: r.club_action_types.orden,
            cantidad: r.cantidad,
          }));
      }
      const stats: JStat[] = (st ?? []).map((r) => ({
        jornada: r.jornada_numero,
        puntos: Number(r.puntos),
        estado: r.estado as PlayerEstado,
      }));
      return { player, team, stats, actions };
    },
  });

  if (q.isLoading) return <p className="p-10 text-center text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>;
  if (!q.data)
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="font-display text-3xl">{t("Jokalaria ez da aurkitu", "Jugador/a no encontrado/a")}</h1>
        <Link to="/equipos" className="mt-4 inline-block text-primary hover:underline">{t("Atzera", "Volver")}</Link>
      </div>
    );

  const { player, team, stats, actions } = q.data;
  const estado = (player.club?.estado ?? player.estado) as PlayerEstado;
  const dorsal = player.club?.dorsal;
  const total = round2(stats.reduce((a, s) => a + s.puntos, 0));
  const media = stats.length ? round2(total / stats.length) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {team ? (
        <Link
          to="/equipos/$teamId"
          params={{ teamId: team.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {team.nombre}
        </Link>
      ) : (
        <Link to="/equipos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("Taldeak", "Equipos")}
        </Link>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6" style={{ background: "var(--gradient-card)" }}>
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-elevated">
          <div className="grid h-full w-full place-items-center">
            <span className="font-display text-[8rem] leading-none text-primary-foreground/90">
              {dorsal ?? player.nombre.charAt(0)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <EstadoBadge estado={estado} />
            {dorsal != null && (
              <span className="rounded bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white">#{dorsal}</span>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <h1 className="font-display text-2xl leading-tight sm:text-3xl">{player.club?.nombre ?? player.nombre}</h1>
          {(player.club?.apellido1 || player.club?.apellido2) && (
            <p className="text-sm text-muted-foreground">
              {[player.club?.apellido1, player.club?.apellido2].filter(Boolean).join(" ")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            {team && <CategoryBadge category={team.categoria as Category} />}
            <span className="rounded bg-primary/15 px-2 py-0.5 font-medium text-primary">
              {POS_LABEL[player.posicion as keyof typeof POS_LABEL] ?? player.posicion}
            </span>
            {team && <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{team.nombre}</span>}
            <span className="rounded bg-[color:var(--gold,#d4a017)]/20 px-2 py-0.5 font-bold text-foreground">
              {total} pts
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat label={t("Jardunaldiak", "Jornadas")} value={stats.length} />
          <MiniStat label={t("Batez bestekoa", "Media")} value={media} />
          <MiniStat label={t("Guztira", "Total")} value={total} />
        </div>
      </div>

      <Desempeno stats={stats} actions={actions} />

      <JornadasChart rows={stats} />

      <p className="mt-4 text-xs text-muted-foreground">
        🔒 {t("Adingabeen datu pertsonalak babestuta daude.", "Los datos personales de menores están protegidos.")}
      </p>
    </div>
  );
}

function Desempeno({ stats, actions }: { stats: JStat[]; actions: ActionRow[] }) {
  const t = useT();
  const jornadas = useMemo(
    () => Array.from(new Set([...stats.map((s) => s.jornada), ...actions.map((a) => a.jornada)])).sort((a, b) => a - b),
    [stats, actions],
  );
  const [sel, setSel] = useState<number | "total">(jornadas.length ? jornadas[jornadas.length - 1] : "total");
  const current = sel === "total" || jornadas.includes(sel) ? sel : "total";

  const ptsFor = (j: number) => stats.find((s) => s.jornada === j)?.puntos ?? 0;
  const estadoFor = (j: number) => stats.find((s) => s.jornada === j)?.estado ?? "disponible";

  const filtered = current === "total" ? actions : actions.filter((a) => a.jornada === current);
  const grouped = new Map<string, { nombre: string; puntos: number; cantidad: number; orden: number }>();
  for (const a of filtered) {
    const g = grouped.get(a.action_id) ?? { nombre: a.nombre, puntos: a.puntos, cantidad: 0, orden: a.orden };
    g.cantidad += a.cantidad;
    grouped.set(a.action_id, g);
  }
  const rows = [...grouped.values()].filter((r) => r.cantidad > 0).sort((a, b) => a.orden - b.orden);
  const totalPts =
    current === "total" ? round2(stats.reduce((a, s) => a + s.puntos, 0)) : round2(ptsFor(current));
  const accionesPts = round2(rows.reduce((a, r) => a + r.cantidad * r.puntos, 0));
  const extra = round2(totalPts - accionesPts);
  const noDisp = current !== "total" && estadoFor(current) === "no_disponible";

  const chip = (active: boolean) =>
    `shrink-0 rounded-xl border px-3 py-2 text-center transition ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"
    }`;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <h2 className="px-5 pt-5 font-display text-xl">{t("Jardunaldiko errendimendua", "Desempeño por jornada")}</h2>
      {jornadas.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">{t("Oraindik ez du jardunaldirik jokatu.", "Aún no ha jugado ninguna jornada.")}</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-3">
            <button className={chip(current === "total")} onClick={() => setSel("total")}>
              <div className="text-[10px] font-semibold uppercase">{t("Guztira", "Total")}</div>
              <div className="font-display text-lg">{round2(stats.reduce((a, s) => a + s.puntos, 0))}</div>
            </button>
            {jornadas.map((j) => (
              <button key={j} className={chip(current === j)} onClick={() => setSel(j)}>
                <div className="text-[10px] font-semibold uppercase">J{j}</div>
                <div className="font-display text-lg">{round2(ptsFor(j))}</div>
                <div className="mt-1 h-1 w-8 rounded-full" style={{ background: ESTADO_COLOR[estadoFor(j)] }} />
              </button>
            ))}
          </div>

          <div className="border-t border-border px-5 py-3 text-center font-display text-lg">
            {current === "total" ? t("Jardunaldi guztiak", "Todas las jornadas") : `${t("Jardunaldia", "Jornada")} ${current}`}
          </div>
          <div className="grid grid-cols-[4rem_1fr_4rem] border-t border-border bg-secondary/60 px-5 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>{t("Kop.", "Cantidad")}</span>
            <span className="text-center">{t("Estatistika", "Estadística")}</span>
            <span className="text-right">{t("Puntuak", "Puntos")}</span>
          </div>
          {noDisp && (
            <p className="border-t border-border px-5 py-3 text-sm text-destructive">{t("Jardunaldi honetan ez eskuragarri: 0 puntu.", "No disponible esta jornada: puntúa 0.")}</p>
          )}
          {rows.length === 0 && extra === 0 && !noDisp && (
            <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">{t("Ez dago ekintzarik erregistratuta.", "Sin acciones registradas.")}</p>
          )}
          {rows.map((r) => {
            const p = round2(r.cantidad * r.puntos);
            return (
              <div key={r.nombre} className="grid grid-cols-[4rem_1fr_4rem] items-center border-t border-border px-5 py-3">
                <span className="font-display text-lg">{r.cantidad}</span>
                <span className="text-center text-sm font-semibold">{r.nombre}</span>
                <span className={`text-right font-display text-lg ${p > 0 ? "text-primary" : p < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {p > 0 ? `+${p}` : p}
                </span>
              </div>
            );
          })}
          {extra !== 0 && !noDisp && (
            <div className="grid grid-cols-[4rem_1fr_4rem] items-center border-t border-border px-5 py-3">
              <span className="font-display text-lg">–</span>
              <span className="text-center text-sm font-semibold">{t("Partidaren emaitza", "Resultado del partido")}</span>
              <span className={`text-right font-display text-lg ${extra > 0 ? "text-primary" : "text-destructive"}`}>
                {extra > 0 ? `+${extra}` : extra}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
            <span className="text-xs font-bold uppercase tracking-wide">
              {current === "total" ? t("Denboraldiko guztira", "Total temporada") : t("Jardunaldiko guztira", "Total jornada")}
            </span>
            <span className="font-display text-xl">{totalPts}</span>
          </div>
        </>
      )}
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

function JornadasChart({ rows }: { rows: JStat[] }) {
  const t = useT();
  const { lang } = useLang();
  const EST_LABEL = lang === "eu" ? ESTADO_LABEL_EU : ESTADO_LABEL;
  const data = rows.map((r) => ({ jornada: `J${r.jornada}`, pts: r.puntos, estado: r.estado }));
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-xl">{t("Jardunaldiko puntuazioa", "Puntuación por jornada")}</h2>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(ESTADO_COLOR) as PlayerEstado[]).map((e) => (
          <span key={e} className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ESTADO_COLOR[e] }} />
            {EST_LABEL[e]}
          </span>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("Oraindik puntuatutako jardunaldirik ez.", "Sin jornadas puntuadas aún.")}</p>
      ) : (
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="jornada" stroke="var(--color-muted-foreground)" />
              <YAxis stroke="var(--color-muted-foreground)" />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)" }}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                formatter={(v: number, _n, item) => [
                  `${v} pts · ${EST_LABEL[(item?.payload as { estado: PlayerEstado }).estado]}`,
                  t("Jardunaldia", "Jornada"),
                ]}
              />
              <Bar dataKey="pts" radius={[6, 6, 0, 0]}>
                {data.map((r, i) => (
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
  const { lang } = useLang();
  const EST_LABEL = lang === "eu" ? ESTADO_LABEL_EU : ESTADO_LABEL;
  const style: Record<PlayerEstado, string> = {
    disponible: "bg-primary text-primary-foreground",
    dudoso: "bg-[color:var(--gold,#d4a017)] text-black",
    no_disponible: "bg-destructive text-white",
  };
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide shadow ${style[estado]}`}>
      {EST_LABEL[estado]}
    </span>
  );
}
