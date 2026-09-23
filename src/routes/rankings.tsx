import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFantasy } from "@/lib/fantasy/store";
import { buildRanking } from "@/lib/fantasy/queries";
import { PlayerCard } from "@/components/fantasy-ui";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_LABEL,
  CATEGORY_LABEL_EU,
  POSITION_LABEL,
  POSITION_LABEL_EU,
} from "@/lib/fantasy/types";
import { useT, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/rankings")({
  head: () => {
    const title = "Rankings de jugadores | BZG Fantasy Eskubaloia";
    const description =
      "Clasificación del fantasy de balonmano de Etxebarri: rankings de jugadores y usuarios con estadísticas por equipo, categoría, jornada y posición.";
    const url = "https://bzg-fantasy-goi.lovable.app/rankings";
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
  component: Rankings,
});

function Rankings() {
  const t = useT();
  const { lang } = useLang();
  const CAT_LABEL = lang === "eu" ? CATEGORY_LABEL_EU : CATEGORY_LABEL;
  const POS_LABEL = lang === "eu" ? POSITION_LABEL_EU : POSITION_LABEL;
  const { seasons, teams, players, matches, stats, rules } = useFantasy((s) => s);
  const [seasonId, setSeasonId] = useState(seasons.find((s) => s.isActive)?.id ?? seasons[0].id);
  const [category, setCategory] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [sortBy, setSortBy] = useState<"total" | "avg">("total");
  const [tab, setTab] = useState<"jugadores" | "usuarios">("jugadores");

  const filteredTeams = teams.filter((t) => t.seasonId === seasonId);
  const ranking = buildRanking(players, teams, matches, stats, rules, {
    seasonId,
    category: category || undefined,
    teamId: teamId || undefined,
    gender: gender || undefined,
    position: position || undefined,
  });
  const sorted =
    sortBy === "avg" ? [...ranking].sort((a, b) => b.avgPoints - a.avgPoints) : ranking;

  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{t("Sailkapenak", "Rankings")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Klubeko Fantasy puntu onenak.", "Los mejores puntos Fantasy del club.")}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
        {(
          [
            ["jugadores", t("Jokalariak", "Jugadores/as")],
            ["usuarios", t("Erabiltzaileak", "Usuarios")],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === k ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "usuarios" ? (
        <UsuariosRanking />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-3 shadow-card md:grid-cols-6">
            <Select value={seasonId} onChange={setSeasonId} label={t("Denboraldia", "Temporada")}>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={category} onChange={setCategory} label={t("Kategoria", "Categoría")}>
              <option value="">{t("Guztiak", "Todas")}</option>
              {Object.entries(CAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select value={gender} onChange={setGender} label={t("Generoa", "Género")}>
              <option value="">{t("Guztiak", "Todos")}</option>
              <option value="masculino">{t("Gizonezkoa", "Masculino")}</option>
              <option value="femenino">{t("Emakumezkoa", "Femenino")}</option>
              <option value="mixto">{t("Mistoa", "Mixto")}</option>
            </Select>
            <Select value={teamId} onChange={setTeamId} label={t("Taldea", "Equipo")}>
              <option value="">{t("Guztiak", "Todos")}</option>
              {filteredTeams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </Select>
            <Select value={position} onChange={setPosition} label={t("Posizioa", "Posición")}>
              <option value="">{t("Guztiak", "Todas")}</option>
              {Object.entries(POS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select
              value={sortBy}
              onChange={(v) => setSortBy(v as "total" | "avg")}
              label={t("Ordenatu honela", "Ordenar por")}
            >
              <option value="total">{t("Puntu guztira", "Puntos totales")}</option>
              <option value="avg">{t("Partidako batez bestekoa", "Media por partido")}</option>
            </Select>
          </div>

          {podium.length > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-3 md:gap-6">
              <PodiumSpot agg={podium[1]} place={2} height="h-32 md:h-40" color="var(--silver)" />
              <PodiumSpot agg={podium[0]} place={1} height="h-44 md:h-56" color="var(--gold)" />
              <PodiumSpot agg={podium[2]} place={3} height="h-28 md:h-36" color="var(--bronze)" />
            </div>
          )}

          <div className="mt-8 space-y-2">
            {rest.map((agg, i) => (
              <PlayerCard key={agg.player.id} agg={agg} rank={i + 4} />
            ))}
            {sorted.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                {t(
                  "Ez dago jokalaririk aukeratutako iragazkiekin.",
                  "No hay jugadores/as con los filtros seleccionados.",
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {children}
      </select>
    </label>
  );
}

function PodiumSpot({
  agg,
  place,
  height,
  color,
}: {
  agg?: import("@/lib/fantasy/queries").PlayerAggregate;
  place: number;
  height: string;
  color: string;
}) {
  if (!agg) return <div />;
  return (
    <div className="flex flex-col items-center justify-end">
      <div className="mb-2 text-center">
        <div className="font-display text-lg">{agg.player.publicName}</div>
        <div className="text-xs text-muted-foreground">{agg.team.name}</div>
      </div>
      <div
        className={`w-full ${height} flex flex-col items-center justify-center rounded-t-2xl text-primary-foreground shadow-elevated`}
        style={{
          background: `linear-gradient(180deg, ${color} 0%, color-mix(in oklab, ${color} 60%, black) 100%)`,
        }}
      >
        <div className="font-display text-5xl md:text-6xl">{place}</div>
        <div className="mt-1 font-display text-3xl">{agg.totalPoints}</div>
        <div className="text-[10px] uppercase tracking-widest opacity-80">pts</div>
      </div>
    </div>
  );
}

function UsuariosRanking() {
  const t = useT();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["user-ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_ranking");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        userId: r.user_id as string,
        nombre:
          (r.username as string | null) ??
          (r.display_name as string | null) ??
          t("Erabiltzailea", "Usuario"),
        puntos: Math.round(Number(r.puntos)),
        jornadas: Number(r.jornadas),
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("user-ranking-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_jornada_stats" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-ranking"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lineups" }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-ranking"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const rows = q.data ?? [];

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        {t(
          "Erabiltzaile bakoitzak jardunaldi bakoitzean lerrokatutako 7 jokalarien puntuak batzen ditu.",
          "Cada usuario suma los puntos de los 7 jugadores/as que alineó en cada jornada.",
        )}
      </p>
      {q.isLoading && (
        <p className="mt-6 text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>
      )}
      {!q.isLoading && rows.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {t(
            "Oraindik ez dago alineazio puntuaturik duen erabiltzailerik.",
            "Todavía no hay usuarios con alineaciones puntuadas.",
          )}
        </div>
      )}
      <ol className="mt-4 space-y-2">
        {rows.map((u, i) => (
          <li
            key={u.userId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-lg"
                style={{
                  background:
                    i === 0
                      ? "var(--gold)"
                      : i === 1
                        ? "var(--silver)"
                        : i === 2
                          ? "var(--bronze)"
                          : "var(--color-secondary)",
                  color: i < 3 ? "#000" : "inherit",
                }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{u.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {u.jornadas} {t("jardunaldi", "jornada(s)")}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl text-primary">{u.puntos}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
